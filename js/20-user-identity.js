// ================= VERIFIED USER IDENTITY =================
(function () {
    const pendingEmailKey = 'hero_pending_email';
    const pendingNameKey = 'hero_pending_name';
    let accountDialog, accountStatus, accountForm, profileSub = null, knownProfiles = [], profileWriteKey = '', profileWriteTask = null, profileSavedKey = '';

    const dataCol = () => db.collection('artifacts').doc(appId).collection('public').doc('data');
    const currentMember = () => auth && auth.currentUser && !auth.currentUser.isAnonymous && auth.currentUser.uid !== 'admin' ? auth.currentUser : null;
    const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

    function setStatus(msg, error = false) {
        if (!accountStatus) return;
        accountStatus.textContent = msg;
        accountStatus.classList.toggle('text-rose-600', error);
        accountStatus.classList.toggle('text-emerald-600', !error);
    }

    function renderAccount() {
        if (!accountDialog) return;
        const user = currentMember();
        accountForm.innerHTML = '';
        if (user && user.emailVerified) {
            const name = localStorage.getItem('hero_member_name') || user.displayName || '';
            accountForm.innerHTML = '<p class="text-sm text-slate-600 dark:text-slate-300">Verified as <strong id="hero-member-email"></strong>. Your name and this browser ID are visible to stewards for moderation.</p><label class="block text-xs font-bold uppercase tracking-wide mt-4 mb-1">Name</label><input id="hero-member-name" maxlength="40" class="w-full p-3 rounded-lg border bg-white dark:bg-slate-900 dark:text-white" autocomplete="name"><div class="flex gap-2 mt-4"><button id="hero-member-save" class="cm-btn go flex-1">Save name</button><button id="hero-member-signout" class="cm-btn ghost">Sign out</button></div>';
            accountForm.querySelector('#hero-member-email').textContent = user.email || '';
            accountForm.querySelector('#hero-member-name').value = name;
            accountForm.querySelector('#hero-member-save').onclick = async () => {
                const nextName = accountForm.querySelector('#hero-member-name').value.trim();
                if (nextName.length < 2) return setStatus('Enter a name with at least 2 characters.', true);
                localStorage.setItem('hero_member_name', nextName);
                await saveProfile(user, nextName);
            };
            accountForm.querySelector('#hero-member-signout').onclick = signOut;
            const accountButton = document.getElementById('hero-account-open'); if (accountButton) accountButton.textContent = name || 'Account';
        } else {
            accountForm.innerHTML = '<p class="text-sm text-slate-600 dark:text-slate-300">Verify your email with a sign-in link. This connects your name and email to this browser for moderation; stewards can use that connection to ban a browser or verified account.</p><label class="block text-xs font-bold uppercase tracking-wide mt-4 mb-1">Name</label><input id="hero-member-name" maxlength="40" required class="w-full p-3 rounded-lg border bg-white dark:bg-slate-900 dark:text-white" autocomplete="name"><label class="block text-xs font-bold uppercase tracking-wide mt-3 mb-1">Email</label><input id="hero-member-email" type="email" maxlength="254" required class="w-full p-3 rounded-lg border bg-white dark:bg-slate-900 dark:text-white" autocomplete="email"><button id="hero-member-send" class="cm-btn go w-full mt-4">Email me a sign-in link</button>';
            accountForm.querySelector('#hero-member-name').value = localStorage.getItem(pendingNameKey) || '';
            accountForm.querySelector('#hero-member-email').value = localStorage.getItem(pendingEmailKey) || '';
            accountForm.querySelector('#hero-member-send').onclick = sendLink;
            const accountButton = document.getElementById('hero-account-open'); if (accountButton) accountButton.textContent = 'Sign in';
        }
    }

    async function sendLink() {
        if (!auth || !auth.currentUser) return setStatus('Firebase is still connecting. Try again in a moment.', true);
        const name = accountForm.querySelector('#hero-member-name').value.trim();
        const email = accountForm.querySelector('#hero-member-email').value.trim().toLowerCase();
        if (name.length < 2 || name.length > 40) return setStatus('Enter a name between 2 and 40 characters.', true);
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return setStatus('Enter a valid email address.', true);
        localStorage.setItem(pendingEmailKey, email);
        localStorage.setItem(pendingNameKey, name);
        localStorage.setItem('hero_member_name', name);
        try {
            await auth.sendSignInLinkToEmail(email, { url: location.origin + location.pathname, handleCodeInApp: true });
            setStatus('Check your inbox and open the sign-in link on this browser.');
        } catch (e) {
            console.error('Email link sign-in:', e);
            setStatus(`Could not send the link (${e.code || 'error'}). Check that Email link sign-in is enabled in Firebase.`, true);
        }
    }

    async function finishEmailLink() {
        if (!auth || !auth.isSignInWithEmailLink(location.href)) return;
        let email = localStorage.getItem(pendingEmailKey);
        if (!email) email = prompt('Enter the email address that received this sign-in link:');
        if (!email) return;
        email = email.trim().toLowerCase();
        try {
            const credential = firebase.auth.EmailAuthProvider.credentialWithLink(email, location.href);
            let result;
            if (auth.currentUser && auth.currentUser.isAnonymous) {
                try { result = await auth.currentUser.linkWithCredential(credential); }
                catch (e) {
                    if (e.code !== 'auth/credential-already-in-use') throw e;
                    result = await auth.signInWithEmailLink(email, location.href);
                }
            } else result = await auth.signInWithEmailLink(email, location.href);
            await result.user.reload();
            localStorage.removeItem(pendingEmailKey);
            history.replaceState({}, document.title, location.pathname + location.hash);
            renderAccount();
            await saveProfile(result.user, localStorage.getItem('hero_member_name') || localStorage.getItem(pendingNameKey) || '');
            localStorage.removeItem(pendingNameKey);
            setStatus('Email verified and browser linked to your account.');
        } catch (e) {
            console.error('Complete email link:', e);
            setStatus(`Could not complete sign-in (${e.code || 'error'}). Open the link in the same browser and try again.`, true);
        }
    }

    async function saveProfile(user, name) {
        if (!db || !user || user.isAnonymous || !user.emailVerified || !user.email) return;
        if (!name || name.length < 2 || name.length > 40) return setStatus('Add a name to finish setting up your account.', true);
        const id = deviceId();
        const key = `${id}|${user.uid}|${user.email}|${name}`;
        if (key === profileSavedKey) return;
        if (profileWriteTask && key === profileWriteKey) return profileWriteTask;
        profileWriteKey = key;
        profileWriteTask = (async () => { try {
            await dataCol().collection('deviceProfiles').doc(id).set({
                deviceId: id, userId: user.uid, name, email: user.email,
                updatedAt: firebase.firestore.FieldValue.serverTimestamp()
            }, { merge: true });
            profileSavedKey = key;
            window.dispatchEvent(new Event('hero-profiles-updated'));
            setStatus('Your verified account is linked to this browser.');
        } catch (e) {
            console.error('Save verified profile:', e);
            setStatus(`Profile could not be saved (${e.code || 'error'}). Publish the updated Firestore rules.`, true);
        } finally { profileWriteTask = null; } })();
        return profileWriteTask;
    }

    async function signOut() {
        try { await auth.signOut(); await auth.signInAnonymously(); localStorage.removeItem('hero_member_name'); renderAccount(); setStatus('Signed out. This browser is anonymous again.'); }
        catch (e) { setStatus(`Could not sign out (${e.code || 'error'}).`, true); }
    }

    function renderKnownProfiles() {
        const box = document.getElementById('hero-known-profiles');
        if (!box) return;
        window.__heroDeviceProfiles = Object.fromEntries(knownProfiles.map(p => [p.deviceId, p]));
        box.innerHTML = knownProfiles.length ? '' : '<p class="text-sm text-slate-500">No verified browsers yet.</p>';
        knownProfiles.forEach(p => {
            const row = document.createElement('div');
            row.className = 'flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 dark:border-slate-700 p-3';
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
        profileSub = dataCol().collection('deviceProfiles').orderBy('updatedAt', 'desc').limit(200).onSnapshot(s => {
            knownProfiles = s.docs.map(d => Object.assign({ deviceId: d.id }, d.data()));
            renderKnownProfiles();
        }, e => { console.error('Verified profiles:', e); const box = document.getElementById('hero-known-profiles'); if (box) box.textContent = `Could not load verified profiles (${e.code || 'error'}).`; });
    }
    function stopProfiles() {
        if (profileSub) profileSub();
        profileSub = null; knownProfiles = []; window.__heroDeviceProfiles = {};
        const box = document.getElementById('hero-known-profiles'); if (box) box.innerHTML = '';
    }

    function makeUI() {
        const actions = document.getElementById('nav-actions');
        if (!actions || document.getElementById('hero-account-open')) return;
        const button = document.createElement('button'); button.id = 'hero-account-open';
        button.className = 'flex items-center gap-2 text-sm font-semibold hover:text-indigo-600 dark:hover:text-indigo-400 transition';
        button.setAttribute('aria-label', 'Account sign in');
        button.innerHTML = '<i data-lucide="user-round" class="w-4 h-4"></i><span class="hidden sm:inline">Sign in</span>';
        actions.insertBefore(button, document.getElementById('theme-btn'));
        const dialog = document.createElement('div'); dialog.id = 'hero-account-dialog'; dialog.className = 'hidden fixed inset-0 z-[100] bg-slate-950/60 p-4 items-center justify-center';
        dialog.innerHTML = '<section class="glass-panel w-full max-w-md rounded-2xl p-6"><div class="flex items-center justify-between"><h2 class="text-xl font-extrabold">Browser account</h2><button id="hero-account-close" class="cm-btn ghost" aria-label="Close">Close</button></div><div id="hero-account-form" class="mt-4"></div><p id="hero-account-status" class="text-sm mt-3" role="status"></p></section>';
        document.body.appendChild(dialog);
        accountDialog = dialog; accountForm = dialog.querySelector('#hero-account-form'); accountStatus = dialog.querySelector('#hero-account-status');
        button.onclick = () => { renderAccount(); dialog.classList.remove('hidden'); dialog.classList.add('flex'); };
        dialog.querySelector('#hero-account-close').onclick = () => { dialog.classList.add('hidden'); dialog.classList.remove('flex'); };
        dialog.addEventListener('click', e => { if (e.target === dialog) { dialog.classList.add('hidden'); dialog.classList.remove('flex'); } });

        const card = document.createElement('section'); card.dataset.atab = 'site';
        card.className = 'bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm p-5 mt-6';
        if (document.getElementById('admin-panel').dataset.active !== 'site') card.classList.add('atab-off');
        card.innerHTML = '<h3 class="font-bold text-slate-900 dark:text-white">Verified browsers</h3><p class="text-xs text-slate-500 mt-1 mb-3">People who verified an email can be identified here. Ban one browser or their verified account.</p><div id="hero-known-profiles" class="space-y-2"></div>';
        document.getElementById('admin-panel').appendChild(card);
        if (window.lucide) lucide.createIcons();
        renderAccount();
    }

    document.addEventListener('DOMContentLoaded', makeUI);
    window.addEventListener('hero-firebase-ready', () => {
        auth.onAuthStateChanged(user => {
            renderAccount();
            if (user && user.emailVerified && user.uid !== 'admin') saveProfile(user, localStorage.getItem('hero_member_name') || '');
        });
        finishEmailLink();
    });
    window.addEventListener('hero-admin-authenticated', startProfiles);
    window.addEventListener('hero-admin-locked', stopProfiles);
    window.addEventListener('hero-profiles-updated', () => { if (window.renderRuntimeBugs) window.renderRuntimeBugs(); });

    window.addEventListener('hero-auth-state', e => {
        const user = e.detail && e.detail.user;
        if (user && user.emailVerified && user.uid !== 'admin') saveProfile(user, localStorage.getItem('hero_member_name') || '');
    });

    window.banVerifiedAccount = uid => banDevice('u_' + uid, 'Account banned by steward');
})();
