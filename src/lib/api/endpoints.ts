import type { ProductFilters } from '@/types/api';

// HYPOTHÈSE: Routes REST du back-end Symfony 6.4/7 préfixées par VITE_API_BASE_URL.
export const endpoints = {
  auth: {
    otpRequest: '/auth/otp/request',
    otpVerify: '/auth/otp/verify',
    refresh: '/auth/refresh',
    logout: '/auth/logout',
  },
  me: {
    profile: '/me',
    addresses: '/me/addresses',
    address: (id: string) => `/me/addresses/${encodeURIComponent(id)}`,
  },
  catalog: {
    categories: '/categories',
    looks: '/looks',
    look: (id: string) => `/looks/${encodeURIComponent(id)}`,
    searchSuggest: (q: string) => `/search/suggest?q=${encodeURIComponent(q)}`,
    products: (filters?: ProductFilters) => {
      if (!filters) {
        return '/products';
      }
      const params = new URLSearchParams();
      if (filters.category) params.set('category', filters.category);
      if (filters.sub) params.set('sub', filters.sub);
      if (filters.q) params.set('q', filters.q);
      if (filters.size) params.append('size', filters.size);
      if (filters.sizes && filters.sizes.length > 0) {
        for (const s of filters.sizes) {
          params.append('size', s);
        }
      }
      if (filters.price) params.set('price', filters.price);
      if (filters.minPrice !== undefined) params.set('minPrice', String(filters.minPrice));
      if (filters.maxPrice !== undefined) params.set('maxPrice', String(filters.maxPrice));
      if (filters.available !== undefined) {
        params.set('available', filters.available ? '1' : '0');
      }
      if (filters.look) params.set('look', filters.look);
      if (filters.sort) params.set('sort', filters.sort);
      if (filters.page !== undefined) params.set('page', String(filters.page));
      if (filters.pageSize !== undefined) params.set('pageSize', String(filters.pageSize));
      const query = params.toString();
      return query ? `/products?${query}` : '/products';
    },
    product: (slug: string) => `/products/${encodeURIComponent(slug)}`,
  },
  delivery: {
    cities: '/delivery/cities',
    agencies: (city?: string) =>
      city ? `/delivery/agencies?city=${encodeURIComponent(city)}` : '/delivery/agencies',
  },
  cart: {
    validate: '/cart/validate',
  },
  settings: {
    public: '/settings/public',
  },
  reservations: {
    list: '/reservations',
    // HYPOTHÈSE: liste paginée par onglet (10 par page) pour « Mes réservations » (§3.1 M5).
    listScoped: (scope: 'active' | 'done', page: number) =>
      `/reservations?scope=${scope}&page=${page}`,
    summary: '/reservations/summary',
    pending: '/reservations?status=reserved',
    create: '/reservations',
    detail: (ref: string) => `/reservations/${encodeURIComponent(ref)}`,
    proof: (ref: string) => `/reservations/${encodeURIComponent(ref)}/proof`,
    cancel: (ref: string) => `/reservations/${encodeURIComponent(ref)}/cancel`,
  },
  favorites: {
    list: '/favorites',
    remove: (productId: string) => `/favorites/${encodeURIComponent(productId)}`,
  },
  push: {
    subscribe: '/push/subscribe',
    unsubscribe: '/push/unsubscribe',
  },
  mock: {
    validateReservation: (ref: string) =>
      `/_mock/reservations/${encodeURIComponent(ref)}/validate`,
    rejectReservation: (ref: string) =>
      `/_mock/reservations/${encodeURIComponent(ref)}/reject`,
    expireSoonReservation: (ref: string) =>
      `/_mock/reservations/${encodeURIComponent(ref)}/expire-soon`,
    expireReservation: (ref: string) =>
      `/_mock/reservations/${encodeURIComponent(ref)}/expire`,
    // Simulateur boutique enrichi (§3.3 M5)
    advanceReservation: (ref: string) =>
      `/_mock/reservations/${encodeURIComponent(ref)}/advance`,
    packageReady: (ref: string) =>
      `/_mock/reservations/${encodeURIComponent(ref)}/package-ready`,
    completeReservation: (ref: string) =>
      `/_mock/reservations/${encodeURIComponent(ref)}/complete`,
    shopCancelReservation: (ref: string) =>
      `/_mock/reservations/${encodeURIComponent(ref)}/shop-cancel`,
    resetReservations: '/_mock/reservations/reset',
    // Remise à zéro complète (serveur de mocks Node, M6 §3.2)
    resetAll: '/_mock/reset',
    // Mode effectif des mocks (MSW navigateur ou serveur Node) pour /_dev (M6 §7.5)
    status: '/_mock/status',
  },
} as const;
