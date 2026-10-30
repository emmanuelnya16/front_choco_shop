export const duration = {
  tap: 0.12, // enfoncement d'un bouton ou d'une carte
  fast: 0.2, // bascule d'onglet, cœur favori, badge
  base: 0.35, // feuilles, changement de page, mini-panier
  reveal: 0.7, // apparition de blocs au défilement
  story: 1, // titre du hero, écran de succès
  curtain: 0.7, // recherche plein écran, rideaux
} as const;

export const ease = {
  out: [0.22, 1, 0.36, 1], // "douce à l'arrivée" : apparitions
  inOut: [0.76, 0, 0.24, 1], // rideaux, plein écran
  soft: 'easeOut', // retours rapides
} as const;

export const gsapEase = {
  out: 'power4.out',
  base: 'power3.out',
  inOut: 'power3.inOut',
  soft: 'power2.out',
  elastic: 'elastic.out(1, 0.4)',
} as const;

export const spring = {
  sheet: { type: 'spring', stiffness: 400, damping: 34 },
  snappy: { type: 'spring', stiffness: 500, damping: 30 },
  bounce: { type: 'spring', stiffness: 600, damping: 15 }, // badge du panier
} as const;

export const staggerStep = 0.06;
export const pressScale = 0.97;
