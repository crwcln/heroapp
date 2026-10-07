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
        }
        function setPref(k, v) {
            prefs[k] = v; applyPrefs();
            if (consent === 'all') setCookie('cairn_prefs', JSON.stringify(prefs));
            if (k !== 'cloak' && k !== 'vol') showToast(k === 'motion' ? (v === 'on' ? 'Animations on' : 'Animations off') : 'Saved', 'success');
        }
        function setConsent(v) {
            consent = v; setCookie('cairn_consent', v);
            if (v === 'all') { setCookie('cairn_prefs', JSON.stringify(prefs)); setCookie('cairn_last', Date.now()); }
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
        document.getElementById('admin-password').addEventListener('keydown', e => { if (e.key === 'Enter') unlockAdmin(); });
        document.querySelectorAll('#nav-actions > button').forEach(b => { const s = b.querySelector('span'); b.dataset.tip = s ? s.textContent.trim() : 'Toggle theme'; });
        const FACTS = [quoteLine()];
        (function () { const f = document.getElementById('cv-fact'); let i = Math.floor(Math.random() * FACTS.length); f.textContent = FACTS[i];
            const t = setInterval(() => { if (!document.getElementById('site-cover') || document.getElementById('site-cover').classList.contains('hidden')) return clearInterval(t); f.style.opacity = 0; setTimeout(() => { i = (i + 1) % FACTS.length; f.textContent = FACTS[i]; f.style.opacity = 1; }, 300); }, 2400); })();
