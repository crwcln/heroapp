// ===== INTRO FILM =====
// First visit after release: the site fades to white, then a short motion-graphics film introduces every feature.
// Replay from Settings. Bump SITE.intro in js/00-site-config.js to show it to everyone again.
const introKey = () => 'hero_intro_' + (SITE.intro || 1);
const LAND = '<path class="land" d="M50 120 120 60 230 50 300 100 270 170 190 210 90 185z"/><path class="land" style="animation-delay:.2s" d="M330 80 420 45 540 70 555 150 490 205 375 185z"/><path class="land" style="animation-delay:.4s" d="M190 240 300 230 360 290 250 325 160 295z"/>';
const PIN = (x, y, d, c = '') => `<circle class="pin ${c}" cx="${x}" cy="${y}" r="9" style="animation-delay:${d}s"/>`;
const INTRO_SCENES = [
 { d: 5200, h: 'Hero', p: 'Where history happened.', b: () => `<div class="in-logo"><svg viewBox="0 0 64 64" fill="currentColor">${document.querySelector('#top-nav svg').innerHTML}</svg></div><div class="in-word">${[...'HERO'].map((c, i) => `<span style="animation-delay:${1.6 + i * .2}s">${c}</span>`).join('')}</div>` },
 { d: 5600, h: 'Name the place', p: 'Tap a marker. Countries, seas, rivers and empires light up as you explore.', b: () => `<svg class="in-map" viewBox="0 0 600 340">${LAND}<path class="reg" d="M385 90 450 65 520 95 510 150 430 165z"/><path class="riv" d="M120 95C160 150 200 120 240 175"/>${PIN(160, 120, .8)}${PIN(450, 120, 1.1)}${PIN(255, 280, 1.4)}</svg>` },
 { d: 5000, h: 'Find the land', p: 'Given a name, find its place on the map before the clock runs out.', b: () => `<div class="in-chip">Find: The Nile</div><svg class="in-map" viewBox="0 0 600 340">${LAND}${PIN(160, 120, .3)}${PIN(450, 120, .5, 'ok')}<circle class="ring" cx="450" cy="120" r="9"/>${PIN(255, 280, .7)}</svg><svg class="in-cur" viewBox="0 0 24 24" fill="currentColor" style="left:calc(50% + 40px);top:50%"><path d="M4 2l16 9-7 2-3 7z"/></svg>` },
 { d: 4800, h: 'Lands forgotten', p: 'Hero remembers what you miss, then drills it back.', b: () => `<div class="in-card">${[['Carthage', 92, '5\u00d7'], ['Hormuz', 70, '4\u00d7'], ['Anatolia', 50, '3\u00d7']].map(([n, w, c], i) => `<div class="in-row" style="animation-delay:${i * .25}s">${n}<span class="bar2"><i style="--w:${w}%;animation-delay:${.5 + i * .25}s"></i></span><b>${c}</b></div>`).join('')}</div>` },
 { d: 4800, h: 'Hall of heroes', p: 'Beat the clock. Carve your name.', b: () => `<div class="in-card">${[['I', 'Cleopatra', '12,480'], ['II', 'Hannibal', '11,905'], ['III', 'Ibn Battuta', '10,760']].map(([r, n, s], i) => `<div class="in-row" style="animation-delay:${i * .3}s"><span style="color:#ffb454;width:34px">${r}</span>${n}<b>${s}</b></div>`).join('')}</div>` },
 { d: 5800, h: 'Meet Clio', p: 'Your muse of history. Ask anything, get a memory trick.', b: () => `<div class="in-card"><div class="in-bub me" style="animation-delay:.3s">Why does the Nile matter so much?</div><div class="in-bub ai" style="animation-delay:1.6s">Egypt is the gift of the Nile: its yearly flood fed a whole civilisation. Herodotus wrote that line 2,400 years ago.</div></div>` },
 { d: 4800, h: 'Make it yours', p: 'Six colorways, four fonts, ambient space music, and a Settings page for the rest.', b: () => `<div class="in-themes">${['#6b69e6', '#a8692a', '#7c3aed', '#ea580c', '#16a34a', '#e11d48'].map((c, i) => `<i style="background:${c};color:${c};animation-delay:${.2 + i * .15}s"></i>`).join('')}</div>` },
 { d: 4200, h: 'Set forth', p: 'Hall of Heroes \u00b7 Clio \u00b7 The Chronicle \u00b7 Your own charts', b: () => `<div class="in-go">Set Forth</div>` }
];
let introTimer = null;
function introEnd(showWelcome = false) {
    clearTimeout(introTimer); document.documentElement.classList.remove('intro-first'); const el = document.getElementById('intro'); if (!el) return;
    window.dispatchEvent(new CustomEvent('hero-intro-state', { detail: { playing: false } }));
    el.classList.add('out'); setTimeout(() => {
        el.remove();
        if (showWelcome && !localStorage.getItem('hero_welcome_seen')) showWelcomeCard();
        else if (window.tutMaybe) tutMaybe();
    }, 950);
}
function showWelcomeCard() {
    if (document.getElementById('hero-welcome')) return;
    const overlay = document.createElement('div');
    overlay.id = 'hero-welcome'; overlay.className = 'hero-welcome-backdrop';
    overlay.innerHTML = `<section class="hero-welcome-card glass-panel" role="dialog" aria-modal="true" aria-labelledby="hero-welcome-title" aria-describedby="hero-welcome-intro">
        <button type="button" class="hero-welcome-close" aria-label="Close welcome">&times;</button>
        <div class="hero-welcome-kicker">WELCOME TO HERO</div>
        <h2 id="hero-welcome-title">A better way to make places stick.</h2>
        <p id="hero-welcome-intro" class="hero-welcome-intro">The original Map Quiz Pro was a simple map quiz. Hero builds on it with more ways to explore, practice, and remember the places that matter.</p>
        <div class="hero-welcome-features">
          <article><i data-lucide="map-pin"></i><div><h3>Explore the map</h3><p>Name places or find them on the map. Countries, regions, rivers, seas, and historical empires can light up as you learn.</p></div></article>
          <article><i data-lucide="repeat-2"></i><div><h3>Practice that adapts</h3><p>Choose a one-year or two-year tour, try the shared Daily Challenge, and revisit places you have missed. Hints can help you get unstuck for a score cost.</p></div></article>
          <article><i data-lucide="sparkles"></i><div><h3>Learn your way</h3><p>Ask Clio for an explanation or memory trick. Pick a colorway and font, and tune the site's sound and display in Settings.</p></div></article>
          <article><i data-lucide="trophy"></i><div><h3>See your progress</h3><p>Compare scores on the Hall of Heroes, build a Daily Challenge streak, and make private charts from places you choose.</p></div></article>
        </div>
        <p class="hero-welcome-help">Found a bug or something confusing? Open <strong>Send a Word</strong> from the navigation and tell us what happened.</p>
        <div class="hero-welcome-actions"><button type="button" class="cm-btn ghost" data-welcome-feedback>Report an issue</button><button type="button" class="cm-btn go" data-welcome-close>Start exploring</button></div>
    </section>`;
    document.body.appendChild(overlay);
    if (window.lucide) lucide.createIcons();
    const finish = (feedback = false) => {
        localStorage.setItem('hero_welcome_seen', '1');
        if (overlay._welcomeKeyHandler) document.removeEventListener('keydown', overlay._welcomeKeyHandler);
        overlay.remove();
        if (feedback) switchView('feedback-view');
        else if (window.tutMaybe) tutMaybe();
    };
    overlay.querySelector('.hero-welcome-close').onclick = () => finish();
    overlay.querySelector('[data-welcome-close]').onclick = () => finish();
    overlay.querySelector('[data-welcome-feedback]').onclick = () => finish(true);
    overlay.addEventListener('click', (event) => { if (event.target === overlay) finish(); });
    overlay._welcomeKeyHandler = (event) => { if (event.key === 'Escape') finish(); };
    document.addEventListener('keydown', overlay._welcomeKeyHandler);
    overlay.querySelector('.hero-welcome-close').focus();
}
function introPlay(options = {}) {
    if (document.getElementById('intro')) return;
    const welcomeAfter = !!options.welcome && !localStorage.getItem('hero_welcome_seen');
    localStorage.setItem(introKey(), '1');
    window.dispatchEvent(new CustomEvent('hero-intro-state', { detail: { playing: true } }));
    const el = document.createElement('div'); el.id = 'intro';
    el.innerHTML = '<div class="in-stage"></div><div class="in-cap"></div><div class="in-white"></div>';
    document.body.appendChild(el);
    requestAnimationFrame(() => el.classList.add('on'));                    // site fades to white
    const show = i => {
        if (i >= INTRO_SCENES.length) return introEnd(welcomeAfter);
        const s = INTRO_SCENES[i];
        el.querySelector('.in-stage').innerHTML = s.b();
        el.querySelector('.in-cap').innerHTML = `<h2></h2><p></p>`; el.querySelector('.in-cap h2').textContent = s.h; el.querySelector('.in-cap p').textContent = s.p;
        introTimer = setTimeout(() => show(i + 1), s.d);
    };
    setTimeout(() => {
        el.classList.add('film');
        if (SITE.introVideo) {   // your own MP4 (see js/00-site-config.js); falls back to the built-in film if it can't load
            const v = document.createElement('video'); v.className = 'in-video'; v.src = SITE.introVideo; v.muted = false; v.autoplay = true; v.playsInline = true;
            v.onended = () => introEnd(welcomeAfter); v.onerror = () => { v.remove(); snd.remove(); show(0); };
            const snd = document.createElement('button'); snd.className = 'in-sound'; snd.textContent = 'Sound off'; snd.setAttribute('aria-label', 'Mute intro sound'); snd.onclick = () => { v.muted = !v.muted; snd.textContent = v.muted ? 'Sound on' : 'Sound off'; snd.setAttribute('aria-label', v.muted ? 'Enable intro sound' : 'Mute intro sound'); if (!v.muted) v.play().catch(() => {}); };
            el.append(v, snd); v.play().catch(() => { v.muted = true; snd.textContent = 'Tap for sound'; snd.setAttribute('aria-label', 'Enable intro sound'); }); return;
        }
        show(0);
    }, 1500);   // hold white, then reveal the night sky
}
{ const badge = document.getElementById('version-badge'); const build = document.querySelector('meta[name="hero-build-id"]')?.content; if (badge) badge.textContent = `HERO v${SITE.version}${build ? ' · BUILD ' + build : ''}`; }
{ const pw = document.getElementById('admin-password'); if (pw && !pw._enterBound) { pw._enterBound = true; pw.addEventListener('keydown', e => { if (e.key === 'Enter') unlockAdmin(); }); } }
(function introAuto() {
    if (document.documentElement.classList.contains('launch-locked')) return;
    const row = [...document.querySelectorAll('#settings-view .st-row')].find(r => r.textContent.includes('Replay the tutorial'));
    if (row) row.insertAdjacentHTML('afterend', '<div class="st-row" style="margin-top:10px"><div class="font-bold text-sm">Replay the intro film</div><button class="cm-btn ghost" onclick="introPlay()">Replay</button></div>');
    if (document.documentElement.classList.contains('intro-first')) return introPlay({ welcome: true });   // first visit: straight in, no loader
    if (localStorage.getItem(introKey()) || matchMedia('(prefers-reduced-motion: reduce)').matches || document.documentElement.classList.contains('in-frame')) return;
    const c = document.getElementById('site-cover'), go = () => setTimeout(() => { if (document.getElementById('dev-screen').classList.contains('hidden')) introPlay({ welcome: true }); }, 500);
    if (!c || c.classList.contains('hidden')) go();
    else new MutationObserver((m, o) => { if (c.classList.contains('hidden')) { o.disconnect(); go(); } }).observe(c, { attributes: true, attributeFilter: ['class'] });
})();
