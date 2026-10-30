import type { Reservation } from '@/types/domain';

export const CANCEL_REASONS = [
  'J’ai changé d’avis',
  'Erreur de taille',
  'Délai trop long',
  'Autre',
] as const;

export const CANCEL_NOT_ALLOWED_MESSAGE =
  'Votre commande est déjà en préparation et ne peut plus être annulée ici.';

/**
 * Texte de la feuille d'annulation selon le statut (§3.2 M5). Le bouton n'apparaît que si `cancellable`.
 * HYPOTHÈSE: règles d'annulation et de remboursement à confirmer par le client (cahier des charges, point 3).
 */
export function cancelSheetMessage(status: Reservation['status']): string {
  if (status === 'pending_validation' || status === 'confirmed') {
    return 'Vous avez déjà payé : la boutique vous contactera pour le remboursement selon la politique d’annulation.';
  }
  return 'Vos articles seront remis en vente immédiatement. Vous pourrez réserver à nouveau à tout moment.';
}
