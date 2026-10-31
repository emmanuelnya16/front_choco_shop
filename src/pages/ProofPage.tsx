import {
  AlertTriangle,
  ChevronDown,
  HelpCircle,
  ImagePlus,
  Maximize2,
  RefreshCw,
  Smartphone,
  Upload,
  WifiOff,
  X,
} from 'lucide-react';
import { AnimatePresence } from 'motion/react';
import * as m from 'motion/react-m';
import { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router';
import { BackButton } from '@/components/ui/BackButton';
import { Button } from '@/components/ui/Button';
import { Sheet } from '@/components/ui/Sheet';
import { isNetworkError } from '@/features/offline/networkErrors';
import { OfflineScreen } from '@/features/offline/OfflineScreen';
import { usePaymentSettings, useUploadProof } from '@/features/payment/api/usePaymentQueries';
import { ReservationExpiredOverlay } from '@/features/payment/components/ReservationExpiredOverlay';
import {
  formatFileSizeFr,
  prepareProof,
  ProofPreparationError,
  type PreparedProofResult,
} from '@/features/payment/proof/prepareProof';
import { forgetProof, recallProof, rememberProof } from '@/features/payment/proof/proofMemory';
import { useReservation } from '@/features/reservation/api/useReservationQueries';
import { CheckoutStepper } from '@/features/reservation/components/CheckoutStepper';
import { HoldCountdown } from '@/features/reservation/components/HoldCountdown';
import { ApiError } from '@/lib/api/client';
import { useBlockAppUpdate } from '@/lib/hooks/useBlockAppUpdate';
import { useOnlineStatus } from '@/lib/hooks/useOnlineStatus';
import { cn } from '@/lib/utils/cn';
import { haptic } from '@/lib/utils/haptics';
import { detectCmOperator } from '@/lib/utils/operator';
import { formatCmPhone, normalizeCmPhone } from '@/lib/utils/phone';
import { formatPrice } from '@/lib/utils/price';
import { useDocumentTitle } from '@/lib/utils/useDocumentTitle';
import { isAppOnline, useNetworkStore } from '@/pwa/networkStore';
import { useReservationStore } from '@/stores/reservationStore';
import { useToastStore } from '@/stores/toastStore';

interface PreparedProofState extends PreparedProofResult {
  previewUrl: string;
  fileName: string;
}

export function ProofPage() {
  const { ref = '' } = useParams<{ ref: string }>();
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const showToast = useToastStore((s) => s.show);

  useDocumentTitle(`Preuve de paiement ${ref}`);

  const reservationQuery = useReservation(ref, { live: true });
  const { payment, whatsappNumber } = usePaymentSettings();
  const uploadMutation = useUploadProof(ref);
  const clearActiveReservation = useReservationStore((s) => s.clearActiveReservation);

  const reservation = reservationQuery.data;

  // État réseau unique de l'app (M6 §6.1)
  const isOnline = useOnlineStatus();

  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const autoRetriedNetworkRef = useRef(false);
  const [manualOperator, setManualOperator] = useState<'orange' | 'mtn' | null>(() => {
    const paramOp = searchParams.get('operator');
    return paramOp === 'orange' || paramOp === 'mtn' ? paramOp : null;
  });

  // Capture déjà préparée pour cette réservation (mémoire seulement, M6 §6.3) : retrouvée après un
  // aller-retour vers l'écran de paiement pendant une coupure
  const [preparedProof, setPreparedProof] = useState<PreparedProofState | null>(() => recallProof(ref));
  const [isPreparingSlow, setIsPreparingSlow] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [screenshotHelpOpen, setScreenshotHelpOpen] = useState(false);
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [optionalAccordionOpen, setOptionalAccordionOpen] = useState(false);
  const [expiredOverlayOpen, setExpiredOverlayOpen] = useState(false);
  const [alreadyPaidExpiredMode, setAlreadyPaidExpiredMode] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isNetworkInterrupted, setIsNetworkInterrupted] = useState(false);

  // HYPOTHÈSE: champs facultatifs, à valider avec le client.
  const [userEditedPayerPhone, setUserEditedPayerPhone] = useState<string | null>(null);
  const [transactionId, setTransactionId] = useState('');

  const defaultPayerPhone = useMemo(() => {
    if (!reservation) return '';
    const rawPhone =
      reservation.customer?.phone ?? reservation.deliveryAddress?.recipientPhone ?? '';
    return rawPhone ? formatCmPhone(rawPhone).replace(/^\+237\s?/, '') : '';
  }, [reservation]);

  const payerPhone = userEditedPayerPhone ?? defaultPayerPhone;

  const detectedOperator = useMemo<'orange' | 'mtn'>(() => {
    if (!reservation) return 'orange';
    const op = detectCmOperator(
      reservation.customer?.phone ?? reservation.deliveryAddress?.recipientPhone ?? '',
    );
    return op === 'mtn' ? 'mtn' : 'orange';
  }, [reservation]);

  const selectedOperator: 'orange' | 'mtn' = manualOperator ?? detectedOperator;

  const operatorConfig = useMemo(
    () =>
      payment.operators.find((op) => op.id === selectedOperator) ??
      payment.operators[0],
    [payment.operators, selectedOperator],
  );

  const operatorLabel =
    operatorConfig?.label ?? (selectedOperator === 'mtn' ? 'MTN MoMo' : 'Orange Money');

  // Ouvrir directement la galerie si on arrive depuis la feuille « Paiement effectué ? » (?openPicker=1)
  useEffect(() => {
    if (searchParams.get('openPicker') === '1') {
      const nextParams = new URLSearchParams(searchParams);
      nextParams.delete('openPicker');
      setSearchParams(nextParams, { replace: true });
      const timer = window.setTimeout(() => {
        fileInputRef.current?.click();
      }, 150);
      return () => window.clearTimeout(timer);
    }
    return undefined;
  }, [searchParams, setSearchParams]);

  // Redirection selon le statut de la réservation
  useEffect(() => {
    if (!reservation) return;
    if (reservation.status === 'pending_validation') {
      navigate(`/reservation/${reservation.ref}/merci`, { replace: true });
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
      navigate(`/reservation/${reservation.ref}/merci`, { replace: true });
    }
  }, [reservation, navigate]);

  const handleSelectFile = useCallback(
    async (file: File | null | undefined) => {
      if (!file) return;
      setErrorMessage(null);
      setIsNetworkInterrupted(false);

      const slowTimer = window.setTimeout(() => {
        setIsPreparingSlow(true);
      }, 300);

      try {
        const maxMb = payment.proofMaxSizeMb ?? 10;
        const result = await prepareProof(file, { maxSizeMb: maxMb });
        // L'aperçu (URL objet) est géré par la mémoire des captures : libéré quand elle est oubliée
        setPreparedProof(
          rememberProof(ref, {
            ...result,
            fileName: file.name || `preuve-${ref.toLowerCase()}.jpg`,
          }),
        );
        haptic('light');
      } catch (err) {
        if (err instanceof ProofPreparationError) {
          setErrorMessage(err.message);
          showToast({ message: err.message });
        } else {
          const fallbackMsg =
            "Impossible de préparer cette image. Essayez avec une capture d'écran classique.";
          setErrorMessage(fallbackMsg);
          showToast({ message: fallbackMsg });
        }
      } finally {
        window.clearTimeout(slowTimer);
        setIsPreparingSlow(false);
        if (fileInputRef.current) {
          fileInputRef.current.value = '';
        }
      }
    },
    [payment.proofMaxSizeMb, ref, showToast],
  );

  // Collage depuis le presse-papiers (ordinateur)
  useEffect(() => {
    const handlePaste = (event: ClipboardEvent) => {
      const items = event.clipboardData?.items;
      if (!items) return;
      for (const item of Array.from(items)) {
        if (item.type.startsWith('image/')) {
          const pastedFile = item.getAsFile();
          if (pastedFile) {
            event.preventDefault();
            void handleSelectFile(pastedFile);
            break;
          }
        }
      }
    };
    window.addEventListener('paste', handlePaste);
    return () => window.removeEventListener('paste', handlePaste);
  }, [handleSelectFile]);

  const isResendMode = reservation?.status === 'payment_rejected';

  const submitProof = useCallback(async () => {
    if (!reservation) return;
    if (!preparedProof) {
      showToast({
        message: "Ajoutez d'abord votre capture d'écran",
      });
      fileInputRef.current?.click();
      return;
    }

    if (!isAppOnline()) {
      setErrorMessage('Reconnectez-vous pour envoyer votre preuve. Votre capture est conservée.');
      return;
    }

    setErrorMessage(null);
    setIsNetworkInterrupted(false);

    const normalizedPayer = payerPhone.trim()
      ? (normalizeCmPhone(payerPhone.trim()) ?? payerPhone.trim())
      : undefined;

    try {
      await uploadMutation.mutateAsync({
        file: preparedProof.blob,
        fileName: preparedProof.fileName,
        sha256: preparedProof.sha256,
        operator: selectedOperator,
        payerPhone: normalizedPayer,
        transactionId: transactionId.trim() || undefined,
      });

      haptic('success');
      clearActiveReservation();
      navigate(
        `/reservation/${reservation.ref}/merci?resent=${isResendMode ? '1' : '0'}&operator=${selectedOperator}`,
        { replace: true },
      );
      forgetProof(reservation.ref);
    } catch (err) {
      if (err instanceof ApiError) {
        if (err.code === 'UPLOAD_ABORTED') {
          return;
        }
        if (err.status === 409 || err.code === 'DUPLICATE_PROOF') {
          const dupMsg =
            'Cette capture a déjà été envoyée pour une autre réservation. Envoyez la capture de ce paiement-ci.';
          setErrorMessage(dupMsg);
          forgetProof(reservation.ref);
          setPreparedProof(null);
          showToast({ message: dupMsg });
          return;
        }
        if (err.status === 410 || err.code === 'RESERVATION_EXPIRED') {
          setAlreadyPaidExpiredMode(true);
          setExpiredOverlayOpen(true);
          return;
        }
        if (err.status === 413 || err.code === 'FILE_TOO_LARGE') {
          setErrorMessage('Image trop lourde.');
          return;
        }
        if (err.status === 422 || err.code === 'INVALID_STATUS') {
          const refreshed = await reservationQuery.refetch();
          const updated = refreshed.data;
          if (updated?.status === 'pending_validation' || updated?.status === 'confirmed') {
            navigate(`/reservation/${reservation.ref}/merci`, { replace: true });
          } else if (updated?.status === 'expired' || updated?.status === 'cancelled') {
            setExpiredOverlayOpen(true);
          }
          return;
        }
        // Coupure ou délai dépassé (408) : même traitement, la capture est conservée (M6 §6.3)
        if (isNetworkError(err)) {
          setIsNetworkInterrupted(true);
          setErrorMessage("L'envoi a été interrompu. Votre capture est conservée.");
          return;
        }
        setErrorMessage(err.message);
      } else {
        setIsNetworkInterrupted(true);
        setErrorMessage("L'envoi a été interrompu. Votre capture est conservée.");
      }
    }
  }, [
    reservation,
    preparedProof,
    payerPhone,
    selectedOperator,
    transactionId,
    uploadMutation,
    clearActiveReservation,
    navigate,
    isResendMode,
    showToast,
    reservationQuery,
  ]);

  // Reprise automatique une fois au retour du réseau après coupure pendant l'envoi (évènement du
  // navigateur ou première requête réussie, M6 §6.1)
  useEffect(
    () =>
      useNetworkStore.subscribe((state, previous) => {
        if (!state.online || previous.online) return;
        if (isNetworkInterrupted && preparedProof && !autoRetriedNetworkRef.current) {
          autoRetriedNetworkRef.current = true;
          void submitProof();
        }
      }),
    [isNetworkInterrupted, preparedProof, submitProof],
  );

  // Palier de progression annoncé aux lecteurs d'écran par paliers de 25 %
  const announcedProgressMilestone = Math.floor(uploadMutation.progress / 25) * 25;
  const ringRadius = 24;
  const ringCircumference = 2 * Math.PI * ringRadius;
  const ringStrokeDashoffset =
    ringCircumference * (1 - Math.min(100, Math.max(0, uploadMutation.progress)) / 100);

  const dropzoneLabelId = useId();
  const isUploading = uploadMutation.isPending;
  // Aucune mise à jour de l'application pendant l'envoi (M6 §4.7)
  useBlockAppUpdate(isUploading);

  if (reservationQuery.isLoading) {
    return (
      <div className="mx-auto max-w-[600px] px-page py-6 space-y-6">
        <div className="h-10 w-full animate-pulse rounded-[var(--radius-md)] bg-surface" />
        <div className="h-12 w-full animate-pulse rounded-[var(--radius-md)] bg-surface" />
        <div className="aspect-[4/3] w-full animate-pulse rounded-[var(--radius-md)] bg-surface" />
        <div className="h-14 w-full animate-pulse rounded-[var(--radius-md)] bg-surface" />
      </div>
    );
  }

  // Données déjà chargées : elles passent avant une relecture échouée (M6 §6.3)
  if (!reservation && (isNetworkError(reservationQuery.error) || !isOnline)) {
    return (
      <div className="px-page pt-10 pb-16">
        <OfflineScreen onRetry={() => reservationQuery.refetch()} />
      </div>
    );
  }

  if (!reservation) {
    return (
      <div className="mx-auto max-w-content px-page py-12 text-center">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-surface text-danger">
          <AlertTriangle className="h-6 w-6" aria-hidden="true" />
        </div>
        <h1 className="mt-4 text-h2 text-ink">Réservation introuvable</h1>
        <p className="mt-2 text-small text-text-2">
          Impossible de retrouver la réservation {ref}.
        </p>
        <div className="mt-6 flex justify-center">
          <Button variant="primary" onClick={() => navigate('/')}>
            Retour à l&apos;accueil
          </Button>
        </div>
      </div>
    );
  }

  const totalAmount = reservation.amount?.total ?? reservation.total;
  const rejectionReason =
    reservation.rejection?.reason ?? reservation.rejectionReason ?? 'Capture illisible';

  return (
    <div className="min-h-dvh bg-white pb-32">
      {/* 1. Indicateur d'étapes sur Preuve (étape 3) */}
      <CheckoutStepper currentStep={3} />

      <div className="mx-auto max-w-[600px] px-page pt-4">
        <div className="mb-4">
          {/* Retour (M6 §8) : écran précédent de l'app, sinon les instructions de paiement */}
          <BackButton
            fallback={`/reservation/${reservation.ref}/paiement`}
            label="Instructions de paiement"
          />
        </div>

        {/* Mode renvoi (7.2) : Bandeau danger en haut */}
        {isResendMode ? (
          <section
            role="alert"
            aria-live="polite"
            className="mb-5 space-y-3 rounded-[var(--radius-md)] border border-danger bg-danger/5 p-4"
          >
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div className="flex items-start gap-2.5">
                <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-danger" aria-hidden="true" />
                <div>
                  <h1 className="text-h3 font-bold text-danger">Paiement non validé</h1>
                  <p className="mt-0.5 text-small font-semibold text-ink">
                    Motif : {rejectionReason}
                  </p>
                </div>
              </div>
              <HoldCountdown
                expiresAt={reservation.expiresAt}
                variant="inline"
                onExpire={() => setExpiredOverlayOpen(true)}
              />
            </div>

            <div className="flex flex-wrap items-center justify-between gap-2 border-t border-danger/20 pt-2.5 text-small">
              <span className="text-text-2">
                Montant exact attendu :{' '}
                <strong className="font-mono font-bold text-ink">
                  {formatPrice(totalAmount)}
                </strong>
              </span>
              <Link
                to={`/reservation/${reservation.ref}/paiement`}
                className="font-bold text-ink underline underline-offset-4 hover:text-red"
              >
                Revoir les instructions de paiement
              </Link>
            </div>

            {/* Miniature de la preuve précédente barrée */}
            {reservation.proof?.thumbnailUrl ? (
              <div className="flex items-center gap-3 rounded-[var(--radius-sm)] border border-silver bg-white p-2.5">
                <div className="relative h-14 w-14 shrink-0 overflow-hidden rounded-[var(--radius-sm)] border border-danger/40 bg-surface">
                  {/* Photo privée, jamais enregistrée : pas d'image cassée hors connexion */}
                  {isOnline ? (
                    <img
                      src={reservation.proof.thumbnailUrl}
                      alt="Capture précédente refusée"
                      className="h-full w-full object-cover opacity-50 grayscale"
                    />
                  ) : null}
                  <div
                    className="pointer-events-none absolute inset-0 flex items-center justify-center"
                    aria-hidden="true"
                  >
                    <span className="h-0.5 w-full -rotate-45 bg-danger" />
                  </div>
                </div>
                <div className="min-w-0">
                  <span className="inline-flex rounded-[var(--radius-sm)] bg-danger px-2 py-0.5 text-label text-white">
                    Capture refusée
                  </span>
                  <p className="mt-1 text-xs text-text-2">
                    Veuillez envoyer une nouvelle capture nette montrant la transaction complète.
                  </p>
                </div>
              </div>
            ) : null}
          </section>
        ) : null}

        {/* 2. Rappel compact : « RES-000124 · 63 000 FCFA · Orange Money » + « Changer » */}
        <div className="mb-5 flex flex-wrap items-center justify-between gap-2 rounded-[var(--radius-md)] border border-silver bg-surface px-4 py-3">
          <p className="text-small font-bold text-ink">
            <span className="font-mono">{reservation.ref}</span>
            <span className="mx-1.5 text-text-2">·</span>
            <span
              className="text-price"
              aria-label={`${totalAmount.toLocaleString('fr-FR')} francs CFA`}
            >
              {formatPrice(totalAmount)}
            </span>
            <span className="mx-1.5 text-text-2">·</span>
            <span>{operatorLabel}</span>
          </p>
          <button
            type="button"
            onClick={() => {
              const nextOp = selectedOperator === 'orange' ? 'mtn' : 'orange';
              setManualOperator(nextOp);
              haptic('light');
            }}
            className="min-h-[36px] text-small font-bold text-ink underline underline-offset-4 hover:text-red"
          >
            Changer
          </button>
        </div>

        {/* Champ fichier natif vers la galerie (SANS attribut capture) */}
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          className="sr-only"
          aria-labelledby={dropzoneLabelId}
          onChange={(e) => {
            const selected = e.target.files?.[0];
            void handleSelectFile(selected);
          }}
        />

        {/* 3 & 4. Zone d'envoi ou Aperçu */}
        <section aria-labelledby={dropzoneLabelId} className="space-y-3">
          {!preparedProof ? (
            <div>
              <div
                role="button"
                tabIndex={0}
                onClick={() => fileInputRef.current?.click()}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    fileInputRef.current?.click();
                  }
                }}
                onDragOver={(e) => {
                  e.preventDefault();
                  setIsDragging(true);
                }}
                onDragLeave={() => setIsDragging(false)}
                onDrop={(e) => {
                  e.preventDefault();
                  setIsDragging(false);
                  const droppedFile = e.dataTransfer.files?.[0];
                  void handleSelectFile(droppedFile);
                }}
                className={cn(
                  'flex aspect-[4/3] w-full cursor-pointer flex-col items-center justify-center rounded-[var(--radius-md)] border-2 p-6 text-center transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink',
                  isDragging
                    ? 'border-solid border-ink bg-surface'
                    : 'border-dashed border-silver bg-white hover:border-ink hover:bg-surface/50',
                )}
              >
                <div className="flex h-16 w-16 items-center justify-center rounded-full bg-surface text-ink">
                  <ImagePlus className="h-10 w-10" aria-hidden="true" />
                </div>
                <p id={dropzoneLabelId} className="mt-4 text-h3 font-bold text-ink">
                  {isResendMode ? 'Envoyer une nouvelle capture' : "Ajouter ma capture d'écran"}
                </p>
                <p className="mt-1.5 max-w-xs text-small text-text-2">
                  Le message de confirmation Orange Money ou MTN MoMo
                </p>
                <p className="mt-3 hidden text-xs text-text-2 lg:block">
                  Glissez-déposez une image ici ou collez-la avec Ctrl+V
                </p>
                {isPreparingSlow ? (
                  <p className="mt-3 text-small font-semibold text-ink" aria-live="polite">
                    Préparation de l&apos;image…
                  </p>
                ) : null}
              </div>

              <div className="mt-2.5 flex justify-center">
                <button
                  type="button"
                  onClick={() => setScreenshotHelpOpen(true)}
                  className="inline-flex min-h-[44px] items-center gap-1.5 text-small font-semibold text-text-2 underline underline-offset-4 hover:text-ink"
                >
                  <HelpCircle className="h-4 w-4" aria-hidden="true" />
                  Comment faire une capture d&apos;écran ?
                </button>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              <h2 id={dropzoneLabelId} className="sr-only">
                Aperçu de votre capture d&apos;écran
              </h2>
              <div className="relative aspect-[4/3] w-full overflow-hidden rounded-[var(--radius-md)] border border-silver bg-surface">
                <img
                  src={preparedProof.previewUrl}
                  alt="Aperçu de la preuve de paiement"
                  className={cn(
                    'h-full w-full object-contain transition-opacity duration-200',
                    isUploading ? 'opacity-70' : 'opacity-100',
                  )}
                />
                {isUploading ? (
                  <div
                    className="pointer-events-none absolute inset-0 bg-ink/20"
                    aria-hidden="true"
                  />
                ) : null}

                {/* Poids final affiché (« 284 Ko ») */}
                <div className="absolute left-3 top-3 rounded-[var(--radius-sm)] bg-ink/85 px-2.5 py-1 font-mono text-xs font-bold text-white">
                  {formatFileSizeFr(preparedProof.finalSizeBytes)}
                </div>
              </div>

              {/* Boutons « Changer » et « Agrandir » */}
              <div className="flex items-center justify-between gap-3">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={isUploading}
                  iconLeft={<RefreshCw className="h-4 w-4" />}
                  onClick={() => fileInputRef.current?.click()}
                >
                  Changer
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  iconLeft={<Maximize2 className="h-4 w-4" />}
                  onClick={() => setLightboxOpen(true)}
                >
                  Agrandir
                </Button>
              </div>
            </div>
          )}
        </section>

        {/* Message d'erreur ou de coupure réseau */}
        {errorMessage ? (
          <div
            role="alert"
            aria-live="polite"
            className="mt-4 rounded-[var(--radius-md)] border border-danger bg-danger/5 p-4 text-small text-ink"
          >
            <div className="flex items-start gap-2.5">
              <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-danger" aria-hidden="true" />
              <div className="flex-1">
                <p className="font-semibold text-danger">{errorMessage}</p>
                {isNetworkInterrupted && preparedProof ? (
                  <div className="mt-3">
                    <Button
                      variant="primary"
                      size="sm"
                      onClick={() => {
                        autoRetriedNetworkRef.current = false;
                        void submitProof();
                      }}
                    >
                      Réessayer
                    </Button>
                  </div>
                ) : null}
              </div>
            </div>
          </div>
        ) : null}

        {/* 5. Informations facultatives (accordéon replié par défaut) */}
        <div className="mt-6 rounded-[var(--radius-md)] border border-silver bg-white">
          <button
            type="button"
            aria-expanded={optionalAccordionOpen}
            onClick={() => setOptionalAccordionOpen((prev) => !prev)}
            className="flex min-h-[48px] w-full items-center justify-between gap-3 px-4 py-3 text-left text-small font-bold text-ink"
          >
            <span>Aider la boutique à vérifier plus vite</span>
            <ChevronDown
              className={cn(
                'h-4 w-4 shrink-0 text-text-2 transition-transform duration-200',
                optionalAccordionOpen && 'rotate-180',
              )}
              aria-hidden="true"
            />
          </button>

          <AnimatePresence initial={false}>
            {optionalAccordionOpen ? (
              <m.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.22 }}
                className="overflow-hidden"
              >
                <div className="space-y-4 border-t border-silver/60 px-4 pb-4 pt-3">
                  <div>
                    <label
                      htmlFor="proof-payer-phone"
                      className="block text-small font-semibold text-ink"
                    >
                      Numéro qui a payé
                    </label>
                    <div className="mt-1.5 flex items-center overflow-hidden rounded-[var(--radius-md)] border border-silver bg-white focus-within:border-ink">
                      <span className="border-r border-silver bg-surface px-3 py-2.5 font-mono text-small font-bold text-ink">
                        +237
                      </span>
                      <input
                        id="proof-payer-phone"
                        type="tel"
                        inputMode="tel"
                        value={payerPhone}
                        onChange={(e) => setUserEditedPayerPhone(e.target.value)}
                        className="min-h-[44px] w-full bg-transparent px-3 font-mono text-body text-ink focus:outline-none"
                      />
                    </div>
                    <p className="mt-1 text-xs text-text-2">
                      Utile si un proche a effectué le paiement pour vous.
                    </p>
                  </div>

                  <div>
                    <label
                      htmlFor="proof-tx-id"
                      className="block text-small font-semibold text-ink"
                    >
                      Identifiant de la transaction
                    </label>
                    <input
                      id="proof-tx-id"
                      type="text"
                      value={transactionId}
                      onChange={(e) => setTransactionId(e.target.value)}
                      placeholder="PP241030.1142.A12345"
                      className="mt-1.5 min-h-[44px] w-full rounded-[var(--radius-md)] border border-silver bg-white px-3.5 font-mono text-small text-ink focus:border-ink focus:outline-none"
                    />
                    <p className="mt-1 text-xs text-text-2">
                      Il figure dans le SMS de confirmation, ex. : PP241030.1142.A12345
                    </p>
                  </div>
                </div>
              </m.div>
            ) : null}
          </AnimatePresence>
        </div>

        {/* 6. Barre d'action avec transformation en anneau de progression 56 px */}
        <div className="mt-8">
          {/* Annonce vocale par paliers de 25 % */}
          <div className="sr-only" aria-live="polite">
            {isUploading
              ? `Envoi de la preuve en cours : ${announcedProgressMilestone} pourcent`
              : ''}
          </div>

          {!isOnline && !isUploading ? (
            <div className="space-y-2">
              <Button
                variant="primary"
                size="lg"
                fullWidth
                disabled
                iconLeft={<WifiOff className="h-5 w-5" />}
              >
                Reconnectez-vous pour envoyer votre preuve.
              </Button>
              {/* Envoi bloqué hors connexion : explication, la capture reste sur l'écran (M6 §6.3) */}
              <p role="status" className="text-center text-small text-text-2">
                {preparedProof
                  ? 'Votre capture est gardée sur cet écran : vous pourrez l’envoyer dès le retour du réseau.'
                  : 'Vous pouvez déjà choisir votre capture : elle sera gardée jusqu’au retour du réseau.'}
              </p>
            </div>
          ) : isUploading ? (
            <div className="flex flex-col items-center justify-center space-y-3 py-2">
              <m.div
                layoutId="proof-submit-morph"
                className="relative flex h-14 w-14 items-center justify-center rounded-full bg-surface"
              >
                <svg className="h-14 w-14 -rotate-90" viewBox="0 0 56 56" aria-hidden="true">
                  <circle
                    cx="28"
                    cy="28"
                    r={ringRadius}
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="4"
                    className="text-silver"
                  />
                  <circle
                    cx="28"
                    cy="28"
                    r={ringRadius}
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="4"
                    strokeLinecap="round"
                    strokeDasharray={ringCircumference}
                    strokeDashoffset={ringStrokeDashoffset}
                    className="text-red transition-[stroke-dashoffset] duration-150"
                  />
                </svg>
                <span className="absolute font-mono text-xs font-extrabold tabular-nums text-ink">
                  {uploadMutation.progress}%
                </span>
              </m.div>

              <button
                type="button"
                onClick={() => {
                  uploadMutation.cancelUpload();
                  haptic('light');
                }}
                className="min-h-[40px] px-3 text-small font-semibold text-text-2 underline underline-offset-4 hover:text-ink"
              >
                Annuler l&apos;envoi
              </button>
            </div>
          ) : (
            <m.div layoutId="proof-submit-morph">
              <Button
                variant="primary"
                size="lg"
                fullWidth
                iconLeft={<Upload className="h-5 w-5" />}
                onClick={() => void submitProof()}
                aria-disabled={!preparedProof}
                className={cn(!preparedProof && 'opacity-60')}
              >
                Envoyer ma preuve
              </Button>
            </m.div>
          )}
        </div>
      </div>

      {/* Feuille d'aide « Comment faire une capture d'écran ? » */}
      <Sheet
        open={screenshotHelpOpen}
        onClose={() => setScreenshotHelpOpen(false)}
        title="Comment faire une capture d'écran ?"
      >
        <div className="space-y-4">
          <div className="flex items-start gap-3 rounded-[var(--radius-md)] border border-silver bg-surface p-4">
            <Smartphone className="mt-0.5 h-5 w-5 shrink-0 text-ink" aria-hidden="true" />
            <div>
              <h3 className="text-small font-bold text-ink">Sur Android</h3>
              <p className="mt-1 text-small text-text-2">
                Appuyez en même temps sur le <strong>bouton Marche/Arrêt</strong> et le{' '}
                <strong>bouton Volume bas</strong> pendant une seconde.
              </p>
            </div>
          </div>

          <div className="flex items-start gap-3 rounded-[var(--radius-md)] border border-silver bg-surface p-4">
            <Smartphone className="mt-0.5 h-5 w-5 shrink-0 text-ink" aria-hidden="true" />
            <div>
              <h3 className="text-small font-bold text-ink">Sur iPhone</h3>
              <p className="mt-1 text-small text-text-2">
                Appuyez en même temps sur le <strong>bouton latéral droit</strong> et le{' '}
                <strong>bouton Volume haut</strong>, puis relâchez vite.
              </p>
            </div>
          </div>

          <Button variant="primary" fullWidth onClick={() => setScreenshotHelpOpen(false)}>
            J&apos;ai compris
          </Button>
        </div>
      </Sheet>

      {/* Visionneuse simple (« Agrandir ») */}
      <AnimatePresence>
        {lightboxOpen && preparedProof ? (
          <m.div
            role="dialog"
            aria-modal="true"
            aria-label="Aperçu agrandi de la capture"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setLightboxOpen(false)}
            className="fixed inset-0 z-sheet flex items-center justify-center bg-ink/85 p-4"
          >
            <div
              onClick={(e) => e.stopPropagation()}
              className="relative max-h-[90dvh] w-full max-w-lg overflow-hidden rounded-[var(--radius-md)] bg-white p-3"
            >
              <div className="mb-2 flex items-center justify-between">
                <span className="font-mono text-xs font-bold text-text-2">
                  {formatFileSizeFr(preparedProof.finalSizeBytes)} ({preparedProof.width}×
                  {preparedProof.height})
                </span>
                <button
                  type="button"
                  onClick={() => setLightboxOpen(false)}
                  aria-label="Fermer l'aperçu"
                  className="inline-flex h-10 w-10 items-center justify-center rounded-full text-ink hover:bg-surface"
                >
                  <X className="h-5 w-5" aria-hidden="true" />
                </button>
              </div>
              <div className="max-h-[75dvh] overflow-auto rounded-[var(--radius-sm)] bg-surface p-2">
                <img
                  src={preparedProof.previewUrl}
                  alt="Capture d'écran agrandie"
                  className="mx-auto max-h-[70dvh] w-auto object-contain"
                />
              </div>
            </div>
          </m.div>
        ) : null}
      </AnimatePresence>

      {/* Calque d'expiration (7.3) */}
      <ReservationExpiredOverlay
        open={
          expiredOverlayOpen ||
          reservation.status === 'expired' ||
          reservation.status === 'cancelled'
        }
        reservation={reservation}
        whatsappNumber={whatsappNumber}
        showAlreadyPaidHelp={alreadyPaidExpiredMode}
      />
    </div>
  );
}
