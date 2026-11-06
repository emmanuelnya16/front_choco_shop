import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, fireEvent, render, renderHook, screen, waitFor, within } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import type { ReactNode } from 'react';
import { RouterProvider } from 'react-router';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi, type Mock } from 'vitest';
import { AppProviders } from '@/app/providers';
import { createTestRouter } from '@/app/router';
import { useAppBadge } from '@/features/notifications/appBadge';
import {
  computePushStatus,
  disableNotifications,
  enableNotifications,
  isNotificationSupported,
  refreshPushStatus,
  subscribe,
  syncPushSubscription,
} from '@/features/notifications/pushService';
import { toNotificationsDisplayState } from '@/features/profile/notifications';
import { useReservation } from '@/features/reservation/api/useReservationQueries';
import { useReservationsSummary } from '@/features/tracking/api/useTrackingQueries';
import { useSeenStore } from '@/features/tracking/seenStore';
import { createAppQueryClient } from '@/lib/api/queryClient';
import { qk } from '@/lib/api/queryKeys';
import { env } from '@/lib/env';
import { safeStorage } from '@/lib/utils/storage';
import { handlers, resetMockM3State } from '@/mocks/handlers';
import { samplePushPayload } from '@/pwa/pushPayload';
import { PUSH_POLL_INTERVAL_MS, usePollIntervalMs, usePushStore } from '@/pwa/pushStore';
import { handleServiceWorkerMessage, type SwMessageContext } from '@/pwa/swMessages';
import { SW_MESSAGES } from '@/pwa/swProtocol';
import { useAuthStore } from '@/stores/authStore';
import { useToastStore } from '@/stores/toastStore';

// ---------------------------------------------------------------------------
// Serveur MSW et requêtes push observées
// ---------------------------------------------------------------------------
const server = setupServer(...handlers);
let subscribeBodies: Array<Record<string, unknown>> = [];
let unsubscribeBodies: Array<Record<string, unknown>> = [];
let callOrder: string[] = [];

function observePushRequests() {
  server.use(
    http.post(`${env.apiBaseUrl}/push/subscribe`, async ({ request }) => {
      subscribeBodies.push((await request.json()) as Record<string, unknown>);
      return HttpResponse.json({ ok: true, devices: 1 }, { status: 201 });
    }),
    http.post(`${env.apiBaseUrl}/push/unsubscribe`, async ({ request }) => {
      callOrder.push('POST /push/unsubscribe');
      unsubscribeBodies.push((await request.json()) as Record<string, unknown>);
      return new HttpResponse(null, { status: 204 });
    }),
  );
}

beforeAll(() => {
  server.listen();
});
afterAll(() => {
  server.close();
});

// ---------------------------------------------------------------------------
// Simulation locale des API du navigateur (absentes de jsdom), restaurée après chaque test
// ---------------------------------------------------------------------------
const APP_ORIGIN = 'http://localhost:3000';
const IPHONE_UA =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Mobile/15E148 Safari/604.1';
let endpointCounter = 0;

class FakeSubscription {
  readonly endpoint: string;
  readonly options = { applicationServerKey: null, userVisibleOnly: true };
  readonly unsubscribe: Mock<() => Promise<boolean>>;

  constructor(endpoint: string, onUnsubscribe: () => void) {
    this.endpoint = endpoint;
    this.unsubscribe = vi.fn(async () => {
      callOrder.push('subscription.unsubscribe');
      onUnsubscribe();
      return true;
    });
  }

  toJSON() {
    return { endpoint: this.endpoint, expirationTime: null, keys: { p256dh: 'cle-p256dh', auth: 'cle-auth' } };
  }
}

interface FakePushOptions {
  permission?: NotificationPermission;
  /** Réponse de la fenêtre de permission. */
  answer?: NotificationPermission;
  subscribeError?: Error;
  /** Abonnement déjà présent dans le navigateur. */
  existingEndpoint?: string;
  /** Service worker de l'app enregistré (sinon : celui de MSW). */
  appWorker?: boolean;
}

function installFakePush(options: FakePushOptions = {}) {
  const state: { permission: NotificationPermission; subscription: FakeSubscription | null } = {
    permission: options.permission ?? 'default',
    subscription: null,
  };
  const makeSubscription = (endpoint: string) =>
    new FakeSubscription(endpoint, () => {
      state.subscription = null;
    });
  if (options.existingEndpoint) state.subscription = makeSubscription(options.existingEndpoint);

  const NotificationStub = {
    get permission() {
      return state.permission;
    },
    requestPermission: vi.fn(async () => {
      state.permission = options.answer ?? 'granted';
      return state.permission;
    }),
  };
  const pushManager = {
    getSubscription: vi.fn(async () => state.subscription),
    subscribe: vi.fn(async () => {
      if (options.subscribeError) throw options.subscribeError;
      endpointCounter += 1;
      state.subscription = makeSubscription(`https://fcm.googleapis.com/fcm/send/appareil-${endpointCounter}`);
      return state.subscription;
    }),
  };
  const script = options.appWorker === false ? `${APP_ORIGIN}/mockServiceWorker.js` : `${APP_ORIGIN}/sw.js`;
  // Messages de l'app au service worker (CLEAR_USER_DATA, GET_VERSION) : réponse sur le port fourni
  const workerMessages: unknown[] = [];
  const postMessage = vi.fn((message: unknown, transfer?: Transferable[]) => {
    workerMessages.push(message);
    (transfer?.[0] as MessagePort | undefined)?.postMessage({ ok: true, version: '0.6.0' });
  });
  const registration = {
    scope: `${APP_ORIGIN}/`,
    active: { scriptURL: script, state: 'activated', postMessage },
    waiting: null,
    installing: null,
    pushManager,
    showNotification: vi.fn(async () => undefined),
  };
  const listeners = new Set<(event: MessageEvent) => void>();
  const container = {
    controller: null,
    ready: Promise.resolve(registration),
    getRegistration: vi.fn(async () => registration),
    addEventListener: (type: string, listener: (event: MessageEvent) => void) => {
      if (type === 'message') listeners.add(listener);
    },
    removeEventListener: (type: string, listener: (event: MessageEvent) => void) => {
      if (type === 'message') listeners.delete(listener);
    },
    startMessages: vi.fn(),
  };

  vi.stubGlobal('Notification', NotificationStub);
  vi.stubGlobal('PushManager', function PushManager() {});
  Object.defineProperty(navigator, 'serviceWorker', { configurable: true, value: container });
  usePushStore.setState({ workerEnabled: true });

  return {
    state,
    NotificationStub,
    pushManager,
    registration,
    workerMessages,
    listenerCount: () => listeners.size,
    emit: (data: unknown) => {
      for (const listener of listeners) listener(new MessageEvent('message', { data }));
    },
  };
}

function installFakeBadge() {
  const setAppBadge = vi.fn(() => Promise.resolve());
  const clearAppBadge = vi.fn(() => Promise.resolve());
  Object.defineProperty(navigator, 'setAppBadge', { configurable: true, value: setAppBadge });
  Object.defineProperty(navigator, 'clearAppBadge', { configurable: true, value: clearAppBadge });
  return { setAppBadge, clearAppBadge };
}

function storeEndpoint(endpoint: string) {
  safeStorage.setItem('drc_push_endpoint', endpoint);
}

const JUNIOR = {
  id: 'usr-junior-01',
  phone: '+237690000001',
  firstName: 'Junior',
  lastName: 'Mbarga',
  city: 'Douala',
  createdAt: '2026-09-15T10:00:00.000Z',
};

function loginAsJunior() {
  useAuthStore.getState().setSession('mock-token-m6', JUNIOR);
}

function renderRoute(path: string) {
  const router = createTestRouter([path]);
  render(
    <AppProviders client={createAppQueryClient()}>
      <RouterProvider router={router} />
    </AppProviders>,
  );
  return router;
}

function wrapperFor(client: QueryClient) {
  return function Wrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
  };
}

beforeEach(() => {
  resetMockM3State();
  subscribeBodies = [];
  unsubscribeBodies = [];
  callOrder = [];
  observePushRequests();
});

afterEach(() => {
  server.resetHandlers();
  vi.unstubAllGlobals();
  for (const key of ['serviceWorker', 'setAppBadge', 'clearAppBadge', 'userAgent', 'standalone']) {
    delete (navigator as unknown as Record<string, unknown>)[key];
  }
  for (const key of ['drc_push_endpoint', 'drc_push_opt_out', 'drc_push_prompt_dismissed_until']) {
    safeStorage.removeItem(key);
  }
  usePushStore.setState({ workerEnabled: false, status: 'unsupported', endpoint: null });
  useToastStore.getState().clear();
  useAuthStore.getState().clearSession();
});

// ---------------------------------------------------------------------------
// 1. États
// ---------------------------------------------------------------------------
describe('M6 · Notifications · 1. États', () => {
  it('le support exige Notification, service worker ET PushManager', () => {
    expect(isNotificationSupported()).toBe(false);
    vi.stubGlobal('Notification', { permission: 'default' });
    expect(isNotificationSupported()).toBe(false);
    installFakePush();
    expect(isNotificationSupported()).toBe(true);
  });

  it('fait correspondre permission et abonnement aux états du profil', async () => {
    // jsdom : aucune API
    expect(computePushStatus(false)).toBe('unsupported');
    expect(toNotificationsDisplayState('unsupported')).toBe('unsupported');

    const fake = installFakePush({ permission: 'default' });
    expect(await refreshPushStatus()).toBe('default');
    expect(toNotificationsDisplayState('default')).toBe('disabled');

    fake.state.permission = 'denied';
    expect(await refreshPushStatus()).toBe('denied');
    expect(toNotificationsDisplayState('denied')).toBe('blocked');

    // Permission accordée sans abonnement : jamais « Activées »
    fake.state.permission = 'granted';
    expect(await refreshPushStatus()).toBe('granted');
    expect(toNotificationsDisplayState('granted')).toBe('disabled');

    // Abonnement présent mais inconnu du serveur : toujours pas actif
    fake.state.subscription = new FakeSubscription('https://fcm.googleapis.com/fcm/send/x', () => undefined);
    expect(await refreshPushStatus()).toBe('granted');

    storeEndpoint('https://fcm.googleapis.com/fcm/send/x');
    expect(await refreshPushStatus()).toBe('subscribed');
    expect(usePushStore.getState().endpoint).toBe('https://fcm.googleapis.com/fcm/send/x');
    expect(toNotificationsDisplayState('subscribed')).toBe('enabled');
  });

  it('mode mocks du navigateur (pas de service worker de l’app) : non disponibles, sans abonnement', async () => {
    const fake = installFakePush({ permission: 'granted' });
    usePushStore.setState({ workerEnabled: false });
    expect(await refreshPushStatus()).toBe('unsupported');
    expect(await enableNotifications()).toBe('unsupported');
    await syncPushSubscription('login');
    expect(fake.pushManager.subscribe).not.toHaveBeenCalled();
    expect(subscribeBodies).toHaveLength(0);
  });

  it('jamais d’abonnement sur le service worker de MSW', async () => {
    const fake = installFakePush({ permission: 'granted', appWorker: false });
    await expect(subscribe()).resolves.toEqual({ ok: false, reason: 'no-app-worker' });
    expect(fake.pushManager.subscribe).not.toHaveBeenCalled();
  });

  it('iPhone sans app installée : « Application à installer » ; installée sans push : non disponibles', () => {
    Object.defineProperty(navigator, 'userAgent', { configurable: true, get: () => IPHONE_UA });
    expect(computePushStatus(false)).toBe('needs-install');
    expect(toNotificationsDisplayState('needs-install')).toBe('ios-install');

    Object.defineProperty(navigator, 'standalone', { configurable: true, value: true });
    expect(computePushStatus(false)).toBe('unsupported');
  });
});

// ---------------------------------------------------------------------------
// 2. Abonnement et désabonnement
// ---------------------------------------------------------------------------
describe('M6 · Notifications · 2. Abonnement', () => {
  it('« Activer » : permission puis UN SEUL POST /push/subscribe avec subscription, platform et userAgent', async () => {
    loginAsJunior();
    const fake = installFakePush();

    await expect(enableNotifications()).resolves.toBe('subscribed');

    expect(fake.NotificationStub.requestPermission).toHaveBeenCalledTimes(1);
    expect(fake.pushManager.subscribe).toHaveBeenCalledTimes(1);
    expect(fake.pushManager.subscribe).toHaveBeenCalledWith(
      expect.objectContaining({ userVisibleOnly: true, applicationServerKey: expect.any(Uint8Array) }),
    );
    expect(subscribeBodies).toHaveLength(1);
    const body = subscribeBodies[0]!;
    expect(body.subscription).toMatchObject({
      endpoint: expect.stringMatching(/^https:\/\/fcm\.googleapis\.com\//),
      keys: { p256dh: 'cle-p256dh', auth: 'cle-auth' },
    });
    expect(body.platform).toBe('web');
    expect(body.userAgent).toBe(navigator.userAgent);
    expect(body).not.toHaveProperty('oldEndpoint');
    expect(usePushStore.getState().status).toBe('subscribed');
    expect(safeStorage.getItem('drc_push_endpoint')).toBe(usePushStore.getState().endpoint);
  });

  it('deux appels simultanés ne créent qu’un abonnement et un seul POST', async () => {
    const fake = installFakePush({ permission: 'granted' });
    const [a, b] = await Promise.all([subscribe(), subscribe()]);
    expect(a).toEqual(b);
    expect(fake.pushManager.subscribe).toHaveBeenCalledTimes(1);
    expect(subscribeBodies).toHaveLength(1);
  });

  it('réutilise l’abonnement existant du navigateur', async () => {
    const fake = installFakePush({ permission: 'granted', existingEndpoint: 'https://fcm.googleapis.com/fcm/send/ancien' });
    await expect(subscribe()).resolves.toEqual({ ok: true, endpoint: 'https://fcm.googleapis.com/fcm/send/ancien' });
    expect(fake.pushManager.subscribe).not.toHaveBeenCalled();
    expect(subscribeBodies).toHaveLength(1);
  });

  it('abonnement refusé par le navigateur : « failed », jamais affiché « Activées »', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    installFakePush({ subscribeError: new DOMException('Registration failed - push service error', 'AbortError') });

    await expect(enableNotifications()).resolves.toBe('failed');
    expect(usePushStore.getState().status).toBe('granted');
    expect(subscribeBodies).toHaveLength(0);
    warn.mockRestore();
  });

  it('serveur indisponible : « failed », et l’abonnement sera renvoyé au démarrage suivant', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    installFakePush({ permission: 'granted' });
    server.use(http.post(`${env.apiBaseUrl}/push/subscribe`, () => HttpResponse.json({}, { status: 503 })));

    await expect(enableNotifications()).resolves.toBe('failed');
    expect(usePushStore.getState().status).toBe('granted');
    expect(safeStorage.getItem('drc_push_endpoint')).toBeNull();

    server.resetHandlers();
    observePushRequests();
    loginAsJunior();
    await syncPushSubscription('startup');
    expect(subscribeBodies).toHaveLength(1);
    expect(usePushStore.getState().status).toBe('subscribed');
    warn.mockRestore();
  });

  it('« Désactiver » : POST /push/unsubscribe { endpoint } PUIS subscription.unsubscribe(), sans réabonnement automatique', async () => {
    const fake = installFakePush({ permission: 'granted' });
    const result = await subscribe();
    const endpoint = result.ok ? result.endpoint : '';
    const subscription = fake.state.subscription!;

    await disableNotifications();

    expect(unsubscribeBodies).toEqual([{ endpoint }]);
    expect(subscription.unsubscribe).toHaveBeenCalledTimes(1);
    expect(callOrder).toEqual(['POST /push/unsubscribe', 'subscription.unsubscribe']);
    expect(usePushStore.getState().status).toBe('granted');
    expect(safeStorage.getItem('drc_push_endpoint')).toBeNull();

    // Le client a choisi : pas de réabonnement à la connexion suivante
    await syncPushSubscription('login');
    expect(subscribeBodies).toHaveLength(1);
  });

  it('connexion : renvoie l’abonnement ; démarrage : seulement s’il a changé', async () => {
    const endpoint = 'https://fcm.googleapis.com/fcm/send/memorise';
    const fake = installFakePush({ permission: 'granted', existingEndpoint: endpoint });
    storeEndpoint(endpoint);

    await syncPushSubscription('startup');
    expect(subscribeBodies).toHaveLength(0);
    expect(usePushStore.getState().status).toBe('subscribed');

    await syncPushSubscription('login');
    expect(subscribeBodies).toHaveLength(1);

    // Le service de push a renouvelé l'abonnement : nouveau point de terminaison
    fake.state.subscription = new FakeSubscription('https://fcm.googleapis.com/fcm/send/nouveau', () => undefined);
    await syncPushSubscription('startup');
    expect(subscribeBodies).toHaveLength(2);
    expect((subscribeBodies[1]!.subscription as { endpoint: string }).endpoint).toBe(
      'https://fcm.googleapis.com/fcm/send/nouveau',
    );
    // Le serveur oublie l'ancien point de terminaison
    expect(subscribeBodies[1]!.oldEndpoint).toBe(endpoint);
    expect(subscribeBodies[0]).not.toHaveProperty('oldEndpoint');
  });

  it('démarrage : clé VAPID du serveur changée → ancien abonnement remplacé et signalé au serveur', async () => {
    const endpoint = 'https://fcm.googleapis.com/fcm/send/ancienne-cle';
    const fake = installFakePush({ permission: 'granted', existingEndpoint: endpoint });
    storeEndpoint(endpoint);
    // Abonnement créé avec une autre clé publique que celle de l'app
    const previous = fake.state.subscription!;
    Object.defineProperty(previous, 'options', {
      value: { applicationServerKey: new Uint8Array(65).fill(7).buffer, userVisibleOnly: true },
    });

    await syncPushSubscription('startup');
    expect(previous.unsubscribe).toHaveBeenCalledTimes(1);
    expect(subscribeBodies).toHaveLength(1);
    expect((subscribeBodies[0]!.subscription as { endpoint: string }).endpoint).not.toBe(endpoint);
    expect(subscribeBodies[0]!.oldEndpoint).toBe(endpoint);
    expect(usePushStore.getState().status).toBe('subscribed');
  });
});

// ---------------------------------------------------------------------------
// 3. Feuille Notifications du profil et déconnexion
// ---------------------------------------------------------------------------
describe('M6 · Notifications · 3. Profil et déconnexion', () => {
  it('feuille : « Activer » puis « Désactiver », état réactif', async () => {
    loginAsJunior();
    installFakePush();
    renderRoute('/profil?notifications=1');

    const sheet = await screen.findByRole('dialog', { name: 'Notifications' }, { timeout: 6000 });
    await waitFor(() => expect(within(sheet).getByRole('status')).toHaveTextContent('Désactivées'));
    fireEvent.click(within(sheet).getByRole('button', { name: 'Activer' }));

    await waitFor(() => expect(within(sheet).getByRole('status')).toHaveTextContent('Activées'), {
      timeout: 4000,
    });
    expect(subscribeBodies).toHaveLength(1);

    // « Activées » s'affiche dès l'abonnement ; le bouton redevient cliquable à la fin de l'action
    const deactivate = within(sheet).getByRole('button', { name: 'Désactiver' });
    await waitFor(() => expect(deactivate).toBeEnabled());
    fireEvent.click(deactivate);
    await waitFor(() => expect(within(sheet).getByRole('status')).toHaveTextContent('Désactivées'), {
      timeout: 4000,
    });
    expect(unsubscribeBodies).toHaveLength(1);
  }, 20_000);

  it('feuille : un échec d’abonnement affiche un message et reste « Désactivées »', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    loginAsJunior();
    installFakePush({ subscribeError: new Error('push service error') });
    renderRoute('/profil?notifications=1');

    const sheet = await screen.findByRole('dialog', { name: 'Notifications' }, { timeout: 6000 });
    await waitFor(() => expect(within(sheet).getByRole('status')).toHaveTextContent('Désactivées'));
    fireEvent.click(within(sheet).getByRole('button', { name: 'Activer' }));

    expect(await within(sheet).findByRole('alert', {}, { timeout: 4000 })).toHaveTextContent(
      /Impossible d’activer les notifications/,
    );
    expect(within(sheet).getByRole('status')).toHaveTextContent('Désactivées');
    warn.mockRestore();
  }, 20_000);

  it('déconnexion : désabonnement, pastille effacée', async () => {
    loginAsJunior();
    const endpoint = 'https://fcm.googleapis.com/fcm/send/compte-junior';
    const fake = installFakePush({ permission: 'granted', existingEndpoint: endpoint });
    storeEndpoint(endpoint);
    const badge = installFakeBadge();
    renderRoute('/profil');

    fireEvent.click(await screen.findByRole('button', { name: /Se déconnecter/ }, { timeout: 6000 }));
    // Espace insécable avant « ? » et « ! » (M7) : \s la reconnaît aussi
    const dialog = await screen.findByRole('dialog', { name: /^Se déconnecter\s\?$/ });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Me déconnecter' }));

    expect(await screen.findByText(/^Vous êtes déconnecté\. À bientôt\s!$/, {}, { timeout: 6000 })).toBeInTheDocument();
    expect(unsubscribeBodies).toEqual([{ endpoint }]);
    expect(badge.clearAppBadge).toHaveBeenCalled();
    // Données personnelles enregistrées pour le hors connexion : vidées par le service worker
    await waitFor(() => expect(fake.workerMessages).toContainEqual({ type: SW_MESSAGES.clearUserData }));
    expect(useAuthStore.getState().status).toBe('guest');
  }, 20_000);
});

// ---------------------------------------------------------------------------
// 4. Pont des messages du service worker
// ---------------------------------------------------------------------------
describe('M6 · Notifications · 4. Messages du service worker', () => {
  function makeContext(overrides: Partial<SwMessageContext> = {}) {
    const queryClient = new QueryClient();
    const invalidate = vi.spyOn(queryClient, 'invalidateQueries').mockResolvedValue(undefined);
    const navigate = vi.fn();
    const showToast = vi.fn(() => 'toast-1');
    const ctx: SwMessageContext = {
      queryClient,
      navigate,
      showToast,
      currentPath: '/',
      pageVisible: true,
      ...overrides,
    };
    return { ctx, invalidate, navigate, showToast };
  }

  beforeEach(() => {
    useSeenStore.setState({ byRef: {}, packageToastShown: [] });
  });

  it('PUSH_RECEIVED au premier plan : invalidations immédiates puis toast riche avec miniature et « Voir »', () => {
    const { ctx, invalidate, navigate, showToast } = makeContext();
    const payload = samplePushPayload('package_ready', 'RES-000102', `${APP_ORIGIN}/mock/colis-1.svg`);

    handleServiceWorkerMessage({ type: SW_MESSAGES.pushReceived, payload, shownAsNotification: false }, ctx);

    expect(invalidate).toHaveBeenCalledWith({ queryKey: qk.reservation('RES-000102') });
    expect(invalidate).toHaveBeenCalledWith({ queryKey: qk.reservations() });
    expect(showToast).toHaveBeenCalledTimes(1);
    const toast = (showToast.mock.calls[0] as unknown as [Record<string, unknown>])[0];
    expect(toast).toMatchObject({
      message: payload.title,
      subtitle: payload.body,
      thumbnail: `${APP_ORIGIN}/mock/colis-1.svg`,
      actionLabel: 'Voir',
      wrap: true,
    });
    (toast.onAction as () => void)();
    expect(navigate).toHaveBeenCalledWith('/reservations/RES-000102#colis');
    // Le toast « colis prêt » de M5 ne le double pas
    expect(useSeenStore.getState().packageToastShown).toContain('RES-000102');
  });

  it('notification système déjà affichée ou page masquée : invalidations sans toast', () => {
    const payload = samplePushPayload('payment_validated', 'RES-000101');
    const shown = makeContext();
    handleServiceWorkerMessage({ type: SW_MESSAGES.pushReceived, payload, shownAsNotification: true }, shown.ctx);
    expect(shown.invalidate).toHaveBeenCalledWith({ queryKey: qk.reservation('RES-000101') });
    expect(shown.showToast).not.toHaveBeenCalled();

    const hidden = makeContext({ pageVisible: false });
    handleServiceWorkerMessage({ type: SW_MESSAGES.pushReceived, payload, shownAsNotification: false }, hidden.ctx);
    expect(hidden.invalidate).toHaveBeenCalledTimes(2);
    expect(hidden.showToast).not.toHaveBeenCalled();
  });

  it('déjà sur la page concernée : toast sans bouton, pas de miniature hors « colis prêt »', () => {
    const { ctx, showToast } = makeContext({ currentPath: '/reservations/RES-000101' });
    const payload = { ...samplePushPayload('payment_validated', 'RES-000101'), image: `${APP_ORIGIN}/mock/colis-1.svg` };
    handleServiceWorkerMessage({ type: SW_MESSAGES.pushReceived, payload, shownAsNotification: false }, ctx);
    const toast = (showToast.mock.calls[0] as unknown as [Record<string, unknown>])[0];
    expect(toast.actionLabel).toBeUndefined();
    expect(toast.thumbnail).toBeUndefined();
  });

  it('NAVIGATE : navigation interne uniquement ; messages étrangers ignorés', () => {
    const { ctx, navigate, invalidate } = makeContext();
    expect(handleServiceWorkerMessage({ type: SW_MESSAGES.navigate, url: '/reservations/RES-000102' }, ctx)).toBe(true);
    expect(navigate).toHaveBeenCalledWith('/reservations/RES-000102');

    handleServiceWorkerMessage({ type: SW_MESSAGES.navigate, url: '//exemple.com/piege' }, ctx);
    expect(navigate).toHaveBeenCalledTimes(1);

    expect(handleServiceWorkerMessage({ type: 'MOCKING_ENABLED' }, ctx)).toBe(false);
    expect(handleServiceWorkerMessage({ type: SW_MESSAGES.pushReceived, payload: { type: 'inconnu' } }, ctx)).toBe(true);
    expect(invalidate).not.toHaveBeenCalled();
  });

  it('pont monté dans l’app : toast à la réception, navigation au clic sur une notification', async () => {
    const fake = installFakePush();
    const router = renderRoute('/panier');
    await screen.findByRole('heading', { level: 1 }, { timeout: 6000 });
    await waitFor(() => expect(fake.listenerCount()).toBeGreaterThan(0));

    act(() => {
      fake.emit({
        type: SW_MESSAGES.pushReceived,
        payload: samplePushPayload('payment_validated', 'RES-000101'),
        shownAsNotification: false,
      });
    });
    const toast = await screen.findByText('Paiement validé ✓');
    expect(within(toast.closest('[role="status"]') as HTMLElement).getByRole('button', { name: 'Voir' })).toBeInTheDocument();

    act(() => {
      fake.emit({ type: SW_MESSAGES.navigate, url: '/reservations/RES-000102' });
    });
    await waitFor(() => expect(router.state.location.pathname).toBe('/reservations/RES-000102'));
  }, 20_000);
});

// ---------------------------------------------------------------------------
// 5. Interrogation périodique ralentie et pastille
// ---------------------------------------------------------------------------
describe('M6 · Notifications · 5. Interrogation et pastille', () => {
  function refetchIntervalOf(client: QueryClient, queryKey: readonly unknown[]) {
    return client.getQueryCache().find({ queryKey })?.observers[0]?.options.refetchInterval;
  }

  it('2 min au lieu de 20-30 s seulement quand les notifications fonctionnent', async () => {
    loginAsJunior();
    const client = createAppQueryClient();
    const wrapper = wrapperFor(client);
    const interval = renderHook(() => usePollIntervalMs(30_000), { wrapper });
    renderHook(() => useReservationsSummary(), { wrapper });
    renderHook(() => useReservation('RES-000101', { live: true }), { wrapper });

    expect(interval.result.current).toBe(30_000);
    expect(refetchIntervalOf(client, qk.reservationsSummary())).toBe(30_000);
    expect(refetchIntervalOf(client, qk.reservation('RES-000101'))).toBe(20_000);

    // Permission accordée mais pas d'abonnement : intervalles inchangés
    act(() => usePushStore.setState({ status: 'granted' }));
    expect(refetchIntervalOf(client, qk.reservationsSummary())).toBe(30_000);

    act(() => usePushStore.setState({ status: 'subscribed', endpoint: 'https://fcm.googleapis.com/fcm/send/x' }));
    expect(interval.result.current).toBe(PUSH_POLL_INTERVAL_MS);
    await waitFor(() => expect(refetchIntervalOf(client, qk.reservationsSummary())).toBe(120_000));
    expect(refetchIntervalOf(client, qk.reservation('RES-000101'))).toBe(120_000);
  });

  it('pastille posée avec le nombre d’actions attendues, effacée à la déconnexion', async () => {
    const badge = installFakeBadge();
    loginAsJunior();
    const client = createAppQueryClient();
    renderHook(() => useAppBadge(), { wrapper: wrapperFor(client) });

    await waitFor(() => expect(badge.setAppBadge).toHaveBeenCalledWith(3));
    expect(badge.clearAppBadge).not.toHaveBeenCalled();

    act(() => useAuthStore.getState().clearSession());
    await waitFor(() => expect(badge.clearAppBadge).toHaveBeenCalled());
  });

  it('sans API de pastille (navigateur non compatible) : aucun appel, aucune erreur', async () => {
    loginAsJunior();
    const client = createAppQueryClient();
    const { result } = renderHook(() => ({ summary: useReservationsSummary(), badge: useAppBadge() }), {
      wrapper: wrapperFor(client),
    });
    await waitFor(() => expect(result.current.summary.data?.needsAction).toBe(3));
    expect('setAppBadge' in navigator).toBe(false);
  });
});
