/**
 * Noms des caches du service worker et routes protégées des mises à jour (M6 §4.5, §4.7).
 * Module minuscule, à part de cacheRules.ts : l'app l'importe au démarrage (bandeau de mise à jour,
 * articles disponibles hors connexion) sans embarquer les règles de mise en cache, qui ne servent
 * qu'au service worker. cacheRules.ts les réexporte.
 */
export const CACHE_NAMES = {
  pages: 'pages',
  catalog: 'api-catalog',
  user: 'api-user',
  images: 'images',
  fonts: 'fonts',
} as const;

export type CacheName = (typeof CACHE_NAMES)[keyof typeof CACHE_NAMES];

/** Routes de l'app qui ne doivent jamais proposer ni forcer une mise à jour (M6 §4.7). */
export function isUpdateBlockedPath(pathname: string): boolean {
  const path = pathname.replace(/\/+$/, '') || '/';
  return /^\/reservation$/.test(path) || /^\/reservation\/[^/]+\/(paiement|preuve)$/.test(path);
}
