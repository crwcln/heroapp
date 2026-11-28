import { json, safeEqual, issueToken, setCookie, clearCookie } from '../lib/tokens.js';

export async function onRequestPost(context) {
    const secret = context.env.SYSTEM_STATUS_PASSWORD;
    if (!secret) return json({ ok: false, error: 'System status access is not configured.' }, 503);
    let body;
    try { body = await context.request.json(); } catch { return json({ ok: false, error: 'Invalid request.' }, 400); }
    const password = typeof body?.password === 'string' ? body.password : '';
    if (!(await safeEqual(password, secret))) return json({ ok: false, error: 'Incorrect passphrase.' }, 401);
    const token = await issueToken(secret, 'system');
    return json({ ok: true }, 200, { 'Set-Cookie': setCookie('hero_system', token) });
}

export async function onRequestDelete() {
    return json({ ok: true }, 200, { 'Set-Cookie': clearCookie('hero_system') });
}
