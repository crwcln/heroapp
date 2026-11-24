        const famState = { mode: 'default', queue: [], index: 0, seen: {} };
        const famMissKeyPattern = /^hero_miss_(default|twoyear)(?:_guest_.+)?$/;
        const famName = loc => String(loc && (loc.name || loc.title) || 'Unnamed place');
        const famKey = loc => famName(loc).trim().toLocaleLowerCase();
        function famReadMisses(mode) {
            const out = {};
            try {
                for (let i = 0; i < localStorage.length; i++) {
                    const key = localStorage.key(i) || '';
                    if (!famMissKeyPattern.test(key) || !key.includes(mode)) continue;
                    const values = JSON.parse(localStorage.getItem(key) || '{}');
                    Object.entries(values).forEach(([name, stat]) => {
                        const n = Math.max(Number(out[name]?.n) || 0, Number(stat?.n) || 0);
                        const t = Math.max(Number(out[name]?.t) || 0, Number(stat?.t) || 0);
                        if (n > 0) out[name] = { n, t };
                    });
                }
            } catch (_) {}
            return out;
        }
        function famReadSeen(mode) {
            try { return JSON.parse(localStorage.getItem('hero_familiarize_seen_' + mode) || '{}') || {}; } catch (_) { return {}; }
        }
        function famWriteSeen(mode, seen) {
            try { localStorage.setItem('hero_familiarize_seen_' + mode, JSON.stringify(seen || {})); } catch (_) {}
        }
        function famSmartQueue(list, mode) {
            const misses = famReadMisses(mode), seen = famReadSeen(mode);
            return list.map((loc, index) => {
                const key = famKey(loc), miss = misses[famName(loc)] || misses[key];
                return { loc, key, index, missCount: Number(miss?.n) || 0, missTime: Number(miss?.t) || 0, seen: !!seen[key] };
            }).sort((a, b) =>
                (b.missCount - a.missCount) ||
                (b.missTime - a.missTime) ||
                (Number(a.seen) - Number(b.seen)) ||
                (a.index - b.index)
            );
        }
        function famSetText(id, value) {
            const el = document.getElementById(id);
            if (el) el.textContent = value == null ? '' : String(value);
        }
        function famRender() {
            const total = famState.queue.length;
            const current = famState.queue[famState.index];
            famSetText('fam-progress', current ? `${famState.index + 1} of ${total}` : `${total} of ${total}`);
            const track = document.getElementById('fam-track-fill');
            if (track) track.style.width = `${total ? (current ? famState.index / total : 1) * 100 : 0}%`;
            const next = document.getElementById('fam-next-btn'), quiz = document.getElementById('fam-quiz-btn');
            if (!current) {
                famSetText('fam-category', 'Familiarization complete');
                famSetText('fam-name', 'Ready for the quiz');
                famSetText('fam-region', `${total} place${total === 1 ? '' : 's'} reviewed in this guided pass.`);
                famSetText('fam-reason', 'Weak spots came first, then unseen places, then a quick refresh.');
                famSetText('fam-tip', 'Start the quiz now while the names and places are fresh.');
                if (next) next.classList.add('hidden');
                if (quiz) quiz.classList.remove('hidden');
                return;
            }
            const loc = current.loc;
            const meta = [loc.region, loc.country, loc.continent].filter(Boolean);
            if (loc.year) meta.push(String(loc.year));
            famSetText('fam-category', loc.category || 'Place');
            famSetText('fam-name', famName(loc));
            famSetText('fam-region', meta.join(' · ') || 'No region note saved for this place.');
            famSetText('fam-reason', current.repeat ? 'One more look — you asked to see this place again.' : (current.missCount ? `Weak spot — missed ${current.missCount} time${current.missCount === 1 ? '' : 's'}.` : (current.seen ? 'Review to keep it fresh.' : 'New to this tour.')));
            famSetText('fam-tip', loc.fact || loc.description || loc.hint || loc.mnemonic || 'Picture its position on the map, then say the name aloud before the quiz.');
            if (next) { next.classList.remove('hidden'); next.textContent = famState.index === total - 1 ? 'Finish' : 'Got it'; }
            if (quiz) quiz.classList.add('hidden');
        }
        window.startFamiliarize = function (mode = 'default') {
            const source = mode === 'custom' ? customLocations : globalLocations;
            const list = Array.isArray(source) ? source.slice() : [];
            if (!list.length) { showToast('Add some places to this tour before familiarizing yourself with it.', 'info'); return; }
            famState.mode = mode;
            famState.seen = famReadSeen(mode);
            famState.queue = famSmartQueue(list, mode);
            famState.index = 0;
            famRender();
            switchView('familiarize-view');
        };
        window.familiarizeAgain = function () {
            const current = famState.queue[famState.index];
            if (!current) return;
            famState.queue.splice(famState.index + 1, 0, { ...current, repeat: true });
            famState.seen[current.key] = false;
            famWriteSeen(famState.mode, famState.seen);
            const card = document.querySelector('#familiarize-view .fam-card');
            if (card) {
                card.classList.remove('replay');
                void card.offsetWidth;
                card.classList.add('replay');
            }
            famRender();
            showToast('Queued for another look right after this one.', 'info');
        };
        window.familiarizeNext = function () {
            const current = famState.queue[famState.index];
            if (!current) return;
            famState.seen[current.key] = true;
            famWriteSeen(famState.mode, famState.seen);
            famState.index += 1;
            famRender();
        };
        window.familiarizeBack = function () { switchView('home-view'); };
        window.familiarizeQuiz = function () {
            famState.queue.forEach(item => { famState.seen[item.key] = true; });
            famWriteSeen(famState.mode, famState.seen);
            const mode = famState.mode;
            if (typeof startQuiz === 'function') startQuiz(mode);
        };
