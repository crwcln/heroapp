import { json, readCookies, verifyToken } from '../lib/tokens.js';

const has = (value) => typeof value === 'string' && value.trim().length > 0;

function privateKeyReady(env) {
    const keys = [env.FIREBASE_PRIVATE_KEY, ...Array.from({ length: 12 }, (_, i) => env[`FIREBASE_PRIVATE_KEY_${i + 1}`])];
    return keys.some((key) => typeof key === 'string' && key.replace(/\s/g, '').length >= 1500);
}

function checksFor(env) {
    const firebaseServer = has(env.FIREBASE_CLIENT_EMAIL) && privateKeyReady(env);
    return [
        { id: 'systemPassword', label: 'System passphrase', group: 'Access', ok: has(env.SYSTEM_STATUS_PASSWORD), detail: 'Separate access passphrase configured' },
        { id: 'adminPassword', label: 'Steward passphrase', group: 'Access', ok: has(env.ADMIN_PASSWORD), detail: 'ADMIN_PASSWORD configured' },
        { id: 'devAccess', label: 'Developer access', group: 'Access', ok: has(env.DEV_ACCESS || env.DEV_PASSWORD), detail: 'DEV_ACCESS configured', optional: true },
        { id: 'systemSession', label: 'System session', group: 'Access', ok: true, detail: 'Verified by edge middleware' },
        { id: 'firebaseServer', label: 'Firebase server credentials', group: 'Firebase', ok: firebaseServer, detail: 'Client email and private key configured' },
        { id: 'firebaseApiKey', label: 'Firebase browser config', group: 'Firebase', ok: has(env.FIREBASE_API_KEY), detail: 'FIREBASE_API_KEY configured' },
        { id: 'geminiKey', label: 'Gemini API key', group: 'Clio', ok: has(env.GEMINI_API_KEY), detail: 'GEMINI_API_KEY configured', optional: true },
        { id: 'geminiModel', label: 'Gemini model', group: 'Clio', ok: has(env.GEMINI_MODEL), detail: 'GEMINI_MODEL configured', optional: true },
        { id: 'deployHook', label: 'Deploy webhook', group: 'Operations', ok: has(env.DEPLOY_WEBHOOK_URL), detail: 'DEPLOY_WEBHOOK_URL configured', optional: true },
        { id: 'githubToken', label: 'GitHub token', group: 'Operations', ok: has(env.GITHUB_TOKEN), detail: 'GITHUB_TOKEN configured', optional: true },
        { id: 'githubRepo', label: 'GitHub repository', group: 'Operations', ok: has(env.GITHUB_REPOSITORY), detail: 'GITHUB_REPOSITORY configured', optional: true },
        { id: 'deployBranch', label: 'Deploy branch', group: 'Operations', ok: has(env.DEPLOY_BRANCH), detail: 'DEPLOY_BRANCH configured', optional: true },
        { id: 'webPush', label: 'Web push key', group: 'Browser', ok: has(env.FIREBASE_WEB_PUSH_VAPID_KEY), detail: 'FIREBASE_WEB_PUSH_VAPID_KEY configured', optional: true }
    ];
}

export async function onRequestGet(context) {
    const secret = context.env.SYSTEM_STATUS_PASSWORD;
    if (!secret) return json({ ok: false, error: 'System status access is not configured.' }, 503);
    const cookies = readCookies(context.request);
    const token = cookies.hero_system || null;
    const authorized = token ? await verifyToken(token, secret, 'system') : false;
    if (!authorized) return json({ ok: false, error: 'Unauthorized.' }, 401);
    return json({ ok: true, checkedAt: new Date().toISOString(), checks: checksFor(context.env || {}) });
}
