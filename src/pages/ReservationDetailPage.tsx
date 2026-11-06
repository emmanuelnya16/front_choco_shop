import { useQueryClient } from '@tanstack/react-query';
import { AlertCircle, Copy, Download, SearchX, WifiOff } from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { useLocation, useParams } from 'react-router';
import { BackButton } from '@/components/ui/BackButton';
import { Button } from '@/components/ui/Button';
import { Price, Skeleton } from '@/components/ui/Primitives';
import { usePublicSettings } from '@/features/catalog/api/useCatalogQueries';
import { ProductLightbox, type LightboxImage } from '@/features/catalog/product/ProductLightbox';
import { useLastUpdateLabel } from '@/features/offline/lastUpdate';
import { isNetworkError } from '@/features/offline/networkErrors';
import { OfflineScreen } from '@/features/offline/OfflineScreen';
import { useReservation } from '@/features/reservation/api/useReservationQueries';
import {
  findReservationInListCache,
  TRACKING_POLL_INTERVAL_MS,
} from '@/features/tracking/api/useTrackingQueries';
import { ReservationStatusBadge } from '@/features/tracking/components/ReservationStatusBadge';
import { ActionBlock } from '@/features/tracking/detail/ActionBlock';
import { CancelSheet } from '@/features/tracking/detail/CancelSheet';
import {
  HelpSection,
  ItemsSection,
  PaymentSection,
  ReceptionSection,
} from '@/features/tracking/detail/DetailSections';
import { PackagePhotos } from '@/features/tracking/detail/PackagePhotos';
import { TrackingTimeline } from '@/features/tracking/detail/TrackingTimeline';
import { formatHour, formatShortDate } from '@/features/tracking/format';
import {
  savePackagePhoto,
  toLightboxImages,
  useSignedUrlRefresh,
} from '@/features/tracking/packagePhotos';
import { useSeenStore } from '@/features/tracking/seenStore';
import { resolveShopWhatsapp } from '@/features/tracking/shopWhatsapp';
import {
  buildTimelineSteps,
  isLocalDelivery,
  lastSeenStepIndex,
  timelineStepLabel,
} from '@/features/tracking/timeline';
import { ApiError } from '@/lib/api/client';
import { endpoints } from '@/lib/api/endpoints';
import { useOnlineStatus } from '@/lib/hooks/useOnlineStatus';
import { haptic } from '@/lib/utils/haptics';
import { useDocumentTitle } from '@/lib/utils/useDocumentTitle';
import { useAuthStore } from '@/stores/authStore';
import { useToastStore } from '@/stores/toastStore';
import { useUiStore } from '@/stores/uiStore';
import { hasPackagePhotos, type PublicSettings, type Reservation } from '@/types/domain';

export function ReservationDetailPage() {
  const { ref = '' } = useParams<{ ref: string }>();
  const reservationRef = ref.trim().toUpperCase();
  useDocumentTitle(`Réservation ${reservationRef}`);

  const status = useAuthStore((s) => s.status);
  const user = useAuthStore((s) => s.user);

  if (status === 'authenticated') {
    return <DetailContent key={reservationRef} reservationRef={reservationRef} />;
  }
  if (status === 'unknown' && user) {
    return <DetailLoading reservationRef={reservationRef} />;
  }
  return <DetailGuest reservationRef={reservationRef} />;
}

function PageFrame({ children }: { children: ReactNode }) {
  return <div className="mx-auto w-full max-w-content px-page pt-4 pb-12 lg:pt-8">{children}</div>;
}

function BackLink() {
  // Logique de retour unique (M6 §8) : écran précédent de l'app, sinon « Mes réservations »
  return <BackButton fallback="/reservations" label="Mes réservations" />;
}

/** Non connecté : la feuille de connexion s'ouvre par-dessus, puis la réservation s'affiche (§5.5 M5). */
function DetailGuest({ reservationRef }: { reservationRef: string }) {
  const openAuthSheet = useUiStore((s) => s.openAuthSheet);
  const openedRef = useRef(false);

  useEffect(() => {
    if (openedRef.current) return;
    openedRef.current = true;
    openAuthSheet();
  }, [openAuthSheet]);

  return (
    <PageFrame>
      <BackLink />
      <h1 className="mt-3 font-mono text-h2 text-ink">{reservationRef}</h1>
      <p className="mt-4 max-w-md text-body text-text-2">
        Connectez-vous avec votre numéro pour voir le suivi de cette réservation.
      </p>
      <Button variant="primary" size="lg" className="mt-5" onClick={() => openAuthSheet()}>
        Me connecter
      </Button>
    </PageFrame>
  );
}

/** Chargement : données partielles de la liste si elles sont en cache, squelettes pour le reste (§5.5 M5). */
function DetailLoading({ reservationRef }: { reservationRef: string }) {
  const queryClient = useQueryClient();
  const [partial] = useState(() => findReservationInListCache(queryClient, reservationRef));

  return (
    <PageFrame>
      <BackLink />
      <div
        className="mt-3 flex flex-col items-start gap-2 sm:flex-row sm:justify-between sm:gap-3"
        aria-busy="true"
      >
        <div>
          <h1 className="font-mono text-h2 text-ink">{reservationRef}</h1>
          {partial ? (
            <p className="mt-1 text-small text-text-2">Réservée le {formatShortDate(partial.createdAt)}</p>
          ) : (
            <Skeleton className="mt-2 h-4 w-44" />
          )}
        </div>
        {partial ? <ReservationStatusBadge status={partial.status} size="md" /> : <Skeleton className="h-8 w-32 rounded-[var(--radius-full)]" />}
      </div>
      <div className="mt-6 grid gap-6 lg:grid-cols-[3fr_2fr] lg:gap-8">
        <div className="space-y-6">
          <Skeleton className="h-44 w-full" />
          <div className="space-y-5">
            {[0, 1, 2, 3].map((i) => (
              <div key={i} className="flex gap-4">
                <Skeleton className="h-6 w-6 rounded-[var(--radius-full)]" />
                <Skeleton className="h-10 flex-1" />
              </div>
            ))}
          </div>
        </div>
        <div className="space-y-4">
          {partial && (
            <div className="rounded-[var(--radius-md)] border border-silver/70 p-5">
              <p className="text-label text-text-2">Total</p>
              <Price amount={partial.amount.total} className="mt-1 block text-h3 text-ink" />
            </div>
          )}
          <Skeleton className="h-40 w-full" />
          <Skeleton className="h-32 w-full" />
        </div>
      </div>
    </PageFrame>
  );
}

function DetailContent({ reservationRef }: { reservationRef: string }) {
  const query = useReservation(reservationRef, { live: true, intervalMs: TRACKING_POLL_INTERVAL_MS });
  const settingsQuery = usePublicSettings();
  const lastUpdateLabel = useLastUpdateLabel(
    endpoints.reservations.detail(reservationRef),
    query.dataUpdatedAt,
  );

  if (query.data) {
    return (
      <DetailView
        reservation={query.data}
        settings={settingsQuery.data}
        onRefresh={query.refetch}
        lastUpdateLabel={lastUpdateLabel}
      />
    );
  }

  // Réservation jamais consultée sur ce téléphone et réseau absent (M6 §6.5)
  if (query.isError && isNetworkError(query.error)) {
    return (
      <PageFrame>
        <BackLink />
        <OfflineScreen className="mt-6" onRetry={() => query.refetch()} />
      </PageFrame>
    );
  }

  if (query.isError) {
    const notFound = query.error instanceof ApiError && query.error.status === 404;
    return (
      <PageFrame>
        <BackLink />
        <div className="mt-8 flex flex-col items-center rounded-[var(--radius-md)] bg-surface px-6 py-12 text-center">
          {notFound ? (
            <SearchX className="h-7 w-7 text-ink" aria-hidden="true" />
          ) : (
            <AlertCircle className="h-7 w-7 text-red" aria-hidden="true" />
          )}
          <h1 className="mt-3 text-h2 text-ink">
            {notFound ? 'Réservation introuvable' : 'Impossible d’afficher cette réservation'}
          </h1>
          <p className="mt-2 max-w-sm text-small text-text-2">
            {notFound
              ? `Aucune réservation ${reservationRef} n’est associée à votre compte.`
              : 'Un problème est survenu de notre côté. Réessayez dans quelques instants.'}
          </p>
          {notFound ? (
            <Button variant="dark" size="md" href="/reservations" className="mt-5">
              Voir mes réservations
            </Button>
          ) : (
            <Button variant="dark" size="md" className="mt-5" onClick={() => void query.refetch()}>
              Réessayer
            </Button>
          )}
        </div>
      </PageFrame>
    );
  }

  return <DetailLoading reservationRef={reservationRef} />;
}

interface ViewerState {
  images: LightboxImage[];
  index: number;
  label: string;
  /** Nom de fichier de base pour « Enregistrer la photo » (photos du colis uniquement). */
  saveBaseName?: string;
}

function DetailView({
  reservation,
  settings,
  onRefresh,
  lastUpdateLabel,
}: {
  reservation: Reservation;
  settings?: PublicSettings;
  onRefresh: () => unknown;
  /** « Mis à jour le … » : affiché hors connexion (dernier état connu, M6 §6.3). */
  lastUpdateLabel?: string | null;
}) {
  const ref = reservation.ref;
  const online = useOnlineStatus();
  const showToast = useToastStore((s) => s.show);
  const markSeen = useSeenStore((s) => s.markSeen);
  const markPhotosRevealed = useSeenStore((s) => s.markPhotosRevealed);
  const photosRevealed = useSeenStore((s) => Boolean(s.byRef[reservation.ref]?.photosRevealed));
  const location = useLocation();
  const refreshSignedUrls = useSignedUrlRefresh(onRefresh);
  const activeTransitionRef = useUiStore((s) => s.activeReservationTransitionRef);
  const setActiveTransitionRef = useUiStore((s) => s.setActiveReservationTransitionRef);

  const steps = useMemo(() => buildTimelineSteps(reservation), [reservation]);
  const localDelivery = isLocalDelivery(reservation);
  const stepLabel = (status: Reservation['status']) => timelineStepLabel(status, { localDelivery });

  // Statut vu lors de la dernière visite, figé à l'ouverture (§3.4 M5)
  const [seenAtOpen] = useState(() => useSeenStore.getState().byRef[ref]);
  const [trackedStatus, setTrackedStatus] = useState(reservation.status);
  const [liveChanged, setLiveChanged] = useState(false);
  const [animateFrom, setAnimateFrom] = useState<number | null>(() => {
    if (!seenAtOpen) return -1; // première ouverture : toute la frise se remplit
    if (seenAtOpen.status === reservation.status) return null; // rien de nouveau : affichage direct
    return lastSeenStepIndex(steps, seenAtOpen.status); // seule la portion nouvelle
  });

  // Changement de statut détecté pendant que l'écran est ouvert (§8.1 M5)
  if (reservation.status !== trackedStatus) {
    setAnimateFrom(lastSeenStepIndex(steps, trackedStatus));
    setTrackedStatus(reservation.status);
    setLiveChanged(true);
  }

  // Changement fait par le client lui-même (annulation) : pas de « Nouvelle étape », il a déjà son message
  const [selfChangeStatus, setSelfChangeStatus] = useState<Reservation['status'] | null>(null);
  const changedSinceLastVisit = Boolean(seenAtOpen && seenAtOpen.status !== reservation.status);
  const newStepMessage = `Nouvelle étape\u00A0: ${stepLabel(trackedStatus)}`;
  // Annonce vocale déduite de l'état (§9.2 M5) : changement depuis la dernière visite ou en direct
  const announcement =
    liveChanged || changedSinceLastVisit
      ? selfChangeStatus === trackedStatus
        ? `Réservation ${ref} annulée`
        : newStepMessage
      : '';

  const openToastDoneRef = useRef(false);
  const lastAnnouncedRef = useRef<Reservation['status']>(reservation.status);

  // À l'ouverture : nouvelle étape depuis la dernière visite
  useEffect(() => {
    if (openToastDoneRef.current) return;
    openToastDoneRef.current = true;
    if (changedSinceLastVisit) showToast({ message: newStepMessage });
    // Ouverture uniquement
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // En direct : message et vibration, sauf pour un changement fait par le client lui-même
  useEffect(() => {
    if (lastAnnouncedRef.current === trackedStatus) return;
    lastAnnouncedRef.current = trackedStatus;
    if (selfChangeStatus === trackedStatus) return;
    showToast({ message: newStepMessage });
    haptic('success');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [trackedStatus]);

  // La réservation est « vue » : le point « Nouveau » et le repère de l'onglet disparaissent
  useEffect(() => {
    markSeen(ref, reservation.status, reservation.updatedAt);
  }, [markSeen, ref, reservation.status, reservation.updatedAt]);

  // Titre partagé avec la carte touchée (transition de vue), conservé pour le retour à la liste
  useEffect(() => {
    setActiveTransitionRef(ref);
  }, [ref, setActiveTransitionRef]);

  const [viewer, setViewer] = useState<ViewerState | null>(null);
  const closeViewer = useCallback(() => setViewer(null), []);
  const photos = reservation.packagePhotos;
  const showPackage = hasPackagePhotos(reservation);

  const openPackagePhoto = (index: number) =>
    setViewer({
      label: 'Photos de votre colis',
      index,
      images: toLightboxImages(photos),
      saveBaseName: `colis-${ref}`,
    });

  const savePhoto = async (url: string, index: number, baseName: string) => {
    const outcome = await savePackagePhoto(url, `${baseName}-${index + 1}`);
    if (outcome === 'downloaded') showToast({ message: 'Photo enregistrée' });
    if (outcome === 'opened') showToast({ message: 'Photo ouverte dans un nouvel onglet' });
  };

  // « Voir mon colis » (#colis) : défile jusqu'au bloc photo une fois affiché
  useEffect(() => {
    if (location.hash !== '#colis' || !showPackage) return;
    const id = window.requestAnimationFrame(() =>
      document.getElementById('colis')?.scrollIntoView({ block: 'start' }),
    );
    return () => window.cancelAnimationFrame(id);
  }, [location.hash, showPackage]);
  const [cancelOpen, setCancelOpen] = useState(false);
  const whatsappNumber = resolveShopWhatsapp(settings?.whatsappNumber);

  const copyRef = async () => {
    try {
      await navigator.clipboard.writeText(ref);
      haptic('light');
      showToast({ message: `Référence ${ref} copiée` });
    } catch {
      showToast({ message: `Référence\u00A0: ${ref}` });
    }
  };

  const openProof = () => {
    if (!reservation.proof) return;
    setViewer({
      label: 'Preuve de paiement envoyée',
      index: 0,
      images: [
        {
          url: reservation.proof.thumbnailUrl,
          fallbackUrl: reservation.proof.thumbnailUrl,
          alt: 'Preuve de paiement envoyée à la boutique',
          ratio: '3/4',
          fit: 'contain',
        },
      ],
    });
  };

  return (
    <PageFrame>
      <BackLink />

      {/* Pastille de statut toujours au même endroit : sous la date sur mobile, à droite dès 640 px */}
      <header className="mt-3 flex flex-col items-start gap-2 sm:flex-row sm:justify-between sm:gap-3">
        <div className="min-w-0">
          <h1>
            <button
              type="button"
              onClick={() => void copyRef()}
              aria-label={`Référence ${ref}, appuyez pour copier`}
              style={activeTransitionRef === ref ? { viewTransitionName: `res-${ref}` } : undefined}
              className="inline-flex min-h-11 items-center gap-2 font-mono text-h2 text-ink"
            >
              {ref}
              <Copy className="h-4 w-4 text-text-2" aria-hidden="true" />
            </button>
          </h1>
          <p className="text-small text-text-2">
            Réservée le {formatShortDate(reservation.createdAt)} à {formatHour(reservation.createdAt)}
          </p>
        </div>
        <ReservationStatusBadge status={reservation.status} size="md" animateChange={liveChanged} />
      </header>

      <p role="status" aria-live="polite" className="sr-only">
        {announcement}
      </p>

      {!online && (
        <div
          role="status"
          className="mt-4 flex items-start gap-2.5 rounded-[var(--radius-md)] bg-surface px-4 py-3 text-small text-ink"
        >
          <WifiOff className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
          <span>
            Hors connexion&nbsp;: dernier état connu de votre réservation.
            {lastUpdateLabel && (
              <span className="mt-0.5 block text-caption text-text-2">{lastUpdateLabel}.</span>
            )}
          </span>
        </div>
      )}

      <div className="mt-5 grid gap-6 lg:grid-cols-[3fr_2fr] lg:items-start lg:gap-8">
        <div className="min-w-0 space-y-6">
          <ActionBlock reservation={reservation} settings={settings} animateChange={liveChanged} />

          {showPackage && (
            <PackagePhotos
              photos={photos}
              packageReadyAt={reservation.packageReadyAt}
              status={reservation.status}
              receptionMode={reservation.receptionMode}
              alreadyRevealed={photosRevealed}
              onRevealed={() => markPhotosRevealed(ref, reservation.status, reservation.updatedAt)}
              onOpenViewer={openPackagePhoto}
              onPhotoFailure={refreshSignedUrls}
            />
          )}

          <section aria-labelledby="suivi-titre" className="rounded-[var(--radius-md)] border border-silver/70 bg-white p-5 sm:p-6">
            <h2 id="suivi-titre" className="text-label text-text-2">
              Suivi
            </h2>
            <div className="mt-4">
              <TrackingTimeline
                steps={steps}
                animateFromIndex={animateFrom}
                packageThumbUrl={photos[0]?.thumbnailUrl}
                onOpenPackagePhoto={() => openPackagePhoto(0)}
              />
            </div>
          </section>
        </div>

        <div className="min-w-0 space-y-4 lg:sticky lg:top-[calc(var(--desktop-shell-top)+4rem)]">
          <ItemsSection reservation={reservation} />
          <ReceptionSection reservation={reservation} settings={settings} />
          <PaymentSection reservation={reservation} onOpenProof={openProof} />
          <HelpSection
            reservation={reservation}
            whatsappNumber={whatsappNumber}
            onRequestCancel={() => setCancelOpen(true)}
          />
        </div>
      </div>

      <CancelSheet
        open={cancelOpen}
        onClose={() => setCancelOpen(false)}
        reservation={reservation}
        whatsappNumber={whatsappNumber}
        onConfirm={() => setSelfChangeStatus('cancelled')}
        onFailed={() => setSelfChangeStatus(null)}
        onCancelled={() => {
          setCancelOpen(false);
          haptic('success');
          showToast({ message: `Réservation ${ref} annulée` });
        }}
      />

      <ProductLightbox
        open={Boolean(viewer)}
        onClose={closeViewer}
        images={viewer?.images ?? []}
        initialIndex={viewer?.index ?? 0}
        productName={ref}
        label={viewer?.label}
        renderActions={
          viewer?.saveBaseName
            ? (image, index) => (
                <button
                  type="button"
                  onClick={() => void savePhoto(image.url, index, viewer.saveBaseName!)}
                  className="inline-flex h-11 items-center gap-2 rounded-[var(--radius-full)] bg-ink-2 px-4 text-small font-semibold text-white hover:bg-white/20"
                >
                  <Download className="h-4 w-4" aria-hidden="true" />
                  Enregistrer la photo
                </button>
              )
            : undefined
        }
      />
    </PageFrame>
  );
}
