// ================= SHERPA (Gemini via /api/chat) =================
        const sh = { msgs: JSON.parse(sessionStorage.getItem('sh_msgs') || '[]'), busy: false, last: 0 };
        const SH_CHIPS = ['Quiz me on African rivers', 'Memory trick for the Balkans', 'Why do straits matter?', 'Explain the Silk Road'];
        const shFmt = t => esc(t).replace(/\*\*(.+?)\*\*/g, '<b>$1</b>').replace(/^\s*[-*] /gm, '\u2022 ').replace(/\n/g, '<br>');
        function shUI(k, full) {
            return `<div class="sh-head"><div class="sh-av"><i data-lucide="bot"></i></div><div><h3>Clio</h3><small>Muse of history, guide to the map</small></div><div class="sh-sp"></div>
                <button class="sh-ib" title="New chat" onclick="shClear()"><i data-lucide="rotate-ccw"></i></button>
                ${full ? '' : '<button class="sh-ib" title="Open full page" onclick="switchView(\'ai-view\')"><i data-lucide="maximize-2"></i></button><button class="sh-ib" title="Close" onclick="sherpaToggle()"><i data-lucide="x"></i></button>'}</div>
                <div class="sh-msgs" id="shm-${k}"></div>
                <div class="sh-in"><textarea id="shi-${k}" rows="1" maxlength="1000" placeholder="Ask about any place, region or route..."></textarea><button class="sh-send" id="shs-${k}" aria-label="Send"><i data-lucide="send"></i></button></div>`;
        }
        ['p', 'v'].forEach(k => {
            document.getElementById(k === 'p' ? 'sherpa-panel' : 'ai-shell').innerHTML = shUI(k, k === 'v');
        });
        lucide.createIcons();
        ['p', 'v'].forEach(k => {
            const ta = document.getElementById('shi-' + k), go = () => { const v = ta.value; ta.value = ''; ta.style.height = 'auto'; sherpaSend(v); };
            ta.addEventListener('keydown', e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); go(); } });
            ta.addEventListener('input', () => { ta.style.height = 'auto'; ta.style.height = Math.min(120, ta.scrollHeight) + 'px'; });
            document.getElementById('shs-' + k).onclick = go;
        });
        function shRender() {
            ['p', 'v'].forEach(k => {
                const box = document.getElementById('shm-' + k); box.innerHTML = '';
                if (!sh.msgs.length) {
                    box.innerHTML = `<div class="sh-hero"><div class="sh-av"><i data-lucide="bot"></i></div><h2>Hi, I'm Clio</h2><p>Ask me about places, regions, rivers, empires or trade routes. I'll help you remember them.</p><div class="sh-chips">${SH_CHIPS.map(c => `<button class="sh-chip">${esc(c)}</button>`).join('')}</div></div>`;
                    box.querySelectorAll('.sh-chip').forEach(b => { b.onclick = () => sherpaSend(b.textContent); });
                    lucide.createIcons();
                }
                sh.msgs.forEach(m => { const d = document.createElement('div'); d.className = 'sh-msg ' + (m.r === 'user' ? 'me' : 'bot') + (m.err ? ' err' : ''); d.innerHTML = shFmt(m.t); box.appendChild(d); });
                if (sh.busy) { const d = document.createElement('div'); d.className = 'sh-msg bot'; d.innerHTML = '<span class="sh-dots"><i></i><i></i><i></i></span>'; box.appendChild(d); }
                box.scrollTop = box.scrollHeight;
                document.getElementById('shs-' + k).disabled = sh.busy;
            });
            sessionStorage.setItem('sh_msgs', JSON.stringify(sh.msgs.slice(-30)));
        }
        function shClear() { sh.msgs = []; shRender(); }
        function sherpaToggle() { document.body.classList.toggle('sh-open'); if (document.body.classList.contains('sh-open')) setTimeout(() => document.getElementById('shi-p').focus(), 350); }
        async function sherpaSend(text) {
            text = (text || '').trim();
            if (!text || sh.busy || Date.now() - sh.last < 1000) return;
            sh.last = Date.now(); sh.msgs.push({ r: 'user', t: text.slice(0, 1000) }); sh.busy = true; shRender();
            try {
                const r = await fetch('/api/chat', { method: 'POST', headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ messages: sh.msgs.filter(m => !m.err).slice(-10).map(m => ({ role: m.r, text: m.t })), ctx: `${yearMode === 'twoyear' ? '2 Year' : '1 Year'} quiz: ${globalQuizTitle}` }) });
                const d = await r.json().catch(() => ({}));
                if (!r.ok) { const err = new Error(d.error || r.status); err.d = d; throw err; }
                sh.msgs.push({ r: 'model', t: d.reply });
            } catch (e) {
                const D = e.d || {}; const m = { not_configured: "Clio isn't set up yet. Add GEMINI_API_KEY in EdgeOne env vars and redeploy.", rate_limited: 'Clio is busy right now. Try again in a moment.', upstream_error: `The AI service rejected the request (HTTP ${D.status}${D.detail ? ': ' + D.detail : ''}). Check GEMINI_API_KEY.`, empty_reply: `Clio got an empty answer (${D.detail || 'unknown'}). Try rephrasing.`, 404: 'Add edge-functions/api/chat.js and redeploy.', 'Failed to fetch': "Couldn't reach /api/chat." }[e.message];
                sh.msgs.push({ r: 'model', t: m || "Clio couldn't answer just now. Please try again.", err: true });
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
                root.style.setProperty('--mx', cx.toFixed(3)); root.style.setProperty('--my', cy.toFixed(3));
                if (Math.abs(tx - cx) > .002 || Math.abs(ty - cy) > .002) requestAnimationFrame(step); else run = false;
            };
            addEventListener('mousemove', e => {
                if (root.dataset.motion === 'off' || root.classList.contains('is-mobile')) return;
                tx = e.clientX / innerWidth * 2 - 1; ty = e.clientY / innerHeight * 2 - 1;
                if (!run) { run = true; requestAnimationFrame(step); }
            }, { passive: true });
        })();
