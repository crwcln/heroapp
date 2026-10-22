// POST /api/border-tool-auth
// Password-gates the local-only border studio without storing credentials in the browser.

const json = (body, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
});

const enc = new TextEncoder();
const TOKEN_TTL = 30 * 60 * 1000;

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
  return [...new Uint8Array(signature)].map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

async function validToken(token, secret) {
  if (typeof token !== 'string' || token.length > 200) return false;
  const [expiryText, nonce, signature] = token.split('.');
  const expiry = Number(expiryText);
  if (!Number.isSafeInteger(expiry) || expiry <= Date.now() || !/^[a-f0-9]{32}$/.test(nonce || '') || !/^[a-f0-9]{64}$/.test(signature || '')) return false;
  const expected = await hmacHex(secret, `border-tool.${expiry}.${nonce}`);
  return safeEqual(signature, expected);
}

export async function onRequestPost(context) {
  const request = context.request;
  let origin;
  try {
    origin = new URL(request.url).origin;
  } catch {
    return json({ error: 'bad_request' }, 400);
  }
  if (!request.headers.get('Origin') || request.headers.get('Origin') !== origin) {
    return json({ error: 'same_origin_required' }, 403);
  }

  const secret = context.env.BORDER_TOOL_PASSWORD;
  if (typeof secret !== 'string' || secret.length < 20) {
    return json({ error: 'not_configured' }, 503);
  }

  let body;
  try {
    const text = await request.text();
    if (text.length > 4096) return json({ error: 'bad_request' }, 400);
    body = JSON.parse(text);
  } catch {
    return json({ error: 'bad_request' }, 400);
  }

  if (body?.action === 'verify') {
    const token = request.headers.get('Authorization')?.replace(/^Bearer\s+/i, '');
    if (!(await validToken(token, secret))) return json({ error: 'unauthorized' }, 401);
    return json({ ok: true });
  }

  if (body?.action !== 'login' || typeof body.password !== 'string' || body.password.length > 512) {
    return json({ error: 'bad_request' }, 400);
  }
  if (!(await safeEqual(body.password, secret))) {
    await new Promise((resolve) => setTimeout(resolve, 750));
    return json({ error: 'unauthorized' }, 401);
  }

  const expiry = Date.now() + TOKEN_TTL;
  const nonceBytes = crypto.getRandomValues(new Uint8Array(16));
  const nonce = [...nonceBytes].map((byte) => byte.toString(16).padStart(2, '0')).join('');
  const signature = await hmacHex(secret, `border-tool.${expiry}.${nonce}`);
  return json({ ok: true, expiresAt: expiry, token: `${expiry}.${nonce}.${signature}` });
}
