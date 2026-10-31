import type { ErrorContext } from '@/lib/monitoring';

/**
 * Signale une erreur sans mettre la remontée (src/lib/monitoring.ts) dans le JavaScript de
 * démarrage : le module est chargé à la première erreur. La page est relevée tout de suite,
 * avant un éventuel changement de page pendant le chargement.
 */
export function reportErrorLater(error: unknown, context: ErrorContext = {}): void {
  const page = location.pathname;
  import('@/lib/monitoring').then(
    ({ reportError }) => reportError(error, { page, ...context }),
    () => undefined,
  );
}
