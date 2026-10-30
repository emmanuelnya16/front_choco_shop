import { useCallback, useMemo } from 'react';
import { useLocation, useNavigate, useParams, useSearchParams } from 'react-router';
import type { CatalogSortOption, PriceRangeKey, ProductFilters } from '@/types/api';
import type { CategorySlug } from '@/types/domain';

const VALID_CATEGORIES: readonly CategorySlug[] = [
  'vetements',
  'chaussures',
  'babouches',
];

const VALID_SUBCATEGORIES = new Set([
  't-shirts',
  'hoodies',
  'ensembles',
  'pantalons',
  'vestes',
  'sneakers',
  'derbies',
  'baskets',
  'ville',
  'cuir-lisse',
  'croco-embosse',
  'cuir',
  'brodees',
  'classiques',
]);

const VALID_SIZES = new Set([
  'S',
  'M',
  'L',
  'XL',
  'XXL',
  '39',
  '40',
  '41',
  '42',
  '43',
  '44',
  '45',
  '46',
  'Unique',
]);

const VALID_PRICE_RANGES: readonly PriceRangeKey[] = [
  '0-15000',
  '15000-30000',
  '30000-50000',
  '50000+',
];

const VALID_SORTS: readonly CatalogSortOption[] = [
  'popular',
  'newest',
  'price-asc',
  'price-desc',
  'price_asc',
  'price_desc',
];

export const PRICE_RANGE_LABELS: Record<PriceRangeKey, string> = {
  '0-15000': 'Moins de 15 000 FCFA',
  '15000-30000': '15 000 – 30 000 FCFA',
  '30000-50000': '30 000 – 50 000 FCFA',
  '50000+': 'Plus de 50 000 FCFA',
};

export const SORT_OPTION_LABELS: Record<CatalogSortOption, string> = {
  popular: 'Populaires',
  newest: 'Nouveautés',
  'price-asc': 'Prix croissant',
  'price-desc': 'Prix décroissant',
  price_asc: 'Prix croissant',
  price_desc: 'Prix décroissant',
};

export const SUBCATEGORY_LABELS: Record<string, string> = {
  't-shirts': 'T-shirts',
  hoodies: 'Hoodies & Ensembles',
  ensembles: 'Ensembles',
  pantalons: 'Pantalons',
  vestes: 'Vestes',
  sneakers: 'Baskets & Sneakers',
  derbies: 'Chaussures de ville',
  baskets: 'Baskets',
  ville: 'Chaussures de ville',
  'cuir-lisse': 'Cuir lisse',
  'croco-embosse': 'Croco embossé',
  cuir: 'Cuir lisse',
  brodees: 'Brodées',
  classiques: 'Classiques',
};

const CLOTHING_SIZES = ['S', 'M', 'L', 'XL', 'XXL'];
const SHOE_SIZES = ['39', '40', '41', '42', '43', '44', '45'];

export function getSizesForCategory(category?: CategorySlug): {
  clothing: string[];
  shoes: string[];
} {
  if (category === 'vetements') {
    return { clothing: CLOTHING_SIZES, shoes: [] };
  }
  if (category === 'chaussures' || category === 'babouches') {
    return { clothing: [], shoes: SHOE_SIZES };
  }
  return { clothing: CLOTHING_SIZES, shoes: SHOE_SIZES };
}

export interface CatalogFiltersState {
  category?: CategorySlug;
  sub?: string;
  sizes: string[];
  price?: PriceRangeKey;
  available: boolean;
  sort: CatalogSortOption;
  look?: string;
  q?: string;
}

export interface UseCatalogFiltersReturn {
  filters: CatalogFiltersState;
  apiFilters: ProductFilters;
  activeCount: number;
  setFilter: <K extends keyof Omit<CatalogFiltersState, 'category' | 'sizes'>>(
    key: K,
    value: CatalogFiltersState[K] | undefined,
  ) => void;
  setFilters: (
    patch: Partial<Omit<CatalogFiltersState, 'category'>>,
  ) => void;
  toggleSize: (size: string) => void;
  setSizes: (sizes: string[]) => void;
  setCategory: (category?: CategorySlug) => void;
  reset: () => void;
}

function parseCategory(raw?: string): CategorySlug | undefined {
  if (!raw) return undefined;
  return VALID_CATEGORIES.includes(raw as CategorySlug)
    ? (raw as CategorySlug)
    : undefined;
}

function parsePrice(raw: string | null): PriceRangeKey | undefined {
  if (!raw) return undefined;
  return VALID_PRICE_RANGES.includes(raw as PriceRangeKey)
    ? (raw as PriceRangeKey)
    : undefined;
}

function parseSort(raw: string | null): CatalogSortOption {
  if (!raw) return 'popular';
  if (raw === 'price_asc') return 'price-asc';
  if (raw === 'price_desc') return 'price-desc';
  return VALID_SORTS.includes(raw as CatalogSortOption)
    ? (raw as CatalogSortOption)
    : 'popular';
}

function buildSearchParams(state: Omit<CatalogFiltersState, 'category'>): URLSearchParams {
  const next = new URLSearchParams();

  if (state.sub && VALID_SUBCATEGORIES.has(state.sub)) {
    next.set('sub', state.sub);
  }

  for (const size of state.sizes) {
    if (VALID_SIZES.has(size)) {
      next.append('size', size);
    }
  }

  if (state.price && VALID_PRICE_RANGES.includes(state.price)) {
    next.set('price', state.price);
  }

  if (state.available) {
    next.set('available', '1');
  }

  if (state.sort && state.sort !== 'popular' && VALID_SORTS.includes(state.sort)) {
    next.set('sort', state.sort);
  }

  if (state.look && state.look.trim()) {
    next.set('look', state.look.trim());
  }

  if (state.q && state.q.trim()) {
    next.set('q', state.q.trim());
  }

  return next;
}

/**
 * Source de vérité unique des filtres catalogue dans l'URL (§3.1).
 * Chaque modification utilise `{ replace: true }` pour ne pas polluer l'historique.
 */
export function useCatalogFilters(): UseCatalogFiltersReturn {
  const params = useParams<{ category?: string }>();
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const location = useLocation();

  const filters = useMemo<CatalogFiltersState>(() => {
    const category = parseCategory(params.category);
    const rawSub = searchParams.get('sub');
    const sub = rawSub && VALID_SUBCATEGORIES.has(rawSub) ? rawSub : undefined;

    const rawSizes = searchParams.getAll('size');
    const sizes = Array.from(
      new Set(rawSizes.filter((s) => VALID_SIZES.has(s))),
    );

    const price = parsePrice(searchParams.get('price'));
    const available = searchParams.get('available') === '1';
    const sort = parseSort(searchParams.get('sort'));

    const rawLook = searchParams.get('look')?.trim();
    const look = rawLook ? rawLook : undefined;

    const rawQ = searchParams.get('q')?.trim();
    const q = rawQ ? rawQ : undefined;

    return {
      category,
      sub,
      sizes,
      price,
      available,
      sort,
      look,
      q,
    };
  }, [params.category, searchParams]);

  const activeCount = useMemo(() => {
    let count = 0;
    if (filters.sub) count += 1;
    count += filters.sizes.length;
    if (filters.price) count += 1;
    if (filters.available) count += 1;
    if (filters.look) count += 1;
    if (filters.q) count += 1;
    return count;
  }, [filters]);

  const apiFilters = useMemo<ProductFilters>(
    () => ({
      category: filters.category,
      sub: filters.sub,
      sizes: filters.sizes.length > 0 ? filters.sizes : undefined,
      price: filters.price,
      available: filters.available ? true : undefined,
      sort: filters.sort,
      look: filters.look,
      q: filters.q,
    }),
    [filters],
  );

  const setFilter = useCallback<UseCatalogFiltersReturn['setFilter']>(
    (key, value) => {
      const nextState: Omit<CatalogFiltersState, 'category'> = {
        sub: filters.sub,
        sizes: filters.sizes,
        price: filters.price,
        available: filters.available,
        sort: filters.sort,
        look: filters.look,
        q: filters.q,
        [key]: value,
      };
      setSearchParams(buildSearchParams(nextState), { replace: true });
    },
    [filters, setSearchParams],
  );

  const setFilters = useCallback<UseCatalogFiltersReturn['setFilters']>(
    (patch) => {
      const nextState: Omit<CatalogFiltersState, 'category'> = {
        sub: filters.sub,
        sizes: filters.sizes,
        price: filters.price,
        available: filters.available,
        sort: filters.sort,
        look: filters.look,
        q: filters.q,
        ...patch,
      };
      setSearchParams(buildSearchParams(nextState), { replace: true });
    },
    [filters, setSearchParams],
  );

  const toggleSize = useCallback(
    (size: string) => {
      if (!VALID_SIZES.has(size)) return;
      const exists = filters.sizes.includes(size);
      const nextSizes = exists
        ? filters.sizes.filter((s) => s !== size)
        : [...filters.sizes, size];

      const nextState: Omit<CatalogFiltersState, 'category'> = {
        sub: filters.sub,
        sizes: nextSizes,
        price: filters.price,
        available: filters.available,
        sort: filters.sort,
        look: filters.look,
        q: filters.q,
      };
      setSearchParams(buildSearchParams(nextState), { replace: true });
    },
    [filters, setSearchParams],
  );

  const setSizes = useCallback(
    (sizes: string[]) => {
      const valid = Array.from(new Set(sizes.filter((s) => VALID_SIZES.has(s))));
      const nextState: Omit<CatalogFiltersState, 'category'> = {
        sub: filters.sub,
        sizes: valid,
        price: filters.price,
        available: filters.available,
        sort: filters.sort,
        look: filters.look,
        q: filters.q,
      };
      setSearchParams(buildSearchParams(nextState), { replace: true });
    },
    [filters, setSearchParams],
  );

  const setCategory = useCallback(
    (nextCategory?: CategorySlug) => {
      const basePath = nextCategory ? `/explorer/${nextCategory}` : '/explorer';
      const nextParams = buildSearchParams({
        sub: undefined,
        sizes: filters.sizes,
        price: filters.price,
        available: filters.available,
        sort: filters.sort,
        look: filters.look,
        q: filters.q,
      });
      const searchStr = nextParams.toString();
      const target = searchStr ? `${basePath}?${searchStr}` : basePath;
      if (`${location.pathname}${location.search}` !== target) {
        navigate(target, { replace: true, viewTransition: true });
      }
    },
    [filters, location.pathname, location.search, navigate],
  );

  const reset = useCallback(() => {
    const nextParams = buildSearchParams({
      sub: undefined,
      sizes: [],
      price: undefined,
      available: false,
      sort: filters.sort,
      look: undefined,
      q: undefined,
    });
    setSearchParams(nextParams, { replace: true });
  }, [filters.sort, setSearchParams]);

  return {
    filters,
    apiFilters,
    activeCount,
    setFilter,
    setFilters,
    toggleSize,
    setSizes,
    setCategory,
    reset,
  };
}
