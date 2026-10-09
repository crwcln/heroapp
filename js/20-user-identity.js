// ===== VERIFIED ACCOUNTS, MEMBER PROFILES, AND MODERATION IDENTITY =====
(function () {
    const pendingEmailKey = 'hero_pending_email', pendingNameKey = 'hero_pending_name';
    let accountDialog, accountStatus, accountForm, authGate, gateStatus, gateForm, authMode = 'register';
    let profileSub = null, profileScores = [], knownProfiles = [], profileWriteKey = '', profileWriteTask = null, profileSavedKey = '';
    const dataCol = () => db.collection('artifacts').doc(appId).collection('public').doc('data');
    const currentMember = () => auth && auth.currentUser && !auth.currentUser.isAnonymous && auth.currentUser.emailVerified && auth.currentUser.uid !== 'admin' ? auth.currentUser : null;
    const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

    function setStatus(msg, error = false) {
        if (!accountStatus) return;
        accountStatus.textContent = msg;
        accountStatus.classList.toggle('text-rose-600', error);
        accountStatus.classList.toggle('text-emerald-600', !error);
    }
    function setGateStatus(msg, error = false) {
        if (!gateStatus) return;
        gateStatus.textContent = msg;
        gateStatus.classList.toggle('text-rose-300', error);
        gateStatus.classList.toggle('text-emerald-300', !error);
    }
    function setAccountLabel(label) {
        const button = document.getElementById('hero-account-open');
        if (!button) return;
        const text = button.querySelector('span');
        if (text) text.textContent = label; else button.textContent = label;
    }
    window.__heroShowAuthGate = () => { if (authGate) authGate.classList.remove('hidden'); };

    function renderAccount() {
        if (!accountForm) return;
        const user = currentMember();
        if (user) {
            const name = localStorage.getItem('hero_member_name') || user.displayName || '';
            accountForm.innerHTML = '<p class="text-sm text-slate-600 dark:text-slate-300">Signed in and verified as <strong id="hero-member-email"></strong>.</p><label class="block text-xs font-bold uppercase tracking-wide mt-4 mb-1">Display name</label><input id="hero-member-name" maxlength="40" class="w-full p-3 rounded-lg border bg-white dark:bg-slate-900 dark:text-white" autocomplete="name"><button id="hero-member-save" class="cm-btn go w-full mt-3">Save profile</button><div class="border-t mt-5 pt-4"><h3 class="font-bold text-sm">Password</h3><p class="text-xs text-slate-500 mt-1">Set or change the password for this account.</p><input id="hero-member-password" type="password" minlength="8" autocomplete="new-password" class="w-full p-3 mt-3 rounded-lg border bg-white dark:bg-slate-900 dark:text-white" placeholder="New password (at least 8 characters)"><button id="hero-member-password-save" class="cm-btn ghost w-full mt-2">Update password</button></div><button id="hero-member-signout" class="cm-btn ghost w-full mt-4">Sign out</button>';
            accountForm.querySelector('#hero-member-email').textContent = user.email || '';
            accountForm.querySelector('#hero-member-name').value = name;
            accountForm.querySelector('#hero-member-save').onclick = async () => {
                const nextName = accountForm.querySelector('#hero-member-name').value.trim();
                if (nextName.length < 2 || nextName.length > 40) return setStatus('Name must be 2 to 40 characters.', true);
                localStorage.setItem('hero_member_name', nextName);
                await saveProfile(user, nextName);
                await refreshMemberProfile(user);
            };
            accountForm.querySelector('#hero-member-password-save').onclick = async () => {
                const password = accountForm.querySelector('#hero-member-password').value;
                if (password.length < 8) return setStatus('Use a password with at least 8 characters.', true);
                try { await user.updatePassword(password); accountForm.querySelector('#hero-member-password').value = ''; setStatus('Password updated.'); }
                catch (e) { setStatus(e.code === 'auth/requires-recent-login' ? 'Sign out and sign back in, then try changing your password again.' : `Could not update password (${e.code || 'error'}).`, true); }
            };
            accountForm.querySelector('#hero-member-signout').onclick = signOut;
            setAccountLabel(name || 'Profile');
        } else {
            accountForm.innerHTML = '<p class="text-sm text-slate-600 dark:text-slate-300">Sign in with your password or use an email link.</p><label class="block text-xs font-bold uppercase tracking-wide mt-4 mb-1">Email</label><input id="hero-member-email" type="email" maxlength="254" class="w-full p-3 rounded-lg border bg-white dark:bg-slate-900 dark:text-white" autocomplete="email"><label class="block text-xs font-bold uppercase tracking-wide mt-3 mb-1">Password</label><input id="hero-member-password" type="password" class="w-full p-3 rounded-lg border bg-white dark:bg-slate-900 dark:text-white" autocomplete="current-password"><div class="flex gap-2 mt-4"><button id="hero-member-password-login" class="cm-btn go flex-1">Sign in</button><button id="hero-member-link" class="cm-btn ghost">Email link</button></div>';
            accountForm.querySelector('#hero-member-email').value = localStorage.getItem(pendingEmailKey) || '';
            accountForm.querySelector('#hero-member-password-login').onclick = passwordSignIn;
            accountForm.querySelector('#hero-member-link').onclick = sendLink;
            setAccountLabel('Sign in');
        }
    }

    function renderGateForm() {
        if (!gateForm) return;
        const register = authMode === 'register';
        gateForm.innerHTML = `${register ? '<label class="hero-auth-label">Your name</label><input id="gate-name" class="hero-auth-input" maxlength="40" autocomplete="name" placeholder="Display name">' : ''}<label class="hero-auth-label">Email</label><input id="gate-email" class="hero-auth-input" type="email" maxlength="254" autocomplete="email" placeholder="you@example.com"><label class="hero-auth-label">Password</label><input id="gate-password" class="hero-auth-input" type="password" minlength="8" autocomplete="${register ? 'new-password' : 'current-password'}" placeholder="${register ? 'At least 8 characters' : 'Your password'}">${register ? '<label class="hero-auth-label">Confirm password</label><input id="gate-confirm" class="hero-auth-input" type="password" minlength="8" autocomplete="new-password" placeholder="Type it again">' : ''}<button id="gate-submit" class="hero-auth-submit">${register ? 'Create account' : 'Sign in'}</button><div class="hero-auth-links"><button id="gate-toggle" type="button">${register ? 'Already have an account? Sign in' : 'New to Hero? Create account'}</button><button id="gate-reset" type="button">Forgot password?</button><button id="gate-email-link" type="button">Use an email sign-in link</button></div>`;
        gateForm.querySelector('#gate-submit').onclick = submitPasswordAuth;
        gateForm.querySelector('#gate-toggle').onclick = () => { authMode = register ? 'login' : 'register'; setGateStatus(''); renderGateForm(); };
        gateForm.querySelector('#gate-reset').onclick = resetPassword;
        gateForm.querySelector('#gate-email-link').onclick = sendLink;
        gateForm.querySelectorAll('input').forEach(input => input.addEventListener('keydown', e => { if (e.key === 'Enter') submitPasswordAuth(); }));
    }

    async function submitPasswordAuth() {
        if (!auth) return setGateStatus('Connecting to secure sign-in. Please wait a moment.', true);
        const email = gateForm.querySelector('#gate-email').value.trim().toLowerCase();
        const password = gateForm.querySelector('#gate-password').value;
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return setGateStatus('Enter a valid email address.', true);
        if (password.length < 8) return setGateStatus('Password must be at least 8 characters.', true);
        try {
            if (authMode === 'register') {
                const name = gateForm.querySelector('#gate-name').value.trim();
                if (name.length < 2 || name.length > 40) return setGateStatus('Name must be 2 to 40 characters.', true);
                if (gateForm.querySelector('#gate-confirm').value !== password) return setGateStatus('Those passwords do not match.', true);
                const credential = await auth.createUserWithEmailAndPassword(email, password);
                await credential.user.updateProfile({ displayName: name });
                localStorage.setItem('hero_member_name', name);
                localStorage.setItem(pendingNameKey, name); localStorage.setItem(pendingEmailKey, email);
                await credential.user.sendEmailVerification({ url: location.origin + location.pathname });
                setGateStatus('Check your inbox for a verification link. After you verify, return here and select “I verified my email.”');
                renderAccount();
            } else {
                await auth.signInWithEmailAndPassword(email, password);
                localStorage.setItem(pendingEmailKey, email);
                setGateStatus('Signed in. Checking email verification...');
            }
        } catch (e) {
            const messages = { 'auth/email-already-in-use': 'That email already has an account. Sign in instead.', 'auth/invalid-credential': 'Email or password is incorrect.', 'auth/user-not-found': 'Email or password is incorrect.', 'auth/wrong-password': 'Email or password is incorrect.', 'auth/weak-password': 'Choose a stronger password (at least 8 characters).', 'auth/invalid-email': 'Enter a valid email address.', 'auth/too-many-requests': 'Too many attempts. Wait a little and try again.' };
            setGateStatus(messages[e.code] || `Could not sign in (${e.code || 'error'}).`, true);
        }
    }

    async function passwordSignIn() {
        const email = accountForm.querySelector('#hero-member-email').value.trim().toLowerCase();
        const password = accountForm.querySelector('#hero-member-password').value;
        try { await auth.signInWithEmailAndPassword(email, password); }
        catch (e) { setStatus(e.code === 'auth/invalid-credential' ? 'Email or password is incorrect.' : `Could not sign in (${e.code || 'error'}).`, true); }
    }
    async function resetPassword() {
        const email = gateForm.querySelector('#gate-email').value.trim().toLowerCase();
        if (!email) return setGateStatus('Enter your email address first.');
        try { await auth.sendPasswordResetEmail(email); setGateStatus('If an account exists for that address, a password reset email is on its way.'); }
        catch (e) { setGateStatus(`Could not send reset email (${e.code || 'error'}).`, true); }
    }
    async function resendVerification() {
        if (!auth.currentUser) return;
        try { await auth.currentUser.sendEmailVerification({ url: location.origin + location.pathname }); setGateStatus('Verification email sent. Check your inbox and spam folder.'); }
        catch (e) { setGateStatus(`Could not send verification email (${e.code || 'error'}).`, true); }
    }
    async function refreshVerification() {
        if (!auth || !auth.currentUser) return setGateStatus('Sign in first, then verify your email.', true);
        try {
            await auth.currentUser.reload();
            await auth.currentUser.getIdToken(true);
            await window.__heroApplyAuthUser(auth.currentUser);
            if (!auth.currentUser.emailVerified) setGateStatus('It is not verified yet. Open the link in your email, then check again.', true);
        } catch (e) { setGateStatus(`Could not check verification (${e.code || 'error'}).`, true); }
    }

    async function sendLink() {
        if (!auth) return setGateStatus('Firebase is still connecting. Try again shortly.', true);
        const emailInput = document.getElementById('gate-email') || accountForm?.querySelector('#hero-member-email');
        const nameInput = document.getElementById('gate-name');
        const email = (emailInput?.value || '').trim().toLowerCase();
        const name = (nameInput?.value || localStorage.getItem('hero_member_name') || 'Hero player').trim();
        const showMessage = (message, error = false) => authGate && !authGate.classList.contains('hidden') ? setGateStatus(message, error) : setStatus(message, error);
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return showMessage('Enter a valid email address.', true);
        localStorage.setItem(pendingEmailKey, email); localStorage.setItem(pendingNameKey, name);
        try { await auth.sendSignInLinkToEmail(email, { url: location.origin + location.pathname, handleCodeInApp: true }); showMessage(`A sign-in link was sent to ${email}.`); }
        catch (e) { showMessage(`Could not send the link (${e.code || 'error'}). Check Email link sign-in and authorized domains in Firebase.`, true); }
    }
    async function finishEmailLink() {
        if (!auth || !auth.isSignInWithEmailLink(location.href)) return;
        window.__heroEmailLinkPending = true;
        try {
            let email = localStorage.getItem(pendingEmailKey);
            if (!email) email = prompt('Enter the email address that received this sign-in link:');
            if (!email) return;
            const result = await auth.signInWithEmailLink(email.trim().toLowerCase(), location.href);
            await result.user.reload();
            localStorage.removeItem(pendingEmailKey);
            history.replaceState({}, document.title, location.pathname + location.hash);
            if (result.user.emailVerified) {
                await saveProfile(result.user, localStorage.getItem(pendingNameKey) || result.user.displayName || '');
                localStorage.removeItem(pendingNameKey);
                setGateStatus('Email verified. Welcome to Hero.');
            }
        } catch (e) { setGateStatus(`Could not complete sign-in (${e.code || 'error'}). Try the link in the same browser.`, true); }
        finally { window.__heroEmailLinkPending = false; }
    }

    async function saveProfile(user, name) {
        if (!db || !user || user.isAnonymous || !user.emailVerified || !user.email) return false;
        if (!name || name.length < 2 || name.length > 40) { setStatus('Add a name to finish your profile.', true); return false; }
        const key = `${user.uid}|${user.email}|${name}`;
        if (key === profileSavedKey) return true;
        if (profileWriteTask && key === profileWriteKey) return profileWriteTask;
        profileWriteKey = key;
        profileWriteTask = (async () => {
            try {
                const stamp = firebase.firestore.FieldValue.serverTimestamp();
                await Promise.all([
                    dataCol().collection('members').doc(user.uid).set({ userId: user.uid, name, email: user.email, updatedAt: stamp }, { merge: true }),
                    dataCol().collection('deviceProfiles').doc(deviceId()).set({ deviceId: deviceId(), userId: user.uid, name, email: user.email, updatedAt: firebase.firestore.FieldValue.serverTimestamp() }, { merge: true })
                ]);
                profileSavedKey = key; window.dispatchEvent(new Event('hero-profiles-updated')); setStatus('Profile saved.'); return true;
            } catch (e) { setStatus(`Profile could not be saved (${e.code || 'error'}). Deploy the updated Firestore rules and retry.`, true); return false; }
            finally { profileWriteTask = null; }
        })();
        return profileWriteTask;
    }

    function showVerificationControls(user) {
        if (!gateForm || !user || !user.email || user.emailVerified) return;
        gateForm.innerHTML = `<p class="hero-auth-pending">Signed in as <strong>${esc(user.email)}</strong>. Verify your email to unlock Hero features.</p><button id="gate-resend" class="hero-auth-submit">Resend verification email</button><button id="gate-refresh" class="hero-auth-secondary">I verified my email</button><button id="gate-signout" class="hero-auth-link">Sign in with another account</button>`;
        gateForm.querySelector('#gate-resend').onclick = resendVerification;
        gateForm.querySelector('#gate-refresh').onclick = refreshVerification;
        gateForm.querySelector('#gate-signout').onclick = signOut;
    }

    function roleName(isAdmin, points) {
        if (isAdmin) return 'Steward';
        if (points >= 30000) return 'Legend';
        if (points >= 15000) return 'Historian';
        if (points >= 5000) return 'Cartographer';
        if (points >= 1000) return 'Scout';
        return 'Explorer';
    }
    async function refreshMemberProfile(user, isAdmin = false) {
        const box = document.getElementById('member-profile-content');
        if (!box || !user || user.isAnonymous) return;
        try {
            const boards = await Promise.all(['leaderboard', 'leaderboardTwoYear', 'flappy'].map(name => dataCol().collection(name).where('userId', '==', user.uid).get()));
            profileScores = boards.slice(0, 2).flatMap((snap, i) => snap.docs.map(doc => ({ ...doc.data(), tour: i ? '2 Year' : '1 Year' })));
            profileScores.push(...boards[2].docs.map(doc => ({ ...doc.data(), tour: 'Flappy Bird', flappy: true })));
            const quizScores = profileScores.filter(row => !row.flappy);
            const best = quizScores.reduce((n, row) => Math.max(n, Number(row.score) || 0), 0);
            const flappyBest = profileScores.filter(row => row.flappy).reduce((n, row) => Math.max(n, Number(row.score) || 0), 0);
            const total = quizScores.reduce((n, row) => n + (Number(row.score) || 0), 0);
            const perfect = quizScores.some(row => row.perfect === true), achievements = [];
            if (quizScores.length) achievements.push(['First Voyage', 'Saved your first quiz score.']);
            if (quizScores.length >= 5) achievements.push(['Seasoned Explorer', 'Saved scores from five journeys.']);
            if (perfect) achievements.push(['Flawless Voyage', 'Completed a journey without a missed location.']);
            if (best >= 1000) achievements.push(['Thousand Point Club', 'Scored at least 1,000 points in one journey.']);
            if (best >= 5000) achievements.push(['Atlas Keeper', 'Scored at least 5,000 points in one journey.']);
            if (flappyBest >= 10) achievements.push(['Skybound', 'Scored at least 10 in Flappy Bird.']);
            const role = roleName(isAdmin, total);
            box.replaceChildren();
            const heading = document.createElement('div'); heading.className = 'member-profile-heading';
            const avatar = document.createElement('div'); avatar.className = 'member-avatar'; avatar.textContent = (user.displayName || localStorage.getItem('hero_member_name') || user.email || 'H').trim().charAt(0).toUpperCase();
            const identity = document.createElement('div'); identity.innerHTML = '<h2></h2><p></p><span class="member-role"></span>';
            identity.querySelector('h2').textContent = localStorage.getItem('hero_member_name') || user.displayName || 'Hero player';
            identity.querySelector('p').textContent = user.email || '';
            identity.querySelector('.member-role').textContent = role;
            heading.append(avatar, identity); box.appendChild(heading);
            const stats = document.createElement('div'); stats.className = 'member-stats';
            [[quizScores.length, 'Journeys'], [best.toLocaleString(), 'Quiz best'], [total.toLocaleString(), 'Career points'], [flappyBest.toLocaleString(), 'Flappy best']].forEach(([value, label]) => { const item = document.createElement('div'); item.className = 'member-stat'; item.innerHTML = '<strong></strong><span></span>'; item.querySelector('strong').textContent = value; item.querySelector('span').textContent = label; stats.appendChild(item); });
            box.appendChild(stats);
            const ach = document.createElement('section'); ach.className = 'member-achievements'; ach.innerHTML = '<h3>Achievements & badges</h3><div class="member-badges"></div>';
            if (achievements.length) achievements.forEach(([title, desc]) => { const badge = document.createElement('article'); badge.className = 'member-badge'; badge.innerHTML = '<span class="member-badge-icon">✦</span><div><strong></strong><p></p></div>'; badge.querySelector('strong').textContent = title; badge.querySelector('p').textContent = desc; ach.querySelector('.member-badges').appendChild(badge); });
            else { const empty = document.createElement('p'); empty.className = 'member-empty'; empty.textContent = 'Play a journey and save a score to start earning badges.'; ach.querySelector('.member-badges').appendChild(empty); }
            box.appendChild(ach);
            const recent = document.createElement('section'); recent.className = 'member-recent'; recent.innerHTML = '<h3>Recent scores</h3><div class="member-score-list"></div>';
            profileScores.sort((a, b) => (Number((b.timestamp || b.ts)?.seconds || 0) - Number((a.timestamp || a.ts)?.seconds || 0))).slice(0, 8).forEach(row => { const line = document.createElement('div'); line.className = 'member-score'; const tour = document.createElement('span'); tour.textContent = row.tour; const score = document.createElement('strong'); score.textContent = (Number(row.score) || 0).toLocaleString(); const time = document.createElement('small'); time.textContent = row.flappy ? 'best run' : `${Number(row.time) || 0}s`; line.append(tour, score, time); recent.querySelector('.member-score-list').appendChild(line); });
            box.appendChild(recent);
        } catch (e) { box.textContent = `Could not load your profile (${e.code || 'error'}).`; }
    }

    async function signOut() {
        try { await auth.signOut(); localStorage.removeItem('hero_member_name'); renderAccount(); setGateStatus('You are signed out. Sign in to continue.'); }
        catch (e) { setGateStatus(`Could not sign out (${e.code || 'error'}).`, true); }
    }

    function renderKnownProfiles() {
        const box = document.getElementById('hero-known-profiles'); if (!box) return;
        window.__heroDeviceProfiles = Object.fromEntries(knownProfiles.map(p => [p.deviceId, p]));
        box.innerHTML = knownProfiles.length ? '' : '<p class="text-sm text-slate-500">No verified profiles yet.</p>';
        knownProfiles.forEach(p => {
            const row = document.createElement('div'); row.className = 'flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 dark:border-slate-700 p-3';
            const info = document.createElement('div'); info.className = 'min-w-0';
            const title = document.createElement('div'); title.className = 'font-bold text-sm'; title.textContent = p.name || 'No name';
            const email = document.createElement('div'); email.className = 'text-xs text-slate-500'; email.textContent = p.email || '';
            const id = document.createElement('div'); id.className = 'font-mono text-[10px] text-slate-500'; id.textContent = p.deviceId;
            info.append(title, email, id);
            const actions = document.createElement('div'); actions.className = 'flex gap-2';
            const browser = document.createElement('button'); browser.className = 'cm-btn ghost'; browser.textContent = 'Ban browser'; browser.onclick = () => banDevice(p.deviceId, 'Browser banned by steward');
            const account = document.createElement('button'); account.className = 'cm-btn go'; account.textContent = 'Ban account'; account.onclick = () => banDevice('u_' + p.userId, 'Account banned by steward');
            actions.append(browser, account); row.append(info, actions); box.appendChild(row);
        });
        window.dispatchEvent(new Event('hero-profiles-updated'));
    }
    function startProfiles() {
        if (!db || profileSub) return;
        profileSub = dataCol().collection('deviceProfiles').orderBy('updatedAt', 'desc').limit(200).onSnapshot(s => { knownProfiles = s.docs.map(d => Object.assign({ deviceId: d.id }, d.data())); renderKnownProfiles(); }, e => {
            console.error('Verified profiles:', e);
            const box = document.getElementById('hero-known-profiles'); if (box) box.textContent = `Could not load verified profiles (${e.code || 'error'}).`;
        });
    }
    function stopProfiles() { if (profileSub) profileSub(); profileSub = null; knownProfiles = []; window.__heroDeviceProfiles = {}; const box = document.getElementById('hero-known-profiles'); if (box) box.innerHTML = ''; }

    function makeUI() {
        const actions = document.getElementById('nav-actions');
        if (!actions || document.getElementById('hero-account-open')) return;
        const button = document.createElement('button'); button.id = 'hero-account-open'; button.className = 'flex items-center gap-2 text-sm font-semibold hover:text-indigo-600 dark:hover:text-indigo-400 transition'; button.setAttribute('aria-label', 'Profile and account'); button.innerHTML = '<i data-lucide="user-round" class="w-4 h-4"></i><span class="hidden sm:inline">Profile</span>'; actions.insertBefore(button, document.getElementById('theme-btn'));
        const dialog = document.createElement('div'); dialog.id = 'hero-account-dialog'; dialog.className = 'hidden fixed inset-0 z-[100] bg-slate-950/60 p-4 items-center justify-center';
        dialog.innerHTML = '<section class="glass-panel w-full max-w-md rounded-2xl p-6"><div class="flex items-center justify-between"><h2 class="text-xl font-extrabold">Account</h2><button id="hero-account-close" class="cm-btn ghost" aria-label="Close">Close</button></div><div id="hero-account-form" class="mt-4"></div><p id="hero-account-status" class="text-sm mt-3" role="status"></p></section>';
        document.body.appendChild(dialog); accountDialog = dialog; accountForm = dialog.querySelector('#hero-account-form'); accountStatus = dialog.querySelector('#hero-account-status');
        window.__heroOpenAccountDialog = () => { renderAccount(); dialog.classList.remove('hidden'); dialog.classList.add('flex'); };
        button.onclick = () => { if (currentMember()) switchView('profile-view'); else window.__heroOpenAccountDialog(); };
        dialog.querySelector('#hero-account-close').onclick = () => { dialog.classList.add('hidden'); dialog.classList.remove('flex'); };
        dialog.addEventListener('click', e => { if (e.target === dialog) { dialog.classList.add('hidden'); dialog.classList.remove('flex'); } });

        authGate = document.createElement('div'); authGate.id = 'hero-auth-gate'; authGate.className = 'hero-auth-gate';
        authGate.innerHTML = '<section class="hero-auth-card"><div class="hero-auth-mark">H</div><p class="hero-auth-eyebrow">HERO ACCOUNT</p><h1>Make your mark.</h1><p class="hero-auth-description">Sign in to play, save scores, build your profile, and earn achievements. Verify your email to unlock the site.</p><div id="hero-auth-form"></div><p id="hero-auth-status" class="hero-auth-status" role="status">Connecting to secure sign-in...</p><div class="hero-auth-steward"><button id="hero-steward-toggle" type="button">Steward sign-in</button><div id="hero-steward-fields" class="hidden"><input id="hero-steward-password" type="password" placeholder="Steward password" autocomplete="current-password"><button id="hero-steward-submit" type="button">Continue</button></div></div></section>';
        document.body.appendChild(authGate); gateForm = authGate.querySelector('#hero-auth-form'); gateStatus = authGate.querySelector('#hero-auth-status'); renderGateForm();
        authGate.querySelector('#hero-steward-toggle').onclick = () => authGate.querySelector('#hero-steward-fields').classList.toggle('hidden');
        const steward = authGate.querySelector('#hero-steward-password');
        const doStewardLogin = () => { const input = document.getElementById('admin-password'); if (!input) return setGateStatus('Open the Steward page and try again.', true); input.value = steward.value; setGateStatus('Checking steward credentials...'); unlockAdmin().then(() => setTimeout(() => { if (!window.__heroCanAccessApp) setGateStatus('Steward sign-in did not complete. Check the password and secure sign-in setup.', true); }, 1800)); };
        authGate.querySelector('#hero-steward-submit').onclick = doStewardLogin;
        steward.addEventListener('keydown', e => { if (e.key === 'Enter') doStewardLogin(); });

        const card = document.createElement('section'); card.dataset.atab = 'site'; card.className = 'bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm p-5 mt-6';
        if (document.getElementById('admin-panel').dataset.active !== 'site') card.classList.add('atab-off');
        card.innerHTML = '<h3 class="font-bold text-slate-900 dark:text-white">Verified browsers</h3><p class="text-xs text-slate-500 mt-1 mb-3">Verified accounts and browsers linked to them. Ban a browser or the whole account.</p><div id="hero-known-profiles" class="space-y-2"></div>';
        document.getElementById('admin-panel').appendChild(card);
        if (window.lucide) lucide.createIcons(); renderAccount();
        if (!auth) setGateStatus('Firebase sign-in is unavailable. Check the site Firebase configuration.');
        else if (auth.currentUser) window.__heroApplyAuthUser(auth.currentUser);
        else setGateStatus('Sign in or create a verified account to continue.');
    }

    window.addEventListener('DOMContentLoaded', makeUI);
    window.addEventListener('hero-firebase-ready', finishEmailLink);
    window.addEventListener('hero-auth-state', async e => {
        const { user, authorized, isAdmin } = e.detail || {};
        renderAccount();
        if (authorized) {
            authGate?.classList.add('hidden');
            if (user && !isAdmin) {
                const name = localStorage.getItem('hero_member_name') || user.displayName || '';
                if (name) await saveProfile(user, name);
                const playerName = document.getElementById('player-name');
                if (playerName && !playerName.value) playerName.value = name.slice(0, 15);
                await refreshMemberProfile(user, false);
                setAccountLabel(name || 'Profile');
            } else if (user) await refreshMemberProfile(user, true);
        } else {
            authGate?.classList.remove('hidden');
            const form = gateForm;
            if (user && user.email && !user.emailVerified) {
                setGateStatus(`Verify ${user.email} to unlock Hero. Check your inbox or resend the message.`);
                showVerificationControls(user);
            } else if (form && !form.querySelector('#gate-submit')) {
                renderGateForm(); setGateStatus(user ? 'This account is not eligible to access the site.' : 'Sign in or create a verified account to continue.');
            }
        }
    });
    window.addEventListener('hero-admin-authenticated', startProfiles);
    window.addEventListener('hero-admin-locked', stopProfiles);
    window.addEventListener('hero-score-saved', () => { const user = currentMember(); if (user) refreshMemberProfile(user); });
    window.addEventListener('hero-profiles-updated', () => { if (window.renderRuntimeBugs) window.renderRuntimeBugs(); });
    window.addEventListener('hero-auth-state', e => { const user = e.detail && e.detail.user; if (user && !e.detail.authorized) profileScores = []; });
    window.banVerifiedAccount = uid => banDevice('u_' + uid, 'Account banned by steward');
})();
