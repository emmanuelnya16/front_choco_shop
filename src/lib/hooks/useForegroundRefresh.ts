import { useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';

/** Au-delà de cette durée en arrière-plan, les données affichées sont rechargées (M6 §8). */
export const FOREGROUND_REFRESH_AFTER_MS = 60 * 60 * 1000;

/**
 * Retour au premier plan après plusieurs heures (app installée laissée ouverte) : les requêtes
 * des écrans affichés sont invalidées, donc rechargées en arrière-plan sans vider l'écran.
 * La session, elle, est déjà revérifiée par RootLayout à chaque retour sur l'app.
 */
export function useForegroundRefresh(thresholdMs: number = FOREGROUND_REFRESH_AFTER_MS): void {
  const queryClient = useQueryClient();

  useEffect(() => {
    let hiddenAt: number | null = document.visibilityState === 'hidden' ? Date.now() : null;

    const refreshIfStale = () => {
      if (hiddenAt !== null && Date.now() - hiddenAt >= thresholdMs) {
        void queryClient.invalidateQueries({ type: 'active' });
      }
      hiddenAt = null;
    };

    const onVisibilityChange = () => {
      if (document.visibilityState === 'hidden') {
        hiddenAt = Date.now();
      } else {
        refreshIfStale();
      }
    };

    // Page restaurée depuis le cache du navigateur (retour arrière, app rouverte) : même règle
    const onPageShow = (event: PageTransitionEvent) => {
      if (event.persisted) refreshIfStale();
    };
    const onPageHide = () => {
      hiddenAt ??= Date.now();
    };

    document.addEventListener('visibilitychange', onVisibilityChange);
    window.addEventListener('pageshow', onPageShow);
    window.addEventListener('pagehide', onPageHide);
    return () => {
      document.removeEventListener('visibilitychange', onVisibilityChange);
      window.removeEventListener('pageshow', onPageShow);
      window.removeEventListener('pagehide', onPageHide);
    };
  }, [queryClient, thresholdMs]);
}
