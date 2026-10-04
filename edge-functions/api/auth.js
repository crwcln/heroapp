// edge-functions/api/auth.js  ->  POST /api/auth
// Set ADMIN_PASSWORD and DEV_PASSWORD in your EdgeOne Pages project's environment variables, then redeploy.

const json = (body, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
  });

// Constant-time comparison (hash first so lengths always match)
async function safeEqual(a, b) {
  const enc = new TextEncoder();
  const [ha, hb] = await Promise.all([
    crypto.subtle.digest('SHA-256', enc.encode(a)),
    crypto.subtle.digest('SHA-256', enc.encode(b)),
  ]);
  const x = new Uint8Array(ha), y = new Uint8Array(hb);
  let diff = 0;
  for (let i = 0; i < x.length; i++) diff |= x[i] ^ y[i];
  return diff === 0;
}

export async function onRequestPost(context) {
  let body;
  try {
    body = await context.request.json();
  } catch {
    return json({ ok: false, error: 'bad_request' }, 400);
  }

  const { target, password } = body || {};
  if (typeof password !== 'string' || password.length > 200) {
    return json({ ok: false, error: 'bad_request' }, 400);
  }

  const secrets = {
    admin: context.env.ADMIN_PASSWORD,
    dev: context.env.DEV_PASSWORD,
  };
  if (!Object.prototype.hasOwnProperty.call(secrets, target)) {
    return json({ ok: false, error: 'bad_target' }, 400);
  }
  const expected = secrets[target];
  if (!expected) {
    return json({ ok: false, error: 'not_configured' }, 500);
  }

  if (await safeEqual(password, expected)) {
    return json({ ok: true });
  }

  // Slow down brute-force attempts
  await new Promise((r) => setTimeout(r, 500));
  return json({ ok: false }, 401);
}