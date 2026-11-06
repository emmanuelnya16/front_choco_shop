import { act, fireEvent, render, renderHook, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useState, type ReactNode } from 'react';
import {
  createBrowserRouter,
  createMemoryRouter,
  Link,
  RouterProvider,
  useLocation,
  useNavigate,
  type RouteObject,
} from 'react-router';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AppProviders } from '@/app/providers';
import { BackButton } from '@/components/ui/BackButton';
import { Button } from '@/components/ui/Button';
import { Sheet } from '@/components/ui/Sheet';
import { Toaster } from '@/components/ui/Toast';
import { createAppQueryClient } from '@/lib/api/queryClient';
import {
  getOpenOverlayCount,
  getPendingBackCount,
  resetOverlayHistoryForTests,
} from '@/lib/hooks/overlayHistory';
import { hasInAppHistory } from '@/lib/hooks/useBackNavigation';
import { useBlockAppUpdate } from '@/lib/hooks/useBlockAppUpdate';
import { FOREGROUND_REFRESH_AFTER_MS, useForegroundRefresh } from '@/lib/hooks/useForegroundRefresh';
import { useOverlayHistory } from '@/lib/hooks/useOverlayHistory';
import { usePwaStore } from '@/pwa/pwaStore';
import { applyUpdate, UPDATED_FLAG_KEY } from '@/pwa/registerSW';
import {
  resetSplashForTests,
  SPLASH_EXIT_MS,
  SPLASH_LOGO_IN_MS,
  SPLASH_SHOWN_KEY,
  SPLASH_VISIBLE_MS,
} from '@/pwa/splash';
import { SplashScreen } from '@/pwa/SplashScreen';
import { UpdateBanner } from '@/pwa/UpdateBanner';
import { useAuthStore } from '@/stores/authStore';
import { useCartStore } from '@/stores/cartStore';
import { useToastStore } from '@/stores/toastStore';
import { useUiStore } from '@/stores/uiStore';

vi.mock('@/pwa/registerSW', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/pwa/registerSW')>();
  return { ...actual, applyUpdate: vi.fn() };
});

const BANNER_TEXT = 'Une nouvelle version est disponible';

function resetPwaStore() {
  usePwaStore.setState({ registered: true, updateReady: false, applying: false, busyCount: 0 });
}

/** Attend la fin des retours d'historique asynchrones (jsdom traverse l'historique dans une tâche). */
async function settleHistory() {
  await waitFor(() => expect(getPendingBackCount()).toBe(0));
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 20));
  });
}

function currentMarker(): unknown {
  const state = window.history.state as Record<string, unknown> | null;
  return state?.drcOverlay;
}

// ---------------------------------------------------------------------------------------------
describe('M6 · modeapp · 1. Bandeau de mise à jour', () => {
  beforeEach(() => {
    resetPwaStore();
    useToastStore.getState().clear();
    useCartStore.getState().clear();
    sessionStorage.clear();
  });

  afterEach(() => {
    resetPwaStore();
  });

  function renderBannerAt(path: string) {
    const router = createMemoryRouter([{ path: '*', element: <UpdateBanner /> }], {
      initialEntries: [path],
    });
    render(
      <AppProviders client={createAppQueryClient()}>
        <RouterProvider router={router} />
      </AppProviders>,
    );
    return router;
  }

  it('propose la nouvelle version sur les écrans ordinaires', async () => {
    usePwaStore.setState({ updateReady: true });
    renderBannerAt('/explorer');
    expect(await screen.findByText(BANNER_TEXT)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Mettre à jour' }));
    // registerSW est chargé à l'appui (hors du JavaScript de démarrage)
    await waitFor(() => expect(applyUpdate).toHaveBeenCalledTimes(1));
  });

  it.each(['/reservation', '/reservation/RES-000102/paiement', '/reservation/RES-000102/preuve'])(
    'ne la propose jamais sur %s',
    async (path) => {
      usePwaStore.setState({ updateReady: true });
      renderBannerAt(path);
      await act(async () => undefined);
      expect(screen.queryByText(BANNER_TEXT)).not.toBeInTheDocument();
    },
  );

  it('se retire pendant une action en cours puis revient à la fin', async () => {
    usePwaStore.setState({ updateReady: true });
    renderBannerAt('/');
    expect(await screen.findByText(BANNER_TEXT)).toBeInTheDocument();

    const { rerender, unmount } = renderHook(({ active }) => useBlockAppUpdate(active), {
      initialProps: { active: true },
    });
    expect(usePwaStore.getState().busyCount).toBe(1);
    await waitFor(() => expect(screen.queryByText(BANNER_TEXT)).not.toBeInTheDocument());

    rerender({ active: false });
    expect(usePwaStore.getState().busyCount).toBe(0);
    expect(await screen.findByText(BANNER_TEXT)).toBeInTheDocument();
    unmount();
  });

  it('peut être masqué jusqu’au prochain lancement', async () => {
    usePwaStore.setState({ updateReady: true });
    renderBannerAt('/profil');
    fireEvent.click(await screen.findByRole('button', { name: 'Masquer jusqu’au prochain lancement' }));
    await waitFor(() => expect(screen.queryByText(BANNER_TEXT)).not.toBeInTheDocument());
  });

  it('reste caché sans nouvelle version', async () => {
    renderBannerAt('/');
    await act(async () => undefined);
    expect(screen.queryByText(BANNER_TEXT)).not.toBeInTheDocument();
  });

  it('affiche « Application mise à jour » une seule fois après le rechargement', async () => {
    sessionStorage.setItem(UPDATED_FLAG_KEY, '1');
    renderBannerAt('/');
    await waitFor(() =>
      expect(useToastStore.getState().toasts.map((t) => t.message)).toEqual(['Application mise à jour']),
    );
    expect(sessionStorage.getItem(UPDATED_FLAG_KEY)).toBeNull();
  });
});

// ---------------------------------------------------------------------------------------------
describe('M6 · modeapp · 2. Historique des surcouches (touche retour)', () => {
  beforeEach(async () => {
    // jsdom traite history.back() de façon asynchrone : sous forte charge, un retour lancé par le
    // test précédent peut encore être en file (le délai de sécurité de 1,2 s l'a déjà compté comme
    // terminé). On le laisse s'exécuter AVANT de repartir d'une entrée propre, sinon il ramènerait
    // ce test une page trop loin.
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 30));
    });
    resetOverlayHistoryForTests('/');
  });

  afterEach(async () => {
    await settleHistory();
  });

  function SheetHarness({ onClose }: { onClose?: () => void }) {
    const [open, setOpen] = useState(false);
    return (
      <>
        <button type="button" onClick={() => setOpen(true)}>
          Ouvrir
        </button>
        <Sheet
          open={open}
          onClose={() => {
            onClose?.();
            setOpen(false);
          }}
          title="Feuille de test"
        >
          <p>Contenu</p>
        </Sheet>
      </>
    );
  }

  function renderWithoutRouter(ui: ReactNode) {
    return render(<AppProviders client={createAppQueryClient()}>{ui}</AppProviders>);
  }

  it('ajoute une entrée à l’ouverture, et la touche retour ferme la feuille', async () => {
    const onClose = vi.fn();
    renderWithoutRouter(<SheetHarness onClose={onClose} />);
    const lengthBefore = window.history.length;

    fireEvent.click(screen.getByRole('button', { name: 'Ouvrir' }));
    expect(await screen.findByRole('dialog', { name: 'Feuille de test' })).toBeInTheDocument();
    expect(window.history.length).toBe(lengthBefore + 1);
    expect(currentMarker()).toEqual(expect.any(Number));

    act(() => window.history.back());
    await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(currentMarker()).toBeUndefined();
    expect(getOpenOverlayCount()).toBe(0);
  });

  it('une fermeture par l’interface retire l’entrée sans rappeler onClose', async () => {
    const onClose = vi.fn();
    renderWithoutRouter(<SheetHarness onClose={onClose} />);

    fireEvent.click(screen.getByRole('button', { name: 'Ouvrir' }));
    await screen.findByRole('dialog', { name: 'Feuille de test' });
    fireEvent.click(screen.getByRole('button', { name: 'Fermer la fenêtre' }));

    await settleHistory();
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(currentMarker()).toBeUndefined();
  });

  it('Échap appelle onClose une seule fois, même si le parent garde la feuille ouverte', async () => {
    const onClose = vi.fn();
    renderWithoutRouter(
      <Sheet open onClose={onClose} title="Toujours ouverte">
        <p>Contenu</p>
      </Sheet>,
    );
    fireEvent.keyDown(window, { key: 'Escape' });
    await settleHistory();
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(currentMarker()).toEqual(expect.any(Number));
  });

  it('la feuille qui refuse de se fermer (envoi en cours) retrouve son entrée', async () => {
    const onClose = vi.fn();
    renderWithoutRouter(
      <Sheet open onClose={onClose} title="Envoi en cours">
        <p>Contenu</p>
      </Sheet>,
    );
    await waitFor(() => expect(currentMarker()).toEqual(expect.any(Number)));

    act(() => window.history.back());
    await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1));
    // Le parent garde la feuille : une nouvelle entrée est ajoutée, le retour suivant la fermera
    await waitFor(() => expect(currentMarker()).toEqual(expect.any(Number)));
    expect(getOpenOverlayCount()).toBe(1);
  });

  describe('avec le routeur de données (createBrowserRouter)', () => {
    let router: ReturnType<typeof createBrowserRouter> | null = null;

    afterEach(() => {
      router?.dispose();
      router = null;
    });

    function PageWithSheet() {
      const navigate = useNavigate();
      const [open, setOpen] = useState(false);
      return (
        <>
          <h1>Page A</h1>
          <button type="button" onClick={() => setOpen(true)}>
            Choisir
          </button>
          <Sheet open={open} onClose={() => setOpen(false)} title="Choix">
            <button
              type="button"
              onClick={() => {
                // Même enchaînement que SizePicker : fermeture puis navigation immédiate
                setOpen(false);
                void navigate('/b');
              }}
            >
              Valider et continuer
            </button>
          </Sheet>
        </>
      );
    }

    function renderBrowserRouter(routes: RouteObject[]) {
      router = createBrowserRouter(routes);
      render(
        <AppProviders client={createAppQueryClient()}>
          <RouterProvider router={router} />
        </AppProviders>,
      );
      return router;
    }

    const routes: RouteObject[] = [
      { path: '/a', element: <PageWithSheet /> },
      { path: '/b', element: <h1>Page B</h1> },
    ];

    it('fermer par la touche retour ne déclenche aucune navigation du routeur', async () => {
      resetOverlayHistoryForTests('/a');
      const r = renderBrowserRouter(routes);
      const keyBefore = r.state.location.key;
      fireEvent.click(await screen.findByRole('button', { name: 'Choisir' }));
      await screen.findByRole('dialog', { name: 'Choix' });

      // Toute mise à jour de l'état du routeur pendant le retour serait une navigation parasite
      const routerUpdates: string[] = [];
      const unsubscribe = r.subscribe((state) => routerUpdates.push(state.historyAction));
      act(() => window.history.back());

      await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
      await settleHistory();
      unsubscribe();
      expect(routerUpdates).toEqual([]);
      expect(r.state.location.pathname).toBe('/a');
      expect(r.state.location.key).toBe(keyBefore);
      expect(window.location.pathname).toBe('/a');
    });

    it('fermer puis naviguer aussitôt : la navigation aboutit, et un seul retour ramène à la page', async () => {
      resetOverlayHistoryForTests('/a');
      const r = renderBrowserRouter(routes);

      fireEvent.click(await screen.findByRole('button', { name: 'Choisir' }));
      await screen.findByRole('dialog', { name: 'Choix' });
      fireEvent.click(screen.getByRole('button', { name: 'Valider et continuer' }));

      expect(await screen.findByRole('heading', { name: 'Page B' })).toBeInTheDocument();
      await settleHistory();
      expect(r.state.location.pathname).toBe('/b');
      expect(window.location.pathname).toBe('/b');

      act(() => window.history.back());
      expect(await screen.findByRole('heading', { name: 'Page A' })).toBeInTheDocument();
      await settleHistory();
      expect(window.location.pathname).toBe('/a');
      expect(currentMarker()).toBeUndefined();
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });

    /** Même enchaînement que CartDrawer : fermeture du tiroir puis requireAuth(navigate), puis consumeAuthAction. */
    function CartWithDrawer() {
      const navigate = useNavigate();
      const isDrawerOpen = useUiStore((s) => s.isCartDrawerOpen);
      const closeDrawer = useUiStore((s) => s.closeCartDrawer);
      const isAuthOpen = useUiStore((s) => s.isAuthSheetOpen);
      useOverlayHistory(isDrawerOpen, closeDrawer);
      return (
        <>
          <h1>Mon panier</h1>
          <button type="button" onClick={() => useUiStore.getState().openCartDrawer()}>
            Aperçu du panier
          </button>
          {isDrawerOpen && (
            <div role="dialog" aria-label="Aperçu de mon panier">
              <button
                type="button"
                onClick={() => {
                  closeDrawer();
                  useUiStore.getState().requireAuth(() => {
                    void navigate('/reservation');
                  });
                }}
              >
                Réserver
              </button>
            </div>
          )}
          <Sheet
            open={isAuthOpen}
            onClose={() => useUiStore.getState().closeAuthSheet(true)}
            title="Connexion"
          >
            <button type="button" onClick={() => useUiStore.getState().consumeAuthAction()}>
              Valider le code
            </button>
          </Sheet>
        </>
      );
    }

    it('tiroir puis connexion puis navigation : chaque surcouche a son entrée, la navigation aboutit', async () => {
      useAuthStore.getState().clearSession();
      useUiStore.setState({ isCartDrawerOpen: false, isAuthSheetOpen: false, pendingAuthAction: null });
      resetOverlayHistoryForTests('/panier');
      const r = renderBrowserRouter([
        { path: '/panier', element: <CartWithDrawer /> },
        { path: '/reservation', element: <h1>Finaliser la réservation</h1> },
      ]);

      fireEvent.click(await screen.findByRole('button', { name: 'Aperçu du panier' }));
      await screen.findByRole('dialog', { name: 'Aperçu de mon panier' });
      await waitFor(() => expect(currentMarker()).toEqual(expect.any(Number)));
      const drawerMarker = currentMarker();

      // Le tiroir se ferme (retrait de son entrée) et la connexion s'ouvre aussitôt (nouvelle entrée)
      fireEvent.click(screen.getByRole('button', { name: 'Réserver' }));
      await screen.findByRole('dialog', { name: 'Connexion' });
      await settleHistory();
      expect(currentMarker()).toEqual(expect.any(Number));
      expect(currentMarker()).not.toBe(drawerMarker);
      expect(getOpenOverlayCount()).toBe(1);

      // Code validé : la connexion se ferme et l'action en attente (navigation) est reprise
      fireEvent.click(screen.getByRole('button', { name: 'Valider le code' }));
      expect(await screen.findByRole('heading', { name: 'Finaliser la réservation' })).toBeInTheDocument();
      await settleHistory();
      expect(r.state.location.pathname).toBe('/reservation');
      expect(window.location.pathname).toBe('/reservation');

      // Un seul retour ramène au panier, sans surcouche rouverte
      act(() => window.history.back());
      expect(await screen.findByRole('heading', { name: 'Mon panier' })).toBeInTheDocument();
      await settleHistory();
      expect(window.location.pathname).toBe('/panier');
      expect(currentMarker()).toBeUndefined();
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });

    /** Comme le méga-menu : ouvert pour une adresse, fermé dès que l'adresse change (lien suivi). */
    function PageWithMenu() {
      const location = useLocation();
      const [openPath, setOpenPath] = useState<string | null>(null);
      const open = openPath === location.pathname;
      useOverlayHistory(open, () => setOpenPath(null));
      return (
        <>
          <h1>Accueil boutique</h1>
          <button type="button" onClick={() => setOpenPath(location.pathname)}>
            Catégories
          </button>
          {open && (
            <nav aria-label="Catégories de la boutique">
              <Link to="/explorer/t-shirts">T-shirts</Link>
            </nav>
          )}
        </>
      );
    }

    it('lien suivi depuis le menu : un seul retour ramène à la page, menu fermé', async () => {
      resetOverlayHistoryForTests('/');
      const r = renderBrowserRouter([
        { path: '/', element: <PageWithMenu /> },
        { path: '/explorer/t-shirts', element: <h1>T-shirts</h1> },
      ]);

      fireEvent.click(await screen.findByRole('button', { name: 'Catégories' }));
      await waitFor(() => expect(currentMarker()).toEqual(expect.any(Number)));
      fireEvent.click(await screen.findByRole('link', { name: 'T-shirts' }));
      expect(await screen.findByRole('heading', { name: 'T-shirts' })).toBeInTheDocument();
      await settleHistory();
      expect(r.state.location.pathname).toBe('/explorer/t-shirts');

      act(() => window.history.back());
      expect(await screen.findByRole('heading', { name: 'Accueil boutique' })).toBeInTheDocument();
      await settleHistory();
      expect(r.state.location.pathname).toBe('/');
      expect(window.location.pathname).toBe('/');
      expect(currentMarker()).toBeUndefined();
      expect(screen.queryByRole('navigation', { name: 'Catégories de la boutique' })).not.toBeInTheDocument();
    });
  });
});

// ---------------------------------------------------------------------------------------------
describe('M6 · modeapp · 3. Flèche retour (logique unique)', () => {
  let router: ReturnType<typeof createBrowserRouter> | null = null;

  beforeEach(() => {
    resetOverlayHistoryForTests('/');
  });

  afterEach(async () => {
    router?.dispose();
    router = null;
    await settleHistory();
  });

  function Detail() {
    return (
      <>
        <h1>Détail</h1>
        <BackButton fallback="/liste" label="Mes réservations" />
      </>
    );
  }

  function Start() {
    const navigate = useNavigate();
    return (
      <>
        <h1>Accueil</h1>
        <button type="button" onClick={() => void navigate('/detail')}>
          Voir le détail
        </button>
      </>
    );
  }

  const routes: RouteObject[] = [
    { path: '/', element: <Start /> },
    { path: '/detail', element: <Detail /> },
    { path: '/liste', element: <h1>Liste</h1> },
    {
      path: '/merci',
      element: <BackButton fallback="/liste" parentOnly label="Suivi" />,
    },
  ];

  function renderAt(path: string) {
    resetOverlayHistoryForTests(path);
    router = createBrowserRouter(routes);
    render(
      <AppProviders client={createAppQueryClient()}>
        <RouterProvider router={router} />
      </AppProviders>,
    );
    return router;
  }

  it('lit l’index de React Router pour savoir si un écran précédent existe', () => {
    window.history.replaceState({ idx: 2, key: 'abc' }, '');
    expect(hasInAppHistory()).toBe(true);
    window.history.replaceState({ idx: 0, key: 'abc' }, '');
    expect(hasInAppHistory()).toBe(false);
    window.history.replaceState(null, '');
    expect(hasInAppHistory()).toBe(false);
  });

  it('revient à l’écran précédent de l’app quand il existe', async () => {
    const r = renderAt('/');
    fireEvent.click(await screen.findByRole('button', { name: 'Voir le détail' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Mes réservations' }));
    expect(await screen.findByRole('heading', { name: 'Accueil' })).toBeInTheDocument();
    expect(r.state.location.pathname).toBe('/');
  });

  it('va au parent quand la page est ouverte directement (lien profond, notification)', async () => {
    const r = renderAt('/detail');
    fireEvent.click(await screen.findByRole('button', { name: 'Mes réservations' }));
    expect(await screen.findByRole('heading', { name: 'Liste' })).toBeInTheDocument();
    expect(r.state.location.pathname).toBe('/liste');
    // Le parent remplace la page : la touche retour ne ramène pas sur le détail
    expect(r.state.historyAction).toBe('REPLACE');
  });

  it('va toujours au parent sur un écran de fin de parcours', async () => {
    const r = renderAt('/');
    await act(async () => {
      await r.navigate('/merci');
    });
    fireEvent.click(await screen.findByRole('button', { name: 'Suivi' }));
    expect(await screen.findByRole('heading', { name: 'Liste' })).toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------------------------
describe('M6 · modeapp · 4. Écran de lancement', () => {
  const originalMatchMedia = window.matchMedia;

  function emulateMedia(matching: (query: string) => boolean) {
    window.matchMedia = vi.fn().mockImplementation((query: string) => ({
      matches: matching(query),
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })) as unknown as typeof window.matchMedia;
  }

  beforeEach(() => {
    resetSplashForTests();
    sessionStorage.clear();
  });

  afterEach(() => {
    window.matchMedia = originalMatchMedia;
    resetSplashForTests();
  });

  function renderSplash() {
    return render(
      <AppProviders client={createAppQueryClient()}>
        <SplashScreen />
      </AppProviders>,
    );
  }

  it('jamais en navigation web classique', () => {
    renderSplash();
    expect(screen.queryByTestId('splash-screen')).not.toBeInTheDocument();
  });

  it('une fois par lancement dans l’app installée, moins d’une seconde', async () => {
    // Durées imposées : apparition de 0,6 s au plus, disparition complète avant 1 s
    expect(SPLASH_LOGO_IN_MS).toBeLessThanOrEqual(600);
    expect(SPLASH_VISIBLE_MS + SPLASH_EXIT_MS).toBeLessThan(1000);

    emulateMedia((query) => query.includes('display-mode: standalone'));
    renderSplash();
    expect(screen.getByTestId('splash-screen')).toBeInTheDocument();
    expect(sessionStorage.getItem(SPLASH_SHOWN_KEY)).toBe('1');
    // Marge large pour une machine chargée : la durée réelle est garantie par les constantes
    await waitFor(() => expect(screen.queryByTestId('splash-screen')).not.toBeInTheDocument(), {
      timeout: 3000,
    });

    // Même lancement (sessionStorage conservé) : plus jamais affiché
    resetSplashForTests();
    renderSplash();
    expect(screen.queryByTestId('splash-screen')).not.toBeInTheDocument();
  });

  it('jamais avec les animations réduites', () => {
    emulateMedia(
      (query) => query.includes('display-mode: standalone') || query.includes('prefers-reduced-motion'),
    );
    renderSplash();
    expect(screen.queryByTestId('splash-screen')).not.toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------------------------
describe('M6 · modeapp · 5. Liens externes, zones de sécurité, premier plan', () => {
  function renderInRouter(ui: ReactNode) {
    const router = createMemoryRouter([{ path: '*', element: ui }]);
    return render(
      <AppProviders client={createAppQueryClient()}>
        <RouterProvider router={router} />
      </AppProviders>,
    );
  }

  it('Button ouvre tel: et mailto: dans l’application concernée, WhatsApp dans un nouvel onglet', () => {
    renderInRouter(
      <>
        <Button href="tel:+237600000000">Appeler la boutique</Button>
        <Button href="mailto:contact@drchoco.cm">Écrire</Button>
        <Button href="https://wa.me/237600000000">WhatsApp</Button>
        <Button href="/explorer">Explorer</Button>
      </>,
    );
    const tel = screen.getByRole('link', { name: 'Appeler la boutique' });
    expect(tel).toHaveAttribute('href', 'tel:+237600000000');
    expect(tel).not.toHaveAttribute('target');
    expect(screen.getByRole('link', { name: 'Écrire' })).not.toHaveAttribute('target');
    const whatsapp = screen.getByRole('link', { name: 'WhatsApp' });
    expect(whatsapp).toHaveAttribute('target', '_blank');
    expect(whatsapp).toHaveAttribute('rel', 'noopener noreferrer');
    expect(screen.getByRole('link', { name: 'Explorer' })).toHaveAttribute('href', '/explorer');
  });

  it('les surcouches basses ajoutent la zone de sécurité à leur marge au lieu de la remplacer', async () => {
    useToastStore.getState().show({ message: 'Ajouté au panier' });
    renderInRouter(
      <>
        <Toaster />
        <Sheet open onClose={() => undefined} title="Zone sûre">
          <p>Contenu</p>
        </Sheet>
      </>,
    );
    const toastRegion = (await screen.findByText('Ajouté au panier')).closest('[aria-live]');
    // Pile commune du bas d'écran : les toasts partent de --bottom-bar-h, qui contient la zone sûre
    expect(toastRegion?.className).toContain('var(--bottom-bar-h)');
    const css = readFileSync(resolve(process.cwd(), 'src/styles/index.css'), 'utf8');
    expect(css).toContain('--bottom-bar-h: env(safe-area-inset-bottom, 0px);');
    expect(css).toContain('--bottom-bar-h: calc(var(--bottom-nav-h) + env(safe-area-inset-bottom, 0px));');
    const panel = screen.getByRole('heading', { name: 'Zone sûre' }).closest('.z-10');
    expect(panel?.className).toContain('pb-[calc(20px+env(safe-area-inset-bottom,0px))]');
    expect(panel?.className).not.toMatch(/(^|\s)pb-safe(\s|$)/);
    useToastStore.getState().clear();
    await settleHistory();
  });

  describe('retour au premier plan', () => {
    let visibility: DocumentVisibilityState = 'visible';

    beforeEach(() => {
      visibility = 'visible';
      Object.defineProperty(document, 'visibilityState', {
        configurable: true,
        get: () => visibility,
      });
    });

    afterEach(() => {
      vi.useRealTimers();
      Reflect.deleteProperty(document, 'visibilityState');
    });

    function setVisibility(next: DocumentVisibilityState) {
      visibility = next;
      document.dispatchEvent(new Event('visibilitychange'));
    }

    function renderForegroundHook() {
      const client = new QueryClient();
      const invalidate = vi.spyOn(client, 'invalidateQueries').mockResolvedValue(undefined);
      renderHook(() => useForegroundRefresh(), {
        wrapper: ({ children }) => <QueryClientProvider client={client}>{children}</QueryClientProvider>,
      });
      return invalidate;
    }

    it('recharge les données affichées après plus d’une heure en arrière-plan', () => {
      vi.useFakeTimers({ toFake: ['Date'] });
      vi.setSystemTime(new Date('2026-10-30T08:00:00Z'));
      const invalidate = renderForegroundHook();

      setVisibility('hidden');
      vi.setSystemTime(new Date(Date.now() + FOREGROUND_REFRESH_AFTER_MS + 1000));
      setVisibility('visible');
      expect(invalidate).toHaveBeenCalledWith({ type: 'active' });
    });

    it('ne recharge rien après une courte absence', () => {
      vi.useFakeTimers({ toFake: ['Date'] });
      vi.setSystemTime(new Date('2026-10-30T08:00:00Z'));
      const invalidate = renderForegroundHook();

      setVisibility('hidden');
      vi.setSystemTime(new Date(Date.now() + 5 * 60 * 1000));
      setVisibility('visible');
      expect(invalidate).not.toHaveBeenCalled();
    });
  });
});
