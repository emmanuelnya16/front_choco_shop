import { createBrowserRouter, createMemoryRouter, type RouteObject } from 'react-router';
import { env } from '@/lib/env';
import { RootLayout, RouteLoadingBar, RouterErrorBoundary } from './layouts/RootLayout';

export const appRoutes: RouteObject[] = [
  {
    path: '/',
    Component: RootLayout,
    ErrorBoundary: RouterErrorBoundary,
    HydrateFallback: RouteLoadingBar,
    children: [
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
      {
        path: 'aide',
        lazy: async () => {
          const { LegalPage } = await import('@/pages/LegalPage');
          return { Component: LegalPage };
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
      {
        path: 'pages/:slug',
        lazy: async () => {
          const { LegalPage } = await import('@/pages/LegalPage');
          return { Component: LegalPage };
        },
      },
      {
        path: 'hors-ligne',
        lazy: async () => {
          const { OfflinePage } = await import('@/pages/OfflinePage');
          return { Component: OfflinePage };
        },
      },
      ...(env.enableDevPage
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
    ],
  },
];

export const router = createBrowserRouter(appRoutes);

export function createTestRouter(initialEntries: string[] = ['/']) {
  return createMemoryRouter(appRoutes, { initialEntries });
}
