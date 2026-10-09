// ================= SERVER AUTH =================
        let adminToken = null, lastAuthToken = null, lastAuthErr = '';
        const authFailMsg = () => lastAuthErr === 'not_configured' ? 'The login server has no password set. Add ADMIN_PASSWORD / DEV_PASSWORD in EdgeOne env vars, then redeploy.' : lastAuthErr === '404' ? 'Add edge-functions/api/auth.js and redeploy.' : 'Could not reach the login server.';
        async function checkPassword(target, password) {
            try {
                const r = await fetch('/api/auth', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ target, password })
                });
                if (r.status === 401) { if (target === 'admin') lastAuthErr = ''; return false; }
                if (!r.ok) { const er = await r.json().catch(() => ({})); const msg = er.error || String(r.status); if (target === 'admin') lastAuthErr = msg; return null; }
                const d = await r.json();
                if (target === 'admin') { lastAuthToken = d.token || null; lastAuthErr = ''; }
                return d.ok === true;
            } catch (err) { if (target === 'admin') lastAuthErr = 'network'; return null; }
        }

        // ================= CHANGELOG =================
        let clEntries = [], clEditing = null, clDirty = false, clChecked = false;
        const gs = () => db.collection('artifacts').doc(appId).collection('public').doc('data').collection('globalSettings');
        const clRef = () => gs().doc('changelog');
        const clToday = () => new Date(Date.now() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 10);
        const clSorted = () => [...clEntries].sort((a, b) => (b.date || '').localeCompare(a.date || ''));
        const clFmtDate = (s) => { const d = new Date(s + 'T00:00:00'); return isNaN(d) ? (s || '') : d.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' }); };
        const CL_TAGS = {
            Added: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300',
            Changed: 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300',
            Fixed: 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300',
            Removed: 'bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-300'
        };

        function loadChangelog() {
            if (!db || !userId) return;
            clRef().onSnapshot(doc => {
                if (!clDirty) clEntries = doc.exists ? (doc.data().entries || []) : [];
                renderChangelog();
                renderChangelogAdmin();
                if (!clDirty) maybeShowChangelogPopup();
            }, err => console.error('Changelog listener:', err));
        }

        function clNoteLine(t) {
            const li = document.createElement('li');
            li.className = 'flex items-start gap-2';
            const m = t.match(/^(Added|Changed|Fixed|Removed):\s*(.*)$/i);
            const txt = document.createElement('span');
            if (m) {
                const key = m[1][0].toUpperCase() + m[1].slice(1).toLowerCase();
                const b = document.createElement('span');
                b.className = 'shrink-0 mt-0.5 px-2 py-0.5 rounded-md text-[10px] font-extrabold uppercase tracking-wide ' + CL_TAGS[key];
                b.textContent = key;
                li.appendChild(b);
                txt.textContent = m[2];
            } else txt.textContent = t;
            li.appendChild(txt);
            return li;
        }

        function clBuildEntry(e, bare) {
            const card = document.createElement('div');
            if (!bare) card.className = 'p-5 rounded-2xl border bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700';
            const head = document.createElement('div');
            head.className = 'flex items-center justify-between mb-3';
            const v = document.createElement('span');
            v.className = 'font-extrabold text-lg text-indigo-600 dark:text-indigo-400';
            v.textContent = e.version || 'Update';
            const d = document.createElement('span');
            d.className = 'text-xs font-bold text-slate-500';
            d.textContent = clFmtDate(e.date);
            head.append(v, d);
            const ul = document.createElement('ul');
            ul.className = 'space-y-2 text-sm text-slate-600 dark:text-slate-300 font-medium';
            (e.notes || '').split('\n').map(s => s.trim()).filter(Boolean).forEach(t => ul.appendChild(clNoteLine(t)));
            card.append(head, ul);
            return card;
        }

        function renderChangelog() {
            const list = document.getElementById('changelog-list');
            list.innerHTML = '';
            if (!clEntries.length) {
                const p = document.createElement('p');
                p.className = 'text-center text-slate-500 italic py-8';
                p.textContent = 'No updates yet.';
                list.appendChild(p);
                return;
            }
            clSorted().forEach(e => list.appendChild(clBuildEntry(e, false)));
        }

        // Popup: once per new update (clEntries[0] is always the most recently added entry)
        function maybeShowChangelogPopup() {
            if (clChecked || !clEntries.length) return;
            if (siteDev && !devUnlocked()) return;
            clChecked = true;
            const latest = clEntries[0];
            if (localStorage.getItem('mq_lastSeenChangelog') === latest.id) return;
            const body = document.getElementById('changelog-popup-body');
            body.innerHTML = '';
            body.appendChild(clBuildEntry(latest, true));
            document.getElementById('changelog-popup').classList.remove('hidden');
        }
        function closeChangelogPopup(goToPage) {
            if (clEntries[0]) localStorage.setItem('mq_lastSeenChangelog', clEntries[0].id);
            document.getElementById('changelog-popup').classList.add('hidden');
            if (goToPage) switchView('changelog-view');
        }

        function renderChangelogAdmin() {
            document.getElementById('cl-dirty-note').classList.toggle('hidden', !clDirty);
            const list = document.getElementById('cl-admin-list');
            list.innerHTML = '';
            clSorted().forEach(e => {
                const row = document.createElement('div');
                row.className = 'flex justify-between items-center bg-white dark:bg-slate-900 p-3 rounded-xl border border-slate-200 dark:border-slate-700';
                const info = document.createElement('div');
                info.className = 'min-w-0';
                const t = document.createElement('div');
                t.className = 'font-bold text-sm text-slate-800 dark:text-white truncate';
                t.textContent = e.version || 'Update';
                const s = document.createElement('div');
                s.className = 'text-[10px] font-bold uppercase text-slate-500 mt-1';
                s.textContent = clFmtDate(e.date);
                info.append(t, s);
                const btns = document.createElement('div');
                btns.className = 'flex shrink-0';
                btns.innerHTML = `<button class="text-indigo-500 p-2 rounded-lg hover:bg-indigo-50 dark:hover:bg-indigo-900/30 transition-colors"><i data-lucide="pencil" class="w-4 h-4"></i></button>
                    <button class="text-rose-500 p-2 rounded-lg hover:bg-rose-50 dark:hover:bg-rose-900/30 transition-colors"><i data-lucide="trash-2" class="w-4 h-4"></i></button>`;
                btns.children[0].onclick = () => clEdit(e.id);
                btns.children[1].onclick = () => clDelete(e.id);
                row.append(info, btns);
                list.appendChild(row);
            });
            lucide.createIcons();
        }

        function clReset() {
            clEditing = null;
            document.getElementById('cl-version').value = '';
            document.getElementById('cl-notes').value = '';
            document.getElementById('cl-date').value = clToday();
            document.getElementById('cl-save-btn').innerText = 'Add Entry';
            document.getElementById('cl-cancel-btn').classList.add('hidden');
        }

        function clSaveEntry() {
            const version = document.getElementById('cl-version').value.trim();
            const date = document.getElementById('cl-date').value || clToday();
            const notes = document.getElementById('cl-notes').value.trim();
            if (!version || !notes) return showToast('Version and notes are required.', 'error');
            if (clEditing) {
                const e = clEntries.find(x => x.id === clEditing);
                if (e) Object.assign(e, { version, date, notes });
            } else {
                clEntries.unshift({ id: 'cl_' + Date.now(), version, date, notes });
            }
            clDirty = true;
            clReset();
            renderChangelogAdmin();
            renderChangelog();
            showToast('Entry staged. Click Publish Changelog to go live.', 'info');
        }

        function clEdit(id) {
            const e = clEntries.find(x => x.id === id);
            if (!e) return;
            clEditing = id;
            document.getElementById('cl-version').value = e.version || '';
            document.getElementById('cl-date').value = e.date || clToday();
            document.getElementById('cl-notes').value = e.notes || '';
            document.getElementById('cl-save-btn').innerText = 'Update Entry';
            document.getElementById('cl-cancel-btn').classList.remove('hidden');
        }

        async function clDelete(id) {
            if (!(await customConfirm({ title: 'Delete entry?', message: 'This changelog entry will be removed once you publish.', confirmText: 'Delete', danger: true }))) return;
            clEntries = clEntries.filter(x => x.id !== id);
            clDirty = true;
            if (clEditing === id) clReset();
            renderChangelogAdmin();
            renderChangelog();
        }

        function publishChangelog() {
            if (!db || !userId) return showToast('Cannot publish offline.', 'error');
            const btn = document.getElementById('cl-publish-btn');
            const orig = btn.innerHTML;
            btn.innerHTML = `<div class="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div> <span>Publishing...</span>`;
            btn.disabled = true;
            clRef().set({ entries: clEntries })
                .then(() => { clDirty = false; renderChangelogAdmin(); showToast('Changelog published!', 'success'); })
                .catch(err => { console.error(err); showToast(`Failed to publish (${err.code || 'error'}).`, 'error'); })
                .finally(() => { btn.innerHTML = orig; btn.disabled = false; lucide.createIcons(); });
        }

        function copyClPrompt() {
            const input = document.getElementById('cl-ai-prompt');
            input.select();
            input.setSelectionRange(0, 99999);
            try {
                navigator.clipboard.writeText(input.value).then(() => showToast('Prompt copied to clipboard!', 'success'))
                    .catch(() => { document.execCommand('copy'); showToast('Prompt copied! (Fallback)', 'success'); });
            } catch (err) { document.execCommand('copy'); showToast('Prompt copied! (Fallback)', 'success'); }
        }

        // ================= DEV MODE =================
        let siteDev = false;
        const devUnlocked = () => sessionStorage.getItem('mq_devUnlocked') === '1';
        const siteModeRef = () => gs().doc('siteMode');

        function loadSiteMode() {
            if (!db || !userId) return;
            siteModeRef().onSnapshot(doc => {
                siteDev = doc.exists && doc.data().dev === true;
                applyDevScreen();
            }, err => { console.error('Site mode listener:', err); hideCover(); });
        }
        function applyDevScreen() {
            const show = siteDev && !devUnlocked();
            document.getElementById('dev-screen').classList.toggle('hidden', !show);
            hideCover();
            renderDevCard();
            if (!show) maybeShowChangelogPopup();
        }
        function renderDevCard() {
            const open = devUnlocked();
            document.getElementById('dev-card-locked').classList.toggle('hidden', open);
            document.getElementById('dev-card-open').classList.toggle('hidden', !open);
            document.getElementById('dev-status').innerText = siteDev
                ? 'Dev mode is ON. Visitors see the under-construction screen.'
                : 'Dev mode is OFF. The site is open to everyone.';
            const btn = document.getElementById('dev-toggle-btn');
            btn.innerText = siteDev ? 'Disable Dev Mode' : 'Enable Dev Mode';
            btn.className = 'w-full text-white font-bold py-3 rounded-lg transition shadow ' + (siteDev ? 'bg-emerald-600 hover:bg-emerald-700' : 'bg-amber-600 hover:bg-amber-700');
        }
        async function devLogin(inputId) {
            const input = document.getElementById(inputId);
            if (!input.value) { showToast('Enter the password.', 'error'); return; }
            const ok = await checkPassword('dev', input.value);
            if (ok === true) {
                sessionStorage.setItem('mq_devUnlocked', '1');
                input.value = '';
                applyDevScreen();
            } else if (ok === false) { showToast('Incorrect password.', 'error'); badInput(input); }
            else showToast(authFailMsg(), 'error');
        }
        const unlockDevScreen = () => devLogin('dev-password');
        const unlockDevCard = () => devLogin('dev-card-password');

        async function toggleDevMode() {
            if (!db || !userId) return showToast('Cannot change mode offline.', 'error');
            const next = !siteDev;
            if (!(await customConfirm(next ? { title: 'Turn on dev mode?', message: 'All visitors will see the under-construction screen until you turn it off.', confirmText: 'Enable dev mode', danger: true } : { title: 'Turn off dev mode?', message: 'The site will reopen to everyone.', confirmText: 'Disable dev mode' }))) return;
            if (next) sessionStorage.setItem('mq_devUnlocked', '1');
            siteModeRef().set({ dev: next })
                .then(() => showToast(next ? 'Dev mode enabled.' : 'Dev mode disabled.', 'success'))
                .catch(err => { console.error(err); showToast(`Failed to update (${err.code || 'error'}).`, 'error'); });
        }

        // ================= VISITS =================
        const statsRef = () => gs().doc('stats');
        function loadVisits() {
            if (!db || !userId) return;
            statsRef().onSnapshot(doc => {
                const n = doc.exists ? (doc.data().visits || 0) : 0;
                animateNumber(document.getElementById('visit-count'), n, 1200);
            }, err => console.error('Visits listener:', err));
        }
        function countVisit() {
            if (!db || !userId || sessionStorage.getItem('mq_counted')) return;
            statsRef().set({ visits: firebase.firestore.FieldValue.increment(1) }, { merge: true })
                .then(() => { if (window.showToast && location.search.includes('debug')) showToast('Visit counted.', 'info'); })
                .catch(err => { console.error('Visit count failed:', err.code || err.message); sessionStorage.removeItem('mq_counted'); });
        }
        // hide the counter over the quiz map
        const _origSwitchView = switchView;
        switchView = function (id) {
            _origSwitchView(id);
            document.getElementById('visit-counter').classList.toggle('hidden', id === 'quiz-view');
            document.body.classList.toggle('in-quiz', id === 'quiz-view');
            if (id === 'feedback-view') fbPrevView = fbCurView;
            fbCurView = id;
            document.querySelectorAll('#nav-actions button[onclick^="switchView"]').forEach(b => b.classList.toggle('nav-active', b.getAttribute('onclick').includes("'" + id + "'")));
            document.querySelectorAll('#mobile-tabbar button').forEach(b => b.classList.toggle('active', b.dataset.tab === id));
        };

        // ================= BOOT COVER =================
        function hideCover() {
            const c = document.getElementById('site-cover');
            if (c && !c.classList.contains('fade')) { setTimeout(() => { c.classList.add('fade'); setTimeout(() => c.classList.add('hidden'), 420); }, Math.max(0, 3400 - performance.now())); }
        }
        // A browser already unlocked for dev has nothing to wait for; otherwise fail open after 6s if Firestore is unreachable.
        if (devUnlocked()) hideCover();
        setTimeout(hideCover, 6000);

        // ================= REDEPLOY =================
        let deployBusy = false, deployCooldownTimer = null;
        function renderDeployLast() {
            const t = Number(localStorage.getItem('mq_lastDeploy'));
            document.getElementById('deploy-last').innerText = t ? new Date(t).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }) : 'Never';
        }
        function setDefaultDeployMessage() {
            const input = document.getElementById('deploy-message');
            if (input && !input.value.trim() && typeof SITE !== 'undefined' && SITE.version) input.value = `v${SITE.version}`;
        }
        function setDeployBtn(busy, label) {
            const btn = document.getElementById('deploy-btn');
            btn.disabled = busy;
            document.getElementById('deploy-spin').classList.toggle('hidden', busy !== 'spin');
            document.getElementById('deploy-icon').classList.toggle('hidden', busy === 'spin');
            document.getElementById('deploy-btn-label').innerText = label;
        }
        function setDeployStatus(message, error = false) {
            const status = document.getElementById('deploy-status');
            if (!status) return;
            status.textContent = message;
            status.classList.toggle('text-rose-600', error);
            status.classList.toggle('text-emerald-600', !error);
        }
        function startDeployCooldown(sec) {
            let left = sec;
            clearInterval(deployCooldownTimer);
            setDeployBtn(true, `Redeploy again in ${left}s`);
            deployCooldownTimer = setInterval(() => {
                left--;
                if (left <= 0) { clearInterval(deployCooldownTimer); setDeployBtn(false, 'Redeploy Site'); }
                else setDeployBtn(true, `Redeploy again in ${left}s`);
            }, 1000);
        }
        async function triggerRedeploy() {
            if (deployBusy) return;
            if (!adminToken) {
                const error = new Error('Admin session is missing or expired. Sign in to the Steward panel again.');
                console.error('Redeploy failed:', error); setDeployStatus(error.message, true); showToast(error.message, 'error'); return;
            }
            const message = document.getElementById('deploy-message')?.value.trim() || '';
            if (!message || message.length > 120 || /[\r\n]/.test(message)) {
                const error = new Error('Enter a commit message (up to 120 characters).');
                setDeployStatus(error.message, true); showToast(error.message, 'error'); return;
            }
            if (!(await customConfirm({ title: 'Create commit and redeploy?', message: `A new commit will be created on the deployment branch. Commit message: ${message}`, confirmText: 'Create and redeploy' }))) return;
            deployBusy = true;
            setDeployBtn('spin', 'Creating commit...');
            setDeployStatus('Creating the GitHub commit and requesting an EdgeOne build...');
            let cooldown = false;
            try {
                const r = await fetch('/api/deploy', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ token: adminToken, message })
                });
                const d = await r.json().catch(() => ({}));
                if (r.status === 401) {
                    lockAdmin();
                    throw new Error('Admin session expired. Please sign in again.');
                }
                if (!r.ok) {
                    let messageText;
                    if (d.commitCreated) {
                        localStorage.setItem('mq_lastDeploy', String(Date.now())); renderDeployLast();
                        messageText = `Commit ${d.commitSha?.slice(0, 7) || 'created'}, but EdgeOne did not accept the build request. Check DEPLOY_WEBHOOK_URL.`;
                    } else {
                        messageText = {
                            not_configured: `Missing EdgeOne environment variable${d.missing?.length === 1 ? '' : 's'}: ${(d.missing || ['ADMIN_PASSWORD', 'DEPLOY_WEBHOOK_URL', 'GITHUB_TOKEN']).join(', ')}.`,
                            invalid_deploy_config: 'Check GITHUB_REPOSITORY and DEPLOY_BRANCH in EdgeOne environment variables.',
                            invalid_message: 'Enter a commit message up to 120 characters.',
                            github_failed: d.status === 403 ? 'GitHub denied the commit. Check that GITHUB_TOKEN can write repository contents and that the branch allows updates.' : `Could not create the GitHub commit (HTTP ${d.status || r.status}). Check GITHUB_TOKEN, GITHUB_REPOSITORY, and DEPLOY_BRANCH.`,
                            hook_failed: `The commit was created, but EdgeOne rejected the build trigger (HTTP ${d.status}). Check DEPLOY_WEBHOOK_URL.`,
                            hook_unreachable: 'The commit was created, but the EdgeOne build trigger could not be reached.'
                        }[d.error] || (r.status === 404 ? 'Add edge-functions/api/deploy.js and redeploy.' : `Redeploy request failed (HTTP ${r.status}).`);
                    }
                    throw new Error(messageText);
                }
                localStorage.setItem('mq_lastDeploy', String(Date.now()));
                renderDeployLast();
                const commitLabel = d.commitSha?.slice(0, 7) || 'new commit';
                setDeployStatus(`Commit ${commitLabel} created. EdgeOne accepted the build request; check Build & Deploy for the final build result.`);
                showToast(`Commit created (${commitLabel}); build request accepted.`, 'success');
                cooldown = true;
            } catch (err) {
                const error = err instanceof TypeError
                    ? new Error('Could not reach /api/deploy. Check the site connection and confirm the EdgeOne function is deployed.')
                    : err instanceof Error ? err : new Error('Redeploy failed. Check the EdgeOne deployment settings.');
                console.error('Redeploy failed:', error);
                setDeployStatus(error.message, true);
                showToast(error.message, 'error');
            } finally {
                deployBusy = false;
                if (cooldown) startDeployCooldown(30); else setDeployBtn(false, 'Redeploy Site');
            }
        }

        clReset();
        renderChangelog();
        renderDevCard();
        setDefaultDeployMessage();
        renderDeployLast();

        // ================= MOBILE =================
        const isMobile = () => document.documentElement.classList.contains('is-mobile');
        // Keep the tapped marker in the upper part of the screen so its popup (and answer list) stays clear of the on-screen keyboard.
        function mobileCenterMarker(marker) {
            if (!isMobile()) return;
            setTimeout(() => {
                if (!map) return;
                const size = map.getSize();
                const pt = map.latLngToContainerPoint(marker.getLatLng());
                const dy = pt.y - Math.max(230, size.y * 0.4);
                if (Math.abs(dy) > 8) map.panBy([0, dy], { animate: true, duration: 0.3 });
            }, 400);
        }
        document.querySelector('#mobile-tabbar button[data-tab="home-view"]').classList.add('active');
