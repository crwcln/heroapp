import { json, readCookies, verifyToken } from '../lib/tokens.js';

const present = value => !!String(value ?? '').trim();

function privateKeyChars(env) {
  if (present(env.FIREBASE_PRIVATE_KEY)) return String(env.FIREBASE_PRIVATE_KEY).trim().length;
  let total = 0;
  for (let i = 1; i <= 12; i++) {
    const part = env[`FIREBASE_PRIVATE_KEY_${i}`];
    if (!present(part)) break;
    total += String(part).trim().length;
  }
  return total;
}

function check(id, group, label, ok, detail, required = true) {
  return { id, group, label, ok: !!ok, detail, required };
}

export async function onRequestGet(context) {
  const env = context.env;
  const secret = env.ADMIN_PASSWORD;
  const cookies = readCookies(context.request);
  const authorized = secret && cookies.hero_admin ? await verifyToken(cookies.hero_admin, secret, 'admin') : false;
  if (!authorized) return json({ ok: false, error: 'unauthorized' }, 401);

  const firebaseKeyChars = privateKeyChars(env);
  const checks = [
    check('adminPassword', 'Access', 'Steward password', present(secret), 'ADMIN_PASSWORD'),
    check('devAccess', 'Access', 'Dev access password', present(env.DEV_ACCESS || env.DEV_PASSWORD), 'DEV_ACCESS or DEV_PASSWORD'),
    check('adminSession', 'Access', 'Steward session', true, 'Valid admin cookie'),
    check('firebaseServer', 'Firebase', 'Server credentials', present(env.FIREBASE_CLIENT_EMAIL) && firebaseKeyChars >= 1500, 'FIREBASE_CLIENT_EMAIL and FIREBASE_PRIVATE_KEY'),
    check('firebaseApiKey', 'Firebase', 'Server web API key', present(env.FIREBASE_API_KEY), 'FIREBASE_API_KEY'),
    check('geminiKey', 'Clio', 'Gemini API key', present(env.GEMINI_API_KEY), 'GEMINI_API_KEY'),
    check('geminiModel', 'Clio', 'Gemini model', present(env.GEMINI_MODEL), 'GEMINI_MODEL', false),
    check('deployHook', 'Operations', 'Deploy webhook', present(env.DEPLOY_WEBHOOK_URL), 'DEPLOY_WEBHOOK_URL'),
    check('githubToken', 'Operations', 'GitHub token', present(env.GITHUB_TOKEN), 'GITHUB_TOKEN'),
    check('githubRepo', 'Operations', 'GitHub repository', present(env.GITHUB_REPOSITORY), 'GITHUB_REPOSITORY'),
    check('deployBranch', 'Operations', 'Deploy branch', present(env.DEPLOY_BRANCH), 'DEPLOY_BRANCH defaults to main', false),
    check('webPush', 'Operations', 'Web push key', present(env.FIREBASE_WEB_PUSH_VAPID_KEY), 'FIREBASE_WEB_PUSH_VAPID_KEY', false),
  ];

  return json({ ok: true, checkedAt: new Date().toISOString(), checks });
}
