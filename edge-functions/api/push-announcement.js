const json = (body, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
});
const enc = new TextEncoder();
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
  const sig = await crypto.subtle.sign('HMAC', key, enc.encode(message));
  return [...new Uint8Array(sig)].map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

async function validAdminToken(token, secret) {
  if (typeof token !== 'string') return false;
  const [expString, signature] = token.split('.');
  const exp = Number(expString);
  if (!exp || !signature || Date.now() > exp) return false;
  return safeEqual(signature, await hmacHex(secret, `admin.${exp}`));
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
    scope: 'https://www.googleapis.com/auth/cloud-platform',
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

export async function onRequestPost(context) {
  const env = context.env;
  const secret = env.ADMIN_PASSWORD;
  const clientEmail = env.FIREBASE_CLIENT_EMAIL;
  const privateKey = readPrivateKey(env);
  const projectId = env.FIREBASE_PROJECT_ID || (String(clientEmail || '').split('@')[1] || '').split('.')[0];
  if (!secret || !clientEmail || !privateKey || !projectId) {
    return json({ ok: false, error: 'push_sender_not_configured' }, 503);
  }

  let body;
  try { body = await context.request.json(); } catch { return json({ ok: false, error: 'bad_request' }, 400); }
  if (!(await validAdminToken(body && body.token, secret))) return json({ ok: false, error: 'unauthorized' }, 401);

  const title = String(body.title || '').trim().slice(0, 120);
  const messageBody = String(body.body || '').trim().slice(0, 240);
  if (!title || !messageBody) return json({ ok: false, error: 'invalid_message' }, 400);

  try {
    const accessToken = await getGoogleAccessToken(clientEmail, privateKey);
    const root = `https://firestore.googleapis.com/v1/projects/${encodeURIComponent(projectId)}/databases/(default)/documents`;
    const tokenDocs = [];
    for (let offset = 0; offset < 10000; offset += 500) {
      const response = await fetch(`${root}:runQuery`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ structuredQuery: {
          from: [{ collectionId: 'pushTokens', allDescendants: true }],
          where: { fieldFilter: { field: { fieldPath: 'enabled' }, op: 'EQUAL', value: { booleanValue: true } } },
          limit: 500,
          offset,
        } }),
      });
      const rows = await response.json().catch(() => ({}));
      if (!response.ok) return json({ ok: false, error: 'token_lookup_failed', status: response.status }, 502);
      const docs = (Array.isArray(rows) ? rows : []).map((row) => row.document).filter((doc) =>
        doc && doc.fields && doc.fields.enabled && doc.fields.enabled.booleanValue === true
        && doc.fields.token && doc.fields.token.stringValue
      );
      tokenDocs.push(...docs);
      if (docs.length < 500) break;
    }
    if (!tokenDocs.length) return json({ ok: true, sent: 0, removed: 0, failed: 0 });

    const sendOne = async (doc) => {
      const response = await fetch(`https://fcm.googleapis.com/v1/projects/${encodeURIComponent(projectId)}/messages:send`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: {
            token: doc.fields.token.stringValue,
            data: { title, body: messageBody, url: '/?hero=announcements' },
            webpush: { headers: { TTL: '86400', Urgency: 'high' } },
          },
        }),
      });
      if (response.ok) return { sent: 1, removed: 0, failed: 0 };
      const errorBody = await response.text().catch(() => '');
      if (response.status === 404 || errorBody.includes('UNREGISTERED')) {
        await fetch(`https://firestore.googleapis.com/v1/${doc.name}`, { method: 'DELETE', headers: { Authorization: `Bearer ${accessToken}` } }).catch(() => {});
        return { sent: 0, removed: 1, failed: 0 };
      }
      return { sent: 0, removed: 0, failed: 1 };
    };

    let sent = 0, removed = 0, failed = 0;
    for (let start = 0; start < tokenDocs.length; start += 20) {
      const results = await Promise.all(tokenDocs.slice(start, start + 20).map(sendOne));
      for (const result of results) { sent += result.sent; removed += result.removed; failed += result.failed; }
    }
    return json({ ok: true, sent, removed, failed });
  } catch (error) {
    console.error('push announcement send failed:', error);
    return json({ ok: false, error: 'push_send_failed' }, 502);
  }
}
