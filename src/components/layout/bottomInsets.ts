import { useEffect } from 'react';

/**
 * Barres d'action collantes des pages (fiche produit, panier rempli, réservation, paiement).
 * Contrat : attribut `data-bottom-bar` sur la barre.
 */
// HYPOTHÈSE: tant que les pages ne portent pas l'attribut data-bottom-bar, leurs barres d'action
// sont reconnues à leur forme commune : pleine largeur, collées en bas, rendues dans <main>.
export const ACTION_BAR_SELECTOR = '[data-bottom-bar], main .fixed.bottom-0.left-0.right-0';

/** Bandeau « Une nouvelle version est disponible » (src/pwa/UpdateBanner.tsx). */
export const UPDATE_BANNER_SELECTOR = '.update-banner';

/** Écart entre le bandeau de mise à jour et l'élément posé au-dessus de lui. */
const UPDATE_BANNER_GAP_PX = 12;

const MEASURED = [
  { selector: ACTION_BAR_SELECTOR, variable: '--bottom-bar-h', gap: 0 },
  { selector: UPDATE_BANNER_SELECTOR, variable: '--update-banner-h', gap: UPDATE_BANNER_GAP_PX },
] as const;

function findVisible(selector: string): Element | null {
  for (const element of document.querySelectorAll(selector)) {
    // Une barre masquée (lg:hidden, hidden) mesure 0
    if (element.getBoundingClientRect().height > 0) return element;
  }
  return null;
}

/**
 * Pile du bas de l'écran mobile (voir index.css) : mesure les éléments de hauteur variable et
 * expose leur hauteur en variables CSS sur <html> :
 * - `--bottom-bar-h` : barre d'action collante de la page, zone de sécurité comprise (sans elle,
 *   la valeur vient de la feuille de style : barre basse ou zone de sécurité seule) ;
 * - `--update-banner-h` : bandeau de mise à jour, écart de 12 px compris.
 * Monté une seule fois avec la barre basse.
 */
export function useBottomInsets(): void {
  useEffect(() => {
    if (typeof ResizeObserver === 'undefined' || typeof MutationObserver === 'undefined') {
      return undefined;
    }

    const rootStyle = document.documentElement.style;
    const observed = new Map<string, Element | null>();
    let frame = 0;

    const measure = () => {
      for (const { variable, gap } of MEASURED) {
        const element = observed.get(variable);
        const height = element ? element.getBoundingClientRect().height : 0;
        if (height > 0) rootStyle.setProperty(variable, `${Math.ceil(height) + gap}px`);
        else rootStyle.removeProperty(variable);
      }
    };

    const resizeObserver = new ResizeObserver(measure);

    const scan = () => {
      frame = 0;
      for (const { selector, variable } of MEASURED) {
        const element = findVisible(selector);
        const previous = observed.get(variable) ?? null;
        if (element === previous) continue;
        if (previous) resizeObserver.unobserve(previous);
        if (element) resizeObserver.observe(element);
        observed.set(variable, element);
      }
      measure();
    };

    // Les barres apparaissent avec la page (chargement, données) : nouvel examen à chaque ajout ou
    // retrait d'élément, au plus une fois par image
    const schedule = () => {
      if (!frame) frame = window.requestAnimationFrame(scan);
    };

    const mutationObserver = new MutationObserver(schedule);
    mutationObserver.observe(document.body, { childList: true, subtree: true });
    window.addEventListener('resize', schedule);
    scan();

    return () => {
      if (frame) window.cancelAnimationFrame(frame);
      mutationObserver.disconnect();
      resizeObserver.disconnect();
      window.removeEventListener('resize', schedule);
      for (const { variable } of MEASURED) rootStyle.removeProperty(variable);
    };
  }, []);
}
