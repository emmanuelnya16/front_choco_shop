import { AnimatePresence } from 'motion/react';
import * as m from 'motion/react-m';
import { MessageCircle, RotateCcw, TimerOff } from 'lucide-react';
import { useState } from 'react';
import { Link, useNavigate } from 'react-router';
import { Button } from '@/components/ui/Button';
import {
  addReservationItemsWithoutCheck,
  restoreReservationItemsToCart,
} from '@/features/cart/restoreReservationItems';
import { buildWhatsAppExpiredPaidUrl } from '@/features/payment/whatsapp';
import { haptic } from '@/lib/utils/haptics';
import { ease } from '@/motion/tokens';
import { useReducedMotionPref } from '@/motion/useReducedMotionPref';
import { useReservationStore } from '@/stores/reservationStore';
import { useToastStore } from '@/stores/toastStore';
import type { Reservation } from '@/types/domain';

export interface ReservationExpiredOverlayProps {
  open: boolean;
  reservation: Reservation;
  whatsappNumber?: string;
  /** Affiché lorsque le serveur renvoie 410 à l'envoi d'une preuve (§7.3) */
  showAlreadyPaidHelp?: boolean;
}

/**
 * Calque d'expiration de réservation (§7.3 & §8.3) :
 * - Icône `TimerOff`, titre « Réservation expirée », texte explicatif.
 * - Bouton « Refaire ma réservation » : vérifie la disponibilité réelle via `/cart/validate`,
 *   remet dans le panier uniquement les articles encore disponibles, puis ouvre `/panier`.
 * - Lien « Retour à l'accueil ».
 * - Si l'expiration a été détectée par un 410 lors de l'envoi de la preuve (`showAlreadyPaidHelp`),
 *   affiche le bloc d'assistance WhatsApp avec message prérempli adapté.
 */
export function ReservationExpiredOverlay({
  open,
  reservation,
  whatsappNumber = '+237690000000',
  showAlreadyPaidHelp = false,
}: ReservationExpiredOverlayProps) {
  const navigate = useNavigate();
  const reducedMotion = useReducedMotionPref();
  const clearActiveReservation = useReservationStore(
    (s) => s.clearActiveReservation,
  );
  const showToast = useToastStore((s) => s.show);

  const [isRestoring, setIsRestoring] = useState(false);

  const handleRedoReservation = async () => {
    if (isRestoring) return;
    setIsRestoring(true);
    haptic('light');

    try {
      const { added: restoredCount } = await restoreReservationItemsToCart(
        reservation.items,
      );

      clearActiveReservation();

      if (restoredCount > 0) {
        showToast({
          message:
            restoredCount === reservation.items.length
              ? 'Vos articles ont été remis dans votre panier.'
              : `${restoredCount} article${restoredCount > 1 ? 's' : ''} encore disponible${restoredCount > 1 ? 's' : ''} remis dans votre panier.`,
        });
      } else {
        showToast({
          message: 'Ces articles ne sont malheureusement plus disponibles.',
        });
      }

      navigate('/panier');
    } catch {
      // Fallback : remet les articles dans le panier et redirige vers /panier où /cart/validate s'exécutera
      addReservationItemsWithoutCheck(reservation.items);
      clearActiveReservation();
      navigate('/panier');
    } finally {
      setIsRestoring(false);
    }
  };

  const totalAmount = reservation.amount?.total ?? reservation.total;
  const whatsappUrl = buildWhatsAppExpiredPaidUrl(
    whatsappNumber,
    reservation.ref,
    totalAmount,
  );

  return (
    <AnimatePresence>
      {open && (
        <m.div
          role="dialog"
          aria-modal="true"
          aria-labelledby="expired-overlay-title"
          data-testid="reservation-expired-overlay"
          initial={reducedMotion ? { opacity: 1 } : { opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.28, ease: ease.out }}
          className="fixed inset-0 z-50 flex items-center justify-center bg-ink/80 p-4 backdrop-blur-xs"
        >
          <m.div
            initial={reducedMotion ? false : { scale: 0.95, y: 12 }}
            animate={{ scale: 1, y: 0 }}
            transition={{ duration: 0.28, ease: ease.out }}
            className="w-full max-w-md rounded-[var(--radius-md)] border border-silver bg-white p-6 text-center shadow-[var(--shadow-sheet)]"
          >
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-surface text-danger">
              <TimerOff className="h-7 w-7" aria-hidden="true" />
            </div>

            <h2 id="expired-overlay-title" className="mt-4 text-h2 text-ink">
              Réservation expirée
            </h2>

            <p className="mt-2 text-small text-text-2">
              Le délai de 24 h est dépassé : vos articles ont été remis en vente.
            </p>

            {showAlreadyPaidHelp && (
              <div className="mt-5 rounded-[var(--radius-md)] border border-warning/60 bg-surface p-4 text-left">
                <p className="text-small font-bold text-ink">
                  Vous avez déjà payé ? Contactez la boutique sur WhatsApp avec
                  votre capture.
                </p>
                <a
                  href={whatsappUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-3 inline-flex min-h-[44px] w-full items-center justify-center gap-2 rounded-[var(--radius-md)] bg-ink px-4 py-2.5 text-small font-bold text-white transition-colors hover:bg-ink-2"
                >
                  <MessageCircle className="h-4 w-4" aria-hidden="true" />
                  <span>Contacter la boutique sur WhatsApp</span>
                </a>
              </div>
            )}

            <div className="mt-6 space-y-3">
              <Button
                type="button"
                variant="primary"
                size="lg"
                fullWidth
                loading={isRestoring}
                iconLeft={<RotateCcw className="h-4 w-4" aria-hidden="true" />}
                onClick={() => void handleRedoReservation()}
              >
                Refaire ma réservation
              </Button>

              <Link
                to="/"
                onClick={() => clearActiveReservation()}
                className="inline-flex min-h-[44px] w-full items-center justify-center text-small font-bold text-text-2 underline hover:text-ink"
              >
                Retour à l&rsquo;accueil
              </Link>
            </div>
          </m.div>
        </m.div>
      )}
    </AnimatePresence>
  );
}
