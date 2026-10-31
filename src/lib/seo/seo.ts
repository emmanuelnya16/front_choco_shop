/**
 * Référencement côté client (M7 §7) : titre, description, adresse canonique et consigne
 * « noindex » de chaque page. Fonctions pures, testées sans navigateur, et deux fonctions
 * qui écrivent dans <head> (applySeoTags, resetSeoTags).
 *
 * Origine des adresses canoniques : variable facultative VITE_SITE_URL (ex. « https://drchoco.com »,
 * à définir dans l'environnement du build de production), sinon l'origine de la page affichée.
 *
 * Les balises Open Graph lues par WhatsApp et Facebook ne sont pas concernées : ces robots
 * n'exécutent pas le JavaScript, elles doivent être écrites par le serveur (M2).
 */

export const SITE_NAME = 'DR Choco L’Incompris';

/** Titre de l'onglet quand une page n'en donne pas (identique à index.html). */
export const DEFAULT_TITLE = SITE_NAME;

/** Description de la boutique (identique à index.html, vérifiée par les tests). */
export const DEFAULT_DESCRIPTION =
  'Vêtements, chaussures et babouches pour hommes. Réservez en ligne, payez par Mobile Money. Livraison partout au Cameroun ou retrait en boutique.';

// HYPOTHÈSE: domaine définitif inconnu au 31/10/2026 ; même valeur que public/robots.txt et
// public/sitemap.xml, à remplacer partout (ou à fixer par VITE_SITE_URL) avant la mise en ligne.
export const DEFAULT_SITE_URL = 'https://drchoco.com';

/** Longueur au-delà de laquelle les moteurs coupent la description. */
const DESCRIPTION_MAX_LENGTH = 160;

/**
 * Pages privées ou sans intérêt pour un moteur : jamais indexées.
 * Spécification M7 : /reservation*, /reservations*, /profil*, /panier, /_dev.
 * HYPOTHÈSE: /admin, /favoris (liste personnelle), /recherche (résultats de recherche interne)
 * et /hors-ligne (écran de secours) ne sont pas indexés non plus.
 * Ces pages restent explorables (hors robots.txt pour les quatre dernières) pour que le robot lise
 * la consigne « noindex ».
 */
const NOINDEX_PATHS =
  /^\/(?:reservations?|profil|panier|_dev|admin|favoris|recherche|hors-ligne)(?:\/|$)/;

/** Adresses en double : même page affichée sous deux chemins (routeur). */
const CANONICAL_ALIASES: Array<[RegExp, string]> = [[/^\/categorie(\/|$)/, '/explorer$1']];

function stripQueryAndHash(pathOrUrl: string): string {
  let value = pathOrUrl.trim();
  if (/^[a-z][a-z\d+.-]*:\/\//i.test(value)) {
    try {
      value = new URL(value).pathname;
    } catch {
      value = '/';
    }
  }
  const cut = value.search(/[?#]/);
  return cut === -1 ? value : value.slice(0, cut);
}

/**
 * Chemin normalisé : sans paramètres ni ancre, avec « / » initial, sans « / » final ni « // »,
 * en minuscules (le routeur ignore la casse).
 * HYPOTHÈSE: les identifiants d'adresse (catégories, produits) sont toujours en minuscules.
 */
export function normalizePathname(pathOrUrl: string): string {
  let path = stripQueryAndHash(pathOrUrl).toLowerCase();
  if (!path.startsWith('/')) path = `/${path}`;
  path = path.replace(/\/{2,}/g, '/');
  if (path.length > 1) path = path.replace(/\/+$/, '');
  return path || '/';
}

/** Vrai pour les pages à ne jamais indexer (réservation, suivi, profil, panier, /_dev…). */
export function isNoindexPath(pathOrUrl: string): boolean {
  return NOINDEX_PATHS.test(normalizePathname(pathOrUrl));
}

/** Origine sans « / » final ; seuls http et https sont acceptés. */
function originOf(value: unknown): string | null {
  if (typeof value !== 'string' || !value.trim()) return null;
  try {
    const url = new URL(value.trim());
    return url.protocol === 'https:' || url.protocol === 'http:' ? url.origin : null;
  } catch {
    return null;
  }
}

/** Origine des adresses canoniques : VITE_SITE_URL, sinon celle de la page, sinon le domaine prévu. */
export function siteOrigin(configured: unknown = import.meta.env.VITE_SITE_URL): string {
  const fromEnv = originOf(configured);
  if (fromEnv) return fromEnv;
  if (typeof window !== 'undefined') {
    const fromPage = originOf(window.location.origin);
    if (fromPage) return fromPage;
  }
  return DEFAULT_SITE_URL;
}

/**
 * Adresse canonique absolue d'une page : sans paramètres de filtre (?sub, ?price, ?sort…),
 * sans ancre, et `/categorie/x` ramené à `/explorer/x`.
 */
export function canonicalFor(pathname: string, origin: string = siteOrigin()): string {
  let path = normalizePathname(pathname);
  for (const [pattern, replacement] of CANONICAL_ALIASES) {
    path = path.replace(pattern, replacement);
  }
  return `${origin.replace(/\/+$/, '')}${path}`;
}

/** Titre de l'onglet : « Mes réservations · DR Choco », ou le nom de la boutique si vide. */
export function buildDocumentTitle(title: string): string {
  const trimmed = title.trim();
  return trimmed ? `${trimmed} · DR Choco` : DEFAULT_TITLE;
}

/** Description sur une ligne, coupée au dernier mot avant 160 caractères. */
export function normalizeDescription(description: string | undefined): string {
  const text = (description ?? '').replace(/\s+/g, ' ').trim();
  if (!text) return DEFAULT_DESCRIPTION;
  if (text.length <= DESCRIPTION_MAX_LENGTH) return text;
  const cut = text.slice(0, DESCRIPTION_MAX_LENGTH - 1);
  const lastSpace = cut.lastIndexOf(' ');
  return `${(lastSpace > 80 ? cut.slice(0, lastSpace) : cut).replace(/[\s,;:.]+$/, '')}…`;
}

export interface SeoOptions {
  /** Titre de la page, complété par « · DR Choco » (sauf si absoluteTitle). */
  title: string;
  /** Titre utilisé tel quel (ex. fiche produit avec prix). */
  absoluteTitle?: boolean;
  /** Description propre à la page ; description de la boutique si absente. */
  description?: string;
  /** Chemin canonique imposé (ex. `/produit/slug`) ; par défaut, le chemin affiché. */
  canonicalPath?: string;
  /** Force (true) ou interdit (false) le « noindex » ; par défaut, selon le chemin. */
  noindex?: boolean;
}

export interface SeoTags {
  title: string;
  description: string;
  /** Adresse canonique absolue, absente pour une page non indexée. */
  canonical: string | null;
  /** Contenu de <meta name="robots">, absent pour une page indexable. */
  robots: string | null;
}

/** Balises d'une page à partir de ses options et du chemin affiché. */
export function resolveSeo(options: SeoOptions, pathname: string, origin: string = siteOrigin()): SeoTags {
  const noindex = options.noindex ?? isNoindexPath(pathname);
  return {
    title: options.absoluteTitle ? options.title.trim() || DEFAULT_TITLE : buildDocumentTitle(options.title),
    description: normalizeDescription(options.description),
    // Pas d'adresse canonique sur une page non indexée : deux consignes contradictoires sinon
    canonical: noindex ? null : canonicalFor(options.canonicalPath ?? pathname, origin),
    robots: noindex ? 'noindex' : null,
  };
}

function upsertHeadElement<T extends HTMLElement>(
  doc: Document,
  selector: string,
  tag: 'meta' | 'link',
  attrs: Record<string, string>,
): T {
  let el = doc.head.querySelector<T>(selector);
  if (!el) {
    el = doc.createElement(tag) as unknown as T;
    doc.head.appendChild(el);
  }
  for (const [name, value] of Object.entries(attrs)) el.setAttribute(name, value);
  return el;
}

/** Écrit (ou met à jour) une balise <meta> repérée par son sélecteur. */
export function upsertMeta(selector: string, attrs: Record<string, string>, doc: Document = document): void {
  upsertHeadElement<HTMLMetaElement>(doc, selector, 'meta', attrs);
}

/** Écrit les balises d'une page dans <head>. */
export function applySeoTags(tags: SeoTags, doc: Document = document): void {
  doc.title = tags.title;
  upsertMeta('meta[name="description"]', { name: 'description', content: tags.description }, doc);

  if (tags.canonical) {
    upsertHeadElement<HTMLLinkElement>(doc, 'link[rel="canonical"]', 'link', {
      rel: 'canonical',
      href: tags.canonical,
    });
  } else {
    doc.head.querySelector('link[rel="canonical"]')?.remove();
  }

  if (tags.robots) {
    upsertMeta('meta[name="robots"]', { name: 'robots', content: tags.robots }, doc);
  } else {
    doc.head.querySelector('meta[name="robots"]')?.remove();
  }
}

/**
 * Retour à l'état de index.html quand une page disparaît (le titre est laissé : la page suivante
 * écrit le sien). Évite qu'un « noindex » ou une adresse canonique reste sur la page suivante.
 */
export function resetSeoTags(doc: Document = document): void {
  upsertMeta('meta[name="description"]', { name: 'description', content: DEFAULT_DESCRIPTION }, doc);
  doc.head.querySelector('link[rel="canonical"]')?.remove();
  doc.head.querySelector('meta[name="robots"]')?.remove();
}
