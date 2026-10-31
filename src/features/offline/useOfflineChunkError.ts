import { useOnlineStatus } from '@/lib/hooks/useOnlineStatus';
import { isChunkLoadError } from './networkErrors';

/**
 * Une page n'a pas pu se charger parce que le réseau manque (morceau de code jamais enregistré
 * sur le téléphone) : on affiche le contenu « hors connexion » au lieu d'une erreur (M6 §6.5).
 */
export function useIsOfflineChunkError(error: unknown): boolean {
  const online = useOnlineStatus();
  if (!isChunkLoadError(error)) return false;
  const browserOffline = typeof navigator !== 'undefined' && navigator.onLine === false;
  return !online || browserOffline;
}
