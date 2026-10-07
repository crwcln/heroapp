// ================= 1 YEAR / 2 YEAR MODE =================
        const QUIZZES = {
            default: { doc: 'defaultQuiz', lb: 'leaderboard',        custom: 'mapQuizCustom',     seen: 'mq_lastSeenMsg',   label: '1 Year', defTitle: 'The Grand Tour',   startLabel: 'Begin the 1 Year Tour',   rankLabel: '1 Year Rankings',   setupTitle: '1 Year Tour Setup' },
            twoyear: { doc: 'twoYearQuiz', lb: 'leaderboardTwoYear', custom: 'mapQuizCustom2Year', seen: 'mq_lastSeenMsg2Y', label: '2 Year', defTitle: 'The Second Tour',   startLabel: 'Begin the 2 Year Tour',   rankLabel: '2 Year Rankings',   setupTitle: '2 Year Quiz Setup' }
        };
        let yearMode = localStorage.getItem('mq_yearMode') === 'twoyear' ? 'twoyear' : 'default';
        const store = {
            default: { locs: [], title: QUIZZES.default.defTitle, msg: '' },
            twoyear: { locs: [], title: QUIZZES.twoyear.defTitle, msg: '' }
        };
        let lbUnsub = null;

        function syncToggleUI() {
            const two = yearMode === 'twoyear';
            document.getElementById('year-pill').classList.toggle('translate-x-full', two);
            const on = 'text-white', off = 'text-slate-600 dark:text-slate-300';
            document.getElementById('yr-btn-default').className = document.getElementById('yr-btn-default').className.replace(/text-white|text-slate-600 dark:text-slate-300/g, '').trim() + ' ' + (two ? off : on);
            document.getElementById('yr-btn-twoyear').className = document.getElementById('yr-btn-twoyear').className.replace(/text-white|text-slate-600 dark:text-slate-300/g, '').trim() + ' ' + (two ? on : off);
        }

        // Pushes the current mode's data into the existing UI/state variables
        function applyMode() {
            const s = store[yearMode], q = QUIZZES[yearMode];
            globalLocations = s.locs;
            globalQuizTitle = s.title;
            currentGlobalMessage = s.msg;

            document.getElementById('global-quiz-title').innerText = s.title;
            document.getElementById('global-quiz-count').innerText = `${s.locs.length} locations`;
            document.getElementById('admin-quiz-title').value = s.title;
            document.getElementById('admin-global-msg').value = s.msg;
            document.getElementById('start-quiz-label').innerText = q.startLabel;
            document.getElementById('lb-rank-label').innerText = q.rankLabel;
            document.getElementById('admin-setup-title').innerText = q.setupTitle;

            const modal = document.getElementById('global-msg-modal');
            const mini = document.getElementById('global-msg-minimized');
            if (s.msg.trim() !== '') {
                if (localStorage.getItem(q.seen) !== s.msg) {
                    document.getElementById('global-msg-text').innerText = s.msg;
                    modal.classList.remove('hidden');
                    mini.classList.add('hidden');
                } else {
                    document.getElementById('global-msg-min-text').innerText = s.msg;
                    mini.classList.remove('hidden');
                    modal.classList.add('hidden');
                }
            } else {
                modal.classList.add('hidden');
                mini.classList.add('hidden');
            }
            renderAdminList();
        }

        function setYearMode(k) {
            if (k === yearMode) return;
            yearMode = k;
            localStorage.setItem('mq_yearMode', k);
            syncToggleUI();
            const vis = document.querySelector('.view-section:not(.hidden)');
            if (vis && (vis.id === 'quiz-view' || vis.id === 'summary-view')) switchView('home-view');
            customLocations = JSON.parse(localStorage.getItem(QUIZZES[k].custom)) || [];
            renderUserCustomList();
            applyMode();
            loadLeaderboard();
        }

        document.addEventListener('DOMContentLoaded', () => { syncToggleUI(); applyMode(); });
