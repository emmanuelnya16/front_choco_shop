import { useQueryClient } from '@tanstack/react-query';
import { AnimatePresence } from 'motion/react';
import * as m from 'motion/react-m';
import { AlertCircle, RefreshCw, WifiOff } from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { useSearchParams } from 'react-router';
import { Button } from '@/components/ui/Button';
import { Skeleton } from '@/components/ui/Primitives';
import { useLastUpdateLabel } from '@/features/offline/lastUpdate';
import { isNetworkError } from '@/features/offline/networkErrors';
import { OfflineScreen } from '@/features/offline/OfflineScreen';
import { useReservationsInfinite } from '@/features/tracking/api/useTrackingQueries';
import { ParcelIllustration } from '@/features/tracking/components/ParcelIllustration';
import { PullToRefresh } from '@/features/tracking/components/PullToRefresh';
import {
  ReservationCard,
  ReservationCardSkeleton,
} from '@/features/tracking/components/ReservationCard';
import { useOnlineStatus } from '@/lib/hooks/useOnlineStatus';
import { endpoints } from '@/lib/api/endpoints';
import { qk } from '@/lib/api/queryKeys';
import { cn } from '@/lib/utils/cn';
import { useDocumentTitle } from '@/lib/utils/useDocumentTitle';
import { fadeUp } from '@/motion/presets';
import { duration, ease, spring } from '@/motion/tokens';
import { useAuthStore } from '@/stores/authStore';
import { useUiStore } from '@/stores/uiStore';
import type { ReservationListItem, ReservationScope } from '@/types/api';

const TAB_PARAM = 'onglet';
const TABS: Array<{ scope: ReservationScope; label: string; param: string }> = [
  { scope: 'active', label: 'En cours', param: 'en-cours' },
  { scope: 'done', label: 'Terminées', param: 'terminees' },
];

export function ReservationsPage() {
  useDocumentTitle('Mes réservations');
  const user = useAuthStore((s) => s.user);
  const status = useAuthStore((s) => s.status);

  if (status === 'authenticated') {
    return <ReservationsContent />;
  }
  // Session en cours de restauration (profil connu, jeton en cours de rafraîchissement)
  if (status === 'unknown' && user) {
    return <ReservationsLoadingShell />;
  }
  return <ReservationsGuest />;
}

function PageFrame({ children }: { children: ReactNode }) {
  return (
    <div className="mx-auto w-full max-w-content px-page pt-6 pb-10 lg:pt-10">
      {children}
    </div>
  );
}

function ReservationsGuest() {
  const openAuthSheet = useUiStore((s) => s.openAuthSheet);

  return (
    <PageFrame>
      <h1 className="text-h1 text-ink">Mes réservations</h1>
      <div className="mt-10 flex flex-col items-center text-center">
        <ParcelIllustration className="text-silver" />
        <p className="mt-6 max-w-sm text-body text-text-2">
          Connectez-vous avec votre numéro pour suivre vos réservations.
        </p>
        <Button variant="primary" size="lg" className="mt-6" onClick={() => openAuthSheet()}>
          Me connecter
        </Button>
      </div>
    </PageFrame>
  );
}

function ReservationsLoadingShell() {
  return (
    <PageFrame>
      <h1 className="text-h1 text-ink">Mes réservations</h1>
      <Skeleton className="mt-6 h-11 w-full max-w-sm" />
      <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        <ReservationCardSkeleton />
        <ReservationCardSkeleton />
      </div>
    </PageFrame>
  );
}

function ReservationsContent() {
  const queryClient = useQueryClient();
  const online = useOnlineStatus();
  const [searchParams, setSearchParams] = useSearchParams();
  const scope: ReservationScope = searchParams.get(TAB_PARAM) === 'terminees' ? 'done' : 'active';
  const [direction, setDirection] = useState(1);

  const query = useReservationsInfinite(scope);
  // Dernier état connu hors connexion (M6 §6.3) : date de la dernière réponse du serveur
  const lastUpdateLabel = useLastUpdateLabel(
    endpoints.reservations.listScoped(scope, 1),
    query.dataUpdatedAt,
  );
  const items = useMemo(() => {
    // Une réservation qui vient de changer peut glisser d'une page à l'autre entre deux chargements
    const seen = new Set<string>();
    return (query.data?.pages.flatMap((page) => page.items) ?? []).filter((item) => {
      if (seen.has(item.ref)) return false;
      seen.add(item.ref);
      return true;
    });
  }, [query.data]);
  const counts = query.data?.pages[0]?.counts;

  const selectTab = (next: ReservationScope) => {
    if (next === scope) return;
    setDirection(next === 'done' ? 1 : -1);
    const nextParams = new URLSearchParams(searchParams);
    nextParams.set(TAB_PARAM, TABS.find((t) => t.scope === next)!.param);
    // Remplace l'entrée d'historique : « Retour » quitte la page au lieu de rebasculer d'onglet
    setSearchParams(nextParams, { replace: true });
  };

  const refresh = useCallback(
    () =>
      Promise.all([
        query.refetch(),
        queryClient.invalidateQueries({ queryKey: qk.reservationsSummary() }),
      ]),
    [query, queryClient],
  );

  return (
    <PullToRefresh onRefresh={refresh} disabled={!online}>
      <PageFrame>
        <div className="flex items-center justify-between gap-4">
          <h1 className="text-h1 text-ink">Mes réservations</h1>
          <Button
            variant="ghost"
            size="sm"
            className="hidden lg:inline-flex"
            iconLeft={<RefreshCw className={cn('h-4 w-4', query.isRefetching && 'animate-spin')} />}
            onClick={() => void refresh()}
            disabled={!online}
          >
            Actualiser
          </Button>
        </div>

        {/* Sans statut enregistré, le contenu « hors connexion » de la liste explique la situation */}
        {!online && query.data && (
          <div
            role="status"
            className="mt-4 flex items-start gap-2.5 rounded-[var(--radius-md)] bg-surface px-4 py-3 text-small text-ink"
          >
            <WifiOff className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
            <span>
              Hors connexion : statuts affichés depuis votre dernière visite.
              {lastUpdateLabel && (
                <span className="mt-0.5 block text-xs text-text-2">{lastUpdateLabel}.</span>
              )}
            </span>
          </div>
        )}

        {/* Onglets */}
        <div
          role="tablist"
          aria-label="Réservations en cours ou terminées"
          className="mt-6 flex border-b border-silver/70"
        >
          {TABS.map((tab) => {
            const selected = tab.scope === scope;
            const count = counts?.[tab.scope];
            return (
              <button
                key={tab.scope}
                id={`tab-${tab.scope}`}
                type="button"
                role="tab"
                aria-selected={selected}
                aria-controls={`panel-${tab.scope}`}
                tabIndex={selected ? 0 : -1}
                onClick={() => selectTab(tab.scope)}
                onKeyDown={(event) => {
                  if (event.key === 'ArrowRight' || event.key === 'ArrowLeft') {
                    event.preventDefault();
                    const next = tab.scope === 'active' ? 'done' : 'active';
                    selectTab(next);
                    document.getElementById(`tab-${next}`)?.focus();
                  }
                }}
                className={cn(
                  'relative min-h-[44px] flex-1 px-2 pb-3 text-[15px] font-semibold transition-colors sm:flex-none sm:px-5',
                  selected ? 'text-ink' : 'text-text-2 [@media(hover:hover)]:hover:text-ink',
                )}
              >
                {tab.label}
                {typeof count === 'number' && (
                  <>
                    {' '}
                    <span className="tabular-nums">({count})</span>
                  </>
                )}
                {selected && (
                  <m.span
                    layoutId="reservations-tab-indicator"
                    transition={spring.snappy}
                    className="absolute right-0 -bottom-px left-0 h-[2px] bg-ink"
                  />
                )}
              </button>
            );
          })}
        </div>

        <AnimatePresence mode="wait" initial={false} custom={direction}>
          <m.div
            key={scope}
            id={`panel-${scope}`}
            role="tabpanel"
            aria-labelledby={`tab-${scope}`}
            custom={direction}
            variants={{
              enter: (dir: number) => ({ x: dir * 24, opacity: 0 }),
              center: { x: 0, opacity: 1 },
              exit: (dir: number) => ({ x: dir * -24, opacity: 0 }),
            }}
            initial="enter"
            animate="center"
            exit="exit"
            transition={{ duration: duration.fast, ease: ease.out }}
            className="mt-5"
          >
            <ReservationsPanel scope={scope} query={query} items={items} />
          </m.div>
        </AnimatePresence>
      </PageFrame>
    </PullToRefresh>
  );
}

type InfiniteQuery = ReturnType<typeof useReservationsInfinite>;

function ReservationsPanel({
  scope,
  query,
  items,
}: {
  scope: ReservationScope;
  query: InfiniteQuery;
  items: ReservationListItem[];
}) {
  const sentinelRef = useRef<HTMLDivElement | null>(null);
  const [observerSupported] = useState(() => typeof IntersectionObserver !== 'undefined');
  const { hasNextPage, isFetchingNextPage, fetchNextPage } = query;

  // Chargement progressif : la page suivante se charge à 600 px de la fin
  useEffect(() => {
    const node = sentinelRef.current;
    if (!node || !observerSupported || !hasNextPage) return undefined;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting) && !isFetchingNextPage) {
          void fetchNextPage();
        }
      },
      { rootMargin: '600px 0px' },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [observerSupported, hasNextPage, isFetchingNextPage, fetchNextPage]);

  if (query.isPending) {
    return (
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        <ReservationCardSkeleton />
        <ReservationCardSkeleton />
        <ReservationCardSkeleton />
      </div>
    );
  }

  // Liste jamais chargée sur ce téléphone et réseau absent : contenu « hors connexion » (M6 §6.5)
  if (query.isError && items.length === 0 && isNetworkError(query.error)) {
    return <OfflineScreen headingLevel="h2" onRetry={() => query.refetch()} className="py-4" />;
  }

  if (query.isError && items.length === 0) {
    return (
      <div className="flex flex-col items-center rounded-[var(--radius-md)] bg-surface px-6 py-10 text-center">
        <AlertCircle className="h-6 w-6 text-red" aria-hidden="true" />
        <p className="mt-3 text-body font-semibold text-ink">Impossible de charger vos réservations.</p>
        <p className="mt-1 text-small text-text-2">Vérifiez votre connexion puis réessayez.</p>
        <Button variant="dark" size="md" className="mt-5" onClick={() => void query.refetch()}>
          Réessayer
        </Button>
      </div>
    );
  }

  if (items.length === 0) {
    return scope === 'active' ? (
      <div className="flex flex-col items-center px-4 py-10 text-center">
        <ParcelIllustration className="text-silver" />
        <p className="mt-6 text-h3 text-ink">Aucune réservation en cours</p>
        <Button variant="dark" size="md" href="/explorer" className="mt-5">
          Découvrir la collection
        </Button>
      </div>
    ) : (
      <p className="px-4 py-12 text-center text-body text-text-2">
        Vos réservations terminées apparaîtront ici.
      </p>
    );
  }

  return (
    <>
      {query.isError && (
        <div
          role="alert"
          className="mb-4 flex items-center justify-between gap-3 rounded-[var(--radius-md)] border border-red bg-white px-4 py-3 text-small text-ink"
        >
          <span>La mise à jour a échoué. Les statuts affichés peuvent dater un peu.</span>
          <Button variant="outline" size="sm" onClick={() => void query.refetch()}>
            Réessayer
          </Button>
        </div>
      )}

      {/* HYPOTHÈSE: trois colonnes dès 1280 px (cartes d'environ 400 px, comme les deux colonnes de la
          tablette) plutôt que deux cartes de 600 px dans le conteneur de 1280 px. */}
      <ul className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {items.map((item, index) => (
          <m.li
            key={item.ref}
            layout
            variants={fadeUp}
            initial="hidden"
            animate="visible"
            transition={{ delay: (index % 10) * 0.04, layout: spring.sheet }}
          >
            <ReservationCard item={item} />
          </m.li>
        ))}
        {isFetchingNextPage && (
          <>
            <li>
              <ReservationCardSkeleton />
            </li>
            <li>
              <ReservationCardSkeleton />
            </li>
          </>
        )}
      </ul>

      <div ref={sentinelRef} aria-hidden="true" className="h-px" />

      {hasNextPage && !isFetchingNextPage && !observerSupported && (
        <div className="mt-6 flex justify-center">
          <Button variant="outline" size="md" onClick={() => void fetchNextPage()}>
            Charger plus de réservations
          </Button>
        </div>
      )}
    </>
  );
}
