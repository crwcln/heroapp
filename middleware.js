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

let launchAtCache;

async function getLaunchAt(request) {
  if (launchAtCache !== undefined) return launchAtCache;
  try {
    const response = await fetch(new URL('/js/00-site-config.js', request.url), { cache: 'no-store' });
    const source = await response.text();
    const match = source.match(/launchAt\s*:\s*['"]([^'"]+)['"]/);
    launchAtCache = match ? Date.parse(match[1]) : 0;
  } catch {
    launchAtCache = 0;
  }
  return launchAtCache;
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

function injectSession(html, session) {
  const data = JSON.stringify({
    admin: !!session.admin,
    dev: !!session.dev,
    adminToken: session.adminToken || null,
  }).replace(/</g, '\\u003c');
  const tag = `<script>window.__HERO_SESSION__=${data};</script>`;
  return /<\/head>/i.test(html) ? html.replace(/<\/head>/i, `${tag}</head>`) : `${tag}${html}`;
}

function replaceBlock(html, startMarker, endMarker, replacement) {
  const start = html.indexOf(startMarker);
  if (start < 0) return html;
  const from = start + startMarker.length;
  const end = html.indexOf(endMarker, from);
  if (end < 0) return html;
  return html.slice(0, start) + replacement + html.slice(end + endMarker.length);
}

function gateHtml(launchAt) {
  const date = new Date(launchAt).toUTCString();
  return `<!DOCTYPE html>
<html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Hero — Early Access</title>
<style>
:root{color-scheme:dark}body{margin:0;min-height:100vh;display:grid;place-items:center;background:#0a0e1a;color:#e8ecf7;font-family:system-ui,-apple-system,Segoe UI,sans-serif;padding:24px}
.card{width:min(100%,520px);border:1px solid rgba(212,175,55,.35);border-radius:24px;padding:clamp(28px,6vw,52px);background:linear-gradient(160deg,#111a30,#0a0e1a);box-shadow:0 30px 100px rgba(0,0,0,.45);text-align:center}
h1{margin:0 0 10px;font-size:clamp(34px,7vw,56px);letter-spacing:.02em}.eyebrow{font-size:11px;letter-spacing:.28em;color:#d4af37;font-weight:800;text-transform:uppercase}
p{color:#aab4cc;line-height:1.6}.clock{display:grid;grid-template-columns:repeat(4,1fr);gap:10px;margin:28px 0}.clock div{border:1px solid rgba(255,255,255,.1);border-radius:14px;padding:14px 4px}.clock b{display:block;font-size:clamp(22px,6vw,36px);font-variant-numeric:tabular-nums}.clock span{font-size:9px;letter-spacing:.16em;color:#8893ad;text-transform:uppercase}
form{display:flex;gap:8px;margin-top:22px}input{min-width:0;flex:1;padding:13px 15px;border-radius:12px;border:1px solid rgba(255,255,255,.16);background:#080c17;color:inherit;font:inherit}button{padding:0 20px;border:0;border-radius:12px;background:#d4af37;color:#101828;font-weight:800;cursor:pointer}.error{min-height:20px;margin-top:10px;color:#ff8098;font-size:13px;font-weight:600}
@media(max-width:480px){form{flex-direction:column}button{min-height:46px}}
</style></head>
<body><main class="card"><div class="eyebrow">Early Access</div><h1>Hero</h1>
<p>Hero opens on <strong>${date}</strong>. Enter your early-access password to continue.</p>
<div class="clock" id="clock"></div>
<form id="gate"><input id="password" type="password" autocomplete="current-password" placeholder="Password" aria-label="Early access password" required><button type="submit">Enter</button></form>
<div class="error" id="error" role="alert"></div></main>
<script>
const deadline=${launchAt};const clock=document.getElementById('clock');
function tick(){const left=Math.max(0,deadline-Date.now());const s=Math.floor(left/1000);const v=[Math.floor(s/86400),Math.floor(s%86400/3600),Math.floor(s%3600/60),s%60];const names=['Days','Hours','Mins','Secs'];clock.innerHTML=v.map((n,i)=>'<div><b>'+String(n).padStart(2,'0')+'</b><span>'+names[i]+'</span></div>').join('');if(!left)location.reload();}
tick();setInterval(tick,1000);
document.getElementById('gate').addEventListener('submit',async e=>{e.preventDefault();const button=e.target.querySelector('button');const error=document.getElementById('error');button.disabled=true;error.textContent='';try{const r=await fetch('/api/auth',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({target:'dev',password:document.getElementById('password').value})});const d=await r.json().catch(()=>({}));if(r.ok&&d.ok){location.reload();return;}error.textContent=r.status===401?'That password did not work. Try again.':'Access check failed. Try again.';}catch(_){error.textContent='Could not reach the access server. Try again.'}finally{button.disabled=false;}});
</script></body></html>`;
}

export async function middleware(context) {
  const { request, next } = context;
  const session = await getSession(request);
  const launchAt = await getLaunchAt(request);

  if (launchAt && Date.now() < launchAt && !session.dev) {
    return new Response(gateHtml(launchAt), {
      status: 200,
      headers: { ...SECURITY_HEADERS, 'Content-Type': 'text/html; charset=utf-8' },
    });
  }

  const upstream = await next();
  let html = await upstream.text();
  html = injectSession(html, session);
  if (!session.admin) {
    html = replaceBlock(html, '<!-- HERO_ADMIN_PANEL_START -->', '<!-- HERO_ADMIN_PANEL_END -->', '<div id="admin-panel" class="hidden"></div>');
  }

  const headers = new Headers(upstream.headers);
  for (const [key, value] of Object.entries(SECURITY_HEADERS)) headers.set(key, value);
  return new Response(html, { status: upstream.status, statusText: upstream.statusText, headers });
}

export const config = { matcher: ['/', '/index.html'] };
