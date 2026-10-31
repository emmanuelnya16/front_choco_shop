import { formatDayMonth, formatHour } from '@/features/tracking/format';
import { useLastSyncedAt } from '@/pwa/networkStore';

/** « Mis à jour le 30 oct. à 14 h 05 » */
export function formatLastUpdate(timestamp: number): string {
  const date = new Date(timestamp);
  return `Mis à jour le ${formatDayMonth(date)} à ${formatHour(date)}`;
}

/**
 * Date du dernier état connu (M6 §6.3) : dernière vraie réponse du serveur pour ce chemin d'API
 * (conservée sur le téléphone), à défaut la date de chargement des données en mémoire.
 * Les données relues hors connexion depuis l'application ne rajeunissent pas cette date.
 */
export function useLastUpdateLabel(apiPath: string, dataUpdatedAt: number): string | null {
  const syncedAt = useLastSyncedAt(apiPath);
  const timestamp = syncedAt ?? (dataUpdatedAt > 0 ? dataUpdatedAt : null);
  return timestamp ? formatLastUpdate(timestamp) : null;
}
