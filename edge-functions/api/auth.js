// edge-functions/api/auth.js  ->  POST /api/auth
// Env vars (EdgeOne Pages project settings): ADMIN_PASSWORD, DEV_ACCESS (or legacy DEV_PASSWORD)

import { json, safeEqual, issueToken, setCookie } from '../lib/tokens.js';

// Best-effort backoff per client/target. Edge isolates are short-lived, so this
// complements (rather than replaces) EdgeOne WAF rate limiting.
const FAILURES = new Map();
const clientKey = (context, target) => {
  const ip = context.clientIp || context.request.headers.get('cf-connecting-ip') || context.request.headers.get('x-forwarded-for') || 'unknown';
  return `${ip}:${target}`;
};

export async function onRequestPost(context) {
  let body;
  try {
    body = await context.request.json();
  } catch {
    return json({ ok: false, error: 'bad_request' }, 400);
  }

  const { target, password } = body || {};
  const key = clientKey(context, target);
  const failure = FAILURES.get(key);
  if (failure && failure.until > Date.now()) {
    return json({ ok: false, error: 'too_many_attempts' }, 429, { 'Retry-After': String(Math.ceil((failure.until - Date.now()) / 1000)) });
  }
  if (typeof password !== 'string' || password.length > 200) {
    return json({ ok: false, error: 'bad_request' }, 400);
  }

  const secrets = {
    admin: context.env.ADMIN_PASSWORD,
    dev: context.env.DEV_ACCESS || context.env.DEV_PASSWORD,
  };
  if (!Object.prototype.hasOwnProperty.call(secrets, target)) {
    return json({ ok: false, error: 'bad_target' }, 400);
  }
  const expected = secrets[target];
  if (!expected) {
    return json({ ok: false, error: 'not_configured' }, 500);
  }

  if (await safeEqual(password, expected)) {
    FAILURES.delete(key);
    const token = await issueToken(expected, target);
    const cookieName = target === 'admin' ? 'hero_admin' : 'hero_dev';
    const headers = { 'Set-Cookie': setCookie(cookieName, token) };
    const res = { ok: true };
    if (target === 'admin') {
      // Short-lived signed token so other admin-only endpoints (e.g. /api/deploy) don't need the password again.
      res.token = token;
    }
    return json(res, 200, headers);
  }

  // Exponential backoff after repeated failures.
  const count = Math.min((failure && failure.count || 0) + 1, 6);
  const delay = Math.min(10000, 500 * (2 ** (count - 1)));
  FAILURES.set(key, { count, until: Date.now() + delay });
  await new Promise((resolve) => setTimeout(resolve, delay));
  return json({ ok: false }, 401);
}
