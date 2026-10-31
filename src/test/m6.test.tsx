import { afterEach, describe, expect, it, vi } from 'vitest';
import { api, ApiError, refreshSessionSilently } from '@/lib/api/client';
import { env } from '@/lib/env';
import {
  apiRelativePath,
  classifyRequest,
  isAdminUrl,
  isCacheableResponse,
  isUpdateBlockedPath,
  type RequestDescriptor,
} from '@/pwa/cacheRules';
import {
  BADGE_PUSH_TYPES,
  buildNotification,
  parsePushPayload,
  PUSH_TYPES,
  resolveNotificationUrl,
  samplePushPayload,
} from '@/pwa/pushPayload';
import { useNetworkStore } from '@/pwa/networkStore';
import { OFFLINE_FALLBACK_HEADER } from '@/pwa/swProtocol';
import { urlBase64ToUint8Array } from '@/pwa/vapid';
import { useAuthStore } from '@/stores/authStore';
import type { User } from '@/types/domain';

const JUNIOR: User = {
  id: 'usr-junior-01',
  phone: '+237690000001',
  firstName: 'Junior',
  createdAt: '2026-09-15T10:00:00.000Z',
};

/** Profil persisté, sans jeton d'accès : situation d'un lancement à froid de l'app. */
function restoreProfileWithoutToken() {
  useAuthStore.setState({ user: JUNIOR, accessToken: null, status: 'unknown' });
}

describe('M6 · 1. Session hors connexion', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    useAuthStore.getState().clearSession();
  });

  it('garde le client connecté quand le rafraîchissement échoue faute de réseau', async () => {
    restoreProfileWithoutToken();
    vi.spyOn(globalThis, 'fetch').mockRejectedValueOnce(new TypeError('Failed to fetch'));

    await expect(refreshSessionSilently()).resolves.toBe('unreachable');
    const state = useAuthStore.getState();
    expect(state.user?.id).toBe('usr-junior-01');
    expect(state.status).toBe('authenticated');
  });

  it('garde le client connecté sur une erreur serveur momentanée (503)', async () => {
    restoreProfileWithoutToken();
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(new Response('', { status: 503 }));

    await expect(refreshSessionSilently()).resolves.toBe('unreachable');
    expect(useAuthStore.getState().user?.id).toBe('usr-junior-01');
  });

  it('déconnecte le client quand le serveur refuse la session (401)', async () => {
    restoreProfileWithoutToken();
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response(JSON.stringify({ code: 'INVALID_REFRESH_TOKEN' }), { status: 401 }),
    );

    await expect(refreshSessionSilently()).resolves.toBe('rejected');
    const state = useAuthStore.getState();
    expect(state.user).toBeNull();
    expect(state.status).toBe('guest');
  });

  it('ne fait rien sans profil ou avec un jeton déjà valide', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch');
    await expect(refreshSessionSilently()).resolves.toBe('skipped');
    useAuthStore.getState().setSession('jwt-valide', JUNIOR);
    await expect(refreshSessionSilently()).resolves.toBe('skipped');
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("une 401 suivie d'un rafraîchissement sans réseau renvoie une erreur réseau, sans déconnecter", async () => {
    useAuthStore.getState().setSession('jwt-expire', JUNIOR);
    vi.spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(new Response(JSON.stringify({ message: 'Expired JWT' }), { status: 401 }))
      .mockRejectedValueOnce(new TypeError('Failed to fetch'));

    await expect(api.get('/me')).rejects.toMatchObject({
      name: 'ApiError',
      status: 0,
      code: 'NETWORK_ERROR',
    } satisfies Partial<ApiError>);
    expect(useAuthStore.getState().user?.id).toBe('usr-junior-01');
  });

  it("une 401 suivie d'un refus du rafraîchissement renvoie SESSION_EXPIRED et déconnecte", async () => {
    useAuthStore.getState().setSession('jwt-expire', JUNIOR);
    vi.spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(new Response(JSON.stringify({ message: 'Expired JWT' }), { status: 401 }))
      .mockResolvedValueOnce(new Response('', { status: 401 }));

    await expect(api.get('/me')).rejects.toMatchObject({ status: 401, code: 'SESSION_EXPIRED' });
    expect(useAuthStore.getState().user).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// 2. Règles de cache du service worker (§4.5, §9.4)
// ---------------------------------------------------------------------------
describe('M6 · 2. Règles de cache', () => {
  const ctx = { appOrigin: 'https://drchoco.cm', apiBaseUrl: 'https://api.drchoco.cm/api' };
  const get = (url: string, extra: Partial<RequestDescriptor> = {}) =>
    classifyRequest({ url: new URL(url), method: 'GET', ...extra }, ctx);

  it('catalogue en StaleWhileRevalidate', () => {
    for (const path of [
      '/categories',
      '/products',
      '/products?category=babouches&page=2',
      '/products/hoodie-barbele-noir',
      '/looks',
      '/looks/look-01',
      '/search/suggest?q=hoo',
      '/settings/public',
      '/delivery/cities',
      '/delivery/agencies?city=Yaound%C3%A9',
    ]) {
      expect(get(`https://api.drchoco.cm/api${path}`), path).toBe('catalog');
    }
  });

  it('données du client en NetworkFirst (cache vidé à la déconnexion)', () => {
    for (const path of [
      '/me',
      '/me/addresses',
      '/reservations',
      '/reservations?scope=active&page=1',
      '/reservations/summary',
      '/reservations/RES-000124',
      '/favorites',
    ]) {
      expect(get(`https://api.drchoco.cm/api${path}`), path).toBe('user');
    }
  });

  it('images publiques et polices non précachées en CacheFirst', () => {
    expect(get('https://drchoco.cm/images/products/hoodie-1.webp')).toBe('images');
    expect(get('https://drchoco.cm/mock/product-tee.svg')).toBe('images');
    expect(
      get('https://res.cloudinary.com/drchoco/image/upload/f_auto,q_auto,w_600/products/hoodie.jpg'),
    ).toBe('images');
    expect(get('https://drchoco.cm/assets/archivo-latin-ext-wdth-normal-7khWdh9v.woff2')).toBe('fonts');
  });

  it('pages en NetworkFirst, sauf /_dev', () => {
    expect(get('https://drchoco.cm/produit/hoodie', { mode: 'navigate' })).toBe('pages');
    expect(get('https://drchoco.cm/', { mode: 'navigate', destination: 'document' })).toBe('pages');
    expect(get('https://drchoco.cm/_dev', { mode: 'navigate' })).toBe('network-only');
  });

  it('jamais mis en cache : requêtes non GET, /auth, /push, /cart/validate, /_mock', () => {
    const post = (url: string) => classifyRequest({ url: new URL(url), method: 'POST' }, ctx);
    expect(post('https://api.drchoco.cm/api/reservations')).toBe('network-only');
    expect(post('https://api.drchoco.cm/api/products')).toBe('network-only');
    for (const path of [
      '/auth/refresh',
      '/auth/otp/request',
      '/push/subscribe',
      '/cart/validate',
      '/_mock/reservations/RES-000101/validate',
    ]) {
      expect(get(`https://api.drchoco.cm/api${path}`), path).toBe('network-only');
    }
  });

  it('jamais mis en cache : preuves de paiement et photos de colis (URL privées ou signées)', () => {
    for (const url of [
      'https://res.cloudinary.com/drchoco/image/private/s--Ab12Cd34--/proofs/RES-000124.jpg',
      'https://res.cloudinary.com/drchoco/image/authenticated/s--Ab12Cd34--/packages/RES-000124-1.jpg',
      'https://res.cloudinary.com/drchoco/image/upload/s--Ab12Cd34--/v1/packages/RES-000124-1.jpg',
      'https://cdn.drchoco.cm/packages/RES-000124-1.jpg?expires=1767225600&signature=abc',
      'https://drchoco.cm/mock/colis-1.svg',
      'https://drchoco.cm/mock/preuve-1.svg',
      'https://api.drchoco.cm/api/reservations/RES-000124/proof',
    ]) {
      expect(get(url), url).toBe('network-only');
    }
  });

  it("jamais mis en cache : espace d'administration (/admin et /api/admin)", () => {
    expect(get('https://drchoco.cm/admin', { mode: 'navigate' })).toBe('network-only');
    expect(get('https://drchoco.cm/admin/reservations/RES-000124', { mode: 'navigate' })).toBe('network-only');
    expect(get('https://api.drchoco.cm/api/admin/reservations')).toBe('network-only');
    expect(get('https://drchoco.cm/api/admin/stats')).toBe('network-only');
    expect(isAdminUrl(new URL('https://drchoco.cm/administrateur-faq'), ctx)).toBe(false);
  });

  it('API sur la même origine et URL de base relative', () => {
    const sameOrigin = { appOrigin: 'https://drchoco.cm', apiBaseUrl: '/api' };
    expect(classifyRequest({ url: new URL('https://drchoco.cm/api/products'), method: 'GET' }, sameOrigin)).toBe(
      'catalog',
    );
    expect(
      classifyRequest({ url: new URL('https://drchoco.cm/api/auth/refresh'), method: 'GET' }, sameOrigin),
    ).toBe('network-only');
    expect(apiRelativePath(new URL('https://drchoco.cm/apiculture'), sameOrigin)).toBeNull();
  });

  it("n'enregistre que les réponses 200 complètes, sans no-store", () => {
    const res = (status: number, headers: Record<string, string> = {}, type = 'basic') => ({
      status,
      type,
      headers: new Headers(headers),
    });
    expect(isCacheableResponse(res(200))).toBe(true);
    expect(isCacheableResponse(res(200, { 'Cache-Control': 'private, no-store' }))).toBe(false);
    expect(isCacheableResponse(res(200, { 'Cache-Control': 'no-cache' }))).toBe(true);
    expect(isCacheableResponse(res(0, {}, 'opaque'))).toBe(false);
    expect(isCacheableResponse(res(404))).toBe(false);
    expect(isCacheableResponse(res(206))).toBe(false);
  });

  it("chaque cache n'accepte que son type de contenu (index.html renvoyé pour une image manquante)", () => {
    const res = (contentType: string) => ({
      status: 200,
      type: 'basic',
      headers: new Headers({ 'Content-Type': contentType }),
    });
    expect(isCacheableResponse(res('text/html; charset=utf-8'), 'images')).toBe(false);
    expect(isCacheableResponse(res('image/webp'), 'images')).toBe(true);
    expect(isCacheableResponse(res('image/svg+xml'), 'images')).toBe(true);
    expect(isCacheableResponse(res('text/html'), 'catalog')).toBe(false);
    expect(isCacheableResponse(res('application/json'), 'catalog')).toBe(true);
    expect(isCacheableResponse(res('application/json; charset=utf-8'), 'user')).toBe(true);
    expect(isCacheableResponse(res('text/html; charset=utf-8'), 'pages')).toBe(true);
    expect(isCacheableResponse(res('application/json'), 'pages')).toBe(false);
    expect(isCacheableResponse(res('font/woff2'), 'fonts')).toBe(true);
    expect(isCacheableResponse(res('text/html'), 'fonts')).toBe(false);
  });

  it('mise à jour jamais proposée sur les écrans de réservation, paiement et preuve', () => {
    expect(isUpdateBlockedPath('/reservation')).toBe(true);
    expect(isUpdateBlockedPath('/reservation/RES-000124/paiement')).toBe(true);
    expect(isUpdateBlockedPath('/reservation/RES-000124/preuve/')).toBe(true);
    expect(isUpdateBlockedPath('/reservation/RES-000124/merci')).toBe(false);
    expect(isUpdateBlockedPath('/reservations/RES-000124')).toBe(false);
    expect(isUpdateBlockedPath('/')).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// 3. Clé VAPID (§7.1, §9.4)
// ---------------------------------------------------------------------------
describe('M6 · 3. Conversion de la clé VAPID', () => {
  it('convertit une clé publique base64url de 65 octets (point P-256 non compressé)', () => {
    const bytes = urlBase64ToUint8Array(env.vapidPublicKey);
    expect(bytes).toBeInstanceOf(Uint8Array);
    expect(bytes.length).toBe(65);
    expect(bytes[0]).toBe(0x04);
  });

  it('gère le remplissage et les caractères - et _', () => {
    expect(Array.from(urlBase64ToUint8Array('-_8'))).toEqual([0xfb, 0xff]);
    expect(Array.from(urlBase64ToUint8Array('AQID'))).toEqual([1, 2, 3]);
    expect(Array.from(urlBase64ToUint8Array('AQ=='))).toEqual([1]);
  });

  it('refuse une clé invalide', () => {
    expect(() => urlBase64ToUint8Array('pas une clé !')).toThrow();
  });
});

// ---------------------------------------------------------------------------
// 4. Contenu push → notification (§7.2, §7.3, §9.4)
// ---------------------------------------------------------------------------
describe('M6 · 4. Notifications push', () => {
  const PHOTO = 'https://res.cloudinary.com/x/image/private/s--Ab12Cd34--/colis.jpg';

  it.each(PUSH_TYPES.filter((t) => t !== 'new_collection'))(
    '%s : titre, texte, tag = référence, URL et données',
    (type) => {
      const payload = samplePushPayload(type, 'RES-000124', PHOTO);
      const { title, options } = buildNotification(payload);
      expect(title).toBe(payload.title);
      expect(options.body).toBe(payload.body);
      expect(options.tag).toBe('RES-000124');
      expect(options.renotify).toBe(true);
      expect(options.icon).toBe('/pwa-192x192.png');
      expect(options.badge).toBe('/badge-96.png');
      expect(options.vibrate).toEqual([80, 40, 80]);
      expect(options.lang).toBe('fr');
      expect(options.data).toMatchObject({ url: payload.url, ref: 'RES-000124', type });
    },
  );

  it('colis prêt : image = photo du colis, action « Voir mon colis » vers la photo', () => {
    const { options } = buildNotification(samplePushPayload('package_ready', 'RES-000124', PHOTO));
    expect(options.image).toBe(PHOTO);
    expect(options.actions).toEqual([{ action: 'open', title: 'Voir mon colis' }]);
    expect(options.data.url).toBe('/reservations/RES-000124#colis');
  });

  it("l'image n'est montrée que pour le colis prêt", () => {
    const payload = { ...samplePushPayload('payment_validated', 'RES-000124'), image: PHOTO };
    expect(buildNotification(payload).options.image).toBeUndefined();
  });

  it("les boutons d'action ouvrent leur propre page", () => {
    const rejected = buildNotification(samplePushPayload('payment_rejected', 'RES-000124'));
    expect(rejected.options.actions).toEqual([{ action: 'proof', title: 'Renvoyer ma preuve' }]);
    expect(resolveNotificationUrl(rejected.options.data, 'proof')).toBe('/reservation/RES-000124/preuve');
    expect(resolveNotificationUrl(rejected.options.data)).toBe('/reservations/RES-000124');

    const expiring = buildNotification(samplePushPayload('expiring_soon', 'RES-000124'));
    expect(expiring.options.actions).toEqual([{ action: 'pay', title: 'Payer' }]);
    expect(resolveNotificationUrl(expiring.options.data, 'pay')).toBe('/reservation/RES-000124/paiement');

    expect(buildNotification(samplePushPayload('delivered', 'RES-000124')).options.actions).toEqual([]);
  });

  it('un tag explicite passe avant la référence', () => {
    const payload = { ...samplePushPayload('in_delivery', 'RES-000124'), tag: 'suivi-RES-000124' };
    expect(buildNotification(payload).options.tag).toBe('suivi-RES-000124');
  });

  it('ignore proprement un contenu invalide', () => {
    expect(parsePushPayload(null)).toBeNull();
    expect(parsePushPayload('pas du JSON')).toBeNull();
    expect(parsePushPayload({ type: 'inconnu', title: 'x', body: 'y', url: '/' })).toBeNull();
    expect(parsePushPayload({ type: 'delivered', title: '', body: 'y', url: '/' })).toBeNull();
    expect(parsePushPayload({ type: 'delivered', title: 'x', body: 'y' })).toBeNull();
    // Jamais d'ouverture d'un site extérieur depuis une notification
    expect(parsePushPayload({ type: 'delivered', title: 'x', body: 'y', url: 'https://pirate.example' })).toBeNull();
    expect(parsePushPayload({ type: 'delivered', title: 'x', body: 'y', url: '//pirate.example' })).toBeNull();
    expect(resolveNotificationUrl({ url: 'https://pirate.example' })).toBe('/');
  });

  it('lit un contenu JSON texte et normalise la référence', () => {
    const parsed = parsePushPayload(
      JSON.stringify({ type: 'delivered', title: 'Livré !', body: 'Merci.', url: '/reservations/res-000124', ref: 'res-000124' }),
    );
    expect(parsed).toMatchObject({ type: 'delivered', ref: 'RES-000124' });
  });

  it("pastille de l'icône : action demandée ou nouveauté", () => {
    expect([...BADGE_PUSH_TYPES].sort()).toEqual(['expiring_soon', 'package_ready', 'payment_rejected']);
  });
});

// ---------------------------------------------------------------------------
// 5. Copie servie par le service worker faute de réseau (§6.1)
// ---------------------------------------------------------------------------
describe('M6 · 5. Téléphone « en ligne » sans vraie connexion', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    useNetworkStore.setState({ browserOnline: true, consecutiveFailures: 0, online: true, offlineSince: null });
  });

  it('une copie enregistrée renvoie les données mais compte comme un échec : 2 → hors connexion', async () => {
    useNetworkStore.setState({ browserOnline: true, consecutiveFailures: 0, online: true, offlineSince: null });
    const cached = () =>
      new Response(JSON.stringify({ needsAction: 1 }), {
        status: 200,
        headers: { 'Content-Type': 'application/json', [OFFLINE_FALLBACK_HEADER]: '1' },
      });
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(cached()).mockResolvedValueOnce(cached());

    await expect(api.get('/reservations/summary')).resolves.toEqual({ needsAction: 1 });
    expect(useNetworkStore.getState().online).toBe(true);
    await expect(api.get('/reservations/summary')).resolves.toEqual({ needsAction: 1 });
    expect(useNetworkStore.getState().online).toBe(false);
  });

  it('une vraie réponse du serveur remet en ligne', async () => {
    useNetworkStore.setState({ browserOnline: true, consecutiveFailures: 2, online: false, offlineSince: 1 });
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response(JSON.stringify({ needsAction: 0 }), { status: 200, headers: { 'Content-Type': 'application/json' } }),
    );
    await api.get('/reservations/summary');
    expect(useNetworkStore.getState().online).toBe(true);
  });
});
