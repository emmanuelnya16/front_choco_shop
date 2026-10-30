import type { ReservationListItem } from '@/types/api';

/** Action contextuelle d'une carte de « Mes réservations » (§4.2 M5). */
export type CardAction =
  | { kind: 'pay'; label: string; href: string }
  | { kind: 'resend-proof'; label: string; href: string }
  | { kind: 'view-package'; label: string; href: string }
  | { kind: 'rebook'; label: string; text?: string }
  | { kind: 'text'; text: string };

export function getCardAction(
  item: Pick<ReservationListItem, 'ref' | 'status' | 'city' | 'packagePhotoThumb'>,
): CardAction {
  const ref = item.ref;
  switch (item.status) {
    case 'reserved':
      return { kind: 'pay', label: 'Payer', href: `/reservation/${ref}/paiement` };
    case 'payment_rejected':
      return { kind: 'resend-proof', label: 'Renvoyer ma preuve', href: `/reservation/${ref}/preuve` };
    case 'pending_validation':
      return { kind: 'text', text: 'Vérification en cours' };
    case 'confirmed':
    case 'preparing':
      return { kind: 'text', text: 'Paiement validé · préparation en cours' };
    case 'handed_to_agency':
    case 'ready_for_pickup':
      return item.packagePhotoThumb
        ? { kind: 'view-package', label: 'Voir mon colis', href: `/reservations/${ref}#colis` }
        : { kind: 'text', text: 'Votre colis est prêt' };
    case 'in_delivery':
      return { kind: 'text', text: item.city ? `En route vers ${item.city}` : 'En route' };
    case 'delivered':
    case 'picked_up':
      return { kind: 'rebook', label: 'Réserver à nouveau' };
    case 'expired':
      return { kind: 'rebook', label: 'Réserver à nouveau', text: 'Délai de 24 h dépassé' };
    case 'cancelled':
      return { kind: 'rebook', label: 'Réserver à nouveau', text: 'Réservation annulée' };
  }
}
