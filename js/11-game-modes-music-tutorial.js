// ================= GAME MODES + WEAK SPOTS =================
        let gameMode = localStorage.getItem('hero_gm') === 'find' ? 'find' : 'identify', findQueue = [];
        const missKey = () => 'hero_miss_' + yearMode;
        const getMiss = () => { try { return JSON.parse(localStorage.getItem(missKey())) || {}; } catch (e) { return {}; } };
        function recordMiss(name) { const m = getMiss(); m[name] = { n: ((m[name] && m[name].n) || 0) + 1, t: Date.now() }; localStorage.setItem(missKey(), JSON.stringify(m)); missBadge(); }
        const topMissed = () => Object.entries(getMiss()).sort((a, b) => b[1].n - a[1].n || b[1].t - a[1].t).slice(0, 12);
        function missBadge() { const n = Object.keys(getMiss()).length; document.getElementById('miss-count').textContent = n ? `(${n})` : ''; }
        function setGameMode(m) { gameMode = m; localStorage.setItem('hero_gm', m); document.querySelectorAll('#mode-pick [data-gm]').forEach(b => b.classList.toggle('on', b.dataset.gm === m)); showToast(m === 'find' ? 'Find the region: you get a name, tap its marker.' : 'Identify: tap a marker, then name it.', 'info'); }
        function renderReview() {
            const list = document.getElementById('review-list'), rows = topMissed(); list.innerHTML = '';
            if (!rows.length) { list.innerHTML = '<p class="text-center text-slate-500 italic py-8">Nothing missed yet. Play a round and your weak spots will show up here.</p>'; return; }
            const max = rows[0][1].n;
            rows.forEach(([name, v]) => { const r = document.createElement('div'); r.className = 'rv-row'; r.innerHTML = `<span style="min-width:120px"></span><div class="bar"><i style="width:${Math.round(v.n / max * 100)}%"></i></div><span>${v.n}\u00d7</span>`; r.firstChild.textContent = name; list.appendChild(r); });
        }
        async function clearMisses() { if (!(await customConfirm({ title: 'Clear weak spots?', message: 'This forgets your missed places for this quiz on this device.', confirmText: 'Clear', danger: true }))) return; localStorage.removeItem(missKey()); renderReview(); missBadge(); }
        function findClick(marker, loc) {
            const t = findQueue[0]; if (!t || marker._done) return;
            if (loc.id === t.id) {
                const mk = quizStats[t.id].mistakes; points += mk === 0 ? 1000 : (mk === 1 ? 500 : 100); solvedCount++; quizStats[t.id].solved = true; marker._done = true;
                marker.setIcon(L.divIcon({ className: 'custom-div-icon', html: "<div class='marker-pin solved'></div>", iconSize: [26, 26], iconAnchor: [13, 13] }));
                document.getElementById('q-score').innerText = points.toLocaleString(); document.getElementById('q-solved').innerText = solvedCount;
                findQueue.shift(); findBanner();
                if (!findQueue.length) setTimeout(endQuizEarly, 900);
            } else { quizStats[t.id].mistakes++; recordMiss(t.name); badInput(document.getElementById('find-banner')); showToast("Not that one. Try again!", 'error'); }
        }
        function findBanner() {
            let b = document.getElementById('find-banner');
            if (gameMode !== 'find' || !findQueue.length) { if (b) b.remove(); return; }
            if (!b) { b = document.createElement('div'); b.id = 'find-banner'; document.getElementById('quiz-view').appendChild(b); }
            b.innerHTML = '<small></small><span></span>'; b.firstChild.textContent = findQueue[0].category || 'Find'; b.lastChild.textContent = findQueue[0].name;
        }
        const _sq2 = startQuiz;
        startQuiz = function (m) {
            if (m === 'review') {
                const names = new Set(topMissed().map(e => e[0])), list = store[yearMode].locs.filter(l => names.has(l.name));
                if (!list.length) return showToast('No missed places yet. Play a round first!', 'info');
                const saved = globalLocations; globalLocations = list; _sq2('default'); globalLocations = saved;
            } else _sq2(m);
            findQueue = gameMode === 'find' ? [...activeQuizData].sort(() => Math.random() - .5) : []; findBanner();
        };
        document.querySelector(`#mode-pick [data-gm="${gameMode}"]`).classList.add('on'); missBadge();

        // ================= AMBIENT MUSIC (generated, no audio files) =================
        if (prefs.music === undefined) { prefs.music = 'on'; prefs.vol = 35; }
        const mus = { ctx: null, master: null, bus: null, i: 0, timer: null };
        const CHORDS = [[110, 164.8, 220, 261.6, 329.6], [87.3, 130.8, 174.6, 220, 329.6], [130.8, 196, 246.9, 329.6, 392], [98, 146.8, 196, 246.9, 293.7]];
        function musicNote(f, t, dur) {
            const o = mus.ctx.createOscillator(), g = mus.ctx.createGain();
            o.type = Math.random() < .3 ? 'triangle' : 'sine'; o.frequency.value = f; o.detune.value = (Math.random() - .5) * 14;
            g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(.16, t + dur * .35); g.gain.linearRampToValueAtTime(0, t + dur);
            o.connect(g); g.connect(mus.bus); o.start(t); o.stop(t + dur + .1);
        }
        function musicChord() { const t = mus.ctx.currentTime; CHORDS[mus.i++ % 4].forEach((f, k) => musicNote(f, t + k * .6, 9)); if (Math.random() < .7) musicNote(CHORDS[mus.i % 4][4] * 2, t + 3 + Math.random() * 3, 5); }
        function musicSync() {
            const on = prefs.music !== 'off', vol = (prefs.vol == null ? 35 : prefs.vol) / 100 * .22;
            if (on && !mus.ctx && mus.armed) {
                const C = window.AudioContext || window.webkitAudioContext; if (!C) return;
                mus.ctx = new C(); mus.master = mus.ctx.createGain(); mus.master.gain.value = 0; mus.master.connect(mus.ctx.destination);
                const lp = mus.ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 900; mus.bus = lp;
                const dl = mus.ctx.createDelay(1.5), fb = mus.ctx.createGain(); dl.delayTime.value = .55; fb.gain.value = .5;
                lp.connect(mus.master); lp.connect(dl); dl.connect(fb); fb.connect(dl); dl.connect(mus.master);
                musicChord(); mus.timer = setInterval(musicChord, 8000);
            }
            if (mus.ctx) { mus.ctx.resume(); mus.master.gain.setTargetAtTime(on ? vol : 0, mus.ctx.currentTime, .8); }
            document.getElementById('sw-music').classList.toggle('on', on); document.getElementById('vol').value = prefs.vol == null ? 35 : prefs.vol; document.getElementById('vol').style.setProperty('--v', (prefs.vol == null ? 35 : prefs.vol) + '%');
        }
        const _ap = applyPrefs; applyPrefs = function () { _ap(); musicSync(); }; applyPrefs();
        ['pointerdown', 'keydown'].forEach(ev => addEventListener(ev, () => { if (!mus.armed) { mus.armed = true; musicSync(); } }, { once: true }));
        document.addEventListener('visibilitychange', () => { if (!mus.ctx) return; document.hidden ? mus.ctx.suspend() : (prefs.music !== 'off' && mus.ctx.resume()); });

        // ================= TUTORIAL =================
        const TUT = [['Welcome to Hero', 'Named for Herodotus, the "father of history". Learn the world one place at a time.', null],
            ['Pick your year', 'Switch between the 1 Year and 2 Year quizzes here. Each has its own places and leaderboard.', '#year-toggle'],
            ['Choose how to play', 'Identify: tap a marker and name it. Find the region: you get a name and tap its marker. Review missed replays your weak spots.', '#mode-pick'],
            ['Meet Clio', 'Clio, the muse of history, answers questions and gives memory tricks.', '#sherpa-fab'],
            ['Make it yours', 'Colorways, backgrounds, fonts and music are in Settings.', '#settings-btn']];
        let tutI = 0;
        function tutStart() { tutI = 0; switchView('home-view'); setTimeout(tutShow, 400); }
        function tutShow() {
            document.querySelectorAll('.tut-hl').forEach(e => e.classList.remove('tut-hl'));
            let c = document.getElementById('tut'); if (!c) { c = document.createElement('div'); c.id = 'tut'; c.className = 'glass-panel'; document.body.appendChild(c); }
            const [t, d, sel] = TUT[tutI], last = tutI === TUT.length - 1;
            c.innerHTML = `<h3 class="text-lg font-extrabold"></h3><p class="text-sm text-slate-500 dark:text-slate-400 font-medium mt-1"></p><div class="tut-dots">${TUT.map((_, i) => `<i class="${i === tutI ? 'on' : ''}"></i>`).join('')}</div>
                <div class="flex gap-2 mt-4 justify-end"><button class="cm-btn ghost" id="tut-skip">${last ? '' : 'Skip'}</button>${tutI ? '<button class="cm-btn ghost" id="tut-back">Back</button>' : ''}<button class="cm-btn go" id="tut-next">${last ? 'Done' : 'Next'}</button></div>`;
            c.querySelector('h3').textContent = t; c.querySelector('p').textContent = d;
            if (last) c.querySelector('#tut-skip').remove();
            const el = sel && document.querySelector(sel); if (el) el.classList.add('tut-hl');
            const skip = c.querySelector('#tut-skip'); if (skip) skip.onclick = tutEnd;
            const back = c.querySelector('#tut-back'); if (back) back.onclick = () => { tutI--; tutShow(); };
            c.querySelector('#tut-next').onclick = () => { if (last) tutEnd(); else { tutI++; tutShow(); } };
        }
        function tutEnd() { localStorage.setItem('hero_tut', '1'); document.querySelectorAll('.tut-hl').forEach(e => e.classList.remove('tut-hl')); const c = document.getElementById('tut'); if (c) c.remove(); }
        window.tutMaybe = () => { if (!localStorage.getItem('hero_tut') && consent && document.getElementById('dev-screen').classList.contains('hidden') && document.getElementById('changelog-popup').classList.contains('hidden')) tutShow(); };
        setTimeout(tutMaybe, 5200);

        // ================= CUSTOM DROPDOWNS (desktop only; phones keep native pickers) =================
        function csSyncAll() { document.querySelectorAll('.cs-wrap').forEach(w => w._sync && w._sync()); }
        if (!matchMedia('(pointer: coarse)').matches && !document.documentElement.classList.contains('is-mobile')) {
            document.querySelectorAll('select.fb-input').forEach(sel => {
                const wrap = sel.closest('.fb-select-wrap'); if (!wrap) return;
                wrap.classList.add('cs-wrap'); sel.classList.add('cs-native');
                const btn = document.createElement('button'); btn.type = 'button'; btn.className = 'fb-input cs-btn'; btn.style.cssText = sel.style.cssText;
                const menu = document.createElement('div'); menu.className = 'cs-menu';
                const sync = () => { btn.textContent = sel.options[sel.selectedIndex].textContent; menu.querySelectorAll('.cs-opt').forEach((o, i) => o.classList.toggle('on', i === sel.selectedIndex)); };
                [...sel.options].forEach((op, i) => { const o = document.createElement('div'); o.className = 'cs-opt'; o.textContent = op.textContent; o.onclick = () => { sel.selectedIndex = i; sel.dispatchEvent(new Event('change', { bubbles: true })); sync(); wrap.classList.remove('open'); }; menu.appendChild(o); });
                btn.onclick = e => { e.stopPropagation(); document.querySelectorAll('.cs-wrap.open').forEach(w => w !== wrap && w.classList.remove('open')); sync(); wrap.classList.toggle('open'); };
                wrap.append(btn, menu); wrap._sync = sync; sync();
            });
            document.addEventListener('click', () => document.querySelectorAll('.cs-wrap.open').forEach(w => w.classList.remove('open')));
            document.addEventListener('keydown', e => { if (e.key === 'Escape') document.querySelectorAll('.cs-wrap.open').forEach(w => w.classList.remove('open')); });
        }
        const _sv3 = switchView; switchView = function (id) { _sv3(id); if (id === 'review-view') renderReview(); csSyncAll(); missBadge(); };
        const _ym = setYearMode; setYearMode = function (k) { _ym(k); missBadge(); };
