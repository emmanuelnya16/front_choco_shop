import {
  AlertTriangle,
  Bell,
  Check,
  Clock,
  MessageCircle,
  ShoppingBag,
  Smartphone,
} from 'lucide-react';
import { AnimatePresence } from 'motion/react';
import * as m from 'motion/react-m';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router';
import { Button } from '@/components/ui/Button';
import { pushService } from '@/features/notifications/pushService';
import { isNetworkError } from '@/features/offline/networkErrors';
import { OfflineScreen } from '@/features/offline/OfflineScreen';
import { usePaymentSettings } from '@/features/payment/api/usePaymentQueries';
import { buildWhatsAppPaymentUrl } from '@/features/payment/whatsapp';
import { useReservation } from '@/features/reservation/api/useReservationQueries';
import { CheckoutStepper } from '@/features/reservation/components/CheckoutStepper';
import { gsap, useGSAP } from '@/lib/gsap';
import { useOnlineStatus } from '@/lib/hooks/useOnlineStatus';
import { cn } from '@/lib/utils/cn';
import { formatDate } from '@/lib/utils/date';
import { haptic } from '@/lib/utils/haptics';
import { detectCmOperator } from '@/lib/utils/operator';
import { useDocumentTitle } from '@/lib/utils/useDocumentTitle';
import { useReducedMotionPref } from '@/motion/useReducedMotionPref';
import { useToastStore } from '@/stores/toastStore';
import { STATUS_META } from '@/types/reservationStatus';

export function SuccessPage() {
  const { ref = '' } = useParams<{ ref: string }>();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const showToast = useToastStore((s) => s.show);
  const reducedMotion = useReducedMotionPref();

  useDocumentTitle(`Merci · Réservation ${ref}`);

  const reservationQuery = useReservation(ref, { live: true });
  const { payment, whatsappNumber } = usePaymentSettings();
  const isOnline = useOnlineStatus();

  const reservation = reservationQuery.data;

  const isResent = searchParams.get('resent') === '1';

  const containerRef = useRef<HTMLDivElement | null>(null);
  const ringCircleRef = useRef<SVGCircleElement | null>(null);
  const discRef = useRef<HTMLDivElement | null>(null);
  const checkPathRef = useRef<SVGPathElement | null>(null);
  const titleTextRef = useRef<HTMLHeadingElement | null>(null);
  const hasPlayedIntroRef = useRef(false);
  const prevStatusRef = useRef<string | undefined>(undefined);

  const [notifCardVisible, setNotifCardVisible] = useState<boolean>(() => {
    if (pushService.isIosWithoutHomeScreenInstall()) {
      return !pushService.isPushPromptDismissed();
    }
    return (
      pushService.isNotificationSupported() &&
      pushService.getNotificationPermission() === 'default' &&
      !pushService.isPushPromptDismissed()
    );
  });

  const isIosNotInstalled = useMemo(() => pushService.isIosWithoutHomeScreenInstall(), []);

  const isConfirmed =
    reservation?.status === 'confirmed' ||
    reservation?.status === 'preparing' ||
    reservation?.status === 'ready_for_pickup' ||
    reservation?.status === 'handed_to_agency' ||
    reservation?.status === 'in_delivery' ||
    reservation?.status === 'delivered' ||
    reservation?.status === 'picked_up';

  // Surveillance en direct du changement de statut (7.1)
  useEffect(() => {
    if (!reservation) return;
    const prev = prevStatusRef.current;
    prevStatusRef.current = reservation.status;

    if (reservation.status === 'payment_rejected') {
      showToast({
        message:
          reservation.rejection?.reason ??
          reservation.rejectionReason ??
          'Paiement non validé : veuillez envoyer une nouvelle capture.',
      });
      navigate(`/reservation/${reservation.ref}/preuve`, { replace: true });
      return;
    }

    if (prev && prev === 'pending_validation' && reservation.status === 'confirmed') {
      haptic('success');
      showToast({
        message: 'Paiement validé !',
      });

      if (!reducedMotion && titleTextRef.current) {
        gsap.fromTo(
          titleTextRef.current,
          { yPercent: 110 },
          { yPercent: 0, duration: 0.7, ease: 'power4.out' },
        );
      }
    }
  }, [reservation, navigate, showToast, reducedMotion]);

  // Animation GSAP d'entrée (6.2 — ~1,6 s)
  useGSAP(
    () => {
      if (!reservation || hasPlayedIntroRef.current) return;
      hasPlayedIntroRef.current = true;

      if (reducedMotion) {
        gsap.set('[data-gsap="cascade"]', { autoAlpha: 1, y: 0 });
        gsap.set('[data-gsap="actions"]', { autoAlpha: 1, y: 0 });
        if (titleTextRef.current) {
          gsap.set(titleTextRef.current, { yPercent: 0 });
        }
        if (discRef.current) {
          gsap.set(discRef.current, { scale: 1, autoAlpha: 1 });
        }
        if (checkPathRef.current) {
          gsap.set(checkPathRef.current, { drawSVG: '100%' });
        }
        return;
      }

      const tl = gsap.timeline();

      // 0 s : L'anneau finit de se refermer et grossit jusqu'à 96 px
      if (ringCircleRef.current) {
        tl.fromTo(
          ringCircleRef.current,
          { strokeDashoffset: 70, scale: 0.65, transformOrigin: '50% 50%' },
          { strokeDashoffset: 0, scale: 1, duration: 0.35, ease: 'power2.out' },
          0,
        );
      }

      // 0,35 s : Disque success + tracé de la coche blanche (DrawSVG 0,4 s) + haptic('success')
      if (discRef.current) {
        tl.fromTo(
          discRef.current,
          { scale: 0.5, autoAlpha: 0 },
          {
            scale: 1,
            autoAlpha: 1,
            duration: 0.35,
            ease: 'back.out(1.6)',
            onStart: () => {
              haptic('success');
            },
          },
          0.35,
        );
      }

      if (checkPathRef.current) {
        tl.fromTo(
          checkPathRef.current,
          { drawSVG: '0%' },
          { drawSVG: '100%', duration: 0.4, ease: 'power2.out' },
          0.38,
        );
      }

      // 0,7 s : « MERCI ! » monte de derrière son masque (yPercent 110 -> 0, 0,8 s, power4.out)
      if (titleTextRef.current) {
        tl.fromTo(
          titleTextRef.current,
          { yPercent: 110 },
          { yPercent: 0, duration: 0.8, ease: 'power4.out' },
          0.7,
        );
      }

      // 0,95 s : Texte, badge et frise apparaissent en cascade (autoAlpha + y 12, décalage 0,08 s)
      tl.fromTo(
        '[data-gsap="cascade"]',
        { autoAlpha: 0, y: 12 },
        { autoAlpha: 1, y: 0, duration: 0.4, stagger: 0.08, ease: 'power3.out' },
        0.95,
      );

      // 1,3 s : Les boutons apparaissent ; le bouton WhatsApp fait un léger rebond
      tl.fromTo(
        '[data-gsap="actions"]',
        { autoAlpha: 0, y: 12 },
        { autoAlpha: 1, y: 0, duration: 0.35, stagger: 0.06, ease: 'power2.out' },
        1.3,
      );

      tl.fromTo(
        '[data-gsap="whatsapp-btn"]',
        { scale: 0.96 },
        { scale: 1, duration: 0.45, ease: 'back.out(2.2)' },
        1.35,
      );
    },
    { scope: containerRef, dependencies: [Boolean(reservation), reducedMotion] },
  );

  const operatorLabel = useMemo(() => {
    const paramOp = searchParams.get('operator');
    const op =
      paramOp === 'orange' || paramOp === 'mtn'
        ? paramOp
        : (reservation?.proof?.operator ??
          (reservation
            ? detectCmOperator(
                reservation.customer?.phone ?? reservation.deliveryAddress?.recipientPhone ?? '',
              ) === 'mtn'
              ? 'mtn'
              : 'orange'
            : 'orange'));

    const found = payment.operators.find((item) => item.id === op);
    return found?.label ?? (op === 'mtn' ? 'MTN MoMo' : 'Orange Money');
  }, [searchParams, reservation, payment.operators]);

  const whatsappUrl = useMemo(() => {
    if (!reservation) return '#';
    return buildWhatsAppPaymentUrl(whatsappNumber, {
      reservation,
      operatorLabel,
    });
  }, [reservation, whatsappNumber, operatorLabel]);

  const handleActivateNotifications = async () => {
    const perm = await pushService.requestPermission();
    setNotifCardVisible(false);
    if (perm === 'granted') {
      await pushService.subscribe();
      showToast({
        message: 'Notifications activées ! Vous serez prévenu dès la validation.',
      });
    } else if (perm === 'denied') {
      showToast({
        message: 'Notifications refusées. Vous pourrez suivre votre réservation depuis votre compte.',
      });
    }
  };

  const handleDismissNotifications = () => {
    pushService.dismissPushPromptFor7Days();
    setNotifCardVisible(false);
  };

  if (reservationQuery.isLoading) {
    return (
      <div className="mx-auto max-w-[560px] px-page py-8 space-y-6">
        <div className="mx-auto h-24 w-24 animate-pulse rounded-full bg-surface" />
        <div className="mx-auto h-12 w-48 animate-pulse rounded-[var(--radius-md)] bg-surface" />
        <div className="h-44 w-full animate-pulse rounded-[var(--radius-md)] bg-surface" />
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

  const activeStatusCode = isConfirmed ? 'confirmed' : 'pending_validation';
  const statusMeta = STATUS_META[activeStatusCode];
  const StatusIcon = statusMeta.Icon;

  const proofTimeText = formatDate(reservation.proof?.uploadedAt ?? reservation.createdAt);
  const validationDelayText =
    payment.validationDelayText ?? "en général en moins d'une heure, de 8 h à 20 h";

  return (
    <div ref={containerRef} className="min-h-dvh bg-white pb-24">
      <CheckoutStepper currentStep={3} />

      <div className="mx-auto max-w-[560px] px-page pt-6">
        {/* 1. Disque animé 96 px + coche DrawSVG + Titre masqué */}
        <div className="flex flex-col items-center text-center">
          <div className="relative flex h-24 w-24 items-center justify-center">
            <svg
              className="absolute inset-0 h-24 w-24 -rotate-90"
              viewBox="0 0 96 96"
              aria-hidden="true"
            >
              <circle
                ref={ringCircleRef}
                cx="48"
                cy="48"
                r="44"
                fill="none"
                stroke="currentColor"
                strokeWidth="4"
                strokeDasharray="276"
                strokeDashoffset="0"
                className="text-success/30"
              />
            </svg>

            <div
              ref={discRef}
              className="flex h-20 w-20 items-center justify-center rounded-full bg-success text-white shadow-sm"
            >
              <svg className="h-10 w-10" viewBox="0 0 40 40" fill="none" aria-hidden="true">
                <path
                  ref={checkPathRef}
                  d="M10 21.5L17 28.5L30.5 13.5"
                  stroke="currentColor"
                  strokeWidth="4"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </div>
          </div>

          {/* Titre text-display avec révélation par masque */}
          <div className="mask-line mt-5">
            <h1 ref={titleTextRef} className="text-display text-ink">
              {isConfirmed ? "C'EST CONFIRMÉ !" : 'MERCI !'}
            </h1>
          </div>

          {/* 2. Texte de confirmation */}
          <p data-gsap="cascade" className="mt-2 text-body text-text-2">
            {isConfirmed
              ? 'Votre paiement a été validé par la boutique.'
              : isResent
                ? 'Nouvelle preuve reçue.'
                : 'Nous avons bien reçu votre preuve de paiement.'}
          </p>

          {/* 3. Badge de statut avec transition en direct (7.1) */}
          <div data-gsap="cascade" className="mt-4 min-h-[36px]" aria-live="polite">
            <AnimatePresence mode="wait">
              <m.div
                key={activeStatusCode}
                initial={reducedMotion ? false : { opacity: 0, y: 10, scale: 0.96 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={reducedMotion ? undefined : { opacity: 0, y: -10, scale: 0.96 }}
                transition={{ duration: 0.25 }}
              >
                <span
                  className={cn(
                    'inline-flex items-center gap-1.5 rounded-[var(--radius-full)] px-3.5 py-1.5 text-small font-bold text-white',
                    statusMeta.tone === 'success' ? 'bg-success' : 'bg-warning',
                  )}
                >
                  <StatusIcon className="h-4 w-4 shrink-0" aria-hidden="true" />
                  <span>{statusMeta.label}</span>
                </span>
              </m.div>
            </AnimatePresence>
          </div>
        </div>

        {/* 4. Mini-frise verticale de 3 étapes (« Ce qui va se passer ») */}
        <section
          data-gsap="cascade"
          aria-label="Ce qui va se passer"
          className="mt-7 rounded-[var(--radius-md)] border border-silver bg-surface p-5"
        >
          <p className="text-label text-text-2">CE QUI VA SE PASSER · {reservation.ref}</p>

          <ol className="mt-4 space-y-0">
            {/* Étape 1 : Preuve envoyée */}
            <li className="relative flex gap-3.5 pb-5">
              <div className="flex flex-col items-center">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-success text-white">
                  <Check className="h-3.5 w-3.5" aria-hidden="true" />
                </span>
                <span
                  className={cn(
                    'mt-1 w-0.5 flex-1 transition-colors duration-500',
                    isConfirmed ? 'bg-success' : 'bg-silver',
                  )}
                  aria-hidden="true"
                />
              </div>
              <div className="min-w-0 pt-0.5">
                <p className="text-small font-bold text-ink">Preuve envoyée</p>
                <p className="mt-0.5 text-xs text-text-2">{proofTimeText}</p>
              </div>
            </li>

            {/* Étape 2 : Vérification par la boutique */}
            <li className="relative flex gap-3.5 pb-5">
              <div className="flex flex-col items-center">
                <span
                  className={cn(
                    'flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-2 transition-colors duration-300',
                    isConfirmed
                      ? 'border-success bg-success text-white'
                      : 'border-warning bg-white text-warning',
                  )}
                >
                  {isConfirmed ? (
                    <Check className="h-3.5 w-3.5" aria-hidden="true" />
                  ) : (
                    <Clock className="h-3.5 w-3.5" aria-hidden="true" />
                  )}
                </span>
                <span className="mt-1 w-0.5 flex-1 bg-silver" aria-hidden="true" />
              </div>
              <div className="min-w-0 pt-0.5">
                <p className="text-small font-bold text-ink">
                  {isConfirmed ? 'Paiement validé par la boutique' : 'Vérification par la boutique'}
                </p>
                <p className="mt-0.5 text-xs text-text-2">
                  {isConfirmed
                    ? 'Votre stock est définitivement attribué à votre commande.'
                    : validationDelayText}
                </p>
              </div>
            </li>

            {/* Étape 3 : Confirmation par SMS & photo du colis */}
            <li className="relative flex gap-3.5">
              <div className="flex flex-col items-center">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-2 border-silver bg-white text-text-2">
                  <span className="h-2 w-2 rounded-full bg-silver" aria-hidden="true" />
                </span>
              </div>
              <div className="min-w-0 pt-0.5">
                <p className="text-small font-bold text-ink">
                  Confirmation par SMS, puis préparation de votre colis avec photo avant
                  l&apos;envoi
                </p>
              </div>
            </li>
          </ol>
        </section>

        {/* 5. Prévenir la boutique sur WhatsApp */}
        <div data-gsap="actions" className="mt-6 space-y-2 text-center">
          <div data-gsap="whatsapp-btn">
            <Button
              variant="dark"
              size="lg"
              fullWidth
              href={whatsappUrl}
              external
              iconLeft={<MessageCircle className="h-5 w-5" />}
              onClick={() => haptic('light')}
            >
              Prévenir la boutique sur WhatsApp
            </Button>
          </div>
          <p className="text-xs text-text-2">Facultatif : la boutique est déjà prévenue.</p>
        </div>

        {/* 6. Carte « Être prévenu » (notifications 6.4) */}
        {notifCardVisible ? (
          <section
            data-gsap="actions"
            aria-label="Notifications de suivi"
            className="mt-6 rounded-[var(--radius-md)] border border-silver/60 bg-surface p-4"
          >
            {isIosNotInstalled ? (
              <div className="flex items-start gap-3">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[var(--radius-sm)] bg-white text-ink">
                  <Smartphone className="h-5 w-5" aria-hidden="true" />
                </div>
                <div className="flex-1">
                  <h2 className="text-small font-bold text-ink">
                    Ajoutez l&apos;app à votre écran d&apos;accueil pour recevoir les notifications
                  </h2>
                  <div className="mt-3 flex flex-wrap items-center gap-3">
                    <button
                      type="button"
                      onClick={() => {
                        showToast({
                          message: 'Bientôt disponible',
                        });
                      }}
                      className="text-small font-bold text-ink underline underline-offset-4 hover:text-red"
                    >
                      Voir comment installer
                    </button>
                    <button
                      type="button"
                      onClick={handleDismissNotifications}
                      className="text-small font-semibold text-text-2 hover:text-ink"
                    >
                      Non merci
                    </button>
                  </div>
                </div>
              </div>
            ) : (
              <div className="flex items-start gap-3">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[var(--radius-sm)] bg-white text-ink">
                  <Bell className="h-5 w-5" aria-hidden="true" />
                </div>
                <div className="flex-1">
                  <h2 className="text-small font-bold text-ink">Être prévenu dès la validation</h2>
                  <p className="mt-1 text-small text-text-2">
                    Recevez une notification quand votre paiement est validé et quand votre colis
                    est prêt.
                  </p>
                  <div className="mt-3 flex flex-wrap items-center gap-3">
                    <Button
                      variant="primary"
                      size="sm"
                      onClick={() => void handleActivateNotifications()}
                    >
                      Activer
                    </Button>
                    <button
                      type="button"
                      onClick={handleDismissNotifications}
                      className="min-h-[36px] px-2 text-small font-semibold text-text-2 underline underline-offset-4 hover:text-ink"
                    >
                      Non merci
                    </button>
                  </div>
                </div>
              </div>
            )}
          </section>
        ) : null}

        {/* 7. Boutons de navigation */}
        <div data-gsap="actions" className="mt-6 space-y-3">
          <Button
            variant="primary"
            size="lg"
            fullWidth
            onClick={() => navigate(`/reservations/${reservation.ref}`)}
          >
            Suivre ma réservation
          </Button>

          <Button
            variant="outline"
            size="md"
            fullWidth
            iconLeft={<ShoppingBag className="h-4 w-4" />}
            onClick={() => navigate('/explorer')}
          >
            Continuer mes achats
          </Button>
        </div>
      </div>
    </div>
  );
}
