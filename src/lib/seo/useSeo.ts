import { useContext, useEffect } from 'react';
import { UNSAFE_LocationContext } from 'react-router';
import { applySeoTags, resetSeoTags, resolveSeo, type SeoOptions } from './seo';

/**
 * Chemin affiché : celui du routeur, sinon celui de la barre d'adresse.
 * Le contexte est lu directement (et non par useLocation) pour que le hook fonctionne aussi
 * dans un composant rendu hors routeur, comme useDocumentTitle avant lui.
 */
function useCurrentPathname(): string {
  const routerLocation = useContext(UNSAFE_LocationContext) as { location?: { pathname?: string } } | null;
  return (
    routerLocation?.location?.pathname ?? (typeof window !== 'undefined' ? window.location.pathname : '/')
  );
}

/**
 * Titre, description, adresse canonique et « noindex » d'une page (M7 §7).
 * Un seul appel par page (le dernier écrit l'emporte). Les pages privées (/reservation*,
 * /reservations*, /profil*, /panier, /_dev…) reçoivent « noindex » sans rien préciser.
 *
 * @example useSeo({ title: 'Babouches', description: 'Babouches en cuir…' })
 */
export function useSeo({ title, absoluteTitle, description, canonicalPath, noindex }: SeoOptions): void {
  const pathname = useCurrentPathname();

  useEffect(() => {
    applySeoTags(resolveSeo({ title, absoluteTitle, description, canonicalPath, noindex }, pathname));
  }, [title, absoluteTitle, description, canonicalPath, noindex, pathname]);

  // À la sortie de la page seulement (pas à chaque changement de titre)
  useEffect(() => () => resetSeoTags(), []);
}
