// ===== ANNOUNCEMENTS =====
// Posting one here fills the "Got it" popup, the minimized banner, and the Announcements page.
const annCol = () => db.collection('artifacts').doc(appId).collection('public').doc('data').collection('announcements');
let annList = [], annUnsub = null;
function annFmtDate(ts) { const d = ts && ts.toDate ? ts.toDate() : new Date(); return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' }); }
function startAnnouncements() {
    if (annUnsub) return;
    annUnsub = annCol().orderBy('createdAt', 'desc').limit(30).onSnapshot(s => {
        annList = s.docs.map(d => ({ id: d.id, ...d.data() }));
        renderAnnList(); renderAnnAdmin(); maybeShowAnnPopup();
    }, e => console.error('announcements', e));
}
function renderAnnList() {
    const box = document.getElementById('ann-list'); if (!box) return;
    box.innerHTML = annList.length ? '' : '<p class="text-center text-slate-500 italic py-10">No announcements yet.</p>';
    annList.forEach(a => {
        const card = document.createElement('div'); card.className = 'ann-card';
        card.innerHTML = '<div class="ann-head"><div class="ann-tags"></div><div class="ann-title"></div><div class="ann-date"></div></div><div class="ann-body"></div>';
        const tagBox = card.querySelector('.ann-tags'); (a.tags || []).forEach(t => { const s = document.createElement('span'); s.className = 'ann-tag'; s.textContent = t; tagBox.appendChild(s); });
        card.querySelector('.ann-title').textContent = a.title || 'Announcement'; card.querySelector('.ann-date').textContent = annFmtDate(a.createdAt); card.querySelector('.ann-body').textContent = a.body || '';
        box.appendChild(card);
    });
}
function renderAnnAdmin() {
    const box = document.getElementById('ann-admin-list'); if (!box) return;
    box.innerHTML = '';
    annList.forEach(a => { const row = document.createElement('div'); row.className = 'an-admin-row';
        const span = document.createElement('span'); span.className = 'truncate'; span.textContent = `${a.title} \u00b7 ${annFmtDate(a.createdAt)}`;
        const btn = document.createElement('button'); btn.innerHTML = '<i data-lucide="trash-2" class="w-3.5 h-3.5"></i>'; btn.onclick = () => deleteAnnouncement(a.id);
        row.append(span, btn); box.appendChild(row); });
    lucide.createIcons();
}
async function postAnnouncement() {
    const title = document.getElementById('ann-title').value.trim(), body = document.getElementById('ann-body').value.trim();
    const tags = document.getElementById('ann-tags').value.split(',').map(t => t.trim()).filter(Boolean).slice(0, 4);
    if (!title || !body) return showToast('Add a title and a message.', 'error');
    try {
        await annCol().add({ title, body, tags, createdAt: firebase.firestore.FieldValue.serverTimestamp() });
        document.getElementById('ann-title').value = ''; document.getElementById('ann-body').value = ''; document.getElementById('ann-tags').value = '';
        showToast('Announcement posted.', 'success');
    } catch (e) { showToast(`Could not post (${e.code || 'error'}).`, 'error'); }
}
async function deleteAnnouncement(id) {
    if (!(await customConfirm({ title: 'Delete this announcement?', message: 'It disappears from the Announcements page immediately.', confirmText: 'Delete', danger: true }))) return;
    try { await annCol().doc(id).delete(); showToast('Deleted.', 'success'); } catch (e) { showToast(`Could not delete (${e.code || 'error'}).`, 'error'); }
}
function maybeShowAnnPopup() {
    const latest = annList[0]; if (!latest) return;
    const modal = document.getElementById('global-msg-modal'), mini = document.getElementById('global-msg-minimized');
    document.getElementById('gm-title').textContent = latest.title; document.getElementById('gm-date').textContent = annFmtDate(latest.createdAt);
    document.getElementById('global-msg-text').textContent = latest.body;
    const tagBox = document.getElementById('gm-tags'); tagBox.innerHTML = '';
    (latest.tags || []).forEach(t => { const s = document.createElement('span'); s.className = 'ann-tag'; s.style.cssText = 'background:rgba(255,255,255,.22);color:#fff'; s.textContent = t; tagBox.appendChild(s); });
    document.getElementById('global-msg-min-title').textContent = latest.title; document.getElementById('global-msg-min-text').textContent = latest.body;
    if (localStorage.getItem('hero_lastSeenAnn') !== latest.id) { modal.classList.remove('hidden'); mini.classList.add('hidden'); lucide.createIcons(); }
    else { modal.classList.add('hidden'); mini.classList.remove('hidden'); }
}
window.dismissGlobalMsg = function () {
    document.getElementById('global-msg-modal').classList.add('hidden');
    if (annList[0]) { localStorage.setItem('hero_lastSeenAnn', annList[0].id); document.getElementById('global-msg-minimized').classList.remove('hidden'); }
};
const _oau2 = onAdminUnlocked; onAdminUnlocked = function () { _oau2(); startAnnouncements(); };
startAnnouncements();
