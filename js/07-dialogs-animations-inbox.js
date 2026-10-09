// ================= CUSTOM CONFIRM =================
        let _cmResolve = null;
        function customConfirm(opts) {
            const o = Object.assign({ title: 'Are you sure?', message: '', confirmText: 'Confirm', cancelText: 'Cancel', danger: false }, typeof opts === 'string' ? { message: opts } : opts);
            return new Promise(resolve => {
                if (_cmResolve) _cmResolve(false);
                _cmResolve = resolve;
                document.getElementById('cm-title').innerText = o.title;
                document.getElementById('cm-msg').innerText = o.message;
                document.getElementById('cm-cancel').innerText = o.cancelText;
                const ok = document.getElementById('cm-ok');
                ok.innerText = o.confirmText;
                ok.classList.toggle('danger', o.danger);
                document.getElementById('cm-icon').classList.toggle('danger', o.danger);
                document.getElementById('confirm-modal').classList.add('open');
                setTimeout(() => ok.focus(), 60);
            });
        }
        function _cmClose(v) {
            document.getElementById('confirm-modal').classList.remove('open');
            const r = _cmResolve; _cmResolve = null;
            if (r) r(v);
        }
        document.getElementById('confirm-modal').addEventListener('click', e => { if (e.target.id === 'confirm-modal') _cmClose(false); });
        document.addEventListener('keydown', e => {
            if (document.getElementById('lightbox').classList.contains('open') && e.key === 'Escape') closeLightbox();
            if (!document.getElementById('confirm-modal').classList.contains('open')) return;
            if (e.key === 'Escape') _cmClose(false);
            else if (e.key === 'Enter') { e.preventDefault(); _cmClose(document.activeElement !== document.getElementById('cm-cancel')); }
        });
        function openLightbox(url) { document.getElementById('lightbox-img').src = url; document.getElementById('lightbox').classList.add('open'); }
        function closeLightbox() { document.getElementById('lightbox').classList.remove('open'); }

        // ================= ANIMATION HELPERS =================
        function animateNumber(el, to, dur = 900) {
            const from = Number(String(el.textContent).replace(/[^\d.-]/g, '')) || 0;
            cancelAnimationFrame(el._raf);
            if (window.matchMedia('(prefers-reduced-motion: reduce)').matches || from === to) { el.textContent = Number(to).toLocaleString(); return; }
            const t0 = performance.now();
            const tick = (t) => {
                const p = Math.min(1, (t - t0) / dur), e = 1 - Math.pow(1 - p, 3);
                el.textContent = Math.round(from + (to - from) * e).toLocaleString();
                if (p < 1) el._raf = requestAnimationFrame(tick);
            };
            el._raf = requestAnimationFrame(tick);
        }
        ['q-score', 'q-solved'].forEach(id => {
            const el = document.getElementById(id);
            new MutationObserver(() => { el.classList.remove('pop'); void el.offsetWidth; el.classList.add('pop'); }).observe(el, { childList: true, characterData: true, subtree: true });
        });
        const _endQuiz = endQuizEarly;
        endQuizEarly = function () {
            _endQuiz();
            const el = document.getElementById('sum-final-score');
            el.textContent = '0';
            animateNumber(el, finalScore, 1400);
        };

        // ================= ADMIN SECURE SESSION =================
        function secureMsg(e) {
            const d = e.d || {}, c = e.code || e.message;
            if (c === 'not_configured') return `Secure sign-in is missing env vars: ${(d.missing || []).join(', ') || 'FIREBASE_CLIENT_EMAIL, FIREBASE_PRIVATE_KEY_1..N'}. Add them, then redeploy.`;
            if (c === 'sign_failed') return `The Firebase private key couldn't be read (${d.detail || 'check the chunks'}). Re-split it with the one-liner.`;
            if (c === 'unauthorized') return 'The admin session was rejected. auth.js and firebase-token.js must share the same ADMIN_PASSWORD; log in again.';
            if (c === '404') return 'Add edge-functions/api/firebase-token.js and redeploy.';
            if (c === 'project_mismatch') return `Wrong service account: this site uses Firebase project "${d.expected}" but your FIREBASE_CLIENT_EMAIL belongs to "${d.got}". Generate a new private key in "${d.expected}" and update the FIREBASE_* env vars.`;
            if (String(c).startsWith('auth/')) return `Firebase rejected the token (${c}). The service account must belong to project ${firebase.app().options.projectId}; regenerate its key and update the FIREBASE_* env vars.`;
            return `Secure sign-in failed (${c}). Open /api/firebase-token in a browser to check your setup.`;
        }
        let adminLockTimer = null;
        function onAdminUnlocked() {
            clearTimeout(adminLockTimer);
            const exp = Number(String(adminToken).split('.')[0]);
            if (exp) adminLockTimer = setTimeout(() => lockAdmin('Admin session expired. Please log in again.'), Math.max(0, exp - Date.now()));
            adminSecureSignIn();
        }
        async function adminSecureSignIn() {
            try {
                const r = await fetch('/api/firebase-token', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ token: adminToken, projectId: firebase.app().options.projectId }) });
                const d = await r.json().catch(() => ({}));
                if (!r.ok || !d.customToken) { const err = new Error(d.error || r.status); err.d = d; throw err; }
                await auth.signInWithCustomToken(d.customToken);
                startInbox(); startAnalyticsAdmin();
                window.dispatchEvent(new Event('hero-admin-authenticated'));
            } catch (e) {
                console.error('Secure sign-in failed:', e);
                document.getElementById('inbox-sub').innerText = 'Secure sign-in failed';
                showToast(secureMsg(e), 'error'); document.getElementById('inbox-sub').innerText = 'Secure sign-in failed';
            }
        }
        // Firebase auth persistence is shared by tabs. If another tab signs out, restore
        // this tab's still-valid admin session.
        let adminRepairInFlight = false;
        window.addEventListener('hero-auth-state', async e => {
            if (!adminToken || !e.detail || !e.detail.user || adminRepairInFlight) return;
            try {
                const token = await e.detail.user.getIdTokenResult();
                if (token.claims.admin === true) return;
                adminRepairInFlight = true;
                await adminSecureSignIn();
            } catch (err) {
                console.warn('Could not restore this tab’s admin session:', err);
            } finally { adminRepairInFlight = false; }
        });
        async function lockAdmin(msg) {
            const wasAdmin = !!adminToken;
            adminToken = null;
            clearTimeout(adminLockTimer);
            stopInbox(); stopAnalyticsAdmin();
            document.getElementById('admin-panel').classList.add('hidden');
            document.getElementById('admin-lock').classList.remove('hidden');
            if (wasAdmin) { try { await auth.signOut(); } catch (e) { /* ignore */ } }
            window.dispatchEvent(new Event('hero-admin-locked'));
            if (msg) showToast(msg, wasAdmin ? 'info' : 'error');
        }

        // ================= FEEDBACK INBOX =================
        const fbCol = () => db.collection('artifacts').doc(appId).collection('public').doc('data').collection('feedback');
        let inboxUnsub = null, inboxDocs = [];
        const inboxOpen = new Set();
        const IB_TYPE = { bug: 'Bug', location: 'Location', feature: 'Feature', general: 'General', other: 'Other' };
        const IB_NEXT = { new: [['Mark reviewed', 'reviewed'], ['Mark resolved', 'resolved']], reviewed: [['Mark resolved', 'resolved'], ['Reopen', 'new']], resolved: [['Reopen', 'new']] };

        function startInbox() {
            stopInbox();
            inboxUnsub = fbCol().orderBy('createdAt', 'desc').limit(100).onSnapshot(snap => {
                inboxDocs = snap.docs.map(d => Object.assign({ _id: d.id }, d.data()));
                renderInbox();
            }, err => {
                console.error('Inbox:', err);
                document.getElementById('inbox-sub').innerText = `Could not load feedback (${err.code || 'error'})`;
            });
        }
        function stopInbox() {
            if (inboxUnsub) { inboxUnsub(); inboxUnsub = null; }
            inboxDocs = [];
            renderInbox();
            document.getElementById('inbox-sub').innerText = 'Waiting for secure sign-in...';
        }
        function timeAgo(d) {
            const s = Math.floor((Date.now() - d.getTime()) / 1000);
            if (s < 60) return 'just now';
            const m = Math.floor(s / 60); if (m < 60) return m + 'm ago';
            const h = Math.floor(m / 60); if (h < 24) return h + 'h ago';
            const dd = Math.floor(h / 24); return dd < 30 ? dd + 'd ago' : d.toLocaleDateString();
        }
        function ibEl(tag, cls, text) { const e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; }
        function ibSection(title, node) { const s = ibEl('div', 'ib-sec'); s.append(ibEl('h4', '', title), node); return s; }

        function renderInbox() {
            const list = document.getElementById('inbox-list');
            list.innerHTML = '';
            if (!inboxUnsub) { list.appendChild(ibEl('p', 'text-center text-slate-500 italic py-8', 'The inbox opens after you log in to the admin panel.')); return; }
            const st = document.getElementById('inbox-status').value, ty = document.getElementById('inbox-type').value;
            const items = inboxDocs.filter(d => (st === 'all' || d.status === st) && (ty === 'all' || d.type === ty));
            const fresh = inboxDocs.filter(d => d.status === 'new').length;
            document.getElementById('inbox-sub').innerText = `${inboxDocs.length} total \u00b7 ${fresh} new`;
            { const b = document.getElementById('atb-feedback'); if (b) { b.textContent = fresh; b.classList.toggle('hidden', !fresh); } }
            if (!items.length) { list.appendChild(ibEl('p', 'text-center text-slate-500 italic py-8', inboxDocs.length ? 'No feedback matches these filters.' : 'No feedback yet.')); return; }
            items.forEach(d => list.appendChild(ibCard(d)));
        }

        function ibCard(d) {
            const card = ibEl('div', 'ib-card' + (inboxOpen.has(d._id) ? ' open' : ''));
            const head = ibEl('div', 'ib-head');
            head.append(ibEl('span', 'ib ib-' + (d.status || 'new'), d.status || 'new'), ibEl('span', 'ib-title', d.title || '(no title)'), ibEl('span', 'ib ib-' + d.type, IB_TYPE[d.type] || d.type));
            if (d.severity) head.appendChild(ibEl('span', 'ib ib-' + d.severity, d.severity));
            const when = d.createdAt && d.createdAt.toDate ? d.createdAt.toDate() : null;
            head.appendChild(ibEl('span', 'ib-time', when ? timeAgo(when) : ''));
            const body = ibEl('div', 'ib-body');
            let built = false;
            const build = () => { if (built) return; built = true; ibFillBody(body, d, when); };
            head.onclick = () => { build(); const open = card.classList.toggle('open'); if (open) inboxOpen.add(d._id); else inboxOpen.delete(d._id); };
            if (inboxOpen.has(d._id)) build();
            card.append(head, body);
            return card;
        }

        const ibBlobCache = new Map();
        async function ibLoadFile(d, a) {
            const key = d._id + '/' + a.id;
            if (ibBlobCache.has(key)) return ibBlobCache.get(key);
            const col = fbCol().doc(d._id).collection('files');
            const snaps = await Promise.all([...Array(a.chunks || 0).keys()].map(i => col.doc(`${a.id}_${String(i).padStart(3, '0')}`).get()));
            const parts = snaps.map(s => {
                if (!s.exists) throw new Error('missing data');
                const bin = atob(s.data().data), u8 = new Uint8Array(bin.length);
                for (let i = 0; i < bin.length; i++) u8[i] = bin.charCodeAt(i);
                return u8;
            });
            const url = URL.createObjectURL(new Blob(parts, { type: a.type || 'application/octet-stream' }));
            ibBlobCache.set(key, url);
            return url;
        }
        function ibFillBody(body, d, when) {
            const meta = [d.typeLabel, d.area, d.mode === 'twoyear' ? '2 Year' : '1 Year', d.appVersion && ('v' + d.appVersion), d.frequency && ('Happens: ' + d.frequency), when && when.toLocaleString(), 'Ref ' + String(d._id).slice(-8).toUpperCase()].filter(Boolean).join('  \u00b7  ');
            body.appendChild(ibEl('p', 'ib-time', meta));
            body.appendChild(ibSection('Details', ibEl('p', '', d.description || '')));
            if (d.steps) body.appendChild(ibSection('Steps to reproduce', ibEl('p', '', d.steps)));
            if (d.contact) { const a = ibEl('a', 'underline text-indigo-600 dark:text-indigo-400', d.contact); a.href = 'mailto:' + d.contact; body.appendChild(ibSection('Contact', a)); }
            if (d.attachments && d.attachments.length) {
                const wrap = ibEl('div', 'ib-att');
                d.attachments.forEach(a => {
                    const isVid = (a.type || '').startsWith('video/');
                    const holder = ibEl('div', 'ib-file');
                    const show = async () => {
                        holder.textContent = 'Loading...';
                        try {
                            const url = await ibLoadFile(d, a);
                            holder.textContent = '';
                            if (isVid) { const v = document.createElement('video'); v.src = url; v.controls = true; v.playsInline = true; holder.appendChild(v); }
                            else { const im = document.createElement('img'); im.src = url; im.alt = a.name || ''; im.onclick = () => openLightbox(url); holder.appendChild(im); }
                        } catch (e) { console.error(e); holder.textContent = `Could not load (${e.code || e.message})`; }
                    };
                    if (isVid) { const b = ibEl('button', 'ib-vidbtn', `Load video \u00b7 ${fbSize(a.size)}`); b.type = 'button'; b.onclick = show; holder.appendChild(b); }
                    else show();
                    wrap.appendChild(holder);
                });
                body.appendChild(ibSection(`Attachments (${d.attachments.length})`, wrap));
            }
            if (d.diagnostics) {
                const det = document.createElement('details');
                det.appendChild(ibEl('summary', 'cursor-pointer font-bold text-xs', 'Technical details'));
                det.appendChild(ibEl('pre', '', JSON.stringify(d.diagnostics, null, 2)));
                body.appendChild(ibSection('Diagnostics', det));
            }
            const actions = ibEl('div', 'ib-actions');
            (IB_NEXT[d.status || 'new'] || []).forEach(([label, status]) => {
                const b = ibEl('button', '', label); b.type = 'button';
                b.onclick = () => fbCol().doc(d._id).update({ status }).catch(e => { console.error(e); showToast(`Could not update (${e.code || 'error'}).`, 'error'); });
                actions.appendChild(b);
            });
            const del = ibEl('button', 'del', 'Delete'); del.type = 'button';
            del.onclick = async () => {
                if (!(await customConfirm({ title: 'Delete this feedback?', message: 'The report and its attachments will be permanently removed.', confirmText: 'Delete', danger: true }))) return;
                const batch = db.batch();
                (d.attachments || []).forEach(a => { for (let i = 0; i < (a.chunks || 0); i++) batch.delete(fbCol().doc(d._id).collection('files').doc(`${a.id}_${String(i).padStart(3, '0')}`)); });
                try { await batch.commit(); } catch (e) { console.error(e); }
                fbCol().doc(d._id).delete().then(() => showToast('Feedback deleted.', 'success')).catch(e => { console.error(e); showToast(`Could not delete (${e.code || 'error'}).`, 'error'); });
            };
            actions.appendChild(del);
            body.appendChild(actions);
        }
        renderInbox();
