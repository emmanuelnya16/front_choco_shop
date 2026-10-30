import { MessageCircle } from 'lucide-react';
import { useState } from 'react';
import { Link } from 'react-router';
import { Chip } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Sheet } from '@/components/ui/Sheet';
import { buildWhatsAppQuestionUrl } from '@/features/payment/whatsapp';
import { useCancelReservation } from '@/features/tracking/api/useTrackingQueries';
import { ApiError } from '@/lib/api/client';
import {
  CANCEL_NOT_ALLOWED_MESSAGE,
  CANCEL_REASONS,
  cancelSheetMessage,
} from '@/features/tracking/cancel';
import type { Reservation } from '@/types/domain';

export interface CancelSheetProps {
  open: boolean;
  onClose: () => void;
  reservation: Reservation;
  whatsappNumber: string;
  onCancelled: () => void;
}

/** Feuille de confirmation d'annulation (§5.4 M5). */
export function CancelSheet({ open, onClose, reservation, whatsappNumber, onCancelled }: CancelSheetProps) {
  const [reason, setReason] = useState<string | null>(null);
  const cancel = useCancelReservation(reservation.ref);
  const notAllowed = cancel.error instanceof ApiError && cancel.error.status === 422;
  const paid = reservation.status === 'pending_validation' || reservation.status === 'confirmed';

  const handleClose = () => {
    cancel.reset();
    setReason(null);
    onClose();
  };

  const confirm = () => {
    cancel.mutate(reason ? { reason } : {}, {
      onSuccess: () => {
        setReason(null);
        onCancelled();
      },
    });
  };

  return (
    <Sheet open={open} onClose={handleClose} title={`Annuler ${reservation.ref} ?`}>
      {notAllowed ? (
        <div role="alert">
          <p className="text-body text-ink">{CANCEL_NOT_ALLOWED_MESSAGE}</p>
          <Button
            variant="dark"
            size="lg"
            fullWidth
            className="mt-5"
            href={buildWhatsAppQuestionUrl(whatsappNumber, reservation.ref)}
            external
            iconLeft={<MessageCircle className="h-4 w-4" />}
          >
            Contacter la boutique sur WhatsApp
          </Button>
          <Button variant="outline" size="lg" fullWidth className="mt-3" onClick={handleClose}>
            Fermer
          </Button>
        </div>
      ) : (
        <>
          <p className="text-body text-text-2">{cancelSheetMessage(reservation.status)}</p>
          {paid && (
            <Link
              to="/pages/politique-retour"
              className="mt-2 inline-flex min-h-[44px] items-center text-small font-semibold text-ink underline underline-offset-2"
            >
              Lire la politique d’annulation et de retour
            </Link>
          )}

          <fieldset className="mt-4">
            <legend className="text-label text-text-2">Motif (facultatif)</legend>
            <div className="mt-2 flex flex-wrap gap-2">
              {CANCEL_REASONS.map((label) => (
                <Chip
                  key={label}
                  type="button"
                  active={reason === label}
                  aria-pressed={reason === label}
                  onClick={() => setReason((current) => (current === label ? null : label))}
                >
                  {label}
                </Chip>
              ))}
            </div>
          </fieldset>

          {cancel.isError && !notAllowed && (
            <p role="alert" className="mt-4 text-small text-ink">
              L’annulation n’a pas abouti. Vérifiez votre connexion puis réessayez.
            </p>
          )}

          <div className="mt-6 flex flex-col gap-3">
            <Button variant="danger" size="lg" fullWidth loading={cancel.isPending} onClick={confirm}>
              Oui, annuler
            </Button>
            <Button variant="outline" size="lg" fullWidth onClick={handleClose} disabled={cancel.isPending}>
              Garder ma réservation
            </Button>
          </div>
        </>
      )}
    </Sheet>
  );
}
