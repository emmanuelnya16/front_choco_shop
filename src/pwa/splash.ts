import { prefersReducedMotion } from '@/motion/useReducedMotionPref';

/** Posé dans sessionStorage : vidé quand le système ferme l'app installée (lancement à froid suivant). */
export const SPLASH_SHOWN_KEY = 'drc_splash_shown';
/**
 * Durée d'affichage de l'écran de lancement avant son fondu de sortie (M6 §8).
 * HYPOTHÈSE: 0,65 s (apparition de 0,6 s comprise) puis 0,2 s de fondu : 0,85 s au total, avec une
 * marge sous la seconde pour un téléphone lent (0,95 s mesurées avec 0,7 + 0,25 s dans Chrome).
 */
export const SPLASH_VISIBLE_MS = 650;
/** Apparition du logo (fondu + léger grossissement) : 0,6 s au plus (M6 §8). */
export const SPLASH_LOGO_IN_MS = 600;
/** Fondu de sortie : avec l'affichage, l'écran disparaît en moins d'une seconde (M6 §8). */
export const SPLASH_EXIT_MS = 200;

interface NavigatorStandalone {
  /** Safari iOS : vrai quand l'app est lancée depuis l'écran d'accueil (absent de lib.dom). */
  standalone?: boolean;
}

/** L'app tourne-t-elle comme une application installée (écran d'accueil) ? */
export function isStandaloneDisplay(): boolean {
  if (typeof window === 'undefined') return false;
  const iosStandalone = (window.navigator as Navigator & NavigatorStandalone).standalone === true;
  const displayStandalone =
    typeof window.matchMedia === 'function' &&
    (window.matchMedia('(display-mode: standalone)').matches ||
      window.matchMedia('(display-mode: fullscreen)').matches);
  return iosStandalone || displayStandalone;
}

/** Instant du premier affichage de ce lancement, partagé entre les montages successifs. */
let splashStartedAt: number | null = null;
let splashDecided = false;

/**
 * Décide une seule fois par chargement de page si l'écran de lancement s'affiche : app installée,
 * animations non réduites, et pas encore montré depuis le lancement à froid (sessionStorage).
 */
export function decideSplash(): boolean {
  if (splashDecided) return splashStartedAt !== null;
  splashDecided = true;
  if (!isStandaloneDisplay() || prefersReducedMotion()) return false;
  try {
    if (sessionStorage.getItem(SPLASH_SHOWN_KEY) !== null) return false;
    sessionStorage.setItem(SPLASH_SHOWN_KEY, '1');
  } catch {
    // Stockage indisponible : on ne risque pas de rejouer l'écran à chaque page
    return false;
  }
  splashStartedAt = Date.now();
  return true;
}

/** Temps d'affichage restant (0 si l'écran n'est pas, ou plus, affiché). */
export function splashRemainingMs(): number {
  if (splashStartedAt === null) return 0;
  return Math.max(0, SPLASH_VISIBLE_MS - (Date.now() - splashStartedAt));
}

/** Vrai juste après la décision : premier montage, le logo apparaît en fondu. */
export function isSplashFirstAppearance(): boolean {
  return splashStartedAt !== null && Date.now() - splashStartedAt < 50;
}

/** Tests : remet à zéro la décision prise pour ce chargement. */
export function resetSplashForTests(): void {
  splashStartedAt = null;
  splashDecided = false;
}
