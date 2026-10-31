import { isChunkError } from '@/components/errors/chunkReload';
import { useOnlineStatus } from '@/lib/hooks/useOnlineStatus';

/**
 * Une page n'a pas pu se charger parce que le réseau manque (morceau de code jamais enregistré
 * sur le téléphone) : on affiche le contenu « hors connexion » au lieu d'une erreur (M6 §6.5).
 * En ligne, la même erreur déclenche le rechargement unique des zones d'erreur (M7 §5.1).
 */
export function useIsOfflineChunkError(error: unknown): boolean {
  const online = useOnlineStatus();
  if (!isChunkError(error)) return false;
  const browserOffline = typeof navigator !== 'undefined' && navigator.onLine === false;
  return !online || browserOffline;
}
