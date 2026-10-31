import { lazy, Suspense, useEffect, useState, type ReactNode } from 'react';
import { Outlet, ScrollRestoration, useLocation, useNavigate, useRouteError } from 'react-router';
import { clearChunkReloadFlag, pageReload } from '@/components/errors/chunkReload';
import {
  ErrorBoundary,
  ErrorScreen,
  SafeLazy,
  type ErrorFallbackProps,
} from '@/components/errors/ErrorBoundary';
import { AppHeader } from '@/components/layout/AppHeader';
import { BottomNav } from '@/components/layout/BottomNav';
import { FloatingWhatsApp } from '@/components/layout/FloatingWhatsApp';
import { Toaster } from '@/components/ui/Toast';
import { OfflineBanner } from '@/features/offline/OfflineBanner';
import { FlyToCartLayer } from '@/features/catalog/cart-fly/FlyToCartLayer';
import { PackageReadyNotifier } from '@/features/tracking/components/PackageReadyNotifier';
import { refreshSessionSilently } from '@/lib/api/client';
import { useForegroundRefresh } from '@/lib/hooks/useForegroundRefresh';
import { useNetworkRecoveryToast } from '@/lib/hooks/useOnlineStatus';
import { SplashScreen } from '@/pwa/SplashScreen';
import { UpdateBanner } from '@/pwa/UpdateBanner';
import { useUiStore } from '@/stores/uiStore';

// Contenu « hors connexion » des zones d'erreur (M6 §6.5) : chargé seulement s'il sert
const LazyOfflineRouteFallback = lazy(() =>
  import('@/features/offline/OfflineRouteFallback').then((m) => ({
    default: m.OfflineRouteFallback,
  })),
);

const LazyOfflineScreen = lazy(() =>
  import('@/features/offline/OfflineScreen').then((m) => ({
    default: m.OfflineScreen,
  })),
);

const LazyCartDrawer = lazy(() =>
  import('@/features/cart/components/CartDrawer').then((m) => ({
    default: m.CartDrawer,
  })),
);

const LazyAuthSheet = lazy(() =>
  import('@/features/auth/components/AuthSheet').then((m) => ({
    default: m.AuthSheet,
  })),
);

// Hors du JavaScript de démarrage (budget M5/M6) : chargés juste après le premier affichage
// ou à la première ouverture.
const LazySizePicker = lazy(() =>
  import('@/components/ui/SizePicker').then((m) => ({
    default: m.SizePicker,
  })),
);

// Bandeau des réservations en attente : il dépend d'une requête réseau, son code se charge en parallèle
const LazyPendingReservationBanner = lazy(() =>
  import('@/features/reservation/components/PendingReservationBanner').then((m) => ({
    default: m.PendingReservationBanner,
  })),
);

// Pied de page : sous la ligne de flottaison sur toutes les pages, hors du JavaScript de démarrage
const LazyAppFooter = lazy(() =>
  import('@/components/layout/AppFooter').then((m) => ({
    default: m.AppFooter,
  })),
);

const LazyNotificationsBridge = lazy(() =>
  import('@/features/notifications/NotificationsBridge').then((m) => ({
    default: m.NotificationsBridge,
  })),
);

export function RouteLoadingBar() {
  return (
    <div
      role="status"
      aria-label="Chargement de la page"
      className="min-h-dvh w-full bg-white"
    >
      <div className="h-1 w-full overflow-hidden bg-surface">
        <div className="h-full w-1/2 animate-pulse bg-ink" />
      </div>
      <SplashScreen />
    </div>
  );
}

/**
 * Repli des zones « route » (plein écran) et « page » (sous l'en-tête) :
 * - morceau de code introuvable en ligne → rechargement automatique unique (M7 §5.1) ;
 * - page jamais enregistrée et réseau absent → contenu « hors connexion » (M6 §6.5) ;
 * - sinon → écran d'erreur générale (l'erreur est signalée par la zone).
 */
function LayoutErrorFallback({ variant, resolution, reset }: ErrorFallbackProps) {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const fullScreen = variant === 'route';

  if (resolution === 'offline') {
    return (
      <SafeLazy failureText="Vous êtes hors connexion.">
        {fullScreen ? (
          <LazyOfflineRouteFallback />
        ) : (
          <div className="px-page pt-4 pb-16 lg:pt-16">
            <LazyOfflineScreen className="mt-6" />
          </div>
        )}
      </SafeLazy>
    );
  }
  if (resolution === 'reloading') return <RouteLoadingBar />;

  // Déjà sur l'accueil : la zone « page » réaffiche son contenu, le routeur recharge l'app
  const goHome = () => (pathname !== '/' ? void navigate('/') : fullScreen ? pageReload.reload() : reset());
  return <ErrorScreen fullScreen={fullScreen} animated onGoHome={goHome} />;
}

const renderLayoutFallback = (props: ErrorFallbackProps) => <LayoutErrorFallback {...props} />;

/** Renvoie l'erreur du routeur à la zone d'erreur, qui décide du repli. */
function Rethrow({ error }: { error: unknown }): never {
  throw error;
}

/**
 * Erreur au niveau du routeur (page impossible à charger, erreur de la mise en page) : traitée
 * par la même zone d'erreur que le reste de l'app (rechargement unique, hors connexion, remontée).
 */
export function RouterErrorBoundary() {
  const error = useRouteError();
  return (
    <ErrorBoundary variant="route" resetKey={error} fallback={renderLayoutFallback}>
      <Rethrow error={error} />
    </ErrorBoundary>
  );
}

/**
 * Zone « page » autour de l'Outlet (M7 §5.1), réinitialisée quand le chemin change.
 * Composant à part : seul lui suit l'adresse, la mise en page ne se réaffiche pas pour autant.
 */
function PageErrorBoundary({ children }: { children: ReactNode }) {
  const { pathname } = useLocation();
  return (
    <ErrorBoundary variant="page" resetKey={pathname} fallback={renderLayoutFallback}>
      {children}
    </ErrorBoundary>
  );
}

/**
 * Rendu dans la même attente que la page : son effet ne part que lorsque la page s'est
 * vraiment affichée. Le drapeau de rechargement automatique est alors effacé (M7 §5.1).
 */
function PageDisplayed() {
  useEffect(() => {
    clearChunkReloadFlag();
  }, []);
  return null;
}

export function RootLayout() {
  const sizePickerProduct = useUiStore((s) => s.sizePickerProduct);
  const sizePickerIntent = useUiStore((s) => s.sizePickerIntent);
  const closeSizePicker = useUiStore((s) => s.closeSizePicker);
  const isCartDrawerOpen = useUiStore((s) => s.isCartDrawerOpen);
  const isAuthSheetOpen = useUiStore((s) => s.isAuthSheetOpen);
  // Le sélecteur de taille reste monté après sa première ouverture (animation de fermeture)
  const [sizePickerMounted, setSizePickerMounted] = useState(false);
  if (sizePickerProduct && !sizePickerMounted) setSizePickerMounted(true);

  useNetworkRecoveryToast();
  // Retour sur l'app après plus d'une heure : les données affichées sont rechargées (M6 §8)
  useForegroundRefresh();

  // Rafraîchissement silencieux de la session (§5.5) : au démarrage, au retour du réseau et au
  // retour sur l'app. Une coupure garde le client connecté (M6 §6) ; seul un refus du serveur
  // l'efface.
  useEffect(() => {
    const run = () => {
      void refreshSessionSilently();
    };
    const onVisible = () => {
      if (document.visibilityState === 'visible') run();
    };
    run();
    window.addEventListener('online', run);
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      window.removeEventListener('online', run);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, []);

  return (
    <div className="flex min-h-dvh flex-col bg-white text-ink">
      <a
        href="#contenu"
        className="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-[100] focus:rounded-[var(--radius-md)] focus:bg-red focus:px-4 focus:py-2.5 focus:text-small focus:font-semibold focus:text-white"
      >
        Aller au contenu
      </a>

      <AppHeader />
      <OfflineBanner />
      <Suspense fallback={null}>
        <LazyPendingReservationBanner />
      </Suspense>

      <main id="contenu" className="flex-1">
        {/* Zone « page » : une erreur de la page laisse l'en-tête et la barre du bas utilisables */}
        <PageErrorBoundary>
          <Suspense fallback={<RouteLoadingBar />}>
            <Outlet />
            <PageDisplayed />
          </Suspense>
        </PageErrorBoundary>
      </main>

      <Suspense fallback={null}>
        <LazyAppFooter />
      </Suspense>
      <BottomNav />
      <FloatingWhatsApp />
      <Toaster />
      <UpdateBanner />
      <SplashScreen />
      <PackageReadyNotifier />
      <FlyToCartLayer />

      <Suspense fallback={null}>
        <LazyNotificationsBridge />
        {sizePickerMounted && (
          <LazySizePicker
            product={sizePickerProduct}
            intent={sizePickerIntent}
            open={Boolean(sizePickerProduct)}
            onClose={closeSizePicker}
          />
        )}
        {isCartDrawerOpen && <LazyCartDrawer />}
        {isAuthSheetOpen && <LazyAuthSheet />}
      </Suspense>

      <ScrollRestoration />
    </div>
  );
}
