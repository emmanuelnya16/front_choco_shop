import { useCallback } from 'react';
import { useNavigate } from 'react-router';

/**
 * Vrai si l'écran précédent appartient à l'application : React Router numérote ses entrées
 * d'historique (`history.state.idx`, 0 pour la première entrée de l'onglet ou de l'app installée).
 * Remplace les anciennes heuristiques `history.length > 2` (fausse au lancement de l'app installée)
 * et `location.key !== 'default'`.
 */
export function hasInAppHistory(): boolean {
  if (typeof window === 'undefined') return false;
  const state: unknown = window.history.state;
  if (!state || typeof state !== 'object') return false;
  const idx = (state as { idx?: unknown }).idx;
  return typeof idx === 'number' && idx > 0;
}

export interface BackNavigationOptions {
  /**
   * Aller toujours vers le parent, sans revenir dans l'historique : écran de fin de parcours
   * (« Merci ») dont l'écran précédent redirigerait aussitôt ici.
   */
  parentOnly?: boolean;
}

/**
 * Logique unique de la flèche retour (M6 §8) : même effet que la touche retour d'Android quand
 * un écran précédent de l'app existe, sinon le parent logique (lien profond, notification,
 * lancement depuis l'écran d'accueil). Le parent remplace l'écran courant : la touche retour ne
 * ramène pas ensuite sur la page quittée.
 */
export function useBackNavigation(fallbackPath: string, options: BackNavigationOptions = {}) {
  const navigate = useNavigate();
  const { parentOnly = false } = options;

  return useCallback(() => {
    if (!parentOnly && hasInAppHistory()) {
      void navigate(-1);
      return;
    }
    void navigate(fallbackPath, { replace: true, viewTransition: true });
  }, [navigate, fallbackPath, parentOnly]);
}
