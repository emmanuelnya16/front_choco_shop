import type { ProductFilters } from '@/types/api';

export const qk = {
  categories: () => ['categories'] as const,
  looks: () => ['looks'] as const,
  look: (id: string) => ['look', id] as const,
  searchSuggest: (q: string) => ['searchSuggest', q] as const,
  products: (filters?: ProductFilters) => ['products', filters ?? {}] as const,
  productsInfinite: (filters?: Omit<ProductFilters, 'page'>) =>
    ['productsInfinite', filters ?? {}] as const,
  product: (slug: string) => ['product', slug] as const,
  settings: () => ['settings', 'public'] as const,
  me: () => ['me'] as const,
  addresses: () => ['me', 'addresses'] as const,
  reservations: () => ['reservations'] as const,
  pendingReservations: () => ['reservations', 'pending'] as const,
  reservation: (ref: string) => ['reservation', ref] as const,
  favorites: () => ['favorites'] as const,
  cities: () => ['delivery', 'cities'] as const,
  agencies: (city?: string) => ['delivery', 'agencies', city ?? 'all'] as const,
} as const;
