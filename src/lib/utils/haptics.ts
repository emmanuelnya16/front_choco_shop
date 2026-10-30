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
      return navigator.vibrate(PATTERNS[pattern]);
    }
  } catch {
    // Ignore silencieusement sur iOS / navigateurs restreints
  }
  return false;
}
