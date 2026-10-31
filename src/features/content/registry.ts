import type { ContentKind } from './types';

/**
 * Pages de contenu connues de l'app (M7 §3.2). Le titre sert pendant le chargement et pour les
 * liens (pied de page, centre d'aide) ; le titre affiché dans la page vient de l'API, pour rester
 * modifiable depuis l'administration.
 */
export interface ContentEntry {
  slug: string;
  title: string;
  kind: ContentKind;
  /** Phrase courte affichée dans le centre d'aide. */
  description: string;
}

export const LEGAL_PAGES: readonly ContentEntry[] = [
  {
    slug: 'conditions-generales',
    title: 'Conditions générales de réservation',
    kind: 'legal',
    description: 'Les règles de la réservation, du paiement et de la remise de vos articles.',
  },
  {
    slug: 'annulation-retours',
    title: 'Politique d’annulation et de retour',
    kind: 'legal',
    description: 'Quand et comment annuler, échanger ou retourner un article.',
  },
  {
    slug: 'confidentialite',
    title: 'Politique de confidentialité',
    kind: 'legal',
    description: 'Les informations que nous gardons, pourquoi, et vos droits.',
  },
  {
    slug: 'mentions-legales',
    title: 'Mentions légales',
    kind: 'legal',
    description: 'L’éditeur du site et son hébergeur.',
  },
];

export const HELP_PAGES: readonly ContentEntry[] = [
  {
    slug: 'comment-reserver',
    title: 'Comment réserver',
    kind: 'help',
    description: 'Choisir vos articles, les mettre de côté 24\u00A0h et finaliser votre réservation.',
  },
  {
    slug: 'paiement-mobile-money',
    title: 'Payer par Mobile Money',
    kind: 'help',
    description: 'Payer avec Orange Money ou MTN MoMo, puis envoyer votre preuve de paiement.',
  },
  {
    slug: 'livraison-retrait',
    title: 'Livraison et retrait',
    kind: 'help',
    description: 'Livraison à Douala, envoi par agence de voyage ou Retrait en boutique.',
  },
  {
    slug: 'suivre-ma-reservation',
    title: 'Suivre ma réservation',
    kind: 'help',
    description: 'Les étapes de votre réservation, la photo du colis et les notifications.',
  },
];

/** Questions fréquentes : une page Markdown dont chaque « ## Question ? » devient un accordéon. */
export const FAQ_SLUG = 'questions-frequentes';
export const FAQ_TITLE = 'Questions fréquentes';
export const HELP_CENTER_PATH = '/aide';
export const HELP_CENTER_TITLE = 'Centre d’aide';
/** Ancre de la section des questions fréquentes dans le centre d'aide. */
export const FAQ_ANCHOR = 'questions-frequentes';

const ALL_PAGES: readonly ContentEntry[] = [...LEGAL_PAGES, ...HELP_PAGES];

/** Slug acceptable avant tout appel réseau : minuscules, chiffres et tirets. */
const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export function isValidContentSlug(slug: string | undefined): slug is string {
  return typeof slug === 'string' && slug.length <= 80 && SLUG_PATTERN.test(slug);
}

export function findContentEntry(slug: string | undefined): ContentEntry | undefined {
  return ALL_PAGES.find((entry) => entry.slug === slug);
}

export function contentPath(entry: Pick<ContentEntry, 'slug' | 'kind'>): string {
  return entry.kind === 'legal' ? `/pages/${entry.slug}` : `${HELP_CENTER_PATH}/${entry.slug}`;
}

/**
 * Anciennes adresses encore utilisées par des liens de l'app (M3 à M6) ou déjà partagées.
 * HYPOTHÈSE: on redirige plutôt que d'afficher « Page introuvable » ; à retirer quand plus aucun
 * lien ne les utilise.
 */
const LEGACY_PATHS: Readonly<Record<string, string>> = {
  cgv: '/pages/conditions-generales',
  'politique-retour': '/pages/annulation-retours',
  'livraison-et-retrait': '/aide/livraison-retrait',
};

/**
 * Adresse canonique d'une page demandée sous une rubrique : ancienne adresse, page d'aide ouverte
 * sous /pages/ (ou l'inverse), questions fréquentes (section du centre d'aide). `null` si
 * l'adresse demandée est la bonne ou si la page est inconnue de l'app (elle est alors demandée à
 * l'API : une page ajoutée depuis l'administration s'affiche sans mise à jour de l'app).
 */
export function resolveContentRedirect(slug: string | undefined, requestedKind: ContentKind): string | null {
  if (!slug) return null;
  if (slug === FAQ_SLUG) return `${HELP_CENTER_PATH}#${FAQ_ANCHOR}`;
  const legacy = LEGACY_PATHS[slug];
  if (legacy) return legacy;
  const entry = findContentEntry(slug);
  if (entry && entry.kind !== requestedKind) return contentPath(entry);
  return null;
}
