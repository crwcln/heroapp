import fs from 'node:fs/promises';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const inputPath = path.resolve(ROOT, process.argv[2] || 'content/location-catalog.json');
const overridePath = path.join(ROOT, 'content/location-boundary-overrides.json');
const outputPath = path.join(ROOT, 'content/location-boundaries.geojson');
const unmatchedPath = path.join(ROOT, 'content/location-boundaries-unmatched.json');
const NE_ROOT = 'https://raw.githubusercontent.com/nvkelso/natural-earth-vector/v5.1.2/geojson/';
const NE_FILES = {
  countries: 'ne_10m_admin_0_countries.geojson',
  provinces: 'ne_10m_admin_1_states_provinces.geojson',
  lakes: 'ne_10m_lakes.geojson',
  marine: 'ne_10m_geography_marine_polys.geojson',
  rivers: 'ne_10m_rivers_lake_centerlines.geojson',
  regions: 'ne_10m_geography_regions_polys.geojson',
};
const HISTORICAL_INDEX = 'https://raw.githubusercontent.com/aourednik/historical-basemaps/master/index.json';

const readJson = async (file) => JSON.parse((await fs.readFile(file, 'utf8')).replace(/^\uFEFF/, ''));
const fetchJson = async (url) => {
  const response = await fetch(url, { headers: { 'User-Agent': 'Hero-boundary-curator/1.0' } });
  if (!response.ok) throw new Error(`Could not download ${url} (${response.status})`);
  return response.json();
};
const normalize = (value) => String(value ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase().replace(/&/g, ' and ').replace(/[^a-z0-9]+/g, ' ').trim().replace(/\s+/g, ' ');
const simplify = (value) => normalize(value).replace(/\b(the|river|rivers|lake|lakes|sea|seas|ocean|oceans|gulf|bay|strait|channel|island|islands|mountains|mountain|desert|peninsula|empire|kingdom|dynasty|caliphate|sultanate|republic)\b/g, ' ').replace(/\s+/g, ' ').trim();
const stableHash = (value) => createHash('sha1').update(value).digest('hex').slice(0, 14);
const hasYear = (value) => value != null && value !== '' && Number.isInteger(Number(value));
const nameKeys = /^(name|name_|name$|admin$|admin_|formal_en$|sovereignt$|name_alt$|name_long$|adm0_name$|name_1$|name_2$|region_un$|region_wb$)/i;
const namesOf = (feature) => {
  const out = new Set();
  for (const [key, value] of Object.entries(feature.properties || {})) {
    if (!nameKeys.test(key) || typeof value !== 'string') continue;
    for (const name of value.split(/[|;]/)) if (normalize(name)) out.add(normalize(name));
  }
  return out;
};
const pointOnSegment = (x, y, a, b) => {
  const dx = b[0] - a[0], dy = b[1] - a[1];
  const cross = (x - a[0]) * dy - (y - a[1]) * dx;
  if (Math.abs(cross) > 1e-9) return false;
  const dot = (x - a[0]) * dx + (y - a[1]) * dy;
  return dot >= -1e-9 && dot <= dx * dx + dy * dy + 1e-9;
};
const inRing = (point, ring) => {
  const [x, y] = point; let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const a = ring[j], b = ring[i];
    if (pointOnSegment(x, y, a, b)) return true;
    if (((a[1] > y) !== (b[1] > y)) && x < ((b[0] - a[0]) * (y - a[1])) / (b[1] - a[1]) + a[0]) inside = !inside;
  }
  return inside;
};
const inPolygon = (point, polygon) => inRing(point, polygon[0]) && !polygon.slice(1).some((hole) => inRing(point, hole));
const boundsCache = new WeakMap();
const boundsOf = (feature) => {
  if (boundsCache.has(feature)) return boundsCache.get(feature);
  if (Array.isArray(feature.bbox) && feature.bbox.length >= 4) { boundsCache.set(feature, feature.bbox); return feature.bbox; }
  const bounds = [Infinity, Infinity, -Infinity, -Infinity];
  const visit = (node) => {
    if (!Array.isArray(node)) return;
    if (typeof node[0] === 'number' && typeof node[1] === 'number') {
      bounds[0] = Math.min(bounds[0], node[0]); bounds[1] = Math.min(bounds[1], node[1]);
      bounds[2] = Math.max(bounds[2], node[0]); bounds[3] = Math.max(bounds[3], node[1]); return;
    }
    node.forEach(visit);
  };
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
const getProperty = (p, keys) => {
  for (const key of keys) if (typeof p[key] === 'string' && p[key].trim()) return p[key].trim();
  return '';
};
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
const layerPriority = (kind) => ({
  land: ['countries', 'provinces', 'regions', 'lakes', 'marine', 'rivers'],
  region: ['regions', 'provinces', 'countries', 'lakes', 'marine', 'rivers'],
  lake: ['lakes', 'rivers', 'marine'],
  river: ['rivers', 'lakes', 'marine'],
  marine: ['marine', 'lakes', 'rivers'],
  route: [], historic: [],
}[kind] || []);
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

const catalog = await readJson(inputPath).catch((error) => {
  throw new Error(`Missing ${path.relative(ROOT, inputPath)}. Sign in as a site steward, choose "Export boundary build catalog" in the quiz editor, and place the downloaded location-catalog.json in content/.`);
});
const locations = Array.isArray(catalog) ? catalog : catalog.locations;
if (!Array.isArray(locations)) throw new Error('The boundary catalog must be an array or contain a locations array.');
const overridesDoc = await readJson(overridePath).catch(() => []);
const overrides = Array.isArray(overridesDoc) ? overridesDoc : (overridesDoc.overrides || []);
const findOverride = (loc) => overrides.find((row) => (row.locationId && row.locationId === loc.id) || (row.name && normalize(row.name) === normalize(loc.name)));
const naturalEarth = Object.fromEntries(await Promise.all(Object.entries(NE_FILES).map(async ([layer, file]) => [layer, await fetchJson(`${NE_ROOT}${file}`)])));
const historicalIndex = await fetchJson(HISTORICAL_INDEX);
const historicByYear = new Map();
for (const entry of Array.isArray(historicalIndex) ? historicalIndex : historicalIndex.years || historicalIndex.maps || []) {
  const year = Number(entry.year);
  if (Number.isInteger(year) && entry.filename) historicByYear.set(year, entry.filename);
}
const yearsNeeded = new Set(locations.filter((loc) => {
  const override = findOverride(loc);
  return (kindOf(loc) === 'historic' || override?.source === 'historical') && hasYear(override?.year ?? loc.year);
}).map((loc) => Number(findOverride(loc)?.year ?? loc.year)));
const closestHistoricalYear = (year) => [...historicByYear.keys()].sort((a, b) => Math.abs(a - year) - Math.abs(b - year) || a - b)[0];
const historicalFiles = new Map();
for (const year of yearsNeeded) {
  const availableYear = closestHistoricalYear(year);
  if (availableYear == null) continue;
  const filename = historicByYear.get(availableYear);
  if (!historicalFiles.has(filename)) historicalFiles.set(filename, { year: availableYear, data: await fetchJson(`https://raw.githubusercontent.com/aourednik/historical-basemaps/master/geojson/${filename}`) });
}

const featureRows = new Map();
const locationIndex = {};
const review = [];
const layerRows = Object.entries(naturalEarth).map(([layer, data]) => [layer, (data.features || []).map((feature, index) => ({ layer, feature, index, names: namesOf(feature) }))]);
const historicRows = new Map([...historicalFiles.entries()].map(([filename, value]) => [filename, (value.data.features || []).map((feature, index) => ({ layer: 'historical', feature, index, names: namesOf(feature), filename, year: value.year }))]));
const locationKey = (loc, index) => `${loc.tour || 'default'}:${loc.id || stableHash(`${loc.name}|${loc.lat}|${loc.lng}|${index}`)}`;
const addFeature = (loc, locKey, row, matchType, kind, year, hintOverride) => {
  const p = row.feature.properties || {};
  const sourceName = getProperty(p, ['NAME', 'name', 'NAME_1', 'ADMIN', 'NAME_LONG', 'name_en']) || `${row.layer}-${row.index}`;
  const sourceIdentity = row.feature.id || p.ne_id || p.NE_ID || p.adm1_code || p.iso_a3 || p.ISO_A3 || sourceName;
  const featureId = `b_${stableHash(`${row.layer}|${sourceIdentity}|${year || ''}`)}`;
  if (!featureRows.has(featureId)) {
    const copy = structuredClone(row.feature);
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
    const manual = await readJson(path.resolve(ROOT, 'content', override.file));
    const manualFeatures = manual.type === 'FeatureCollection' ? manual.features : manual.type === 'Feature' ? [manual] : [];
    const row = manualFeatures[Number(override.featureIndex) || 0];
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
  const ordered = [...layerRows].sort((a, b) => {
    const ai = preferred.indexOf(a[0]), bi = preferred.indexOf(b[0]);
    return (ai < 0 ? 999 : ai) - (bi < 0 ? 999 : bi);
  });
  const matches = [];
  for (const [layer, rows] of ordered) for (const row of rows) {
    const exact = aliases.some((alias) => row.names.has(alias));
    const soft = !exact && [...row.names].some((candidate) => simplifiedAliases.has(simplify(candidate)));
    if (!exact && !soft) continue;
    const categoryBoost = preferred.includes(layer) ? (preferred.length - preferred.indexOf(layer)) * 10 : 0;
    matches.push({ ...row, score: (exact ? 10000 : 7000) + (contains(row.feature, loc) ? 5000 : 0) + categoryBoost });
  }
  if (matches.length) {
    matches.sort((a, b) => b.score - a.score || a.layer.localeCompare(b.layer));
    const selected = matches[0];
    addFeature(loc, locKey, selected, 'name', kind, null, override?.hintRegion);
    continue;
  }

  // If a named city or landmark has no Natural Earth polygon, attach its containing
  // admin-1 or country outline as a useful map context and flag it for review.
  const noPointFallback = kind === 'historic' || kind === 'route' || /river|lake|sea|ocean|gulf|bay|strait|marine|water/.test(`${loc.name} ${loc.category}`.toLowerCase());
  const pointFeature = noPointFallback ? null : ['provinces', 'countries'].flatMap((layer) => layerRows.find((row) => row[0] === layer)?.[1] || []).find((row) => contains(row.feature, loc));
  if (pointFeature) {
    addFeature(loc, locKey, pointFeature, 'point-fallback', kind, null, override?.hintRegion);
    review.push({ id: loc.id || '', name: loc.name, category: loc.category || '', status: 'point-fallback-review', suggestedBoundary: getProperty(pointFeature.feature.properties || {}, ['NAME_1', 'ADM0_NAME', 'ADMIN', 'NAME']) });
  } else review.push({ id: loc.id || '', name: loc.name, category: loc.category || '', year: year ?? undefined, status: 'not-matched' });
}

await fs.writeFile(outputPath, JSON.stringify({
  type: 'FeatureCollection',
  metadata: { naturalEarth: 'v5.1.2 (public domain)', historicalBasemaps: 'aourednik/historical-basemaps (work in progress; inspect historical boundaries)', catalogGeneratedAt: catalog.generatedAt || null },
  locations: locationIndex,
  features: [...featureRows.values()],
}, null, 0));
await fs.writeFile(unmatchedPath, JSON.stringify({ generatedAt: new Date().toISOString(), reviewed: review.length, locations: review }, null, 2));
const direct = Object.values(locationIndex).filter((entry) => entry.matchType === 'name' || entry.matchType === 'manual').length;
const fallback = Object.values(locationIndex).filter((entry) => entry.matchType === 'point-fallback').length;
console.log(`Curated ${Object.keys(locationIndex).length}/${locations.length} locations (${direct} exact-name/manual, ${fallback} point-context).`);
console.log(`${review.length} items need review: ${path.relative(ROOT, unmatchedPath)}`);
console.log(`Boundary bundle: ${path.relative(ROOT, outputPath)}`);
