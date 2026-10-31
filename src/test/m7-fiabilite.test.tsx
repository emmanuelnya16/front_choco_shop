import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { setupServer } from 'msw/node';
import { lazy } from 'react';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { RootLayout, RouterErrorBoundary } from '@/app/layouts/RootLayout';
import { AppProviders } from '@/app/providers';
import { createTestRouter } from '@/app/router';
import { clearChunkReloadFlag, pageReload } from '@/components/errors/chunkReload';
import { ErrorBoundary, SafeLazy } from '@/components/errors/ErrorBoundary';
import { installGlobalErrorHandlers } from '@/components/errors/globalErrorHandlers';
import { createAppQueryClient } from '@/lib/api/queryClient';
import { env } from '@/lib/env';
import {
  configureMonitoring,
  MAX_REPORTS_PER_SESSION,
  reportError,
  resetMonitoring,
  scrub,
} from '@/lib/monitoring';
import { handlers, resetMockM3State } from '@/mocks/handlers';
import { useNetworkStore } from '@/pwa/networkStore';

// Section de l'accueil pilotée par le test : en panne, puis rétablie
const bestSellers = vi.hoisted(() => ({ broken: true }));
vi.mock('@/features/catalog/home/BestSellersSection', () => ({
  BestSellersSection: () => {
    if (bestSellers.broken) throw new Error('Section en panne (test)');
    return (
      <section>
        <h2>Les plus réservés (rétablie)</h2>
      </section>
    );
  },
}));

const server = setupServer(...handlers);
const ENDPOINT = 'https://api.boutique.test/client-errors';
const CHUNK_MESSAGE = 'Failed to fetch dynamically imported module: https://boutique.test/assets/ProductPage-B2x9.js';

function setNavigatorOnline(value: boolean) {
  Object.defineProperty(navigator, 'onLine', { configurable: true, get: () => value });
}

function resetNetwork(online = true) {
  setNavigatorOnline(online);
  useNetworkStore.setState({
    browserOnline: online,
    online,
    consecutiveFailures: 0,
    offlineSince: online ? null : Date.now(),
    recoveredAt: null,
  });
}

function Thrower({ error }: { error: unknown }): never {
  throw error;
}

/** Réponses des envois vers /client-errors (et de toute autre requête) sans réseau réel. */
function mockFetch() {
  return vi.spyOn(globalThis, 'fetch').mockImplementation(async () => new Response(null, { status: 204 }));
}

function sentPayloads(fetchSpy: ReturnType<typeof mockFetch>) {
  return fetchSpy.mock.calls
    .filter(([url]) => String(url) === ENDPOINT)
    .map(([, init]) => JSON.parse(String(init?.body)) as Record<string, unknown>);
}

beforeAll(() => {
  server.listen({ onUnhandledFrame: 'bypass' });
});

beforeEach(() => {
  sessionStorage.clear();
  resetMonitoring();
  resetNetwork(true);
  resetMockM3State();
  bestSellers.broken = true;
  // React journalise les erreurs interceptées : la sortie des tests reste lisible
  vi.spyOn(console, 'error').mockImplementation(() => undefined);
});

afterEach(() => {
  server.resetHandlers();
  vi.restoreAllMocks();
  window.history.replaceState({}, '', '/');
});

afterAll(() => {
  server.close();
});

// ---------------------------------------------------------------------------
// 1. Zones d'erreur
// ---------------------------------------------------------------------------
describe('M7 §5.1 · zones d’erreur', () => {
  it('une section de l’accueil en panne affiche un encart discret sans emporter la page, puis « Réessayer » la rétablit', async () => {
    configureMonitoring({ stage: 'development', log: true });
    render(
      <AppProviders client={createAppQueryClient()}>
        <RouterProvider router={createTestRouter(['/'])} />
      </AppProviders>,
    );

    // Le reste de l'accueil s'affiche (premier chargement de la page : délai plus large)
    expect(await screen.findByText('NE SE PLIE', undefined, { timeout: 10_000 })).toBeInTheDocument();
    expect(screen.getByText('Nos univers')).toBeInTheDocument();
    expect(screen.getByText(/RÉSERVEZ EN 3 ÉTAPES/i)).toBeInTheDocument();
    expect(screen.getByText(/POURQUOI NOUS FAIRE CONFIANCE/i)).toBeInTheDocument();

    // Seule la section en panne est remplacée, par un encart discret (chargé à la demande)
    expect(await screen.findAllByText('Cette partie n’a pas pu s’afficher.')).toHaveLength(1);
    expect(screen.queryByText(/Oups/)).not.toBeInTheDocument();
    // Signalée avec sa zone (en développement : dans la console)
    await waitFor(() =>
      expect(console.error).toHaveBeenCalledWith(
        '[Erreur · home:best-sellers] Section en panne (test)',
        expect.any(Error),
      ),
    );

    bestSellers.broken = false;
    const notice = screen.getByText('Cette partie n’a pas pu s’afficher.').closest('[role="status"]') as HTMLElement;
    fireEvent.click(within(notice).getByRole('button', { name: 'Réessayer' }));
    expect(await screen.findByRole('heading', { name: 'Les plus réservés (rétablie)' })).toBeInTheDocument();
    expect(screen.queryByText('Cette partie n’a pas pu s’afficher.')).not.toBeInTheDocument();
  });

  it('écran d’erreur générale : titre, phrase rassurante, « Recharger » et « Revenir à l’accueil », sans détail technique', async () => {
    const reload = vi.spyOn(pageReload, 'reload').mockImplementation(() => undefined);
    render(
      <ErrorBoundary variant="shell">
        <Thrower error={new TypeError('Cannot read properties of undefined (reading "items")')} />
      </ErrorBoundary>,
    );

    expect(await screen.findByRole('heading', { name: 'Oups, quelque chose s’est mal passé' })).toBeInTheDocument();
    expect(screen.getByText(/votre panier et vos réservations sont conservés/)).toBeInTheDocument();
    expect(screen.queryByText(/Cannot read properties/)).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Revenir à l.accueil/ })).toHaveAttribute('href', '/');

    fireEvent.click(screen.getByRole('button', { name: 'Recharger' }));
    expect(reload).toHaveBeenCalledTimes(1);
  });

  it('zone « page » : l’erreur d’une page garde l’en-tête, et le retour à l’accueil réinitialise la zone', async () => {
    const router = createMemoryRouter(
      [
        {
          path: '/',
          Component: RootLayout,
          ErrorBoundary: RouterErrorBoundary,
          children: [
            { index: true, element: <p>ACCUEIL DE TEST</p> },
            { path: 'casse', element: <Thrower error={new Error('Page en panne (test)')} /> },
          ],
        },
      ],
      { initialEntries: ['/casse'] },
    );
    render(
      <AppProviders client={createAppQueryClient()}>
        <RouterProvider router={router} />
      </AppProviders>,
    );

    expect(await screen.findByRole('heading', { name: 'Oups, quelque chose s’est mal passé' })).toBeInTheDocument();
    // La mise en page reste là (lien d'évitement et zone de contenu)
    expect(screen.getByText('Aller au contenu')).toBeInTheDocument();
    expect(document.getElementById('contenu')).toContainElement(
      screen.getByRole('heading', { name: 'Oups, quelque chose s’est mal passé' }),
    );

    fireEvent.click(screen.getByRole('link', { name: /Revenir à l.accueil/ }));
    expect(await screen.findByText('ACCUEIL DE TEST')).toBeInTheDocument();
    expect(screen.queryByText(/Oups/)).not.toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// 2. Morceau de code introuvable après une mise à jour
// ---------------------------------------------------------------------------
describe('M7 §5.1 · rechargement unique sur morceau introuvable', () => {
  it('recharge une seule fois, puis affiche l’écran d’erreur si le morceau manque toujours', async () => {
    const reload = vi.spyOn(pageReload, 'reload').mockImplementation(() => undefined);
    const chunkError = new TypeError(CHUNK_MESSAGE);

    const first = render(
      <ErrorBoundary variant="shell">
        <Thrower error={chunkError} />
      </ErrorBoundary>,
    );
    expect(reload).toHaveBeenCalledTimes(1);
    expect(screen.getByRole('status', { name: 'Chargement de la nouvelle version' })).toBeInTheDocument();
    expect(screen.queryByText(/Oups/)).not.toBeInTheDocument();
    expect(sessionStorage.getItem('drc_chunk_reload')).not.toBeNull();
    first.unmount();

    // « Après » le rechargement : le morceau manque encore → pas de deuxième rechargement
    render(
      <ErrorBoundary variant="shell">
        <Thrower error={new TypeError(CHUNK_MESSAGE)} />
      </ErrorBoundary>,
    );
    expect(reload).toHaveBeenCalledTimes(1);
    expect(await screen.findByRole('heading', { name: 'Oups, quelque chose s’est mal passé' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Recharger' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Revenir à l.accueil/ })).toBeInTheDocument();
  });

  it('les autres messages connus (Safari, Firefox, ChunkLoadError) déclenchent aussi le rechargement', () => {
    const reload = vi.spyOn(pageReload, 'reload').mockImplementation(() => undefined);
    // Reconnu par son nom seul, quel que soit son message
    const chunkLoadError = Object.assign(new Error('Morceau 42 indisponible'), { name: 'ChunkLoadError' });
    const errors = [
      new TypeError('Importing a module script failed.'),
      new TypeError('error loading dynamically imported module: https://boutique.test/assets/x.js'),
      chunkLoadError,
    ];
    for (const error of errors) {
      sessionStorage.clear();
      const view = render(
        <ErrorBoundary variant="shell">
          <Thrower error={error} />
        </ErrorBoundary>,
      );
      view.unmount();
    }
    expect(reload).toHaveBeenCalledTimes(errors.length);
  });

  it('un chargement réussi efface le drapeau, mais jamais deux rechargements automatiques dans la minute', async () => {
    const reload = vi.spyOn(pageReload, 'reload').mockImplementation(() => undefined);
    const view = render(
      <ErrorBoundary variant="shell">
        <Thrower error={new TypeError(CHUNK_MESSAGE)} />
      </ErrorBoundary>,
    );
    view.unmount();
    clearChunkReloadFlag();
    expect(sessionStorage.getItem('drc_chunk_reload')).toBeNull();

    // Un morceau définitivement absent ne fait pas boucler l'app
    render(
      <ErrorBoundary variant="shell">
        <Thrower error={new TypeError(CHUNK_MESSAGE)} />
      </ErrorBoundary>,
    );
    expect(reload).toHaveBeenCalledTimes(1);
    expect(await screen.findByRole('heading', { name: 'Oups, quelque chose s’est mal passé' })).toBeInTheDocument();
  });

  it('écran chargé à la demande impossible à charger (réseau absent) : repli minimal avec « Recharger »', async () => {
    const reload = vi.spyOn(pageReload, 'reload').mockImplementation(() => undefined);
    const Unreachable = lazy(() => Promise.reject(new TypeError(CHUNK_MESSAGE)));
    render(
      <SafeLazy failureText="Vous êtes hors connexion.">
        <Unreachable />
      </SafeLazy>,
    );
    expect(await screen.findByRole('alert')).toHaveTextContent('Vous êtes hors connexion.');
    fireEvent.click(screen.getByRole('button', { name: 'Recharger' }));
    expect(reload).toHaveBeenCalledTimes(1);
  });

  it('hors connexion : contenu « hors connexion », jamais de rechargement', async () => {
    const reload = vi.spyOn(pageReload, 'reload').mockImplementation(() => undefined);
    resetNetwork(false);
    render(
      <ErrorBoundary variant="shell">
        <Thrower error={new TypeError(CHUNK_MESSAGE)} />
      </ErrorBoundary>,
    );
    expect(await screen.findByRole('heading', { name: 'Vous êtes hors connexion' })).toBeInTheDocument();
    expect(screen.queryByText(/Oups/)).not.toBeInTheDocument();
    expect(reload).not.toHaveBeenCalled();
  });

  it('zone « page » hors connexion : contenu « hors connexion » sous l’en-tête, sans rechargement', async () => {
    const reload = vi.spyOn(pageReload, 'reload').mockImplementation(() => undefined);
    resetNetwork(false);
    const router = createMemoryRouter(
      [
        {
          path: '/',
          Component: RootLayout,
          ErrorBoundary: RouterErrorBoundary,
          children: [
            { index: true, element: <p>ACCUEIL DE TEST</p> },
            { path: 'jamais-vue', element: <Thrower error={new TypeError(CHUNK_MESSAGE)} /> },
          ],
        },
      ],
      { initialEntries: ['/jamais-vue'] },
    );
    render(
      <AppProviders client={createAppQueryClient()}>
        <RouterProvider router={router} />
      </AppProviders>,
    );
    const heading = await screen.findByRole('heading', { name: 'Vous êtes hors connexion' });
    expect(document.getElementById('contenu')).toContainElement(heading);
    expect(screen.getByText('Aller au contenu')).toBeInTheDocument();
    expect(screen.queryByText(/Oups/)).not.toBeInTheDocument();
    expect(reload).not.toHaveBeenCalled();
  });

  it('page dont le morceau manque, en ligne : rechargement automatique au niveau du routeur', async () => {
    const reload = vi.spyOn(pageReload, 'reload').mockImplementation(() => undefined);
    const router = createMemoryRouter(
      [
        {
          path: '/',
          errorElement: <RouterErrorBoundary />,
          children: [
            { index: true, element: <div>ACCUEIL</div> },
            { path: 'nouvelle-page', lazy: () => Promise.reject(new TypeError(CHUNK_MESSAGE)) },
          ],
        },
      ],
      { initialEntries: ['/nouvelle-page'] },
    );
    render(
      <AppProviders client={createAppQueryClient()}>
        <RouterProvider router={router} />
      </AppProviders>,
    );
    expect(await screen.findByRole('status', { name: 'Chargement de la page' })).toBeInTheDocument();
    expect(reload).toHaveBeenCalledTimes(1);
    expect(screen.queryByText(/Oups/)).not.toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// 3. Erreurs globales (window « error » et « unhandledrejection »)
// ---------------------------------------------------------------------------
describe('M7 §5.1 · erreurs globales', () => {
  function rejection(reason: unknown): Event {
    return Object.assign(new Event('unhandledrejection'), { reason, promise: Promise.resolve() });
  }

  it('signale les erreurs sans rien afficher, ignore les coupures réseau et recharge une fois sur morceau introuvable', async () => {
    configureMonitoring({ stage: 'production', endpoint: ENDPOINT });
    const fetchSpy = mockFetch();
    const reload = vi.spyOn(pageReload, 'reload').mockImplementation(() => undefined);
    const uninstall = installGlobalErrorHandlers();
    try {
      act(() => {
        window.dispatchEvent(new ErrorEvent('error', { error: new Error('Erreur globale (test)'), message: 'Erreur globale (test)' }));
        window.dispatchEvent(rejection(new Error('Promesse rejetée (test)')));
        // Coupure réseau : un état du réseau, pas un défaut de l'app
        window.dispatchEvent(rejection(Object.assign(new Error('Réseau indisponible'), { name: 'ApiError', status: 0 })));
        window.dispatchEvent(new ErrorEvent('error', { message: 'ResizeObserver loop completed with undelivered notifications.' }));
      });
      // Remontée chargée à la demande : envoi juste après
      await waitFor(() => expect(sentPayloads(fetchSpy)).toHaveLength(2));
      const payloads = sentPayloads(fetchSpy);
      expect(payloads.map((p) => p.message)).toEqual(['Erreur globale (test)', 'Promesse rejetée (test)']);
      expect(payloads.every((p) => p.zone === 'global')).toBe(true);
      expect(document.body).toBeEmptyDOMElement();

      act(() => {
        window.dispatchEvent(rejection(new TypeError(CHUNK_MESSAGE)));
        window.dispatchEvent(rejection(new TypeError(CHUNK_MESSAGE)));
      });
      expect(reload).toHaveBeenCalledTimes(1);
      // Le deuxième n'a pas pu recharger : il est signalé
      await waitFor(() => expect(sentPayloads(fetchSpy).at(-1)).toMatchObject({ zone: 'chunk' }));
    } finally {
      uninstall();
    }
  });
});

// ---------------------------------------------------------------------------
// 4. Remontée des erreurs (src/lib/monitoring.ts)
// ---------------------------------------------------------------------------
describe('M7 §5.2 · reportError', () => {
  it('envoie une charge utile nettoyée : numéro masqué, jeton, e-mail et paramètres absents', () => {
    configureMonitoring({ stage: 'production', endpoint: ENDPOINT });
    const fetchSpy = mockFetch();
    window.history.pushState({}, '', '/reservations/RES-000124?token=abc123&tel=690000001#paiement');

    const error = new Error(
      'Échec pour +237 6 90 00 00 01 (Bearer eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxIn0.c2lnbmF0dXJl) ' +
        'sur https://api.boutique.test/me?token=secret123&phone=690000001 · contact junior@example.com · tél. 690 00 00 01',
    );
    error.stack = [
      `Error: ${error.message}`,
      '    at pay (https://boutique.test/assets/PaymentPage-abc.js?v=1730000000000:10:5)',
      ...Array.from({ length: 30 }, (_, i) => `    at frame${i} (https://boutique.test/assets/index-x.js:${i + 1}:2)`),
    ].join('\n');

    reportError(error, { zone: 'payment', extra: { ref: 'RES-000124', step: 2 } });

    expect(fetchSpy).toHaveBeenCalledTimes(1);
    const [url, init] = fetchSpy.mock.calls[0];
    expect(url).toBe(ENDPOINT);
    expect(init).toMatchObject({
      method: 'POST',
      keepalive: true,
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
    });

    const payload = JSON.parse(String(init?.body)) as Record<string, string>;
    expect(payload.page).toBe('/reservations/RES-000124');
    expect(payload).toMatchObject({
      appVersion: env.appVersion,
      userAgent: navigator.userAgent,
      zone: 'payment',
      extra: { ref: 'RES-000124', step: 2 },
    });
    expect(new Date(payload.occurredAt).toISOString()).toBe(payload.occurredAt);

    // Champs issus de l'erreur et de l'adresse (la date d'envoi peut contenir n'importe quels chiffres)
    const serialized = JSON.stringify([payload.message, payload.stack, payload.page, payload.extra]);
    expect(serialized).not.toMatch(/690|eyJ|secret123|abc123|junior@example\.com|\?token|token=|\?v=|#paiement/);
    expect(payload.message).toContain('+••• • •• •• •• 01');
    expect(payload.message).toContain('[e-mail]');
    expect(payload.message).toContain('Bearer [jeton]');
    expect(payload.message).toContain('https://api.boutique.test/me ·');

    const stackLines = payload.stack.split('\n');
    expect(stackLines.length).toBeLessThanOrEqual(15);
    expect(payload.stack.length).toBeLessThanOrEqual(2000);
    expect(payload.stack).toContain('https://boutique.test/assets/PaymentPage-abc.js:10:5');
  });

  it('scrub garde les références de réservation, les dates et le texte ordinaire', () => {
    expect(scrub('Réservation RES-000124 du 2026-10-31T10:00:00.000Z : 45 000 FCFA')).toBe(
      'Réservation RES-000124 du 2026-10-31T10:00:00.000Z : 45 000 FCFA',
    );
    expect(scrub('Voulez-vous continuer ?')).toBe('Voulez-vous continuer ?');
    expect(scrub('Appelez le 677889900')).toBe('Appelez le •••••••00');
    expect(scrub('accessToken: "mock-jwt-refreshed-usr-junior-01-1730000000000"')).not.toMatch(/mock-jwt|1730000/);
    expect(scrub('/recherche?q=hoodie+noir')).toBe('/recherche');
  });

  it('au plus 10 envois par session, compteur conservé dans la session', () => {
    configureMonitoring({ stage: 'production', endpoint: ENDPOINT });
    const fetchSpy = mockFetch();

    for (let i = 0; i < MAX_REPORTS_PER_SESSION + 3; i += 1) {
      reportError(new Error(`Erreur distincte n° ${i}`), { zone: `zone-${i}` });
    }
    expect(fetchSpy).toHaveBeenCalledTimes(MAX_REPORTS_PER_SESSION);
    expect(sessionStorage.getItem('drc_client_errors_count')).toBe(String(MAX_REPORTS_PER_SESSION));

    // Nouvelle page dans la même session (mémoire vide) : la limite tient toujours
    const storedCount = sessionStorage.getItem('drc_client_errors_count');
    resetMonitoring();
    sessionStorage.setItem('drc_client_errors_count', String(storedCount));
    configureMonitoring({ stage: 'production', endpoint: ENDPOINT });
    reportError(new Error('Après rechargement'));
    expect(fetchSpy).toHaveBeenCalledTimes(MAX_REPORTS_PER_SESSION);
  });

  it('une même erreur n’est envoyée qu’une fois', () => {
    configureMonitoring({ stage: 'production', endpoint: ENDPOINT });
    const fetchSpy = mockFetch();
    const sameError = new Error('Toujours la même');
    reportError(sameError, { zone: 'page' });
    reportError(sameError, { zone: 'page' });
    for (let i = 0; i < 3; i += 1) reportError(new Error('Créée en boucle'), { zone: 'page' });
    expect(sentPayloads(fetchSpy).map((p) => p.message)).toEqual(['Toujours la même', 'Créée en boucle']);
  });

  it('en développement : console lisible, aucun envoi ; en préproduction : envoi', () => {
    const fetchSpy = mockFetch();
    configureMonitoring({ stage: 'development', log: true, endpoint: ENDPOINT });
    reportError(new Error('Visible dans la console'), { zone: 'page' });
    expect(fetchSpy).not.toHaveBeenCalled();
    expect(console.error).toHaveBeenCalledWith('[Erreur · page] Visible dans la console', expect.any(Error));

    configureMonitoring({ stage: 'preproduction' });
    reportError(new Error('Envoyée en préproduction'));
    expect(sentPayloads(fetchSpy)).toHaveLength(1);
  });

  it('un envoi impossible est avalé sans erreur', async () => {
    configureMonitoring({ stage: 'production', endpoint: ENDPOINT });
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockRejectedValue(new TypeError('Failed to fetch'));
    expect(() => reportError(new Error('Serveur injoignable'))).not.toThrow();
    await waitFor(() => expect(fetchSpy).toHaveBeenCalledTimes(1));
  });
});
