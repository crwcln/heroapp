// ===== DEVICE BANS =====
// Privacy-friendlier than matching names to IP addresses: each browser gets a random id in localStorage on first load.
// The admin can ban a browser id or a verified account id. Browser ids are random and stored only in that browser.
// The site does not collect IP addresses. Verified email profiles are opt-in and admin-only; network-level abuse can
// be handled with EdgeOne rate limiting / WAF rules without this site storing an address.
const deviceId = () => { let id = localStorage.getItem('hero_device'); if (!id) { id = 'd_' + crypto.randomUUID().slice(0, 12); localStorage.setItem('hero_device', id); } return id; };
window.__heroDeviceId = deviceId();
const bansCol = () => db.collection('artifacts').doc(appId).collection('public').doc('data').collection('bans');
let banList = [], banUnsub = null, banAdminTimer = null;
let ownBanUnsubs = [], ownBanKey = '', ownBanEntries = new Map(), banScreenTimer = null;
const BAN_DURATIONS = { '10m': ['10 minutes', 10 * 60 * 1000], '1h': ['1 hour', 60 * 60 * 1000], '24h': ['24 hours', 24 * 60 * 60 * 1000], '7d': ['7 days', 7 * 24 * 60 * 60 * 1000], '30d': ['30 days', 30 * 24 * 60 * 60 * 1000], permanent: ['Permanent', 0] };
const BAN_NO_REASON_LINES = [
    'No reason was recorded. The timeout gnome is reviewing the map upside down.',
    'No reason was recorded. A committee of very serious pigeons is deliberating.',
    'No reason was recorded. Clio is looking for the timeout scroll.',
    'No reason was recorded. The tiny cartographer is counting every island.',
    'No reason was recorded. Please wait while the kingdom checks its paperwork.'
];
const banExpiryMs = b => b && b.expiresAt && typeof b.expiresAt.toMillis === 'function' ? b.expiresAt.toMillis() : 0;
const banRemaining = ms => {
    if (ms <= 0) return '0 seconds';
    const days = Math.floor(ms / 86400000), hours = Math.floor(ms % 86400000 / 3600000), minutes = Math.floor(ms % 3600000 / 60000), seconds = Math.floor(ms % 60000 / 1000);
    if (days) return `${days}d ${hours}h`;
    if (hours) return `${hours}h ${minutes}m`;
    if (minutes) return `${minutes}m ${seconds}s`;
    return `${seconds}s`;
};

function removeBanScreen(expired = false) {
    clearInterval(banScreenTimer); banScreenTimer = null;
    const el = document.getElementById('ban-screen');
    if (el && el.__stopGame) el.__stopGame();
    if (el) el.remove();
    if (expired) showToast('Your suspension has ended. Welcome back.', 'success');
}
function showBanScreen(ban) {
    removeBanScreen();
    const expiry = banExpiryMs(ban), temporary = expiry > 0;
    const el = document.createElement('div'); el.id = 'ban-screen'; el.className = 'timeout-overlay';
    el.setAttribute('role', 'dialog'); el.setAttribute('aria-modal', 'true'); el.setAttribute('aria-labelledby', 'timeout-title');
    el.innerHTML = '<main class="timeout-card"><div class="timeout-orbit timeout-orbit-one"></div><div class="timeout-orbit timeout-orbit-two"></div><header class="timeout-brand"><span class="timeout-brand-mark">H</span><span>HERO <i>TIMEOUT</i></span></header><div class="timeout-icon"><i data-lucide="shield-alert"></i></div><p class="timeout-eyebrow">A NOTE FROM THE STEWARDS</p><h1 id="timeout-title">You\'re on a timeout</h1><p class="timeout-intro">Access is paused for this browser or account. If this is temporary, you\'ll be let back in when the timer ends.</p><section class="timeout-details"><div class="timeout-detail"><span>TIME REMAINING</span><strong id="timeout-countdown">Checking...</strong><small id="timeout-end"></small></div><div class="timeout-detail"><span>REASON</span><strong id="timeout-reason"></strong></div></section><section class="timeout-game"><div class="timeout-game-head"><div><span class="timeout-eyebrow">TIMEOUT MINI-GAME</span><h2>Catch the atlas star</h2></div><div class="timeout-score">SCORE <b id="timeout-score">0</b></div></div><p id="timeout-game-status">Tap start, then catch as many stars as you can in 20 seconds.</p><div id="timeout-game-board" class="timeout-game-board"><button id="timeout-star" class="timeout-star hidden" aria-label="Catch the star"><i data-lucide="sparkles"></i></button></div><button id="timeout-game-start" class="timeout-start">Start game</button></section><p class="timeout-footer">The game is just for the wait. It does not change the suspension.</p></main>';
    document.body.appendChild(el);
    if (window.lucide) lucide.createIcons();
    const reason = el.querySelector('#timeout-reason');
    let jokeIndex = Math.floor(Math.random() * BAN_NO_REASON_LINES.length);
    if (ban.reason && String(ban.reason).trim()) reason.textContent = String(ban.reason).trim();
    else {
        reason.textContent = BAN_NO_REASON_LINES[jokeIndex];
        el.__jokeTimer = setInterval(() => { jokeIndex = (jokeIndex + 1) % BAN_NO_REASON_LINES.length; reason.textContent = BAN_NO_REASON_LINES[jokeIndex]; }, 6500);
    }
    const countdown = el.querySelector('#timeout-countdown'), endText = el.querySelector('#timeout-end');
    if (!temporary) { countdown.textContent = 'No end date'; endText.textContent = 'This is a permanent ban.'; }
    else {
        endText.textContent = `Ends ${new Date(expiry).toLocaleString()}${ban.durationLabel ? ` · ${ban.durationLabel} suspension` : ''}`;
        const tick = () => {
            const left = expiry - Date.now();
            if (left <= 0) { removeBanScreen(true); return; }
            countdown.textContent = banRemaining(left);
        };
        tick(); banScreenTimer = setInterval(tick, 1000);
    }
    const gameStatus = el.querySelector('#timeout-game-status'), scoreLabel = el.querySelector('#timeout-score'), target = el.querySelector('#timeout-star'), start = el.querySelector('#timeout-game-start'), board = el.querySelector('#timeout-game-board');
    let gameTimer = null, score = 0, timeLeft = 20, playing = false;
    const moveTarget = () => { target.style.left = `${5 + Math.random() * 82}%`; target.style.top = `${5 + Math.random() * 70}%`; };
    const finishGame = () => { playing = false; clearInterval(gameTimer); gameTimer = null; target.classList.add('hidden'); start.textContent = 'Play again'; gameStatus.textContent = `Time! You caught ${score} star${score === 1 ? '' : 's'}.`; };
    target.onclick = () => { if (!playing) return; score++; scoreLabel.textContent = score; moveTarget(); };
    start.onclick = () => {
        if (playing) return;
        playing = true; score = 0; timeLeft = 20; scoreLabel.textContent = '0'; start.textContent = 'Playing...'; gameStatus.textContent = 'Go! Catch the moving star.'; target.classList.remove('hidden'); moveTarget();
        gameTimer = setInterval(() => { timeLeft--; gameStatus.textContent = `Catch the star! ${timeLeft} seconds left.`; if (timeLeft <= 0) finishGame(); }, 1000);
    };
    el.__stopGame = () => { clearInterval(gameTimer); clearInterval(el.__jokeTimer); };
}

function refreshOwnBanScreen() {
    const active = [...ownBanEntries.values()].filter(entry => !banExpiryMs(entry.ban) || banExpiryMs(entry.ban) > Date.now()).sort((a, b) => (banExpiryMs(a.ban) || Infinity) - (banExpiryMs(b.ban) || Infinity));
    if (active.length) showBanScreen(active[0].ban); else removeBanScreen();
}
function checkOwnBan() {
    if (!db || !auth || !auth.currentUser) return;
    const ids = [deviceId()];
    if (!auth.currentUser.isAnonymous && auth.currentUser.uid !== 'admin') ids.push('u_' + auth.currentUser.uid);
    const key = ids.join('|');
    if (key === ownBanKey) return;
    ownBanUnsubs.forEach(unsub => unsub()); ownBanUnsubs = []; ownBanEntries = new Map(); ownBanKey = key;
    ids.forEach(id => {
        const unsub = bansCol().doc(id).onSnapshot(doc => {
            if (doc.exists) ownBanEntries.set(id, { ban: doc.data() }); else ownBanEntries.delete(id);
            refreshOwnBanScreen();
        }, e => console.warn('Could not check this browser ban:', e.code || e.message));
        ownBanUnsubs.push(unsub);
    });
}
{ const t = setInterval(() => { if (db && userId) { clearInterval(t); checkOwnBan(); } }, 500); }

function renderBans() {
    const box = document.getElementById('ban-list'); if (!box) return;
    box.replaceChildren();
    if (!banList.length) { box.innerHTML = '<p class="fb-hint">No active or past suspensions are listed.</p>'; return; }
    banList.forEach(b => {
        const expiry = banExpiryMs(b), expired = expiry > 0 && expiry <= Date.now();
        const row = document.createElement('article'); row.className = 'ban-admin-row';
        const details = document.createElement('div'); details.className = 'min-w-0';
        const id = document.createElement('strong'); id.className = 'font-mono text-xs break-all'; id.textContent = b.id;
        const status = document.createElement('span'); status.className = `ban-status ${expired ? 'is-expired' : expiry ? 'is-temporary' : 'is-permanent'}`; status.textContent = expired ? 'Expired' : expiry ? `Suspended · ${banRemaining(expiry - Date.now())} left` : 'Permanent';
        const reason = document.createElement('p'); reason.className = 'text-xs text-slate-500 mt-1'; reason.textContent = b.reason && String(b.reason).trim() ? `Reason: ${b.reason}` : 'Reason: none given';
        details.append(id, status, reason);
        if (expiry && !expired) { const end = document.createElement('p'); end.className = 'text-[10px] text-slate-400 mt-1'; end.textContent = `Ends ${new Date(expiry).toLocaleString()}`; details.appendChild(end); }
        const remove = document.createElement('button'); remove.className = 'cm-btn ghost ban-unban'; remove.textContent = 'Unban'; remove.setAttribute('aria-label', `Unban ${b.id}`); remove.onclick = () => unbanDevice(b.id);
        row.append(details, remove); box.appendChild(row);
    });
}
function startBanAdmin() {
    stopBanAdmin();
    banUnsub = bansCol().onSnapshot(s => { banList = s.docs.map(d => ({ id: d.id, ...d.data() })); renderBans(); }, e => { console.error('bans', e); const box = document.getElementById('ban-list'); if (box) box.textContent = `Could not load bans (${e.code || 'error'}). Check admin access and Firestore rules.`; });
    banAdminTimer = setInterval(renderBans, 30000);
}
function stopBanAdmin() { if (banUnsub) banUnsub(); banUnsub = null; clearInterval(banAdminTimer); banAdminTimer = null; banList = []; renderBans(); }
async function banDevice(id, reason = '', durationKey) {
    const isAccount = String(id).startsWith('u_');
    const key = durationKey || (document.getElementById('ban-duration') && document.getElementById('ban-duration').value) || 'permanent';
    const [durationLabel, durationMs] = BAN_DURATIONS[key] || BAN_DURATIONS.permanent;
    const why = String(reason || '').trim();
    if (why.length > 240) { showToast('Keep the reason under 240 characters.', 'error'); return false; }
    const message = `${isAccount ? 'Account' : 'Browser'} "${id}" will be ${durationMs ? `suspended for ${durationLabel}` : 'permanently banned'} and blocked from Hero.${why ? ` Reason: ${why}` : ' No reason will be recorded.'}`;
    if (!(await customConfirm({ title: durationMs ? 'Suspend access?' : 'Permanently ban access?', message, confirmText: durationMs ? 'Suspend' : 'Ban permanently', danger: true }))) return false;
    try {
        const expiresAt = durationMs ? firebase.firestore.Timestamp.fromMillis(Date.now() + durationMs) : null;
        await bansCol().doc(id).set({ reason: why, durationLabel: durationMs ? durationLabel : '', durationMs, bannedAt: firebase.firestore.FieldValue.serverTimestamp(), expiresAt });
        showToast(durationMs ? `${isAccount ? 'Account' : 'Browser'} suspended for ${durationLabel}.` : `${isAccount ? 'Account' : 'Browser'} permanently banned.`, 'success');
        return true;
    } catch (e) { showToast(`Could not apply suspension (${e.code || 'error'}).`, 'error'); return false; }
}
async function unbanDevice(id) {
    if (!(await customConfirm({ title: 'Unban this visitor?', message: `Remove the ban or suspension for "${id}"? They will regain access the next time their browser checks in.`, confirmText: 'Unban' }))) return;
    try { await bansCol().doc(id).delete(); showToast('Ban removed.', 'success'); } catch (e) { showToast(`Could not unban (${e.code || 'error'}).`, 'error'); }
}
function banDeviceManual() {
    const input = document.getElementById('ban-id-input'), reason = document.getElementById('ban-reason-input');
    const id = input.value.trim();
    if (!id) return showToast('Enter a browser ID or an account ID beginning with u_.', 'error');
    banDevice(id, reason.value.trim()).then(ok => { if (ok) { input.value = ''; reason.value = ''; } });
}
// admin card, created here so index.html stays clean; lives on the "Site" tab
(function () {
    const card = document.createElement('div'); card.dataset.atab = 'site';
    card.className = 'bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden mt-6';
    card.innerHTML = '<div class="p-5 border-b border-slate-200 dark:border-slate-700"><h3 class="font-bold text-slate-900 dark:text-white">Bans & suspensions</h3><p class="text-xs text-slate-500 font-medium mt-1">Ban a browser ID or verified account ID. Temporary suspensions end automatically. Your browser ID: <span class="font-mono" id="my-device"></span></p><div class="ban-admin-form"><input id="ban-id-input" class="fb-input" placeholder="Browser ID or account ID (u_…)"><select id="ban-duration" class="fb-input" aria-label="Suspension duration"><option value="10m">10 minutes</option><option value="1h">1 hour</option><option value="24h">24 hours</option><option value="7d">7 days</option><option value="30d">30 days</option><option value="permanent" selected>Permanent ban</option></select><input id="ban-reason-input" class="fb-input" maxlength="240" placeholder="Reason (optional)"><button class="cm-btn go" onclick="banDeviceManual()">Apply</button></div><p class="text-xs text-slate-500 mt-2">Reason is optional. Missing reasons appear as “none given” here and rotate through lighthearted messages on the timeout screen.</p></div><div id="ban-list" class="ban-admin-list"></div>';
    document.getElementById('admin-panel').appendChild(card); document.getElementById('my-device').textContent = deviceId(); renderBans();
    setAdminTab(sessionStorage.getItem('mq_atab') || 'quiz');
})();
window.addEventListener('hero-auth-state', () => { if (userId && db) checkOwnBan(); });
const _oau = onAdminUnlocked; onAdminUnlocked = function () { _oau(); startBanAdmin(); };
const _la = lockAdmin; lockAdmin = function (m) { stopBanAdmin(); return _la(m); };
