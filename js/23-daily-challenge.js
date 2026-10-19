// ================= DAILY CHALLENGE =================
// One UTC-dated, deterministic seven-place round shared by all players.
(function () {
    const DAY_MS = 86400000;
    const dateKey = (date = new Date()) => date.toISOString().slice(0, 10);
    const previousDay = (day) => dateKey(new Date(new Date(`${day}T00:00:00Z`).getTime() - DAY_MS));
    const dailyCollection = () => db.collection('artifacts').doc(appId).collection('public').doc('data').collection('dailyChallenges');
    let activeDay = null;
    let dailyLaunch = false;
    let selectedForDay = [];

    const stableId = (loc) => String(loc.id || `${loc.name}|${loc.lat}|${loc.lng}`);
    const hash = (text) => {
        let h = 2166136261;
        for (let i = 0; i < text.length; i++) { h ^= text.charCodeAt(i); h = Math.imul(h, 16777619); }
        return h >>> 0;
    };
    function challengeFor(locations, day) {
        const seen = new Set();
        const pool = locations.filter((loc) => {
            const name = String(loc.name || '').trim().toLocaleLowerCase();
            if (!name || loc.lat == null || loc.lat === '' || loc.lng == null || loc.lng === '' || !Number.isFinite(Number(loc.lat)) || !Number.isFinite(Number(loc.lng)) || seen.has(name)) return false;
            seen.add(name); return true;
        });
        return pool.sort((a, b) => hash(`${day}|${stableId(a)}`) - hash(`${day}|${stableId(b)}`) || stableId(a).localeCompare(stableId(b))).slice(0, Math.min(7, pool.length));
    }
    function currentProgressRef() {
        return db.collection('artifacts').doc(appId).collection('public').doc('data').collection('dailyChallengeProgress').doc(userId);
    }
    function updateCard() {
        const button = document.getElementById('daily-challenge-start');
        const status = document.getElementById('daily-challenge-status');
        if (!button || !status) return;
        const count = challengeFor((store.default && store.default.locs) || [], dateKey()).length;
        button.disabled = count < 5 || window.__heroCanAccessApp !== true;
        if (window.__heroCanAccessApp !== true) { status.textContent = 'Sign in with a verified account to join the shared challenge.'; return; }
        if (count < 5) { status.textContent = 'The challenge needs at least five places in the 1 Year tour.'; return; }
        status.textContent = `${dateKey()} UTC · ${count} places · streaks are saved to your profile.`;
        currentProgressRef().get().then((doc) => {
            if (!doc.exists || window.__heroCanAccessApp !== true) return;
            const data = doc.data(), day = dateKey();
            const streak = data.lastCompletedDay === day || data.lastCompletedDay === previousDay(day) ? (Number(data.currentStreak) || 0) : 0;
            status.textContent = `${day} UTC · ${count} places · ${streak} day ${streak === 1 ? 'streak' : 'streak'}.`;
        }).catch(() => {});
    }

    window.startDailyChallenge = function () {
        const day = dateKey();
        selectedForDay = challengeFor((store.default && store.default.locs) || [], day);
        if (selectedForDay.length < 5) return showToast('The daily challenge needs at least five 1 Year locations.', 'error');
        activeDay = day;
        gameMode = 'identify';
        localStorage.setItem('hero_gm', 'identify');
        document.querySelectorAll('#mode-pick [data-gm]').forEach((button) => button.classList.toggle('on', button.dataset.gm === 'identify'));
        const previousLocations = globalLocations;
        globalLocations = selectedForDay;
        dailyLaunch = true;
        try { startQuiz('default'); } finally { dailyLaunch = false; globalLocations = previousLocations; }
        document.getElementById('q-total').textContent = String(selectedForDay.length);
        showToast('Today’s shared challenge is on. Good luck!', 'success');
    };

    window.openDailyLeaderboard = function () {
        switchView('leaderboard-view');
        window.setDailyLeaderboardTab('daily');
    };

    window.setDailyLeaderboardTab = function (tab) {
        const daily = tab === 'daily';
        const tourTab = document.getElementById('lb-tour-tab'), dailyTab = document.getElementById('lb-daily-tab');
        tourTab.classList.toggle('on', !daily); tourTab.setAttribute('aria-selected', String(!daily));
        dailyTab.classList.toggle('on', daily); dailyTab.setAttribute('aria-selected', String(daily));
        document.getElementById('lb-title').textContent = daily ? 'Daily Challenge' : 'Hall of Heroes';
        document.getElementById('lb-rank-label').textContent = daily ? 'Same places for everyone - UTC' : QUIZZES[yearMode].rankLabel;
        document.getElementById('leaderboard-list').classList.toggle('hidden', daily);
        document.getElementById('daily-leaderboard-panel').classList.toggle('hidden', !daily);
        if (daily) renderLeaderboard();
        else if (typeof loadLeaderboard === 'function') loadLeaderboard();
    };

    function renderLeaderboard() {
        const day = dateKey();
        const date = document.getElementById('daily-leaderboard-date');
        const list = document.getElementById('daily-leaderboard-list');
        date.textContent = `Shared challenge - ${day} UTC`;
        list.innerHTML = '<p class="text-center text-slate-500 italic py-8">Loading today’s standings…</p>';
        if (!db || !userId) { list.innerHTML = '<p class="text-center text-slate-500 italic py-8">Sign in to see today’s standings.</p>'; return; }
        dailyCollection().doc(day).collection('scores').get().then((snapshot) => {
            const rows = snapshot.docs.map((doc) => doc.data()).sort((a, b) => Number(b.score) - Number(a.score) || Number(a.time) - Number(b.time));
            list.innerHTML = '';
            if (!rows.length) { list.innerHTML = '<p class="text-center text-slate-500 italic py-8">No scores yet. Be the first Hero today!</p>'; return; }
            rows.slice(0, 50).forEach((row, index) => {
                const item = document.createElement('div');
                item.className = `flex justify-between items-center p-4 rounded-2xl border ${index === 0 ? 'bg-amber-50 dark:bg-amber-900/20 border-amber-200' : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700'}`;
                const left = document.createElement('div'); left.className = 'flex items-center gap-3';
                const rank = document.createElement('span'); rank.className = 'font-bold w-6 text-slate-400'; rank.textContent = `#${index + 1}`;
                const name = document.createElement('span'); name.className = 'font-bold text-lg'; name.textContent = row.name || 'Hero player'; left.append(rank, name);
                const right = document.createElement('div'); right.className = 'text-right';
                const score = document.createElement('div'); score.className = 'font-black text-indigo-600 text-xl font-mono'; score.textContent = `${Number(row.score || 0).toLocaleString()} pts`;
                const time = document.createElement('div'); time.className = 'text-xs text-slate-500'; time.textContent = `${Number(row.time || 0).toLocaleString()} sec`;
                right.append(score, time); item.append(left, right); list.appendChild(item);
            });
        }).catch((error) => {
            list.innerHTML = '<p class="text-center text-rose-500 py-8">Daily standings are unavailable right now.</p>';
            console.error('Daily leaderboard failed:', error);
        });
    }

    const originalSubmitScore = submitScore;
    window.submitScore = function () {
        if (!activeDay) return originalSubmitScore();
        if (!db || !userId) return showToast('Sign in with a verified account to save a daily score.', 'error');
        if (solvedCount !== activeQuizData.length) return showToast('Finish every place to qualify for the daily leaderboard and streak.', 'error');
        const day = activeDay, uid = userId;
        const name = (document.getElementById('player-name').value.trim() || localStorage.getItem('hero_member_name') || auth.currentUser?.displayName || 'Hero').slice(0, 15);
        localStorage.setItem('mq_playerName', name);
        const scoreRef = dailyCollection().doc(day).collection('scores').doc(uid);
        const progressRef = currentProgressRef();
        const hintsUsed = Object.values(quizStats).reduce((total, stat) => total + stat.hintsUsed.length, 0);
        const score = finalScore, time = secondsElapsed;
        const button = document.getElementById('submit-score-btn'); button.disabled = true; button.textContent = 'Saving…';
        db.runTransaction(async (transaction) => {
            const [scoreDoc, progressDoc] = await Promise.all([transaction.get(scoreRef), transaction.get(progressRef)]);
            const existing = scoreDoc.exists ? scoreDoc.data() : null;
            const better = !existing || score > Number(existing.score) || (score === Number(existing.score) && time < Number(existing.time));
            if (better) transaction.set(scoreRef, {
                userId: uid, name, score, time, day, hints: hintsUsed, locations: activeQuizData.length, solved: solvedCount,
                timestamp: firebase.firestore.FieldValue.serverTimestamp()
            });
            const progress = progressDoc.exists ? progressDoc.data() : {};
            if (progress.lastCompletedDay !== day && (!progress.lastCompletedDay || day > progress.lastCompletedDay)) {
                const streak = progress.lastCompletedDay === previousDay(day) ? (Number(progress.currentStreak) || 0) + 1 : 1;
                transaction.set(progressRef, {
                    userId: uid, currentStreak: streak, longestStreak: Math.max(streak, Number(progress.longestStreak) || 0),
                    lastCompletedDay: day, updatedAt: firebase.firestore.FieldValue.serverTimestamp()
                });
            }
            return better;
        }).then((better) => {
            button.disabled = false; button.innerHTML = '<i data-lucide="upload" class="w-4 h-4"></i> Save daily score'; if (window.lucide) lucide.createIcons();
            showToast(better ? 'Daily score saved!' : 'You already have a better score for today.', better ? 'success' : 'info');
            window.dispatchEvent(new Event('hero-score-saved'));
            updateCard();
            setTimeout(() => { switchView('leaderboard-view'); window.setDailyLeaderboardTab('daily'); }, 700);
        }).catch((error) => {
            button.disabled = false; button.innerHTML = '<i data-lucide="upload" class="w-4 h-4"></i> Save daily score'; if (window.lucide) lucide.createIcons();
            showToast(`Could not save daily score (${error.code || 'error'}).`, 'error');
        });
    };

    const originalEndQuizEarly = endQuizEarly;
    window.endQuizEarly = function () {
        originalEndQuizEarly();
        if (!activeDay) return;
        const button = document.getElementById('submit-score-btn');
        const complete = solvedCount === activeQuizData.length;
        button.disabled = !complete;
        button.classList.toggle('opacity-50', !complete);
        button.classList.toggle('cursor-not-allowed', !complete);
        button.title = complete ? '' : 'Complete every daily place to qualify.';
        button.innerHTML = complete
            ? '<i data-lucide="upload" class="w-4 h-4"></i> Save daily score'
            : '<i data-lucide="lock-keyhole" class="w-4 h-4"></i> Finish all places to qualify';
        if (window.lucide) lucide.createIcons();
    };

    const originalStartQuiz = startQuiz;
    window.startQuiz = function (mode) {
        if (!dailyLaunch) activeDay = null;
        const result = originalStartQuiz(mode);
        const submitButton = document.getElementById('submit-score-btn');
        const sectionLabel = document.querySelector('#submit-score-section > p');
        if (activeDay) {
            submitButton.disabled = false;
            submitButton.classList.remove('opacity-50', 'cursor-not-allowed');
            submitButton.title = '';
            submitButton.innerHTML = '<i data-lucide="upload" class="w-4 h-4"></i> Save daily score';
            sectionLabel.textContent = 'Add your score to today’s Daily Challenge leaderboard.';
        } else {
            submitButton.innerHTML = '<i data-lucide="upload" class="w-4 h-4"></i> Submit';
            sectionLabel.textContent = 'Carve your name in the Hall of Heroes!';
        }
        if (window.lucide) lucide.createIcons();
        return result;
    };

    window.downloadBoundaryCatalog = function () {
        const catalog = {
            generatedAt: new Date().toISOString(),
            source: 'Hero Firestore global quiz locations; optional year is a historical CE year, negative values are BCE.',
            locations: [
                ...((store.default && store.default.locs) || []).map((loc) => ({ ...loc, tour: 'default' })),
                ...((store.twoyear && store.twoyear.locs) || []).map((loc) => ({ ...loc, tour: 'twoyear' }))
            ]
        };
        const blob = new Blob([JSON.stringify(catalog, null, 2)], { type: 'application/json' });
        const link = document.createElement('a'); link.href = URL.createObjectURL(blob); link.download = 'location-catalog.json'; link.click();
        setTimeout(() => URL.revokeObjectURL(link.href), 1000);
        showToast('Boundary build catalog downloaded.', 'success');
    };

    document.addEventListener('hero-auth-state', updateCard);
    document.addEventListener('hero-location-data-ready', updateCard);
    document.addEventListener('hero-score-saved', updateCard);
    document.addEventListener('DOMContentLoaded', updateCard);
})();
