const json = (body, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
});

// The VAPID public key is intentionally returned to browsers; it is not a secret.
export function onRequestGet(context) {
  const vapidKey = String(context.env.FIREBASE_WEB_PUSH_VAPID_KEY || '').trim();
  return json({ enabled: !!vapidKey, vapidKey: vapidKey || null });
}
