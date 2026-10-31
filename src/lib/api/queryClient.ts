import { onlineManager, QueryClient } from '@tanstack/react-query';
import { useNetworkStore } from '@/pwa/networkStore';
import { ApiError } from './client';

/**
 * TanStack Query suit l'état réseau unique de l'app (M6 §6.1) au lieu de ses propres écouteurs :
 * les requêtes en pause reprennent et les données périmées se rechargent dès le retour du réseau,
 * y compris quand ce retour est détecté par une requête réussie (sans évènement « online »).
 */
onlineManager.setEventListener((setOnline) => {
  setOnline(useNetworkStore.getState().online);
  return useNetworkStore.subscribe((state, previous) => {
    if (state.online !== previous.online) setOnline(state.online);
  });
});

export function createAppQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 60_000,
        gcTime: 10 * 60_000,
        refetchOnWindowFocus: false,
        networkMode: 'offlineFirst',
        retry: (count, error) => !(error instanceof ApiError && error.status < 500) && count < 2,
      },
      mutations: {
        networkMode: 'offlineFirst',
        retry: 0,
      },
    },
  });
}

export const queryClient = createAppQueryClient();
