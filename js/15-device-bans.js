// ===== DEVICE BANS =====
// Privacy-friendlier than matching names to IP addresses: each browser gets a random id in localStorage on first load.
// The admin bans that id (paste it, or copy it from a feedback/analytics row), and that one browser sees a "suspended" screen.
// No names, no IP addresses stored. For network-level abuse use EdgeOne's rate limiting / WAF rules, which act on IP
// without this site ever keeping an address.
const deviceId = () => { let id = localStorage.getItem('hero_device'); if (!id) { id = 'd_' + crypto.randomUUID().slice(0, 12); localStorage.setItem('hero_device', id); } return id; };
const bansCol = () => db.collection('artifacts').doc(appId).collection('public').doc('data').collection('bans');
let banList = [], banUnsub = null;
function showBanScreen(reason) {
    if (document.getElementById('ban-screen')) return;
    const el = document.createElement('div'); el.id = 'ban-screen';
    el.style.cssText = 'position:fixed;inset:0;z-index:9990;background:#0a0e1a;color:#eef2fa;display:flex;align-items:center;justify-content:center;padding:24px;text-align:center;font-family:Spectral,serif';
    el.innerHTML = '<div><h2 style="font-size:28px;font-weight:700;margin-bottom:10px">Access suspended</h2><p style="opacity:.7;max-width:420px"></p></div>'; el.querySelector('p').textContent = reason || 'This browser has been restricted by the stewards of Hero.';
    document.body.appendChild(el);
}
async function checkOwnBan() { try { const d = await bansCol().doc(deviceId()).get(); if (d.exists) showBanScreen(d.data().reason); } catch (e) { /* not banned / offline */ } }
{ const t = setInterval(() => { if (db && userId) { clearInterval(t); checkOwnBan(); } }, 500); }
function renderBans() {
    const box = document.getElementById('ban-list'); if (!box) return;
    box.innerHTML = banList.length ? '' : '<p class="fb-hint">No devices banned.</p>';
    banList.forEach(b => { const row = document.createElement('div'); row.className = 'flex items-center justify-between gap-3 bg-slate-50 dark:bg-slate-900 p-3 rounded-xl border border-slate-200 dark:border-slate-700';
        row.innerHTML = '<div class="min-w-0"><div class="font-mono text-xs font-bold truncate"></div><div class="text-[10px] text-slate-500 font-bold uppercase mt-0.5"></div></div><button class="text-emerald-600 text-xs font-bold px-3 py-1.5 rounded-lg border border-emerald-200 dark:border-emerald-800">Unban</button>';
        row.querySelector('.truncate').textContent = b.id; row.querySelectorAll('div')[2].textContent = b.reason || 'no reason given';
        row.querySelector('button').onclick = () => unbanDevice(b.id); box.appendChild(row); });
}
function startBanAdmin() { stopBanAdmin(); banUnsub = bansCol().onSnapshot(s => { banList = s.docs.map(d => ({ id: d.id, ...d.data() })); renderBans(); }, e => console.error('bans', e)); }
function stopBanAdmin() { if (banUnsub) banUnsub(); banUnsub = null; banList = []; renderBans(); }
async function banDevice(id, reason) {
    if (!(await customConfirm({ title: 'Ban this device?', message: `Browser "${id}" will be blocked from Hero until unbanned.`, confirmText: 'Ban', danger: true }))) return;
    try { await bansCol().doc(id).set({ reason: reason || '', bannedAt: firebase.firestore.FieldValue.serverTimestamp() }); showToast('Device banned.', 'success'); } catch (e) { showToast(`Could not ban (${e.code || 'error'}).`, 'error'); }
}
async function unbanDevice(id) { try { await bansCol().doc(id).delete(); showToast('Device unbanned.', 'success'); } catch (e) { showToast(`Could not unban (${e.code || 'error'}).`, 'error'); } }
function banDeviceManual() { const i = document.getElementById('ban-id-input'), v = i.value.trim(); if (v) { banDevice(v, 'manual'); i.value = ''; } }
// admin card, created here so index.html stays clean; lives on the "Site" tab
(function () {
    const card = document.createElement('div'); card.dataset.atab = 'site';
    card.className = 'bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden mt-6';
    card.innerHTML = '<div class="p-5 border-b border-slate-200 dark:border-slate-700 flex flex-wrap gap-3 items-center justify-between"><div><h3 class="font-bold text-slate-900 dark:text-white">Banned Devices</h3><p class="text-xs text-slate-500 font-medium">Bans one browser, not a person. Your own device id: <span class="font-mono" id="my-device"></span></p></div><div style="display:flex;gap:8px"><input id="ban-id-input" class="fb-input" style="width:200px" placeholder="Device ID"><button class="cm-btn go" onclick="banDeviceManual()">Ban</button></div></div><div id="ban-list" class="p-4 space-y-2"></div>';
    document.getElementById('admin-panel').appendChild(card); document.getElementById('my-device').textContent = deviceId(); renderBans();
    setAdminTab(sessionStorage.getItem('mq_atab') || 'quiz');
})();
const _oau = onAdminUnlocked; onAdminUnlocked = function () { _oau(); startBanAdmin(); };
const _la = lockAdmin; lockAdmin = function (m) { stopBanAdmin(); return _la(m); };
