// Browser-linked push: announcement notifications only, with opt-in permission.
(function () {
    const buttonId = 'push-notification-toggle';
    const statusId = 'push-notification-status';
    let messaging = null, currentUid = '', enabled = false, foregroundHandlerAttached = false;

    const status = (message) => {
        const el = document.getElementById(statusId);
        if (el) el.textContent = message;
    };
    const setButton = (label, disabled = false) => {
        const button = document.getElementById(buttonId);
        if (button) { button.textContent = label; button.disabled = disabled; }
    };
    const tokenCollection = (uid) => db.collection('artifacts').doc(appId).collection('public').doc('data')
        .collection('members').doc(uid).collection('pushTokens');

    async function getConfig() {
        const response = await fetch('/api/push-config', { cache: 'no-store' });
        const data = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(data.error || `Push settings unavailable (${response.status}).`);
        if (!data.enabled || !data.vapidKey) throw new Error('Push notifications are not configured yet. A steward needs to add the Firebase Web Push key in EdgeOne settings.');
        return data;
    }

    async function getMessaging() {
        if (!window.firebase || !firebase.messaging || typeof firebase.messaging.isSupported !== 'function') {
            throw new Error('This browser does not support Hero push notifications.');
        }
        if (!(await firebase.messaging.isSupported())) throw new Error('This browser does not support Hero push notifications.');
        if (!messaging) messaging = firebase.messaging();
        if (!foregroundHandlerAttached) {
            messaging.onMessage((payload) => {
                const title = payload.data && payload.data.title || 'Hero update';
                const body = payload.data && payload.data.body || 'There is a new announcement in Hero.';
                if (typeof showToast === 'function') showToast(`${title}: ${body}`, 'info');
            });
            foregroundHandlerAttached = true;
        }
        return messaging;
    }

    async function registration() {
        if (!('serviceWorker' in navigator)) throw new Error('This browser cannot run the Hero push service worker.');
        return navigator.serviceWorker.register('/firebase-messaging-sw.js');
    }

    async function tokenId(token) {
        const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(token));
        return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, '0')).join('');
    }

    async function enable() {
        const user = auth && auth.currentUser;
        if (!user || !window.__heroCanAccessApp) throw new Error('Guest notifications are unavailable while offline.');
        if (!('Notification' in window)) throw new Error('This browser does not support notifications.');
        const config = await getConfig();
        const serviceWorker = await registration();
        const permission = Notification.permission === 'granted' ? 'granted' : await Notification.requestPermission();
        if (permission !== 'granted') throw new Error(permission === 'denied'
            ? 'Notifications are blocked for Hero in your browser settings.'
            : 'Notification permission was not granted.');
        const client = await getMessaging();
        const token = await client.getToken({ vapidKey: config.vapidKey, serviceWorkerRegistration: serviceWorker });
        if (!token) throw new Error('Firebase did not return a notification token. Check the Firebase Web Push setup.');
        await tokenCollection(user.uid).doc(await tokenId(token)).set({
            token,
            enabled: true,
            updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
        }, { merge: true });
        currentUid = user.uid;
        enabled = true;
        status('On for this browser. Hero will notify you when a new announcement is posted.');
        setButton('Turn off notifications');
    }

    async function disable() {
        const user = auth && auth.currentUser;
        if (messaging) {
            const token = await messaging.getToken().catch(() => '');
            if (token && user) await tokenCollection(user.uid).doc(await tokenId(token)).delete().catch(() => {});
            await messaging.deleteToken().catch(() => {});
        }
        enabled = false;
        status('Off. You can turn notifications back on at any time.');
        setButton('Enable notifications');
    }

    window.toggleHeroPushNotifications = async function () {
        const button = document.getElementById(buttonId);
        if (button) { button.disabled = true; button.textContent = enabled ? 'Turning off…' : 'Enabling…'; }
        try {
            if (enabled) await disable(); else await enable();
        } catch (error) {
            status(error.message || 'Could not update notification settings.');
            setButton(enabled ? 'Turn off notifications' : 'Enable notifications');
            if (typeof showToast === 'function') showToast(error.message || 'Could not update notification settings.', 'error');
        }
    };

    window.addEventListener('hero-auth-state', async (event) => {
        const user = event.detail && event.detail.authorized && event.detail.user
            ? event.detail.user : null;
        if (!user) {
            currentUid = ''; enabled = false;
            status('Guest notifications are unavailable while offline.');
            setButton('Enable notifications', true);
            return;
        }
        currentUid = user.uid;
        setButton('Enable notifications', false);
        if (!('Notification' in window)) {
            status('This browser does not support notifications.'); setButton('Not supported', true); return;
        }
        if (Notification.permission === 'denied') {
            status('Notifications are blocked by the browser. Allow them in site settings to enable Hero alerts.');
            setButton('Browser blocked', true); return;
        }
        if (Notification.permission === 'granted') {
            try {
                const config = await getConfig();
                const sw = await registration();
                const client = await getMessaging();
                const token = await client.getToken({ vapidKey: config.vapidKey, serviceWorkerRegistration: sw });
                if (token) {
                    const ref = tokenCollection(user.uid).doc(await tokenId(token));
                    const snapshot = await ref.get();
                    if (snapshot.exists && snapshot.data().enabled === true) {
                        enabled = true;
                        status('On. This browser will be notified when a new announcement is posted.');
                        setButton('Turn off notifications');
                    } else {
                        enabled = false;
                        status('Get a notification when a new announcement is posted.');
                        setButton('Enable notifications');
                    }
                }
            } catch (error) {
                enabled = false;
                status(error.message || 'Push notifications are unavailable.');
                setButton('Enable notifications');
            }
        } else {
            status('Get a notification when a new announcement is posted.');
        }
    });
})();
