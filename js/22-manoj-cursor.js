(function () {
    const CURSOR_ASSET = 'media/manoj-head.png';
    const GLASS_LIBRARY_URL = 'https://cdn.jsdelivr.net/npm/@ybouane/liquidglass@1.0.3/dist/index.js';
    const GLASS_CONFIG = {
        blurAmount: 0.04,
        refraction: 1.1,
        chromAberration: 0.08,
        edgeHighlight: 0.2,
        specular: 0.26,
        fresnel: 1.05,
        distortion: 0.02,
        cornerRadius: 44,
        zRadius: 44,
        saturation: 0.08,
        tintStrength: 0.08,
        brightness: 0.04,
        shadowOpacity: 0.32,
        shadowSpread: 14,
        shadowOffsetY: 3,
        bevelMode: 1,
        floating: false,
        button: false
    };
    const cursorKey = 'hero_manoj_cursor_until';
    const cursorRef = () => db.collection('artifacts').doc(appId).collection('public').doc('data').collection('globalSettings').doc('manojCursor');
    const finePointer = matchMedia('(pointer:fine)');
    const interactiveSelector = 'button,a,summary,label,[role="button"],input,select,textarea';
    let scheduleUnsub = null, schedule = null, cursorImage = null, assetReady = false;
    let glassElement = null, glassInstance = null, glassModulePromise = null, glassInitPromise = null;
    let glassGeneration = 0, glassReady = false, glassFailed = false;
    let pendingX = -100, pendingY = -100, rafQueued = false;
    let active = false, pointing = false, pressed = false;

    function localDateKey(date = new Date()) {
        return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
    }
    function scheduleActive() { return !!(schedule && schedule.enabled === true && schedule.activationDate && localDateKey() >= schedule.activationDate); }
    function temporaryActive() { return Number(localStorage.getItem(cursorKey) || 0) > Date.now(); }

    function setVisibility() {
        const visible = active && assetReady && (glassReady || glassFailed);
        document.documentElement.classList.toggle('manoj-cursor-active', visible);
        if (cursorImage) cursorImage.classList.toggle('visible', visible);
        if (glassElement) glassElement.classList.toggle('visible', visible && glassReady);
    }

    function loadGlassModule() {
        if (!glassModulePromise) {
            glassModulePromise = import(GLASS_LIBRARY_URL).catch(error => {
                glassModulePromise = null;
                throw error;
            });
        }
        return glassModulePromise;
    }

    async function initGlass(generation, element) {
        const { LiquidGlass } = await loadGlassModule();
        if (generation !== glassGeneration || !active || glassElement !== element) return;
        const instance = await LiquidGlass.init({ root: document.body, glassElements: [element] });
        document.body.style.removeProperty('user-select');
        document.body.style.removeProperty('-webkit-user-select');
        if (generation !== glassGeneration || !active || glassElement !== element) {
            instance.destroy();
            return;
        }
        glassInstance = instance;
        glassReady = true;
        glassFailed = false;
        queuePaint();
        syncCursor();
    }

    function ensureGlass() {
        if (glassInstance || glassInitPromise || glassFailed) return;
        const generation = ++glassGeneration;
        const element = document.createElement('div');
        element.id = 'manoj-cursor-glass';
        element.setAttribute('aria-hidden', 'true');
        element.dataset.config = JSON.stringify(GLASS_CONFIG);
        glassElement = element;
        document.body.appendChild(element);

        const initPromise = initGlass(generation, element)
            .catch(error => {
                if (generation !== glassGeneration) return;
                glassFailed = true;
                glassReady = false;
                console.warn('LiquidGlass cursor unavailable; using the image fallback.', error);
                syncCursor();
            });
        glassInitPromise = initPromise;
        const clearInit = () => { if (glassInitPromise === initPromise) glassInitPromise = null; };
        initPromise.then(clearInit, clearInit);
    }

    function teardownGlass() {
        glassGeneration++;
        glassReady = false;
        glassFailed = false;
        glassInitPromise = null;
        if (glassInstance) {
            glassInstance.destroy();
            glassInstance = null;
        }
        if (glassElement) {
            glassElement.classList.remove('visible');
            glassElement.remove();
            glassElement = null;
        }
        document.body.style.removeProperty('user-select');
        document.body.style.removeProperty('-webkit-user-select');
    }

    function syncCursor() {
        const shouldRun = finePointer.matches && (scheduleActive() || temporaryActive());
        if (!shouldRun || !assetReady) {
            if (active) teardownGlass();
            active = false;
            setVisibility();
            return;
        }
        active = true;
        if (!glassInstance && !glassInitPromise && !glassFailed) ensureGlass();
        setVisibility();
        queuePaint();
    }

    function ensureCursor() {
        if (cursorImage) return;
        cursorImage = document.createElement('img');
        cursorImage.id = 'manoj-cursor';
        cursorImage.alt = '';
        cursorImage.dataset.dynamic = '';
        cursorImage.setAttribute('aria-hidden', 'true');
        cursorImage.draggable = false;
        cursorImage.onload = () => { assetReady = true; syncCursor(); queuePaint(); };
        cursorImage.onerror = () => {
            assetReady = false;
            active = false;
            teardownGlass();
            setVisibility();
            console.warn(`Manoj cursor asset missing. Add ${CURSOR_ASSET} to enable it.`);
        };
        cursorImage.src = CURSOR_ASSET;
        document.body.appendChild(cursorImage);
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
        card.innerHTML = '<div class="flex flex-wrap items-start justify-between gap-4"><div><h3 class="font-bold text-lg">Manoj Cursor event</h3><p class="text-sm text-slate-500 mt-1 max-w-xl">Schedule the liquid-glass head cursor for a date. Visitors can also summon it locally by asking Clio “Manoj Cursor”. Add the transparent image at <code>media/manoj-head.png</code>.</p></div><i data-lucide="mouse-pointer-2" class="w-5 h-5 text-indigo-500"></i></div><div class="manoj-cursor-admin-controls"><label for="manoj-cursor-date">Activation date</label><input id="manoj-cursor-date" type="date"><button class="cm-btn go" type="button" id="manoj-cursor-save">Save schedule</button><button class="cm-btn ghost" type="button" id="manoj-cursor-clear">Clear date</button></div><p id="manoj-cursor-status" class="text-xs text-slate-500 mt-3" role="status"></p>';
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

    function queuePaint() {
        if (rafQueued) return;
        rafQueued = true;
        requestAnimationFrame(paintCursor);
    }

    function paintCursor() {
        rafQueued = false;
        if (!active || !assetReady || !cursorImage) return;
        const scale = pressed ? 0.94 : pointing ? 1.05 : 1;
        const headSize = cursorImage.offsetWidth || 52;
        cursorImage.style.transform = `translate3d(${pendingX - headSize / 2}px, ${pendingY - headSize / 2}px, 0) scale(${scale})`;
        if (glassElement && glassReady) {
            const lensSize = glassElement.offsetWidth || 88;
            glassElement.style.transform = `translate3d(${pendingX - lensSize / 2}px, ${pendingY - lensSize / 2}px, 0) scale(${scale})`;
        }
    }

    function setPressed(value) {
        if (pressed === value) return;
        pressed = value;
        queuePaint();
    }

    window.addEventListener('pointermove', event => {
        pendingX = event.clientX; pendingY = event.clientY;
        if (active) queuePaint();
    }, { passive: true });
    window.addEventListener('pointerover', event => {
        const next = !!(event.target instanceof Element && event.target.closest(interactiveSelector));
        if (pointing === next) return;
        pointing = next;
        queuePaint();
    }, { passive: true });
    window.addEventListener('pointerdown', () => setPressed(true), { passive: true });
    window.addEventListener('pointerup', () => setPressed(false), { passive: true });
    window.addEventListener('pointercancel', () => setPressed(false), { passive: true });
    window.addEventListener('hero-auth-state', event => { if (event.detail && event.detail.authorized) startScheduleListener(); else stopScheduleListener(); });
    window.addEventListener('hero-admin-authenticated', attachAdminControl);
    window.addEventListener('hero-admin-locked', () => { const card = document.getElementById('manoj-cursor-admin'); if (card) card.remove(); });
    if (finePointer.addEventListener) finePointer.addEventListener('change', syncCursor); else finePointer.addListener(syncCursor);
    document.addEventListener('DOMContentLoaded', () => {
        ensureCursor(); startScheduleListener(); setInterval(syncCursor, 60000);
    });
})();
