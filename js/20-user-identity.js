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
//   window.__heroDeviceProfiles        { deviceId: {name,username,userId,deviceId} } for admin tooling
//   #hero-account-open                 the nav button (created here, inserted with the primary actions)
//   #member-profile-content            populated with the signed-in profile (profile-view in index.html)
(function () {
    const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
    const dataCol = () => db.collection('artifacts').doc(appId).collection('public').doc('data');
    const memberRef = (uid) => dataCol().collection('members').doc(uid);
    const ROLES = [[30000, 'Legend'], [15000, 'Historian'], [5000, 'Cartographer'], [1000, 'Scout'], [0, 'Explorer']];
    const roleFor = (score) => (ROLES.find(([min]) => score >= min) || ROLES[ROLES.length - 1])[1];
    const USERNAME_PATTERN = /^[a-zA-Z0-9_]{3,20}$/;
    const ACCOUNT_DOMAIN = 'accounts.hero.invalid';

    let latest = { user: null, authorized: false, isAdmin: false };
    let mode = 'signin';
    let profileOpenPending = false;
    let dialog = null, body = null;
    let knownProfilesUnsub = null;
    let pendingRecoveryCode = '';
    let pendingRecoveryUsername = '';

    function usernameEmail(username) { return `${username.toLowerCase()}@${ACCOUNT_DOMAIN}`; }
    function userUsername(user) {
        const email = String(user && user.email || '');
        return email.toLowerCase().endsWith(`@${ACCOUNT_DOMAIN}`) ? email.slice(0, -(`@${ACCOUNT_DOMAIN}`).length) : '';
    }
    function newRecoveryCode() {
        const bytes = crypto.getRandomValues(new Uint8Array(20));
        return [...bytes].map((byte) => byte.toString(16).padStart(2, '0')).join('').toUpperCase().match(/.{1,4}/g).join('-');
    }
    async function saveRecoveryCode(user, username, recoveryCode) {
        const idToken = await user.getIdToken(true);
        const response = await fetch('/api/account-recovery', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${idToken}` },
            body: JSON.stringify({ action: 'save', username, recoveryCode }),
        });
        const result = await response.json().catch(() => ({}));
        if (!response.ok) {
            const message = result.error === 'not_configured'
                ? 'Account recovery is not configured yet. Ask a steward to finish the private Firebase setup.'
                : result.error === 'username_unavailable'
                    ? 'That username is already in use. Choose another one.'
                    : 'Could not securely save your recovery code. Please retry.';
            throw new Error(message);
        }
    }
    async function deleteRecoveryCode(user, username) {
        const idToken = await user.getIdToken(true);
        const response = await fetch('/api/account-recovery', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${idToken}` },
            body: JSON.stringify({ action: 'delete', username }),
        });
        const result = await response.json().catch(() => ({}));
        if (!response.ok) {
            throw new Error(result.error === 'not_configured'
                ? 'Account recovery is not configured. Your account was not deleted.'
                : 'Could not remove the recovery record. Your account was not deleted.');
        }
    }
    async function saveAccountProfile(user, username, name) {
        await memberRef(user.uid).set({
            userId: user.uid,
            name,
            username,
            recoveryReady: false,
            email: firebase.firestore.FieldValue.delete(),
            updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
        }, { merge: true });
        const profiles = await dataCol().collection('deviceProfiles').where('userId', '==', user.uid).get();
        for (let start = 0; start < profiles.docs.length; start += 400) {
            const batch = db.batch();
            profiles.docs.slice(start, start + 400).forEach((doc) => batch.update(doc.ref, {
                username,
                email: firebase.firestore.FieldValue.delete(),
                updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
            }));
            await batch.commit();
        }
    }
    async function markRecoveryReady(user) {
        await memberRef(user.uid).update({
            recoveryReady: true,
            updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
        });
    }
    async function finishUsernameSetup(user, username) {
        const profile = await memberRef(user.uid).get();
        if (profile.exists && profile.data().recoveryReady === true) return '';
        await saveAccountProfile(user, username, username);
        const recoveryCode = newRecoveryCode();
        await saveRecoveryCode(user, username, recoveryCode);
        await markRecoveryReady(user);
        return recoveryCode;
    }

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
        const primaryLinks = actions.querySelector('.nav-primary-links');
        const settingsButton = primaryLinks && primaryLinks.querySelector('[aria-label="Settings"]');
        if (primaryLinks && settingsButton) primaryLinks.insertBefore(btn, settingsButton);
        else actions.insertBefore(btn, document.getElementById('nav-more') || document.getElementById('theme-btn') || null);
        if (window.lucide) lucide.createIcons();
    }

    // ---------------- gate: sign in / create account ----------------
    function renderGate(errorText) {
        const register = mode === 'register';
        if (mode === 'recover') return renderRecoveryGate(errorText);
        body.innerHTML = `
            <div class="hero-auth-mark">H</div>
            <p class="hero-auth-eyebrow">HERO ACCOUNT</p>
            <h2 class="hero-auth-title">${register ? 'Create your account' : 'Welcome back'}</h2>
            <p class="hero-auth-sub">${register ? 'Choose a private username that does not include your real name, school ID, or other identifying details. Save your one-time recovery code.' : 'Sign in with your username to play, save scores, and talk with Clio.'}</p>
            ${errorText ? `<div class="hero-auth-error">${esc(errorText)}</div>` : ''}
            <form id="ha-form" novalidate>
                <label class="hero-auth-label">Username</label><input id="ha-username" class="hero-auth-input" maxlength="20" minlength="3" autocomplete="username" autocapitalize="none" spellcheck="false" placeholder="PandaCoder42" required>
                <label class="hero-auth-label">Password</label>
                <input id="ha-password" class="hero-auth-input" type="password" minlength="8" maxlength="128" autocomplete="${register ? 'new-password' : 'current-password'}" placeholder="${register ? 'At least 8 characters' : 'Your password'}" required>
                ${register ? '<label class="hero-auth-label">Confirm password</label><input id="ha-confirm" class="hero-auth-input" type="password" minlength="8" autocomplete="new-password" placeholder="Type it again" required>' : ''}
                <button type="submit" id="ha-submit" class="hero-auth-submit">${register ? 'Create account' : 'Sign in'}</button>
            </form>
            <div class="hero-auth-links-primary"><button type="button" id="ha-toggle">${register ? 'Already have an account? Sign in' : "New to Hero? Create an account"}</button></div>
            ${!register ? '<div class="hero-auth-links"><button type="button" id="ha-forgot">Forgot password?</button></div>' : ''}
        `;
        document.getElementById('ha-toggle').onclick = () => { mode = register ? 'signin' : 'register'; renderGate(); };
        const forgotButton = document.getElementById('ha-forgot');
        if (forgotButton) forgotButton.onclick = () => { mode = 'recover'; renderGate(); };
        document.getElementById('ha-form').addEventListener('submit', handleGateSubmit);
        document.getElementById('ha-username').focus();
    }

    async function handleGateSubmit(e) {
        e.preventDefault();
        const register = mode === 'register';
        const username = document.getElementById('ha-username').value.trim();
        const password = document.getElementById('ha-password').value;
        const confirm = register ? document.getElementById('ha-confirm').value : '';
        if (!USERNAME_PATTERN.test(username)) return renderGate('Use 3–20 letters, numbers, or underscores for your username.');
        if (password.length < 8 || password.length > 128) return renderGate('Choose a password between 8 and 128 characters.');
        if (register && password !== confirm) return renderGate("Passwords don't match.");

        const btn = document.getElementById('ha-submit');
        btn.disabled = true; const original = btn.textContent; btn.textContent = register ? 'Creating account…' : 'Signing in…';
        try {
            if (register) {
                const normalizedUsername = username.toLowerCase();
                const credential = await auth.createUserWithEmailAndPassword(usernameEmail(normalizedUsername), password);
                try {
                    await credential.user.updateProfile({ displayName: normalizedUsername });
                    const recoveryCode = await finishUsernameSetup(credential.user, normalizedUsername);
                    await window.__heroApplyAuthUser(auth.currentUser);
                    pendingRecoveryCode = recoveryCode;
                    pendingRecoveryUsername = normalizedUsername;
                    renderRecoveryReceipt();
                } catch (error) {
                    try {
                        await deleteRecoveryCode(credential.user, normalizedUsername);
                        await memberRef(credential.user.uid).delete();
                        await credential.user.delete();
                        await auth.signOut();
                    } catch (cleanupError) {
                        console.error('Could not fully roll back incomplete account setup; the account is retained for retry:', cleanupError);
                        await auth.signOut().catch((signOutError) => console.error('Could not sign out after incomplete account setup:', signOutError));
                    }
                    throw error;
                }
            } else {
                const normalizedUsername = username.toLowerCase();
                const credential = await auth.signInWithEmailAndPassword(usernameEmail(normalizedUsername), password);
                const recoveryCode = await finishUsernameSetup(credential.user, normalizedUsername);
                if (recoveryCode) {
                    await window.__heroApplyAuthUser(credential.user);
                    pendingRecoveryCode = recoveryCode;
                    pendingRecoveryUsername = normalizedUsername;
                    renderRecoveryReceipt();
                }
            }
        } catch (err) {
            btn.disabled = false; btn.textContent = original;
            renderGate(gateErrorMessage(err));
        }
    }

    function gateErrorMessage(err) {
        if (err && err.message && !err.code) return err.message;
        const map = {
            'auth/email-already-in-use': 'That username is already in use. Choose another one or sign in.',
            'auth/invalid-email': 'That username could not be used. Choose another one.',
            'auth/weak-password': 'Choose a stronger password (at least 8 characters).',
            'auth/wrong-password': 'Incorrect username or password.',
            'auth/user-not-found': 'Incorrect username or password.',
            'auth/invalid-credential': 'Incorrect username or password.',
            'auth/too-many-requests': 'Too many attempts. Wait a minute and try again.',
            'auth/network-request-failed': 'Could not reach the sign-in server. Check your connection.',
            'auth/operation-not-allowed': 'Username sign-in is not enabled in Firebase Authentication. Ask a steward to check the Email/Password provider setting.',
            'auth/unauthorized-domain': 'This website domain is not authorized in Firebase Authentication. Ask a steward to check Firebase settings.',
            'auth/requires-recent-login': 'Sign out and sign back in, then retry.',
        };
        return map[err.code] || (err.message || 'Something went wrong. Please try again.');
    }

    function renderRecoveryGate(errorText) {
        body.innerHTML = `
            <div class="hero-auth-mark">H</div>
            <p class="hero-auth-eyebrow">ACCOUNT RECOVERY</p>
            <h2 class="hero-auth-title">Reset your password</h2>
            <p class="hero-auth-sub">Use the one-time recovery code you saved when you created your account.</p>
            ${errorText ? `<div class="hero-auth-error">${esc(errorText)}</div>` : ''}
            <form id="ha-recover-form" novalidate>
                <label class="hero-auth-label">Username</label><input id="ha-recover-username" class="hero-auth-input" maxlength="20" autocomplete="username" autocapitalize="none" spellcheck="false" required>
                <label class="hero-auth-label">One-time recovery code</label><input id="ha-recover-code" class="hero-auth-input" maxlength="80" autocomplete="one-time-code" spellcheck="false" required>
                <label class="hero-auth-label">New password</label><input id="ha-recover-password" class="hero-auth-input" type="password" minlength="8" maxlength="128" autocomplete="new-password" required>
                <label class="hero-auth-label">Confirm new password</label><input id="ha-recover-confirm" class="hero-auth-input" type="password" minlength="8" maxlength="128" autocomplete="new-password" required>
                <button type="submit" id="ha-recover-submit" class="hero-auth-submit">Reset password</button>
            </form>
            <div class="hero-auth-links-primary"><button type="button" id="ha-recover-back">Back to sign in</button></div>
        `;
        document.getElementById('ha-recover-back').onclick = () => { mode = 'signin'; renderGate(); };
        document.getElementById('ha-recover-form').addEventListener('submit', handleRecoverySubmit);
    }

    async function handleRecoverySubmit(event) {
        event.preventDefault();
        const username = document.getElementById('ha-recover-username').value.trim().toLowerCase();
        const recoveryCode = document.getElementById('ha-recover-code').value.trim();
        const password = document.getElementById('ha-recover-password').value;
        const confirm = document.getElementById('ha-recover-confirm').value;
        if (!USERNAME_PATTERN.test(username)) return renderRecoveryGate('Enter a valid username.');
        if (password.length < 8 || password.length > 128) return renderRecoveryGate('Choose a password between 8 and 128 characters.');
        if (password !== confirm) return renderRecoveryGate("Passwords don't match.");
        const button = document.getElementById('ha-recover-submit');
        button.disabled = true; button.textContent = 'Resetting…';
        let passwordReset = false;
        try {
            const response = await fetch('/api/account-recovery', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'reset', username, recoveryCode, password }),
            });
            const result = await response.json().catch(() => ({}));
            if (!response.ok) {
                const message = result.error === 'not_configured'
                    ? 'Account recovery is not configured. Ask a steward for help.'
                    : result.error === 'recovery_unavailable'
                        ? 'Recovery is temporarily unavailable. Try again shortly.'
                        : 'Those recovery details could not be verified.';
                throw new Error(message);
            }
            passwordReset = true;
            const credential = await auth.signInWithEmailAndPassword(usernameEmail(username), password);
            const nextCode = newRecoveryCode();
            await window.__heroApplyAuthUser(auth.currentUser);
            try {
                await saveRecoveryCode(credential.user, username, nextCode);
                pendingRecoveryCode = nextCode;
                pendingRecoveryUsername = username;
                renderRecoveryReceipt();
            } catch (error) {
                console.error('Password reset succeeded, but a new recovery code was not saved:', error);
                closeDialog();
                showToast('Password reset succeeded, but a new recovery code could not be created. Create one in your account settings.', 'error');
            }
        } catch (error) {
            const message = passwordReset
                ? 'Your password was reset, but sign-in did not finish. Return to sign in with your new password; the recovery code has been used.'
                : error.message || 'Could not reset the password.';
            renderRecoveryGate(message);
        }
    }

    function renderRecoveryReceipt() {
        if (!pendingRecoveryCode) return;
        body.innerHTML = `
            <div class="hero-auth-mark">H</div>
            <p class="hero-auth-eyebrow">SAVE THIS NOW</p>
            <h2 class="hero-auth-title">Your recovery code</h2>
            <p class="hero-auth-sub">This code is shown once and cannot be retrieved later. Keep it private; anyone with it and your username can reset your password.</p>
            <div class="hero-auth-error" style="font-family:monospace;text-align:center;overflow-wrap:anywhere">${esc(pendingRecoveryCode)}</div>
            <p class="hero-auth-sub">Username: <strong>${esc(pendingRecoveryUsername)}</strong></p>
            <button type="button" id="ha-copy-recovery" class="hero-auth-submit">Copy recovery code</button>
            <button type="button" id="ha-recovery-done" class="hero-auth-submit">I saved it — continue</button>
        `;
        document.getElementById('ha-copy-recovery').onclick = async () => {
            try { await navigator.clipboard.writeText(pendingRecoveryCode); showToast('Recovery code copied.', 'success'); }
            catch { showToast('Copy failed. Select and copy the code manually.', 'error'); }
        };
        document.getElementById('ha-recovery-done').onclick = () => {
            pendingRecoveryCode = ''; pendingRecoveryUsername = '';
            if (latest.authorized) closeDialog();
            else render();
        };
    }

    async function reauthenticateForDeletion(user, password) {
        if (!(user.providerData || []).some((item) => item.providerId === 'password')) {
            throw new Error('This username account cannot be verified for deletion. Sign out and sign back in, then retry.');
        }
        if (!password) throw new Error('Enter your current password to confirm account deletion.');
        const credential = firebase.auth.EmailAuthProvider.credential(user.email, password);
        await user.reauthenticateWithCredential(credential);
    }

    async function deleteOwnedAccountData(user) {
        const data = dataCol(), uid = user.uid;
        const own = (collection) => data.collection(collection).where('userId', '==', uid).get();
        const [scores1, scores2, flappy, feedback, bugs, presence, devices, dailyScores, member, progress, stats, pushTokens] = await Promise.all([
            own('leaderboard'), own('leaderboardTwoYear'), own('flappy'), own('feedback'), own('runtimeBugs'), own('presence'), own('deviceProfiles'),
            db.collectionGroup('scores').where('userId', '==', uid).get(), memberRef(uid).get(), data.collection('dailyChallengeProgress').doc(uid).get(), data.collection('memberStats').doc(uid).get(),
            memberRef(uid).collection('pushTokens').get()
        ]);
        const refs = [
            ...scores1.docs, ...scores2.docs, ...flappy.docs, ...bugs.docs, ...presence.docs, ...devices.docs, ...dailyScores.docs, ...pushTokens.docs
        ].map((doc) => doc.ref);
        if (member.exists) refs.push(member.ref);
        if (progress.exists) refs.push(progress.ref);
        if (stats.exists) refs.push(stats.ref);
        for (const report of feedback.docs) {
            const files = await report.ref.collection('files').get();
            files.docs.forEach((file) => refs.push(file.ref));
            refs.push(report.ref);
        }
        const unique = [...new Map(refs.map((ref) => [ref.path, ref])).values()];
        for (let start = 0; start < unique.length; start += 400) {
            const batch = db.batch();
            unique.slice(start, start + 400).forEach((ref) => batch.delete(ref));
            await batch.commit();
        }
    }

    // ---------------- signed-in account dialog ----------------
    function renderAccount(user) {
        const username = userUsername(user) || (user.uid === 'admin' ? 'steward' : '');
        body.innerHTML = `
            <section class="acct-card">
                <header class="acct-card-head"><span class="acct-ico"><i data-lucide="user-circle"></i></span><div><h3>Profile</h3><p>Username <strong>${esc(username || 'Hero member')}</strong></p></div></header>
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
                <header class="acct-card-head"><span class="acct-ico"><i data-lucide="key-round"></i></span><div><h3>Password &amp; recovery</h3><p>Change your password here. Make a new one-time recovery code if you need to replace a lost one.</p></div></header>
                <label class="acct-label" for="ha-old-pass">Current password</label>
                <input id="ha-old-pass" type="password" class="acct-input" autocomplete="current-password" placeholder="Current password">
                <div class="acct-grid-2">
                    <div><label class="acct-label" for="ha-new-pass">New password</label><input id="ha-new-pass" type="password" minlength="8" class="acct-input" autocomplete="new-password" placeholder="At least 8 characters"></div>
                    <div><label class="acct-label" for="ha-new-pass2">Confirm new password</label><input id="ha-new-pass2" type="password" minlength="8" class="acct-input" autocomplete="new-password" placeholder="Type it again"></div>
                </div>
                <button type="button" id="ha-pw-save" class="cm-btn ghost w-full mt-4"><i data-lucide="lock" class="w-4 h-4"></i> Update password</button>
                ${username && user.uid !== 'admin' ? '<button type="button" id="ha-recovery-new" class="hero-auth-link mt-3">Create a new recovery code</button>' : ''}
            </section>
            <section class="acct-card">
                <h3 class="font-bold text-sm mb-3 flex items-center gap-2"><i data-lucide="award" class="w-4 h-4"></i> Your Hero rank</h3>
                <p id="ha-rank" class="text-sm text-slate-500">Loading\u2026</p>
            </section>
            <section class="acct-card acct-card-danger">
                <button type="button" id="ha-signout" class="cm-btn ghost w-full"><i data-lucide="log-out" class="w-4 h-4"></i> Sign out</button>
                ${user.uid === 'admin' ? '<p class="acct-delete-note">This shared steward session is not a personal Hero account.</p>' : `
                    <div class="acct-delete-zone">
                        <h3>Delete account</h3>
                        <p>Permanently delete your Hero sign-in, profile, quiz scores, Daily Challenge scores and streak, feedback reports, and attachments.</p>
                        <button type="button" id="ha-delete-open" class="acct-delete-open">Delete my account</button>
                        <div id="ha-delete-panel" class="acct-delete-panel hidden">
                            <label class="acct-label" for="ha-delete-word">Type DELETE to confirm</label>
                            <input id="ha-delete-word" class="acct-input" autocomplete="off" spellcheck="false">
                            ${(user.providerData || []).some((item) => item.providerId === 'password') ? '<label class="acct-label" for="ha-delete-password">Current password</label><input id="ha-delete-password" class="acct-input" type="password" autocomplete="current-password">' : '<p class="acct-delete-note">You will confirm with your sign-in provider before deletion.</p>'}
                            <div class="acct-delete-actions"><button type="button" id="ha-delete-cancel" class="cm-btn ghost">Cancel</button><button type="button" id="ha-delete-confirm" class="acct-delete-confirm" disabled>Delete permanently</button></div>
                        </div>
                    </div>`}
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
                const payload = { userId: user.uid, name, username, recoveryReady: username !== '' && user.uid !== 'admin', email: firebase.firestore.FieldValue.delete(), updatedAt: firebase.firestore.FieldValue.serverTimestamp() };
                if (pendingPhoto !== undefined) payload.photoURL = pendingPhoto;
                else { const existing = await memberRef(user.uid).get(); if (existing.exists && existing.data().photoURL) payload.photoURL = existing.data().photoURL; }
                await memberRef(user.uid).set(payload, { merge: true });
                await dataCol().collection('deviceProfiles').doc(window.__heroDeviceId || deviceId()).set({
                    deviceId: window.__heroDeviceId || deviceId(),
                    userId: user.uid,
                    name,
                    username,
                    email: firebase.firestore.FieldValue.delete(),
                    updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
                }, { merge: true });
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
            if (next.length < 8 || next.length > 128) return showToast('New password must be between 8 and 128 characters.', 'error');
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
        const recoveryButton = document.getElementById('ha-recovery-new');
        if (recoveryButton) recoveryButton.onclick = async (event) => {
            const button = event.currentTarget;
            button.disabled = true;
            try {
                const code = newRecoveryCode();
                await saveRecoveryCode(user, username, code);
                pendingRecoveryCode = code;
                pendingRecoveryUsername = username;
                renderRecoveryReceipt();
            } catch (error) {
                showToast(error.message || 'Could not create a recovery code.', 'error');
            } finally {
                button.disabled = false;
            }
        };

        document.getElementById('ha-signout').onclick = () => auth.signOut();

        if (user.uid !== 'admin') {
            const panel = document.getElementById('ha-delete-panel');
            const word = document.getElementById('ha-delete-word');
            const confirmButton = document.getElementById('ha-delete-confirm');
            document.getElementById('ha-delete-open').onclick = () => { panel.classList.remove('hidden'); word.focus(); };
            document.getElementById('ha-delete-cancel').onclick = () => { panel.classList.add('hidden'); word.value = ''; confirmButton.disabled = true; };
            word.oninput = () => { confirmButton.disabled = word.value.trim() !== 'DELETE'; };
            confirmButton.onclick = async () => {
                if (word.value.trim() !== 'DELETE') return;
                confirmButton.disabled = true; confirmButton.textContent = 'Verifying account…';
                try {
                    const password = document.getElementById('ha-delete-password')?.value || '';
                    await reauthenticateForDeletion(user, password);
                    confirmButton.textContent = 'Deleting your data…';
                    await deleteOwnedAccountData(user);
                    const username = userUsername(user);
                    if (username) await deleteRecoveryCode(user, username);
                    await user.delete();
                    localStorage.removeItem('hero_member_name');
                    localStorage.removeItem('mq_playerName');
                    ['hero_miss_default', 'hero_miss_twoyear', `hero_miss_default_account_${user.uid}`, `hero_miss_twoyear_account_${user.uid}`].forEach((key) => localStorage.removeItem(key));
                    closeDialog();
                    await auth.signOut().catch(() => {});
                    showToast('Your Hero account and personal data have been deleted.', 'success');
                } catch (err) {
                    console.error('Account deletion failed:', err);
                    const message = err.code === 'permission-denied'
                        ? 'Account deletion needs the updated Firestore rules. Publish firestore.rules, sign in again, then retry.'
                        : err.code === 'auth/requires-recent-login'
                            ? 'Please sign out and sign back in, then retry account deletion.'
                            : err.code === 'auth/wrong-password' || err.code === 'auth/invalid-credential'
                                ? 'That password did not match this account.'
                                : err.message || `Could not delete the account (${err.code || 'error'}).`;
                    showToast(message, 'error');
                    confirmButton.disabled = false; confirmButton.textContent = 'Delete permanently';
                }
            };
        }

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
            const [y1, y2, flappy, dailyProgressDoc, memberStatsDoc] = await Promise.all([
                dataCol().collection('leaderboard').where('userId', '==', user.uid).get(),
                dataCol().collection('leaderboardTwoYear').where('userId', '==', user.uid).get(),
                dataCol().collection('flappy').where('userId', '==', user.uid).get(),
                dataCol().collection('dailyChallengeProgress').doc(user.uid).get().catch(() => null),
                dataCol().collection('memberStats').doc(user.uid).get().catch(() => null),
            ]);
            const quizRows = [...y1.docs.map((d) => ({ ...d.data(), tour: '1 Year' })), ...y2.docs.map((d) => ({ ...d.data(), tour: '2 Year' }))];
            const scores = quizRows.map((r) => Number(r.score) || 0);
            const best = scores.length ? Math.max(...scores) : 0;
            const flappyBest = flappy.docs.reduce((n, d) => Math.max(n, Number(d.data().score) || 0), 0);
            const dailyProgress = dailyProgressDoc && dailyProgressDoc.exists ? dailyProgressDoc.data() : {};
            const memberStats = memberStatsDoc && memberStatsDoc.exists ? memberStatsDoc.data() : {};
            const weakSpotCount = new Set([
                ...Object.keys(memberStats.missesOneYear || {}), ...Object.keys(memberStats.missesTwoYear || {})
            ]).size;
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
                    <div><div class="text-xl font-extrabold">${esc(user.displayName || userUsername(user))}</div><span class="hero-rank-badge">${esc(roleFor(best))}</span></div>
                </div>
                <div class="an-grid">
                    <div class="an-kpi"><small>Journeys</small><strong>${quizRows.length}</strong></div>
                    <div class="an-kpi"><small>Best score</small><strong>${best.toLocaleString()}</strong></div>
                    <div class="an-kpi"><small>Flappy best</small><strong>${flappyBest || '\u2014'}</strong></div>
                    <div class="an-kpi"><small>Daily streak</small><strong>${dailyStreak} day${dailyStreak === 1 ? '' : 's'}</strong><small>Best: ${Number(dailyProgress.longestStreak) || 0} days</small></div>
                    <div class="an-kpi"><small>Places to revisit</small><strong>${weakSpotCount}</strong></div>
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
        if (pendingRecoveryCode) { renderRecoveryReceipt(); return; }
        const user = latest.user;
        // Stewards can use the same account settings dialog as other authorized users.
        if (!user || user.isAnonymous) { mode = 'signin'; renderGate(); return; }
        if (latest.authorized) { renderAccount(user); return; }
        if (!latest.isAdmin) { mode = 'signin'; renderGate(); return; }
        renderGate();
    }

    window.addEventListener('hero-auth-state', (e) => {
        latest = e.detail || { user: null, authorized: false, isAdmin: false };
        ensureNavButton();
        render();
        if (latest.authorized && latest.user && !latest.user.isAnonymous) startKnownProfiles(); else stopKnownProfiles();
        if (latest.user && !latest.user.isAnonymous && !latest.authorized && !latest.isAdmin) {
            mode = 'signin';
            if (!dialog || dialog.classList.contains('hidden')) openDialog();
            renderGate('This account uses the retired email sign-in and cannot be accessed here. Sign in with a username account or create a new one.');
            return;
        }
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
