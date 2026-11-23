// edge-functions/api/logout.js -> POST /api/logout
import { json, clearCookie } from '../lib/tokens.js';

export async function onRequestPost(context) {
  let target = 'all';
  try {
    const body = await context.request.json();
    if (body && (body.target === 'admin' || body.target === 'dev')) target = body.target;
  } catch { /* empty body clears both */ }

  const cookies = target === 'admin' ? ['hero_admin'] : target === 'dev' ? ['hero_dev'] : ['hero_admin', 'hero_dev'];
  return json({ ok: true }, 200, { 'Set-Cookie': cookies.map(clearCookie) });
}
