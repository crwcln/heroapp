// ================= HERO ACCOUNTS =================
// Rebuilt from scratch (previous version removed, not reused) after reports of sign-in state confusion.
//
// Design rule, and the reason for the rewrite: there is exactly ONE place that decides whether a Firebase
// user is allowed into the app -- the `applyFirebaseUser` function in js/04-app-core.js, which broadcasts
// its decision as a `hero-auth-state` event. This file never makes that decision itself; it only reacts to
// the event. The previous version tracked its own partial notion of "signed in" alongside that decision,
// and the two could disagree. Here the UI is a pure function of the last `hero-auth-state` it received.
//
// Public surface other files rely on (kept the same on purpose, so nothing else needed to change):
//   window.__heroOpenAccountDialog()   opens the sign-in / account dialog
//   window.__heroShowAuthGate()        same dialog, used when a blocked view needs to show it
//   window.__heroDeviceProfiles        { deviceId: {name,email,userId,deviceId} } for admin tooling
//   #hero-account-open                 the nav button (created here, inserted into #nav-actions)
//   #member-profile-content            populated with the signed-in profile (profile-view in index.html)
(function () {
    const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
    const dataCol = () => db.collection('artifacts').doc(appId).collection('public').doc('data');
    const memberRef = (uid) => dataCol().collection('members').doc(uid);
    const ROLES = [[30000, 'Legend'], [15000, 'Historian'], [5000, 'Cartographer'], [1000, 'Scout'], [0, 'Explorer']];
    const roleFor = (score) => (ROLES.find(([min]) => score >= min) || ROLES[ROLES.length - 1])[1];

    let latest = { user: null, authorized: false, isAdmin: false };
    let mode = 'signin';                 // gate form: 'signin' | 'register'
    let profileOpenPending = false;
    let dialog = null, body = null;
    let knownProfilesUnsub = null;

    // ---------------- photo resize: a square JPEG under ~100KB, stored inline on the member doc ----------------
    async function resizePhoto(file) {
        const bitmap = await createImageBitmap(file);
        const side = Math.min(bitmap.width, bitmap.height);
        const canvas = document.createElement('canvas'); canvas.width = 256; canvas.height = 256;
        canvas.getContext('2d').drawImage(bitmap, (bitmap.width - side) / 2, (bitmap.height - side) / 2, side, side, 0, 0, 256, 256);
        bitmap.close();
        let quality = 0.82, blob = await new Promise((r) => canvas.toBlob(r, 'image/jpeg', quality));
        while (blob && blob.size > 100000 && quality > 0.4) { quality -= 0.1; blob = await new Promise((r) => canvas.toBlob(r, 'image/jpeg', quality)); }
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result);
            reader.onerror = reject;
            reader.readAsDataURL(blob);
        });
    }

    // ---------------- dialog shell ----------------
    function ensureDialog() {
        if (dialog) return;
        dialog = document.createElement('div');
        dialog.id = 'hero-account-dialog';
        dialog.className = 'hero-auth-overlay hidden';
        dialog.innerHTML = '<div class="hero-auth-backdrop"></div><div class="hero-auth-card glass-panel"><button type="button" class="hero-auth-close" aria-label="Close">&times;</button><div id="hero-auth-body"></div></div>';
        document.body.appendChild(dialog);
        dialog.querySelector('.hero-auth-backdrop').onclick = closeDialog;
        dialog.querySelector('.hero-auth-close').onclick = closeDialog;
        document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && !dialog.classList.contains('hidden')) closeDialog(); });
        body = dialog.querySelector('#hero-auth-body');
    }
    function openDialog() { ensureDialog(); dialog.classList.remove('hidden'); requestAnimationFrame(() => dialog.classList.add('open')); render(); }
    function closeDialog() { profileOpenPending = false; if (!dialog) return; dialog.classList.remove('open'); setTimeout(() => dialog.classList.add('hidden'), 200); }
    window.__heroOpenAccountDialog = openDialog;
    window.__heroShowAuthGate = openDialog;

    // ---------------- nav button ----------------
    function ensureNavButton() {
        if (document.getElementById('hero-account-open')) return;
        const actions = document.getElementById('nav-actions'); if (!actions) return;
        const btn = document.createElement('button');
        btn.id = 'hero-account-open';
        btn.className = 'flex items-center gap-2 text-sm font-semibold hover:text-indigo-600 dark:hover:text-indigo-400 transition';
        btn.setAttribute('aria-label', 'Profile and account');
        btn.innerHTML = '<i data-lucide="user-round" class="w-4 h-4"></i><span class="hidden sm:inline">Profile</span>';
        btn.onclick = () => {
            if (latest.authorized && latest.user && !latest.user.isAnonymous) {
                profileOpenPending = false;
                switchView('profile-view');
            } else {
                profileOpenPending = true;
                openDialog();
            }
        };
        actions.insertBefore(btn, document.getElementById('nav-more') || document.getElementById('theme-btn') || null);
        if (window.lucide) lucide.createIcons();
    }

    // ---------------- gate: sign in / create account ----------------
    function renderGate(errorText) {
        const register = mode === 'register';
        body.innerHTML = `
            <div class="hero-auth-mark">H</div>
            <p class="hero-auth-eyebrow">HERO ACCOUNT</p>
            <h2 class="hero-auth-title">${register ? 'Create your account' : 'Welcome back'}</h2>
            <p class="hero-auth-sub">${register ? "One quick email check, then you're set on this browser." : 'Sign in to play, save scores, and talk with Clio.'}</p>
            ${errorText ? `<div class="hero-auth-error">${esc(errorText)}</div>` : ''}
            <form id="ha-form" novalidate>
                ${register ? '<label class="hero-auth-label">Name</label><input id="ha-name" class="hero-auth-input" maxlength="40" autocomplete="name" placeholder="Display name" required>' : ''}
                <label class="hero-auth-label">Email</label>
                <input id="ha-email" class="hero-auth-input" type="email" autocomplete="email" placeholder="you@example.com" required>
                <label class="hero-auth-label">Password</label>
                <input id="ha-password" class="hero-auth-input" type="password" minlength="8" autocomplete="${register ? 'new-password' : 'current-password'}" placeholder="${register ? 'At least 8 characters' : 'Your password'}" required>
                ${register ? '<label class="hero-auth-label">Confirm password</label><input id="ha-confirm" class="hero-auth-input" type="password" minlength="8" autocomplete="new-password" placeholder="Type it again" required>' : ''}
                <button type="submit" id="ha-submit" class="hero-auth-submit">${register ? 'Create account' : 'Sign in'}</button>
            </form>
            <div class="hero-auth-links-primary"><button type="button" id="ha-toggle">${register ? 'Already have an account? Sign in' : "New to Hero? Create an account"}</button></div>
            ${register ? '' : '<div class="hero-auth-links"><button type="button" id="ha-forgot">Forgot password?</button></div>'}
        `;
        document.getElementById('ha-toggle').onclick = () => { mode = register ? 'signin' : 'register'; renderGate(); };
        if (!register) document.getElementById('ha-forgot').onclick = handleForgot;
        document.getElementById('ha-form').addEventListener('submit', handleGateSubmit);
        document.getElementById(register ? 'ha-name' : 'ha-email').focus();
    }

    async function handleGateSubmit(e) {
        e.preventDefault();
        const register = mode === 'register';
        const email = document.getElementById('ha-email').value.trim();
        const password = document.getElementById('ha-password').value;
        const name = register ? document.getElementById('ha-name').value.trim() : '';
        const confirm = register ? document.getElementById('ha-confirm').value : '';
        if (register && name.length < 2) return renderGate('Enter a name with at least 2 characters.');
        if (!email) return renderGate('Enter your email address.');
        if (password.length < 8) return renderGate('Password must be at least 8 characters.');
        if (register && password !== confirm) return renderGate("Passwords don't match.");

        const btn = document.getElementById('ha-submit');
        btn.disabled = true; const original = btn.textContent; btn.textContent = register ? 'Creating account\u2026' : 'Signing in\u2026';
        try {
            if (register) {
                const cred = await auth.createUserWithEmailAndPassword(email, password);
                await cred.user.updateProfile({ displayName: name });
                await cred.user.sendEmailVerification();
            } else {
                await auth.signInWithEmailAndPassword(email, password);
            }
            // The real UI update comes from js/04's hero-auth-state event, which fires from onAuthStateChanged
            // right after this resolves. We don't render a "success" state ourselves to avoid a second,
            // competing source of truth -- we just stop showing this form's own loading state.
        } catch (err) {
            btn.disabled = false; btn.textContent = original;
            renderGate(gateErrorMessage(err));
        }
    }

    function gateErrorMessage(err) {
        const map = {
            'auth/email-already-in-use': 'An account already exists for that email. Try signing in instead.',
            'auth/invalid-email': "That doesn't look like a valid email address.",
            'auth/weak-password': 'Choose a stronger password (at least 8 characters).',
            'auth/wrong-password': 'Incorrect email or password.',
            'auth/user-not-found': 'Incorrect email or password.',
            'auth/invalid-credential': 'Incorrect email or password.',
            'auth/too-many-requests': 'Too many attempts. Wait a minute and try again.',
            'auth/network-request-failed': 'Could not reach the sign-in server. Check your connection.',
        };
        return map[err.code] || (err.message || 'Something went wrong. Please try again.');
    }

    async function handleForgot() {
        const email = (document.getElementById('ha-email').value || '').trim();
        if (!email) return renderGate('Enter your email above first, then press Forgot password.');
        try {
            await auth.sendPasswordResetEmail(email);
            renderGate(); 
            const sub = body.querySelector('.hero-auth-sub');
            if (sub) sub.textContent = `Password reset email sent to ${email}. Check your inbox.`;
        } catch (err) { renderGate(gateErrorMessage(err)); }
    }

    // ---------------- verify-pending ----------------
    function renderVerifyPending(user) {
        body.innerHTML = `
            <div class="hero-verify-card">
                <i data-lucide="mail-check" class="hero-verify-icon"></i>
                <h3>Almost there</h3>
                <p>You're signed in as <strong>${esc(user.email)}</strong>. Click the link we emailed you to verify this account &mdash; just once, future sign-ins won't ask again.</p>
                <div id="hv-status" class="hero-verify-status"></div>
                <button type="button" id="hv-resend" class="hero-auth-submit">Resend verification email</button>
                <button type="button" id="hv-check" class="hero-auth-secondary">I verified my email</button>
                <div class="hero-auth-links"><button type="button" id="hv-signout">Sign in with a different account</button></div>
            </div>`;
        if (window.lucide) lucide.createIcons();
        const status = document.getElementById('hv-status');
        document.getElementById('hv-resend').onclick = async (e) => {
            const btn = e.currentTarget; btn.disabled = true;
            try { await user.sendEmailVerification(); status.textContent = 'Sent. Check your inbox (and spam folder).'; status.classList.remove('is-error'); }
            catch (err) { status.textContent = gateErrorMessage(err); status.classList.add('is-error'); }
            finally { btn.disabled = false; }
        };
        document.getElementById('hv-check').onclick = async (e) => {
            const btn = e.currentTarget; btn.disabled = true; btn.textContent = 'Checking\u2026';
            try {
                await user.reload();
                if (user.emailVerified) { if (window.__heroApplyAuthUser) await window.__heroApplyAuthUser(auth.currentUser); }
                else { status.textContent = "Not verified yet. Click the link in the email first."; status.classList.add('is-error'); }
            } finally { btn.disabled = false; btn.textContent = 'I verified my email'; }
        };
        document.getElementById('hv-signout').onclick = () => auth.signOut();
    }

    // ---------------- signed-in account dialog ----------------
    function renderAccount(user) {
        body.innerHTML = `
            <section class="acct-card">
                <header class="acct-card-head"><span class="acct-ico"><i data-lucide="user-circle"></i></span><div><h3>Profile</h3><p>Signed in and verified as <strong>${esc(user.email)}</strong></p></div></header>
                <div class="member-photo-edit">
                    <div class="member-photo-edit-preview" id="ha-photo-preview"></div>
                    <div>
                        <strong>Profile picture</strong>
                        <p>Choose a square photo. It's resized before saving.</p>
                        <div class="acct-photo-btns">
                            <label class="cm-btn go acct-btn-sm" for="ha-photo-file"><i data-lucide="image-plus"></i> Choose photo</label>
                            <button type="button" id="ha-photo-remove" class="hero-auth-link">Remove photo</button>
                        </div>
                        <input id="ha-photo-file" type="file" accept="image/png,image/jpeg,image/webp" hidden>
                    </div>
                </div>
                <label class="acct-label" for="ha-name2">Display name</label>
                <input id="ha-name2" class="acct-input" maxlength="40" autocomplete="name" value="${esc(user.displayName || '')}">
                <button type="button" id="ha-save" class="cm-btn go w-full mt-4"><i data-lucide="check" class="w-4 h-4"></i> Save profile</button>
            </section>
            <section class="acct-card">
                <header class="acct-card-head"><span class="acct-ico"><i data-lucide="key-round"></i></span><div><h3>Password</h3><p>Confirm your current password to change it, or request a reset email.</p></div></header>
                <label class="acct-label" for="ha-old-pass">Current password</label>
                <input id="ha-old-pass" type="password" class="acct-input" autocomplete="current-password" placeholder="Current password">
                <div class="acct-grid-2">
                    <div><label class="acct-label" for="ha-new-pass">New password</label><input id="ha-new-pass" type="password" minlength="8" class="acct-input" autocomplete="new-password" placeholder="At least 8 characters"></div>
                    <div><label class="acct-label" for="ha-new-pass2">Confirm new password</label><input id="ha-new-pass2" type="password" minlength="8" class="acct-input" autocomplete="new-password" placeholder="Type it again"></div>
                </div>
                <button type="button" id="ha-pw-save" class="cm-btn ghost w-full mt-4"><i data-lucide="lock" class="w-4 h-4"></i> Update password</button>
                <button type="button" id="ha-pw-reset" class="hero-auth-link mt-3">Email me a reset link instead</button>
            </section>
            <section class="acct-card">
                <h3 class="font-bold text-sm mb-3 flex items-center gap-2"><i data-lucide="award" class="w-4 h-4"></i> Your Hero rank</h3>
                <p id="ha-rank" class="text-sm text-slate-500">Loading\u2026</p>
            </section>
            <section class="acct-card acct-card-danger">
                <button type="button" id="ha-signout" class="cm-btn ghost w-full"><i data-lucide="log-out" class="w-4 h-4"></i> Sign out</button>
            </section>
        `;
        if (window.lucide) lucide.createIcons();

        let pendingPhoto;
        memberRef(user.uid).get().then((doc) => {
            const photo = doc.exists ? doc.data().photoURL : '';
            document.getElementById('ha-photo-preview').innerHTML = photo ? `<img src="${esc(photo)}" alt="">` : `<i data-lucide="user" class="w-6 h-6"></i>`;
            if (window.lucide) lucide.createIcons();
        }).catch(() => {});

        document.getElementById('ha-photo-file').onchange = async (e) => {
            const file = e.target.files[0]; if (!file) return;
            pendingPhoto = await resizePhoto(file).catch(() => null);
            if (pendingPhoto) document.getElementById('ha-photo-preview').innerHTML = `<img src="${pendingPhoto}" alt="">`;
        };
        document.getElementById('ha-photo-remove').onclick = () => { pendingPhoto = ''; document.getElementById('ha-photo-preview').innerHTML = `<i data-lucide="user" class="w-6 h-6"></i>`; if (window.lucide) lucide.createIcons(); };

        document.getElementById('ha-save').onclick = async (e) => {
            const btn = e.currentTarget; btn.disabled = true;
            const name = document.getElementById('ha-name2').value.trim();
            if (name.length < 2) { showToast('Enter a display name (2+ characters).', 'error'); btn.disabled = false; return; }
            try {
                if (name !== user.displayName) await user.updateProfile({ displayName: name });
                const payload = { userId: user.uid, name, email: user.email, updatedAt: firebase.firestore.FieldValue.serverTimestamp() };
                if (pendingPhoto !== undefined) payload.photoURL = pendingPhoto;
                else { const existing = await memberRef(user.uid).get(); if (existing.exists && existing.data().photoURL) payload.photoURL = existing.data().photoURL; }
                await memberRef(user.uid).set(payload, { merge: true });
                await dataCol().collection('deviceProfiles').doc(window.__heroDeviceId || deviceId()).set({ deviceId: window.__heroDeviceId || deviceId(), userId: user.uid, name, email: user.email, updatedAt: firebase.firestore.FieldValue.serverTimestamp() }, { merge: true }).catch(() => {});
                showToast('Profile saved.', 'success');
            } catch (err) { showToast(`Could not save profile (${err.code || 'error'}).`, 'error'); }
            finally { btn.disabled = false; }
        };

        document.getElementById('ha-pw-save').onclick = async (e) => {
            const btn = e.currentTarget;
            const current = document.getElementById('ha-old-pass').value;
            const next = document.getElementById('ha-new-pass').value;
            const confirm = document.getElementById('ha-new-pass2').value;
            if (!current) return showToast('Enter your current password.', 'error');
            if (next.length < 8) return showToast('New password must be at least 8 characters.', 'error');
            if (next !== confirm) return showToast("New passwords don't match.", 'error');
            btn.disabled = true;
            try {
                const cred = firebase.auth.EmailAuthProvider.credential(user.email, current);
                await user.reauthenticateWithCredential(cred);
                await user.updatePassword(next);
                ['ha-old-pass', 'ha-new-pass', 'ha-new-pass2'].forEach((id) => { document.getElementById(id).value = ''; });
                showToast('Password updated.', 'success');
            } catch (err) { showToast(gateErrorMessage(err), 'error'); }
            finally { btn.disabled = false; }
        };
        document.getElementById('ha-pw-reset').onclick = async () => {
            try { await auth.sendPasswordResetEmail(user.email); showToast('Reset email sent.', 'success'); }
            catch (err) { showToast(gateErrorMessage(err), 'error'); }
        };

        document.getElementById('ha-signout').onclick = () => auth.signOut();

        loadRankSummary(user, document.getElementById('ha-rank'));
    }

    // ---------------- rank/score summary (shared by the dialog and the profile page) ----------------
    async function loadRankSummary(user, el) {
        try {
            const [y1, y2, flappy] = await Promise.all([
                dataCol().collection('leaderboard').where('userId', '==', user.uid).get(),
                dataCol().collection('leaderboardTwoYear').where('userId', '==', user.uid).get(),
                dataCol().collection('flappy').where('userId', '==', user.uid).get(),
            ]);
            const quizScores = [...y1.docs, ...y2.docs].map((d) => Number(d.data().score) || 0);
            const best = quizScores.length ? Math.max(...quizScores) : 0;
            const flappyBest = flappy.docs.reduce((n, d) => Math.max(n, Number(d.data().score) || 0), 0);
            el.innerHTML = `<div class="flex items-center gap-3"><span class="hero-rank-badge">${esc(roleFor(best))}</span><span class="text-xs text-slate-500">Best journey score: <strong>${best.toLocaleString()}</strong>${flappyBest ? ` &middot; Flappy best: <strong>${flappyBest}</strong>` : ''}</span></div>`;
        } catch (err) { el.textContent = "Couldn't load your rank right now."; }
    }

    // ---------------- profile-view (the full page, not the dialog) ----------------
    async function renderProfilePage(user) {
        const host = document.getElementById('member-profile-content'); if (!host) return;
        host.innerHTML = '<p class="text-slate-500">Loading your profile\u2026</p>';
        try {
            const memberDoc = await memberRef(user.uid).get();
            const photo = memberDoc.exists ? memberDoc.data().photoURL : '';
            const [y1, y2, flappy, dailyProgressDoc] = await Promise.all([
                dataCol().collection('leaderboard').where('userId', '==', user.uid).get(),
                dataCol().collection('leaderboardTwoYear').where('userId', '==', user.uid).get(),
                dataCol().collection('flappy').where('userId', '==', user.uid).get(),
                dataCol().collection('dailyChallengeProgress').doc(user.uid).get().catch(() => null),
            ]);
            const quizRows = [...y1.docs.map((d) => ({ ...d.data(), tour: '1 Year' })), ...y2.docs.map((d) => ({ ...d.data(), tour: '2 Year' }))];
            const scores = quizRows.map((r) => Number(r.score) || 0);
            const best = scores.length ? Math.max(...scores) : 0;
            const flappyBest = flappy.docs.reduce((n, d) => Math.max(n, Number(d.data().score) || 0), 0);
            const dailyProgress = dailyProgressDoc && dailyProgressDoc.exists ? dailyProgressDoc.data() : {};
            const today = new Date().toISOString().slice(0, 10);
            const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
            const dailyStreak = dailyProgress.lastCompletedDay === today || dailyProgress.lastCompletedDay === yesterday ? (Number(dailyProgress.currentStreak) || 0) : 0;
            const perfect = quizRows.some((r) => r.perfect === true);

            const achievements = [];
            if (quizRows.length) achievements.push(['First Journey', 'Saved your first quiz score.']);
            if (quizRows.length >= 5) achievements.push(['Seasoned Explorer', 'Saved scores from five journeys.']);
            if (perfect) achievements.push(['Flawless Journey', 'Completed a journey without a missed location.']);
            if (best >= 1000) achievements.push(['Thousand Point Club', 'Scored at least 1,000 in one journey.']);
            if (best >= 5000) achievements.push(['Atlas Keeper', 'Scored at least 5,000 in one journey.']);
            if (flappyBest >= 10) achievements.push(['Skybound', 'Scored at least 10 in Flappy Bird.']);
            if (dailyProgress.lastCompletedDay) achievements.push(['Daily Explorer', 'Completed a shared Daily Challenge.']);
            if (Number(dailyProgress.longestStreak) >= 7) achievements.push(['Seven Day Streak', 'Completed a Daily Challenge seven days in a row.']);

            const recent = [...quizRows].sort((a, b) => (Number((b.timestamp || b.ts || {}).seconds) || 0) - (Number((a.timestamp || a.ts || {}).seconds) || 0)).slice(0, 8);

            host.innerHTML = `
                <div class="flex items-center gap-4 mb-6">
                    <div class="member-photo-edit-preview" style="width:72px;height:72px">${photo ? `<img src="${esc(photo)}" alt="">` : `<i data-lucide="user" class="w-7 h-7"></i>`}</div>
                    <div><div class="text-xl font-extrabold">${esc(user.displayName || user.email)}</div><span class="hero-rank-badge">${esc(roleFor(best))}</span></div>
                </div>
                <div class="an-grid">
                    <div class="an-kpi"><small>Journeys</small><strong>${quizRows.length}</strong></div>
                    <div class="an-kpi"><small>Best score</small><strong>${best.toLocaleString()}</strong></div>
                    <div class="an-kpi"><small>Flappy best</small><strong>${flappyBest || '\u2014'}</strong></div>
                    <div class="an-kpi"><small>Daily streak</small><strong>${dailyStreak} day${dailyStreak === 1 ? '' : 's'}</strong><small>Best: ${Number(dailyProgress.longestStreak) || 0} days</small></div>
                </div>
                <section class="member-achievements"><h3>Achievements &amp; badges</h3><div class="member-badges">${achievements.length ? '' : '<p class="text-xs text-slate-500">Play a journey and save your score to start earning badges.</p>'}</div></section>
                <section class="member-recent"><h3>Recent scores</h3><div class="member-score-list">${recent.length ? '' : '<p class="text-xs text-slate-500">No scores saved yet.</p>'}</div></section>
            `;
            if (window.lucide) lucide.createIcons();
            const badgeBox = host.querySelector('.member-badges');
            achievements.forEach(([title, desc]) => {
                const badge = document.createElement('article'); badge.className = 'member-badge';
                badge.innerHTML = '<span class="member-badge-icon">\u2726</span><div><strong></strong><p></p></div>';
                badge.querySelector('strong').textContent = title; badge.querySelector('p').textContent = desc;
                badgeBox.appendChild(badge);
            });
            const scoreBox = host.querySelector('.member-score-list');
            recent.forEach((row) => {
                const line = document.createElement('div'); line.className = 'member-score';
                const tour = document.createElement('span'); tour.textContent = row.tour;
                const score = document.createElement('strong'); score.textContent = (Number(row.score) || 0).toLocaleString();
                const time = document.createElement('small'); time.textContent = `${Number(row.time) || 0}s`;
                line.append(tour, score, time); scoreBox.appendChild(line);
            });
        } catch (err) {
            host.innerHTML = '<p class="text-rose-500 text-sm">Could not load your profile right now.</p>';
            console.error('profile load failed', err);
        }
    }

    // ---------------- admin: device <-> account view (for the Banned Devices card in js/15) ----------------
    function startKnownProfiles() {
        if (knownProfilesUnsub) return;
        knownProfilesUnsub = dataCol().collection('deviceProfiles').orderBy('updatedAt', 'desc').limit(200).onSnapshot((snap) => {
            window.__heroDeviceProfiles = {};
            snap.docs.forEach((d) => { window.__heroDeviceProfiles[d.id] = Object.assign({ deviceId: d.id }, d.data()); });
        }, () => { window.__heroDeviceProfiles = {}; });
    }
    function stopKnownProfiles() { if (knownProfilesUnsub) knownProfilesUnsub(); knownProfilesUnsub = null; window.__heroDeviceProfiles = {}; }

    // ---------------- the single render dispatch ----------------
    function render() {
        ensureNavButton();
        if (!dialog || dialog.classList.contains('hidden')) {
            // Dialog isn't open: still keep the profile page fresh if that's what's showing.
            if (latest.authorized && latest.user && fbCurView === 'profile-view') renderProfilePage(latest.user);
            return;
        }
        const user = latest.user;
        // Stewards can use the same account settings dialog as other authorized users.
        if (!user || user.isAnonymous) { mode = 'signin'; renderGate(); return; }
        if (user.email && !user.emailVerified && !latest.isAdmin) { renderVerifyPending(user); return; }
        if (latest.authorized) { renderAccount(user); return; }
        renderGate();
    }

    window.addEventListener('hero-auth-state', (e) => {
        latest = e.detail || { user: null, authorized: false, isAdmin: false };
        ensureNavButton();
        render();
        if (latest.authorized && latest.user && !latest.user.isAnonymous) startKnownProfiles(); else stopKnownProfiles();
        if (profileOpenPending && latest.authorized && latest.user && !latest.user.isAnonymous) {
            profileOpenPending = false;
            closeDialog();
            switchView('profile-view');
        }
        if (latest.authorized && fbCurView === 'profile-view') renderProfilePage(latest.user);
        // Keep account settings open across auth refreshes. A successful sign-in
        // launched from the gate is closed above only when profileOpenPending is set.
    });

    const _heroSwitchView = switchView;
    switchView = function (id) {
        _heroSwitchView(id);
        if (id === 'profile-view') {
            if (!latest.authorized || !latest.user) { _heroSwitchView('home-view'); openDialog(); return; }
            renderProfilePage(latest.user);
        }
    };

    ensureNavButton();
})();
