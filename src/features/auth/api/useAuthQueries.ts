import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback } from 'react';
import { clearAppBadge } from '@/features/notifications/appBadge';
import { unsubscribeOnLogout } from '@/features/notifications/pushService';
import { api } from '@/lib/api/client';
import { endpoints } from '@/lib/api/endpoints';
import { qk } from '@/lib/api/queryKeys';
import { clearUserDataCache } from '@/pwa/registerSW';
import { useAuthStore } from '@/stores/authStore';
import { useFavoritesStore } from '@/stores/favoritesStore';
import { useReservationStore } from '@/stores/reservationStore';
import { useUiStore } from '@/stores/uiStore';
import type {
  AuthSession,
  OtpRequestPayload,
  OtpRequestResult,
  OtpVerifyPayload,
  UpdateProfilePayload,
} from '@/types/api';
import type { User } from '@/types/domain';

export function useRequestOtp() {
  return useMutation({
    mutationFn: (payload: OtpRequestPayload) =>
      api.post<OtpRequestResult>(endpoints.auth.otpRequest, payload, {
        skipAuthRefresh: true,
      }),
  });
}

export function useVerifyOtp() {
  const queryClient = useQueryClient();
  const setSession = useAuthStore((s) => s.setSession);

  return useMutation({
    mutationFn: (payload: OtpVerifyPayload) =>
      api.post<AuthSession>(endpoints.auth.otpVerify, payload, {
        skipAuthRefresh: true,
      }),
    onSuccess: async (session) => {
      setSession(session.accessToken, session.user);
      queryClient.setQueryData(qk.me(), session.user);
      queryClient.invalidateQueries({ queryKey: qk.addresses() });
      queryClient.invalidateQueries({ queryKey: qk.pendingReservations() });

      // Fusionne les favoris locaux avec ceux du compte sans doublon (§5.5)
      try {
        const localIds = useFavoritesStore.getState().ids;
        if (localIds.length > 0) {
          const remoteIds = await api.post<string[]>(endpoints.favorites.list, {
            productIds: localIds,
          });
          if (Array.isArray(remoteIds)) {
            const favStore = useFavoritesStore.getState();
            for (const id of remoteIds) {
              if (!favStore.has(id)) {
                favStore.toggle(id);
              }
            }
          }
        }
      } catch {
        // Silencieux si hors ligne ou endpoint non critique
      }
    },
  });
}

export function useMe() {
  const status = useAuthStore((s) => s.status);
  const user = useAuthStore((s) => s.user);

  return useQuery({
    queryKey: qk.me(),
    queryFn: () => api.get<User>(endpoints.me.profile),
    enabled: status === 'authenticated' && Boolean(user),
    initialData: user ?? undefined,
    staleTime: 5 * 60 * 1000,
  });
}

export function useUpdateProfile() {
  const queryClient = useQueryClient();
  const setSession = useAuthStore((s) => s.setSession);

  return useMutation({
    mutationFn: (payload: UpdateProfilePayload) =>
      api.patch<User>(endpoints.me.profile, payload),
    onSuccess: (updatedUser) => {
      const token = useAuthStore.getState().accessToken ?? 'session-token';
      setSession(token, updatedUser);
      queryClient.setQueryData(qk.me(), updatedUser);
    },
  });
}

export function useLogout() {
  const queryClient = useQueryClient();
  const clearSession = useAuthStore((s) => s.clearSession);
  const clearActiveReservation = useReservationStore(
    (s) => s.clearActiveReservation,
  );

  return useMutation({
    mutationFn: async () => {
      // Plus de notifications pour ce compte sur ce téléphone (M6 §7.1) : au mieux, 3 s au plus.
      // HYPOTHÈSE: POST /push/unsubscribe exige la session du client ; il part donc AVANT
      // /auth/logout (et non dans onSettled, où la session est déjà vidée).
      await unsubscribeOnLogout();
      try {
        await api.post<void>(endpoints.auth.logout, undefined, {
          skipAuthRefresh: true,
        });
      } catch {
        // Déconnexion locale garantie même en cas d'erreur réseau
      }
    },
    onSettled: () => {
      // Vide la session et les réservations en cache, mais conserve le panier (§5.5)
      clearSession();
      clearActiveReservation();
      queryClient.removeQueries({ queryKey: qk.me() });
      queryClient.removeQueries({ queryKey: qk.addresses() });
      queryClient.removeQueries({ queryKey: qk.reservations() });
      queryClient.removeQueries({ queryKey: qk.pendingReservations() });
      // Pastille de l'icône effacée, données personnelles enregistrées pour le hors connexion vidées (M6)
      clearAppBadge();
      void clearUserDataCache();
    },
  });
}

/**
 * Hook pratique déclenchant `next()` si le client est connecté,
 * ou ouvrant la feuille OTP par-dessus l'écran courant sinon (§5.1).
 */
export function useRequireAuth() {
  const requireAuth = useUiStore((s) => s.requireAuth);
  return useCallback(
    (next: () => void, onCancel?: () => void) => {
      requireAuth(next, onCancel);
    },
    [requireAuth],
  );
}
