/// <reference lib="webworker" />
import { precacheAndRoute, cleanupOutdatedCaches, createHandlerBoundToURL } from 'workbox-precaching';
import { NavigationRoute, registerRoute } from 'workbox-routing';

declare const self: ServiceWorkerGlobalScope & { __WB_MANIFEST: Array<{ url: string; revision: string | null }> };

cleanupOutdatedCaches();
precacheAndRoute(self.__WB_MANIFEST);
registerRoute(new NavigationRoute(createHandlerBoundToURL('/index.html')));

self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (e) => e.waitUntil(self.clients.claim()));

// Push from the optional relay
self.addEventListener('push', (event) => {
  const p = event.data?.json() ?? {};
  event.waitUntil(
    self.registration.showNotification(p.title ?? 'Reminder', {
      body: p.body ?? '',
      tag: p.id,
      icon: '/icon-192.png',
      badge: '/icon-192.png',
      requireInteraction: true,
      data: { key: p.id, title: p.title },
      // @ts-expect-error actions is supported by Chromium
      actions: [
        { action: 'snooze', title: 'Snooze 15 min' },
        { action: 'done', title: 'Done' }
      ]
    })
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const data = event.notification.data ?? {};
  const msg = { type: 'notification-action', action: event.action || 'open', data };
  event.waitUntil(
    (async () => {
      const all = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
      const client = all[0] as WindowClient | undefined;
      if (client) {
        client.postMessage(msg);
        if (!event.action) await client.focus();
        return;
      }
      const q = new URLSearchParams({ act: msg.action, d: JSON.stringify(data) });
      await self.clients.openWindow(`/?${q}`);
    })()
  );
});
