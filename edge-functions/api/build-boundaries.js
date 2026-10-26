// edge-functions/api/build-boundaries.js  ->  POST /api/build-boundaries
// Rebuilds content/location-boundaries.geojson entirely on the server and commits it to GitHub, so a
// steward never needs a terminal, Node, or a file download -- works the same on a Chromebook as anywhere
// else. This is the easy path; scripts/build-boundaries.mjs (run from a real computer) is the power-user
// path and uses full 10m detail. This endpoint uses 50m Natural Earth data instead: the 10m admin-1
// (states/provinces) file alone is ~40MB, far past what a server function can fetch and process in one
// request, while 50m covers every country/sea/river/lake Hero is likely to use at a fraction of the size.
//
// Env vars (EdgeOne Pages project settings), all already configured for other endpoints in this project:
//   ADMIN_PASSWORD                        same as every other admin-only endpoint
//   FIREBASE_CLIENT_EMAIL, FIREBASE_PRIVATE_KEY_1..N   same service account as /api/firebase-token;
//                                          it also needs the "Cloud Datastore Viewer" IAM role so it can read
//                                          Firestore directly (see BOUNDARIES.md)
//   FIREBASE_PROJECT_ID (optional)         Firebase project id; otherwise derived from service account
//   GITHUB_TOKEN, GITHUB_REPOSITORY, DEPLOY_BRANCH (optional)   same as /api/deploy; the token needs
//                                          contents read/write access
//   DEPLOY_WEBHOOK_URL                    same as /api/deploy; triggers the live rebuild once committed

const json = (body, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } });

const enc = new TextEncoder();

// ---------- reused from the other endpoints, unchanged ----------
async function safeEqual(a, b) {
  const [ha, hb] = await Promise.all([crypto.subtle.digest('SHA-256', enc.encode(a)), crypto.subtle.digest('SHA-256', enc.encode(b))]);
  const x = new Uint8Array(ha), y = new Uint8Array(hb);
  let diff = 0;
  for (let i = 0; i < x.length; i++) diff |= x[i] ^ y[i];
  return diff === 0;
}
async function hmacHex(secret, msg) {
  const key = await crypto.subtle.importKey('raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const sig = await crypto.subtle.sign('HMAC', key, enc.encode(msg));
  return [...new Uint8Array(sig)].map((b) => b.toString(16).padStart(2, '0')).join('');
}
async function validToken(token, secret) {
  if (typeof token !== 'string') return false;
  const [expStr, sig] = token.split('.');
  const exp = Number(expStr);
  if (!exp || !sig || Date.now() > exp) return false;
  return safeEqual(sig, await hmacHex(secret, `admin.${exp}`));
}
function readPrivateKey(env) {
  if (env.FIREBASE_PRIVATE_KEY) return env.FIREBASE_PRIVATE_KEY;
  let key = '';
  for (let i = 1; i <= 12; i++) { const part = env[`FIREBASE_PRIVATE_KEY_${i}`]; if (!part) break; key += String(part).trim(); }
  return key;
}
const b64url = (input) => {
  const bytes = typeof input === 'string' ? enc.encode(input) : new Uint8Array(input);
  let s = ''; for (let i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i]);
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
};
async function importPrivateKey(pem) {
  const body = pem.replace(/["']/g, '').replace(/\\n/g, '\n').replace(/-----(BEGIN|END) PRIVATE KEY-----/g, '').replace(/\s+/g, '');
  const der = Uint8Array.from(atob(body), (c) => c.charCodeAt(0));
  return crypto.subtle.importKey('pkcs8', der, { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['sign']);
}

// ---------- service-account -> Google OAuth2 access token (for the Firestore REST API) ----------
async function googleAccessToken(email, pk, scope) {
  const now = Math.floor(Date.now() / 1000);
  const header = { alg: 'RS256', typ: 'JWT' };
  const payload = { iss: email, scope, aud: 'https://oauth2.googleapis.com/token', iat: now, exp: now + 3600 };
  const unsigned = `${b64url(JSON.stringify(header))}.${b64url(JSON.stringify(payload))}`;
  const key = await importPrivateKey(pk);
  const sig = await crypto.subtle.sign('RSASSA-PKCS1-v1_5', key, enc.encode(unsigned));
  const assertion = `${unsigned}.${b64url(sig)}`;
  const r = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: `grant_type=${encodeURIComponent('urn:ietf:params:oauth:grant-type:jwt-bearer')}&assertion=${assertion}`,
  });
  const data = await r.json().catch(() => ({}));
  if (!r.ok || !data.access_token) throw new Error(`google_oauth_failed:${r.status}:${data.error || ''}`);
  return data.access_token;
}

// ---------- Firestore REST (document -> plain JS value) ----------
function fsValue(v) {
  if (v == null) return null;
  if ('stringValue' in v) return v.stringValue;
  if ('integerValue' in v) return Number(v.integerValue);
  if ('doubleValue' in v) return v.doubleValue;
  if ('booleanValue' in v) return v.booleanValue;
  if ('arrayValue' in v) return (v.arrayValue.values || []).map(fsValue);
  if ('mapValue' in v) return fsFields(v.mapValue.fields || {});
  return null;
}
function fsFields(fields) { const out = {}; for (const k of Object.keys(fields)) out[k] = fsValue(fields[k]); return out; }
async function firestoreGetDoc(projectId, token, docPath) {
  const url = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/${docPath}`;
  const r = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
  if (r.status === 404) return null;
  const data = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(`firestore_read_failed:${r.status}:${data.error?.status || ''}:${data.error?.message || ''}`);
  return fsFields(data.fields || {});
}

// ---------- GitHub Contents API ----------
async function ghGetFile(repository, branch, token, filePath) {
  const encodedPath = filePath.split('/').map(encodeURIComponent).join('/');
  const r = await fetch(`https://api.github.com/repos/${repository}/contents/${encodedPath}?ref=${encodeURIComponent(branch)}`, {
    headers: { Authorization: `Bearer ${token}`, 'User-Agent': 'hero-build-boundaries', Accept: 'application/vnd.github+json', 'X-GitHub-Api-Version': '2022-11-28' },
  });
  if (r.status === 404) return null;
  if (!r.ok) throw new Error(`github_read_failed:${r.status}`);
  const data = await r.json();
  let text;
  if (data.encoding === 'base64' && data.content) {
    const binary = atob(data.content.replace(/\n/g, ''));
    const bytes = Uint8Array.from(binary, (c) => c.charCodeAt(0));
    text = new TextDecoder().decode(bytes);
  } else if (data.download_url) {
    const download = await fetch(data.download_url, { headers: { Authorization: `Bearer ${token}`, 'User-Agent': 'hero-build-boundaries' } });
    if (!download.ok) throw new Error(`github_download_failed:${download.status}`);
    text = await download.text();
  } else {
    throw new Error('github_file_content_unavailable');
  }
  return { text, sha: data.sha };
}
function b64(input) {
  const bytes = typeof input === 'string' ? enc.encode(input) : new Uint8Array(input);
  let s = '';
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(s);
}
async function ghApi(repository, token, path, options = {}) {
  const r = await fetch(`https://api.github.com/repos/${repository}/${path}`, {
    ...options,
    headers: {
      Accept: 'application/vnd.github+json',
      Authorization: `Bearer ${token}`,
      'User-Agent': 'hero-build-boundaries',
      'X-GitHub-Api-Version': '2022-11-28',
      ...(options.body ? { 'Content-Type': 'application/json' } : {}),
      ...options.headers,
    },
  });
  const data = await r.json().catch(() => ({}));
  if (!r.ok) throw Object.assign(new Error(data.message || 'GitHub request failed'), { status: r.status });
  return data;
}
async function ghCommitFiles(repository, branch, token, files, message) {
  const refPath = `git/ref/heads/${encodeURIComponent(branch)}`;
  const ref = await ghApi(repository, token, refPath);
  const parentSha = ref.object.sha;
  const parent = await ghApi(repository, token, `git/commits/${parentSha}`);
  const blobs = await Promise.all(files.map(async ({ path, text }) => ({
    path,
    sha: (await ghApi(repository, token, 'git/blobs', {
      method: 'POST', body: JSON.stringify({ content: b64(text), encoding: 'base64' }),
    })).sha,
  })));
  const tree = await ghApi(repository, token, 'git/trees', {
    method: 'POST',
    body: JSON.stringify({
      base_tree: parent.tree.sha,
      tree: blobs.map(({ path, sha }) => ({ path, mode: '100644', type: 'blob', sha })),
    }),
  });
  const commit = await ghApi(repository, token, 'git/commits', {
    method: 'POST', body: JSON.stringify({ message, tree: tree.sha, parents: [parentSha] }),
  });
  await ghApi(repository, token, refPath, { method: 'PATCH', body: JSON.stringify({ sha: commit.sha, force: false }) });
  return commit.sha;
}

const fetchJson = async (url) => {
  const r = await fetch(url, { headers: { 'User-Agent': 'Hero-boundary-curator/1.0' } });
  if (!r.ok) throw new Error(`Could not download map data (${url.split('/').pop()}, HTTP ${r.status}).`);
  return r.json();
};

// ---------- matching engine, ported from scripts/build-boundaries.mjs ----------
// Identical logic to the Node script, with two differences only: stableHash is a plain synchronous
// string hash instead of node:crypto (this never needs to be cryptographically strong, only stable),
// and there is no local filesystem -- inputs come from Firestore/GitHub instead of local files.
const NE_ROOT = 'https://raw.githubusercontent.com/nvkelso/natural-earth-vector/v5.1.2/geojson/';
const NE_FILES = { countries: 'ne_50m_admin_0_countries.geojson', provinces: 'ne_50m_admin_1_states_provinces.geojson', lakes: 'ne_50m_lakes.geojson', marine: 'ne_50m_geography_marine_polys.geojson', rivers: 'ne_50m_rivers_lake_centerlines.geojson', regions: 'ne_50m_geography_regions_polys.geojson' };
const HISTORICAL_INDEX = 'https://raw.githubusercontent.com/aourednik/historical-basemaps/master/index.json';

const normalize = (value) => String(value ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase().replace(/&/g, ' and ').replace(/[^a-z0-9]+/g, ' ').trim().replace(/\s+/g, ' ');
const simplify = (value) => normalize(value).replace(/\b(the|river|rivers|lake|lakes|sea|seas|ocean|oceans|gulf|bay|strait|channel|island|islands|mountains|mountain|desert|peninsula|empire|kingdom|dynasty|caliphate|sultanate|republic)\b/g, ' ').replace(/\s+/g, ' ').trim();
function stableHash(value) {
  let h1 = 0xdeadbeef ^ value.length, h2 = 0x41c6ce57 ^ value.length;
  for (let i = 0; i < value.length; i++) {
    const ch = value.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761); h2 = Math.imul(h2 ^ ch, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return (h2 >>> 0).toString(16).padStart(8, '0') + (h1 >>> 0).toString(16).padStart(8, '0').slice(0, 6);
}
const hasYear = (value) => value != null && value !== '' && Number.isInteger(Number(value));
const nameKeys = /^(name|name_|name$|admin$|admin_|formal_en$|sovereignt$|name_alt$|name_long$|adm0_name$|name_1$|name_2$|region_un$|region_wb$)/i;
const namesOf = (feature) => { const out = new Set(); for (const [key, value] of Object.entries(feature.properties || {})) { if (!nameKeys.test(key) || typeof value !== 'string') continue; for (const name of value.split(/[|;]/)) if (normalize(name)) out.add(normalize(name)); } return out; };
const pointOnSegment = (x, y, a, b) => { const dx = b[0] - a[0], dy = b[1] - a[1]; const cross = (x - a[0]) * dy - (y - a[1]) * dx; if (Math.abs(cross) > 1e-9) return false; const dot = (x - a[0]) * dx + (y - a[1]) * dy; return dot >= -1e-9 && dot <= dx * dx + dy * dy + 1e-9; };
const inRing = (point, ring) => { const [x, y] = point; let inside = false; for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) { const a = ring[j], b = ring[i]; if (pointOnSegment(x, y, a, b)) return true; if (((a[1] > y) !== (b[1] > y)) && x < ((b[0] - a[0]) * (y - a[1])) / (b[1] - a[1]) + a[0]) inside = !inside; } return inside; };
const inPolygon = (point, polygon) => inRing(point, polygon[0]) && !polygon.slice(1).some((hole) => inRing(point, hole));
const boundsCache = new WeakMap();
const boundsOf = (feature) => {
  if (boundsCache.has(feature)) return boundsCache.get(feature);
  if (Array.isArray(feature.bbox) && feature.bbox.length >= 4) { boundsCache.set(feature, feature.bbox); return feature.bbox; }
  const bounds = [Infinity, Infinity, -Infinity, -Infinity];
  const visit = (node) => { if (!Array.isArray(node)) return; if (typeof node[0] === 'number' && typeof node[1] === 'number') { bounds[0] = Math.min(bounds[0], node[0]); bounds[1] = Math.min(bounds[1], node[1]); bounds[2] = Math.max(bounds[2], node[0]); bounds[3] = Math.max(bounds[3], node[1]); return; } node.forEach(visit); };
  visit(feature.geometry?.coordinates);
  boundsCache.set(feature, bounds); return bounds;
};
const contains = (feature, loc) => {
  const point = [Number(loc.lng), Number(loc.lat)], geometry = feature.geometry;
  if (!geometry || !Number.isFinite(point[0]) || !Number.isFinite(point[1])) return false;
  const [west, south, east, north] = boundsOf(feature);
  if (point[0] < west || point[0] > east || point[1] < south || point[1] > north) return false;
  const polygons = geometry.type === 'Polygon' ? [geometry.coordinates] : geometry.type === 'MultiPolygon' ? geometry.coordinates : [];
  return polygons.some((polygon) => inPolygon(point, polygon));
};
const getProperty = (p, keys) => { for (const key of keys) if (typeof p[key] === 'string' && p[key].trim()) return p[key].trim(); return ''; };
const kindOf = (loc) => {
  const label = `${loc.name || ''} ${loc.category || ''} ${loc.boundaryType || ''}`.toLowerCase();
  if (hasYear(loc.year) || /empire|kingdom|dynasty|caliphate|sultanate|historical|historic|ancient/.test(label)) return 'historic';
  if (/route|road|trade|silk/.test(label)) return 'route';
  if (/river|stream/.test(label)) return 'river';
  if (/lake|reservoir/.test(label)) return 'lake';
  if (/sea|ocean|gulf|bay|strait|channel|current|marine/.test(label)) return 'marine';
  if (/region|continent/.test(label)) return 'region';
  return 'land';
};
const layerPriority = (kind) => ({ land: ['countries', 'provinces', 'regions', 'lakes', 'marine', 'rivers'], region: ['regions', 'provinces', 'countries', 'lakes', 'marine', 'rivers'], lake: ['lakes', 'rivers', 'marine'], river: ['rivers', 'lakes', 'marine'], marine: ['marine', 'lakes', 'rivers'], route: [], historic: [] }[kind] || []);
const aliasesFrom = (loc, override) => [...new Set([loc.name, ...(Array.isArray(loc.aliases) ? loc.aliases : []), ...(Array.isArray(override?.aliases) ? override.aliases : [])].map(normalize).filter(Boolean))];
const regionHint = (loc, feature) => {
  const p = feature?.properties || {};
  if (loc.region) return String(loc.region);
  if (loc.continent) return String(loc.continent);
  if (loc.country) return String(loc.country);
  const local = getProperty(p, ['NAME_1', 'name_1', 'ADM1_NAME']);
  const country = getProperty(p, ['ADM0_NAME', 'NAME_0', 'admin', 'ADMIN']);
  if (local && country && normalize(local) !== normalize(country)) return `${local}, ${country}`;
  return getProperty(p, ['CONTINENT', 'REGION_UN', 'REGION_WB', 'REGION', 'ADM0_NAME', 'ADMIN', 'NAME_0']);
};

async function buildBoundaries({ locations, overrides, manualFeatureFiles }) {
  const findOverride = (loc) => overrides.find((row) => (row.locationId && row.locationId === loc.id) || (row.name && normalize(row.name) === normalize(loc.name)));
  const naturalEarth = Object.fromEntries(await Promise.all(Object.entries(NE_FILES).map(async ([layer, file]) => [layer, await fetchJson(`${NE_ROOT}${file}`)])));
  const historicalIndex = await fetchJson(HISTORICAL_INDEX);
  const historicByYear = new Map();
  for (const entry of Array.isArray(historicalIndex) ? historicalIndex : historicalIndex.years || historicalIndex.maps || []) {
    const year = Number(entry.year);
    if (Number.isInteger(year) && entry.filename) historicByYear.set(year, entry.filename);
  }
  const yearsNeeded = new Set(locations.filter((loc) => { const o = findOverride(loc); return (kindOf(loc) === 'historic' || o?.source === 'historical') && hasYear(o?.year ?? loc.year); }).map((loc) => Number(findOverride(loc)?.year ?? loc.year)));
  const closestHistoricalYear = (year) => [...historicByYear.keys()].sort((a, b) => Math.abs(a - year) - Math.abs(b - year) || a - b)[0];
  const historicalFiles = new Map();
  for (const year of yearsNeeded) {
    const availableYear = closestHistoricalYear(year); if (availableYear == null) continue;
    const filename = historicByYear.get(availableYear);
    if (!historicalFiles.has(filename)) historicalFiles.set(filename, { year: availableYear, data: null });
  }
  await Promise.all([...historicalFiles.entries()].map(async ([filename, value]) => {
    value.data = await fetchJson(`https://raw.githubusercontent.com/aourednik/historical-basemaps/master/geojson/${filename}`);
  }));

  const featureRows = new Map(), locationIndex = {}, review = [];
  const layerRows = Object.entries(naturalEarth).map(([layer, data]) => [layer, (data.features || []).map((feature, index) => ({ layer, feature, index, names: namesOf(feature) }))]);
  const historicRows = new Map([...historicalFiles.entries()].map(([filename, value]) => [filename, (value.data.features || []).map((feature, index) => ({ layer: 'historical', feature, index, names: namesOf(feature), filename, year: value.year }))]));
  const locationKey = (loc, index) => `${loc.tour || 'default'}:${loc.id || stableHash(`${loc.name}|${loc.lat}|${loc.lng}|${index}`)}`;
  const addFeature = (loc, locKey, row, matchType, kind, year, hintOverride) => {
    const p = row.feature.properties || {};
    const sourceName = getProperty(p, ['NAME', 'name', 'NAME_1', 'ADMIN', 'NAME_LONG', 'name_en']) || `${row.layer}-${row.index}`;
    const sourceIdentity = row.feature.id || p.ne_id || p.NE_ID || p.adm1_code || p.iso_a3 || p.ISO_A3 || sourceName;
    const featureId = `b_${stableHash(`${row.layer}|${sourceIdentity}|${year || ''}`)}`;
    if (!featureRows.has(featureId)) {
      const copy = JSON.parse(JSON.stringify(row.feature));
      copy.id = featureId;
      copy.properties = { ...p, heroBoundaryId: featureId, heroLayer: row.layer, heroYear: year || null };
      featureRows.set(featureId, copy);
    }
    const feature = featureRows.get(featureId);
    feature.properties.heroLocationIds = [...new Set([...(feature.properties.heroLocationIds || []), locKey])];
    locationIndex[locKey] = { featureIds: [featureId], matchType, kind, year: year || null, hintRegion: hintOverride || regionHint(loc, row.feature) || '' };
  };

  for (let locIndex = 0; locIndex < locations.length; locIndex++) {
    const loc = locations[locIndex], kind = kindOf(loc), locKey = locationKey(loc, locIndex), override = findOverride(loc);
    const year = hasYear(override?.year) ? Number(override.year) : hasYear(loc.year) ? Number(loc.year) : null;
    if (override?.file) {
      const manual = manualFeatureFiles[override.file];
      const manualFeatures = manual && (manual.type === 'FeatureCollection' ? manual.features : manual.type === 'Feature' ? [manual] : []);
      const row = manualFeatures && manualFeatures[Number(override.featureIndex) || 0];
      if (row) addFeature(loc, locKey, { layer: 'manual', feature: row, index: Number(override.featureIndex) || 0 }, 'manual', override.kind || kind, year, override.hintRegion);
      else review.push({ id: loc.id || '', name: loc.name, category: loc.category || '', year, status: 'manual-feature-not-found', file: override.file });
      continue;
    }
    if (kind === 'historic' || override?.source === 'historical') {
      if (!Number.isInteger(year)) { review.push({ id: loc.id || '', name: loc.name, category: loc.category || '', status: 'missing-historical-year' }); continue; }
      const availableYear = closestHistoricalYear(year);
      const filename = historicByYear.get(availableYear);
      const rows = historicRows.get(filename) || [];
      const aliases = aliasesFrom(loc, override);
      const matches = rows.filter((row) => aliases.some((alias) => row.names.has(alias) || [...row.names].some((candidate) => simplify(candidate) === simplify(alias))));
      if (matches.length) {
        const selected = matches.sort((a, b) => Number(contains(b.feature, loc)) - Number(contains(a.feature, loc)))[0];
        addFeature(loc, locKey, selected, availableYear === year ? 'name' : 'nearest-historical-year', 'historic', availableYear, override?.hintRegion);
        if (availableYear !== year) review.push({ id: loc.id || '', name: loc.name, requestedYear: year, selectedYear: availableYear, status: 'historical-year-review' });
      } else review.push({ id: loc.id || '', name: loc.name, category: loc.category || '', year, status: 'historical-name-not-found' });
      continue;
    }
    const aliases = aliasesFrom(loc, override);
    const simplifiedAliases = new Set(aliases.map(simplify).filter(Boolean));
    const preferred = layerPriority(kind);
    const ordered = [...layerRows].sort((a, b) => { const ai = preferred.indexOf(a[0]), bi = preferred.indexOf(b[0]); return (ai < 0 ? 999 : ai) - (bi < 0 ? 999 : bi); });
    const matches = [];
    for (const [layer, rows] of ordered) for (const row of rows) {
      const exact = aliases.some((alias) => row.names.has(alias));
      const soft = !exact && [...row.names].some((candidate) => simplifiedAliases.has(simplify(candidate)));
      if (!exact && !soft) continue;
      const categoryBoost = preferred.includes(layer) ? (preferred.length - preferred.indexOf(layer)) * 10 : 0;
      matches.push({ ...row, score: (exact ? 10000 : 7000) + (contains(row.feature, loc) ? 5000 : 0) + categoryBoost });
    }
    if (matches.length) { matches.sort((a, b) => b.score - a.score || a.layer.localeCompare(b.layer)); addFeature(loc, locKey, matches[0], 'name', kind, null, override?.hintRegion); continue; }

    const isLegendary = /legend|lost (city|cities|continent)|phantom|mythical|fictional/.test(`${loc.name} ${loc.category}`.toLowerCase());
    const noPointFallback = isLegendary || kind === 'historic' || kind === 'route' || /river|lake|sea|ocean|gulf|bay|strait|marine|water/.test(`${loc.name} ${loc.category}`.toLowerCase());
    const pointFeature = noPointFallback ? null : ['provinces', 'countries'].flatMap((layer) => layerRows.find((row) => row[0] === layer)?.[1] || []).find((row) => contains(row.feature, loc));
    if (pointFeature) { addFeature(loc, locKey, pointFeature, 'point-fallback', kind, null, override?.hintRegion); review.push({ id: loc.id || '', name: loc.name, category: loc.category || '', status: 'point-fallback-review', suggestedBoundary: getProperty(pointFeature.feature.properties || {}, ['NAME_1', 'ADM0_NAME', 'ADMIN', 'NAME']) }); }
    else review.push({ id: loc.id || '', name: loc.name, category: loc.category || '', year: year ?? undefined, status: 'not-matched' });
  }

  return {
    bundle: { type: 'FeatureCollection', metadata: { naturalEarth: 'v5.1.2 50m (public domain)', historicalBasemaps: 'aourednik/historical-basemaps', builtVia: 'build-boundaries edge function', builtAt: new Date().toISOString() }, locations: locationIndex, features: [...featureRows.values()] },
    unmatched: { generatedAt: new Date().toISOString(), reviewed: review.length, locations: review },
  };
}

export async function onRequestPost(context) {
  const env = context.env;
  const secret = env.ADMIN_PASSWORD, githubToken = env.GITHUB_TOKEN, repository = env.GITHUB_REPOSITORY || '', branch = env.DEPLOY_BRANCH || 'main', hook = env.DEPLOY_WEBHOOK_URL;
  const email = env.FIREBASE_CLIENT_EMAIL, pk = readPrivateKey(env);
  const missing = [!secret && 'ADMIN_PASSWORD', !githubToken && 'GITHUB_TOKEN', !repository && 'GITHUB_REPOSITORY', !hook && 'DEPLOY_WEBHOOK_URL', !email && 'FIREBASE_CLIENT_EMAIL', !pk && 'FIREBASE_PRIVATE_KEY_1..N'].filter(Boolean);
  if (missing.length) return json({ ok: false, error: 'not_configured', missing }, 500);
  if (!/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(repository) || !/^[A-Za-z0-9_.-]+(?:\/[A-Za-z0-9_.-]+)*$/.test(branch)) {
    return json({ ok: false, error: 'invalid_github_config' }, 500);
  }

  let body;
  try { body = await context.request.json(); } catch { return json({ ok: false, error: 'bad_request' }, 400); }
  if (!(await validToken(body && body.token, secret))) return json({ ok: false, error: 'unauthorized' }, 401);

  try {
    const serviceAccountProject = (email.split('@')[1] || '').split('.')[0];
    const configuredProject = String(env.FIREBASE_PROJECT_ID || '').trim();
    if (configuredProject && serviceAccountProject && configuredProject !== serviceAccountProject) {
      return json({ ok: false, error: 'firebase_project_mismatch', configuredProject, serviceAccountProject }, 409);
    }
    const projectId = configuredProject || serviceAccountProject;
    const appId = typeof body.appId === 'string' ? body.appId : '';
    if (!/^[A-Za-z0-9_-]{1,100}$/.test(appId)) return json({ ok: false, error: 'missing_app_id' }, 400);
    if (!/^[a-z][a-z0-9-]{4,28}[a-z0-9]$/.test(projectId || '')) return json({ ok: false, error: 'invalid_firebase_project' }, 500);
    const accessToken = await googleAccessToken(email, pk, 'https://www.googleapis.com/auth/datastore.readonly');

    const base = `artifacts/${appId}/public/data`;
    const [defaultQuiz, twoYearQuiz] = await Promise.all([
      firestoreGetDoc(projectId, accessToken, `${base}/globalSettings/defaultQuiz`),
      firestoreGetDoc(projectId, accessToken, `${base}/globalSettings/twoYearQuiz`),
    ]).catch((error) => {
      const match = String(error?.message || '').match(/^firestore_read_failed:403:([^:]*):(.*)$/);
      if (match) {
        const googleDetail = match[2] ? ` Google says: ${match[2].slice(0, 240)}` : '';
        throw new Error(`Firestore denied the read in project ${projectId}. Confirm this exact project's IAM grants the service account Cloud Datastore Viewer, and that the Firestore API is enabled.${googleDetail}`);
      }
      throw error;
    });
    const locations = [
      ...((Array.isArray(defaultQuiz?.locations) ? defaultQuiz.locations : []).filter((l) => l && typeof l === 'object').map((l) => ({ ...l, tour: 'default' }))),
      ...((Array.isArray(twoYearQuiz?.locations) ? twoYearQuiz.locations : []).filter((l) => l && typeof l === 'object').map((l) => ({ ...l, tour: 'twoyear' }))),
    ];
    if (!locations.length) return json({ ok: false, error: 'no_locations' }, 400);

    const overridesFile = await ghGetFile(repository, branch, githubToken, 'content/location-boundary-overrides.json');
    let overrides = [];
    try {
      const parsed = overridesFile ? JSON.parse(overridesFile.text) : [];
      overrides = Array.isArray(parsed) ? parsed : parsed.overrides;
      if (!Array.isArray(overrides)) throw new Error('invalid_shape');
    } catch {
      return json({ ok: false, error: 'invalid_boundary_overrides', detail: 'content/location-boundary-overrides.json must contain an array of override entries.' }, 400);
    }
    const manualFiles = [...new Set(overrides.filter((o) => o?.file).map((o) => o.file))];
    const isSafeManualFile = (file) => typeof file === 'string'
      && file.startsWith('manual/')
      && /^manual\/[A-Za-z0-9._/-]+\.geojson$/.test(file)
      && !file.split('/').some((part) => part === '.' || part === '..');
    if (manualFiles.some((file) => !isSafeManualFile(file))) {
      return json({ ok: false, error: 'invalid_manual_boundary_path', detail: 'Manual boundary overrides must point to a .geojson file inside content/manual/.' }, 400);
    }
    const manualFeatureFiles = {};
    for (const file of manualFiles) {
      const f = await ghGetFile(repository, branch, githubToken, `content/${file}`);
      if (!f) continue;
      try { manualFeatureFiles[file] = JSON.parse(f.text); }
      catch { return json({ ok: false, error: 'invalid_manual_boundary', detail: `${file} is not valid GeoJSON JSON.` }, 400); }
    }

    const { bundle, unmatched } = await buildBoundaries({ locations, overrides, manualFeatureFiles });
    const direct = Object.values(bundle.locations).filter((e) => e.matchType === 'name' || e.matchType === 'manual').length;
    const matched = Object.keys(bundle.locations).length;
    let commitSha;
    try {
      commitSha = await ghCommitFiles(repository, branch, githubToken, [
        { path: 'content/location-boundaries.geojson', text: JSON.stringify(bundle) },
        { path: 'content/location-boundaries-unmatched.json', text: JSON.stringify(unmatched, null, 2) },
      ], 'Rebuild location boundaries (from the Stewards panel)');
    } catch (error) {
      return json({ ok: false, error: 'github_failed', status: error.status || 0, detail: String(error.message || error).slice(0, 220) }, 502);
    }

    let deployResponse;
    try { deployResponse = await fetch(hook, { method: 'POST' }); }
    catch {
      return json({ ok: false, error: 'hook_unreachable', commitCreated: true, commitSha }, 502);
    }
    if (!deployResponse.ok) return json({ ok: false, error: 'hook_failed', status: deployResponse.status, commitCreated: true, commitSha }, 502);

    return json({ ok: true, commitSha, branch, total: locations.length, matched, direct, unmatched: unmatched.locations });
  } catch (e) {
    const detail = String((e && e.message) || e).slice(0, 300);
    const code = detail.startsWith('google_oauth_failed:') ? 'google_auth_failed' : 'build_failed';
    return json({ ok: false, error: code, detail }, 500);
  }
}

