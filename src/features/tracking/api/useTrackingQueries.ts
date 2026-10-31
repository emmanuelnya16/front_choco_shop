import {
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
  type InfiniteData,
  type QueryClient,
} from '@tanstack/react-query';
import { api, ApiError } from '@/lib/api/client';
import { endpoints } from '@/lib/api/endpoints';
import { qk } from '@/lib/api/queryKeys';
import { usePollIntervalMs } from '@/pwa/pushStore';
import { useAuthStore } from '@/stores/authStore';
import { useReservationStore } from '@/stores/reservationStore';
import type {
  CancelReservationPayload,
  CancelReservationResponse,
  ReservationListItem,
  ReservationScope,
  ReservationsListPage,
  ReservationsSummary,
} from '@/types/api';

// HYPOTHÈSE: rechargement toutes les 30 s quand la page est visible ; toutes les 2 min quand les
// notifications push fonctionnent (permission accordée et abonnement actif, M6 §7.4).
export const TRACKING_POLL_INTERVAL_MS = 30_000;

/**
 * Liste paginée de « Mes réservations » par onglet (§3.5 et §8.1 M5) :
 * 10 par page, rechargée toutes les 30 s quand la page est visible et dès le retour sur l'app.
 */
export function useReservationsInfinite(scope: ReservationScope) {
  const status = useAuthStore((s) => s.status);
  const pollIntervalMs = usePollIntervalMs(TRACKING_POLL_INTERVAL_MS);

  return useInfiniteQuery({
    queryKey: qk.reservationsList(scope),
    queryFn: ({ pageParam }) =>
      api.get<ReservationsListPage>(endpoints.reservations.listScoped(scope, pageParam)),
    initialPageParam: 1,
    getNextPageParam: (lastPage) =>
      lastPage.page < lastPage.totalPages ? lastPage.page + 1 : undefined,
    enabled: status === 'authenticated',
    staleTime: 10_000,
    refetchInterval: pollIntervalMs,
    refetchIntervalInBackground: false,
    refetchOnWindowFocus: 'always',
  });
}

/** Résumé pour le repère de l'onglet Réservations (§8.2 M5). */
export function useReservationsSummary() {
  const status = useAuthStore((s) => s.status);
  const pollIntervalMs = usePollIntervalMs(TRACKING_POLL_INTERVAL_MS);

  return useQuery({
    queryKey: qk.reservationsSummary(),
    queryFn: () => api.get<ReservationsSummary>(endpoints.reservations.summary),
    enabled: status === 'authenticated',
    staleTime: 10_000,
    refetchInterval: pollIntervalMs,
    refetchIntervalInBackground: false,
    refetchOnWindowFocus: 'always',
  });
}

/**
 * Élément déjà présent dans le cache d'une des deux listes : permet d'afficher le détail
 * instantanément avec des données partielles (§5.5 M5).
 */
export function findReservationInListCache(
  queryClient: QueryClient,
  ref: string,
): ReservationListItem | undefined {
  const normalized = ref.trim().toUpperCase();
  const cached = queryClient.getQueriesData<InfiniteData<ReservationsListPage>>({
    queryKey: ['reservations', 'list'],
  });
  for (const [, data] of cached) {
    for (const page of data?.pages ?? []) {
      const found = page.items.find((item) => item.ref.toUpperCase() === normalized);
      if (found) return found;
    }
  }
  return undefined;
}

/**
 * Annulation par le client (§5.4 M5). Le serveur répond 422 si l'annulation n'est plus possible :
 * l'erreur est laissée à l'écran, qui propose alors le contact WhatsApp.
 */
export function useCancelReservation(ref: string) {
  const queryClient = useQueryClient();
  const clearActiveReservation = useReservationStore((s) => s.clearActiveReservation);

  return useMutation({
    mutationFn: (payload: CancelReservationPayload) =>
      api.post<CancelReservationResponse>(endpoints.reservations.cancel(ref), payload),
    onSuccess: (response) => {
      queryClient.setQueryData(qk.reservation(ref.toUpperCase()), response.reservation);
      const active = useReservationStore.getState().activeReservation;
      if (active && active.ref.toUpperCase() === ref.toUpperCase()) {
        clearActiveReservation();
      }
      // Liste (la réservation passe dans « Terminées »), résumé et bandeau des réservations en attente
      queryClient.invalidateQueries({ queryKey: qk.reservations() });
    },
    onError: (error) => {
      // 422 : la boutique a déjà avancé la commande ; on recharge pour afficher le vrai statut
      if (error instanceof ApiError && error.status === 422) {
        queryClient.invalidateQueries({ queryKey: qk.reservation(ref.toUpperCase()) });
        queryClient.invalidateQueries({ queryKey: qk.reservations() });
      }
    },
  });
}
