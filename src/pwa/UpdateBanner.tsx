import { lazy, Suspense, useEffect } from 'react';
import { useToastStore } from '@/stores/toastStore';
import { UPDATED_FLAG_KEY, usePwaStore } from './pwaStore';

// Le bandeau lui-même (bouton, animations) n'est chargé que si une nouvelle version attend :
// hors du JavaScript de démarrage (budget M6/M7)
const LazyUpdateBannerPanel = lazy(() =>
  import('./UpdateBannerPanel').then((m) => ({ default: m.UpdateBannerPanel })),
);

/** Lit puis retire le drapeau posé avant le rechargement d'une mise à jour. */
function consumeUpdatedFlag(): boolean {
  try {
    if (sessionStorage.getItem(UPDATED_FLAG_KEY) === null) return false;
    sessionStorage.removeItem(UPDATED_FLAG_KEY);
    return true;
  } catch {
    return false;
  }
}

/**
 * Bandeau « Une nouvelle version est disponible » (M6 §4.7, détail dans UpdateBannerPanel) et, après
 * une mise à jour, toast « Application mise à jour ».
 */
export function UpdateBanner() {
  const updateReady = usePwaStore((s) => s.updateReady);

  useEffect(() => {
    if (!consumeUpdatedFlag()) return;
    useToastStore.getState().show({
      message: 'Application mise à jour',
      subtitle: 'Vous utilisez la dernière version de DR Choco.',
    });
  }, []);

  if (!updateReady) return null;
  return (
    <Suspense fallback={null}>
      <LazyUpdateBannerPanel />
    </Suspense>
  );
}
