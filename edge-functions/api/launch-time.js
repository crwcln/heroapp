const json = (body, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
});

const enc = new TextEncoder();
let cache = null;

const b64url = (input) => {
  const bytes = typeof input === 'string' ? enc.encode(input) : new Uint8Array(input);
  let value = '';
  for (const byte of bytes) value += String.fromCharCode(byte);
  return btoa(value).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
};

function readPrivateKey(env) {
  if (env.FIREBASE_PRIVATE_KEY) return env.FIREBASE_PRIVATE_KEY;
  let key = '';
  for (let index = 1; index <= 12; index++) {
    const part = env[`FIREBASE_PRIVATE_KEY_${index}`];
    if (!part) break;
    key += String(part).trim();
  }
  return key;
}

async function importPrivateKey(pem) {
  const body = pem.replace(/["']/g, '').replace(/\\n/g, '\n').replace(/-----(BEGIN|END) PRIVATE KEY-----/g, '').replace(/\s+/g, '');
  const der = Uint8Array.from(atob(body), (char) => char.charCodeAt(0));
  return crypto.subtle.importKey('pkcs8', der, { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['sign']);
}

async function getGoogleAccessToken(clientEmail, privateKeyPem) {
  const now = Math.floor(Date.now() / 1000);
  const header = b64url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }));
  const payload = b64url(JSON.stringify({
    iss: clientEmail,
    sub: clientEmail,
    aud: 'https://oauth2.googleapis.com/token',
    scope: 'https://www.googleapis.com/auth/datastore',
    iat: now,
    exp: now + 3600,
  }));
  const unsigned = `${header}.${payload}`;
  const key = await importPrivateKey(privateKeyPem);
  const signature = await crypto.subtle.sign('RSASSA-PKCS1-v1_5', key, enc.encode(unsigned));
  const assertion = `${unsigned}.${b64url(signature)}`;
  const response = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion }),
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok || !body.access_token) throw new Error(`google_auth_${response.status}`);
  return body.access_token;
}

export async function onRequestGet(context) {
  if (cache && Date.now() < cache.until) return json(cache.value);
  const env = context.env;
  const clientEmail = env.FIREBASE_CLIENT_EMAIL;
  const privateKey = readPrivateKey(env);
  const fallback = { ok: true, launchAt: null, launchLabel: '' };
  if (!clientEmail || !privateKey) {
    cache = { until: Date.now() + 10000, value: fallback };
    return json(fallback);
  }

  try {
    const configResponse = await fetch(new URL('/js/02-firebase-config.js', context.request.url), { cache: 'no-store' });
    const source = await configResponse.text();
    const projectMatch = source.match(/projectId\s*:\s*['"]([^'"]+)['"]/);
    const appMatch = source.match(/appId\s*:\s*['"]([^'"]+)['"]/);
    const projectId = env.FIREBASE_PROJECT_ID || (projectMatch && projectMatch[1]) || (String(clientEmail).split('@')[1] || '').split('.')[0];
    const appId = appMatch && appMatch[1];
    if (!projectId || !appId) {
      cache = { until: Date.now() + 10000, value: fallback };
      return json(fallback);
    }

    const accessToken = await getGoogleAccessToken(clientEmail, privateKey);
    const path = `artifacts/${encodeURIComponent(appId)}/public/data/globalSettings/siteMode`;
    const response = await fetch(`https://firestore.googleapis.com/v1/projects/${encodeURIComponent(projectId)}/databases/(default)/documents/${path}`, {
      headers: { Authorization: `Bearer ${accessToken}` },
      cache: 'no-store',
    });
    if (response.status === 404) {
      cache = { until: Date.now() + 30000, value: fallback };
      return json(fallback);
    }
    if (!response.ok) throw new Error(`firestore_${response.status}`);
    const doc = await response.json();
    const fields = doc.fields || {};
    const value = {
      ok: true,
      launchAt: fields.launchAt && typeof fields.launchAt.stringValue === 'string' ? fields.launchAt.stringValue : null,
      launchLabel: fields.launchLabel && typeof fields.launchLabel.stringValue === 'string' ? fields.launchLabel.stringValue.slice(0, 120) : '',
    };
    cache = { until: Date.now() + 30000, value };
    return json(value);
  } catch {
    cache = { until: Date.now() + 10000, value: fallback };
    return json(fallback);
  }
}
