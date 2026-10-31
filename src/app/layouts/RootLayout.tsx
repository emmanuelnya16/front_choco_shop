import { AlertCircle, ArrowLeft } from 'lucide-react';
import { lazy, Suspense, useEffect } from 'react';
import { Link, Outlet, ScrollRestoration, useRouteError } from 'react-router';
import { AppFooter } from '@/components/layout/AppFooter';
import { AppHeader } from '@/components/layout/AppHeader';
import { BottomNav } from '@/components/layout/BottomNav';
import { FloatingWhatsApp } from '@/components/layout/FloatingWhatsApp';
import { SizePicker } from '@/components/ui/SizePicker';
import { Toaster } from '@/components/ui/Toast';
import { FlyToCartLayer } from '@/features/catalog/cart-fly/FlyToCartLayer';
import { OfflineBanner } from '@/features/offline/OfflineBanner';
import { OfflineRouteFallback } from '@/features/offline/OfflineRouteFallback';
import { useIsOfflineChunkError } from '@/features/offline/useOfflineChunkError';
import { PendingReservationBanner } from '@/features/reservation/components/PendingReservationBanner';
import { PackageReadyNotifier } from '@/features/tracking/components/PackageReadyNotifier';
import { refreshSessionSilently } from '@/lib/api/client';
import { useNetworkRecoveryToast } from '@/lib/hooks/useOnlineStatus';
import { useUiStore } from '@/stores/uiStore';

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
    </div>
  );
}

export function RouterErrorBoundary() {
  const error = useRouteError();
  // Page jamais enregistrée et réseau absent : contenu « hors connexion » plutôt qu'une erreur (M6 §6.5)
  const offlineChunk = useIsOfflineChunkError(error);
  if (offlineChunk) return <OfflineRouteFallback />;
  const message =
    error instanceof Error ? error.message : 'Une erreur inattendue est survenue.';

  return (
    <main className="mx-auto flex min-h-dvh max-w-content flex-col items-start justify-center px-page py-12">
      <div className="max-w-lg rounded-[var(--radius-md)] border border-silver bg-surface p-6">
        <div className="flex items-center gap-2 text-danger">
          <AlertCircle className="h-5 w-5 shrink-0" aria-hidden="true" />
          <span className="text-label">ERREUR D&apos;APPLICATION</span>
        </div>
        <h1 className="mt-2 text-h1 text-ink">Oups, quelque chose s&apos;est mal passé</h1>
        <p className="mt-2 text-small text-text-2">{message}</p>
        <Link
          to="/"
          className="mt-6 inline-flex min-h-[44px] items-center gap-2 rounded-[var(--radius-md)] bg-ink px-5 py-2.5 text-small font-bold text-white"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden="true" />
          Revenir à l&apos;accueil
        </Link>
      </div>
    </main>
  );
}

export function RootLayout() {
  const sizePickerProduct = useUiStore((s) => s.sizePickerProduct);
  const sizePickerIntent = useUiStore((s) => s.sizePickerIntent);
  const closeSizePicker = useUiStore((s) => s.closeSizePicker);
  const isCartDrawerOpen = useUiStore((s) => s.isCartDrawerOpen);
  const isAuthSheetOpen = useUiStore((s) => s.isAuthSheetOpen);

  useNetworkRecoveryToast();

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
      <PendingReservationBanner />

      <main id="contenu" className="flex-1">
        <Suspense fallback={<RouteLoadingBar />}>
          <Outlet />
        </Suspense>
      </main>

      <AppFooter />
      <BottomNav />
      <FloatingWhatsApp />
      <Toaster />
      <PackageReadyNotifier />
      <FlyToCartLayer />

      <SizePicker
        product={sizePickerProduct}
        intent={sizePickerIntent}
        open={Boolean(sizePickerProduct)}
        onClose={closeSizePicker}
      />

      <Suspense fallback={null}>
        {isCartDrawerOpen && <LazyCartDrawer />}
        {isAuthSheetOpen && <LazyAuthSheet />}
      </Suspense>

      <ScrollRestoration />
    </div>
  );
}
