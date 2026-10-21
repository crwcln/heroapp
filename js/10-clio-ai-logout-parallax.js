// ================= SHERPA (Gemini via /api/chat) =================
        const sh = { msgs: JSON.parse(sessionStorage.getItem('sh_msgs') || '[]'), pendingImages: [], busy: false, last: 0, streamText: null, streamReceived: '', typingQueue: '', typingTimer: 0, typingDone: null };
        const SH_CHIPS = ['Quiz me on African rivers', 'Memory trick for the Balkans', 'Why do straits matter?', 'Explain the Silk Road'];
        const shFmt = t => {
            const source = document.createElement('template');
            source.innerHTML = String(t || '')
                .replace(/\*\*(.+?)\*\*/gs, '<strong>$1</strong>')
                .replace(/(^|[^*])\*([^*\n]+)\*(?!\*)/gm, '$1<em>$2</em>')
                .replace(/__([^_\n]+)__/g, '<u>$1</u>')
                .replace(/~~(.+?)~~/gs, '<del>$1</del>')
                .replace(/^\s*[-*] /gm, '\u2022 ')
                .replace(/\n/g, '<br>');
            const tags = new Set(['P','BR','B','STRONG','I','EM','U','S','DEL','SPAN','UL','OL','LI','BLOCKQUOTE','CODE','PRE','SMALL','MARK','SUB','SUP','H3','H4']);
            const colors = new Set(['black','white','red','green','blue','orange','purple','teal','gold','gray','grey','navy','crimson','indigo','tomato','salmon','skyblue','lime','coral']);
            const fonts = new Map([['spectral', 'Spectral, Georgia, serif'], ['georgia', 'Georgia, serif'], ['serif', 'serif'], ['nunito', 'Nunito, sans-serif'], ['fraunces', 'Fraunces, Georgia, serif'], ['jetbrains mono', 'JetBrains Mono, monospace'], ['monospace', 'monospace'], ['sans-serif', 'sans-serif']]);
            const safeColor = value => /^#[\da-f]{3,8}$/i.test(value) || /^(?:rgba?|hsla?)\([\d\s.,%/+-]+\)$/i.test(value) || colors.has(value.toLowerCase()) || (typeof CSS !== 'undefined' && CSS.supports('color', value));
            const clean = node => {
                if (node.nodeType === Node.TEXT_NODE) return document.createTextNode(node.nodeValue || '');
                if (node.nodeType !== Node.ELEMENT_NODE) return document.createDocumentFragment();
                if (!tags.has(node.tagName)) { const fragment = document.createDocumentFragment(); [...node.childNodes].forEach(child => fragment.append(clean(child))); return fragment; }
                const out = document.createElement(node.tagName.toLowerCase());
                if (node.tagName === 'SPAN' || node.tagName === 'MARK') {
                    for (const declaration of String(node.getAttribute('style') || '').split(';')) {
                        const colon = declaration.indexOf(':'); if (colon < 0) continue;
                        const key = declaration.slice(0, colon).trim().toLowerCase(), value = declaration.slice(colon + 1).trim();
                        if (key === 'color' && safeColor(value)) out.style.color = value;
                        if (key === 'background-color' && safeColor(value)) out.style.backgroundColor = value;
                        if (key === 'font-family') { const family = value.replace(/["']/g, '').split(',')[0].trim().toLowerCase(); if (fonts.has(family)) out.style.fontFamily = fonts.get(family); }
                        if (key === 'font-size' && /^(1[2-9]|2[0-8])px$/.test(value)) out.style.fontSize = value;
                    }
                }
                [...node.childNodes].forEach(child => out.append(clean(child)));
                return out;
            };
            const result = document.createElement('div'); [...source.content.childNodes].forEach(node => result.append(clean(node)));
            return result.innerHTML;
        };
        const shLogo = () => `<svg class="clio-mark" viewBox="0 0 48 48" aria-hidden="true"><path class="clio-mark-arc" d="M10 37V23a14 14 0 0 1 28 0v14"/><path class="clio-mark-scroll" d="M17 18h14v20H17zM20 23h8M20 27h8M20 31h5"/><path class="clio-mark-sprig" d="M8 37c0-6 3-11 8-15M40 37c0-6-3-11-8-15M10 32l4 1m-1-7 4 2m21 4-4 1m1-7-4 2"/></svg>`;
        function shUI(k, full) {
            return `<div class="sh-head"><div class="sh-av sh-clio-mark">${shLogo()}</div><div><h3>Clio</h3><small>Muse of history, guide to the map</small></div><div class="sh-sp"></div>
                <button class="sh-ib" title="New chat" onclick="shClear()"><i data-lucide="rotate-ccw"></i></button>
                ${full ? '' : '<button class="sh-ib" title="Open full page" onclick="switchView(\'ai-view\')"><i data-lucide="maximize-2"></i></button><button class="sh-ib" title="Close" onclick="sherpaToggle()"><i data-lucide="x"></i></button>'}</div>
                <div class="sh-msgs" id="shm-${k}"></div>
                <div class="sh-preview" id="shprev-${k}" aria-live="polite"></div>
                <div class="sh-in"><input id="shfile-${k}" type="file" accept="image/png,image/jpeg,image/webp" multiple hidden><button class="sh-ib sh-attach" type="button" id="shattach-${k}" aria-label="Attach images to send to Clio's AI" title="Images are sent to Clio's AI provider for analysis"><i data-lucide="paperclip"></i></button><textarea id="shi-${k}" rows="1" maxlength="1000" placeholder="Ask Clio or drop an image..."></textarea><button class="sh-send" id="shs-${k}" aria-label="Send"><i data-lucide="send"></i></button></div>`;
        }
        ['p', 'v'].forEach(k => {
            document.getElementById(k === 'p' ? 'sherpa-panel' : 'ai-shell').innerHTML = shUI(k, k === 'v');
        });
        lucide.createIcons();
        ['p', 'v'].forEach(k => {
            const ta = document.getElementById('shi-' + k), fileInput = document.getElementById('shfile-' + k), go = () => { const v = ta.value; ta.value = ''; ta.style.height = 'auto'; sherpaSend(v); };
            ta.addEventListener('keydown', e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); go(); } });
            ta.addEventListener('input', () => { ta.style.height = 'auto'; ta.style.height = Math.min(120, ta.scrollHeight) + 'px'; });
            document.getElementById('shs-' + k).onclick = go;
            document.getElementById('shattach-' + k).onclick = () => fileInput.click();
            fileInput.addEventListener('change', async () => { await shQueueFiles(fileInput.files); fileInput.value = ''; });
            const msgBox = document.getElementById('shm-' + k);
            const dropZone = msgBox.parentElement;
            dropZone.addEventListener('dragover', e => { if ([...e.dataTransfer.types].includes('Files')) { e.preventDefault(); msgBox.classList.add('sh-drop-active'); } });
            dropZone.addEventListener('dragleave', e => { if (!dropZone.contains(e.relatedTarget)) msgBox.classList.remove('sh-drop-active'); });
            dropZone.addEventListener('drop', async e => { if (e.dataTransfer.files.length) e.preventDefault(); msgBox.classList.remove('sh-drop-active'); if ([...(e.dataTransfer.files || [])].some(f => f.type.startsWith('image/'))) await shQueueFiles(e.dataTransfer.files); });
            ta.addEventListener('paste', async e => { const files = [...(e.clipboardData && e.clipboardData.files || [])]; if (files.some(f => f.type.startsWith('image/'))) { e.preventDefault(); await shQueueFiles(files); } });
        });
        function shRender() {
            ['p', 'v'].forEach(k => {
                const box = document.getElementById('shm-' + k); box.innerHTML = '';
                if (!sh.msgs.length) {
                    box.innerHTML = `<div class="sh-hero"><div class="sh-av sh-clio-mark">${shLogo()}</div><h2>Hi, I'm Clio</h2><p>Ask me about places, regions, rivers, empires or trade routes. I'll help you remember them.</p><div class="sh-chips">${SH_CHIPS.map(c => `<button class="sh-chip">${esc(c)}</button>`).join('')}</div></div>`;
                    box.querySelectorAll('.sh-chip').forEach(b => { b.onclick = () => sherpaSend(b.textContent); });
                    lucide.createIcons();
                }
                sh.msgs.forEach(m => { const d = document.createElement('div'); d.className = 'sh-msg ' + (m.r === 'user' ? 'me' : 'bot') + (m.err ? ' err' : ''); d.innerHTML = shFmt(m.t); (m.images || []).forEach(img => { const el = document.createElement('img'); el.src = img.url; el.alt = 'Image attached to message'; el.className = 'sh-message-image'; d.appendChild(el); }); box.appendChild(d); });
                if (sh.busy) { const d = document.createElement('div'); d.className = 'sh-msg bot'; d.id = 'sh-live-' + k; d.innerHTML = sh.streamText ? shFmt(sh.streamText) : '<span class="sh-dots"><i></i><i></i><i></i></span>'; box.appendChild(d); }
                box.scrollTop = box.scrollHeight;
                document.getElementById('shs-' + k).disabled = sh.busy;
                const previews = document.getElementById('shprev-' + k); previews.innerHTML = '';
                sh.pendingImages.forEach((img, i) => { const wrap = document.createElement('span'); wrap.className = 'sh-preview-item'; const im = document.createElement('img'); im.src = img.url; im.alt = 'Image ready to send'; const rm = document.createElement('button'); rm.type = 'button'; rm.textContent = '×'; rm.setAttribute('aria-label', 'Remove image'); rm.onclick = () => { sh.pendingImages.splice(i, 1); shRender(); }; wrap.append(im, rm); previews.appendChild(wrap); });
            });
            sessionStorage.setItem('sh_msgs', JSON.stringify(sh.msgs.slice(-30).map(m => ({ r: m.r, t: m.t, err: !!m.err }))));
        }
        function shAppendStreamDelta(text) {
            sh.streamReceived += text;
            sh.typingQueue += text;
            if (!sh.typingTimer) shTypeNext();
        }
        function shTypeNext() {
            if (!sh.typingQueue.length) {
                sh.typingTimer = 0;
                if (sh.typingDone) { const done = sh.typingDone; sh.typingDone = null; done(); }
                return;
            }
            // Reveal a few characters per beat; punctuation gets a short pause for a natural cadence.
            let count = Math.min(sh.typingQueue.length, 2);
            const chunk = sh.typingQueue.slice(0, count); sh.typingQueue = sh.typingQueue.slice(count);
            sh.streamText = (sh.streamText || '') + chunk;
            ['p', 'v'].forEach(k => {
                const el = document.getElementById('sh-live-' + k); if (!el) return;
                el.innerHTML = shFmt(sh.streamText);
                const box = el.closest('.sh-msgs'); if (box) box.scrollTop = box.scrollHeight;
            });
            const pause = /[.!?\n]$/.test(chunk) ? 110 : 34;
            sh.typingTimer = setTimeout(shTypeNext, pause);
        }
        function shWaitForTyping() {
            if (!sh.typingTimer && !sh.typingQueue.length) return Promise.resolve();
            return new Promise(resolve => { sh.typingDone = resolve; });
        }
        async function shAnimateReply(text) {
            sh.streamText = ''; sh.streamReceived = ''; sh.typingQueue = ''; shRender();
            shAppendStreamDelta(text || '');
            await shWaitForTyping();
        }
        async function shQueueFiles(files) {
            const picked = [...(files || [])].filter(f => f.type.startsWith('image/'));
            const slots = Math.max(0, 2 - sh.pendingImages.length);
            for (const file of picked.slice(0, slots)) {
                try { sh.pendingImages.push(await shCompressImage(file)); }
                catch (_) { showToast('That image could not be read. Try a PNG, JPG, or WebP file.', 'error'); }
            }
            if (picked.length > slots) showToast('Clio accepts up to two images per message.', 'error');
            shRender();
        }
        async function shCompressImage(file) {
            if (!['image/png', 'image/jpeg', 'image/webp'].includes(file.type)) throw new Error('unsupported image');
            if (file.size > 15 * 1024 * 1024) throw new Error('too large');
            const bitmap = await createImageBitmap(file), scale = Math.min(1, 1280 / Math.max(bitmap.width, bitmap.height));
            const canvas = document.createElement('canvas'); canvas.width = Math.max(1, Math.round(bitmap.width * scale)); canvas.height = Math.max(1, Math.round(bitmap.height * scale));
            canvas.getContext('2d').drawImage(bitmap, 0, 0, canvas.width, canvas.height); bitmap.close();
            const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/jpeg', .82));
            if (!blob) throw new Error('image conversion failed');
            const bytes = new Uint8Array(await blob.arrayBuffer()); let binary = '';
            for (let i = 0; i < bytes.length; i += 0x8000) binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
            const data = btoa(binary); return { mimeType: 'image/jpeg', data, url: 'data:image/jpeg;base64,' + data };
        }
        function shClear() { sh.msgs = []; sh.pendingImages = []; shRender(); }
        function sherpaToggle() { document.body.classList.toggle('sh-open'); if (document.body.classList.contains('sh-open')) setTimeout(() => document.getElementById('shi-p').focus(), 350); }
        async function sherpaSend(text) {
            text = (text || '').trim();
            if (/^manoj cursor[.!?]*$/i.test(text) && window.activateManojCursor) {
                if (sh.busy) return;
                sh.msgs.push({ r: 'user', t: text }); window.activateManojCursor();
                sh.msgs.push({ r: 'model', t: 'The Manoj cursor is toggled for this browser. It will follow your pointer while the transparent portrait asset is installed.' });
                shRender(); return;
            }
            if (secretAsk(text)) return;
            if (/^who are the big men\??$/i.test(text)) {
                if (sh.busy) return;
                sh.msgs.push({ r: 'user', t: text });
                sh.msgs.push({ r: 'model', t: '“Big Men” is a nickname for the Great Man theory of history: the idea that exceptional leaders shape major events. Historians also look at ordinary people, institutions, geography, and long-term forces. Which leader or period should we explore?' });
                shRender(); return;
            }
            const images = sh.pendingImages.splice(0);
            if ((!text && !images.length) || sh.busy || Date.now() - sh.last < 1000) { sh.pendingImages.unshift(...images); return; }
            sh.last = Date.now(); sh.msgs.push({ r: 'user', t: text.slice(0, 1000) || 'Please describe this image in a geography or history learning context.', images }); sh.busy = true; shRender();
            try {
                let idToken = '';
                try { idToken = auth && auth.currentUser ? await auth.currentUser.getIdToken() : ''; } catch (e) { /* sendable without it; server will reply 'signed_out' */ }
                const headers = Object.assign({ 'Content-Type': 'application/json' }, idToken ? { Authorization: 'Bearer ' + idToken } : {});
                const requestData = { messages: sh.msgs.filter(m => !m.err).slice(-10).map(m => ({ role: m.r, text: m.t, images: (m.images || []).map(img => ({ mimeType: img.mimeType, data: img.data })) })), ctx: (window.__focusLoc ? `Looking at: ${window.__focusLoc.name}${window.__focusLoc.category ? ' (' + window.__focusLoc.category + ')' : ''}. ` : '') + `${yearMode === 'twoyear' ? '2 Year' : '1 Year'} quiz: ${globalQuizTitle}` };
                const sendChat = stream => fetch('/api/chat', { method: 'POST', headers, body: JSON.stringify({ ...requestData, stream }) });
                let r;
                try { r = await sendChat(true); }
                catch (requestError) {
                    // Some edge proxies reset long-lived SSE responses. Retry once
                    // as a regular JSON request before telling the player it failed.
                    if (!(requestError instanceof TypeError)) throw requestError;
                    r = await sendChat(false);
                }
                const isStream = r.ok && (r.headers.get('content-type') || '').includes('text/event-stream');
                if (!isStream) {
                    const d = await r.json().catch(() => ({}));
                    if (!r.ok) { const err = new Error(d.error || r.status); err.d = d; throw err; }
                    await shAnimateReply(d.reply || '');
                    sh.msgs.push({ r: 'model', t: d.reply });
                } else {
                    // Show Clio's answer as it's generated, the same way Gemini's own UI does, instead of waiting for the full reply.
                    sh.streamText = ''; sh.streamReceived = ''; sh.typingQueue = ''; shRender();
                    const reader = r.body.getReader(), decoder = new TextDecoder();
                    let buf = '', streamErr = null;
                    let readError = null;
                    try {
                        outer: while (true) {
                            const { done, value } = await reader.read();
                            if (done) break;
                            buf += decoder.decode(value, { stream: true });
                            const events = buf.split('\n\n'); buf = events.pop() || '';
                            for (const evt of events) {
                                const line = evt.split('\n').find(l => l.startsWith('data: ')); if (!line) continue;
                                let payload; try { payload = JSON.parse(line.slice(6)); } catch (e2) { continue; }
                                if (payload.error) { streamErr = payload.error; break outer; }
                                if (payload.t) shAppendStreamDelta(payload.t);
                                if (payload.done) break outer;
                            }
                        }
                    } catch (error) { readError = error; }
                    if (readError && !sh.streamText) {
                        // The stream reset before delivering any content; retry on
                        // the same authenticated request without SSE.
                        sh.streamText = null;
                        const fallback = await sendChat(false), fallbackData = await fallback.json().catch(() => ({}));
                        if (!fallback.ok) { const err = new Error(fallbackData.error || fallback.status); err.d = fallbackData; throw err; }
                        await shAnimateReply(fallbackData.reply || '');
                        sh.msgs.push({ r: 'model', t: fallbackData.reply || '' });
                    } else if (readError) throw readError;
                    if (streamErr) { sh.streamText = null; const err = new Error(streamErr); throw err; }
                    if (!readError) { await shWaitForTyping(); sh.msgs.push({ r: 'model', t: sh.streamReceived || '' }); }
                    sh.streamText = null;
                }
            } catch (e) {
                clearTimeout(sh.typingTimer); sh.typingTimer = 0; sh.typingQueue = ''; sh.typingDone = null; sh.streamText = null;
                const D = e.d || {}; const m = { not_configured: "Clio isn't set up yet. Add GEMINI_API_KEY in EdgeOne env vars and redeploy.", server_not_configured: 'Clio needs FIREBASE_API_KEY set in EdgeOne env vars (the same public value already in js/02-firebase-config.js), then redeploy.', signed_out: 'Sign in with a verified Hero account to talk with Clio.', not_verified: 'Verify your email to talk with Clio.', rate_limited: 'Clio is busy right now. Try again in a moment.', upstream_error: [429, 503].includes(D.status) ? "Google's AI is overloaded right now. Clio tried several models. Try again in a few seconds." : `The AI service rejected the request (HTTP ${D.status}${D.detail ? ': ' + D.detail : ''}). Check GEMINI_API_KEY.`, upstream_unreachable: "Clio's connection to Google's AI service was interrupted. Please try again.", empty_reply: `Clio got an empty answer (${D.detail || 'unknown'}). Try rephrasing.`, 404: 'Add edge-functions/api/chat.js and redeploy.', 'Failed to fetch': "Couldn't reach /api/chat." }[e.message];
                const networkFailure = /network|fetch|connection|stream/i.test(String(e && e.message || ''));
                sh.msgs.push({ r: 'model', t: m || (networkFailure ? "Clio lost its connection while answering. Please try again." : `Clio couldn't answer just now${e && e.message ? ` (${String(e.message).slice(0, 140)})` : ''}. Please try again, and use \u201cSend a Word\u201d if it keeps happening.`), err: true });
            }
            sh.busy = false; shRender();
        }
        const _sv2 = switchView;
        switchView = function (id) { _sv2(id); document.body.dataset.view = id; if (id === 'ai-view') document.body.classList.remove('sh-open'); setTimeout(shRender, 0); };
        shRender();

        // ================= ADMIN LOG OUT =================
        (function () {
            const save = document.getElementById('save-global-btn'), wrap = document.createElement('div');
            wrap.className = 'flex gap-2 items-center flex-wrap'; save.replaceWith(wrap);
            const out = document.createElement('button');
            out.className = 'cm-btn ghost flex items-center gap-2'; out.innerHTML = '<i data-lucide="log-out" class="w-4 h-4"></i> Log out';
            out.onclick = async () => { sessionStorage.removeItem('mq_devUnlocked'); await lockAdmin('Logged out.'); applyDevScreen(); };
            wrap.append(out, save); lucide.createIcons();
        })();

        // ================= LIGHT/DARK TRANSITION + MOUSE PARALLAX =================
        const _tdm = toggleDarkMode;
        toggleDarkMode = function () {
            const calm = matchMedia('(prefers-reduced-motion: reduce)').matches || document.documentElement.dataset.motion === 'off';
            if (calm) return _tdm();
            if (!document.startViewTransition) { document.documentElement.classList.add('theme-fade'); _tdm(); return setTimeout(() => document.documentElement.classList.remove('theme-fade'), 700); }
            const b = document.getElementById('theme-btn').getBoundingClientRect(), x = b.left + b.width / 2, y = b.top + b.height / 2;
            const R = Math.hypot(Math.max(x, innerWidth - x), Math.max(y, innerHeight - y));
            document.startViewTransition(() => _tdm()).ready.then(() => document.documentElement.animate(
                { clipPath: [`circle(0px at ${x}px ${y}px)`, `circle(${R}px at ${x}px ${y}px)`] },
                { duration: 750, easing: 'cubic-bezier(.4,0,.2,1)', pseudoElement: '::view-transition-new(root)' }));
        };
        (function () {
            let tx = 0, ty = 0, cx = 0, cy = 0, run = false; const root = document.documentElement;
            const step = () => {
                cx += (tx - cx) * .05; cy += (ty - cy) * .05;
                fxMove(cx, cy);
                if (Math.abs(tx - cx) > .002 || Math.abs(ty - cy) > .002) requestAnimationFrame(step); else run = false;
            };
            addEventListener('mousemove', e => {
                if (root.dataset.motion === 'off' || root.classList.contains('is-mobile')) return;
                tx = e.clientX / innerWidth * 2 - 1; ty = e.clientY / innerHeight * 2 - 1;
                if (!run) { run = true; requestAnimationFrame(step); }
            }, { passive: true });
        })();
