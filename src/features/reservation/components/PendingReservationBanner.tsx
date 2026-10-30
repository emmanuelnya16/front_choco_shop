import { AnimatePresence } from 'motion/react';
import * as m from 'motion/react-m';
import { AlertCircle, Clock, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useLocation } from 'react-router';
import { Button } from '@/components/ui/Button';
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
    return `${hours} h ${String(mins).padStart(2, '0')}`;
  }
  return `${mins} min`;
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
  const isHiddenRoute =
    location.pathname.startsWith('/reservation') ||
    location.pathname.includes('/paiement') ||
    location.pathname.includes('/preuve') ||
    location.pathname.includes('/merci');

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

  const isBottomNavHidden =
    location.pathname.startsWith('/produit/') ||
    location.pathname === '/panier';

  return (
    <AnimatePresence>
      <m.div
        key={`${activeReservation.ref}-${activeReservation.status}`}
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
          'z-30 text-white shadow-[var(--shadow-pop)]',
          isRejected ? 'bg-danger' : 'bg-ink',
          // Mobile : collé au-dessus de BottomNav ; Ordinateur : sous l'en-tête
          'fixed right-0 left-0 lg:sticky lg:top-[72px] lg:bottom-auto',
          isBottomNavHidden
            ? 'bottom-0'
            : 'bottom-[calc(var(--bottom-nav-h)+env(safe-area-inset-bottom))]',
        )}
      >
        <Container className="flex min-h-[52px] items-center justify-between gap-3 py-2">
          <div className="flex min-w-0 items-center gap-2 text-xs sm:text-small">
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
                className="inline-flex h-11 w-11 items-center justify-center rounded-[var(--radius-full)] text-silver transition-colors hover:bg-ink-2 hover:text-white"
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
