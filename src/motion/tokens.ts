/**
 * Durées (secondes). Seule source des durées de l'app (M7 §4.4) : Motion et GSAP les lisent ici,
 * Tailwind et le CSS par les variables --duration-* et les utilitaires duration-* de src/styles/index.css
 * (même valeurs, en millisecondes).
 */
export const duration = {
  tap: 0.12, // enfoncement d'un bouton ou d'une carte
  fast: 0.2, // bascule d'onglet, cœur favori, badge
  quick: 0.25, // changement d'étape, apparition d'un message, petit glissé
  base: 0.35, // feuilles, changement de page, mini-panier
  slow: 0.45, // menu ordinateur, grands panneaux, fondu d'image
  reveal: 0.7, // apparition de blocs au défilement, zoom d'image au survol
  story: 1, // titre du hero, écran de succès
  curtain: 0.7, // recherche plein écran, rideaux
  ambient: 1.5, // boucles d'ambiance discrètes (pulsation, indication de défilement)
} as const;

/** Délais (secondes) avant une apparition secondaire. */
export const delay = {
  short: 0.1, // élément qui suit l'apparition principale
  attention: 1.5, // bouton flottant qui apparaît après l'arrivée sur la page
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
  softInOut: 'power2.inOut',
  back: 'back.out(2.5)', // petit dépassement (coche de succès, pastille)
  elastic: 'elastic.out(1, 0.4)',
} as const;

export const spring = {
  sheet: { type: 'spring', stiffness: 400, damping: 34 },
  snappy: { type: 'spring', stiffness: 500, damping: 30 },
  bounce: { type: 'spring', stiffness: 600, damping: 15 }, // badge du panier
} as const;

export const staggerStep = 0.06;
export const staggerSlow = 0.1; // listes courtes et espacées (étapes, cartes larges)
export const pressScale = 0.97;
