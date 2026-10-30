import { useReservationsSummary } from '@/features/tracking/api/useTrackingQueries';
import { needsAttention, useSeenStore } from '@/features/tracking/seenStore';

export interface ReservationsAttention {
  /** Repère rouge : une action est attendue et pas encore vue, ou un changement n'a pas été vu (§8.2 M5). */
  needsAttention: boolean;
  /** Nombre de réservations en cours (`undefined` tant que le résumé n'est pas chargé). */
  activeCount: number | undefined;
}

export function useReservationsAttention(): ReservationsAttention {
  const { data } = useReservationsSummary();
  const byRef = useSeenStore((s) => s.byRef);
  const initializedAt = useSeenStore((s) => s.initializedAt);

  return {
    needsAttention: Boolean(
      data?.items.some((item) => needsAttention(item, byRef[item.ref], initializedAt)),
    ),
    activeCount: data?.items.length,
  };
}
