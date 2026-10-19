// ================= ANALYTICS COLLECTION (anonymous: device class, page, mode) =================
        const anBase = () => db.collection('artifacts').doc(appId).collection('public').doc('data');
        const anOK = () => consent === 'all';
        const anDay = () => new Date().toISOString().slice(0, 10);
        let anBeatTimer = null, anVisibility = null, anSessionCounted = false;
        // Runtime-only ID keeps duplicated tabs from overwriting each other's live presence.
        const anTabId = (crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).slice(2) + Date.now().toString(36)).replace(/[^A-Za-z0-9]/g, '').slice(0, 20).padEnd(16, '0');
        let anPresenceRef = null;
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
            anPresenceRef = anBase().collection('presence').doc(userId + '__' + anTabId);
            anPresenceRef.set({ userId, deviceId: window.__heroDeviceId || '', lastSeen: firebase.firestore.FieldValue.serverTimestamp(), device: i.device, os: i.os, browser: i.browser, view: fbCurView, mode: yearMode, theme: prefs.theme, vw: innerWidth, vh: innerHeight }).catch(() => {});
        }
        function startAnalytics() {
            if (!anOK() || anBeatTimer) return;
            if (!anSessionCounted) { anSessionCounted = true; const i = devInfo(); track(['sessions', 'd_' + i.device, 'o_' + i.os, 'b_' + i.browser]); }
            beat(); anBeatTimer = setInterval(beat, 60000);
            anVisibility = () => { if (!document.hidden) beat(); };
            document.addEventListener('visibilitychange', anVisibility);
        }
        function stopAnalytics() { clearInterval(anBeatTimer); anBeatTimer = null; if (anVisibility) document.removeEventListener('visibilitychange', anVisibility); anVisibility = null; if (anPresenceRef) { anPresenceRef.delete().catch(() => {}); anPresenceRef = null; } }
        window.addEventListener('pagehide', () => { if (anPresenceRef) anPresenceRef.delete().catch(() => {}); });
        window.addEventListener('hero-consent-change', e => { if (e.detail && e.detail.consent === 'all') startAnalytics(); else stopAnalytics(); });
        const _sq = startQuiz;
        startQuiz = function (m) { _sq(m); if (activeQuizData && activeQuizData.length) track(['started', 'm_' + yearMode]); };
        const _eq = endQuizEarly;
        endQuizEarly = function () { const full = activeQuizData && solvedCount === activeQuizData.length; _eq(); track([full ? 'completed' : 'quit']); };

        // ================= ADMIN TABS =================
        const ATABS = [['quiz', 'Quiz', 'map-pin'], ['changelog', 'Changelog', 'scroll-text'], ['feedback', 'Feedback', 'inbox'], ['bugs', 'Bugs', 'bug'], ['analytics', 'Analytics', 'bar-chart-3'], ['global', 'Global', 'megaphone'], ['site', 'Site', 'sliders-horizontal']];
        function initAdminTabs() {
            const panel = document.getElementById('admin-panel');
            Object.entries({ 'admin-quiz-title': 'quiz', 'place-name-input': 'quiz', 'json-import-admin': 'quiz', 'custom-list': 'quiz', 'ai-prompt-text': 'quiz', 'cl-version': 'changelog', 'inbox-list': 'feedback', 'dev-card-locked': 'site', 'deploy-btn': 'site', 'visit-admin-count': 'site' })
                .forEach(([id, t]) => { document.getElementById(id).closest('[class*="rounded-2xl"]').dataset.atab = t; });
            const an = document.createElement('div');
            an.dataset.atab = 'analytics'; an.className = 'bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm p-5 space-y-4';
            an.innerHTML = '<div id="an-kpis" class="an-grid"></div><div class="an-box"><div class="an-box-head"><h4>Sessions, last 14 days</h4><button id="an-refresh" type="button" class="an-refresh" onclick="refreshAnalyticsAdmin()"><i data-lucide="refresh-cw"></i><span>Refresh</span></button></div><div id="an-chart" class="an-chart"></div></div><div id="an-split" class="an-grid" style="grid-template-columns:repeat(auto-fit,minmax(220px,1fr))"></div><div class="an-box"><h4>Live sessions</h4><div id="an-live" class="an-scroll"></div></div>';
            panel.appendChild(an);
            const global = document.createElement('section');
            global.dataset.atab = 'global'; global.className = 'bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm p-5 space-y-4';
            global.innerHTML = '<div><h3 class="text-lg font-bold">Global announcements</h3><p class="text-sm text-slate-500">Write one announcement for the Announcements page and site notice.</p></div><input id="ann-title" maxlength="100" placeholder="Announcement title" class="w-full p-3 border border-slate-300 dark:border-slate-600 rounded-lg bg-slate-50 dark:bg-slate-900 dark:text-white"><div class="ann-editor-wrap"><div class="ann-toolbar" role="toolbar" aria-label="Announcement formatting"><button type="button" data-ann-cmd="bold" title="Bold"><b>B</b></button><button type="button" data-ann-cmd="italic" title="Italic"><i>I</i></button><button type="button" data-ann-cmd="underline" title="Underline"><u>U</u></button><button type="button" data-ann-cmd="strikeThrough" title="Strikethrough"><s>S</s></button><span></span><button type="button" data-ann-cmd="insertUnorderedList" title="Bulleted list">• List</button><button type="button" data-ann-link="1" title="Add named link">↗ Link</button><button type="button" data-ann-image="1" title="Insert image by URL">▧ Image</button></div><div id="ann-body" class="ann-editor" contenteditable="true" role="textbox" aria-multiline="true" data-placeholder="Write your announcement…"></div></div><input id="ann-tags" maxlength="120" placeholder="Tags, separated by commas (optional)" class="w-full p-3 border border-slate-300 dark:border-slate-600 rounded-lg bg-slate-50 dark:bg-slate-900 dark:text-white"><div id="ann-preview-wrap" class="hidden"><h4 class="text-sm font-bold">Preview</h4><div id="ann-preview" class="ann-preview"></div></div><div class="flex gap-2"><button type="button" class="cm-btn" onclick="toggleAnnouncementPreview()">Preview</button><button onclick="postAnnouncement()" class="cm-btn go"><i data-lucide="send"></i> Post globally</button></div><div><h4 class="font-bold mb-2">Recent announcements</h4><div id="ann-admin-list" class="space-y-2 max-h-72 overflow-y-auto"></div></div>';
            global.querySelectorAll('[data-ann-cmd]').forEach(button => button.onclick = () => { document.getElementById('ann-body').focus(); document.execCommand(button.dataset.annCmd, false); });
            const annEsc = value => String(value).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
            global.querySelector('[data-ann-link]').onclick = () => { const url = prompt('Link URL (https://…)'); if (!url) return; const name = prompt('Link text to display:') || url; document.getElementById('ann-body').focus(); document.execCommand('insertHTML', false, '<a href="' + annEsc(url) + '">' + annEsc(name) + '</a>'); };
            global.querySelector('[data-ann-image]').onclick = () => { const url = prompt('Image URL (https://…)'); if (!url) return; const alt = prompt('Short image description:') || ''; document.getElementById('ann-body').focus(); document.execCommand('insertHTML', false, '<img src="' + annEsc(url) + '" alt="' + annEsc(alt) + '">'); };
            panel.appendChild(global);
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
            if (t === 'global' && window.startAnnouncements) startAnnouncements();
            if (t === 'bugs' && window.renderRuntimeBugs) window.renderRuntimeBugs();
        }

        // ================= ADMIN ANALYTICS (live) =================
        let anPresence = [], anDays = [], anUnsubs = [], anTimer = null, anErr = '';
        async function anFail(e) {
            console.error(e); let why = '';
            try {
                const t = auth && auth.currentUser ? await auth.currentUser.getIdTokenResult(true) : null;
                why = t && t.claims.admin
                    ? ' This browser has an admin token; check that the deployed Firestore rules include presence and analytics access for admins, and that this site uses the matching Firebase project.'
                    : ' This tab does not currently have an admin token. Unlock Admin in this tab again; a different tab’s login is not a reliable admin session here.';
            } catch (_) { why = ' Could not inspect the current Firebase sign-in. Unlock Admin in this tab again.'; }
            anErr = (e.code === 'permission-denied' ? 'Permission denied.' : 'Analytics failed: ' + (e.code || e.message)) + why; anRender();
        }
        const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
        function startAnalyticsAdmin() {
            stopAnalyticsAdmin(); anErr = '';
            anUnsubs.push(anBase().collection('presence').orderBy('lastSeen', 'desc').limit(300).onSnapshot(s => { anPresence = s.docs.map(d => d.data()); anRender(); }, anFail));
            anUnsubs.push(anBase().collection('analytics').orderBy('day', 'desc').limit(14).onSnapshot(s => { anDays = s.docs.map(d => d.data()); anRender(); }, anFail));
            anTimer = setInterval(anRender, 10000);
        }
        let anRefreshTimer = null;
        window.refreshAnalyticsAdmin = function () {
            const button = document.getElementById('an-refresh');
            if (!button || button.disabled) return;
            button.disabled = true; button.classList.add('is-refreshing');
            const label = button.querySelector('span'); if (label) label.textContent = 'Refreshing';
            startAnalyticsAdmin();
            clearTimeout(anRefreshTimer);
            anRefreshTimer = setTimeout(() => {
                button.disabled = false; button.classList.remove('is-refreshing');
                if (label) label.textContent = 'Refresh';
            }, 1200);
        };
        function stopAnalyticsAdmin() { anUnsubs.forEach(u => u()); anUnsubs = []; clearInterval(anTimer); anPresence = []; anDays = []; }
        window.addEventListener('hero-profiles-updated', () => anRender());
        const anLabel = k => ({ ios:'iOS', osx:'macOS', mac:'macOS', chromeos:'Chrome OS', twoyear:'2 Year', default:'1 Year' }[k] || String(k).replace(/[-_]+/g, ' ').replace(/\b\w/g, c => c.toUpperCase()));
        const anBars = entries => {
            const rows = entries.filter(([, value]) => Number.isFinite(Number(value)) && Number(value) >= 0);
            const max = Math.max(1, ...rows.map(([, value]) => Number(value)));
            return rows.length ? rows.map(([key, value], i) => {
                const n = Number(value), width = Math.max(n > 0 ? 2 : 0, Math.round(n / max * 100));
                return `<div class="an-bar" style="--bar-delay:${Math.min(i, 8) * 45}ms" title="${esc(anLabel(key))}: ${n.toLocaleString()}"><span>${esc(anLabel(key))}</span><div class="an-bar-track" role="meter" aria-label="${esc(anLabel(key))}" aria-valuemin="0" aria-valuemax="${max}" aria-valuenow="${n}"><i style="--bar-width:${width}%"></i></div><b>${n.toLocaleString()}</b></div>`;
            }).join('') : '<p class="fb-hint">No data yet</p>';
        };
        const anSum = (p) => { const o = {}; anDays.forEach(d => Object.keys(d).forEach(k => { if (k.startsWith(p) && typeof d[k] === 'number') o[k.slice(p.length)] = (o[k.slice(p.length)] || 0) + d[k]; })); return Object.entries(o).sort((a, b) => b[1] - a[1]); };
        const anCount = (arr, key) => { const o = {}; arr.forEach(p => { o[p[key]] = (o[p[key]] || 0) + 1; }); return Object.entries(o).sort((a, b) => b[1] - a[1]); };
        function anRender() {
            const panel = document.getElementById('admin-panel');
            if (!panel || panel.dataset.active !== 'analytics' || panel.classList.contains('hidden')) return;
            const msg = anErr || (!anUnsubs.length ? 'Waiting for the admin secure sign-in. If it failed, a toast explains why.' : '');
            if (msg) { document.getElementById('an-kpis').innerHTML = '<div class=\"an-box\" style=\"grid-column:1/-1;border-color:#f43f5e\"><h4>Analytics unavailable</h4><p class=\"text-sm\">' + esc(msg) + '</p></div>'; return; }
            const now = Date.now();
            const live = anPresence.filter(p => p.lastSeen && p.lastSeen.toMillis && now - p.lastSeen.toMillis() < 75000);
            const today = anDays.find(d => d.day === anDay()) || {};
            const tot = k => anDays.reduce((a, d) => a + (d[k] || 0), 0), started = tot('started'), done = tot('completed');
            const kpi = (label, val, dot) => `<div class="an-kpi"><small>${dot ? '<i class="an-dot"></i>' : ''}${label}</small><strong>${val}</strong></div>`;
            document.getElementById('an-kpis').innerHTML = kpi('Live now', live.length, true) + kpi('Sessions today', today.sessions || 0) + kpi('Sessions, 14 days', tot('sessions')) + kpi('Quizzes finished', started ? Math.round(done / started * 100) + '%' : '\u2013');
            const days = [...anDays].reverse(), max = Math.max(1, ...days.map(d => d.sessions || 0)), w = 34;
            document.getElementById('an-chart').innerHTML = days.length ? `<svg viewBox="0 0 ${days.length * w} 92" width="100%" style="max-height:170px"><defs><linearGradient id="anGrad" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="var(--brand-500)"/><stop offset="1" stop-color="var(--sec)"/></linearGradient></defs>${days.map((d, i) => { const h = Math.max(2, Math.round((d.sessions || 0) / max * 62)); return `<rect x="${i * w + 6}" y="${72 - h}" width="${w - 12}" height="${h}" rx="5"><title>${esc(d.day)}: ${d.sessions || 0}</title></rect><text x="${i * w + w / 2}" y="86" text-anchor="middle">${esc(d.day.slice(5))}</text>`; }).join('')}</svg>` : '<p class="fb-hint">No data yet</p>';
            document.getElementById('an-split').innerHTML = [['Devices (14d)', anSum('d_')], ['Operating systems (14d)', anSum('o_')], ['Browsers (14d)', anSum('b_')], ['Pages live now', anCount(live, 'view')], ['Year mode (quizzes, 14d)', anSum('m_')]].map(([t, e]) => `<div class="an-box"><h4>${t}</h4>${anBars(e)}</div>`).join('');
            const profiles = window.__heroDeviceProfiles || {};
            document.getElementById('an-live').innerHTML = live.length ? `<table class="an-table"><tr><th>Visitor</th><th>Device</th><th>OS</th><th>Browser</th><th>Current page</th><th>Mode</th><th>Viewport</th><th>Seen</th></tr>${live.slice(0, 30).map(p => { const profile = profiles[p.deviceId]; return `<tr><td>${profile ? esc(profile.name) : 'Guest'}</td><td>${esc(p.device)}</td><td>${esc(p.os)}</td><td>${esc(p.browser)}</td><td>${esc(String(p.view).replace('-view', ''))}</td><td>${p.mode === 'twoyear' ? '2 Year' : '1 Year'}</td><td>${esc(p.vw)}\u00d7${esc(p.vh)}</td><td>${Math.max(0, Math.round((now - p.lastSeen.toMillis()) / 1000))}s ago</td></tr>`; }).join('')}</table>` : '<p class="fb-hint">Nobody online right now.</p>';
        }
        initAdminTabs();
