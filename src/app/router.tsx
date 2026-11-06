import { createBrowserRouter, createMemoryRouter, type RouteObject } from 'react-router';
import { env } from '@/lib/env';
import { PageRouterErrorBoundary, RootLayout, RouteLoadingBar, RouterErrorBoundary } from './layouts/RootLayout';

/**
 * Page de contrôle /_dev compilée seulement si elle peut servir : en développement, ou si le build le
 * demande (VITE_ENABLE_DEV_PAGE=true, mocks actifs). Comparaisons directes à import.meta.env : un build
 * de production propre (VITE_API_MOCK=false, VITE_ENABLE_DEV_PAGE=false) n'émet plus ses morceaux.
 * Le choix à l'exécution reste celui de env.enableDevPage.
 */
const DEV_PAGE_COMPILED =
  import.meta.env.DEV ||
  import.meta.env.VITE_ENABLE_DEV_PAGE === 'true' ||
  import.meta.env.VITE_API_MOCK !== 'false';

/** Pages de l'app, affichées dans la mise en page commune (en-tête, barre basse, pied de page). */
const pageRoutes: RouteObject[] = [
  {
    index: true,
    lazy: async () => {
      const { HomePage } = await import('@/pages/HomePage');
      return { Component: HomePage };
    },
  },
  {
    path: 'explorer',
    lazy: async () => {
      const { ExplorePage } = await import('@/pages/ExplorePage');
      return { Component: ExplorePage };
    },
  },
  {
    path: 'explorer/:category',
    lazy: async () => {
      const { ExplorePage } = await import('@/pages/ExplorePage');
      return { Component: ExplorePage };
    },
  },
  {
    path: 'categorie/:category',
    lazy: async () => {
      const { ExplorePage } = await import('@/pages/ExplorePage');
      return { Component: ExplorePage };
    },
  },
  // Centre d'aide et pages d'aide (M7 §3.2)
  {
    path: 'aide',
    lazy: async () => {
      const { HelpCenterPage } = await import('@/pages/HelpCenterPage');
      return { Component: HelpCenterPage };
    },
  },
  {
    path: 'aide/:slug',
    lazy: async () => {
      const { HelpContentPage } = await import('@/pages/ContentPage');
      return { Component: HelpContentPage };
    },
  },
  {
    path: 'recherche',
    lazy: async () => {
      const { SearchPage } = await import('@/pages/SearchPage');
      return { Component: SearchPage };
    },
  },
  {
    path: 'produit/:slug',
    lazy: async () => {
      const { ProductPage } = await import('@/pages/ProductPage');
      return { Component: ProductPage };
    },
  },
  {
    path: 'favoris',
    lazy: async () => {
      const { FavoritesPage } = await import('@/pages/FavoritesPage');
      return { Component: FavoritesPage };
    },
  },
  {
    path: 'panier',
    lazy: async () => {
      const { CartPage } = await import('@/pages/CartPage');
      return { Component: CartPage };
    },
  },
  {
    path: 'reservation',
    lazy: async () => {
      const { CheckoutPage } = await import('@/pages/CheckoutPage');
      return { Component: CheckoutPage };
    },
  },
  {
    path: 'reservation/:ref/paiement',
    lazy: async () => {
      const { PaymentPage } = await import('@/pages/PaymentPage');
      return { Component: PaymentPage };
    },
  },
  {
    path: 'reservation/:ref/preuve',
    lazy: async () => {
      const { ProofPage } = await import('@/pages/ProofPage');
      return { Component: ProofPage };
    },
  },
  {
    path: 'reservation/:ref/merci',
    lazy: async () => {
      const { SuccessPage } = await import('@/pages/SuccessPage');
      return { Component: SuccessPage };
    },
  },
  {
    path: 'reservations',
    lazy: async () => {
      const { ReservationsPage } = await import('@/pages/ReservationsPage');
      return { Component: ReservationsPage };
    },
  },
  {
    path: 'reservations/:ref',
    lazy: async () => {
      const { ReservationDetailPage } = await import('@/pages/ReservationDetailPage');
      return { Component: ReservationDetailPage };
    },
  },
  {
    path: 'profil',
    lazy: async () => {
      const { ProfilePage } = await import('@/pages/ProfilePage');
      return { Component: ProfilePage };
    },
  },
  {
    path: 'profil/adresses',
    lazy: async () => {
      const { ProfileAddressesPage } = await import('@/pages/ProfileAddressesPage');
      return { Component: ProfileAddressesPage };
    },
  },
  {
    path: 'profil/informations',
    lazy: async () => {
      const { ProfileInformationsPage } = await import('@/pages/ProfileInformationsPage');
      return { Component: ProfileInformationsPage };
    },
  },
  // Pages légales (M7 §3.2)
  {
    path: 'pages/:slug',
    lazy: async () => {
      const { LegalContentPage } = await import('@/pages/ContentPage');
      return { Component: LegalContentPage };
    },
  },
  {
    path: 'hors-ligne',
    lazy: async () => {
      const { OfflinePage } = await import('@/pages/OfflinePage');
      return { Component: OfflinePage };
    },
  },
  ...(DEV_PAGE_COMPILED && env.enableDevPage
    ? [
        {
          path: '_dev',
          lazy: async () => {
            const { DevPage } = await import('@/dev/DevPage');
            return { Component: DevPage };
          },
        },
      ]
    : []),
  {
    path: '*',
    lazy: async () => {
      const { NotFoundPage } = await import('@/pages/NotFoundPage');
      return { Component: NotFoundPage };
    },
  },
];

/** Routes de l’espace d’administration (/admin), isolées dans les chunks `assets/admin-*`. */
const adminRoutes: RouteObject[] = [
  {
    path: '/admin/connexion',
    ErrorBoundary: RouterErrorBoundary,
    HydrateFallback: RouteLoadingBar,
    lazy: async () => {
      const { default: AdminLoginPage } = await import('@/pages/admin/AdminLoginPage');
      return { Component: AdminLoginPage };
    },
  },
  {
    path: '/admin',
    ErrorBoundary: RouterErrorBoundary,
    HydrateFallback: RouteLoadingBar,
    lazy: async () => {
      const { default: AdminRootShell } = await import('@/pages/admin/AdminRootShell');
      return { Component: AdminRootShell };
    },
    children: [
      {
        index: true,
        lazy: async () => {
          const { default: AdminDashboardPage } = await import(
            '@/pages/admin/AdminDashboardPage'
          );
          return { Component: AdminDashboardPage };
        },
      },
      {
        path: 'reservations',
        lazy: async () => {
          const { default: AdminReservationsPage } = await import(
            '@/pages/admin/AdminReservationsPage'
          );
          return { Component: AdminReservationsPage };
        },
      },
      {
        path: 'reservations/:ref',
        lazy: async () => {
          const { default: AdminReservationDetailPage } = await import(
            '@/pages/admin/AdminReservationDetailPage'
          );
          return { Component: AdminReservationDetailPage };
        },
      },
      {
        path: 'catalogue',
        lazy: async () => {
          const { default: AdminCatalogPage } = await import(
            '@/pages/admin/AdminCatalogPage'
          );
          return { Component: AdminCatalogPage };
        },
      },
      {
        path: 'catalogue/nouveau',
        lazy: async () => {
          const { default: AdminProductEditPage } = await import(
            '@/pages/admin/AdminProductEditPage'
          );
          return { Component: AdminProductEditPage };
        },
      },
      {
        path: 'catalogue/:id',
        lazy: async () => {
          const { default: AdminProductEditPage } = await import(
            '@/pages/admin/AdminProductEditPage'
          );
          return { Component: AdminProductEditPage };
        },
      },
      {
        path: 'categories',
        lazy: async () => {
          const { default: AdminCategoriesLooksPage } = await import(
            '@/pages/admin/AdminCategoriesLooksPage'
          );
          return { Component: AdminCategoriesLooksPage };
        },
      },
      {
        path: 'looks',
        lazy: async () => {
          const { default: AdminCategoriesLooksPage } = await import(
            '@/pages/admin/AdminCategoriesLooksPage'
          );
          return { Component: AdminCategoriesLooksPage };
        },
      },
      {
        path: 'contenus',
        lazy: async () => {
          const { default: AdminContentPagesPage } = await import(
            '@/pages/admin/AdminContentPagesPage'
          );
          return { Component: AdminContentPagesPage };
        },
      },
      {
        path: 'parametres/*',
        lazy: async () => {
          const { default: AdminSettingsPage } = await import(
            '@/pages/admin/AdminSettingsPage'
          );
          return { Component: AdminSettingsPage };
        },
      },
      {
        path: 'clients',
        lazy: async () => {
          const { default: AdminCustomersPage } = await import(
            '@/pages/admin/AdminCustomersPage'
          );
          return { Component: AdminCustomersPage };
        },
      },
    ],
  },
];

export const appRoutes: RouteObject[] = [
  ...adminRoutes,
  {
    path: '/',
    Component: RootLayout,
    ErrorBoundary: RouterErrorBoundary,
    HydrateFallback: RouteLoadingBar,
    children: [
      // Page impossible à charger : l'erreur s'affiche sous l'en-tête, la coquille reste visible (M7)
      { ErrorBoundary: PageRouterErrorBoundary, children: pageRoutes },
    ],
  },
];

export const router = createBrowserRouter(appRoutes);

export function createTestRouter(initialEntries: string[] = ['/']) {
  return createMemoryRouter(appRoutes, { initialEntries });
}
