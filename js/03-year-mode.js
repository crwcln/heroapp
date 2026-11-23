// ================= 1 YEAR / 2 YEAR MODE =================
        const QUIZZES = {
            default: { doc: 'defaultQuiz', lb: 'guestLeaderboardOneYear', custom: 'mapQuizCustom',     seen: 'mq_lastSeenMsg',   label: '1 Year', defTitle: 'The Grand Tour',   startLabel: 'Set Forth: Year One',   rankLabel: 'Hall of Heroes: Year One',   setupTitle: '1 Year Tour Setup' },
            twoyear: { doc: 'twoYearQuiz', lb: 'guestLeaderboardTwoYear', custom: 'mapQuizCustom2Year', seen: 'mq_lastSeenMsg2Y', label: '2 Year', defTitle: 'The Second Tour',   startLabel: 'Set Forth: Year Two',   rankLabel: 'Hall of Heroes: Year Two',   setupTitle: '2 Year Quiz Setup' }
        };
        let yearMode = localStorage.getItem('mq_yearMode') === 'twoyear' ? 'twoyear' : 'default';
        const store = {
            default: { locs: [], title: QUIZZES.default.defTitle, msg: '' },
            twoyear: { locs: [], title: QUIZZES.twoyear.defTitle, msg: '' }
        };
        let lbUnsub = null;

        let yearTextSequence = 0;
        const yearMotionDisabled = () => document.documentElement.dataset.motion === 'off' || window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
        function animateYearTitle(el, value, enabled) {
            if (!el) return;
            const sequence = ++yearTextSequence;
            if (el._yearFrame) cancelAnimationFrame(el._yearFrame);
            if (!enabled || yearMotionDisabled()) { el.textContent = value; el.classList.remove('year-title-decoding'); el.removeAttribute('aria-label'); return; }
            const chars = Array.from(String(value));
            const glyphs = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
            const spans = chars.map((char, index) => {
                if (char === ' ') return document.createTextNode(' ');
                const span = document.createElement('span');
                span.className = 'year-letter-roll';
                span.setAttribute('aria-hidden', 'true');
                span.style.setProperty('--letter-delay', `${Math.min(index * 18, 220)}ms`);
                span.textContent = glyphs[Math.floor(Math.random() * glyphs.length)];
                return span;
            });
            el.setAttribute('aria-label', value);
            el.classList.add('year-title-decoding');
            el.replaceChildren(...spans);
            const started = performance.now(), duration = 650;
            const draw = now => {
                if (sequence !== yearTextSequence || !el.isConnected) return;
                const progress = Math.min(1, (now - started) / duration);
                const settled = Math.floor(Math.max(0, Math.min(1, (progress - .12) / .82)) * chars.length);
                spans.forEach((span, index) => {
                    if (chars[index] === ' ') return;
                    span.textContent = index < settled || progress === 1 ? chars[index] : glyphs[Math.floor(Math.random() * glyphs.length)];
                });
                if (progress < 1) el._yearFrame = requestAnimationFrame(draw);
                else { el.textContent = value; el.classList.remove('year-title-decoding'); el.removeAttribute('aria-label'); el._yearFrame = 0; }
            };
            el._yearFrame = requestAnimationFrame(draw);
        }
        function rollYearNumber(el, target, suffix = '', enabled = true) {
            if (!el) return;
            const sequence = Number(el.dataset.yearRollSequence || 0) + 1;
            el.dataset.yearRollSequence = String(sequence);
            if (el._yearFrame) cancelAnimationFrame(el._yearFrame);
            const start = Number((String(el.textContent).match(/-?\d[\d,]*/) || ['0'])[0].replace(/,/g, '')) || 0;
            target = Number(target) || 0;
            if (!enabled || yearMotionDisabled() || start === target) { el.textContent = `${target.toLocaleString()}${suffix}`; el.classList.remove('year-number-rolling'); return; }
            el.classList.add('year-number-rolling');
            const started = performance.now(), duration = 620;
            const draw = now => {
                if (Number(el.dataset.yearRollSequence) !== sequence || !el.isConnected) return;
                const progress = Math.min(1, (now - started) / duration), eased = 1 - Math.pow(1 - progress, 4);
                const current = Math.round(start + (target - start) * eased);
                el.textContent = `${current.toLocaleString()}${suffix}`;
                if (progress < 1) el._yearFrame = requestAnimationFrame(draw);
                else { el.textContent = `${target.toLocaleString()}${suffix}`; el.classList.remove('year-number-rolling'); el._yearFrame = 0; }
            };
            el._yearFrame = requestAnimationFrame(draw);
        }
        function animateYearLabel(el, text, enabled) {
            if (!el) return;
            el.textContent = text;
            if (!enabled || yearMotionDisabled()) return;
            el.classList.remove('year-label-roll');
            void el.offsetWidth;
            el.classList.add('year-label-roll');
            setTimeout(() => el.classList.remove('year-label-roll'), 480);
        }

        function syncToggleUI() {
            const two = yearMode === 'twoyear';
            document.getElementById('year-pill').classList.toggle('translate-x-full', two);
            const on = 'text-white', off = 'text-slate-600 dark:text-slate-300';
            document.getElementById('yr-btn-default').className = document.getElementById('yr-btn-default').className.replace(/text-white|text-slate-600 dark:text-slate-300/g, '').trim() + ' ' + (two ? off : on);
            document.getElementById('yr-btn-twoyear').className = document.getElementById('yr-btn-twoyear').className.replace(/text-white|text-slate-600 dark:text-slate-300/g, '').trim() + ' ' + (two ? on : off);
        }

        // Pushes the current mode's data into the existing UI/state variables
        function applyMode(animate = false) {
            const s = store[yearMode], q = QUIZZES[yearMode];
            globalLocations = s.locs;
            if (window.markLocationsClean) markLocationsClean();
            globalQuizTitle = s.title;
            currentGlobalMessage = s.msg;

            animateYearTitle(document.getElementById('global-quiz-title'), s.title, animate);
            rollYearNumber(document.getElementById('global-quiz-count'), s.locs.length, ' locations', animate);
            const homePanel = document.querySelector('#home-view > .glass-panel');
            if (homePanel) homePanel.dataset.yearMode = yearMode;
            const adminTitle = document.getElementById('admin-quiz-title'), adminMsg = document.getElementById('admin-global-msg'), setupTitle = document.getElementById('admin-setup-title');
            if (adminTitle) adminTitle.value = s.title;
            if (adminMsg) adminMsg.value = s.msg;
            animateYearLabel(document.getElementById('start-quiz-label'), q.startLabel, animate);
            animateYearLabel(document.getElementById('lb-rank-label'), q.rankLabel, animate);
            if (setupTitle) setupTitle.innerText = q.setupTitle;

            renderAdminList();
            window.dispatchEvent(new CustomEvent('hero-location-data-ready', { detail: { yearMode, count: s.locs.length } }));
        }

        function setYearMode(k) {
            if (k === yearMode) return;
            yearMode = k;
            localStorage.setItem('mq_yearMode', k);
            syncToggleUI();
            const vis = document.querySelector('.view-section:not(.hidden)');
            if (vis && (vis.id === 'quiz-view' || vis.id === 'summary-view')) switchView('home-view');
            customLocations = JSON.parse(localStorage.getItem(QUIZZES[k].custom)) || [];
            const animate = !yearMotionDisabled();
            const panel = document.querySelector('#home-view > .glass-panel');
            if (panel) panel.classList.toggle('year-card-changing', animate);
            renderUserCustomList(animate);
            applyMode(animate);
            if (panel && animate) setTimeout(() => panel.classList.remove('year-card-changing'), 560);
            loadLeaderboard();
        }

        document.addEventListener('DOMContentLoaded', () => { syncToggleUI(); applyMode(); });
