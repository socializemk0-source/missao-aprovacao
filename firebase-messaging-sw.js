/**
 * Firebase Cloud Messaging Service Worker — Missão Aprovação
 * Gerencia notificações push em segundo plano para lembretes de sequência de estudo (Streak)
 */
importScripts('https://www.gstatic.com/firebasejs/10.14.1/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.14.1/firebase-messaging-compat.js');

const firebaseConfig = {
  projectId: "watchful-mote-s3skh",
  appId: "1:524388240708:web:f65bff1df2c8d7ba0c9b11",
  apiKey: "AIzaSyAF4mrDD5Gml2Ty2qYIdqBi88j4BiKmhrw",
  authDomain: "watchful-mote-s3skh.firebaseapp.com",
  storageBucket: "watchful-mote-s3skh.firebasestorage.app",
  messagingSenderId: "524388240708"
};

firebase.initializeApp(firebaseConfig);

let messaging = null;
try {
  messaging = firebase.messaging();
} catch (err) {
  console.warn('[firebase-messaging-sw] Inicialização compat do messaging:', err);
}

// Handler para notificações em segundo plano do Firebase Cloud Messaging
if (messaging) {
  messaging.onBackgroundMessage(function (payload) {
    console.log('[FCM SW] Mensagem recebida em segundo plano:', payload);
    const notificationTitle = payload.notification?.title || payload.data?.title || '🔥 Missão Aprovação — Hora de Estudar!';
    const notificationOptions = {
      body: payload.notification?.body || payload.data?.body || 'Mantenha sua sequência de estudos acesa hoje!',
      icon: payload.notification?.icon || '/mascot.png',
      badge: '/favicon.svg',
      vibrate: [200, 100, 200, 100, 200],
      tag: 'study-streak-reminder',
      renotify: true,
      data: {
        url: payload.data?.actionUrl || payload.fcmOptions?.link || '/jogar',
        streak: payload.data?.streak,
        userId: payload.data?.userId,
        timestamp: Date.now()
      },
      actions: [
        { action: 'study_now', title: '⚡ Treinar Agora' },
        { action: 'view_streak', title: '🔥 Ver Sequência' }
      ]
    };

    return self.registration.showNotification(notificationTitle, notificationOptions);
  });
}

// Fallback universal para evento push web padrão
self.addEventListener('push', function (event) {
  if (!event.data) return;
  let data = {};
  try {
    data = event.data.json();
  } catch (e) {
    data = { notification: { title: '🔥 Missão Aprovação', body: event.data.text() } };
  }

  const title = data.notification?.title || data.title || '🔥 Não quebre sua sequência!';
  const body = data.notification?.body || data.body || 'Resolva questões agora para manter seu streak e somar XP!';
  const options = {
    body: body,
    icon: data.notification?.icon || '/mascot.png',
    badge: '/favicon.svg',
    vibrate: [200, 100, 200],
    tag: 'study-streak-reminder',
    renotify: true,
    data: {
      url: data.data?.actionUrl || data.url || '/jogar',
      streak: data.data?.streak
    },
    actions: [
      { action: 'study_now', title: '⚡ Treinar Agora' },
      { action: 'view_streak', title: '🔥 Ver Sequência' }
    ]
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

// Abertura ou foco da aplicação ao clicar na notificação push
self.addEventListener('notificationclick', function (event) {
  event.notification.close();
  const targetUrl = (event.notification.data && event.notification.data.url) ? event.notification.data.url : '/jogar';

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function (windowClients) {
      for (let client of windowClients) {
        if ('focus' in client) {
          client.focus();
          if ('navigate' in client && targetUrl) {
            client.navigate(targetUrl);
          }
          return;
        }
      }
      if (clients.openWindow) {
        return clients.openWindow(targetUrl);
      }
    })
  );
});
