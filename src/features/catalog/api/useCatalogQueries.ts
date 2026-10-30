import {
  keepPreviousData,
  useInfiniteQuery,
  useQuery,
  useQueryClient,
  type InfiniteData,
} from '@tanstack/react-query';
import { useCallback, useEffect, useRef, useState } from 'react';
import { api } from '@/lib/api/client';
import { endpoints } from '@/lib/api/endpoints';
import { qk } from '@/lib/api/queryKeys';
import type {
  CategoriesResponse,
  LookDetailResponse,
  LooksResponse,
  ProductDetailResponse,
  ProductFilters,
  ProductsResponse,
  PublicSettingsResponse,
  SearchSuggestResponse,
} from '@/types/api';
import type { Product } from '@/types/domain';

const FIVE_MINUTES_MS = 5 * 60 * 1000;

export function useCategories() {
  return useQuery({
    queryKey: qk.categories(),
    queryFn: () => api.get<CategoriesResponse>(endpoints.catalog.categories),
  });
}

export function useProducts(filters?: ProductFilters) {
  return useQuery({
    queryKey: qk.products(filters),
    queryFn: () => api.get<ProductsResponse>(endpoints.catalog.products(filters)),
    placeholderData: keepPreviousData,
  });
}

/**
 * Pagination infinie de la page Explorer (§3.4).
 * Conserve les résultats précédents pendant le chargement d'un nouveau filtre (`keepPreviousData`).
 */
export function useProductsInfinite(
  filters?: Omit<ProductFilters, 'page'>,
  pageSize = 12,
) {
  const normalizedFilters = { ...filters, pageSize };

  return useInfiniteQuery({
    queryKey: qk.productsInfinite(normalizedFilters),
    initialPageParam: 1,
    queryFn: ({ pageParam }) =>
      api.get<ProductsResponse>(
        endpoints.catalog.products({
          ...normalizedFilters,
          page: pageParam as number,
        }),
      ),
    getNextPageParam: (lastPage) => {
      const loadedCount = lastPage.page * lastPage.pageSize;
      if (loadedCount < lastPage.total) {
        return lastPage.page + 1;
      }
      return undefined;
    },
    placeholderData: keepPreviousData,
  });
}

/**
 * Détail d'un article par son slug (§3.4).
 * Pré-remplit instantanément les données de base (nom, prix, photo, couleurs)
 * depuis le cache de la grille si disponibles pendant le chargement du détail complet.
 */
export function useProduct(slug: string | undefined) {
  const queryClient = useQueryClient();

  return useQuery({
    queryKey: qk.product(slug ?? ''),
    enabled: Boolean(slug),
    staleTime: FIVE_MINUTES_MS,
    queryFn: () =>
      api.get<ProductDetailResponse>(endpoints.catalog.product(slug ?? '')),
    placeholderData: (): ProductDetailResponse | undefined => {
      if (!slug) return undefined;

      // Cherche dans les requêtes `products` classiques
      const productQueries = queryClient.getQueriesData<ProductsResponse>({
        queryKey: ['catalog', 'products'],
      });
      for (const [, data] of productQueries) {
        const match = data?.items?.find((item) => item.slug === slug);
        if (match) {
          return { ...match, related: [] };
        }
      }

      // Cherche dans les requêtes `productsInfinite`
      const infiniteQueries = queryClient.getQueriesData<
        InfiniteData<ProductsResponse>
      >({
        queryKey: ['catalog', 'products-infinite'],
      });
      for (const [, infiniteData] of infiniteQueries) {
        if (!infiniteData?.pages) continue;
        for (const page of infiniteData.pages) {
          const match = page.items.find((item) => item.slug === slug);
          if (match) {
            return { ...match, related: [] };
          }
        }
      }

      return undefined;
    },
  });
}

/**
 * Pré-chargement de la fiche produit au survol (> 150 ms) sur ordinateur
 * ou au `pointerdown` sur mobile (§3.4).
 */
export function usePrefetchProduct() {
  const queryClient = useQueryClient();
  const hoverTimerRef = useRef<number | null>(null);

  const prefetchNow = useCallback(
    (slug: string) => {
      if (!slug) return;
      void queryClient.prefetchQuery({
        queryKey: qk.product(slug),
        queryFn: () =>
          api.get<ProductDetailResponse>(endpoints.catalog.product(slug)),
        staleTime: FIVE_MINUTES_MS,
      });
    },
    [queryClient],
  );

  const onPointerEnter = useCallback(
    (slug: string) => {
      if (typeof window === 'undefined') return;
      if (hoverTimerRef.current) {
        window.clearTimeout(hoverTimerRef.current);
      }
      hoverTimerRef.current = window.setTimeout(() => {
        prefetchNow(slug);
      }, 150);
    },
    [prefetchNow],
  );

  const onPointerLeave = useCallback(() => {
    if (typeof window === 'undefined') return;
    if (hoverTimerRef.current) {
      window.clearTimeout(hoverTimerRef.current);
      hoverTimerRef.current = null;
    }
  }, []);

  const onPointerDown = useCallback(
    (slug: string) => {
      prefetchNow(slug);
    },
    [prefetchNow],
  );

  useEffect(() => {
    return () => {
      if (hoverTimerRef.current && typeof window !== 'undefined') {
        window.clearTimeout(hoverTimerRef.current);
      }
    };
  }, []);

  return {
    prefetchNow,
    onPointerEnter,
    onPointerLeave,
    onPointerDown,
  };
}

/**
 * Suggestions de recherche en direct avec anti-rebond de 250 ms (§3.4).
 * Ne lance la requête qu'à partir de 2 caractères.
 */
export function useSearchSuggest(rawQuery: string, debounceMs = 250) {
  const trimmed = rawQuery.trim();
  const [debouncedQuery, setDebouncedQuery] = useState(trimmed);

  useEffect(() => {
    if (trimmed.length < 2) {
      const immediateTimer = window.setTimeout(() => {
        setDebouncedQuery('');
      }, 0);
      return () => window.clearTimeout(immediateTimer);
    }

    const timer = window.setTimeout(() => {
      setDebouncedQuery(trimmed);
    }, debounceMs);

    return () => window.clearTimeout(timer);
  }, [trimmed, debounceMs]);

  const enabled = debouncedQuery.length >= 2;

  const query = useQuery({
    queryKey: qk.searchSuggest(debouncedQuery),
    enabled,
    staleTime: 60_000,
    queryFn: () =>
      api.get<SearchSuggestResponse>(endpoints.catalog.searchSuggest(debouncedQuery)),
  });

  return {
    ...query,
    debouncedQuery,
    isDebouncing: trimmed.length >= 2 && trimmed !== debouncedQuery,
  };
}

export function useLooks() {
  return useQuery({
    queryKey: qk.looks(),
    queryFn: () => api.get<LooksResponse>(endpoints.catalog.looks),
  });
}

export function useLook(id: string | undefined) {
  return useQuery({
    queryKey: qk.look(id ?? ''),
    enabled: Boolean(id),
    staleTime: FIVE_MINUTES_MS,
    queryFn: () =>
      api.get<LookDetailResponse>(endpoints.catalog.look(id ?? '')),
  });
}

export function usePublicSettings() {
  return useQuery({
    queryKey: qk.settings(),
    queryFn: () => api.get<PublicSettingsResponse>(endpoints.settings.public),
  });
}

/**
 * Récupère tous les produits du catalogue pour résoudre une liste d'identifiants (ex. Favoris §8).
 */
export function useFavoriteProducts(favoriteIds: string[]) {
  const query = useQuery({
    queryKey: qk.products({ pageSize: 50 }),
    queryFn: () =>
      api.get<ProductsResponse>(endpoints.catalog.products({ pageSize: 50 })),
    enabled: favoriteIds.length > 0,
  });

  const items: Product[] = query.data?.items
    ? favoriteIds
        .map((id) => query.data.items.find((p) => p.id === id))
        .filter((p): p is Product => Boolean(p))
    : [];

  return {
    ...query,
    items,
  };
}
