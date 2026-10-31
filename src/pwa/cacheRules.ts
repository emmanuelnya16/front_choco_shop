/**
 * Règles de mise en cache du service worker (M6 §4.5), en fonctions pures :
 * importées par src/sw.ts et testées sans navigateur.
 */

export const CACHE_NAMES = {
  pages: 'pages',
  catalog: 'api-catalog',
  user: 'api-user',
  images: 'images',
  fonts: 'fonts',
} as const;

export type CacheName = (typeof CACHE_NAMES)[keyof typeof CACHE_NAMES];

export type CacheStrategy =
  /** Jamais mis en cache : directement au réseau. */
  | 'network-only'
  /** Pages : réseau d'abord (3 s), repli sur index.html précaché. */
  | 'pages'
  /** Catalogue : réponse enregistrée tout de suite, mise à jour en arrière-plan. */
  | 'catalog'
  /** Données du client : réseau d'abord (4 s), dernier état connu sinon. */
  | 'user'
  /** Images publiques du catalogue : enregistrées d'abord. */
  | 'images'
  /** Polices non précachées (latin étendu, vietnamien) : enregistrées d'abord. */
  | 'fonts';

export const CACHE_LIMITS = {
  pages: { networkTimeoutSeconds: 3 },
  catalog: { maxEntries: 300, maxAgeSeconds: 7 * 24 * 60 * 60 },
  user: { maxEntries: 60, maxAgeSeconds: 2 * 24 * 60 * 60, networkTimeoutSeconds: 4 },
  images: { maxEntries: 200, maxAgeSeconds: 30 * 24 * 60 * 60 },
  fonts: { maxEntries: 10, maxAgeSeconds: 365 * 24 * 60 * 60 },
} as const;

export interface RequestDescriptor {
  url: URL;
  method: string;
  /** Request.mode : 'navigate' pour une page. */
  mode?: string;
  /** Request.destination : 'document', 'image', 'font'… */
  destination?: string;
}

export interface CacheRulesContext {
  /** Origine de l'app (self.location.origin). */
  appOrigin: string;
  /** VITE_API_BASE_URL, sans barre finale (ex. https://api.drchoco.cm/api). */
  apiBaseUrl: string;
}

/** Paramètres d'URL signée : la réponse est privée et de courte durée. */
const SIGNATURE_PARAMS = [
  'signature',
  'sig',
  'token',
  'expires',
  'x-amz-signature',
  'x-goog-signature',
  '__cld_token__',
];

/**
 * Médias privés : preuves de paiement et photos de colis.
 * HYPOTHÈSE: motif à confirmer avec le back-end : chemins Cloudinary /private/ et /authenticated/,
 * segment de signature Cloudinary « s--xxxx-- », ou paramètres de signature dans l'URL.
 * Les fichiers de démonstration /mock/colis-* et /mock/preuve-* jouent ce rôle avec les mocks.
 */
export function isPrivateMedia(url: URL): boolean {
  const path = url.pathname;
  if (/\/(private|authenticated)\//.test(path)) return true;
  if (/\/s--[A-Za-z0-9_-]{6,}--\//.test(path)) return true;
  if (/^\/mock\/(colis|preuve)-/.test(path)) return true;
  for (const key of url.searchParams.keys()) {
    if (SIGNATURE_PARAMS.includes(key.toLowerCase())) return true;
  }
  return false;
}

/** Espace d'administration (futur module) : jamais mis en cache ni servi hors connexion. */
export function isAdminUrl(url: URL, ctx: CacheRulesContext): boolean {
  if (url.origin === ctx.appOrigin && /^\/admin(\/|$)/.test(url.pathname)) return true;
  if (/(^|\/)api\/admin(\/|$)/.test(url.pathname)) return true;
  const apiPath = apiRelativePath(url, ctx);
  return apiPath !== null && /^\/admin(\/|$)/.test(apiPath);
}

/** Chemin relatif à l'API (ex. « /products/hoodie »), ou null si l'URL n'est pas une URL d'API. */
export function apiRelativePath(url: URL, ctx: CacheRulesContext): string | null {
  let base: URL;
  try {
    base = new URL(ctx.apiBaseUrl.replace(/\/+$/, ''), ctx.appOrigin);
  } catch {
    return null;
  }
  if (url.origin !== base.origin) return null;
  const basePath = base.pathname.replace(/\/+$/, '');
  if (basePath && url.pathname !== basePath && !url.pathname.startsWith(`${basePath}/`)) {
    return null;
  }
  return url.pathname.slice(basePath.length) || '/';
}

const API_NEVER_CACHE = [/^\/auth(\/|$)/, /^\/push(\/|$)/, /^\/cart\/validate(\/|$)/, /^\/_mock(\/|$)/];
const API_PRIVATE = [/^\/reservations\/[^/]+\/proof(\/|$)/, /^\/reservations\/[^/]+\/photos(\/|$)/];
const API_CATALOG = [
  /^\/categories(\/|$)/,
  /^\/products(\/|$)/,
  /^\/looks(\/|$)/,
  /^\/search\/suggest(\/|$)/,
  /^\/settings\/public$/,
  /^\/delivery\//,
];
const API_USER = [/^\/me$/, /^\/me\/addresses(\/|$)/, /^\/reservations(\/|$)/, /^\/favorites(\/|$)/];

function isPublicCloudinaryImage(url: URL): boolean {
  return url.hostname === 'res.cloudinary.com' && /^\/[^/]+\/image\/upload\//.test(url.pathname);
}

/** Choisit la stratégie de cache d'une requête (M6 §4.5). */
export function classifyRequest(req: RequestDescriptor, ctx: CacheRulesContext): CacheStrategy {
  if (req.method.toUpperCase() !== 'GET') return 'network-only';
  const { url } = req;
  if (url.protocol !== 'https:' && url.protocol !== 'http:') return 'network-only';
  if (isAdminUrl(url, ctx)) return 'network-only';
  if (isPrivateMedia(url)) return 'network-only';

  const apiPath = apiRelativePath(url, ctx);
  if (apiPath !== null) {
    if (API_NEVER_CACHE.some((re) => re.test(apiPath))) return 'network-only';
    if (API_PRIVATE.some((re) => re.test(apiPath))) return 'network-only';
    if (API_CATALOG.some((re) => re.test(apiPath))) return 'catalog';
    if (API_USER.some((re) => re.test(apiPath))) return 'user';
    return 'network-only';
  }

  if (url.origin === ctx.appOrigin) {
    if (req.mode === 'navigate' || req.destination === 'document') {
      // Le simulateur et les pages de développement ne font pas partie de l'app installée
      if (/^\/_dev(\/|$)/.test(url.pathname)) return 'network-only';
      return 'pages';
    }
    if (/^\/(images|mock)\//.test(url.pathname)) return 'images';
    if (/^\/assets\/.+\.woff2$/.test(url.pathname)) return 'fonts';
    return 'network-only';
  }

  if (isPublicCloudinaryImage(url)) return 'images';
  return 'network-only';
}

/**
 * Type de contenu attendu par stratégie. Indispensable pour une application d'une seule page : le
 * serveur répond index.html (200, text/html) à toute adresse inconnue, y compris une image manquante,
 * qui serait sinon enregistrée comme image.
 */
const EXPECTED_CONTENT_TYPE: Record<Exclude<CacheStrategy, 'network-only'>, RegExp> = {
  pages: /^text\/html/i,
  catalog: /json/i,
  user: /json/i,
  images: /^image\//i,
  fonts: /^(font\/|application\/(font|x-font|octet-stream))/i,
};

/**
 * Une réponse ne s'enregistre que si elle est complète (200), sans « Cache-Control: no-store », et,
 * si la stratégie est donnée, du type de contenu attendu.
 */
export function isCacheableResponse(
  response: { status: number; type?: string; headers: Headers },
  strategy?: Exclude<CacheStrategy, 'network-only'>,
): boolean {
  if (response.status !== 200) return false;
  if (response.type === 'opaque' || response.type === 'error') return false;
  const cacheControl = response.headers.get('Cache-Control') ?? '';
  if (/(^|,)\s*no-store\s*(,|$)/i.test(cacheControl)) return false;
  if (strategy) {
    const contentType = response.headers.get('Content-Type') ?? '';
    if (!EXPECTED_CONTENT_TYPE[strategy].test(contentType)) return false;
  }
  return true;
}

/** Routes de l'app qui ne doivent jamais proposer ni forcer une mise à jour (M6 §4.7). */
export function isUpdateBlockedPath(pathname: string): boolean {
  const path = pathname.replace(/\/+$/, '') || '/';
  return /^\/reservation$/.test(path) || /^\/reservation\/[^/]+\/(paiement|preuve)$/.test(path);
}
