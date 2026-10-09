// ================= ANALYTICS COLLECTION (anonymous: device class, page, mode) =================
        const anBase = () => db.collection('artifacts').doc(appId).collection('public').doc('data');
        const anOK = () => consent === 'all';
        const anDay = () => new Date().toISOString().slice(0, 10);
        let anBeatTimer = null, anVisibility = null;
        function devInfo() {
            const ua = navigator.userAgent, touch = navigator.maxTouchPoints > 1;
            const tablet = /iPad|Tablet/i.test(ua) || (/Macintosh/.test(ua) && touch) || (/Android/i.test(ua) && !/Mobile/i.test(ua));
            const mobile = document.documentElement.classList.contains('is-mobile') && !tablet;
            const os = /iPhone|iPad|iPod/.test(ua) || (/Macintosh/.test(ua) && touch) ? 'ios' : /Android/.test(ua) ? 'android' : /Windows/.test(ua) ? 'windows' : /CrOS/.test(ua) ? 'chromeos' : /Mac/.test(ua) ? 'mac' : /Linux/.test(ua) ? 'linux' : 'other';
            const browser = /Edg\//.test(ua) ? 'edge' : /OPR\/|Opera/.test(ua) ? 'opera' : /SamsungBrowser/.test(ua) ? 'samsung' : /Firefox|FxiOS/.test(ua) ? 'firefox' : /Chrome|CriOS/.test(ua) ? 'chrome' : /Safari/.test(ua) ? 'safari' : 'other';
            return { device: tablet ? 'tablet' : mobile ? 'mobile' : 'desktop', os, browser };
        }
        function track(fields) {
            if (!db || !userId || !anOK()) return;
            const o = { day: anDay() };
            fields.forEach(f => { o[f] = firebase.firestore.FieldValue.increment(1); });
            anBase().collection('analytics').doc('d_' + anDay()).set(o, { merge: true }).catch(() => {});
        }
        function beat() {
            if (!db || !userId || !anOK() || document.hidden) return;
            const i = devInfo();
            anBase().collection('presence').doc(userId).set({ lastSeen: firebase.firestore.FieldValue.serverTimestamp(), device: i.device, os: i.os, browser: i.browser, view: fbCurView, mode: yearMode, theme: prefs.theme, vw: innerWidth, vh: innerHeight }).catch(() => {});
        }
        function startAnalytics() {
            if (!anOK() || anBeatTimer) return;
            if (!sessionStorage.getItem('mq_an')) { sessionStorage.setItem('mq_an', '1'); const i = devInfo(); track(['sessions', 'd_' + i.device, 'o_' + i.os, 'b_' + i.browser]); }
            beat(); anBeatTimer = setInterval(beat, 60000);
            anVisibility = () => { if (!document.hidden) beat(); };
            document.addEventListener('visibilitychange', anVisibility);
        }
        function stopAnalytics() { clearInterval(anBeatTimer); anBeatTimer = null; if (anVisibility) document.removeEventListener('visibilitychange', anVisibility); anVisibility = null; }
        window.addEventListener('hero-consent-change', e => { if (e.detail && e.detail.consent === 'all') startAnalytics(); else stopAnalytics(); });
        const _sq = startQuiz;
        startQuiz = function (m) { _sq(m); if (activeQuizData && activeQuizData.length) track(['started', 'm_' + yearMode]); };
        const _eq = endQuizEarly;
        endQuizEarly = function () { const full = activeQuizData && solvedCount === activeQuizData.length; _eq(); track([full ? 'completed' : 'quit']); };

        // ================= ADMIN TABS =================
        const ATABS = [['quiz', 'Quiz', 'map-pin'], ['changelog', 'Changelog', 'scroll-text'], ['feedback', 'Feedback', 'inbox'], ['bugs', 'Bugs', 'bug'], ['analytics', 'Analytics', 'bar-chart-3'], ['site', 'Site', 'sliders-horizontal']];
        function initAdminTabs() {
            const panel = document.getElementById('admin-panel');
            Object.entries({ 'admin-quiz-title': 'quiz', 'place-name-input': 'quiz', 'json-import-admin': 'quiz', 'custom-list': 'quiz', 'ai-prompt-text': 'quiz', 'cl-version': 'changelog', 'inbox-list': 'feedback', 'dev-card-locked': 'site', 'deploy-btn': 'site' })
                .forEach(([id, t]) => { document.getElementById(id).closest('[class*="rounded-2xl"]').dataset.atab = t; });
            const an = document.createElement('div');
            an.dataset.atab = 'analytics'; an.className = 'bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm p-5 space-y-4';
            an.innerHTML = '<div id="an-kpis" class="an-grid"></div><div class="an-box"><h4>Sessions, last 14 days</h4><div id="an-chart" class="an-chart"></div></div><div id="an-split" class="an-grid" style="grid-template-columns:repeat(auto-fit,minmax(220px,1fr))"></div><div class="an-box"><h4>Live sessions</h4><div id="an-live" class="an-scroll"></div></div>';
            panel.appendChild(an);
            const nav = document.createElement('div');
            nav.id = 'admin-tabs';
            nav.innerHTML = ATABS.map(([k, l, i]) => `<button data-t="${k}" onclick="setAdminTab('${k}')"><i data-lucide="${i}"></i><span>${l}</span><b id="atb-${k}" class="hidden"></b></button>`).join('');
            panel.insertBefore(nav, panel.children[1]);
            lucide.createIcons();
            setAdminTab(sessionStorage.getItem('mq_atab') || 'quiz');
        }
        function setAdminTab(t) {
            const panel = document.getElementById('admin-panel');
            panel.dataset.active = t; sessionStorage.setItem('mq_atab', t);
            document.querySelectorAll('#admin-tabs button').forEach(b => b.classList.toggle('on', b.dataset.t === t));
            panel.querySelectorAll('[data-atab]').forEach(c => c.classList.toggle('atab-off', c.dataset.atab !== t));
            if (t === 'analytics') anRender();
            if (t === 'bugs' && window.renderRuntimeBugs) window.renderRuntimeBugs();
        }

        // ================= ADMIN ANALYTICS (live) =================
        let anPresence = [], anDays = [], anUnsubs = [], anTimer = null, anErr = '';
        async function anFail(e) {
            console.error(e); let why = '';
            try { const t = await auth.currentUser.getIdTokenResult(true); why = t.claims.admin ? ' Admin sign-in is fine, so publish firestore.rules (the presence and analytics blocks).' : ' You are not signed in as admin: secure sign-in failed, so fix /api/firebase-token first.'; } catch (_) { /* ignore */ }
            anErr = (e.code === 'permission-denied' ? 'Permission denied.' : 'Analytics failed: ' + (e.code || e.message)) + why; anRender();
        }
        const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
        function startAnalyticsAdmin() {
            stopAnalyticsAdmin(); anErr = '';
            anUnsubs.push(anBase().collection('presence').orderBy('lastSeen', 'desc').limit(300).onSnapshot(s => { anPresence = s.docs.map(d => d.data()); anRender(); }, anFail));
            anUnsubs.push(anBase().collection('analytics').orderBy('day', 'desc').limit(14).onSnapshot(s => { anDays = s.docs.map(d => d.data()); anRender(); }, anFail));
            anTimer = setInterval(anRender, 10000);
        }
        function stopAnalyticsAdmin() { anUnsubs.forEach(u => u()); anUnsubs = []; clearInterval(anTimer); anPresence = []; anDays = []; }
        const anBars = (entries) => { const max = Math.max(1, ...entries.map(e => e[1])); return entries.length ? entries.map(([k, v]) => `<div class="an-bar"><span>${esc(k)}</span><div><i style="width:${Math.round(v / max * 100)}%"></i></div><b>${v}</b></div>`).join('') : '<p class="fb-hint">No data yet</p>'; };
        const anSum = (p) => { const o = {}; anDays.forEach(d => Object.keys(d).forEach(k => { if (k.startsWith(p) && typeof d[k] === 'number') o[k.slice(p.length)] = (o[k.slice(p.length)] || 0) + d[k]; })); return Object.entries(o).sort((a, b) => b[1] - a[1]); };
        const anCount = (arr, key) => { const o = {}; arr.forEach(p => { o[p[key]] = (o[p[key]] || 0) + 1; }); return Object.entries(o).sort((a, b) => b[1] - a[1]); };
        function anRender() {
            const panel = document.getElementById('admin-panel');
            if (panel.dataset.active !== 'analytics' || panel.classList.contains('hidden')) return;
            const msg = anErr || (!anUnsubs.length ? 'Waiting for the admin secure sign-in. If it failed, a toast explains why.' : '');
            if (msg) { document.getElementById('an-kpis').innerHTML = '<div class=\"an-box\" style=\"grid-column:1/-1;border-color:#f43f5e\"><h4>Analytics unavailable</h4><p class=\"text-sm\">' + esc(msg) + '</p></div>'; return; }
            const now = Date.now();
            const live = anPresence.filter(p => p.lastSeen && p.lastSeen.toMillis && now - p.lastSeen.toMillis() < 150000);
            const today = anDays.find(d => d.day === anDay()) || {};
            const tot = k => anDays.reduce((a, d) => a + (d[k] || 0), 0), started = tot('started'), done = tot('completed');
            const kpi = (label, val, dot) => `<div class="an-kpi"><small>${dot ? '<i class="an-dot"></i>' : ''}${label}</small><strong>${val}</strong></div>`;
            document.getElementById('an-kpis').innerHTML = kpi('Live now', live.length, true) + kpi('Sessions today', today.sessions || 0) + kpi('Sessions, 14 days', tot('sessions')) + kpi('Quizzes finished', started ? Math.round(done / started * 100) + '%' : '\u2013');
            const days = [...anDays].reverse(), max = Math.max(1, ...days.map(d => d.sessions || 0)), w = 34;
            document.getElementById('an-chart').innerHTML = days.length ? `<svg viewBox="0 0 ${days.length * w} 92" width="100%" style="max-height:170px"><defs><linearGradient id="anGrad" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="var(--brand-500)"/><stop offset="1" stop-color="var(--sec)"/></linearGradient></defs>${days.map((d, i) => { const h = Math.max(2, Math.round((d.sessions || 0) / max * 62)); return `<rect x="${i * w + 6}" y="${72 - h}" width="${w - 12}" height="${h}" rx="5"><title>${esc(d.day)}: ${d.sessions || 0}</title></rect><text x="${i * w + w / 2}" y="86" text-anchor="middle">${esc(d.day.slice(5))}</text>`; }).join('')}</svg>` : '<p class="fb-hint">No data yet</p>';
            document.getElementById('an-split').innerHTML = [['Devices (14d)', anSum('d_')], ['Operating systems (14d)', anSum('o_')], ['Browsers (14d)', anSum('b_')], ['Pages live now', anCount(live, 'view')], ['Year mode (quizzes, 14d)', anSum('m_')]].map(([t, e]) => `<div class="an-box"><h4>${t}</h4>${anBars(e)}</div>`).join('');
            document.getElementById('an-live').innerHTML = live.length ? `<table class="an-table"><tr><th>Device</th><th>OS</th><th>Browser</th><th>Page</th><th>Mode</th><th>Screen</th><th>Seen</th></tr>${live.slice(0, 30).map(p => `<tr><td>${esc(p.device)}</td><td>${esc(p.os)}</td><td>${esc(p.browser)}</td><td>${esc(String(p.view).replace('-view', ''))}</td><td>${p.mode === 'twoyear' ? '2 Year' : '1 Year'}</td><td>${esc(p.vw)}\u00d7${esc(p.vh)}</td><td>${Math.max(0, Math.round((now - p.lastSeen.toMillis()) / 1000))}s ago</td></tr>`).join('')}</table>` : '<p class="fb-hint">Nobody online right now.</p>';
        }
        initAdminTabs();
