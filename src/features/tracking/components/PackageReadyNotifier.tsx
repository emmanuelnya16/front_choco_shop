import { useEffect } from 'react';
import { useLocation } from 'react-router';
import { useReservationsSummary } from '@/features/tracking/api/useTrackingQueries';
import { useSeenStore } from '@/features/tracking/seenStore';
import { useToastStore } from '@/stores/toastStore';

/**
 * « Votre colis RES-000124 est prêt · Voir » (§6.1 M5) : à l'ouverture de l'app (puis à chaque
 * actualisation du résumé), une seule fois par réservation dont les photos n'ont pas encore été vues.
 */
export function PackageReadyNotifier() {
  const { data } = useReservationsSummary();
  const location = useLocation();
  const showToast = useToastStore((s) => s.show);

  useEffect(() => {
    if (!data) return;
    const { byRef, packageToastShown, markPackageToastShown } = useSeenStore.getState();
    const pending = data.items
      .filter(
        (item) =>
          item.hasPackagePhotos &&
          !byRef[item.ref]?.photosRevealed &&
          !packageToastShown.includes(item.ref) &&
          // Inutile si le client regarde déjà cette réservation
          !location.pathname.toUpperCase().startsWith(`/RESERVATIONS/${item.ref}`),
      )
      .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());

    if (pending.length === 0) return;
    pending.forEach((item) => markPackageToastShown(item.ref));

    const [latest] = pending;
    showToast(
      pending.length === 1
        ? {
            message: `Votre colis ${latest!.ref} est prêt`,
            actionLabel: 'Voir',
            actionHref: `/reservations/${latest!.ref}#colis`,
            durationMs: 6000,
          }
        : {
            message: `${pending.length} colis sont prêts\u00A0: leurs photos vous attendent`,
            actionLabel: 'Voir',
            actionHref: '/reservations',
            durationMs: 6000,
          },
    );
  }, [data, location.pathname, showToast]);

  return null;
}
