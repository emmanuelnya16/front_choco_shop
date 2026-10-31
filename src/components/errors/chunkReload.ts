import { isChunkLoadError } from '@/features/offline/networkErrors';
import { useNetworkStore } from '@/pwa/networkStore';

/**
 * Morceau de code introuvable après une mise à jour (M7 §5.1) : la page est rechargée
 * automatiquement UNE seule fois. Hors connexion, jamais de rechargement : l'écran
 * « hors connexion » existant s'affiche (M6 §6.5).
 *
 * - `drc_chunk_reload` : drapeau avec horodatage, posé juste avant le rechargement et effacé
 *   après un chargement réussi de la page (RootLayout) ;
 * - `drc_chunk_reload_last` : date du dernier rechargement automatique, jamais effacée, pour
 *   qu'un morceau définitivement absent ne fasse pas recharger l'app en boucle.
 * Sans stockage de session, aucun rechargement automatique : rien ne garantirait qu'il soit unique.
 */
const PENDING_KEY = 'drc_chunk_reload';
const LAST_KEY = 'drc_chunk_reload_last';
// HYPOTHÈSE: un drapeau de plus de 10 minutes vient d'une ancienne tentative : un nouveau rechargement est permis.
const PENDING_WINDOW_MS = 600_000;
// HYPOTHÈSE: au plus un rechargement automatique par minute, même après un chargement réussi.
const MIN_INTERVAL_MS = 60_000;

/** Rechargement de la page, isolé pour être remplacé dans les tests (jsdom ne recharge pas). */
export const pageReload = {
  reload(): void {
    window.location.reload();
  },
};

/** Erreur de chargement d'un morceau de code (import dynamique, ChunkLoadError). */
export function isChunkError(error: unknown): boolean {
  return isChunkLoadError(error) || (error instanceof Error && error.name === 'ChunkLoadError');
}

/** Hors connexion pour le navigateur ou pour le suivi du réseau de l'app (M6 §6.1). */
export function isAppOffline(): boolean {
  return navigator.onLine === false || !useNetworkStore.getState().online;
}

/** Temps écoulé depuis la date enregistrée (infini si aucune, 0 si le stockage est indisponible). */
function elapsed(key: string): number {
  try {
    const value = sessionStorage.getItem(key);
    return value === null ? Infinity : Math.abs(Date.now() - Number(value));
  } catch {
    return 0;
  }
}

/** Un rechargement automatique est-il encore permis ? */
export function canAutoReload(): boolean {
  return elapsed(PENDING_KEY) >= PENDING_WINDOW_MS && elapsed(LAST_KEY) >= MIN_INTERVAL_MS;
}

/** Recharge la page si c'est permis et renvoie `true` ; sinon `false` (l'écran d'erreur s'affiche). */
export function reloadOnceForChunkError(): boolean {
  if (!canAutoReload()) return false;
  try {
    const now = String(Date.now());
    sessionStorage.setItem(PENDING_KEY, now);
    sessionStorage.setItem(LAST_KEY, now);
  } catch {
    return false;
  }
  pageReload.reload();
  return true;
}

/** La page s'est affichée : le drapeau de rechargement est effacé. */
export function clearChunkReloadFlag(): void {
  try {
    sessionStorage.removeItem(PENDING_KEY);
  } catch {
    // Stockage indisponible : rien à effacer
  }
}
