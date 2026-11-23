// edge-functions/api/session.js -> GET /api/session
// Reports server-validated unlock state. The browser cannot forge these cookies.
import { json, readCookies, verifyToken } from '../lib/tokens.js';

export async function onRequestGet(context) {
  const cookies = readCookies(context.request);
  const adminSecret = context.env.ADMIN_PASSWORD;
  const devSecret = context.env.DEV_ACCESS || context.env.DEV_PASSWORD;
  const adminToken = cookies.hero_admin || null;
  const devToken = cookies.hero_dev || null;

  const admin = adminSecret && adminToken ? await verifyToken(adminToken, adminSecret, 'admin') : false;
  const dev = devSecret && devToken ? await verifyToken(devToken, devSecret, 'dev') : false;

  return json({
    ok: true,
    admin: !!admin,
    dev: !!dev,
    adminToken: admin ? adminToken : null,
    devToken: dev ? devToken : null,
  });
}
