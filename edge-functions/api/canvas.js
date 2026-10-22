// POST /api/canvas
// Relays read-only Canvas API requests to avoid school CORS restrictions.
// Tokens are forwarded in memory only and are never logged or persisted.

const json = (body, status = 200, headers = {}) => new Response(JSON.stringify(body), {
  status,
  headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store', ...headers },
});

function allowedCanvasHost(hostname, env) {
  const host = hostname.toLowerCase();
  if (host === 'instructure.com' || host.endsWith('.instructure.com')) return true;
  const extraHosts = String(env.CANVAS_ALLOWED_HOSTS || '')
    .split(/[,\s]+/)
    .map((value) => value.trim().toLowerCase())
    .filter(Boolean);
  return extraHosts.includes(host);
}

export async function onRequestPost(context) {
  const request = context.request;
  const origin = request.headers.get('Origin');
  let requestOrigin;
  try {
    requestOrigin = new URL(request.url).origin;
  } catch {
    return json({ error: 'bad_request' }, 400);
  }
  if (!origin || origin !== requestOrigin) return json({ error: 'same_origin_required' }, 403);

  let body;
  try {
    body = await request.json();
  } catch {
    return json({ error: 'bad_request' }, 400);
  }

  const authorization = request.headers.get('Authorization') || '';
  const tokenMatch = authorization.match(/^Bearer\s+(\S+)$/i);
  if (!tokenMatch || tokenMatch[1].length > 4096 || typeof body?.url !== 'string' || body.url.length > 4096) {
    return json({ error: 'bad_request' }, 400);
  }

  let target;
  try {
    target = new URL(body.url);
  } catch {
    return json({ error: 'bad_canvas_url' }, 400);
  }
  if (target.protocol !== 'https:' || target.username || target.password || target.hash ||
      !target.pathname.startsWith('/api/v1/') || /^\d+(?:\.\d+){3}$/.test(target.hostname)) {
    return json({ error: 'bad_canvas_url' }, 400);
  }
  if (!allowedCanvasHost(target.hostname, context.env)) {
    return json({ error: 'canvas_host_not_allowed' }, 403);
  }

  let upstream;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15000);
  try {
    upstream = await fetch(target.href, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${tokenMatch[1]}`,
        Accept: 'application/json',
      },
      redirect: 'manual',
      signal: controller.signal,
    });
  } catch (error) {
    if (controller.signal.aborted || error?.name === 'TimeoutError' || error?.name === 'AbortError') {
      return json({ error: 'canvas_timeout' }, 504);
    }
    return json({ error: 'canvas_unreachable' }, 502);
  } finally {
    clearTimeout(timeout);
  }

  if (upstream.status >= 300 && upstream.status < 400) {
    return json({ error: 'canvas_redirect' }, 502);
  }
  const contentType = upstream.headers.get('Content-Type') || '';
  const mediaType = contentType.split(';', 1)[0].trim().toLowerCase();
  if (mediaType !== 'application/json' && !mediaType.endsWith('+json')) {
    return json({
      error: 'canvas_non_json_response',
      upstreamStatus: upstream.status,
      contentType: mediaType || 'unknown content type',
    }, 502);
  }

  const headers = {};
  const link = upstream.headers.get('Link');
  if (link) headers.Link = link;
  return new Response(await upstream.text(), {
    status: upstream.status,
    headers: { 'Content-Type': contentType, 'Cache-Control': 'no-store', ...headers },
  });
}
