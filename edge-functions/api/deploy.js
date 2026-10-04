// edge-functions/api/deploy.js  ->  POST /api/deploy
// Env vars (EdgeOne Pages project settings): ADMIN_PASSWORD, DEPLOY_WEBHOOK_URL
// The webhook URL stays server-side; the browser only sends the short-lived admin token from /api/auth.

const json = (body, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
  });

const enc = new TextEncoder();

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

export async function onRequestPost(context) {
  const secret = context.env.ADMIN_PASSWORD;
  const hook = context.env.DEPLOY_WEBHOOK_URL;
  if (!secret || !hook) return json({ ok: false, error: 'not_configured' }, 500);

  let body;
  try {
    body = await context.request.json();
  } catch {
    return json({ ok: false, error: 'bad_request' }, 400);
  }

  if (!(await validToken(body && body.token, secret))) {
    return json({ ok: false, error: 'unauthorized' }, 401);
  }

  try {
    const r = await fetch(hook, { method: 'POST' });
    if (!r.ok) return json({ ok: false, error: 'hook_failed', status: r.status }, 502);
    return json({ ok: true });
  } catch {
    return json({ ok: false, error: 'hook_unreachable' }, 502);
  }
}