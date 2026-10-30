import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';
import { api } from '@/lib/api/client';
import { endpoints } from '@/lib/api/endpoints';
import { qk } from '@/lib/api/queryKeys';
import { useAuthStore } from '@/stores/authStore';
import { useReservationStore } from '@/stores/reservationStore';
import type {
  AddressesResponse,
  AgenciesResponse,
  CitiesResponse,
  CreateReservationPayload,
  ReservationCreated,
  ReservationDetailResponse,
  ReservationsListResponse,
  SaveAddressPayload,
} from '@/types/api';
import type { Address } from '@/types/domain';

const ONE_HOUR_MS = 60 * 60 * 1000;

export function useAddresses() {
  const status = useAuthStore((s) => s.status);

  return useQuery({
    queryKey: qk.addresses(),
    queryFn: () => api.get<AddressesResponse>(endpoints.me.addresses),
    enabled: status === 'authenticated',
    staleTime: 5 * 60 * 1000,
  });
}

export function useSaveAddress() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload: SaveAddressPayload) =>
      api.post<Address>(endpoints.me.addresses, payload),
    onSuccess: (saved) => {
      queryClient.setQueryData<Address[]>(qk.addresses(), (old = []) => {
        const filtered = old.filter((a) => a.id !== saved.id);
        if (saved.isDefault) {
          return [saved, ...filtered.map((a) => ({ ...a, isDefault: false }))];
        }
        return [...filtered, saved];
      });
    },
  });
}

/**
 * Liste des villes de livraison (cache d'une heure, §3.3).
 */
export function useDeliveryCities() {
  return useQuery({
    queryKey: qk.cities(),
    queryFn: () => api.get<CitiesResponse>(endpoints.delivery.cities),
    staleTime: ONE_HOUR_MS,
  });
}

/**
 * Agences de transport pour une ville donnée (§3.3).
 */
export function useAgencies(city?: string) {
  return useQuery({
    queryKey: qk.agencies(city),
    queryFn: () => api.get<AgenciesResponse>(endpoints.delivery.agencies(city)),
    enabled: Boolean(city && city.trim().length > 0),
    staleTime: ONE_HOUR_MS,
  });
}

/**
 * Création d'une réservation avec en-tête `Idempotency-Key` (§3.1 & §7.1).
 */
export function useCreateReservation() {
  const queryClient = useQueryClient();
  const setActiveReservation = useReservationStore(
    (s) => s.setActiveReservation,
  );

  return useMutation({
    mutationFn: async ({
      payload,
      idempotencyKey,
      conflictTestHeader,
    }: {
      payload: CreateReservationPayload;
      idempotencyKey: string;
      conflictTestHeader?: boolean;
    }) => {
      const headers: Record<string, string> = {
        'Idempotency-Key': idempotencyKey,
      };
      if (conflictTestHeader) {
        headers['x-mock-conflict'] = '1';
      }
      return api.post<ReservationCreated>(
        endpoints.reservations.create,
        payload,
        { headers },
      );
    },
    onSuccess: (created) => {
      queryClient.setQueryData(qk.reservation(created.ref), created);
      setActiveReservation(created, created.serverTime);
      queryClient.invalidateQueries({ queryKey: qk.pendingReservations() });
      queryClient.invalidateQueries({ queryKey: qk.reservations() });
    },
  });
}

/**
 * Réservations en attente de paiement ou de nouvelle preuve (`reserved` | `payment_rejected`, §7.4 M3 & §7.2 M4).
 * Synchronise automatiquement `reservationStore.activeReservation`.
 */
export function usePendingReservations() {
  const status = useAuthStore((s) => s.status);
  const setActiveReservation = useReservationStore(
    (s) => s.setActiveReservation,
  );

  const query = useQuery({
    queryKey: qk.pendingReservations(),
    queryFn: () =>
      api.get<ReservationsListResponse>(endpoints.reservations.pending),
    enabled: status === 'authenticated',
    staleTime: 30 * 1000,
    refetchOnWindowFocus: true,
  });

  useEffect(() => {
    if (!query.data) return;
    const validPending = query.data.find(
      (r) =>
        (r.status === 'reserved' || r.status === 'payment_rejected') &&
        new Date(r.expiresAt).getTime() > Date.now(),
    );
    if (validPending) {
      setActiveReservation(validPending, validPending.serverTime);
    }
  }, [query.data, setActiveReservation]);

  return query;
}

export interface UseReservationOptions {
  /** Active l'interrogation périodique toutes les 20 s lorsque l'onglet est visible (§7.1 M4) */
  live?: boolean;
}

export function useReservation(
  ref: string | undefined,
  options?: UseReservationOptions,
) {
  const normalizedRef = (ref ?? '').trim().toUpperCase();
  const activeReservation = useReservationStore((s) => s.activeReservation);
  const setActiveReservation = useReservationStore(
    (s) => s.setActiveReservation,
  );
  const clearActiveReservation = useReservationStore(
    (s) => s.clearActiveReservation,
  );

  const initialFromStore =
    activeReservation &&
    activeReservation.ref.toUpperCase() === normalizedRef
      ? activeReservation
      : undefined;

  const query = useQuery({
    queryKey: qk.reservation(normalizedRef),
    queryFn: () =>
      api.get<ReservationDetailResponse>(
        endpoints.reservations.detail(normalizedRef),
      ),
    enabled: Boolean(normalizedRef),
    initialData: initialFromStore,
    staleTime: options?.live ? 0 : 30 * 1000,
    // HYPOTHÈSE: Simple interrogation périodique toutes les 20 s sur les écrans de paiement, preuve et Merci (§7.1).
    // Les notifications push (M6) prendront le relais en arrière-plan.
    refetchInterval: options?.live ? 20_000 : false,
    refetchIntervalInBackground: false,
    refetchOnWindowFocus: options?.live ? 'always' : true,
  });

  useEffect(() => {
    const res = query.data;
    if (!res) return;

    if (res.status === 'reserved' || res.status === 'payment_rejected') {
      setActiveReservation(res, res.serverTime);
    } else if (
      activeReservation &&
      activeReservation.ref.toUpperCase() === res.ref.toUpperCase()
    ) {
      clearActiveReservation();
    }
  }, [
    query.data,
    activeReservation,
    setActiveReservation,
    clearActiveReservation,
  ]);

  return query;
}

