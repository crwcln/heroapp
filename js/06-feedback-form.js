// ================= FEEDBACK =================
        const FB = { maxFiles: 5, maxVideo: 8 * 1048576, maxImage: 20 * 1048576, imgTarget: 450 * 1024, maxTotal: 10 * 1048576, cooldownMs: 30000 };
        const FB_CHUNK = 700000; // multiple of 4 so every chunk is independently valid base64
        const FB_TYPES = { bug: 'Bug report', location: 'Incorrect or missing location', feature: 'Feature request', general: 'General feedback', other: 'Other' };
        let fbFiles = [], fbBusy = false, fbPendingId = null, fbPrevView = 'home-view', fbCurView = 'home-view';
        window.__mqErrors = [];
        window.addEventListener('error', e => { window.__mqErrors = window.__mqErrors.concat(String(e.message || 'error').slice(0, 200)).slice(-10); });
        window.addEventListener('unhandledrejection', e => { window.__mqErrors = window.__mqErrors.concat('Unhandled: ' + String((e.reason && e.reason.message) || e.reason).slice(0, 180)).slice(-10); });

        const fbEl = (id) => document.getElementById(id);
        const fbVal = (id) => fbEl(id).value.trim();
        const fbSize = (b) => b >= 1048576 ? (b / 1048576).toFixed(1) + ' MB' : Math.max(1, Math.round(b / 1024)) + ' KB';

        function fbUpdateType() {
            const bug = fbEl('fb-type').value === 'bug';
            ['fb-sev-wrap', 'fb-freq-wrap', 'fb-steps-wrap'].forEach(id => fbEl(id).classList.toggle('hidden', !bug));
        }
        function fbCount() { fbEl('fb-desc-count').innerText = `${fbEl('fb-desc').value.length} / 2000`; }
        function fbFieldError(id, msg) {
            const input = fbEl(id), err = fbEl(id + '-err');
            input.classList.toggle('invalid', !!msg);
            err.classList.toggle('hidden', !msg);
            err.innerText = msg || '';
        }

        // ---- attachments ----
        async function fbAddFiles(list) {
            const files = [...list];
            for (const f of files) {
                if (fbFiles.length >= FB.maxFiles) { showToast(`You can attach up to ${FB.maxFiles} files.`, 'error'); break; }
                const img = f.type.startsWith('image/'), vid = f.type.startsWith('video/');
                if (!img && !vid) { showToast(`${f.name}: only photos and videos are supported.`, 'error'); continue; }
                if (vid && f.size > FB.maxVideo) { showToast(`${f.name} is over 8 MB. Trim the clip, or paste a link to it in Details.`, 'error'); continue; }
                if (img && f.size > FB.maxImage) { showToast(`${f.name} is over 20 MB.`, 'error'); continue; }
                const file = img ? await fbCompress(f) : f;
                if (!file) { showToast(`${f.name} couldn't be shrunk enough to send. Try a screenshot instead.`, 'error'); continue; }
                if (fbFiles.reduce((a, x) => a + x.file.size, 0) + file.size > FB.maxTotal) { showToast('Attachments are limited to 10 MB in total.', 'error'); continue; }
                fbFiles.push({ id: 'f' + Math.random().toString(36).slice(2, 9), file, kind: img ? 'image' : 'video', preview: URL.createObjectURL(file), status: 'ready', progress: 0, fid: null, chunks: 0 });
            }
            fbRenderFiles();
        }
        async function fbCompress(file) {
            const small = file.size <= FB.imgTarget ? file : null;
            if (!/^image\/(jpeg|png|webp)$/.test(file.type)) return small;
            try {
                const bmp = await createImageBitmap(file);
                let best = null;
                for (const [dim, q] of [[1600, .8], [1400, .7], [1200, .6], [1000, .5], [800, .45], [640, .4]]) {
                    const scale = Math.min(1, dim / Math.max(bmp.width, bmp.height));
                    const c = document.createElement('canvas');
                    c.width = Math.round(bmp.width * scale); c.height = Math.round(bmp.height * scale);
                    c.getContext('2d').drawImage(bmp, 0, 0, c.width, c.height);
                    const blob = await new Promise(r => c.toBlob(r, 'image/jpeg', q));
                    if (blob) { best = blob; if (blob.size <= FB.imgTarget) break; }
                }
                if (!best || best.size > FB.imgTarget) return null;
                return new File([best], file.name.replace(/\.\w+$/, '') + '.jpg', { type: 'image/jpeg' });
            } catch (e) { return small; }
        }
        function fbRenderFiles() {
            const box = fbEl('fb-files');
            box.innerHTML = '';
            fbFiles.forEach(f => {
                const card = document.createElement('div');
                card.className = 'fb-file' + (f.status === 'error' ? ' err' : '');
                card.dataset.fid = f.id;
                const media = document.createElement(f.kind === 'image' ? 'img' : 'video');
                media.className = 'fb-media';
                media.src = f.kind === 'video' ? f.preview + '#t=0.1' : f.preview;
                if (f.kind === 'video') { media.muted = true; media.playsInline = true; media.preload = 'metadata'; } else media.alt = f.file.name;
                const tag = document.createElement('span');
                tag.className = 'fb-tag';
                tag.textContent = f.status === 'error' ? 'FAILED' : (f.kind === 'video' ? 'VIDEO' : 'IMAGE');
                const x = document.createElement('button');
                x.className = 'fb-x'; x.type = 'button'; x.setAttribute('aria-label', 'Remove ' + f.file.name); x.innerHTML = '&times;';
                x.onclick = (ev) => { ev.stopPropagation(); fbRemove(f.id); };
                const meta = document.createElement('div');
                meta.className = 'fb-meta';
                meta.textContent = `${f.file.name} \u00b7 ${fbSize(f.file.size)}`;
                const prog = document.createElement('div');
                prog.className = 'fb-prog';
                prog.innerHTML = `<div class="fb-bar" style="width:${Math.round(f.progress * 100)}%"></div>`;
                card.append(media, tag, x, meta);
                if (f.status === 'uploading' || f.status === 'done') card.appendChild(prog);
                box.appendChild(card);
            });
            fbEl('fb-file-count').innerText = `${fbFiles.length} / ${FB.maxFiles}`;
            fbEl('fb-drop').classList.toggle('full', fbFiles.length >= FB.maxFiles);
        }
        function fbRemove(id) {
            if (fbBusy) return;
            const f = fbFiles.find(x => x.id === id);
            if (f) URL.revokeObjectURL(f.preview);
            fbFiles = fbFiles.filter(x => x.id !== id);
            fbRenderFiles();
        }
        function fbBar(f) {
            const bar = document.querySelector(`[data-fid="${f.id}"] .fb-bar`);
            if (bar) bar.style.width = Math.round(f.progress * 100) + '%';
        }
        async function fbUpload(f, fbId) {
            f.status = 'uploading'; f.progress = 0;
            f.fid = 'f' + Math.random().toString(36).slice(2, 9); // fresh id per attempt (chunks are create-only)
            fbRenderFiles();
            const b64 = await new Promise((res, rej) => {
                const r = new FileReader();
                r.onload = () => res(String(r.result).split(',')[1]);
                r.onerror = () => rej(r.error);
                r.readAsDataURL(f.file);
            });
            const total = Math.ceil(b64.length / FB_CHUNK);
            f.chunks = total;
            const col = fbCol().doc(fbId).collection('files');
            for (let i = 0; i < total; i++) {
                await col.doc(`${f.fid}_${String(i).padStart(3, '0')}`).set({
                    userId, name: f.file.name.slice(0, 100), type: f.file.type, index: i, total,
                    data: b64.slice(i * FB_CHUNK, (i + 1) * FB_CHUNK)
                });
                f.progress = (i + 1) / total; fbBar(f); fbSubmitLabel();
            }
            f.status = 'done'; f.progress = 1; fbBar(f);
        }
        // drag & drop + paste
        (function () {
            const drop = fbEl('fb-drop');
            ['dragenter', 'dragover'].forEach(t => drop.addEventListener(t, e => { e.preventDefault(); drop.classList.add('drag'); }));
            ['dragleave', 'drop'].forEach(t => drop.addEventListener(t, e => { e.preventDefault(); drop.classList.remove('drag'); }));
            drop.addEventListener('drop', e => { if (e.dataTransfer && e.dataTransfer.files) fbAddFiles(e.dataTransfer.files); });
            document.addEventListener('paste', e => {
                if (fbCurView !== 'feedback-view' || !e.clipboardData || !e.clipboardData.files.length) return;
                e.preventDefault();
                fbAddFiles(e.clipboardData.files);
            });
        })();

        // ---- submit ----
        function fbSubmitLabel() {
            const btn = fbEl('fb-submit');
            btn.disabled = fbBusy;
            fbEl('fb-submit-spin').classList.toggle('hidden', !fbBusy);
            let label = 'Submit Feedback';
            if (fbBusy) {
                const up = fbFiles.filter(f => f.status === 'uploading');
                if (up.length) {
                    const done = fbFiles.filter(f => f.status === 'done').length;
                    const pct = Math.round(up.reduce((a, f) => a + f.progress, 0) / up.length * 100);
                    label = `Uploading ${done + 1} of ${fbFiles.length} \u00b7 ${pct}%`;
                } else label = 'Sending...';
            }
            fbEl('fb-submit-label').innerText = label;
        }
        function fbDiagnostics() {
            return {
                app: (typeof clEntries !== 'undefined' && clEntries[0] && clEntries[0].version) || null,
                mode: yearMode, from: fbPrevView,
                ua: navigator.userAgent.slice(0, 300),
                viewport: `${innerWidth}x${innerHeight} @${window.devicePixelRatio || 1}x`,
                theme: document.documentElement.classList.contains('dark') ? 'dark' : 'light',
                mobile: document.documentElement.classList.contains('is-mobile'),
                lang: navigator.language || null,
                tz: (Intl.DateTimeFormat().resolvedOptions().timeZone) || null,
                url: location.href.split('#')[0].slice(0, 200),
                errors: (window.__mqErrors || []).slice(-5)
            };
        }
        async function fbSubmit() {
            if (fbBusy) return;
            const type = fbEl('fb-type').value, title = fbVal('fb-title'), desc = fbVal('fb-desc'), contact = fbVal('fb-contact');
            if (fbSecret(type, title, desc)) return;
            let first = null;
            const bad = (id, msg) => { fbFieldError(id, msg); if (!first) first = id; };
            fbFieldError('fb-title'); fbFieldError('fb-desc'); fbFieldError('fb-contact');
            if (title.length < 5) bad('fb-title', 'Please add a short summary (at least 5 characters).');
            if (desc.length < 15) bad('fb-desc', 'Please describe the issue in a bit more detail (at least 15 characters).');
            if (contact && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contact)) bad('fb-contact', 'That email address doesn\'t look right.');
            if (first) { fbEl(first).focus(); return; }
            if (fbVal('fb-website')) { fbShowSuccess('SPAM0000'); return; } // honeypot
            if (!db || !userId) return showToast('Cannot send feedback while offline.', 'error');
            if (Date.now() - Number(localStorage.getItem('mq_fbLast') || 0) < FB.cooldownMs) return showToast('Please wait a few seconds before sending another report.', 'info');

            fbBusy = true; fbSubmitLabel();
            fbPendingId = fbPendingId || ('fb_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6));
            try {
                for (const f of fbFiles.filter(x => x.status !== 'done')) {
                    try { await fbUpload(f, fbPendingId); }
                    catch (e) { console.error('Upload failed', e); f.status = 'error'; fbRenderFiles(); throw new Error('upload'); }
                }
                const doc = {
                    id: fbPendingId, type, typeLabel: FB_TYPES[type], area: fbEl('fb-area').value,
                    title, description: desc, userId, status: 'new', mode: yearMode,
                    attachments: fbFiles.map(f => ({ id: f.fid, name: f.file.name.slice(0, 100), type: f.file.type, size: f.file.size, chunks: f.chunks })),
                    createdAt: firebase.firestore.FieldValue.serverTimestamp()
                };
                const ver = typeof clEntries !== 'undefined' && clEntries[0] && clEntries[0].version;
                if (ver) doc.appVersion = String(ver);
                if (contact) doc.contact = contact;
                if (type === 'bug') {
                    doc.severity = fbEl('fb-severity').value; doc.frequency = fbEl('fb-frequency').value;
                    if (fbVal('fb-steps')) doc.steps = fbVal('fb-steps');
                }
                if (fbEl('fb-diag').checked) doc.diagnostics = fbDiagnostics();
                await db.collection('artifacts').doc(appId).collection('public').doc('data').collection('feedback').doc(fbPendingId).set(doc);
                localStorage.setItem('mq_fbLast', String(Date.now()));
                fbShowSuccess(fbPendingId.slice(-8).toUpperCase());
                fbPendingId = null;
            } catch (e) {
                if (e.message === 'upload') showToast('Some attachments failed to upload. Remove them or try again.', 'error');
                else { console.error(e); showToast(`Could not send feedback (${e.code || 'error'}).`, 'error'); }
            } finally {
                fbBusy = false; fbSubmitLabel();
            }
        }
        function fbShowSuccess(ref) {
            fbEl('fb-ref').innerText = ref;
            fbEl('fb-form-wrap').classList.add('hidden');
            fbEl('fb-success').classList.remove('hidden');
        }
        function fbReset() {
            fbFiles.forEach(f => URL.revokeObjectURL(f.preview));
            fbFiles = []; fbPendingId = null;
            ['fb-title', 'fb-desc', 'fb-steps', 'fb-contact'].forEach(id => { fbEl(id).value = ''; });
            fbEl('fb-type').value = 'bug'; fbEl('fb-diag').checked = true;
            ['fb-title', 'fb-desc', 'fb-contact'].forEach(id => fbFieldError(id));
            fbUpdateType(); fbCount(); fbRenderFiles(); fbSubmitLabel();
            fbEl('fb-success').classList.add('hidden');
            fbEl('fb-form-wrap').classList.remove('hidden');
        }
        fbUpdateType(); fbCount();
