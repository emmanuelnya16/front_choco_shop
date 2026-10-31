import { onlineManager, QueryClientProvider } from '@tanstack/react-query';
import { act, fireEvent, render, renderHook, screen, waitFor, within } from '@testing-library/react';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { RouterErrorBoundary } from '@/app/layouts/RootLayout';
import { AppProviders } from '@/app/providers';
import { createTestRouter } from '@/app/router';
import { Toaster } from '@/components/ui/Toast';
import { OfflineBanner } from '@/features/offline/OfflineBanner';
import { isChunkLoadError, isNetworkError } from '@/features/offline/networkErrors';
import { saveStoredPaymentSettings } from '@/features/payment/api/paymentSettingsStorage';
import { buildUssdCode, buildUssdTelHref } from '@/features/payment/utils/ussd';
import { api, ApiError } from '@/lib/api/client';
import { createAppQueryClient } from '@/lib/api/queryClient';
import { useNetworkRecoveryToast, useOnlineStatus } from '@/lib/hooks/useOnlineStatus';
import { createSeedReservations } from '@/mocks/fixtures/reservations';
import { MotionProvider } from '@/motion/MotionProvider';
import { OfflinePage } from '@/pages/OfflinePage';
import { NETWORK_FAILURE_THRESHOLD, useNetworkStore, useSyncStore } from '@/pwa/networkStore';
import { useAuthStore } from '@/stores/authStore';
import { useRecentlyViewedStore } from '@/stores/recentlyViewedStore';
import { useReservationStore } from '@/stores/reservationStore';
import { useToastStore } from '@/stores/toastStore';
import type { PaymentSettings, User } from '@/types/domain';

const JUNIOR: User = {
  id: 'usr-junior-01',
  phone: '+237690000001',
  firstName: 'Junior',
  lastName: 'Mbarga',
  createdAt: '2026-09-15T10:00:00.000Z',
};

/** jsdom n'a pas de réseau : navigator.onLine est simulé localement puis restauré. */
function setNavigatorOnline(value: boolean) {
  Object.defineProperty(navigator, 'onLine', { configurable: true, get: () => value });
}

function goOffline() {
  act(() => {
    setNavigatorOnline(false);
    window.dispatchEvent(new Event('offline'));
  });
}

function goOnline() {
  act(() => {
    setNavigatorOnline(true);
    window.dispatchEvent(new Event('online'));
  });
}

function resetNetwork() {
  useNetworkStore.setState({
    browserOnline: true,
    online: true,
    consecutiveFailures: 0,
    offlineSince: null,
    recoveredAt: null,
  });
}

const networkDown = () => new TypeError('Failed to fetch');

beforeEach(() => {
  resetNetwork();
  useSyncStore.getState().clear();
  useRecentlyViewedStore.getState().clear();
  useToastStore.getState().clear();
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  // Retire la simulation : navigator.onLine revient au getter de jsdom
  Reflect.deleteProperty(navigator, 'onLine');
  useAuthStore.getState().clearSession();
  useReservationStore.getState().clearActiveReservation();
  resetNetwork();
});

// ---------------------------------------------------------------------------
// 1. Store réseau unique (§6.1, §9.4)
// ---------------------------------------------------------------------------
describe('M6 · 5. Store réseau (networkStore)', () => {
  it('passe hors connexion après 2 échecs réseau successifs et revient en ligne au premier succès', () => {
    const store = useNetworkStore.getState();
    expect(NETWORK_FAILURE_THRESHOLD).toBe(2);

    store.reportFailure();
    expect(useNetworkStore.getState().online).toBe(true);
    store.reportFailure();
    expect(useNetworkStore.getState().online).toBe(false);
    expect(useNetworkStore.getState().offlineSince).not.toBeNull();

    expect(store.reportSuccess()).toBe(true);
    const state = useNetworkStore.getState();
    expect(state.online).toBe(true);
    expect(state.consecutiveFailures).toBe(0);
    expect(state.recoveredAt).not.toBeNull();
  });

  it('un succès entre deux échecs remet le compteur à zéro', () => {
    const store = useNetworkStore.getState();
    store.reportFailure();
    store.reportSuccess();
    store.reportFailure();
    expect(useNetworkStore.getState().online).toBe(true);
  });

  it('suit les évènements online / offline du navigateur', () => {
    goOffline();
    expect(useNetworkStore.getState()).toMatchObject({ browserOnline: false, online: false });
    goOnline();
    expect(useNetworkStore.getState()).toMatchObject({ browserOnline: true, online: true });
  });

  it('navigateur hors ligne avec service worker actif : une réponse enregistrée ne prouve pas le retour du réseau', () => {
    goOffline();
    Object.defineProperty(navigator, 'serviceWorker', {
      configurable: true,
      value: { controller: {} },
    });
    try {
      expect(useNetworkStore.getState().reportSuccess()).toBe(false);
      expect(useNetworkStore.getState().online).toBe(false);
    } finally {
      Reflect.deleteProperty(navigator, 'serviceWorker');
    }
  });

  it('est alimenté par le client HTTP : coupures et délais dépassés, puis première réponse', async () => {
    const abort = Object.assign(new Error('The operation was aborted.'), { name: 'AbortError' });
    vi.spyOn(globalThis, 'fetch')
      .mockRejectedValueOnce(networkDown())
      .mockRejectedValueOnce(abort)
      .mockResolvedValueOnce(new Response(JSON.stringify([]), { status: 200 }));

    await expect(api.get('/categories')).rejects.toMatchObject({ status: 0, code: 'NETWORK_ERROR' });
    expect(useNetworkStore.getState().online).toBe(true);
    await expect(api.get('/categories')).rejects.toMatchObject({ status: 408, code: 'TIMEOUT' });
    expect(useNetworkStore.getState().online).toBe(false);

    await expect(api.get('/categories')).resolves.toEqual([]);
    expect(useNetworkStore.getState().online).toBe(true);
  });

  it("une réponse d'erreur du serveur (404) prouve que le réseau fonctionne", async () => {
    useNetworkStore.setState({ online: false, consecutiveFailures: 2 });
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response(JSON.stringify({ code: 'NOT_FOUND' }), { status: 404 }),
    );
    await expect(api.get('/products/inconnu')).rejects.toMatchObject({ status: 404 });
    expect(useNetworkStore.getState().online).toBe(true);
  });

  it('relie TanStack Query (onlineManager) au store : les requêtes en pause reprennent au retour du réseau', () => {
    // Le module queryClient (importé ci-dessus) branche onlineManager sur le store
    act(() => useNetworkStore.getState().setBrowserOnline(false));
    expect(onlineManager.isOnline()).toBe(false);
    act(() => useNetworkStore.getState().setBrowserOnline(true));
    expect(onlineManager.isOnline()).toBe(true);
  });

  it('useOnlineStatus garde son API et suit le store (y compris les échecs de requêtes)', () => {
    const { result } = renderHook(() => useOnlineStatus());
    expect(result.current).toBe(true);
    act(() => {
      useNetworkStore.getState().reportFailure();
      useNetworkStore.getState().reportFailure();
    });
    expect(result.current).toBe(false);
    act(() => {
      useNetworkStore.getState().reportSuccess();
    });
    expect(result.current).toBe(true);
  });

  it('date de dernière synchronisation : seulement les vraies réponses, effacée à la déconnexion', async () => {
    useAuthStore.getState().setSession('jwt', JUNIOR);
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response(JSON.stringify({ ref: 'RES-000101' }), { status: 200 }),
    );
    await api.get('/reservations/RES-000101');
    expect(useSyncStore.getState().syncedAt['/reservations/RES-000101']).toBeGreaterThan(0);

    useAuthStore.getState().clearSession();
    expect(useSyncStore.getState().syncedAt).toEqual({});
  });

  it('reconnaît les coupures et les morceaux de page introuvables', () => {
    expect(isNetworkError(new ApiError(0, 'NETWORK_ERROR', 'x'))).toBe(true);
    expect(isNetworkError(new ApiError(408, 'TIMEOUT', 'x'))).toBe(true);
    expect(isNetworkError(new ApiError(0, 'UPLOAD_ABORTED', 'x'))).toBe(false);
    expect(isNetworkError(new ApiError(404, 'NOT_FOUND', 'x'))).toBe(false);
    expect(isChunkLoadError(new TypeError('Failed to fetch dynamically imported module: /assets/x.js'))).toBe(
      true,
    );
    expect(isChunkLoadError(new Error('Oups'))).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// 2. Bandeau global (§6.2)
// ---------------------------------------------------------------------------
function BannerHarness() {
  useNetworkRecoveryToast();
  return (
    <>
      <OfflineBanner />
      <Toaster />
    </>
  );
}

function renderBanner(path = '/panier') {
  const client = createAppQueryClient();
  const router = createMemoryRouter([{ path: '*', element: <BannerHarness /> }], { initialEntries: [path] });
  render(
    <QueryClientProvider client={client}>
      <MotionProvider>
        <RouterProvider router={router} />
      </MotionProvider>
    </QueryClientProvider>,
  );
  return client;
}

describe('M6 · 6. Bandeau hors connexion', () => {
  it('apparaît hors connexion avec « Réessayer », puis « Connexion rétablie » un seul fois, sans toast en double', async () => {
    const client = renderBanner();
    const invalidate = vi.spyOn(client, 'invalidateQueries');
    const resume = vi.spyOn(client, 'resumePausedMutations');
    expect(screen.queryByText(/Hors connexion/)).not.toBeInTheDocument();

    goOffline();
    expect(await screen.findByText('Hors connexion · contenu de votre dernière visite')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Réessayer' })).toBeInTheDocument();

    goOnline();
    expect(await screen.findByText('Connexion rétablie')).toBeInTheDocument();
    expect(screen.getAllByText('Connexion rétablie')).toHaveLength(1);
    expect(useToastStore.getState().toasts).toHaveLength(0);
    // Relance : envois en pause et données affichées
    expect(resume).toHaveBeenCalled();
    expect(invalidate).toHaveBeenCalledWith({ type: 'active' }, { cancelRefetch: false });

    await waitFor(() => expect(screen.queryByText('Connexion rétablie')).not.toBeInTheDocument(), {
      timeout: 4000,
    });
  });

  it('« Réessayer » relance les données affichées', async () => {
    const client = renderBanner();
    vi.spyOn(globalThis, 'fetch').mockRejectedValue(networkDown());
    const invalidate = vi.spyOn(client, 'invalidateQueries');
    goOffline();
    fireEvent.click(await screen.findByRole('button', { name: 'Réessayer' }));
    await waitFor(() => expect(invalidate).toHaveBeenCalledWith({ type: 'active' }));
    expect(await screen.findByRole('button', { name: 'Réessayer' })).toBeInTheDocument();
  });

  it("n'est pas affiché sur la page /hors-ligne qui explique déjà la situation, mais y annonce le retour du réseau", async () => {
    renderBanner('/hors-ligne');
    goOffline();
    expect(screen.queryByText('Hors connexion · contenu de votre dernière visite')).not.toBeInTheDocument();
    goOnline();
    expect(await screen.findByText('Connexion rétablie')).toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// 3. Page /hors-ligne (§6.5)
// ---------------------------------------------------------------------------
function seedRecentlyViewed() {
  const record = useRecentlyViewedStore.getState().record;
  record({
    id: 'p-1',
    slug: 'hoodie-barbele-noir',
    name: 'Hoodie Barbelé Noir',
    price: 25000,
    images: ['/mock/product-hoodie.svg'],
    fallbackImages: [],
  });
  record({
    id: 'p-2',
    slug: 'babouche-cuir-rouge',
    name: 'Babouche Cuir Rouge',
    price: 18000,
    images: ['/mock/product-babouche.svg'],
    fallbackImages: [],
  });
}

function renderOfflinePage() {
  const router = createMemoryRouter(
    [
      { path: '/hors-ligne', element: <OfflinePage /> },
      { path: '/panier', element: <div>PAGE PANIER</div> },
    ],
    { initialEntries: ['/hors-ligne'] },
  );
  render(
    <QueryClientProvider client={createAppQueryClient()}>
      <MotionProvider>
        <RouterProvider router={router} />
      </MotionProvider>
    </QueryClientProvider>,
  );
}

describe('M6 · 7. Page « Vous êtes hors connexion »', () => {
  it('affiche les textes, « Réessayer », « Voir mon panier » et les derniers articles consultés', async () => {
    seedRecentlyViewed();
    renderOfflinePage();

    expect(screen.getByRole('heading', { level: 1, name: 'Vous êtes hors connexion' })).toBeInTheDocument();
    expect(screen.getByText('Cette page n’a pas encore été enregistrée sur votre téléphone.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Réessayer' })).toBeInTheDocument();

    // Sans API Cache (jsdom) : liste simple des derniers articles consultés, le plus récent d'abord
    const links = screen.getAllByRole('link', { name: /Hoodie|Babouche/ });
    expect(links.map((a) => a.getAttribute('href'))).toEqual([
      '/produit/babouche-cuir-rouge',
      '/produit/hoodie-barbele-noir',
    ]);

    fireEvent.click(screen.getByRole('link', { name: /Voir mon panier/ }));
    expect(await screen.findByText('PAGE PANIER')).toBeInTheDocument();
  });

  it("ne garde que les fiches enregistrées par l'application (cache api-catalog)", async () => {
    seedRecentlyViewed();
    const match = vi.fn(async (url: string) =>
      url.endsWith('/products/hoodie-barbele-noir') ? new Response('{}') : undefined,
    );
    vi.stubGlobal('caches', {
      has: vi.fn(async (name: string) => name === 'api-catalog'),
      open: vi.fn(async () => ({ match })),
    });
    renderOfflinePage();

    expect(await screen.findByRole('link', { name: /Hoodie Barbelé Noir/ })).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /Babouche Cuir Rouge/ })).not.toBeInTheDocument();
    expect(match).toHaveBeenCalledWith(expect.stringContaining('/products/hoodie-barbele-noir'), {
      ignoreVary: true,
    });
  });

  it('page dont le morceau ne peut pas se charger hors connexion : contenu « hors connexion » au lieu de « Oups »', async () => {
    seedRecentlyViewed();
    goOffline();
    const router = createMemoryRouter(
      [
        {
          path: '/',
          errorElement: <RouterErrorBoundary />,
          children: [
            { index: true, element: <div>ACCUEIL</div> },
            {
              path: 'jamais-vue',
              lazy: () =>
                Promise.reject(new TypeError('Failed to fetch dynamically imported module: /assets/DevPage-x.js')),
            },
          ],
        },
      ],
      { initialEntries: ['/jamais-vue'] },
    );
    render(
      <QueryClientProvider client={createAppQueryClient()}>
        <MotionProvider>
          <RouterProvider router={router} />
        </MotionProvider>
      </QueryClientProvider>,
    );

    expect(await screen.findByRole('heading', { name: 'Vous êtes hors connexion' })).toBeInTheDocument();
    expect(screen.queryByText(/Oups/)).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('link', { name: /Revenir à l.accueil/ }));
    expect(await screen.findByText('ACCUEIL')).toBeInTheDocument();
  });

  it('« Réessayer » toujours hors connexion : message, pas de rechargement', async () => {
    vi.spyOn(globalThis, 'fetch').mockRejectedValue(networkDown());
    goOffline();
    renderOfflinePage();
    fireEvent.click(screen.getByRole('button', { name: 'Réessayer' }));
    expect(await screen.findByText('Toujours hors connexion. Réessayez dans un instant.')).toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// 4. Paiement hors connexion (§6.3, critique) et repli de la fiche produit
// ---------------------------------------------------------------------------
const REAL_PAYMENT: PaymentSettings = {
  operators: [
    {
      id: 'orange',
      label: 'Orange Money',
      merchantName: 'ETS DR CHOCO',
      merchantCode: '654321',
      ussdTemplate: '#150*47*{code}*{amount}#',
      qrImageUrl: '/mock/qr-orange.svg',
      steps: ['Composez le code.'],
      enabled: true,
    },
    {
      id: 'mtn',
      label: 'MTN MoMo',
      merchantName: 'DR CHOCO SARL',
      merchantCode: '777888',
      ussdTemplate: '*126*14*{code}*{amount}#',
      qrImageUrl: '/mock/qr-mtn.svg',
      steps: ['Composez le code.'],
      enabled: true,
    },
  ],
  exactAmountRequired: true,
  validationDelayText: 'en moins d’une heure',
  proofMaxSizeMb: 10,
};

function renderApp(path: string) {
  const router = createTestRouter([path]);
  render(
    <AppProviders client={createAppQueryClient()}>
      <RouterProvider router={router} />
    </AppProviders>,
  );
  return router;
}

describe('M6 · 8. Paiement lisible hors connexion', () => {
  it('référence, montant et vrai code USSD visibles, « Composer le code » actif, jamais « introuvable »', async () => {
    const reservation = createSeedReservations()['RES-000101']!;
    const total = reservation.amount?.total ?? reservation.total;
    useAuthStore.getState().setSession('jwt-junior', JUNIOR);
    useReservationStore.getState().setActiveReservation(reservation, reservation.serverTime);
    // Paramètres reçus lors d'une visite précédente, conservés sur le téléphone
    saveStoredPaymentSettings(REAL_PAYMENT, '+237690000000');

    vi.spyOn(globalThis, 'fetch').mockRejectedValue(networkDown());
    setNavigatorOnline(false);
    act(() => useNetworkStore.getState().setBrowserOnline(false));

    renderApp('/reservation/RES-000101/paiement');

    const dial = await screen.findByTestId('ussd-dial-link');
    const expectedCode = buildUssdCode('#150*47*{code}*{amount}#', '654321', total) ?? '';
    expect(expectedCode).not.toBe('');
    expect(screen.getByTestId('ussd-plain-code')).toHaveTextContent(expectedCode);
    expect(dial).toHaveAttribute('href', buildUssdTelHref(expectedCode));
    expect(dial).not.toHaveAttribute('aria-disabled');
    expect(screen.getByTestId('copy-ref-button')).toHaveTextContent('RES-000101');
    expect(screen.getByText(/Pas besoin d.Internet pour payer/)).toBeInTheDocument();
    expect(screen.getByText('Hors connexion · contenu de votre dernière visite')).toBeInTheDocument();

    // La relecture en échec ne remplace pas l'écran par « Réservation introuvable »
    await waitFor(() => expect(globalThis.fetch).toHaveBeenCalled());
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 50));
    });
    expect(screen.queryByText('Réservation introuvable')).not.toBeInTheDocument();
    expect(screen.getByTestId('ussd-dial-link')).toBeInTheDocument();
  });

  it('réservation jamais chargée sur ce téléphone : contenu « hors connexion » au lieu de « introuvable »', async () => {
    useAuthStore.getState().setSession('jwt-junior', JUNIOR);
    vi.spyOn(globalThis, 'fetch').mockRejectedValue(networkDown());
    setNavigatorOnline(false);
    act(() => useNetworkStore.getState().setBrowserOnline(false));

    renderApp('/reservation/RES-000999/paiement');

    expect(await screen.findByRole('heading', { name: 'Vous êtes hors connexion' })).toBeInTheDocument();
    expect(screen.queryByText('Réservation introuvable')).not.toBeInTheDocument();
  });

  it('mes réservations jamais chargées sur ce téléphone : contenu « hors connexion » au lieu d’une erreur', async () => {
    useAuthStore.getState().setSession('jwt-junior', JUNIOR);
    vi.spyOn(globalThis, 'fetch').mockRejectedValue(networkDown());
    setNavigatorOnline(false);
    act(() => useNetworkStore.getState().setBrowserOnline(false));

    renderApp('/reservations');

    expect(
      await screen.findByRole('heading', { name: 'Vous êtes hors connexion' }, { timeout: 10_000 }),
    ).toBeInTheDocument();
    // Aucun statut enregistré : pas de « statuts affichés depuis votre dernière visite »
    expect(screen.queryByText(/statuts affichés depuis votre dernière visite/)).not.toBeInTheDocument();
    expect(screen.queryByText('Impossible de charger vos réservations.')).not.toBeInTheDocument();
  }, 20_000);

  it('fiche produit jamais consultée hors connexion : repli avec les derniers articles consultés', async () => {
    seedRecentlyViewed();
    vi.spyOn(globalThis, 'fetch').mockRejectedValue(networkDown());
    setNavigatorOnline(false);
    act(() => useNetworkStore.getState().setBrowserOnline(false));

    // Première transformation de la fiche produit (morceau chargé à la demande) : peut être longue
    await import('@/pages/ProductPage');
    renderApp('/produit/article-jamais-vu');

    const heading = await screen.findByRole(
      'heading',
      { name: 'Vous êtes hors connexion' },
      { timeout: 10_000 },
    );
    const section = heading.closest('section')!;
    expect(within(section).getByRole('link', { name: /Hoodie Barbelé Noir/ })).toBeInTheDocument();
    expect(screen.queryByText('Impossible de charger cet article')).not.toBeInTheDocument();
  }, 20_000);
});
