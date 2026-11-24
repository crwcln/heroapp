// EdgeOne Pages middleware: keeps protected app markup off the wire until the
// server has validated a password. Runs before the static index.html is served.
const SECURITY_HEADERS = {
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'Permissions-Policy': 'camera=(), microphone=(), geolocation=(), payment=()',
  'Strict-Transport-Security': 'max-age=31536000; includeSubDomains',
  'Cache-Control': 'no-store, no-cache, must-revalidate',
};

let launchCache;

async function getStaticLaunchAt(request) {
  try {
    const response = await fetch(new URL('/js/00-site-config.js', request.url), { cache: 'no-store' });
    const source = await response.text();
    const match = source.match(/launchAt\s*:\s*['"]([^'"]+)['"]/);
    const parsed = match ? Date.parse(match[1]) : 0;
    return Number.isFinite(parsed) ? parsed : 0;
  } catch {
    return 0;
  }
}

async function getLaunchConfig(request) {
  if (launchCache && Date.now() < launchCache.until) return launchCache.value;
  const fallbackAt = await getStaticLaunchAt(request);
  let value = { at: fallbackAt, label: '' };
  try {
    const response = await fetch(new URL('/api/launch-time', request.url), { cache: 'no-store' });
    if (response.ok) {
      const data = await response.json();
      if (data && data.ok) {
        const parsed = data.launchAt === null || data.launchAt === undefined
          ? NaN
          : (data.launchAt === '' ? 0 : Date.parse(data.launchAt));
        value = {
          at: Number.isFinite(parsed) ? parsed : fallbackAt,
          label: typeof data.launchLabel === 'string' ? data.launchLabel.slice(0, 120) : '',
        };
      }
    }
  } catch {}
  launchCache = { until: Date.now() + 30000, value };
  return value;
}

async function getSession(request) {
  try {
    const response = await fetch(new URL('/api/session', request.url), {
      headers: { cookie: request.headers.get('cookie') || '' },
      cache: 'no-store',
    });
    if (!response.ok) return { admin: false, dev: false };
    return await response.json();
  } catch {
    return { admin: false, dev: false };
  }
}

function injectSession(html, session, launch) {
  const data = JSON.stringify({
    admin: !!session.admin,
    dev: !!session.dev,
    adminToken: session.adminToken || null,
  }).replace(/</g, '\\u003c');
  const label = JSON.stringify(launch.label || '').replace(/</g, '\\u003c');
  const tag = `<script>window.__HERO_SESSION__=${data};window.__HERO_LAUNCH_AT__=${launch.at};window.__HERO_LAUNCH_LABEL__=${label};</script>`;
  return /<head\b[^>]*>/i.test(html) ? html.replace(/<head\b[^>]*>/i, (head) => `${head}${tag}`) : `${tag}${html}`;
}

function replaceBlock(html, startMarker, endMarker, replacement) {
  const start = html.indexOf(startMarker);
  if (start < 0) return html;
  const from = start + startMarker.length;
  const end = html.indexOf(endMarker, from);
  if (end < 0) return html;
  return html.slice(0, start) + replacement + html.slice(end + endMarker.length);
}

function gateHtml(fullHtml, launchAt, launchLabel) {
  const headMatch = fullHtml.match(/<head\b[^>]*>([\s\S]*?)<\/head>/i);
  const head = (headMatch ? headMatch[1] : '').replace(/<script\b[^>]*>[\s\S]*?<\/script\s*>/gi, '');
  const gateMatch = fullHtml.match(/<!-- HERO_LAUNCH_GATE_START -->([\s\S]*?)<!-- HERO_LAUNCH_GATE_END -->/);
  let gate = gateMatch ? gateMatch[1] : '';
  if (launchLabel) {
    const escaped = String(launchLabel).replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
    gate = gate.replace(/<p class="launch-date">[\s\S]*?<\/p>/, `<p class="launch-date">${escaped}</p>`);
  }
  const htmlTag = (fullHtml.match(/<html\b[^>]*>/i) || ['<html lang="en" class="light">'])[0];
  const lockedTag = /class\s*=\s*"([^"]*)"/i.test(htmlTag)
    ? htmlTag.replace(/class\s*=\s*"([^"]*)"/i, (_, classes) => `class="${classes} launch-locked"`)
    : htmlTag.replace(/>$/, ' class="launch-locked">');
  const script = `<script>
(function () {
  var deadline = ${launchAt};
  var ids = ['launch-days', 'launch-hours', 'launch-minutes', 'launch-seconds'];
  function tick() {
    var left = Math.max(0, deadline - Date.now());
    var s = Math.floor(left / 1000);
    var values = [Math.floor(s / 86400), Math.floor(s % 86400 / 3600), Math.floor(s % 3600 / 60), s % 60];
    for (var i = 0; i < ids.length; i++) {
      var el = document.getElementById(ids[i]);
      if (el) el.textContent = String(values[i]).padStart(2, '0');
    }
    if (!left) location.reload();
  }
  tick();
  setInterval(tick, 1000);
  var stars = document.querySelector('.launch-stars');
  if (stars && !window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    for (var i = 0; i < 56; i++) {
      var star = document.createElement('i');
      star.className = 'launch-star';
      star.style.left = (Math.random() * 100) + '%';
      star.style.top = (Math.random() * 100) + '%';
      star.style.setProperty('--dx', ((Math.random() - 0.5) * 120) + 'px');
      star.style.setProperty('--dur', (4 + Math.random() * 5) + 's');
      star.style.animationDelay = (Math.random() * 6) + 's';
      stars.appendChild(star);
    }
  }
  window.unlockLaunchGate = async function () {
    var input = document.getElementById('launch-password');
    var button = document.getElementById('launch-enter');
    var message = document.getElementById('launch-error');
    if (!input || !input.value) return;
    if (button) button.disabled = true;
    if (message) message.textContent = '';
    try {
      var response = await fetch('/api/auth', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ target: 'dev', password: input.value }) });
      var data = await response.json().catch(function () { return {}; });
      if (response.ok && data.ok) { location.reload(); return; }
      if (message) message.textContent = response.status === 401 ? 'That password did not work. Try again.' : 'Access check failed. Try again.';
    } catch (error) {
      if (message) message.textContent = 'Could not reach the access server. Try again.';
    } finally {
      if (button) button.disabled = false;
    }
  };
})();
</script>`;
  return `<!DOCTYPE html>\n${lockedTag}<head>${head}</head><body class="text-slate-800 dark:text-slate-200">${gate}${script}</body></html>`;
}

export async function middleware(context) {
  const { request, next } = context;
  const session = await getSession(request);
  const launch = await getLaunchConfig(request);
  const upstream = await next();
  let html = await upstream.text();

  if (launch.at && Date.now() < launch.at && !session.dev) {
    html = gateHtml(html, launch.at, launch.label);
  } else {
    html = injectSession(html, session, launch);
    if (!session.admin) {
      html = replaceBlock(html, '<!-- HERO_ADMIN_PANEL_START -->', '<!-- HERO_ADMIN_PANEL_END -->', '<div id="admin-panel" class="hidden"></div>');
    }
    // Keep the public construction shell available: Dev Mode is a site-wide
    // Firestore setting, so the browser needs this screen when non-stewards visit.
    // Its password is checked by /api/auth; no privileged state is stored here.
  }

  const headers = new Headers(upstream.headers);
  for (const [key, value] of Object.entries(SECURITY_HEADERS)) headers.set(key, value);
  return new Response(html, { status: upstream.status, statusText: upstream.statusText, headers });
}

export const config = { matcher: ['/', '/index.html'] };
