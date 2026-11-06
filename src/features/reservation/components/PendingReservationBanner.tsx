import { AnimatePresence } from 'motion/react';
import * as m from 'motion/react-m';
import { AlertCircle, Clock, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useLocation } from 'react-router';
import { Button } from '@/components/ui/Button';
import { isReservationPath } from '@/components/layout/bottomNavVisibility';
import { Container } from '@/components/ui/Primitives';
import { usePendingReservations } from '@/features/reservation/api/useReservationQueries';
import { cn } from '@/lib/utils/cn';
import { spring } from '@/motion/tokens';
import { useReducedMotionPref } from '@/motion/useReducedMotionPref';
import { useReservationStore } from '@/stores/reservationStore';
import { useToastStore } from '@/stores/toastStore';
import { HoldCountdown } from './HoldCountdown';

const TWO_HOURS_MS = 2 * 60 * 60 * 1000;
const EXPIRY_WARNING_SESSION_KEY = 'drc_expiry_2h_toast_shown_ref';

function formatRemainingShort(ms: number): string {
  const totalMins = Math.max(1, Math.floor(ms / 60_000));
  const hours = Math.floor(totalMins / 60);
  const mins = totalMins % 60;
  if (hours > 0) {
    return `${hours}\u00A0h\u00A0${String(mins).padStart(2, '0')}`;
  }
  return `${mins}\u00A0min`;
}

/**
 * Bandeau collant « Réservation en attente de paiement » ou « Paiement non validé » (§7.4 M3 & §7.2, §7.3 M4) :
 * - Visible sur toutes les pages client tant qu'une réservation au statut `reserved` ou `payment_rejected` est active,
 *   sauf sur les écrans de réservation, paiement et preuve.
 * - Mobile : juste au-dessus de la barre de navigation basse.
 * - Ordinateur : sous l'en-tête.
 * - Peut être masqué pendant la session via « × », mais réapparaît automatiquement s'il reste moins de 2 h.
 * - Affiche un toast d'information une seule fois par session s'il reste moins de 2 h avant l'expiration (§7.3).
 */
export function PendingReservationBanner() {
  const location = useLocation();
  const reducedMotion = useReducedMotionPref();

  // Synchronise avec GET /reservations?status=reserved si le client est connecté
  usePendingReservations();

  const activeReservation = useReservationStore((s) => s.activeReservation);
  const serverTimeOffsetMs = useReservationStore((s) => s.serverTimeOffsetMs);
  const bannerDismissedRef = useReservationStore((s) => s.bannerDismissedRef);
  const dismissBanner = useReservationStore((s) => s.dismissBanner);
  const clearActiveReservation = useReservationStore(
    (s) => s.clearActiveReservation,
  );
  const showToast = useToastStore((s) => s.show);

  const [expiredLocally, setExpiredLocally] = useState(false);
  const [nowMs, setNowMs] = useState<number>(() => Date.now());

  useEffect(() => {
    const id = window.setInterval(() => {
      setNowMs(Date.now());
    }, 30_000);
    return () => window.clearInterval(id);
  }, []);

  const expiresMs = activeReservation
    ? new Date(activeReservation.expiresAt).getTime()
    : 0;
  const remainingMs = activeReservation
    ? expiresMs - (nowMs + serverTimeOffsetMs)
    : 0;

  // 2 heures avant l'expiration : toast d'information une seule fois par session (§7.3)
  useEffect(() => {
    if (!activeReservation) return;
    if (
      activeReservation.status !== 'reserved' &&
      activeReservation.status !== 'payment_rejected'
    ) {
      return;
    }
    if (remainingMs <= 0 || remainingMs > TWO_HOURS_MS) return;

    try {
      const alreadyShown = window.sessionStorage.getItem(
        EXPIRY_WARNING_SESSION_KEY,
      );
      if (alreadyShown === activeReservation.ref) return;
      window.sessionStorage.setItem(
        EXPIRY_WARNING_SESSION_KEY,
        activeReservation.ref,
      );
    } catch {
      // Ignore sessionStorage errors
    }

    showToast({
      message: `Votre réservation ${activeReservation.ref} expire dans ${formatRemainingShort(remainingMs)}.`,
    });
  }, [activeReservation, remainingMs, showToast]);

  // Masqué sur les écrans de réservation, paiement, preuve et merci (§7.4), et volontairement aussi sur
  // « Mes réservations » (`/reservations…`) dont les cartes et le bloc d'action montrent déjà le paiement attendu (M5).
  // Correspondance exacte des routes : la page d'aide « Paiement Mobile Money » garde le bandeau.
  const isHiddenRoute = isReservationPath(location.pathname);

  const isEligibleStatus =
    activeReservation?.status === 'reserved' ||
    activeReservation?.status === 'payment_rejected';

  if (
    !activeReservation ||
    !isEligibleStatus ||
    expiredLocally ||
    isHiddenRoute ||
    remainingMs <= 0
  ) {
    return null;
  }

  const isUnderTwoHours = remainingMs <= TWO_HOURS_MS;
  const isRejected = activeReservation.status === 'payment_rejected';
  const isDismissed =
    bannerDismissedRef === activeReservation.ref &&
    !isUnderTwoHours &&
    !isRejected;

  if (isDismissed) {
    return null;
  }

  // Fiche produit sur mobile : toute la place revient à la barre d'action collante (même règle que le
  // bouton WhatsApp, §7.1). Ailleurs, y compris sur le panier vide ou rempli, le bandeau reste visible.
  const hiddenOnMobile = location.pathname.startsWith('/produit/');

  return (
    <AnimatePresence>
      <m.div
        key={`${activeReservation.ref}-${activeReservation.status}`}
        // Pile du bas de l'écran mobile (index.css) : réserve 52 px au-dessus de la barre basse ou
        // de la barre d'action, sous le bouton WhatsApp, le bandeau de mise à jour et les toasts
        data-pending-banner={hiddenOnMobile ? 'desktop' : 'all'}
        role="region"
        aria-label={
          isRejected
            ? 'Paiement de réservation non validé'
            : 'Réservation en attente de paiement'
        }
        initial={reducedMotion ? { opacity: 0 } : { opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        exit={reducedMotion ? { opacity: 0 } : { opacity: 0, y: 24 }}
        transition={spring.sheet}
        className={cn(
          // Calque du bandeau : même niveau que l'en-tête (z-header), sous la barre basse et les feuilles
          'z-header text-white shadow-[var(--shadow-pop)]',
          isRejected ? 'bg-danger' : 'bg-ink',
          // Mobile : collé au-dessus de la barre basse ou de la barre d'action de la page (panier rempli) ;
          // Ordinateur : sous la 1re rangée de l'en-tête (72 px une fois la 2e rangée repliée)
          'fixed right-0 bottom-[var(--bottom-bar-h)] left-0 lg:sticky lg:top-18 lg:bottom-auto',
          hiddenOnMobile && 'max-lg:hidden',
        )}
      >
        {/* 52 px de haut (--pending-banner-h) : bouton de 44 px sur téléphone ; 40 px sur ordinateur,
            pour que le bouton respire dans le bandeau */}
        <Container className="flex h-13 items-center justify-between gap-3 py-1">
          <div className="flex min-w-0 items-center gap-2 text-caption sm:text-small">
            {isRejected ? (
              <AlertCircle
                className="h-4 w-4 shrink-0 text-white"
                aria-hidden="true"
              />
            ) : (
              <span
                className="h-2 w-2 shrink-0 rounded-full bg-red"
                aria-hidden="true"
              />
            )}
            <p className="truncate font-semibold text-white">
              <span className="font-mono font-extrabold">
                {activeReservation.ref}
              </span>{' '}
              ·{' '}
              {isRejected ? (
                <span>paiement non validé</span>
              ) : (
                <>
                  <span>en attente de paiement · </span>
                  <span className="inline-flex items-center gap-1 text-silver">
                    <Clock className="inline h-3.5 w-3.5" aria-hidden="true" />
                    <HoldCountdown
                      expiresAt={activeReservation.expiresAt}
                      serverTime={activeReservation.serverTime}
                      variant="compact"
                      onExpire={() => {
                        setExpiredLocally(true);
                        clearActiveReservation();
                      }}
                      className="text-white"
                    />
                  </span>
                </>
              )}
            </p>
          </div>

          <div className="flex shrink-0 items-center gap-1.5">
            <Button
              variant={isRejected ? 'dark' : 'primary'}
              size="sm"
              // Cible tactile de 44 px sur téléphone, 40 px au pointeur (ordinateur)
              className="min-h-11 lg:min-h-10"
              href={
                isRejected
                  ? `/reservation/${activeReservation.ref}/preuve`
                  : `/reservation/${activeReservation.ref}/paiement`
              }
            >
              {isRejected ? 'Renvoyer' : 'Payer'}
            </Button>
            {!isRejected && (
              <button
                type="button"
                onClick={() => dismissBanner(activeReservation.ref)}
                aria-label="Masquer ce rappel pour la session"
                className="inline-flex size-11 items-center justify-center rounded-[var(--radius-full)] text-silver transition-colors duration-fast hover:bg-ink-2 hover:text-white lg:size-10"
              >
                <X className="h-4 w-4" aria-hidden="true" />
              </button>
            )}
          </div>
        </Container>
      </m.div>
    </AnimatePresence>
  );
}
