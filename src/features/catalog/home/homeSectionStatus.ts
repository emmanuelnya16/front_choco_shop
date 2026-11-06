/**
 * États d'une section de l'accueil qui charge des données (M7 §4.5).
 * - `loading` : squelette au gabarit de la section ;
 * - `offline` : hors connexion sans données enregistrées ; la requête est relancée au retour du
 *   réseau (useNetworkRecovery) ou par « Réessayer » ;
 * - `error` : échec sans données à montrer ;
 * - `empty` : rien à montrer, la section se retire de l'accueil (pas de bloc vide) ;
 * - `ready` : données affichées (y compris celles enregistrées avant une coupure).
 */
export type HomeSectionStatus = 'loading' | 'offline' | 'error' | 'empty' | 'ready';

interface QueryLike {
  data: unknown;
  isError: boolean;
  fetchStatus: 'fetching' | 'paused' | 'idle';
}

/**
 * @param online état réseau de l'app (useOnlineStatus) : une erreur réseau n'est pas réessayée par
 * TanStack Query (src/lib/api/queryClient.ts), elle arrive donc en erreur et non « en pause ».
 */
export function homeSectionStatus(query: QueryLike, isEmpty: boolean, online: boolean): HomeSectionStatus {
  if (query.data !== undefined) return isEmpty ? 'empty' : 'ready';
  if (query.fetchStatus === 'paused' || (query.isError && !online)) return 'offline';
  if (query.isError) return 'error';
  return 'loading';
}
