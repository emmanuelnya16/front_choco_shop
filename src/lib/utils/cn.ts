import { clsx, type ClassValue } from 'clsx';
import { extendTailwindMerge } from 'tailwind-merge';

/**
 * Utilitaires typographiques du projet (src/styles/index.css, @utility text-*).
 * Sans cette déclaration, tailwind-merge les prend pour des couleurs de texte :
 * cn('text-small', 'text-ink') supprimait text-small (tailles de texte perdues partout).
 */
const TYPOGRAPHY_SCALE = ['display', 'h1', 'h2', 'h3', 'body', 'small', 'caption', 'label', 'price'];

/** Durées et courbes nommées (src/styles/index.css, mêmes valeurs que src/motion/tokens.ts). */
const DURATIONS = ['tap', 'fast', 'quick', 'base', 'slow', 'reveal', 'story'];
const EASINGS = ['brand-out', 'brand-in-out'];

const twMerge = extendTailwindMerge({
  extend: {
    classGroups: {
      'font-size': [{ text: TYPOGRAPHY_SCALE }],
      duration: [{ duration: DURATIONS }],
      ease: [{ ease: EASINGS }],
    },
  },
});

export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}
