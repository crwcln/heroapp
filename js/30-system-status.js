        const SYS_GROUPS = ['Access', 'Firebase', 'Clio', 'Browser', 'Operations'];
        let sysChecks = [];
        let sysLoading = false;

        function sysWebChecks() {
            let webConfig = false;
            try {
                const config = JSON.parse(window.__firebase_config || '{}');
                webConfig = !!(config.apiKey && config.authDomain && config.projectId);
            } catch (_) {}
            const appReady = window.__heroFirebaseAppReady === true || (typeof firebase !== 'undefined' && firebase.apps && firebase.apps.length);
            return [
                { id: 'firebaseWeb', group: 'Firebase', label: 'Browser web config', ok: webConfig, detail: 'js/02-firebase-config.js', required: true },
                { id: 'firebaseApp', group: 'Browser', label: 'Firebase app', ok: !!appReady, detail: 'Client SDK initialization', required: true },
                { id: 'guestAuth', group: 'Browser', label: 'Guest session', ok: window.__heroAuthResolved === true, detail: 'Anonymous browser session', required: false },
                { id: 'launchClock', group: 'Operations', label: 'Launch schedule', ok: true, detail: window.__HERO_LAUNCH_AT__ ? 'Scheduled start is set' : 'Open now', required: false },
            ];
        }

        function sysState(check) {
            if (check.ok) return 'ok';
            return check.required === false ? 'optional' : 'missing';
        }

        function sysStateLabel(check) {
            return { ok: 'Ready', optional: 'Optional', missing: 'Missing' }[sysState(check)];
        }

        function sysRender(message) {
            const summary = document.getElementById('sys-summary');
            const list = document.getElementById('sys-groups');
            const note = document.getElementById('sys-status');
            const button = document.getElementById('sys-refresh');
            if (!summary || !list || !note) return;
            const required = sysChecks.filter(item => item.required !== false);
            const ready = required.filter(item => item.ok).length;
            summary.dataset.state = !sysChecks.length ? 'missing' : (ready === required.length ? 'ok' : 'missing');
            summary.textContent = message || (sysChecks.length ? `${ready} of ${required.length} required services ready` : 'No status checks available.');
            note.textContent = 'Server checks read configuration presence only. No keys or values are sent to the browser.';
            if (button) { button.disabled = sysLoading; button.textContent = sysLoading ? 'Checking…' : 'Refresh'; }
            list.replaceChildren();
            SYS_GROUPS.forEach(groupName => {
                const groupChecks = sysChecks.filter(item => item.group === groupName);
                if (!groupChecks.length) return;
                const group = document.createElement('section');
                group.className = 'sys-group';
                const heading = document.createElement('h4');
                heading.textContent = groupName;
                const rows = document.createElement('ul');
                rows.className = 'sys-list';
                groupChecks.forEach(check => {
                    const row = document.createElement('li');
                    row.className = 'sys-row';
                    row.dataset.state = sysState(check);
                    const dot = document.createElement('span');
                    dot.className = 'sys-dot';
                    dot.setAttribute('aria-hidden', 'true');
                    const copy = document.createElement('div');
                    const label = document.createElement('strong');
                    label.textContent = check.label;
                    const detail = document.createElement('small');
                    detail.textContent = check.detail;
                    copy.append(label, detail);
                    const state = document.createElement('span');
                    state.className = 'sys-state';
                    state.textContent = sysStateLabel(check);
                    row.append(dot, copy, state);
                    rows.appendChild(row);
                });
                group.append(heading, rows);
                list.appendChild(group);
            });
        }

        window.refreshSystemStatus = async function () {
            if (sysLoading) return;
            sysLoading = true;
            sysRender('Checking server configuration…');
            let server = null;
            try {
                const response = await fetch('/api/system-status', { credentials: 'same-origin', cache: 'no-store' });
                server = await response.json().catch(() => null);
                if (response.status === 401 || server?.error === 'unauthorized') {
                    sysChecks = sysWebChecks();
                    sysLoading = false;
                    sysRender('Steward session expired. Unlock again to view server status.');
                    return;
                }
                if (!response.ok || !server?.ok) throw new Error('status unavailable');
            } catch (_) {
                server = null;
            }
            sysChecks = [...(server?.checks || []), ...sysWebChecks()];
            sysLoading = false;
            sysRender(server ? null : 'Server checks unavailable. Browser checks are shown below.');
        };

        document.addEventListener('hero-admin-authenticated', () => {
            if (document.getElementById('admin-panel')?.dataset.active === 'status') refreshSystemStatus();
        });
        document.addEventListener('hero-admin-locked', () => { sysChecks = []; sysRender('Steward access is locked.'); });
        if (document.getElementById('admin-panel')?.dataset.active === 'status') refreshSystemStatus();
