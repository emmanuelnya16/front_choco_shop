import { useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';
import { refreshSessionSilently } from '@/lib/api/client';
import { useNetworkStore } from '@/pwa/networkStore';

/**
 * L'app est-elle en ligne ? Façade du store réseau unique (M6 §6.1) : navigator.onLine,
 * évènements online / offline et échec réel des requêtes (2 échecs successifs = hors connexion).
 * API inchangée depuis M3 (panier, tiroir panier, connexion, formulaire, réservations).
 */
export function useOnlineStatus(): boolean {
  return useNetworkStore((s) => s.online);
}

/**
 * Retour du réseau (M6 §6.2) : relance des envois en pause, rechargement des données affichées,
 * puis rafraîchissement silencieux de la session. Le message « Connexion rétablie » est affiché
 * par le bandeau global (features/offline/OfflineBanner) : il n'y a plus de toast en double.
 */
export function useNetworkRecovery(): void {
  const queryClient = useQueryClient();

  useEffect(
    () =>
      useNetworkStore.subscribe((state, previous) => {
        if (!state.online || previous.online) return;
        void queryClient.resumePausedMutations();
        // Requêtes affichées uniquement ; une requête déjà relancée par TanStack n'est pas doublée
        void queryClient.invalidateQueries({ type: 'active' }, { cancelRefetch: false });
        void refreshSessionSilently();
      }),
    [queryClient],
  );
}

/**
 * @deprecated Nom conservé pour RootLayout (M3) : le toast est remplacé par le bandeau global,
 * le hook relance désormais les données au retour du réseau (voir useNetworkRecovery).
 */
export const useNetworkRecoveryToast = useNetworkRecovery;
