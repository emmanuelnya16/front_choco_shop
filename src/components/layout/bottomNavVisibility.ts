/**
 * Écrans sans barre basse mobile : fiche produit (barre d'action collante), parcours de
 * réservation, paiement et preuve, panier non vide (barre de validation collante).
 * « Mes réservations » (`/reservations`) garde la barre (M5).
 */
export function isBottomNavHidden(pathname: string, cartCount: number): boolean {
  const isCheckoutFlow = pathname === '/reservation' || pathname.startsWith('/reservation/');
  return pathname.startsWith('/produit/') || isCheckoutFlow || (pathname === '/panier' && cartCount > 0);
}

/**
 * Écrans mobiles où une barre d'action collante remplace la barre basse : fiche produit,
 * finalisation de la réservation et panier non vide (la confirmation `/reservation/:ref/merci`
 * n'en a pas).
 */
export function hasMobileActionBar(pathname: string, cartCount: number): boolean {
  return (
    pathname.startsWith('/produit/') ||
    pathname === '/reservation' ||
    (pathname === '/panier' && cartCount > 0)
  );
}

/** Étapes de paiement et d'envoi de la preuve : `/reservation/:ref/paiement` et `/reservation/:ref/preuve`. */
export function isPaymentStepPath(pathname: string): boolean {
  return /^\/reservation\/[^/]+\/(paiement|preuve)\/?$/.test(pathname);
}

/**
 * Parcours de réservation (`/reservation`, `/reservation/:ref/…`) et « Mes réservations »
 * (`/reservations`, `/reservations/:ref`). Correspondance exacte du premier segment : une page
 * d'aide comme `/aide/paiement-mobile-money` n'en fait pas partie.
 */
export function isReservationPath(pathname: string): boolean {
  return /^\/reservations?(\/|$)/.test(pathname);
}
