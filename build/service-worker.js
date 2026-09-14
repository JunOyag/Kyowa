// public/service-worker.js

import { precacheAndRoute } from 'workbox-precaching';
import { registerRoute } from 'workbox-routing';
import { CacheFirst } from 'workbox-strategies';
import { CacheableResponsePlugin } from 'workbox-cacheable-response';
import { ExpirationPlugin } from 'workbox-expiration';

// Précache les fichiers générés par Webpack
precacheAndRoute(self.__WB_MANIFEST || []);

// Cache pour les fichiers statiques (CSS, JS, images)
registerRoute(
  ({ request }) => request.destination === 'style' || 
                   request.destination === 'script' || 
                   request.destination === 'image',
  new CacheFirst({
    cacheName: 'static-resources',
    plugins: [
      new CacheableResponsePlugin({
        statuses: [0, 200], // Cache les réponses valides
      }),
      new ExpirationPlugin({
        maxEntries: 50, // Maximum d'éléments à conserver dans le cache
        maxAgeSeconds: 30 * 24 * 60 * 60, // Expiration après 30 jours
      }),
    ],
  })
);
