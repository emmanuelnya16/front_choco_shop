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
  Phone,
  QrCode,
} from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import { BackButton } from '@/components/ui/BackButton';
import { Button } from '@/components/ui/Button';
import { Container, Price } from '@/components/ui/Primitives';
import { Sheet } from '@/components/ui/Sheet';
import { SmartImage } from '@/components/ui/SmartImage';
import { isNetworkError } from '@/features/offline/networkErrors';
import { OfflineScreen } from '@/features/offline/OfflineScreen';
import {
  useCancelReservation,
  usePaymentSettings,
} from '@/features/payment/api/usePaymentQueries';
import { ReservationExpiredOverlay } from '@/features/payment/components/ReservationExpiredOverlay';
import {
  buildUssdCode,
  buildUssdTelHref,
  formatRawAmountForClipboard,
  isIosDevice,
} from '@/features/payment/utils/ussd';
import { useReservation } from '@/features/reservation/api/useReservationQueries';
import { CheckoutStepper } from '@/features/reservation/components/CheckoutStepper';
import { HoldCountdown } from '@/features/reservation/components/HoldCountdown';
import { useOnlineStatus } from '@/lib/hooks/useOnlineStatus';
import { cn } from '@/lib/utils/cn';
import { haptic } from '@/lib/utils/haptics';
import { detectCmOperator } from '@/lib/utils/operator';
import { formatPrice } from '@/lib/utils/price';
import { ease, spring } from '@/motion/tokens';
import { useReducedMotionPref } from '@/motion/useReducedMotionPref';
import { useAuthStore } from '@/stores/authStore';
import { useToastStore } from '@/stores/toastStore';
import { useUiStore } from '@/stores/uiStore';

const FIFTEEN_MINUTES_MS = 15 * 60 * 1000;

function formatPayBeforeLabel(expiresAtIso: string): string {
  const d = new Date(expiresAtIso);
  if (Number.isNaN(d.getTime())) {
    return 'dans les 24 heures';
  }
  const dayMonth = new Intl.DateTimeFormat('fr-FR', {
    day: 'numeric',
    month: 'short',
  }).format(d);
  const hours = String(d.getHours()).padStart(2, '0');
  const mins = String(d.getMinutes()).padStart(2, '0');
  return `le ${dayMonth} à ${hours} h ${mins}`;
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
  const { payment, whatsappNumber } = usePaymentSettings();
  const cancelMutation = useCancelReservation(ref);

  const enabledOperators = useMemo(
    () => payment.operators.filter((op) => op.enabled),
    [payment.operators],
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
    payment.operators[0]!;

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

  // Compteur animé de 0 au montant en 0,8 s à l'arrivée (§4.4)
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
    const durationMs = 800;
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

  useEffect(() => {
    document.title = ref
      ? `Paiement ${ref.toUpperCase()} · DR Choco L'Incompris`
      : "Paiement · DR Choco L'Incompris";
  }, [ref]);

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
          <div className="mx-auto max-w-4xl grid grid-cols-1 gap-6 lg:grid-cols-12">
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
    return (
      <div>
        <CheckoutStepper currentStep={2} />
        <Container className="py-12">
          <div className="mx-auto max-w-md rounded-[var(--radius-md)] border border-silver bg-surface p-6 text-center">
            <AlertCircle
              className="mx-auto h-10 w-10 text-danger"
              aria-hidden="true"
            />
            <h1 className="mt-3 text-h2 text-ink">Réservation introuvable</h1>
            <p className="mt-2 text-small text-text-2">
              Aucune réservation ne correspond à la référence{' '}
              <span className="font-mono font-bold text-ink">{ref}</span>.
            </p>
            <div className="mt-6">
              <Button variant="dark" size="lg" href="/reservations">
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
    window.setTimeout(() => setRefCopied(false), 1500);
  };

  const handleCopyAmount = async () => {
    haptic('light');
    await copyTextToClipboard(formatRawAmountForClipboard(totalAmount));
    setAmountCopied(true);
    showToast({ message: 'Montant copié' });
    window.setTimeout(() => setAmountCopied(false), 1500);
  };

  const handleCopyUssd = async () => {
    if (!ussdCode) return;
    haptic('light');
    await copyTextToClipboard(ussdCode);
    setUssdCopied(true);
    showToast({ message: 'Code de paiement copié' });
    window.setTimeout(() => setUssdCopied(false), 1500);
  };

  const handleDialClick = () => {
    haptic('light');
    setHasDialedOnce(true);
    dialTimestampRef.current = Date.now();
  };

  const handleConfirmCancel = async () => {
    haptic('light');
    try {
      await cancelMutation.mutateAsync(reservation);
      setIsCancelSheetOpen(false);
      showToast({
        message: 'Réservation annulée. Vos articles ont été remis dans votre panier.',
      });
      navigate('/panier', { replace: true });
    } catch {
      showToast({
        message: "Impossible d'annuler la réservation pour le moment. Réessayez.",
      });
    }
  };

  const operatorSteps = [
    ...(currentOperator?.steps ?? []),
    "Faites une capture d'écran du message de confirmation.",
    `Si on vous demande un motif, indiquez ${reservation.ref}.`,
  ];

  return (
    <div className="pb-28 lg:pb-16">
      {/* 4.1 En-tête de page : flèche retour (M6 §8 : écran précédent, sinon le suivi) + indicateur d'étapes */}
      {/* HYPOTHÈSE: le parent du paiement est le suivi de la réservation (et non plus l'accueil) */}
      <div className="border-b border-silver/70 bg-white">
        <Container className="flex items-center justify-between py-2.5">
          <BackButton fallback={`/reservations/${reservation.ref}`} />
          <span className="font-mono text-xs font-bold text-text-2">
            {reservation.ref}
          </span>
        </Container>
      </div>
      <CheckoutStepper currentStep={2} />

      <Container className="py-6 lg:py-10">
        {/* Grille 2 colonnes sur ordinateur (§4.3) */}
        <div className="mx-auto max-w-5xl grid grid-cols-1 gap-8 lg:grid-cols-12 lg:items-start">
          {/* Colonne principale (gauche sur ordinateur) */}
          <div className="space-y-6 lg:col-span-7">
            {/* 4.1.2 Carte de référence (fond ink, texte blanc, rayon 8, padding 20 px) */}
            <m.div
              initial={reducedMotion ? false : { opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.35, ease: ease.out }}
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
                    className="mt-1 inline-flex min-h-[44px] items-center gap-3 text-left transition-opacity hover:opacity-90"
                  >
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
                    onExpire={() => setExpiredLocally(true)}
                    className="text-white [&_span]:text-white"
                  />
                </div>
              </div>
            </m.div>

            {/* 4.1.3 Montant à payer (bloc blanc, bordure silver) */}
            <m.section
              aria-labelledby="payment-amount-label"
              initial={reducedMotion ? false : { opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.35, delay: 0.06, ease: ease.out }}
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
                    aria-label={`${totalAmount} francs CFA. Appuyez pour copier le montant sans espaces`}
                    className="mt-1 inline-flex min-h-[48px] items-center gap-3 text-left transition-opacity hover:opacity-85"
                  >
                    <span className="text-[36px] sm:text-[40px] font-extrabold leading-none tabular-nums text-ink">
                      {formatPrice(animatedAmount || totalAmount)}
                    </span>
                    <span className="inline-flex h-8 items-center gap-1 rounded-[var(--radius-sm)] border border-silver bg-surface px-2.5 text-xs font-bold text-ink">
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
                  </button>
                </div>
              </div>

              {/* Détail repliable : sous-total, livraison, total */}
              <div className="mt-3 border-t border-silver/60 pt-3">
                <button
                  type="button"
                  aria-expanded={isAmountDetailsOpen}
                  onClick={() => setIsAmountDetailsOpen((prev) => !prev)}
                  className="inline-flex min-h-[40px] items-center gap-1.5 text-xs font-bold text-text-2 hover:text-ink"
                >
                  <span>Voir le détail du montant</span>
                  <ChevronDown
                    className={cn(
                      'h-4 w-4 transition-transform duration-200',
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
                      transition={{ duration: 0.2 }}
                      className="mt-2 space-y-1.5 rounded-[var(--radius-sm)] bg-surface p-3 text-xs"
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
                className="mt-4 flex items-start gap-2.5 rounded-[var(--radius-sm)] border border-warning/50 bg-surface p-3 text-xs font-semibold text-ink"
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
              transition={{ duration: 0.35, delay: 0.12, ease: ease.out }}
              className="rounded-[var(--radius-md)] border border-silver bg-white p-5"
            >
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
                          'relative flex min-h-[48px] items-center justify-center rounded-[var(--radius-sm)] px-3 py-2 text-small font-extrabold transition-colors',
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
                        <span className="relative z-10">{op.label}</span>
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
                  transition={{ duration: 0.18 }}
                  className="space-y-5"
                >
                  <div className="flex flex-wrap items-baseline justify-between gap-2 border-b border-silver/60 pb-3">
                    <div>
                      <span className="block text-xs font-semibold uppercase tracking-wider text-text-2">
                        Destinataire officiel {currentOperator.label}
                      </span>
                      <span className="mt-0.5 block text-h3 font-extrabold text-ink">
                        {currentOperator.merchantName}
                      </span>
                    </div>
                    <span className="font-mono text-small font-bold text-ink">
                      Code marchand : {currentOperator.merchantCode}
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
                            <p className="text-center text-xs font-semibold text-text-2">
                              Ouvrez l&rsquo;application Téléphone, collez le code
                              puis appelez.
                            </p>
                          </div>
                        ) : (
                          <div className="relative">
                            {/* Halo discret qui pulse toutes les 3 s avant le 1er appui (§4.4) */}
                            {!hasDialedOnce && !reducedMotion && (
                              <m.span
                                aria-hidden="true"
                                animate={{
                                  scale: [1, 1.04, 1],
                                  opacity: [0, 0.35, 0],
                                }}
                                transition={{
                                  duration: 1.4,
                                  repeat: Number.POSITIVE_INFINITY,
                                  repeatDelay: 1.6,
                                }}
                                className="pointer-events-none absolute inset-0 rounded-[var(--radius-md)] border-2 border-red"
                              />
                            )}
                            <a
                              href={ussdTelHref ?? '#'}
                              data-testid="ussd-dial-link"
                              onClick={handleDialClick}
                              className="relative inline-flex min-h-[52px] w-full items-center justify-center gap-2.5 rounded-[var(--radius-md)] bg-red px-6 py-3 text-[15px] font-semibold text-white transition-all hover:brightness-92"
                            >
                              <Phone className="h-5 w-5" aria-hidden="true" />
                              <span>Composer le code de paiement</span>
                            </a>
                          </div>
                        )}
                        {/* Le code USSD passe par le réseau téléphonique : le paiement reste possible sans Internet */}
                        {!isOnline && (
                          <p className="mt-2 text-center text-xs font-semibold text-text-2">
                            Pas besoin d&rsquo;Internet pour payer : le code passe par le réseau
                            téléphonique. Vous enverrez la capture au retour du réseau.
                          </p>
                        )}
                      </div>

                      {/* Code USSD en clair + bouton Copier (affiché partout) */}
                      <div className="flex items-center justify-between gap-3 rounded-[var(--radius-md)] border border-silver bg-surface px-4 py-3">
                        <div className="min-w-0">
                          <span className="block text-[11px] font-semibold uppercase tracking-wider text-text-2">
                            Code USSD complet
                          </span>
                          <code
                            data-testid="ussd-plain-code"
                            className="mt-0.5 block truncate font-mono text-body font-extrabold text-ink"
                          >
                            {ussdCode}
                          </code>
                        </div>
                        <button
                          type="button"
                          data-testid="copy-ussd-btn"
                          onClick={() => void handleCopyUssd()}
                          className="inline-flex min-h-[44px] shrink-0 items-center gap-1.5 rounded-[var(--radius-sm)] border border-silver bg-white px-3 py-1.5 text-xs font-bold text-ink transition-colors hover:border-ink"
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

                  {/* 4.1.6 Étapes numérotées révélées en cascade 0,08 s */}
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
                            duration: 0.25,
                            delay: reducedMotion ? 0 : idx * 0.08,
                            ease: ease.out,
                          }}
                          className="flex items-start gap-3 text-small text-ink"
                        >
                          <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-surface font-mono text-xs font-extrabold text-ink">
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
                        className="flex min-h-[44px] w-full items-center justify-between text-left text-small font-bold text-ink"
                      >
                        <span className="inline-flex items-center gap-2">
                          <QrCode className="h-4 w-4" aria-hidden="true" />
                          <span>Payer depuis un autre téléphone (QR code)</span>
                        </span>
                        <ChevronDown
                          className={cn(
                            'h-4 w-4 text-text-2 transition-transform duration-200',
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
                            transition={{ duration: 0.2 }}
                            className="mt-3 flex flex-col items-center rounded-[var(--radius-md)] border border-silver bg-surface p-5 text-center"
                          >
                            <div className="rounded-[var(--radius-md)] bg-white p-3">
                              <img
                                src={currentOperator.qrImageUrl}
                                alt={`QR code ${currentOperator.label} ${currentOperator.merchantName}`}
                                width={200}
                                height={200}
                                className="h-[200px] w-[200px] object-contain"
                              />
                            </div>
                            <p className="mt-2.5 text-small font-extrabold text-ink">
                              {currentOperator.merchantName}
                            </p>
                            <a
                              href={currentOperator.qrImageUrl}
                              download={`qr-${currentOperator.id}-${reservation.ref.toLowerCase()}.svg`}
                              className="mt-3 inline-flex min-h-[44px] items-center gap-2 rounded-[var(--radius-md)] border border-silver bg-white px-4 py-2 text-xs font-bold text-ink transition-colors hover:border-ink"
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

              {/* Bouton principal sur ordinateur dans la colonne de gauche (§4.3) */}
              <div className="mt-6 hidden lg:block">
                <Button
                  variant="primary"
                  size="lg"
                  fullWidth
                  href={`/reservation/${reservation.ref}/preuve?operator=${currentOperator.id}`}
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
                className="inline-flex min-h-[44px] items-center text-small font-bold text-ink underline hover:text-red"
              >
                Payer plus tard
              </Link>

              <button
                type="button"
                data-testid="open-cancel-sheet-btn"
                onClick={() => setIsCancelSheetOpen(true)}
                className="inline-flex min-h-[44px] items-center text-small font-bold text-danger underline hover:opacity-80"
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
                    className="h-[240px] w-[240px] object-contain"
                  />
                </div>
                <p className="mt-3 text-body font-extrabold text-ink">
                  {currentOperator.merchantName}
                </p>
                <p className="mt-0.5 font-mono text-xs font-bold text-text-2">
                  Code marchand {currentOperator.label} :{' '}
                  {currentOperator.merchantCode}
                </p>

                <div className="mt-4">
                  <a
                    href={currentOperator.qrImageUrl}
                    download={`qr-${currentOperator.id}-${reservation.ref.toLowerCase()}.svg`}
                    className="inline-flex min-h-[44px] items-center gap-2 rounded-[var(--radius-md)] border border-silver bg-white px-4 py-2 text-xs font-bold text-ink transition-colors hover:border-ink"
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
                      <p className="text-xs text-text-2">
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

              <div className="mt-4 border-t border-silver/60 pt-4 text-xs text-text-2">
                <span className="font-bold text-ink">Mode de réception : </span>
                {reservation.receptionMode === 'pickup' ? (
                  <span>Retrait en boutique (Douala Akwa)</span>
                ) : (
                  <span>
                    Livraison —{' '}
                    {reservation.city ??
                      reservation.deliveryAddress?.city ??
                      'Douala'}
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

      {/* Barre d'action collée en bas sur mobile (§4.1) */}
      <div className="fixed right-0 bottom-0 left-0 z-40 border-t border-silver/70 bg-white px-4 pt-3 pb-[calc(12px+env(safe-area-inset-bottom))] shadow-[var(--shadow-nav)] lg:hidden">
        <Button
          variant="primary"
          size="lg"
          fullWidth
          href={`/reservation/${reservation.ref}/preuve?operator=${currentOperator.id}`}
          iconRight={<ArrowRight className="h-4 w-4" aria-hidden="true" />}
        >
          J&rsquo;ai payé, envoyer ma preuve
        </Button>
      </div>

      {/* 4.2 Feuille automatique au retour depuis l'application Téléphone */}
      <Sheet
        open={isReturnSheetOpen}
        onClose={() => setIsReturnSheetOpen(false)}
        title="Paiement effectué ?"
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
            <h3 className="text-h2 text-ink">Paiement effectué ?</h3>
            <p className="mt-1.5 text-small text-text-2">
              Envoyez maintenant la capture de votre confirmation.
            </p>
          </div>

          <div className="space-y-2.5 pt-2">
            <Button
              variant="primary"
              size="lg"
              fullWidth
              href={`/reservation/${reservation.ref}/preuve?operator=${currentOperator.id}&openPicker=1`}
              onClick={() => setIsReturnSheetOpen(false)}
            >
              Envoyer ma capture
            </Button>

            <button
              type="button"
              onClick={() => setIsReturnSheetOpen(false)}
              className="inline-flex min-h-[44px] w-full items-center justify-center text-small font-bold text-text-2 underline hover:text-ink"
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
        title="Annuler la réservation ?"
      >
        <div className="space-y-4">
          <p className="text-small text-text-2">
            Vos articles seront remis en vente. Nous les replacerons dans votre
            panier si vous souhaitez modifier votre commande.
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
