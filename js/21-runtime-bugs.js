// ================= AUTOMATIC BROWSER ERROR REPORTS =================
(function () {
    const bugsCol = () => db.collection('artifacts').doc(appId).collection('public').doc('data').collection('runtimeBugs');
    const seen = new Set();
    let consentReady = false;
    const queue = [];
    const maxPerSession = 6;

    function clean(value, max) { return String(value || '').replace(/[\u0000-\u001f\u007f]/g, ' ').slice(0, max); }
    function sourcePath(value) {
        try { return new URL(value, location.href).pathname.slice(0, 300); } catch (_) { return ''; }
    }
    function digest(s) {
        let h = 2166136261;
        for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
        return (h >>> 0).toString(36);
    }
    function prepare(type, message, stack, source, line, column) {
        if (!message || message === 'Script error.' || !consentReady) return;
        const msg = clean(message, 500), src = sourcePath(source), trace = clean(stack, 1800);
        const fingerprint = digest(`${type}|${msg}|${src}|${line || 0}`);
        if (seen.has(fingerprint)) return;
        seen.add(fingerprint);
        queue.push({ type, message: msg, stack: trace, source: src, line: Number(line) || 0, column: Number(column) || 0, fingerprint });
        flush();
    }
    async function flush() {
        if (!consentReady || !db || !userId || !queue.length) return;
        let count = Number(sessionStorage.getItem('hero_runtime_bug_count') || 0);
        while (queue.length && count < maxPerSession) {
            const bug = queue.shift(); count++;
            const p = location.pathname.slice(0, 200);
            try {
                await bugsCol().add({
                    ...bug, page: p, userId, deviceId: typeof deviceId === 'function' ? deviceId() : '',
                    appVersion: typeof SITE !== 'undefined' ? SITE.version : '', status: 'new',
                    createdAt: firebase.firestore.FieldValue.serverTimestamp()
                });
                sessionStorage.setItem('hero_runtime_bug_count', String(count));
            } catch (e) { console.warn('Automatic error report could not be saved:', e.code || e.message); }
        }
        if (queue.length) queue.length = 0;
    }

    window.addEventListener('error', e => prepare('exception', e.message || (e.error && e.error.message), e.error && e.error.stack, e.filename, e.lineno, e.colno));
    window.addEventListener('unhandledrejection', e => {
        const r = e.reason;
        prepare('rejection', r && r.message ? r.message : r, r && r.stack, '', 0, 0);
    });
    window.addEventListener('hero-consent-change', e => { consentReady = !!(e.detail && e.detail.consent === 'all'); if (consentReady) flush(); });
    window.addEventListener('hero-firebase-ready', () => { consentReady = typeof consent !== 'undefined' && consent === 'all'; flush(); });
    window.addEventListener('hero-auth-state', flush);

    let bugUnsub = null, bugDocs = [];
    const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
    function buildPanel() {
        const panel = document.getElementById('admin-panel');
        if (!panel || document.getElementById('runtime-bugs-panel')) return;
        const box = document.createElement('section'); box.id = 'runtime-bugs-panel'; box.dataset.atab = 'bugs';
        box.className = 'bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm p-5 mt-6';
        if (panel.dataset.active !== 'bugs') box.classList.add('atab-off');
        box.innerHTML = '<h3 class="font-bold text-lg">Automatic browser errors</h3><p class="text-xs text-slate-500 mt-1 mb-4">Collects uncaught JavaScript errors and unhandled promise rejections when a visitor accepts analytics. It cannot detect visual or logic problems by itself.</p><div id="runtime-bugs-list" class="space-y-3"></div>';
        panel.appendChild(box);
    }
    function setBugStatus(id, status) {
        return bugsCol().doc(id).update({ status, resolvedAt: status === 'resolved' ? firebase.firestore.FieldValue.serverTimestamp() : null }).catch(e => showToast(`Could not update bug (${e.code || 'error'}).`, 'error'));
    }
    function render() {
        const box = document.getElementById('runtime-bugs-list');
        if (!box) return;
        const profiles = window.__heroDeviceProfiles || {};
        const fresh = bugDocs.filter(b => b.status === 'new').length;
        const badge = document.getElementById('atb-bugs');
        if (badge) { badge.textContent = fresh ? String(fresh) : ''; badge.classList.toggle('hidden', !fresh); }
        box.innerHTML = bugDocs.length ? '' : '<p class="text-sm text-slate-500">No automatic errors reported yet.</p>';
        bugDocs.forEach(b => {
            const p = profiles[b.deviceId] || {};
            const card = document.createElement('article'); card.className = 'rounded-xl border border-slate-200 dark:border-slate-700 p-4';
            const identity = p.email ? `${p.name || 'Verified user'} | ${p.email}` : 'Anonymous browser';
            const heading = document.createElement('div'); heading.className = 'flex flex-wrap items-start justify-between gap-3';
            const details = document.createElement('div'); details.className = 'min-w-0 flex-1';
            const meta = document.createElement('p'); meta.className = 'text-xs text-slate-500'; meta.textContent = `${identity} | ${b.page || '/'} | ${b.appVersion || ''} | ${b.status || 'new'}`;
            const msg = document.createElement('p'); msg.className = 'font-mono text-sm mt-2 break-words'; msg.textContent = `${b.type}: ${b.message}`;
            const id = document.createElement('p'); id.className = 'font-mono text-[10px] text-slate-500 mt-1'; id.textContent = `${b.deviceId || 'no browser id'}${b.source ? ' | ' + b.source : ''}${b.line ? ':' + b.line : ''}`;
            details.append(meta, msg, id);
            const actions = document.createElement('div'); actions.className = 'flex flex-wrap gap-2';
            if (b.status !== 'resolved') {
                const resolve = document.createElement('button'); resolve.className = 'cm-btn go'; resolve.textContent = 'Mark resolved'; resolve.onclick = () => setBugStatus(b._id, 'resolved'); actions.appendChild(resolve);
            } else {
                const reopen = document.createElement('button'); reopen.className = 'cm-btn ghost'; reopen.textContent = 'Reopen'; reopen.onclick = () => setBugStatus(b._id, 'new'); actions.appendChild(reopen);
            }
            heading.append(details, actions); card.appendChild(heading);
            if (b.stack) { const disclosure = document.createElement('details'); disclosure.className = 'mt-3'; const summary = document.createElement('summary'); summary.className = 'cursor-pointer text-xs text-indigo-600'; summary.textContent = 'Stack trace'; const pre = document.createElement('pre'); pre.className = 'text-[10px] whitespace-pre-wrap break-all bg-slate-50 dark:bg-slate-900 rounded-lg p-3 mt-2'; pre.textContent = b.stack; disclosure.append(summary, pre); card.appendChild(disclosure); }
            box.appendChild(card);
        });
    }
    function startAdmin() {
        buildPanel();
        if (bugUnsub || !db) return;
        bugUnsub = bugsCol().orderBy('createdAt', 'desc').limit(100).onSnapshot(s => { bugDocs = s.docs.map(d => Object.assign({ _id: d.id }, d.data())); render(); }, e => {
            console.error('Runtime bug reports:', e);
            const box = document.getElementById('runtime-bugs-list'); if (box) box.textContent = `Could not load reports (${e.code || 'error'}). Publish the updated Firestore rules.`;
        });
    }
    window.renderRuntimeBugs = render;
    document.addEventListener('DOMContentLoaded', buildPanel);
    window.addEventListener('hero-admin-authenticated', startAdmin);
    window.addEventListener('hero-admin-locked', () => { if (bugUnsub) bugUnsub(); bugUnsub = null; bugDocs = []; render(); });
    window.addEventListener('hero-profiles-updated', render);
})();
