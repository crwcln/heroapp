        const FAM_MODES = {
            quick: { label: 'Quick', reps: 3 },
            standard: { label: 'Standard', reps: 5 },
            deep: { label: 'Deep', reps: 10 },
            missed: { label: 'Missed only', reps: 5 }
        };
        const famState = { tour: 'default', mode: 'standard', queue: [], index: 0, seen: {} };
        const famDrill = { active: false, pending: false, target: null, key: '', reps: 5, done: 0, mode: 'standard', savedRandom: false };
        const famMissKeyPattern = /^hero_miss_(default|twoyear)(?:_guest_.+)?$/;
        const famName = loc => String(loc && (loc.name || loc.title) || 'Unnamed place');
        const famKey = loc => famName(loc).trim().toLocaleLowerCase();
        const famIsDone = value => value === true || !!(value && value.done);
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
        function famSourceList(mode) {
            const source = mode === 'custom' ? customLocations : globalLocations;
            return Array.isArray(source) ? source.slice() : [];
        }
        function famSmartQueue(list, tour, famMode) {
            const misses = famReadMisses(tour), seen = famReadSeen(tour);
            return list.map((loc, index) => {
                const key = famKey(loc), miss = misses[famName(loc)] || misses[key];
                return { loc, key, index, missCount: Number(miss?.n) || 0, missTime: Number(miss?.t) || 0, done: famIsDone(seen[key]) };
            }).filter(item => !item.done && (famMode !== 'missed' || item.missCount > 0)).sort((a, b) =>
                (b.missCount - a.missCount) ||
                (b.missTime - a.missTime) ||
                (Number(seen[a.key]?.previewed) - Number(seen[b.key]?.previewed)) ||
                (a.index - b.index)
            );
        }
        function famSetText(id, value) {
            const el = document.getElementById(id);
            if (el) el.textContent = value == null ? '' : String(value);
        }
        function famSetHidden(id, hidden) {
            const el = document.getElementById(id);
            if (el) el.classList.toggle('hidden', !!hidden);
        }
        function famSyncModeChips() {
            document.querySelectorAll('#fam-mode-pick [data-fam-mode]').forEach(button => button.classList.toggle('on', button.dataset.famMode === famState.mode));
        }
        function famRender() {
            const total = famState.queue.length;
            const current = famState.queue[famState.index];
            const reps = FAM_MODES[famState.mode]?.reps || 5;
            famSetText('fam-progress', current ? `Target ${famState.index + 1} of ${total} · 0/${reps} finds` : `${total} of ${total} learned`);
            const track = document.getElementById('fam-track-fill');
            if (track) track.style.width = `${total ? (current ? famState.index / total : 1) * 100 : 0}%`;
            if (!current) {
                famSetText('fam-category', 'Familiarization complete');
                famSetText('fam-name', total ? 'All targets learned' : (famState.mode === 'missed' ? 'No missed places yet' : 'No places to practice'));
                famSetText('fam-region', total ? `${total} place${total === 1 ? '' : 's'} are marked familiar for this tour.` : (famState.mode === 'missed' ? 'Play a quiz first, then try missed only again.' : 'Add places to this tour first.'));
                famSetText('fam-reason', 'Each place drops out after its find drill. Reset if you want another pass.');
                famSetText('fam-tip', 'Start the quiz now while the names and places are fresh.');
                famSetHidden('fam-drill-btn', true);
                famSetHidden('fam-next-btn', true);
                famSetHidden('fam-again-btn', true);
                famSetHidden('fam-reset-btn', false);
                famSetHidden('fam-quiz-btn', false);
                return;
            }
            const loc = current.loc;
            const meta = [loc.region, loc.country, loc.continent].filter(Boolean);
            if (loc.year) meta.push(String(loc.year));
            famSetText('fam-category', loc.category || 'Place');
            famSetText('fam-name', famName(loc));
            famSetText('fam-region', meta.join(' · ') || 'No region note saved for this place.');
            famSetText('fam-reason', current.repeat ? 'Previewing this place again before its drill.' : (current.missCount ? `Weak spot — missed ${current.missCount} time${current.missCount === 1 ? '' : 's'}.` : (current.done ? 'Review to keep it fresh.' : 'New to this tour.')));
            famSetText('fam-tip', loc.fact || loc.description || loc.hint || loc.mnemonic || 'Find this place on the map, then say its name aloud before the drill.');
            famSetText('fam-drill-btn', `Find it ${reps}×`);
            famSetText('fam-next-btn', famState.index === total - 1 ? 'Finish preview' : 'Next place');
            famSetHidden('fam-drill-btn', false);
            famSetHidden('fam-next-btn', false);
            famSetHidden('fam-again-btn', false);
            famSetHidden('fam-reset-btn', true);
            famSetHidden('fam-quiz-btn', true);
        }
        function famRemoveBanner() {
            document.getElementById('fam-drill-banner')?.remove();
            document.getElementById('find-banner')?.remove();
        }
        function famDrillBanner() {
            if (!famDrill.active || !famDrill.target) return famRemoveBanner();
            let banner = document.getElementById('fam-drill-banner');
            if (!banner) {
                banner = document.createElement('div');
                banner.id = 'fam-drill-banner';
                document.getElementById('quiz-view')?.appendChild(banner);
            }
            if (!banner) return;
            banner.innerHTML = '<small></small><strong></strong>';
            banner.firstChild.textContent = `${FAM_MODES[famDrill.mode]?.label || 'Familiarize'} drill`;
            banner.lastChild.textContent = `Find ${famName(famDrill.target)} · ${famDrill.done}/${famDrill.reps}`;
            famRemoveBaseFindBanner();
            const solved = document.getElementById('q-solved'), total = document.getElementById('q-total');
            if (solved) solved.textContent = String(famDrill.done);
            if (total) total.textContent = String(famDrill.reps);
        }
        function famRemoveBaseFindBanner() {
            document.getElementById('find-banner')?.remove();
        }
        function famFinishDrill(marker) {
            const target = famDrill.target;
            famDrill.active = false;
            famDrill.pending = false;
            const seen = famReadSeen(famState.tour);
            const previous = seen[famDrill.key] || {};
            seen[famDrill.key] = { done: true, reps: Math.max(Number(previous.reps) || 0, famDrill.reps), last: Date.now(), mode: famDrill.mode };
            famWriteSeen(famState.tour, seen);
            famState.seen = seen;
            famState.index += 1;
            if (marker && marker.setIcon && typeof L !== 'undefined') marker.setIcon(L.divIcon({ className: 'custom-div-icon', html: "<div class='marker-pin solved'></div>", iconSize: [26, 26], iconAnchor: [13, 13] }));
            setTimeout(() => {
                famRemoveBanner();
                if (typeof timerInterval !== 'undefined') clearInterval(timerInterval);
                switchView('familiarize-view');
                famRender();
                showToast(`Familiar with ${famName(target)}.`, 'success');
            }, 650);
        }
        function famDrillClick(marker, loc) {
            const target = famDrill.target;
            if (!target || marker._famDone) return;
            if (loc.id !== target.id) {
                const stat = quizStats[target.id];
                if (stat) stat.mistakes += 1;
                if (typeof recordMiss === 'function') recordMiss(famName(target));
                if (typeof badInput === 'function') badInput(document.getElementById('fam-drill-banner'));
                showToast('Not that one. Try again!', 'error');
                return;
            }
            famDrill.done += 1;
            points += 1000;
            const stat = quizStats[target.id];
            if (stat) stat.solved = true;
            if (typeof updateScoreDisplay === 'function') updateScoreDisplay();
            const pin = marker.getElement && marker.getElement();
            if (pin) {
                pin.classList.remove('fam-hit');
                void pin.offsetWidth;
                pin.classList.add('fam-hit');
                setTimeout(() => pin.classList.remove('fam-hit'), 180);
            }
            famDrillBanner();
            if (famDrill.done >= famDrill.reps) {
                marker._famDone = true;
                famFinishDrill(marker);
            }
        }
        const famBaseStartQuiz = typeof startQuiz === 'function' ? startQuiz : null;
        if (famBaseStartQuiz) {
            startQuiz = function (mode) {
                if (!famDrill.pending) return famBaseStartQuiz(mode);
                famDrill.pending = false;
                const random = document.getElementById('rand-locs');
                famDrill.savedRandom = !!(random && random.checked);
                if (random) random.checked = false;
                const savedDaily = typeof dailyLaunch === 'undefined' ? false : dailyLaunch;
                if (typeof dailyLaunch !== 'undefined') dailyLaunch = false;
                if (typeof setGameMode === 'function') setGameMode('find');
                const result = famBaseStartQuiz(mode);
                if (typeof dailyLaunch !== 'undefined') dailyLaunch = savedDaily;
                if (random) random.checked = famDrill.savedRandom;
                findQueue = [];
                famDrill.active = true;
                famDrillBanner();
                return result;
            };
        }
        const famBaseFindClick = typeof findClick === 'function' ? findClick : null;
        if (famBaseFindClick) {
            findClick = function (marker, loc) {
                if (famDrill.active) return famDrillClick(marker, loc);
                return famBaseFindClick(marker, loc);
            };
        }
        const famBaseSwitchView = typeof switchView === 'function' ? switchView : null;
        if (famBaseSwitchView) {
            switchView = function (id) {
                if (famDrill.active && id !== 'quiz-view') {
                    famDrill.active = false;
                    famDrill.pending = false;
                    famRemoveBanner();
                    if (typeof timerInterval !== 'undefined') clearInterval(timerInterval);
                }
                return famBaseSwitchView(id);
            };
        }
        window.startFamiliarize = function (tour = 'default') {
            const savedMode = localStorage.getItem('hero_fam_mode');
            famState.tour = FAM_MODES[tour] ? 'default' : (tour || 'default');
            famState.mode = FAM_MODES[savedMode] ? savedMode : famState.mode;
            const list = famSourceList(famState.tour);
            if (!list.length) { showToast('Add some places to this tour before familiarizing yourself with it.', 'info'); return; }
            famState.seen = famReadSeen(famState.tour);
            famState.queue = famSmartQueue(list, famState.tour, famState.mode);
            famState.index = 0;
            famSyncModeChips();
            famRender();
            switchView('familiarize-view');
            if (!famState.queue.length) showToast(famState.mode === 'missed' ? 'No missed places yet. Pick another mode.' : 'Every place is already familiar. Reset to practice again.', 'info');
        };
        window.familiarizeSetMode = function (mode) {
            if (!FAM_MODES[mode]) return;
            famState.mode = mode;
            try { localStorage.setItem('hero_fam_mode', mode); } catch (_) {}
            famSyncModeChips();
            famState.queue = famSmartQueue(famSourceList(famState.tour), famState.tour, mode);
            famState.index = 0;
            famRender();
        };
        window.familiarizeDrill = function () {
            const current = famState.queue[famState.index];
            if (!current) return;
            if (!famBaseStartQuiz) return showToast('The quiz is not ready yet.', 'error');
            famDrill.target = current.loc;
            famDrill.key = current.key;
            famDrill.reps = FAM_MODES[famState.mode]?.reps || 5;
            famDrill.done = 0;
            famDrill.mode = famState.mode;
            famDrill.pending = true;
            startQuiz(famState.tour);
        };
        window.familiarizeAgain = function () {
            const current = famState.queue[famState.index];
            if (!current) return;
            famState.queue.splice(famState.index + 1, 0, { ...current, repeat: true });
            const seen = famReadSeen(famState.tour);
            seen[current.key] = { ...(seen[current.key] || {}), previewed: Date.now() };
            famWriteSeen(famState.tour, seen);
            const card = document.querySelector('#familiarize-view .fam-card');
            if (card) {
                card.classList.remove('replay');
                void card.offsetWidth;
                card.classList.add('replay');
            }
            famRender();
            showToast('Added another preview right after this one.', 'info');
        };
        window.familiarizeNext = function () {
            if (!famState.queue[famState.index]) return;
            famState.index += 1;
            famRender();
        };
        window.familiarizeBack = function () { switchView('home-view'); };
        window.familiarizeQuiz = function () { startQuiz(famState.tour); };
        window.familiarizeReset = async function () {
            const message = 'Clear the learned marks for this tour and show every place again?';
            const ok = typeof customConfirm === 'function' ? await customConfirm({ title: 'Reset familiarization?', message, confirmText: 'Reset', danger: true }) : confirm(message);
            if (!ok) return;
            try { localStorage.removeItem('hero_familiarize_seen_' + famState.tour); } catch (_) {}
            famState.seen = {};
            famState.queue = famSmartQueue(famSourceList(famState.tour), famState.tour, famState.mode);
            famState.index = 0;
            famRender();
            showToast('Familiarization reset for this tour.', 'success');
        };
        famSyncModeChips();
