import { prefersReducedMotion } from '@/motion/useReducedMotionPref';

export type HapticPattern = 'light' | 'success' | 'error';

const PATTERNS: Record<HapticPattern, number | number[]> = {
  light: 10,
  success: [10, 40, 10],
  error: [30, 40, 30],
};

/**
 * Déclenche un retour haptique léger sur les appareils compatibles (Android),
 * uniquement si l'API navigator.vibrate existe et que les animations ne sont pas réduites.
 */
export function haptic(pattern: HapticPattern = 'light'): boolean {
  try {
    if (prefersReducedMotion()) {
      return false;
    }
    if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') {
      // Chrome refuse (et signale en console) une vibration avant tout geste de l'utilisateur sur la page,
      // par exemple au dévoilement automatique de la photo du colis : on s'abstient dans ce cas.
      if (navigator.userActivation && !navigator.userActivation.hasBeenActive) {
        return false;
      }
      return navigator.vibrate(PATTERNS[pattern]);
    }
  } catch {
    // Ignore silencieusement sur iOS / navigateurs restreints
  }
  return false;
}
