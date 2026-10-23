const json = (body, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
  });

const USERNAME_PATTERN = /^[a-z0-9_]{3,20}$/;
const AUTH_DOMAIN = 'accounts.hero.invalid';
let cachedAccessToken = null;
let cachedAccessTokenExpiry = 0;

function config(env) {
  const clientEmail = String(env.FIREBASE_CLIENT_EMAIL || '');
  const projectId = String(env.FIREBASE_PROJECT_ID || (clientEmail.split('@')[1] || '').split('.')[0] || '');
  const siteId = String(env.FIREBASE_SITE_ID || 'hero-2026');
  const privateKey = String(env.FIREBASE_PRIVATE_KEY || '');
  let key = privateKey;
  if (!key) {
    key = '';
    for (let index = 1; index <= 12; index++) {
      const part = env[`FIREBASE_PRIVATE_KEY_${index}`];
      if (!part) break;
      key += String(part).trim();
    }
  }
  const pepper = String(env.ACCOUNT_RECOVERY_PEPPER || '');
  const serviceAccountProject = (clientEmail.split('@')[1] || '').split('.')[0];
  if (!env.FIREBASE_API_KEY || !clientEmail || !projectId || projectId !== serviceAccountProject
    || !key || !/^[A-Fa-f0-9]{64}$/.test(pepper) || !/^[A-Za-z0-9_-]{1,100}$/.test(siteId)) return null;
  return { clientEmail, privateKey: key, projectId, siteId, pepper };
}

function base64Url(bytes) {
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function encodeText(value) {
  return base64Url(new TextEncoder().encode(value));
}

function pemBytes(pem) {
  const base64 = pem.replace(/["']/g, '').replace(/\\n/g, '\n')
    .replace(/-----BEGIN PRIVATE KEY-----|-----END PRIVATE KEY-----|\s/g, '');
  const binary = atob(base64);
  return Uint8Array.from(binary, (char) => char.charCodeAt(0));
}

async function accessToken(clientEmail, privateKey) {
  if (cachedAccessToken && Date.now() < cachedAccessTokenExpiry - 60000) return cachedAccessToken;
  const issuedAt = Math.floor(Date.now() / 1000);
  const unsigned = `${encodeText(JSON.stringify({ alg: 'RS256', typ: 'JWT' }))}.${encodeText(JSON.stringify({
    iss: clientEmail,
    scope: 'https://www.googleapis.com/auth/identitytoolkit https://www.googleapis.com/auth/datastore',
    aud: 'https://oauth2.googleapis.com/token',
    iat: issuedAt,
    exp: issuedAt + 3600,
  }))}`;
  const key = await crypto.subtle.importKey('pkcs8', pemBytes(privateKey), {
    name: 'RSASSA-PKCS1-v1_5',
    hash: 'SHA-256',
  }, false, ['sign']);
  const signature = new Uint8Array(await crypto.subtle.sign('RSASSA-PKCS1-v1_5', key, new TextEncoder().encode(unsigned)));
  const assertion = `${unsigned}.${base64Url(signature)}`;
  const response = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion,
    }),
  });
  if (!response.ok) throw new Error('Could not authorize Firebase Admin access.');
  const token = await response.json();
  if (typeof token.access_token !== 'string' || !Number.isFinite(token.expires_in)) throw new Error('Firebase Admin authorization returned an invalid token.');
  cachedAccessToken = token.access_token;
  cachedAccessTokenExpiry = Date.now() + token.expires_in * 1000;
  return cachedAccessToken;
}

async function verifyIdToken(idToken, apiKey) {
  const response = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${encodeURIComponent(apiKey)}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ idToken }),
  });
  if (!response.ok) return null;
  const result = await response.json();
  const user = result.users && result.users[0];
  return user && typeof user.localId === 'string' && typeof user.email === 'string' ? user : null;
}

function recoveryDocumentUrl(projectId, siteId, username) {
  return `https://firestore.googleapis.com/v1/projects/${encodeURIComponent(projectId)}/databases/(default)/documents/artifacts/${encodeURIComponent(siteId)}/public/data/accountRecovery/${encodeURIComponent(username)}`;
}

async function firestoreRequest(url, token, options = {}) {
  const response = await fetch(url, {
    ...options,
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      ...(options.headers || {}),
    },
  });
  const body = await response.json().catch(() => ({}));
  return { response, body };
}

async function hashCode(code, pepper) {
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(pepper), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const digest = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(code.replace(/[^A-Za-z0-9]/g, '').toUpperCase()));
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

function documentBody({ uid, username, codeHash }) {
  const now = new Date().toISOString();
  return {
    fields: {
      uid: { stringValue: uid },
      username: { stringValue: username },
      codeHash: { stringValue: codeHash },
      updatedAt: { timestampValue: now },
    },
  };
}

async function saveRecoveryCode(body, request, env, settings) {
  const match = String(request.headers.get('Authorization') || '').match(/^Bearer\s+(.+)$/i);
  const recoveryCode = typeof body.recoveryCode === 'string' ? body.recoveryCode.replace(/[^A-Za-z0-9]/g, '').toUpperCase() : '';
  if (!match || typeof body.username !== 'string' || !USERNAME_PATTERN.test(body.username) || !/^[A-F0-9]{40}$/.test(recoveryCode)) return json({ ok: false, error: 'bad_request' }, 400);
  const user = await verifyIdToken(match[1], env.FIREBASE_API_KEY);
  if (!user || user.email !== `${body.username}@${AUTH_DOMAIN}`) return json({ ok: false, error: 'not_authorized' }, 401);

  const token = await accessToken(settings.clientEmail, settings.privateKey);
  const url = recoveryDocumentUrl(settings.projectId, settings.siteId, body.username);
  const existing = await firestoreRequest(url, token);
  if (existing.response.ok && existing.body.fields && existing.body.fields.uid && existing.body.fields.uid.stringValue !== user.localId) {
    return json({ ok: false, error: 'username_unavailable' }, 409);
  }
  if (!existing.response.ok && existing.response.status !== 404) throw new Error('Could not read recovery record.');

  const query = existing.response.ok
    ? `?currentDocument.updateTime=${encodeURIComponent(existing.body.updateTime)}`
    : '?currentDocument.exists=false';
  const saved = await firestoreRequest(`${url}${query}`, token, {
    method: 'PATCH',
    body: JSON.stringify(documentBody({
      uid: user.localId,
      username: body.username,
      codeHash: await hashCode(recoveryCode, settings.pepper),
    })),
  });
  if (!saved.response.ok) {
    if (saved.response.status === 409 || saved.response.status === 412) return json({ ok: false, error: 'username_unavailable' }, 409);
    throw new Error('Could not save the recovery code.');
  }
  return json({ ok: true });
}

async function deleteRecoveryRecord(body, request, env, settings) {
  const match = String(request.headers.get('Authorization') || '').match(/^Bearer\s+(.+)$/i);
  if (!match || typeof body.username !== 'string' || !USERNAME_PATTERN.test(body.username)) return json({ ok: false, error: 'bad_request' }, 400);
  const user = await verifyIdToken(match[1], env.FIREBASE_API_KEY);
  if (!user || user.email !== `${body.username}@${AUTH_DOMAIN}`) return json({ ok: false, error: 'not_authorized' }, 401);
  const token = await accessToken(settings.clientEmail, settings.privateKey);
  const url = recoveryDocumentUrl(settings.projectId, settings.siteId, body.username);
  const found = await firestoreRequest(url, token);
  if (found.response.status === 404) return json({ ok: true });
  if (!found.response.ok) throw new Error('Could not read recovery record.');
  if (found.body.fields && found.body.fields.uid && found.body.fields.uid.stringValue !== user.localId) {
    return json({ ok: false, error: 'not_authorized' }, 401);
  }
  const deleted = await firestoreRequest(`${url}?currentDocument.updateTime=${encodeURIComponent(found.body.updateTime)}`, token, {
    method: 'DELETE',
  });
  if (!deleted.response.ok) throw new Error('Could not delete recovery record.');
  return json({ ok: true });
}

async function resetPassword(body, env, settings) {
  const username = typeof body.username === 'string' ? body.username.toLowerCase() : '';
  const password = typeof body.password === 'string' ? body.password : '';
  const recoveryCode = typeof body.recoveryCode === 'string' ? body.recoveryCode.replace(/[^A-Za-z0-9]/g, '').toUpperCase() : '';
  if (!USERNAME_PATTERN.test(username) || !/^[A-F0-9]{40}$/.test(recoveryCode) || password.length < 8 || password.length > 128) {
    return json({ ok: false, error: 'bad_request' }, 400);
  }

  const token = await accessToken(settings.clientEmail, settings.privateKey);
  const url = recoveryDocumentUrl(settings.projectId, settings.siteId, username);
  const found = await firestoreRequest(url, token);
  const fields = found.body.fields || {};
  if (!found.response.ok || !fields.uid || !fields.codeHash || !found.body.updateTime) {
    return json({ ok: false, error: 'invalid_recovery' }, 400);
  }
  const providedHash = await hashCode(recoveryCode, settings.pepper);
  const expectedHash = fields.codeHash.stringValue || '';
  let mismatch = providedHash.length ^ expectedHash.length;
  for (let index = 0; index < Math.max(providedHash.length, expectedHash.length); index++) {
    mismatch |= (providedHash.charCodeAt(index) || 0) ^ (expectedHash.charCodeAt(index) || 0);
  }
  if (mismatch !== 0) return json({ ok: false, error: 'invalid_recovery' }, 400);

  const claimed = await firestoreRequest(`${url}?currentDocument.updateTime=${encodeURIComponent(found.body.updateTime)}`, token, {
    method: 'PATCH',
    body: JSON.stringify(documentBody({ uid: fields.uid.stringValue, username, codeHash: '' })),
  });
  if (!claimed.response.ok) return json({ ok: false, error: 'invalid_recovery' }, 400);

  try {
    const response = await fetch(`https://identitytoolkit.googleapis.com/v1/projects/${encodeURIComponent(settings.projectId)}/accounts:update?key=${encodeURIComponent(env.FIREBASE_API_KEY)}`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ localId: fields.uid.stringValue, password }),
    });
    if (!response.ok) throw new Error('Firebase rejected the password reset.');
  } catch (error) {
    const rollback = await firestoreRequest(`${url}?currentDocument.updateTime=${encodeURIComponent(claimed.body.updateTime)}`, token, {
      method: 'PATCH',
      body: JSON.stringify(documentBody({ uid: fields.uid.stringValue, username, codeHash: expectedHash })),
    });
    if (!rollback.response.ok) throw new Error('Password reset failed and the recovery code could not be restored.');
    throw error;
  }
  return json({ ok: true });
}

export async function onRequestGet(context) {
  return json({ configured: !!config(context.env) });
}

export async function onRequestPost(context) {
  const settings = config(context.env);
  if (!settings) return json({ ok: false, error: 'not_configured' }, 503);
  let body;
  const contentLength = Number(context.request.headers.get('Content-Length') || 0);
  if (contentLength > 12000) return json({ ok: false, error: 'bad_request' }, 413);
  try {
    const text = await context.request.text();
    if (text.length > 12000) return json({ ok: false, error: 'bad_request' }, 413);
    body = JSON.parse(text);
    if (!body || typeof body !== 'object' || Array.isArray(body)) return json({ ok: false, error: 'bad_request' }, 400);
  } catch { return json({ ok: false, error: 'bad_request' }, 400); }
  try {
    if (body.action === 'save') return await saveRecoveryCode(body, context.request, context.env, settings);
    if (body.action === 'delete') return await deleteRecoveryRecord(body, context.request, context.env, settings);
    if (body.action === 'reset') return await resetPassword(body, context.env, settings);
    return json({ ok: false, error: 'bad_request' }, 400);
  } catch (error) {
    console.error('Account recovery operation failed:', error);
    return json({ ok: false, error: 'recovery_unavailable' }, 503);
  }
}
