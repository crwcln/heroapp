/* Firebase Web Push worker. Keep this public Firebase app config in sync with js/02-firebase-config.js. */
importScripts('https://www.gstatic.com/firebasejs/11.6.1/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/11.6.1/firebase-messaging-compat.js');

firebase.initializeApp({
  apiKey: 'AIzaSyDipGTQS0jPqKBJnFgEZ4tBA3QGC2Xotx8',
  authDomain: 'heroapp-cc053.firebaseapp.com',
  projectId: 'heroapp-cc053',
  storageBucket: 'heroapp-cc053.firebasestorage.app',
  messagingSenderId: '991029808496',
  appId: '1:991029808496:web:18c0b97c8dec11f7db13b5',
  measurementId: 'G-YN3V70ZNE2',
});

const messaging = firebase.messaging();
messaging.onBackgroundMessage(({ data = {} }) => {
  const title = data.title || 'Hero update';
  return self.registration.showNotification(title, {
    body: data.body || 'There is a new announcement in Hero.',
    icon: '/hero-push-icon.svg',
    badge: '/hero-push-icon.svg',
    data: { url: data.url || '/' },
    tag: 'hero-announcement',
  });
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const target = new URL(event.notification.data && event.notification.data.url || '/', self.location.origin).href;
  event.waitUntil((async () => {
    const windows = await clients.matchAll({ type: 'window', includeUncontrolled: true });
    for (const client of windows) {
      if (new URL(client.url).origin === self.location.origin) {
        await client.focus();
        if ('navigate' in client && client.url !== target) await client.navigate(target);
        return;
      }
    }
    await clients.openWindow(target);
  })());
});
