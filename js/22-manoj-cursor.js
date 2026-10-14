(function () {
    const CURSOR_ASSET = 'media/manoj-head.png';
    const cursorKey = 'hero_manoj_cursor_until';
    const cursorRef = () => db.collection('artifacts').doc(appId).collection('public').doc('data').collection('globalSettings').doc('manojCursor');
    let scheduleUnsub = null, schedule = null, cursorImage = null, assetReady = false;
    let lastX = -100, lastY = -100, active = false;

    function localDateKey(date = new Date()) {
        return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
    }
    function scheduleActive() { return !!(schedule && schedule.enabled === true && schedule.activationDate && localDateKey() >= schedule.activationDate); }
    function temporaryActive() { return Number(localStorage.getItem(cursorKey) || 0) > Date.now(); }
    function syncCursor() {
        const shouldRun = matchMedia('(pointer:fine)').matches && (scheduleActive() || temporaryActive());
        if (!shouldRun || !assetReady) {
            active = false; document.documentElement.classList.remove('manoj-cursor-active');
            if (cursorImage) cursorImage.classList.remove('visible');
            return;
        }
        active = true; document.documentElement.classList.add('manoj-cursor-active');
        if (cursorImage) cursorImage.classList.add('visible');
    }
    function ensureCursor() {
        if (cursorImage) return;
        cursorImage = document.createElement('img'); cursorImage.id = 'manoj-cursor'; cursorImage.alt = '';
        cursorImage.setAttribute('aria-hidden', 'true'); cursorImage.draggable = false;
        cursorImage.onload = () => { assetReady = true; syncCursor(); };
        cursorImage.onerror = () => { assetReady = false; cursorImage.classList.remove('visible'); document.documentElement.classList.remove('manoj-cursor-active'); console.warn(`Manoj cursor asset missing. Add ${CURSOR_ASSET} to enable it.`); };
        cursorImage.src = CURSOR_ASSET; document.body.appendChild(cursorImage);
    }
    function updateScheduleUI() {
        const input = document.getElementById('manoj-cursor-date'), status = document.getElementById('manoj-cursor-status');
        if (!input || !status) return;
        input.value = schedule && schedule.activationDate || '';
        if (!schedule || !schedule.enabled || !schedule.activationDate) status.textContent = 'Not scheduled. You can also activate it by typing “Manoj Cursor” to Clio.';
        else if (scheduleActive()) status.textContent = `Active since ${schedule.activationDate}. Clear the date to turn off the scheduled cursor.`;
        else status.textContent = `Scheduled to activate on ${schedule.activationDate}.`;
    }
    function attachAdminControl() {
        const panel = document.getElementById('admin-panel');
        if (!panel || document.getElementById('manoj-cursor-admin')) return;
        const card = document.createElement('section'); card.id = 'manoj-cursor-admin'; card.dataset.atab = 'site';
        card.className = 'bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm p-5 mt-6';
        if (panel.dataset.active !== 'site') card.classList.add('atab-off');
        card.innerHTML = '<div class="flex flex-wrap items-start justify-between gap-4"><div><h3 class="font-bold text-lg">Manoj Cursor event</h3><p class="text-sm text-slate-500 mt-1 max-w-xl">Schedule the head-only cursor for a date. Visitors can also summon it locally by asking Clio “Manoj Cursor”. Add the transparent image at <code>media/manoj-head.png</code>.</p></div><i data-lucide="mouse-pointer-2" class="w-5 h-5 text-indigo-500"></i></div><div class="manoj-cursor-admin-controls"><label for="manoj-cursor-date">Activation date</label><input id="manoj-cursor-date" type="date"><button class="cm-btn go" type="button" id="manoj-cursor-save">Save schedule</button><button class="cm-btn ghost" type="button" id="manoj-cursor-clear">Clear date</button></div><p id="manoj-cursor-status" class="text-xs text-slate-500 mt-3" role="status"></p>';
        card.querySelector('#manoj-cursor-save').onclick = saveSchedule;
        card.querySelector('#manoj-cursor-clear').onclick = clearSchedule;
        panel.appendChild(card); if (window.lucide) lucide.createIcons(); updateScheduleUI();
    }
    async function saveSchedule() {
        const input = document.getElementById('manoj-cursor-date');
        if (!input || !input.value) return showToast('Choose an activation date first.', 'error');
        try {
            await cursorRef().set({ enabled: true, activationDate: input.value, updatedAt: firebase.firestore.FieldValue.serverTimestamp() }, { merge: true });
            showToast('Manoj Cursor date saved.', 'success');
        } catch (error) { showToast(`Could not save the date (${error.code || 'error'}).`, 'error'); }
    }
    async function clearSchedule() {
        try { await cursorRef().set({ enabled: false, activationDate: '', updatedAt: firebase.firestore.FieldValue.serverTimestamp() }, { merge: true }); showToast('Manoj Cursor schedule cleared.', 'success'); }
        catch (error) { showToast(`Could not clear the date (${error.code || 'error'}).`, 'error'); }
    }
    function startScheduleListener() {
        if (!db || !window.__heroCanAccessApp || scheduleUnsub) return;
        scheduleUnsub = cursorRef().onSnapshot(doc => { schedule = doc.exists ? doc.data() : null; updateScheduleUI(); syncCursor(); }, error => console.warn('Manoj cursor schedule unavailable:', error.code || error.message));
    }
    function stopScheduleListener() { if (scheduleUnsub) scheduleUnsub(); scheduleUnsub = null; schedule = null; syncCursor(); }

    window.activateManojCursor = function () {
        const expires = Number(localStorage.getItem(cursorKey) || 0);
        if (expires > Date.now()) { localStorage.removeItem(cursorKey); showToast('Manoj Cursor dismissed.', 'info'); }
        else { localStorage.setItem(cursorKey, String(Date.now() + 86400000)); ensureCursor(); showToast('Manoj Cursor is on for this browser for 24 hours.', 'success'); }
        syncCursor();
    };
    // One transform write per animation frame (not per raw pointer event) -- raw pointermove can fire far
    // faster than the screen repaints, and writing a style every single time was the real source of the lag,
    // especially layered over Leaflet's own listeners while the map is visible.
    let pendingX = 0, pendingY = 0, rafQueued = false;
    function paintCursor() {
        rafQueued = false;
        if (!active || !cursorImage || !assetReady) return;
        const dx = pendingX - lastX, dy = pendingY - lastY;
        const pointerTilt = cursorImage.classList.contains('pointing') ? 11 : 0;
        const angle = Math.max(-16, Math.min(16, dx * .7 + dy * .12 + pointerTilt));
        cursorImage.style.transform = `translate3d(${pendingX + 2}px,${pendingY + 2}px,0) rotate(${angle}deg)`;
        lastX = pendingX; lastY = pendingY;
    }
    window.addEventListener('pointermove', event => {
        if (!active || !cursorImage || !assetReady) return;
        pendingX = event.clientX; pendingY = event.clientY;
        if (!rafQueued) { rafQueued = true; requestAnimationFrame(paintCursor); }
    }, { passive: true });
    window.addEventListener('pointerover', event => {
        if (!cursorImage) return;
        cursorImage.classList.toggle('pointing', !!event.target.closest('button,a,summary,label,[role="button"],input,select,textarea'));
    }, { passive: true });
    window.addEventListener('hero-auth-state', event => { if (event.detail && event.detail.authorized) startScheduleListener(); else stopScheduleListener(); });
    window.addEventListener('hero-admin-authenticated', attachAdminControl);
    window.addEventListener('hero-admin-locked', () => { const card = document.getElementById('manoj-cursor-admin'); if (card) card.remove(); });
    document.addEventListener('DOMContentLoaded', () => {
        ensureCursor(); startScheduleListener(); setInterval(syncCursor, 60000);
    });
})();
