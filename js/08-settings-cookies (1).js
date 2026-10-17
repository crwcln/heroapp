// ================= PREFS + COOKIES =================
        const getCookie = n => (document.cookie.split('; ').find(c => c.startsWith(n + '=')) || '').split('=').slice(1).join('=');
        const setCookie = (n, v, days = 365) => { document.cookie = `${n}=${encodeURIComponent(v)}; max-age=${days * 86400}; path=/; SameSite=Lax`; };
        let consent = getCookie('cairn_consent');
        let prefs = { theme: 'cairn', bg: 'contour', font: 'modern', motion: 'on', cloak: '' };
        if (consent === 'all') { try { Object.assign(prefs, JSON.parse(decodeURIComponent(getCookie('cairn_prefs')))); } catch (e) { /* none saved */ } }
        function applyPrefs() {
            const h = document.documentElement;
            h.dataset.theme = prefs.theme; h.dataset.bg = prefs.bg; h.dataset.font = prefs.font; h.dataset.motion = prefs.motion;
            window.__cloakTitle = prefs.cloak.trim();
            document.querySelectorAll('[data-theme].st-card, [data-bg], [data-font]').forEach(b => { const k = b.dataset.theme ? 'theme' : b.dataset.bg ? 'bg' : 'font'; b.classList.toggle('on', prefs[k] === (b.dataset.theme || b.dataset.bg || b.dataset.font)); });
            document.getElementById('sw-motion').classList.toggle('on', prefs.motion === 'on');
            document.getElementById('cloak-title').value = prefs.cloak;
            syncFaviconToTheme();
        }

        // ================= FAVICON FOLLOWS THEME =================
        // Redraws the tab icon in the currently-selected colorway's brand/accent colors instead of a
        // single color baked in at build time, so switching themes updates the browser tab too.
        let faviconRaf = 0;
        function syncFaviconToTheme() {
            cancelAnimationFrame(faviconRaf);
            faviconRaf = requestAnimationFrame(() => {
                const cs = getComputedStyle(document.documentElement);
                const brand = cs.getPropertyValue('--brand-600').trim() || '#1e3a6e';
                const sec = cs.getPropertyValue('--sec').trim() || '#d4af37';
                const svg = `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 64 64'><rect x='4' y='4' width='56' height='56' rx='14' fill='${brand}' stroke='${sec}' stroke-width='1.6'/><text x='32' y='34' text-anchor='middle' dominant-baseline='central' font-family='Georgia,serif' font-weight='700' font-size='30' fill='${sec}'>H</text></svg>`;
                const href = 'data:image/svg+xml,' + encodeURIComponent(svg);
                document.querySelectorAll('link[rel="icon"][type="image/svg+xml"]').forEach(l => { l.href = href; });
                const meta = document.querySelector('meta[name="theme-color"]'); if (meta) meta.content = brand;
            });
        }
        function setPref(k, v) {
            prefs[k] = v; applyPrefs();
            if (consent === 'all') setCookie('cairn_prefs', JSON.stringify(prefs));
            if (k !== 'cloak' && k !== 'vol') showToast(k === 'motion' ? (v === 'on' ? 'Animations on' : 'Animations off') : 'So it is written', 'success');
        }
        function setConsent(v) {
            consent = v; setCookie('cairn_consent', v);
            if (v === 'all') { setCookie('cairn_prefs', JSON.stringify(prefs)); setCookie('cairn_last', Date.now()); }
            window.dispatchEvent(new CustomEvent('hero-consent-change', { detail: { consent: v } }));
            document.getElementById('cookie-banner').classList.remove('show'); document.body.classList.remove('cookie-open'); setTimeout(() => window.tutMaybe && tutMaybe(), 700);
        }
        applyPrefs();
        setTimeout(() => { if (!consent) { document.getElementById('cookie-banner').classList.add('show'); document.body.classList.add('cookie-open'); } }, 2200);
        if (consent === 'all') {
            const last = Number(decodeURIComponent(getCookie('cairn_last'))), days = Math.floor((Date.now() - last) / 864e5);
            if (last && days >= 1) setTimeout(() => showToast(`Welcome back! Last visit was ${days} day${days > 1 ? 's' : ''} ago.`, 'info'), 3000);
            setCookie('cairn_last', Date.now());
        }

        // ================= UI HELPERS =================
        function badInput(el) {
            if (!el) return;
            el.classList.remove('bad'); void el.offsetWidth; el.classList.add('bad');
            el.addEventListener('input', () => el.classList.remove('bad'), { once: true });
        }
                document.querySelectorAll('#nav-actions > button').forEach(b => { const s = b.querySelector('span'); b.dataset.tip = s ? s.textContent.trim() : 'Toggle theme'; });
        const FACTS = [quoteLine()];
        (function () { const f = document.getElementById('cv-fact'); let i = Math.floor(Math.random() * FACTS.length); f.textContent = FACTS[i];
            const t = setInterval(() => { if (!document.getElementById('site-cover') || document.getElementById('site-cover').classList.contains('hidden')) return clearInterval(t); f.style.opacity = 0; setTimeout(() => { i = (i + 1) % FACTS.length; f.textContent = FACTS[i]; f.style.opacity = 1; }, 300); }, 2400); })();
