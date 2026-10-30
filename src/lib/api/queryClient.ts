import { QueryClient } from '@tanstack/react-query';
import { ApiError } from './client';

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
