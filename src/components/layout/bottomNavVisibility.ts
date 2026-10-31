/**
 * Écrans sans barre basse mobile : fiche produit (barre d'action collante), parcours de
 * réservation, paiement et preuve, panier non vide (barre de validation collante).
 * « Mes réservations » (`/reservations`) garde la barre (M5).
 */
export function isBottomNavHidden(pathname: string, cartCount: number): boolean {
  const isCheckoutFlow = pathname === '/reservation' || pathname.startsWith('/reservation/');
  return pathname.startsWith('/produit/') || isCheckoutFlow || (pathname === '/panier' && cartCount > 0);
}
