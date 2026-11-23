// Shared token helpers for the EdgeOne edge functions.
const enc = new TextEncoder();

export const json = (body, status = 200, headers = {}) => {
  const out = new Headers({ 'Content-Type': 'application/json', 'Cache-Control': 'no-store' });
  for (const [key, value] of Object.entries(headers || {})) {
    if (Array.isArray(value)) value.forEach((item) => out.append(key, item));
    else out.set(key, value);
  }
  return new Response(JSON.stringify(body), { status, headers: out });
};

export const TOKEN_TTL_MS = 30 * 60 * 1000;

export async function safeEqual(a, b) {
  const [ha, hb] = await Promise.all([
    crypto.subtle.digest('SHA-256', enc.encode(String(a))),
    crypto.subtle.digest('SHA-256', enc.encode(String(b))),
  ]);
  const x = new Uint8Array(ha), y = new Uint8Array(hb);
  let diff = 0;
  for (let i = 0; i < x.length; i++) diff |= x[i] ^ y[i];
  return diff === 0;
}

export async function hmacHex(secret, message) {
  const key = await crypto.subtle.importKey('raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const sig = await crypto.subtle.sign('HMAC', key, enc.encode(message));
  return [...new Uint8Array(sig)].map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

export async function issueToken(secret, scope) {
  const exp = Date.now() + TOKEN_TTL_MS;
  return `${exp}.${await hmacHex(secret, `${scope}.${exp}`)}`;
}

export async function verifyToken(token, secret, scope) {
  if (typeof token !== 'string') return false;
  const [expString, signature] = token.split('.');
  const exp = Number(expString);
  if (!Number.isSafeInteger(exp) || exp <= Date.now() || exp > Date.now() + TOKEN_TTL_MS + 60000) return false;
  if (!signature || !/^[a-f0-9]{64}$/.test(signature)) return false;
  return safeEqual(signature, await hmacHex(secret, `${scope}.${exp}`));
}

export function readCookies(request) {
  const out = {};
  const header = request.headers.get('cookie') || '';
  for (const part of header.split(';')) {
    const index = part.indexOf('=');
    if (index < 0) continue;
    const key = part.slice(0, index).trim();
    if (!key) continue;
    try { out[key] = decodeURIComponent(part.slice(index + 1).trim()); } catch { out[key] = part.slice(index + 1).trim(); }
  }
  return out;
}

const cookieBase = (name, value, maxAge) =>
  `${name}=${encodeURIComponent(value)}; Path=/; Max-Age=${maxAge}; HttpOnly; Secure; SameSite=Strict`;

export const setCookie = (name, value) => cookieBase(name, value, Math.floor(TOKEN_TTL_MS / 1000));
export const clearCookie = (name) => `${name}=; Path=/; Max-Age=0; HttpOnly; Secure; SameSite=Strict`;
