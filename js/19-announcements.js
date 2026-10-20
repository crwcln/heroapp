// ===== ANNOUNCEMENTS =====
// Posting one here fills the "Got it" popup, the minimized banner, and the Announcements page.
const annCol = () => db.collection('artifacts').doc(appId).collection('public').doc('data').collection('announcements');
let annList = [], annUnsub = null, editingAnnouncementId = null;
function annFmtDate(ts) { const d = ts && ts.toDate ? ts.toDate() : new Date(); return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' }); }
function sanitizeAnnouncementHtml(input) {
    const source = document.createElement('template'); source.innerHTML = String(input || '');
    const allowed = new Set(['P','BR','STRONG','B','EM','I','U','S','DEL','UL','OL','LI','BLOCKQUOTE','A','IMG']);
    const clean = (node) => {
        if (node.nodeType === Node.TEXT_NODE) return document.createTextNode(node.nodeValue || '');
        if (node.nodeType !== Node.ELEMENT_NODE) return document.createDocumentFragment();
        const tag = node.tagName;
        if (!allowed.has(tag)) { const fragment = document.createDocumentFragment(); [...node.childNodes].forEach(child => fragment.append(clean(child))); return fragment; }
        const out = document.createElement(tag.toLowerCase());
        if (tag === 'A') {
            try { const url = new URL(node.getAttribute('href') || '', location.href); if (!['http:', 'https:', 'mailto:'].includes(url.protocol)) return document.createTextNode(node.textContent || ''); out.href = url.href; out.target = '_blank'; out.rel = 'noopener noreferrer'; }
            catch (_) { return document.createTextNode(node.textContent || ''); }
        }
        if (tag === 'IMG') {
            try { const url = new URL(node.getAttribute('src') || '', location.href); if (url.protocol !== 'https:') return document.createDocumentFragment(); out.src = url.href; out.alt = String(node.getAttribute('alt') || '').slice(0, 200); out.loading = 'lazy'; }
            catch (_) { return document.createDocumentFragment(); }
        } else [...node.childNodes].forEach(child => out.append(clean(child)));
        return out;
    };
    const result = document.createDocumentFragment(); [...source.content.childNodes].forEach(node => result.append(clean(node))); return result;
}
function renderAnnouncementBody(element, announcement) {
    element.replaceChildren(sanitizeAnnouncementHtml(announcement.bodyHtml || announcement.body || ''));
}
function startAnnouncements() {
    if (annUnsub || !window.__heroCanAccessApp) return;
    annUnsub = annCol().orderBy('createdAt', 'desc').onSnapshot(s => {
        annList = s.docs.map(d => ({ id: d.id, ...d.data() }));
        renderAnnList(); renderAnnAdmin(); maybeShowAnnPopup();
    }, e => { console.error('announcements', e); if (e.code === 'permission-denied') { annUnsub(); annUnsub = null; } });
}
function stopAnnouncements() { if (annUnsub) annUnsub(); annUnsub = null; }
function renderAnnList() {
    const box = document.getElementById('ann-list'); if (!box) return;
    box.innerHTML = annList.length ? '' : '<p class="text-center text-slate-500 italic py-10">No announcements yet.</p>';
    annList.forEach(a => {
        const card = document.createElement('div'); card.className = 'ann-card';
        card.innerHTML = '<div class="ann-head"><div class="ann-tags"></div><div class="ann-title"></div><div class="ann-date"></div></div><div class="ann-body"></div>';
        const tagBox = card.querySelector('.ann-tags'); (a.tags || []).forEach(t => { const s = document.createElement('span'); s.className = 'ann-tag'; s.textContent = t; tagBox.appendChild(s); });
        card.querySelector('.ann-title').textContent = a.title || 'Announcement'; card.querySelector('.ann-date').textContent = annFmtDate(a.createdAt); renderAnnouncementBody(card.querySelector('.ann-body'), a);
        box.appendChild(card);
    });
}
function renderAnnAdmin() {
    const box = document.getElementById('ann-admin-list'); if (!box) return;
    box.innerHTML = '';
    annList.forEach(a => { const row = document.createElement('div'); row.className = 'an-admin-row';
        const span = document.createElement('span'); span.className = 'truncate'; span.textContent = `${a.title} \u00b7 ${annFmtDate(a.createdAt)}`;
        const actions = document.createElement('div'); actions.className = 'an-admin-actions';
        const edit = document.createElement('button'); edit.type = 'button'; edit.className = 'an-admin-edit'; edit.title = 'Edit announcement'; edit.setAttribute('aria-label', `Edit ${a.title || 'announcement'}`); edit.innerHTML = '<i data-lucide="pencil" class="w-3.5 h-3.5"></i>'; edit.onclick = () => editAnnouncement(a.id);
        const btn = document.createElement('button'); btn.type = 'button'; btn.title = 'Delete announcement'; btn.setAttribute('aria-label', `Delete ${a.title || 'announcement'}`); btn.innerHTML = '<i data-lucide="trash-2" class="w-3.5 h-3.5"></i>'; btn.onclick = () => deleteAnnouncement(a.id);
        actions.append(edit, btn); row.append(span, actions); box.appendChild(row); });
    lucide.createIcons();
}
function setAnnouncementEditMode(id) {
    const submit = document.querySelector('[onclick="postAnnouncement()"]');
    if (!submit) return;
    let cancel = document.getElementById('ann-cancel-edit');
    if (!cancel) {
        cancel = document.createElement('button'); cancel.id = 'ann-cancel-edit'; cancel.type = 'button'; cancel.className = 'cm-btn ghost'; cancel.textContent = 'Cancel edit'; cancel.onclick = cancelAnnouncementEdit;
        submit.parentElement.appendChild(cancel);
    }
    editingAnnouncementId = id || null;
    submit.innerHTML = id ? '<i data-lucide="save"></i> Save changes' : '<i data-lucide="send"></i> Post globally';
    cancel.classList.toggle('hidden', !id);
    if (window.lucide) lucide.createIcons();
}
function editAnnouncement(id) {
    const announcement = annList.find(item => item.id === id);
    if (!announcement) return showToast('That announcement is no longer available.', 'error');
    const title = document.getElementById('ann-title'), editor = document.getElementById('ann-body'), tags = document.getElementById('ann-tags');
    if (!title || !editor || !tags) return;
    title.value = announcement.title || '';
    const safeBody = document.createElement('div'); safeBody.append(sanitizeAnnouncementHtml(announcement.bodyHtml || announcement.body || '')); editor.innerHTML = safeBody.innerHTML;
    tags.value = (announcement.tags || []).join(', ');
    setAnnouncementEditMode(id);
    const preview = document.getElementById('ann-preview-wrap'); if (preview) preview.classList.add('hidden');
    document.getElementById('admin-panel').scrollIntoView({ behavior: 'smooth', block: 'start' });
    editor.focus();
}
function cancelAnnouncementEdit() {
    document.getElementById('ann-title').value = ''; document.getElementById('ann-body').innerHTML = ''; document.getElementById('ann-tags').value = '';
    setAnnouncementEditMode(null);
}
window.editAnnouncement = editAnnouncement;
async function postAnnouncement() {
    const title = document.getElementById('ann-title').value.trim(), editor = document.getElementById('ann-body'), clean = document.createElement('div');
    clean.append(sanitizeAnnouncementHtml(editor.innerHTML));
    const bodyHtml = clean.innerHTML.trim(), body = editor.innerText.trim();
    const tags = document.getElementById('ann-tags').value.split(',').map(t => t.trim()).filter(Boolean).slice(0, 4);
    if (!title || !body) return showToast('Add a title and a message.', 'error');
    const wasEditing = !!editingAnnouncementId;
    try {
        if (wasEditing) await annCol().doc(editingAnnouncementId).update({ title, body, bodyHtml, tags, updatedAt: firebase.firestore.FieldValue.serverTimestamp() });
        else await annCol().add({ title, body, bodyHtml, tags, createdAt: firebase.firestore.FieldValue.serverTimestamp() });
        document.getElementById('ann-title').value = ''; editor.innerHTML = ''; document.getElementById('ann-tags').value = '';
        setAnnouncementEditMode(null);
        if (wasEditing) return showToast('Announcement updated.', 'success');
        if (window.__heroSendAnnouncementPush) {
            try {
                const delivery = await window.__heroSendAnnouncementPush(title, body);
                const failed = Number(delivery.failed || 0);
                showToast(delivery.sent
                    ? `Announcement posted. Push sent to ${delivery.sent} device${delivery.sent === 1 ? '' : 's'}${failed ? `; ${failed} could not be reached` : ''}.`
                    : 'Announcement posted. No devices have notifications enabled yet.', failed ? 'info' : 'success');
            } catch (pushError) {
                console.warn('Announcement saved, but push delivery failed:', pushError);
                showToast(`Announcement posted, but push delivery failed: ${pushError.message}`, 'info');
            }
        } else showToast('Announcement posted.', 'success');
    } catch (e) { showToast(`Could not post (${e.code || 'error'}).`, 'error'); }
}
window.toggleAnnouncementPreview = function () {
    const wrap = document.getElementById('ann-preview-wrap'), visible = wrap.classList.toggle('hidden') === false;
    if (visible) renderAnnouncementBody(document.getElementById('ann-preview'), { bodyHtml: document.getElementById('ann-body').innerHTML });
};
async function deleteAnnouncement(id) {
    if (!(await customConfirm({ title: 'Delete this announcement?', message: 'It disappears from the Announcements page immediately.', confirmText: 'Delete', danger: true }))) return;
    try { await annCol().doc(id).delete(); showToast('Deleted.', 'success'); } catch (e) { showToast(`Could not delete (${e.code || 'error'}).`, 'error'); }
}
function maybeShowAnnPopup() {
    const latest = annList[0];
    const modal = document.getElementById('global-msg-modal'), mini = document.getElementById('global-msg-minimized');
    const badge = document.getElementById('announcements-count');
    if (badge) { badge.textContent = annList.length > 99 ? '99+' : String(annList.length); badge.classList.toggle('hidden', !annList.length); }
    if (!latest) { modal.classList.add('hidden'); mini.classList.add('hidden'); return; }
    document.getElementById('gm-title').textContent = latest.title; document.getElementById('gm-date').textContent = annFmtDate(latest.createdAt);
    renderAnnouncementBody(document.getElementById('global-msg-text'), latest);
    const tagBox = document.getElementById('gm-tags'); tagBox.innerHTML = '';
    (latest.tags || []).forEach(t => { const s = document.createElement('span'); s.className = 'ann-tag'; s.style.cssText = 'background:rgba(255,255,255,.22);color:#fff'; s.textContent = t; tagBox.appendChild(s); });
    if (localStorage.getItem('hero_lastSeenAnn') !== latest.id) { modal.classList.remove('hidden'); mini.classList.add('hidden'); lucide.createIcons(); }
    else { modal.classList.add('hidden'); mini.classList.remove('hidden'); }
}
window.dismissGlobalMsg = function () {
    document.getElementById('global-msg-modal').classList.add('hidden');
    if (annList[0]) { localStorage.setItem('hero_lastSeenAnn', annList[0].id); document.getElementById('global-msg-minimized').classList.remove('hidden'); }
};
const _oau2 = onAdminUnlocked; onAdminUnlocked = function () { _oau2(); startAnnouncements(); };
window.addEventListener('hero-auth-state', e => { if (e.detail && e.detail.authorized) startAnnouncements(); else stopAnnouncements(); });
