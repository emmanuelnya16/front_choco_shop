import { useEffect } from 'react';
import { useReservationsSummary } from '@/features/tracking/api/useTrackingQueries';
import { useAuthStore } from '@/stores/authStore';

/**
 * Pastille de l'icône de l'app (M6 §7.4) : nombre de réservations qui demandent une action.
 * Sans effet si le navigateur ne connaît pas l'API (iPhone non installé, Firefox…).
 */
export function setAppBadgeCount(count: number): void {
  if (typeof navigator === 'undefined') return;
  try {
    if (count > 0) {
      if ('setAppBadge' in navigator) {
        void Promise.resolve(navigator.setAppBadge(count)).catch(() => undefined);
      }
    } else if ('clearAppBadge' in navigator) {
      void Promise.resolve(navigator.clearAppBadge()).catch(() => undefined);
    }
  } catch {
    // Pastille refusée par le système : sans conséquence
  }
}

export function clearAppBadge(): void {
  setAppBadgeCount(0);
}

/**
 * Tient la pastille à jour depuis le résumé des réservations : posée si le client est connecté et
 * qu'au moins une réservation attend une action, effacée sinon (et à la déconnexion).
 */
export function useAppBadge(): void {
  const status = useAuthStore((s) => s.status);
  const { data } = useReservationsSummary();
  const needsAction = data?.needsAction;
  // HYPOTHÈSE: session encore inconnue ou résumé pas encore reçu (hors connexion au démarrage) :
  // on garde la pastille posée par le service worker plutôt que de l'effacer à tort
  const count =
    status === 'guest' ? 0 : status === 'authenticated' && typeof needsAction === 'number' ? needsAction : null;

  useEffect(() => {
    if (count !== null) setAppBadgeCount(count);
  }, [count]);
}
