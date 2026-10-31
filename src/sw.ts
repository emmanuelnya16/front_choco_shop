/// <reference lib="webworker" />
/**
 * Service worker de DR Choco (M6 §4.4 à §4.7 et §7.3).
 * Construit par vite-plugin-pwa (injectManifest) : imports relatifs uniquement, pas d'alias « @ ».
 */
import { cleanupOutdatedCaches, matchPrecache, precacheAndRoute } from 'workbox-precaching';
import { registerRoute } from 'workbox-routing';
import { CacheFirst, NetworkFirst, StaleWhileRevalidate } from 'workbox-strategies';
import { ExpirationPlugin } from 'workbox-expiration';
import type { RouteHandlerCallbackOptions, WorkboxPlugin } from 'workbox-core/types';
import { validateEnv } from './lib/env';
import { CACHE_LIMITS, CACHE_NAMES, classifyRequest, isCacheableResponse, type CacheStrategy } from './pwa/cacheRules';
import { BADGE_PUSH_TYPES, buildNotification, parsePushPayload, resolveNotificationUrl } from './pwa/pushPayload';
import { OFFLINE_FALLBACK_HEADER, SW_MESSAGES, type SwReply, type SwToAppMessage } from './pwa/swProtocol';
import { urlBase64ToUint8Array } from './pwa/vapid';

declare const self: ServiceWorkerGlobalScope & {
  __WB_MANIFEST: Array<{ url: string; revision: string | null }>;
};

const env = validateEnv(import.meta.env);
const rulesContext = { appOrigin: self.location.origin, apiBaseUrl: env.apiBaseUrl };

// ---------------------------------------------------------------------------
// Précache de la coquille (révisions générées au build)
// ---------------------------------------------------------------------------
precacheAndRoute(self.__WB_MANIFEST);
cleanupOutdatedCaches();

// ---------------------------------------------------------------------------
// Stratégies d'exécution (§4.5) : règles pures dans src/pwa/cacheRules.ts
// ---------------------------------------------------------------------------
/** N'enregistre que les réponses 200 complètes, sans « no-store », du type de contenu attendu. */
function cacheableOnly(strategy: Exclude<CacheStrategy, 'network-only'>): WorkboxPlugin {
  return {
    cacheWillUpdate: async ({ response }) => (isCacheableResponse(response, strategy) ? response : null),
  };
}

/** NetworkFirst : la copie enregistrée n'est utilisée qu'en cas d'échec du réseau, on le signale à l'app. */
const markOfflineFallback: WorkboxPlugin = {
  cachedResponseWillBeUsed: async ({ cachedResponse }) => {
    if (!cachedResponse) return cachedResponse;
    const headers = new Headers(cachedResponse.headers);
    headers.set(OFFLINE_FALLBACK_HEADER, '1');
    return new Response(await cachedResponse.blob(), {
      status: cachedResponse.status,
      statusText: cachedResponse.statusText,
      headers,
    });
  },
};

const strategies = {
  pages: new NetworkFirst({
    cacheName: CACHE_NAMES.pages,
    networkTimeoutSeconds: CACHE_LIMITS.pages.networkTimeoutSeconds,
    plugins: [cacheableOnly('pages')],
  }),
  catalog: new StaleWhileRevalidate({
    cacheName: CACHE_NAMES.catalog,
    plugins: [cacheableOnly('catalog'), new ExpirationPlugin({ ...CACHE_LIMITS.catalog, purgeOnQuotaError: true })],
  }),
  user: new NetworkFirst({
    cacheName: CACHE_NAMES.user,
    networkTimeoutSeconds: CACHE_LIMITS.user.networkTimeoutSeconds,
    plugins: [
      cacheableOnly('user'),
      markOfflineFallback,
      new ExpirationPlugin({
        maxEntries: CACHE_LIMITS.user.maxEntries,
        maxAgeSeconds: CACHE_LIMITS.user.maxAgeSeconds,
        purgeOnQuotaError: true,
      }),
    ],
  }),
  images: new CacheFirst({
    cacheName: CACHE_NAMES.images,
    plugins: [cacheableOnly('images'), new ExpirationPlugin({ ...CACHE_LIMITS.images, purgeOnQuotaError: true })],
  }),
  fonts: new CacheFirst({
    cacheName: CACHE_NAMES.fonts,
    plugins: [cacheableOnly('fonts'), new ExpirationPlugin({ ...CACHE_LIMITS.fonts, purgeOnQuotaError: true })],
  }),
};

function strategyFor(request: Request): CacheStrategy {
  return classifyRequest(
    { url: new URL(request.url), method: request.method, mode: request.mode, destination: request.destination },
    rulesContext,
  );
}

// Pages : réseau d'abord (3 s), sinon la page enregistrée, sinon la coquille précachée
registerRoute(
  ({ request }) => strategyFor(request) === 'pages',
  async (options: RouteHandlerCallbackOptions) => {
    try {
      const response = await strategies.pages.handle(options);
      if (response) return response;
    } catch {
      // Hors connexion et page jamais enregistrée : on sert la coquille
    }
    return (await matchPrecache('index.html')) ?? Response.error();
  },
);
for (const name of ['catalog', 'user', 'images', 'fonts'] as const) {
  registerRoute(({ request }) => strategyFor(request) === name, strategies[name]);
}
// Tout le reste (requêtes non GET, /auth, /push, /_mock, preuves, photos de colis, /admin…)
// n'a aucune route : il part directement au réseau et n'est jamais enregistré.

// ---------------------------------------------------------------------------
// Messages de l'app (§4.6)
// ---------------------------------------------------------------------------
function reply(event: ExtendableMessageEvent, message: SwReply) {
  event.ports[0]?.postMessage(message);
}

self.addEventListener('message', (event: ExtendableMessageEvent) => {
  const type = (event.data as { type?: unknown } | null)?.type;
  if (type === SW_MESSAGES.skipWaiting) {
    event.waitUntil(self.skipWaiting());
    reply(event, { ok: true });
  } else if (type === SW_MESSAGES.clearUserData) {
    // Déconnexion : plus aucune donnée personnelle lisible hors connexion
    event.waitUntil(
      caches
        .delete(CACHE_NAMES.user)
        .then(() => reply(event, { ok: true }))
        .catch((error: unknown) => reply(event, { ok: false, error: String(error) })),
    );
  } else if (type === SW_MESSAGES.getVersion) {
    reply(event, { ok: true, version: env.appVersion });
  }
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

// ---------------------------------------------------------------------------
// Notifications push (§7.3)
// ---------------------------------------------------------------------------
async function postToWindows(message: SwToAppMessage) {
  const windows = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
  for (const client of windows) client.postMessage(message);
  return windows;
}

function readPushData(event: PushEvent): unknown {
  if (!event.data) return null;
  try {
    return event.data.json();
  } catch {
    return event.data.text();
  }
}

self.addEventListener('push', (event: PushEvent) => {
  event.waitUntil(
    (async () => {
      const payload = parsePushPayload(readPushData(event));
      if (!payload) return; // Contenu invalide : ignoré proprement

      const windows = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
      const appVisible = windows.some((client) => client.visibilityState === 'visible');
      if (!appVisible) {
        const { title, options } = buildNotification(payload);
        await self.registration.showNotification(title, options as NotificationOptions);
        if (BADGE_PUSH_TYPES.includes(payload.type) && 'setAppBadge' in self.navigator) {
          await self.navigator.setAppBadge().catch(() => undefined);
        }
      }
      // L'app ouverte (même en arrière-plan) rafraîchit ses données tout de suite
      await postToWindows({ type: SW_MESSAGES.pushReceived, payload, shownAsNotification: !appVisible });
    })(),
  );
});

self.addEventListener('notificationclick', (event: NotificationEvent) => {
  event.notification.close();
  const url = resolveNotificationUrl(event.notification.data, event.action);
  event.waitUntil(
    (async () => {
      const windows = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
      const client = windows.find((w) => new URL(w.url).origin === self.location.origin);
      if (client) {
        await client.focus();
        client.postMessage({ type: SW_MESSAGES.navigate, url } satisfies SwToAppMessage);
        return;
      }
      await self.clients.openWindow(url);
    })(),
  );
});

// Abonnement renouvelé par le service de push : on se réabonne et on prévient le serveur.
// HYPOTHÈSE: le back-end identifie l'appareil par l'ancien point de terminaison et accepte cet appel
// avec le cookie de session (le service worker n'a pas le jeton d'accès).
self.addEventListener('pushsubscriptionchange', (event: Event) => {
  const change = event as ExtendableEvent & { oldSubscription?: PushSubscription | null };
  change.waitUntil(
    (async () => {
      const subscription = await self.registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(env.vapidPublicKey),
      });
      await fetch(`${env.apiBaseUrl}/push/subscribe`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({
          subscription: subscription.toJSON(),
          oldEndpoint: change.oldSubscription?.endpoint ?? null,
          platform: 'web',
          userAgent: self.navigator.userAgent,
        }),
      }).catch(() => undefined);
    })(),
  );
});
