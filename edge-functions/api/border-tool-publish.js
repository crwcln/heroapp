// POST /api/border-tool-publish
// Commits boundary inputs and dispatches the repository's build-and-deploy workflow.

const json = (body, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
});

const enc = new TextEncoder();
const MAX_REQUEST_BYTES = 10 * 1024 * 1024;

async function safeEqual(a, b) {
  const [ha, hb] = await Promise.all([
    crypto.subtle.digest('SHA-256', enc.encode(a)),
    crypto.subtle.digest('SHA-256', enc.encode(b)),
  ]);
  const x = new Uint8Array(ha), y = new Uint8Array(hb);
  let diff = 0;
  for (let i = 0; i < x.length; i++) diff |= x[i] ^ y[i];
  return diff === 0;
}

async function hmacHex(secret, message) {
  const key = await crypto.subtle.importKey('raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const signature = await crypto.subtle.sign('HMAC', key, enc.encode(message));
  return [...new Uint8Array(signature)].map(byte => byte.toString(16).padStart(2, '0')).join('');
}

async function validToken(token, secret) {
  if (typeof token !== 'string' || token.length > 200) return false;
  const [expiryText, nonce, signature] = token.split('.');
  const expiry = Number(expiryText);
  if (!Number.isSafeInteger(expiry) || expiry <= Date.now() || !/^[a-f0-9]{32}$/.test(nonce || '') || !/^[a-f0-9]{64}$/.test(signature || '')) return false;
  return safeEqual(signature, await hmacHex(secret, `border-tool.${expiry}.${nonce}`));
}

function validCatalog(value) {
  const locations = Array.isArray(value) ? value : value?.locations;
  return Array.isArray(locations) && locations.length <= 50000 && locations.every(location =>
    location && typeof location === 'object' && typeof location.name === 'string',
  );
}

function validOverrides(value) {
  return Array.isArray(value) && value.length <= 50000 && value.every(row =>
    row && typeof row === 'object' && !Array.isArray(row) &&
    (row.file == null || (typeof row.file === 'string' && row.file.length <= 200 && !row.file.startsWith('/') &&
      !row.file.includes('\\') && !row.file.split('/').some(part => !part || part === '.' || part === '..'))),
  );
}

function validManual(value) {
  return value?.type === 'FeatureCollection' && Array.isArray(value.features) && value.features.length <= 25000 &&
    value.features.every(feature => feature?.type === 'Feature' &&
      ['Polygon', 'MultiPolygon'].includes(feature.geometry?.type));
}

export async function onRequestPost(context) {
  const request = context.request;
  let origin;
  let commitSha = '';
  let commitCreated = false;
  try {
    origin = new URL(request.url).origin;
  } catch {
    return json({ error: 'bad_request' }, 400);
  }
  if (!request.headers.get('Origin') || request.headers.get('Origin') !== origin) {
    return json({ error: 'same_origin_required' }, 403);
  }

  const password = context.env.BORDER_TOOL_PASSWORD;
  if (typeof password !== 'string' || password.length < 20) return json({ error: 'not_configured' }, 503);
  const token = request.headers.get('Authorization')?.replace(/^Bearer\s+/i, '');
  if (!(await validToken(token, password))) return json({ error: 'unauthorized' }, 401);

  const githubToken = context.env.GITHUB_TOKEN;
  const repository = context.env.GITHUB_REPOSITORY || '';
  const branch = context.env.DEPLOY_BRANCH || 'main';
  if (!githubToken || !/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(repository) || !/^[A-Za-z0-9_.-]+$/.test(branch)) {
    return json({ error: 'not_configured' }, 503);
  }

  let body;
  try {
    const contentLength = Number(request.headers.get('Content-Length'));
    if (Number.isFinite(contentLength) && contentLength > MAX_REQUEST_BYTES) return json({ error: 'payload_too_large' }, 413);
    const text = await request.text();
    if (enc.encode(text).byteLength > MAX_REQUEST_BYTES) return json({ error: 'payload_too_large' }, 413);
    body = JSON.parse(text);
  } catch {
    return json({ error: 'bad_request' }, 400);
  }

  const gh = async (path, options = {}) => {
    const response = await fetch(`https://api.github.com/repos/${repository}/${path}`, {
      ...options,
      headers: {
        Accept: 'application/vnd.github+json',
        Authorization: `Bearer ${githubToken}`,
        'X-GitHub-Api-Version': '2022-11-28',
        ...(options.body ? { 'Content-Type': 'application/json' } : {}),
        ...options.headers,
      },
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw Object.assign(new Error('GitHub request failed'), { status: response.status });
    return data;
  };

  if (body?.action === 'status') {
    if (typeof body.commitSha !== 'string' || !/^[a-f0-9]{40}$/.test(body.commitSha)) return json({ error: 'bad_request' }, 400);
    try {
      const result = await gh(`actions/workflows/build-boundaries.yml/runs?head_sha=${body.commitSha}&per_page=1`);
      const run = result.workflow_runs?.[0];
      return json(run
        ? { ok: true, status: run.status, conclusion: run.conclusion, htmlUrl: run.html_url }
        : { ok: true, status: 'queued' });
    } catch {
      return json({ error: 'status_unavailable' }, 502);
    }
  }

  if (body?.action !== 'publish' || !validCatalog(body.catalog)) return json({ error: 'invalid_catalog' }, 400);
  if (body.overrides != null && !validOverrides(body.overrides)) return json({ error: 'invalid_overrides' }, 400);
  if (body.manual != null && !validManual(body.manual)) return json({ error: 'invalid_manual_boundaries' }, 400);

  const files = [{
    path: 'content/boundary-build-catalog.json',
    content: JSON.stringify(body.catalog),
  }];
  if (body.overrides != null) files.push({
    path: 'content/location-boundary-overrides.json',
    content: JSON.stringify(body.overrides),
  });
  if (body.manual != null) files.push({
    path: 'content/hero-manual-boundaries.geojson',
    content: JSON.stringify(body.manual),
  });
  if (files.some(file => enc.encode(file.content).byteLength > 8 * 1024 * 1024)) {
    return json({ error: 'payload_too_large' }, 413);
  }

  try {
    const reference = await gh(`git/ref/heads/${encodeURIComponent(branch)}`);
    const parentSha = reference.object.sha;
    const parent = await gh(`git/commits/${parentSha}`);
    const tree = await gh('git/trees', {
      method: 'POST',
      body: JSON.stringify({
        base_tree: parent.tree.sha,
        tree: files.map(file => ({ ...file, mode: '100644', type: 'blob' })),
      }),
    });
    const commit = await gh('git/commits', {
      method: 'POST',
      body: JSON.stringify({
        message: 'Build map boundaries from Border Studio',
        tree: tree.sha,
        parents: [parentSha],
      }),
    });
    commitSha = commit.sha;
    await gh(`git/refs/heads/${encodeURIComponent(branch)}`, {
      method: 'PATCH',
      body: JSON.stringify({ sha: commit.sha, force: false }),
    });
    commitCreated = true;
    await gh('actions/workflows/build-boundaries.yml/dispatches', {
      method: 'POST',
      body: JSON.stringify({ ref: branch }),
    });
    return json({ ok: true, commitSha, status: 'queued' }, 202);
  } catch (error) {
    return json({
      error: 'publish_failed',
      status: error?.status || 0,
      ...(commitCreated ? { commitCreated: true, commitSha } : {}),
      message: 'Could not queue the boundary build. Check the GitHub token permissions and repository settings.',
    }, 502);
  }
}
