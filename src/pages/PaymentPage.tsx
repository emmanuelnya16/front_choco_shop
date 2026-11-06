import { AnimatePresence } from 'motion/react';
import * as m from 'motion/react-m';
import {
  AlertCircle,
  AlertTriangle,
  ArrowRight,
  Check,
  CheckCircle2,
  ChevronDown,
  Copy,
  Download,
  MessageCircle,
  Phone,
  QrCode,
  RefreshCw,
} from 'lucide-react';
import { type ReactNode, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import { BackButton } from '@/components/ui/BackButton';
import { Button } from '@/components/ui/Button';
import { Container, Price } from '@/components/ui/Primitives';
import { Sheet } from '@/components/ui/Sheet';
import { SmartImage } from '@/components/ui/SmartImage';
import { frenchSpacing } from '@/features/content/markdown/typography';
import { isNetworkError } from '@/features/offline/networkErrors';
import { OfflineScreen } from '@/features/offline/OfflineScreen';
import {
  useCancelReservation,
  usePaymentSettings,
} from '@/features/payment/api/usePaymentQueries';
import { ReservationExpiredOverlay } from '@/features/payment/components/ReservationExpiredOverlay';
import { buildWhatsAppQuestionUrl } from '@/features/payment/whatsapp';
import {
  buildUssdCode,
  buildUssdTelHref,
  formatRawAmountForClipboard,
  isIosDevice,
} from '@/features/payment/utils/ussd';
import { useReservation } from '@/features/reservation/api/useReservationQueries';
import { CheckoutStepper } from '@/features/reservation/components/CheckoutStepper';
import { HoldCountdown } from '@/features/reservation/components/HoldCountdown';
import { ApiError } from '@/lib/api/client';
import { useOnlineStatus } from '@/lib/hooks/useOnlineStatus';
import { cn } from '@/lib/utils/cn';
import { haptic } from '@/lib/utils/haptics';
import { detectCmOperator } from '@/lib/utils/operator';
import { formatPrice } from '@/lib/utils/price';
import { useDocumentTitle } from '@/lib/utils/useDocumentTitle';
import { delay, duration, ease, spring, staggerSlow, staggerStep } from '@/motion/tokens';
import { useReducedMotionPref } from '@/motion/useReducedMotionPref';
import { useAuthStore } from '@/stores/authStore';
import { useToastStore } from '@/stores/toastStore';
import { useUiStore } from '@/stores/uiStore';

const FIFTEEN_MINUTES_MS = 15 * 60 * 1000;
/** Durée d'affichage de la coche « Copié » après une copie (retour d'information, pas une animation). */
const COPIED_FEEDBACK_MS = 1500;

function formatPayBeforeLabel(expiresAtIso: string): string {
  const d = new Date(expiresAtIso);
  if (Number.isNaN(d.getTime())) {
    return 'dans les 24 heures';
  }
  const dayMonth = new Intl.DateTimeFormat('fr-FR', {
    day: 'numeric',
    month: 'short',
  })
    .format(d)
    .replace(/ /g, '\u00A0');
  const mins = String(d.getMinutes()).padStart(2, '0');
  // « le 1 nov. à 5 h 33 » : aucune coupure à l'intérieur de la date ni de l'heure
  return `le ${dayMonth} à ${d.getHours()}\u00A0h\u00A0${mins}`;
}

/**
 * Code USSD avec un point de coupure possible après chaque « * » : sur un petit écran (360 px),
 * il passe à la ligne entre deux segments au lieu d'être tronqué, et le montant reste entier.
 */
function UssdCodeSegments({ code }: { code: string }) {
  const parts = code.split('*');
  return parts.map((part, index) => {
    const isLast = index === parts.length - 1;
    return (
      <span key={`${index}-${part}`}>
        {isLast ? part : `${part}*`}
        {!isLast && <wbr />}
      </span>
    );
  });
}

/** Nom du fichier enregistré pour le QR code : extension reprise de l'adresse de l'image. */
function qrDownloadName(operatorId: string, url: string, ref: string): string {
  const extension = /\.(svg|png|jpe?g|webp)(?:[?#]|$)/i.exec(url)?.[1]?.toLowerCase() ?? 'png';
  return `qr-${operatorId}-${ref.toLowerCase()}.${extension}`;
}

async function copyTextToClipboard(text: string): Promise<boolean> {
  try {
    if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    // Fallback textarea
  }
  if (typeof document === 'undefined') return false;
  try {
    const textarea = document.createElement('textarea');
    textarea.value = text;
    textarea.style.position = 'fixed';
    textarea.style.opacity = '0';
    document.body.appendChild(textarea);
    textarea.select();
    document.execCommand('copy');
    document.body.removeChild(textarea);
    return true;
  } catch {
    return false;
  }
}

/**
 * Écran de paiement `/reservation/:ref/paiement` (§4.1 à §4.5, §7.1 & §7.3 M4).
 */
export function PaymentPage() {
  const { ref } = useParams<{ ref: string }>();
  const navigate = useNavigate();
  const reducedMotion = useReducedMotionPref();

  const authStatus = useAuthStore((s) => s.status);
  const authUser = useAuthStore((s) => s.user);
  const openAuthSheet = useUiStore((s) => s.openAuthSheet);
  const showToast = useToastStore((s) => s.show);

  const { data: reservation, isLoading, error, refetch } = useReservation(ref, {
    live: true,
  });
  const isOnline = useOnlineStatus();
  const {
    payment,
    settingsStatus,
    whatsappNumber,
    refetch: refetchSettings,
    isFetching: isFetchingSettings,
    data: publicSettings,
  } = usePaymentSettings();
  const cancelMutation = useCancelReservation(ref);

  // Aucun opérateur tant que les vrais paramètres de paiement ne sont pas reçus ou mémorisés (M7)
  const enabledOperators = useMemo(
    () => (payment?.operators ?? []).filter((op) => op.enabled),
    [payment],
  );

  // Opérateur présélectionné selon le numéro du client (§4.1)
  const defaultOperatorId = useMemo((): 'orange' | 'mtn' => {
    const phoneSource =
      reservation?.customer?.phone ??
      reservation?.deliveryAddress?.recipientPhone ??
      authUser?.phone ??
      '';
    const detected = detectCmOperator(phoneSource);
    if (detected && enabledOperators.some((op) => op.id === detected)) {
      return detected;
    }
    return enabledOperators[0]?.id ?? 'orange';
  }, [
    reservation?.customer?.phone,
    reservation?.deliveryAddress?.recipientPhone,
    authUser?.phone,
    enabledOperators,
  ]);

  const [userSelectedOperatorId, setUserSelectedOperatorId] = useState<
    'orange' | 'mtn' | null
  >(null);
  const selectedOperatorId = userSelectedOperatorId ?? defaultOperatorId;

  const currentOperator =
    enabledOperators.find((op) => op.id === selectedOperatorId) ??
    enabledOperators[0] ??
    null;
  const proofOperatorId = currentOperator?.id ?? selectedOperatorId;

  const [refCopied, setRefCopied] = useState(false);
  const [amountCopied, setAmountCopied] = useState(false);
  const [ussdCopied, setUssdCopied] = useState(false);
  const [isAmountDetailsOpen, setIsAmountDetailsOpen] = useState(false);
  const [isMobileQrOpen, setIsMobileQrOpen] = useState(false);
  const [hasDialedOnce, setHasDialedOnce] = useState(false);
  const [isReturnSheetOpen, setIsReturnSheetOpen] = useState(false);
  const [isCancelSheetOpen, setIsCancelSheetOpen] = useState(false);
  const [expiredLocally, setExpiredLocally] = useState(false);
  const [mountNowMs] = useState<number>(() => Date.now());

  // Compteur animé de 0 au montant à l'arrivée (§4.4, durée duration.reveal)
  const totalAmount = reservation?.amount?.total ?? reservation?.total ?? 0;
  const subtotalAmount =
    reservation?.amount?.subtotal ?? reservation?.subtotal ?? 0;
  const deliveryFeeAmount =
    reservation?.amount?.deliveryFee ?? reservation?.deliveryFee ?? 0;

  const [animatedAmount, setAnimatedAmount] = useState<number>(() =>
    reducedMotion ? totalAmount : 0,
  );
  const hasAnimatedAmountRef = useRef(false);

  useEffect(() => {
    if (!totalAmount) return;
    if (reducedMotion || hasAnimatedAmountRef.current) {
      const id = requestAnimationFrame(() => setAnimatedAmount(totalAmount));
      return () => cancelAnimationFrame(id);
    }

    hasAnimatedAmountRef.current = true;
    const durationMs = duration.reveal * 1000;
    const start = performance.now();
    let rafId = 0;

    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / durationMs);
      // power3.out : 1 - (1 - t)^3
      const eased = 1 - Math.pow(1 - t, 3);
      setAnimatedAmount(Math.round(totalAmount * eased));
      if (t < 1) {
        rafId = requestAnimationFrame(tick);
      }
    };

    rafId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafId);
  }, [totalAmount, reducedMotion]);

  const dialTimestampRef = useRef<number | null>(null);
  const isIos = useMemo(() => isIosDevice(), []);

  // Titre unique et « noindex » (page privée) par l'API de référencement (M7 §7)
  useDocumentTitle(ref ? `Paiement ${ref.toUpperCase()}` : 'Paiement');

  // Authentification requise (§8 M3)
  useEffect(() => {
    // Session en cours de restauration (profil connu) : on attend, l'écran reste lisible hors connexion
    if (authStatus === 'unknown' && authUser) return;
    if (authStatus !== 'authenticated') {
      openAuthSheet(undefined, () => {
        navigate('/panier', { replace: true });
      });
    }
  }, [authStatus, authUser, openAuthSheet, navigate]);

  // Redirections automatiques selon le statut de la réservation (§4.5 & §7.1)
  useEffect(() => {
    if (!reservation) return;
    if (reservation.status === 'pending_validation') {
      navigate(`/reservation/${reservation.ref}/merci`, { replace: true });
      return;
    }
    if (reservation.status === 'payment_rejected') {
      navigate(`/reservation/${reservation.ref}/preuve`, { replace: true });
      return;
    }
    if (
      reservation.status === 'confirmed' ||
      reservation.status === 'preparing' ||
      reservation.status === 'ready_for_pickup' ||
      reservation.status === 'handed_to_agency' ||
      reservation.status === 'in_delivery' ||
      reservation.status === 'delivered' ||
      reservation.status === 'picked_up'
    ) {
      navigate(`/reservations/${reservation.ref}`, { replace: true });
    }
  }, [reservation, navigate]);

  // Retour depuis l'application Téléphone dans les 15 minutes (§4.2)
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (
        document.visibilityState === 'visible' &&
        dialTimestampRef.current !== null
      ) {
        const elapsed = Date.now() - dialTimestampRef.current;
        dialTimestampRef.current = null;
        if (elapsed <= FIFTEEN_MINUTES_MS) {
          setIsReturnSheetOpen(true);
        }
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () =>
      document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, []);

  if (isLoading && !reservation) {
    return (
      <div>
        <CheckoutStepper currentStep={2} />
        <Container className="py-8">
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
            <div className="space-y-4 lg:col-span-7">
              <div className="h-32 w-full animate-pulse rounded-[var(--radius-md)] bg-ink/15" />
              <div className="h-36 w-full animate-pulse rounded-[var(--radius-md)] bg-surface" />
              <div className="h-64 w-full animate-pulse rounded-[var(--radius-md)] bg-surface" />
            </div>
            <div className="hidden lg:col-span-5 lg:block">
              <div className="h-96 w-full animate-pulse rounded-[var(--radius-md)] bg-surface" />
            </div>
          </div>
        </Container>
      </div>
    );
  }

  // Données déjà chargées : elles passent avant une relecture échouée (M6 §6.3)
  if (!reservation && !isLoading && (isNetworkError(error) || !isOnline)) {
    return (
      <div>
        <CheckoutStepper currentStep={2} />
        <Container className="py-10">
          <OfflineScreen onRetry={() => refetch()} />
        </Container>
      </div>
    );
  }

  if (!reservation && !isLoading) {
    // 404 : réservation introuvable ; autre erreur : message humain et « Réessayer » (M7 §4.5)
    const isNotFound = !error || (error instanceof ApiError && error.status === 404);
    return (
      <div>
        <CheckoutStepper currentStep={2} />
        <Container className="py-12">
          <div className="mx-auto max-w-md rounded-[var(--radius-md)] border border-silver bg-surface p-6 text-center">
            <AlertCircle
              className="mx-auto h-10 w-10 text-danger"
              aria-hidden="true"
            />
            <h1 className="mt-3 text-h2 text-ink">
              {isNotFound ? 'Réservation introuvable' : 'Paiement momentanément indisponible'}
            </h1>
            <p className="mt-2 text-small text-text-2">
              {isNotFound ? (
                <>
                  Aucune réservation ne correspond à la référence{' '}
                  <span className="whitespace-nowrap font-mono font-bold text-ink">{ref}</span>.
                </>
              ) : (
                'Votre réservation n’a pas pu être affichée. Réessayez dans un instant.'
              )}
            </p>
            <div className="mt-6 flex flex-col items-center gap-3">
              {!isNotFound && (
                <Button
                  variant="primary"
                  size="lg"
                  iconLeft={<RefreshCw className="h-4 w-4" aria-hidden="true" />}
                  onClick={() => void refetch()}
                >
                  Réessayer
                </Button>
              )}
              <Button variant={isNotFound ? 'dark' : 'outline'} size="lg" href="/reservations">
                Mes réservations
              </Button>
            </div>
          </div>
        </Container>
      </div>
    );
  }

  if (!reservation) {
    return null;
  }

  const isExpired =
    expiredLocally ||
    reservation.status === 'expired' ||
    new Date(reservation.expiresAt).getTime() <= mountNowMs;

  const ussdCode = currentOperator
    ? buildUssdCode(
        currentOperator.ussdTemplate,
        currentOperator.merchantCode,
        totalAmount,
      )
    : null;

  const ussdTelHref = ussdCode ? buildUssdTelHref(ussdCode) : null;

  const handleCopyReference = async () => {
    haptic('light');
    await copyTextToClipboard(reservation.ref);
    setRefCopied(true);
    showToast({ message: 'Référence copiée' });
    window.setTimeout(() => setRefCopied(false), COPIED_FEEDBACK_MS);
  };

  const handleCopyAmount = async () => {
    haptic('light');
    await copyTextToClipboard(formatRawAmountForClipboard(totalAmount));
    setAmountCopied(true);
    showToast({ message: 'Montant copié' });
    window.setTimeout(() => setAmountCopied(false), COPIED_FEEDBACK_MS);
  };

  const handleCopyUssd = async () => {
    if (!ussdCode) return;
    haptic('light');
    await copyTextToClipboard(ussdCode);
    setUssdCopied(true);
    showToast({ message: 'Code de paiement copié' });
    window.setTimeout(() => setUssdCopied(false), COPIED_FEEDBACK_MS);
  };

  const handleDialClick = () => {
    haptic('light');
    setHasDialedOnce(true);
    dialTimestampRef.current = Date.now();
  };

  const handleConfirmCancel = async () => {
    haptic('light');
    try {
      const { restored } = await cancelMutation.mutateAsync(reservation);
      setIsCancelSheetOpen(false);
      showToast({
        message:
          restored.unavailable === 0
            ? 'Réservation annulée. Vos articles ont été remis dans votre panier.'
            : restored.added > 0
              ? 'Réservation annulée. Les articles encore disponibles ont été remis dans votre panier.'
              : 'Réservation annulée. Ces articles ne sont plus disponibles.',
        wrap: true,
      });
      navigate('/panier', { replace: true });
    } catch {
      showToast({
        message: "Impossible d’annuler la réservation pour le moment. Réessayez.",
      });
    }
  };

  // Consignes de l'opérateur (texte saisi dans l'administration) : typographie française appliquée
  const operatorSteps: ReactNode[] = [
    ...(currentOperator?.steps ?? []).map((step) => frenchSpacing(step)),
    'Faites une capture d’écran du message de confirmation.',
    <>
      Si on vous demande un motif, indiquez{' '}
      <span className="whitespace-nowrap font-mono font-bold">{reservation.ref}</span>.
    </>,
  ];
  const whatsappHelpUrl = whatsappNumber
    ? buildWhatsAppQuestionUrl(whatsappNumber, reservation.ref)
    : null;

  return (
    <div className="pb-28 lg:pb-16">
      {/* 4.1 En-tête de page : flèche retour (M6 §8 : écran précédent, sinon le suivi) + indicateur d'étapes */}
      {/* HYPOTHÈSE: le parent du paiement est le suivi de la réservation (et non plus l'accueil) */}
      <div className="border-b border-silver/70 bg-white">
        <Container className="flex items-center justify-between py-2.5">
          <BackButton fallback={`/reservations/${reservation.ref}`} />
          <span className="font-mono text-caption font-bold text-text-2">
            {reservation.ref}
          </span>
        </Container>
      </div>
      <CheckoutStepper currentStep={2} />

      <Container className="py-6 lg:py-10">
        {/* Titre de la page pour les lecteurs d'écran (la carte de référence en tient lieu visuellement) */}
        <h1 className="sr-only">Paiement de votre réservation {reservation.ref}</h1>
        {/* Grille 2 colonnes sur ordinateur (§4.3) */}
        <div className="grid grid-cols-1 gap-8 lg:grid-cols-12 lg:items-start">
          {/* Colonne principale (gauche sur ordinateur) */}
          <div className="space-y-6 lg:col-span-7">
            {/* 4.1.2 Carte de référence (fond ink, texte blanc, rayon 8, padding 20 px) */}
            <m.div
              initial={reducedMotion ? false : { opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: duration.base, ease: ease.out }}
              className="rounded-[var(--radius-md)] bg-ink p-5 text-white"
            >
              <div className="flex flex-col justify-between gap-5 sm:flex-row sm:items-center">
                <div>
                  <span className="block text-label text-grey">
                    VOTRE RÉSERVATION
                  </span>
                  <button
                    type="button"
                    data-testid="copy-ref-button"
                    onClick={() => void handleCopyReference()}
                    aria-label={`Référence ${reservation.ref}. Appuyez pour copier la référence`}
                    className="mt-1 inline-flex min-h-11 items-center gap-3 text-left transition-opacity duration-fast hover:opacity-90"
                  >
                    {/* 32 px condensé : choix graphique de la référence (plus grand que text-h1 sur téléphone) */}
                    <span
                      className="font-mono text-[32px] font-extrabold leading-none tracking-tight text-white"
                      style={{
                        fontStretch: '75%',
                        fontVariationSettings: "'wdth' 75",
                      }}
                    >
                      {reservation.ref}
                    </span>
                    <span className="flex h-8 w-8 items-center justify-center rounded-[var(--radius-sm)] bg-ink-2 text-silver">
                      {refCopied ? (
                        <Check
                          className="h-4 w-4 text-success"
                          aria-hidden="true"
                        />
                      ) : (
                        <Copy className="h-4 w-4" aria-hidden="true" />
                      )}
                    </span>
                  </button>
                  <p className="mt-2 text-small text-silver">
                    Payez avant {formatPayBeforeLabel(reservation.expiresAt)}
                  </p>
                </div>

                <div className="self-center sm:self-auto">
                  <HoldCountdown
                    expiresAt={reservation.expiresAt}
                    serverTime={reservation.serverTime}
                    variant="ring"
                    surface="dark"
                    onExpire={() => setExpiredLocally(true)}
                  />
                </div>
              </div>
            </m.div>

            {/* 4.1.3 Montant à payer (bloc blanc, bordure silver) */}
            <m.section
              aria-labelledby="payment-amount-label"
              initial={reducedMotion ? false : { opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: duration.base, delay: staggerStep, ease: ease.out }}
              className="rounded-[var(--radius-md)] border border-silver bg-white p-5"
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <span
                    id="payment-amount-label"
                    className="block text-label text-text-2"
                  >
                    MONTANT EXACT À PAYER
                  </span>

                  <button
                    type="button"
                    data-testid="copy-amount-button"
                    onClick={() => void handleCopyAmount()}
                    className="mt-1 inline-flex min-h-12 flex-wrap items-center gap-x-3 gap-y-2 text-left transition-opacity duration-fast hover:opacity-85"
                  >
                    {/* Montant jamais coupé avant « FCFA » : à 360 px, c'est « Copier » qui passe dessous.
                        36 à 40 px : choix graphique (montant à recopier, plus grand que text-h1). */}
                    <span className="whitespace-nowrap text-[36px] sm:text-[40px] font-extrabold leading-none tabular-nums text-ink">
                      {formatPrice(animatedAmount || totalAmount)}
                    </span>
                    <span className="inline-flex h-8 items-center gap-1 rounded-[var(--radius-sm)] border border-silver bg-surface px-2.5 text-caption font-bold text-ink">
                      {amountCopied ? (
                        <>
                          <Check
                            className="h-3.5 w-3.5 text-success"
                            aria-hidden="true"
                          />
                          <span>Copié</span>
                        </>
                      ) : (
                        <>
                          <Copy className="h-3.5 w-3.5" aria-hidden="true" />
                          <span>Copier</span>
                        </>
                      )}
                    </span>
                    {/* Nom accessible = texte visible + précision (pas d'aria-label divergent du texte affiché) */}
                    <span className="sr-only"> le montant sans espaces</span>
                  </button>
                </div>
              </div>

              {/* Détail repliable : sous-total, livraison, total */}
              <div className="mt-3 border-t border-silver/60 pt-3">
                <button
                  type="button"
                  aria-expanded={isAmountDetailsOpen}
                  onClick={() => setIsAmountDetailsOpen((prev) => !prev)}
                  className="inline-flex min-h-11 items-center gap-1.5 text-caption font-bold text-text-2 transition-colors duration-fast hover:text-ink"
                >
                  <span>Voir le détail du montant</span>
                  <ChevronDown
                    className={cn(
                      'h-4 w-4 transition-transform duration-fast',
                      isAmountDetailsOpen && 'rotate-180',
                    )}
                    aria-hidden="true"
                  />
                </button>

                <AnimatePresence initial={false}>
                  {isAmountDetailsOpen && (
                    <m.dl
                      initial={reducedMotion ? false : { opacity: 0, y: -4 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -4 }}
                      transition={{ duration: duration.fast }}
                      className="mt-2 space-y-1.5 rounded-[var(--radius-sm)] bg-surface p-3 text-caption"
                    >
                      <div className="flex justify-between">
                        <dt className="text-text-2">Sous-total articles</dt>
                        <dd className="font-bold tabular-nums text-ink">
                          {formatPrice(subtotalAmount)}
                        </dd>
                      </div>
                      <div className="flex justify-between">
                        <dt className="text-text-2">
                          {reservation.receptionMode === 'pickup'
                            ? 'Retrait en boutique'
                            : 'Frais de livraison'}
                        </dt>
                        <dd className="font-bold tabular-nums text-ink">
                          {deliveryFeeAmount > 0
                            ? formatPrice(deliveryFeeAmount)
                            : 'Gratuit'}
                        </dd>
                      </div>
                      <div className="flex justify-between border-t border-silver/60 pt-1.5 text-small font-extrabold text-ink">
                        <dt>Total à payer</dt>
                        <dd className="tabular-nums">
                          {formatPrice(totalAmount)}
                        </dd>
                      </div>
                    </m.dl>
                  )}
                </AnimatePresence>
              </div>

              {/* Avertissement warning (§4.1.3) */}
              <div
                role="note"
                className="mt-4 flex items-start gap-2.5 rounded-[var(--radius-sm)] border border-warning/50 bg-surface p-3 text-caption font-semibold text-ink"
              >
                <AlertTriangle
                  className="mt-0.5 h-4 w-4 shrink-0 text-warning"
                  aria-hidden="true"
                />
                <span>
                  Payez exactement ce montant, en une seule fois. Un montant
                  différent ralentit la validation.
                </span>
              </div>
            </m.section>

            {/* 4.1.4 Choix de l'opérateur & 4.1.5 Payer en un appui */}
            <m.section
              aria-label="Mode de paiement Mobile Money"
              initial={reducedMotion ? false : { opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: duration.base, delay: staggerStep * 2, ease: ease.out }}
              className="rounded-[var(--radius-md)] border border-silver bg-white p-5"
            >
              {/* Paramètres de paiement absents (jamais de valeurs fictives, M7) : chargement puis indisponibilité */}
              {!currentOperator ? (
                settingsStatus === 'loading' ? (
                  <div className="space-y-5" aria-busy="true">
                    <p className="sr-only" role="status">
                      Chargement des informations de paiement…
                    </p>
                    <div className="h-12 w-full animate-pulse rounded-[var(--radius-md)] bg-surface" />
                    <div className="space-y-2 border-b border-silver/60 pb-3">
                      <div className="h-3 w-40 animate-pulse rounded-[var(--radius-sm)] bg-surface" />
                      <div className="h-5 w-56 animate-pulse rounded-[var(--radius-sm)] bg-surface" />
                    </div>
                    {/* « Composer le code » reste inactif tant que les vrais paramètres ne sont pas reçus */}
                    <Button
                      type="button"
                      variant="primary"
                      size="lg"
                      fullWidth
                      disabled
                      className="lg:hidden"
                      iconLeft={<Phone className="h-5 w-5" aria-hidden="true" />}
                    >
                      Composer le code de paiement
                    </Button>
                    <div className="space-y-2.5">
                      {[0, 1, 2].map((idx) => (
                        <div key={idx} className="h-4 w-full animate-pulse rounded-[var(--radius-sm)] bg-surface" />
                      ))}
                    </div>
                  </div>
                ) : (
                  <div role="alert" className="flex flex-col items-center py-2 text-center">
                    <span className="flex h-12 w-12 items-center justify-center rounded-full bg-surface text-warning">
                      <AlertTriangle className="h-6 w-6" aria-hidden="true" />
                    </span>
                    <h2 className="mt-3 text-h3 font-bold text-ink">
                      Paiement momentanément indisponible
                    </h2>
                    <p className="mt-1.5 max-w-sm text-small text-text-2">
                      {isOnline
                        ? 'Les informations de paiement n’ont pas pu être chargées. Réessayez dans un instant : votre réservation reste mise de côté.'
                        : 'Reconnectez-vous pour afficher les informations de paiement : votre réservation reste mise de côté.'}
                    </p>
                    <div className="mt-4 flex w-full flex-col gap-2.5 sm:w-auto sm:flex-row">
                      <Button
                        type="button"
                        variant="primary"
                        size="lg"
                        loading={isFetchingSettings}
                        iconLeft={<RefreshCw className="h-4 w-4" aria-hidden="true" />}
                        onClick={() => void refetchSettings()}
                      >
                        Réessayer
                      </Button>
                      {whatsappHelpUrl && (
                        <Button
                          variant="outline"
                          size="lg"
                          href={whatsappHelpUrl}
                          external
                          iconLeft={<MessageCircle className="h-4 w-4" aria-hidden="true" />}
                        >
                          Contacter la boutique
                        </Button>
                      )}
                    </div>
                  </div>
                )
              ) : (
              <>
              {/* Deux onglets larges si > 1 opérateur activé (§4.1.4) */}
              {enabledOperators.length > 1 && (
                <div
                  role="tablist"
                  aria-label="Choisir votre opérateur Mobile Money"
                  className="mb-5 grid grid-cols-2 gap-1.5 rounded-[var(--radius-md)] bg-surface p-1.5"
                >
                  {enabledOperators.map((op) => {
                    const isSelected = op.id === currentOperator.id;
                    return (
                      <button
                        key={op.id}
                        type="button"
                        role="tab"
                        aria-selected={isSelected}
                        onClick={() => {
                          haptic('light');
                          setUserSelectedOperatorId(op.id);
                        }}
                        className={cn(
                          'relative flex min-h-12 items-center justify-center rounded-[var(--radius-sm)] px-3 py-2 text-small font-extrabold transition-colors duration-fast',
                          isSelected
                            ? 'text-white'
                            : 'text-ink hover:text-red',
                        )}
                      >
                        {isSelected && (
                          <m.span
                            layoutId="payment-operator-tab"
                            transition={spring.snappy}
                            className="absolute inset-0 rounded-[var(--radius-sm)] bg-ink"
                          />
                        )}
                        <span className="relative">{op.label}</span>
                      </button>
                    );
                  })}
                </div>
              )}

              <AnimatePresence mode="wait" initial={false}>
                <m.div
                  key={currentOperator.id}
                  initial={reducedMotion ? false : { opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: duration.fast }}
                  className="space-y-5"
                >
                  <div className="flex flex-wrap items-baseline justify-between gap-2 border-b border-silver/60 pb-3">
                    <div>
                      <span className="block text-label text-text-2">
                        Destinataire officiel {currentOperator.label}
                      </span>
                      <span className="mt-0.5 block text-h3 font-extrabold text-ink">
                        {currentOperator.merchantName}
                      </span>
                    </div>
                    <span className="whitespace-nowrap font-mono text-small font-bold text-ink">
                      Code marchand&nbsp;: {currentOperator.merchantCode}
                    </span>
                  </div>

                  {/* 4.1.5 Payer en un appui (Mobile Android vs iPhone vs Ordinateur) */}
                  {ussdCode && (
                    <div className="space-y-3">
                      {/* Bouton mobile uniquement (masqué sur lg+, §4.3) */}
                      <div className="lg:hidden">
                        {isIos ? (
                          <div className="space-y-2">
                            <Button
                              type="button"
                              variant="primary"
                              size="lg"
                              fullWidth
                              data-testid="ussd-ios-copy-btn"
                              iconLeft={
                                <Copy className="h-5 w-5" aria-hidden="true" />
                              }
                              onClick={() => void handleCopyUssd()}
                            >
                              Copier le code de paiement
                            </Button>
                            <p className="text-center text-caption font-semibold text-text-2">
                              Ouvrez l&rsquo;application Téléphone, collez le code
                              puis appelez.
                            </p>
                          </div>
                        ) : (
                          <div className="relative">
                            {/* Halo discret qui pulse avant le 1er appui (§4.4) ; absent en mouvement réduit */}
                            {!hasDialedOnce && !reducedMotion && (
                              <m.span
                                aria-hidden="true"
                                animate={{
                                  scale: [1, 1.04, 1],
                                  opacity: [0, 0.35, 0],
                                }}
                                transition={{
                                  duration: duration.ambient,
                                  repeat: Number.POSITIVE_INFINITY,
                                  repeatDelay: delay.attention,
                                }}
                                className="pointer-events-none absolute inset-0 rounded-[var(--radius-md)] border-2 border-red"
                              />
                            )}
                            {/* Mêmes dimensions que Button lg (52 px, 15 px) : lien tel: avec suivi du retour */}
                            <a
                              href={ussdTelHref ?? '#'}
                              data-testid="ussd-dial-link"
                              onClick={handleDialClick}
                              className="relative inline-flex min-h-13 w-full items-center justify-center gap-2.5 rounded-[var(--radius-md)] bg-red px-6 py-3 text-[15px] font-semibold text-white transition-opacity duration-fast [@media(hover:hover)]:hover:opacity-90"
                            >
                              <Phone className="h-5 w-5" aria-hidden="true" />
                              <span>Composer le code de paiement</span>
                            </a>
                          </div>
                        )}
                        {/* Le code USSD passe par le réseau téléphonique : le paiement reste possible sans Internet */}
                        {!isOnline && (
                          <p className="mt-2 text-center text-caption font-semibold text-text-2">
                            Pas besoin d&rsquo;Internet pour payer&nbsp;: le code passe par le réseau
                            téléphonique. Vous enverrez votre preuve de paiement au retour du réseau.
                          </p>
                        )}
                      </div>

                      {/* Code USSD en clair + bouton Copier (affiché partout) */}
                      <div className="flex items-center justify-between gap-3 rounded-[var(--radius-md)] border border-silver bg-surface px-4 py-3">
                        <div className="min-w-0">
                          <span className="block text-label text-text-2">
                            Code USSD complet
                          </span>
                          {/* Jamais tronqué : c'est le code que le client vérifie avant de payer */}
                          <code
                            data-testid="ussd-plain-code"
                            className="mt-0.5 block font-mono text-body font-extrabold break-words text-ink"
                          >
                            <UssdCodeSegments code={ussdCode} />
                          </code>
                        </div>
                        <button
                          type="button"
                          data-testid="copy-ussd-btn"
                          onClick={() => void handleCopyUssd()}
                          className="inline-flex min-h-11 shrink-0 items-center gap-1.5 rounded-[var(--radius-sm)] border border-silver bg-white px-3 py-1.5 text-caption font-bold text-ink transition-colors duration-fast hover:border-ink"
                        >
                          {ussdCopied ? (
                            <>
                              <Check
                                className="h-3.5 w-3.5 text-success"
                                aria-hidden="true"
                              />
                              <span>Copié</span>
                            </>
                          ) : (
                            <>
                              <Copy
                                className="h-3.5 w-3.5"
                                aria-hidden="true"
                              />
                              <span>Copier</span>
                            </>
                          )}
                        </button>
                      </div>
                    </div>
                  )}

                  {/* 4.1.6 Étapes numérotées révélées en cascade */}
                  <div>
                    <h2 className="text-label text-ink">
                      INSTRUCTIONS PAS À PAS ({currentOperator.label})
                    </h2>
                    <ol className="mt-3 space-y-2.5">
                      {operatorSteps.map((stepText, idx) => (
                        <m.li
                          key={`${currentOperator.id}-step-${idx}`}
                          initial={
                            reducedMotion ? false : { opacity: 0, y: 10 }
                          }
                          animate={{ opacity: 1, y: 0 }}
                          transition={{
                            duration: duration.quick,
                            delay: reducedMotion ? 0 : idx * staggerSlow,
                            ease: ease.out,
                          }}
                          className="flex items-start gap-3 text-small text-ink"
                        >
                          <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-surface font-mono text-caption font-extrabold text-ink">
                            {idx + 1}
                          </span>
                          <span className="pt-0.5 leading-relaxed">
                            {stepText}
                          </span>
                        </m.li>
                      ))}
                    </ol>
                  </div>

                  {/* 4.1.7 QR code en accordéon sur mobile (« Payer depuis un autre téléphone ») */}
                  {currentOperator.qrImageUrl && (
                    <div className="border-t border-silver/60 pt-4 lg:hidden">
                      <button
                        type="button"
                        aria-expanded={isMobileQrOpen}
                        onClick={() => setIsMobileQrOpen((prev) => !prev)}
                        className="flex min-h-11 w-full items-center justify-between text-left text-small font-bold text-ink"
                      >
                        <span className="inline-flex items-center gap-2">
                          <QrCode className="h-4 w-4" aria-hidden="true" />
                          <span>Payer depuis un autre téléphone (QR code)</span>
                        </span>
                        <ChevronDown
                          className={cn(
                            'h-4 w-4 text-text-2 transition-transform duration-fast',
                            isMobileQrOpen && 'rotate-180',
                          )}
                          aria-hidden="true"
                        />
                      </button>

                      <AnimatePresence initial={false}>
                        {isMobileQrOpen && (
                          <m.div
                            initial={
                              reducedMotion ? false : { opacity: 0, y: -6 }
                            }
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -6 }}
                            transition={{ duration: duration.fast }}
                            className="mt-3 flex flex-col items-center rounded-[var(--radius-md)] border border-silver bg-surface p-5 text-center"
                          >
                            <div className="rounded-[var(--radius-md)] bg-white p-3">
                              <img
                                src={currentOperator.qrImageUrl}
                                alt={`QR code ${currentOperator.label} ${currentOperator.merchantName}`}
                                width={200}
                                height={200}
                                className="size-50 object-contain"
                              />
                            </div>
                            <p className="mt-2.5 text-small font-extrabold text-ink">
                              {currentOperator.merchantName}
                            </p>
                            <a
                              href={currentOperator.qrImageUrl}
                              download={qrDownloadName(currentOperator.id, currentOperator.qrImageUrl, reservation.ref)}
                              className="mt-3 inline-flex min-h-11 items-center gap-2 rounded-[var(--radius-md)] border border-silver bg-white px-4 py-2 text-caption font-bold text-ink transition-colors duration-fast hover:border-ink"
                            >
                              <Download
                                className="h-4 w-4"
                                aria-hidden="true"
                              />
                              <span>Enregistrer l&rsquo;image</span>
                            </a>
                          </m.div>
                        )}
                      </AnimatePresence>
                    </div>
                  )}
                </m.div>
              </AnimatePresence>
              </>
              )}

              {/* Bouton principal sur ordinateur dans la colonne de gauche (§4.3) */}
              <div className="mt-6 hidden lg:block">
                <Button
                  variant="primary"
                  size="lg"
                  fullWidth
                  href={`/reservation/${reservation.ref}/preuve?operator=${proofOperatorId}`}
                  iconRight={
                    <ArrowRight className="h-4 w-4" aria-hidden="true" />
                  }
                >
                  J&rsquo;ai payé, envoyer ma preuve
                </Button>
              </div>
            </m.section>

            {/* 4.1.8 Liens secondaires en bas : « Payer plus tard » et « Annuler la réservation » */}
            <div className="flex flex-wrap items-center justify-between gap-4 px-1 pt-1">
              <Link
                to="/"
                className="inline-flex min-h-11 items-center text-small font-bold text-ink underline transition-colors duration-fast hover:text-red"
              >
                Payer plus tard
              </Link>

              <button
                type="button"
                data-testid="open-cancel-sheet-btn"
                onClick={() => setIsCancelSheetOpen(true)}
                className="inline-flex min-h-11 items-center text-small font-bold text-danger underline transition-opacity duration-fast hover:opacity-80"
              >
                Annuler la réservation
              </button>
            </div>
          </div>

          {/* 4.3 Colonne de droite sur ordinateur (QR code 240 px mis en avant + récapitulatif) */}
          <aside
            aria-label="QR Code et récapitulatif de la réservation"
            className="hidden space-y-6 lg:col-span-5 lg:block"
          >
            {currentOperator?.qrImageUrl && (
              <div className="rounded-[var(--radius-md)] border border-silver bg-surface p-6 text-center">
                <span className="text-label text-ink">
                  SCANNEZ AVEC VOTRE TÉLÉPHONE
                </span>
                <div className="mx-auto mt-4 inline-block rounded-[var(--radius-md)] border border-silver bg-white p-4">
                  <img
                    src={currentOperator.qrImageUrl}
                    alt={`QR code ${currentOperator.label} ${currentOperator.merchantName}`}
                    width={240}
                    height={240}
                    className="size-60 object-contain"
                  />
                </div>
                <p className="mt-3 text-body font-extrabold text-ink">
                  {currentOperator.merchantName}
                </p>
                <p className="mt-0.5 font-mono text-caption font-bold text-text-2">
                  Code marchand {currentOperator.label}&nbsp;:{' '}
                  {currentOperator.merchantCode}
                </p>

                <div className="mt-4">
                  <a
                    href={currentOperator.qrImageUrl}
                    download={qrDownloadName(currentOperator.id, currentOperator.qrImageUrl, reservation.ref)}
                    className="inline-flex min-h-11 items-center gap-2 rounded-[var(--radius-md)] border border-silver bg-white px-4 py-2 text-caption font-bold text-ink transition-colors duration-fast hover:border-ink"
                  >
                    <Download className="h-4 w-4" aria-hidden="true" />
                    <span>Enregistrer l&rsquo;image</span>
                  </a>
                </div>
              </div>
            )}

            {/* Récapitulatif de la réservation (articles & mode de réception) */}
            <div className="rounded-[var(--radius-md)] border border-silver bg-white p-6">
              <h2 className="text-label text-ink">
                ARTICLES RÉSERVÉS ({reservation.items.length})
              </h2>
              <ul className="mt-4 divide-y divide-silver/50">
                {reservation.items.map((item) => (
                  <li
                    key={item.id}
                    className="flex items-center gap-3.5 py-3 first:pt-0 last:pb-0"
                  >
                    <div className="h-16 w-13 shrink-0 overflow-hidden rounded-[var(--radius-sm)] bg-surface">
                      <SmartImage
                        src={item.image}
                        fallback={item.image}
                        alt={item.name}
                        ratio="4/5"
                        className="h-full w-full"
                      />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-small font-bold text-ink">
                        {item.name}
                      </p>
                      <p className="text-caption text-text-2">
                        {item.colorName} · Taille {item.size} · Qté{' '}
                        {item.quantity}
                      </p>
                    </div>
                    <Price
                      amount={item.unitPrice * item.quantity}
                      className="text-small font-bold text-ink"
                    />
                  </li>
                ))}
              </ul>

              <div className="mt-4 border-t border-silver/60 pt-4 text-caption text-text-2">
                <span className="font-bold text-ink">Mode de réception&nbsp;: </span>
                {reservation.receptionMode === 'pickup' ? (
                  <span>
                    Retrait en boutique
                    {publicSettings?.shop?.city ? ` (${publicSettings.shop.city})` : ''}
                  </span>
                ) : (
                  <span>
                    Livraison
                    {(reservation.city ?? reservation.deliveryAddress?.city)
                      ? ` — ${reservation.city ?? reservation.deliveryAddress?.city}`
                      : ''}
                    {reservation.agency?.name ||
                    reservation.deliveryAddress?.agencyName
                      ? ` (${reservation.agency?.name ?? reservation.deliveryAddress?.agencyName})`
                      : ''}
                  </span>
                )}
              </div>
            </div>
          </aside>
        </div>
      </Container>

      {/* Barre d'action collée en bas sur mobile (§4.1) : en ink tant que le client n'a pas composé le
          code (ou si le paiement est indisponible), pour ne pas concurrencer le bouton rouge principal */}
      <div className="fixed right-0 bottom-0 left-0 z-nav border-t border-silver/70 bg-white px-page pt-3 pb-[calc(12px+env(safe-area-inset-bottom))] shadow-[var(--shadow-nav)] lg:hidden">
        <Button
          variant={!currentOperator || (ussdCode && !hasDialedOnce && !isIos) ? 'dark' : 'primary'}
          size="lg"
          fullWidth
          href={`/reservation/${reservation.ref}/preuve?operator=${proofOperatorId}`}
          iconRight={<ArrowRight className="h-4 w-4" aria-hidden="true" />}
        >
          J&rsquo;ai payé, envoyer ma preuve
        </Button>
      </div>

      {/* 4.2 Feuille automatique au retour depuis l'application Téléphone */}
      <Sheet
        open={isReturnSheetOpen}
        onClose={() => setIsReturnSheetOpen(false)}
        title="Paiement effectué&nbsp;?"
      >
        <div className="space-y-4 text-center">
          <m.div
            initial={reducedMotion ? false : { scale: 0.5, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={spring.bounce}
            className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-success/15 text-success"
          >
            <CheckCircle2 className="h-8 w-8" aria-hidden="true" />
          </m.div>

          <div>
            <h3 className="text-h2 text-ink">Paiement effectué&nbsp;?</h3>
            <p className="mt-1.5 text-small text-text-2">
              Envoyez maintenant votre preuve de paiement&nbsp;: la capture d’écran du message de confirmation.
            </p>
          </div>

          <div className="space-y-2.5 pt-2">
            <Button
              variant="primary"
              size="lg"
              fullWidth
              href={`/reservation/${reservation.ref}/preuve?operator=${proofOperatorId}&openPicker=1`}
              onClick={() => setIsReturnSheetOpen(false)}
            >
              Envoyer ma preuve
            </Button>

            <button
              type="button"
              onClick={() => setIsReturnSheetOpen(false)}
              className="inline-flex min-h-11 w-full items-center justify-center text-small font-bold text-text-2 underline transition-colors duration-fast hover:text-ink"
            >
              Pas encore
            </button>
          </div>
        </div>
      </Sheet>

      {/* 4.1.8 Feuille de confirmation d'annulation de la réservation */}
      <Sheet
        open={isCancelSheetOpen}
        onClose={() => setIsCancelSheetOpen(false)}
        title="Annuler la réservation&nbsp;?"
      >
        <div className="space-y-4">
          <p className="text-small text-text-2">
            Vos articles seront remis en vente. Ceux encore disponibles reviennent dans votre
            panier, pour modifier votre réservation si vous le souhaitez.
          </p>

          <div className="flex flex-col gap-2.5 pt-2 sm:flex-row">
            <Button
              type="button"
              variant="primary"
              size="lg"
              fullWidth
              loading={cancelMutation.isPending}
              onClick={() => void handleConfirmCancel()}
            >
              Oui, annuler la réservation
            </Button>
            <Button
              type="button"
              variant="outline"
              size="lg"
              fullWidth
              onClick={() => setIsCancelSheetOpen(false)}
            >
              Conserver ma réservation
            </Button>
          </div>
        </div>
      </Sheet>

      {/* 7.3 Calque d'expiration si le compte à rebours atteint 0 */}
      <ReservationExpiredOverlay
        open={isExpired}
        reservation={reservation}
        whatsappNumber={whatsappNumber}
      />
    </div>
  );
}
