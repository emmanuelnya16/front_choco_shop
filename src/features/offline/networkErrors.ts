import { ApiError } from '@/lib/api/client';

/**
 * Coupure réseau ou délai dépassé (M6 §6) : l'écran garde ses données ou affiche le repli
 * « hors connexion », jamais « introuvable ».
 */
export function isNetworkError(error: unknown): boolean {
  if (!(error instanceof ApiError)) return false;
  if (error.code === 'UPLOAD_ABORTED') return false;
  return (
    error.status === 0 ||
    error.status === 408 ||
    error.code === 'NETWORK_ERROR' ||
    error.code === 'TIMEOUT'
  );
}

const CHUNK_ERROR_PATTERNS = [
  /dynamically imported module/i,
  /importing a module script failed/i,
  /error loading dynamically imported module/i,
  /loading (css )?chunk [\w-]+ failed/i,
  /unable to preload css/i,
];

/** Morceau de page (import dynamique) impossible à charger : typique d'une navigation hors connexion. */
export function isChunkLoadError(error: unknown): boolean {
  if (!(error instanceof Error)) return false;
  return CHUNK_ERROR_PATTERNS.some((pattern) => pattern.test(error.message));
}
