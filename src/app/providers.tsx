import { QueryClientProvider, type QueryClient } from '@tanstack/react-query';
import { lazy, Suspense, type ReactNode } from 'react';
import { queryClient as defaultQueryClient } from '@/lib/api/queryClient';
import { MotionProvider } from '@/motion/MotionProvider';

const LazyQueryDevtools = import.meta.env.DEV
  ? lazy(() =>
      import('@tanstack/react-query-devtools').then((mod) => ({
        default: mod.ReactQueryDevtools,
      })),
    )
  : null;

interface AppProvidersProps {
  children: ReactNode;
  client?: QueryClient;
}

export function AppProviders({ children, client = defaultQueryClient }: AppProvidersProps) {
  return (
    <QueryClientProvider client={client}>
      <MotionProvider>{children}</MotionProvider>
      {LazyQueryDevtools && (
        <Suspense fallback={null}>
          <LazyQueryDevtools initialIsOpen={false} />
        </Suspense>
      )}
    </QueryClientProvider>
  );
}
