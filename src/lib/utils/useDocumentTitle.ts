import type { SeoOptions } from '@/lib/seo/seo';
import { useSeo } from '@/lib/seo/useSeo';

/**
 * Titre de l'onglet (« Mon profil · DR Choco ») et, depuis M7, balises de référencement de la page :
 * description (celle de la boutique par défaut), adresse canonique et « noindex » des pages privées.
 * Les appels existants `useDocumentTitle('Mon profil')` restent valables.
 *
 * @example useDocumentTitle('Babouches', { description: 'Babouches en cuir faites main…' })
 */
export function useDocumentTitle(title: string, options: Omit<SeoOptions, 'title'> = {}): void {
  useSeo({ ...options, title });
}
