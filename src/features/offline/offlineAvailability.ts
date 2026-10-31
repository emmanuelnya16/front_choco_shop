import { useQueryClient, type QueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { api } from '@/lib/api/client';
import { endpoints } from '@/lib/api/endpoints';
import { qk } from '@/lib/api/queryKeys';
import { env } from '@/lib/env';
import { CACHE_NAMES } from '@/pwa/cacheRules';
import { isAppOnline } from '@/pwa/networkStore';
import type { RecentlyViewedItem } from '@/stores/recentlyViewedStore';

function hasCacheApi(): boolean {
  return typeof caches !== 'undefined' && typeof caches.open === 'function';
}

/**
 * Fiches produit enregistrées par l'application (cache « api-catalog » du service worker).
 * Renvoie null si l'API Cache est indisponible ou en erreur (navigation privée, contexte non sécurisé).
 */
export async function findCachedProductSlugs(slugs: string[]): Promise<Set<string> | null> {
  if (!hasCacheApi()) return null;
  try {
    const found = new Set<string>();
    if (!(await caches.has(CACHE_NAMES.catalog))) return found;
    const cache = await caches.open(CACHE_NAMES.catalog);
    await Promise.all(
      slugs.map(async (slug) => {
        const url = `${env.apiBaseUrl}${endpoints.catalog.product(slug)}`;
        // Le serveur répond « Vary: Origin » : on compare l'URL seule
        const response = await cache.match(url, { ignoreVary: true });
        if (response) found.add(slug);
      }),
    );
    return found;
  } catch {
    return null;
  }
}

function inMemory(queryClient: QueryClient, slug: string): boolean {
  return queryClient.getQueryData(qk.product(slug)) !== undefined;
}

/**
 * Derniers articles consultés réellement disponibles sans réseau (M6 §6.5) : enregistrés par
 * l'application (cache « api-catalog ») ou encore en mémoire. Sans API Cache : liste simple.
 * Renvoie null pendant la vérification.
 */
export function useOfflineAvailableItems(items: RecentlyViewedItem[]): RecentlyViewedItem[] | null {
  const queryClient = useQueryClient();
  const cacheApi = hasCacheApi();
  const key = items.map((item) => item.slug).join('|');
  const [checked, setChecked] = useState<{ key: string; slugs: Set<string> | null } | null>(null);

  useEffect(() => {
    if (!cacheApi) return undefined;
    let cancelled = false;
    void findCachedProductSlugs(key ? key.split('|') : []).then((slugs) => {
      if (!cancelled) setChecked({ key, slugs });
    });
    return () => {
      cancelled = true;
    };
  }, [cacheApi, key]);

  if (!cacheApi) return items;
  if (!checked || checked.key !== key) return null;
  const { slugs } = checked;
  if (!slugs) return items;
  return items.filter((item) => slugs.has(item.slug) || inMemory(queryClient, item.slug));
}

/**
 * « Réessayer » hors connexion : relance les données affichées et les envois en pause ;
 * sans donnée affichée, une petite requête publique vérifie le réseau. Renvoie l'état final.
 */
export async function retryNetwork(queryClient: QueryClient): Promise<boolean> {
  const hasActiveQueries = queryClient.getQueryCache().findAll({ type: 'active' }).length > 0;
  await Promise.allSettled([
    queryClient.invalidateQueries({ type: 'active' }),
    queryClient.resumePausedMutations(),
    hasActiveQueries ? Promise.resolve() : api.get(endpoints.settings.public, { timeoutMs: 8000 }),
  ]);
  return isAppOnline();
}
