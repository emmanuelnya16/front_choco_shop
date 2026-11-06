import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { adminApi } from '@/features/admin/api/adminClient';
import { useAdminAuthStore } from '@/features/admin/auth/adminAuthStore';
import type {
  AdminAddNotePayload,
  AdminAdvanceStatusPayload,
  AdminAuthResponse,
  AdminCancelReservationPayload,
  AdminCategoriesResponse,
  AdminDashboardData,
  AdminInternalNote,
  AdminLoginPayload,
  AdminLooksResponse,
  AdminPackageReadyPayload,
  AdminProductsListParams,
  AdminProductsListResponse,
  AdminQuickStockPayload,
  AdminRejectPaymentPayload,
  AdminReservationDetailResponse,
  AdminReservationsListParams,
  AdminReservationsListResponse,
  AdminSearchResponse,
  AdminUpdateCategoryPayload,
  AdminUpdatePagePayload,
  AdminUpdateSettingsPayload,
  AdminUpsertAgencyPayload,
  AdminUpsertCityPayload,
  AdminUpsertLookPayload,
  AdminUpsertProductPayload,
  AdminValidatePaymentPayload,
  AdminContentPageDetail,
  AdminCustomersListResponse,
  AdminDeliveryAgenciesResponse,
  AdminDeliveryCitiesResponse,
  AdminPagesListResponse,
} from '@/features/admin/types';
import {
  pushTypeForStatus,
  triggerAdminClientNotification,
} from '@/features/admin/utils/adminNotifications';
import type {
  Agency,
  Category,
  DeliveryCity,
  LookbookItem,
  Product,
  PublicSettings,
  Reservation,
} from '@/types/domain';

export const adminQueryKeys = {
  all: ['admin'] as const,
  dashboard: () => ['admin', 'dashboard'] as const,
  search: (q: string) => ['admin', 'search', q.trim().toLowerCase()] as const,
  reservations: (params: AdminReservationsListParams) =>
    ['admin', 'reservations', params] as const,
  reservationDetail: (ref: string) =>
    ['admin', 'reservation', ref.toUpperCase()] as const,
  products: (params: AdminProductsListParams) =>
    ['admin', 'products', params] as const,
  productDetail: (id: string) => ['admin', 'product', id] as const,
  categories: () => ['admin', 'categories'] as const,
  looks: () => ['admin', 'looks'] as const,
  settings: () => ['admin', 'settings'] as const,
  cities: () => ['admin', 'delivery', 'cities'] as const,
  agencies: () => ['admin', 'delivery', 'agencies'] as const,
  pages: () => ['admin', 'pages'] as const,
  pageDetail: (slug: string) => ['admin', 'page', slug] as const,
  customers: (q: string) => ['admin', 'customers', q.trim().toLowerCase()] as const,
};

export function useAdminDashboard(options?: { enabled?: boolean }) {
  const status = useAdminAuthStore((s) => s.status);
  const enabled = (options?.enabled ?? true) && status === 'authenticated';

  return useQuery({
    queryKey: adminQueryKeys.dashboard(),
    queryFn: () => adminApi.get<AdminDashboardData>('/admin/dashboard'),
    enabled,
    staleTime: 15_000,
    refetchInterval: 30_000,
  });
}

export function useAdminSearch(query: string) {
  const trimmed = query.trim();
  const status = useAdminAuthStore((s) => s.status);

  return useQuery({
    queryKey: adminQueryKeys.search(trimmed),
    queryFn: () =>
      adminApi.get<AdminSearchResponse>('/admin/search', {
        params: { q: trimmed },
      }),
    enabled: status === 'authenticated' && trimmed.length >= 2,
    staleTime: 10_000,
  });
}

export function useAdminLogin() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload: AdminLoginPayload) =>
      adminApi.post<AdminAuthResponse>('/admin/auth/login', payload, {
        skipAuthRefresh: true,
      }),
    onSuccess: (data) => {
      useAdminAuthStore.getState().setAdminSession(data.accessToken, data.admin);
      void queryClient.invalidateQueries({ queryKey: adminQueryKeys.all });
    },
  });
}

export function useAdminLogout() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async () => {
      try {
        await adminApi.post<void>('/admin/auth/logout', undefined, {
          skipAuthRefresh: true,
        });
      } catch {
        // Même hors ligne ou si le serveur échoue, la déconnexion locale s'applique
      }
    },
    onSettled: () => {
      useAdminAuthStore.getState().clearAdminSession();
      queryClient.removeQueries({ queryKey: adminQueryKeys.all });
    },
  });
}

// ============================================================================
// Module A2 — Hooks Réservations, Preuves & Colis
// ============================================================================

export function useAdminReservationsList(params: AdminReservationsListParams) {
  const status = useAdminAuthStore((s) => s.status);

  return useQuery({
    queryKey: adminQueryKeys.reservations(params),
    queryFn: () =>
      adminApi.get<AdminReservationsListResponse>('/admin/reservations', {
        params: {
          tab: params.tab,
          status: params.status,
          receptionMode: params.receptionMode,
          city: params.city,
          operator: params.operator,
          q: params.q,
          page: params.page,
          pageSize: params.pageSize,
        },
      }),
    enabled: status === 'authenticated',
    staleTime: 10_000,
    refetchInterval: 25_000,
  });
}

export function useAdminReservationDetail(ref: string) {
  const status = useAdminAuthStore((s) => s.status);
  const normalizedRef = ref.trim().toUpperCase();

  return useQuery({
    queryKey: adminQueryKeys.reservationDetail(normalizedRef),
    queryFn: () =>
      adminApi.get<AdminReservationDetailResponse>(
        `/admin/reservations/${encodeURIComponent(normalizedRef)}`,
      ),
    enabled: status === 'authenticated' && normalizedRef.length > 0,
    staleTime: 10_000,
  });
}

function invalidateAfterReservationMutation(
  queryClient: ReturnType<typeof useQueryClient>,
) {
  void queryClient.invalidateQueries({ queryKey: adminQueryKeys.all });
  void queryClient.invalidateQueries({ queryKey: ['reservations'] });
  void queryClient.invalidateQueries({ queryKey: ['products'] });
}

export function useAdminValidatePayment(ref: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload?: AdminValidatePaymentPayload) =>
      adminApi.post<{ reservation: Reservation & { serverTime: string } }>(
        `/admin/reservations/${encodeURIComponent(ref)}/validate-payment`,
        payload ?? {},
      ),
    onSuccess: (data) => {
      invalidateAfterReservationMutation(queryClient);
      void triggerAdminClientNotification('payment_validated', data.reservation.ref);
    },
  });
}

export function useAdminRejectPayment(ref: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload: AdminRejectPaymentPayload) =>
      adminApi.post<{ reservation: Reservation & { serverTime: string } }>(
        `/admin/reservations/${encodeURIComponent(ref)}/reject-payment`,
        payload,
      ),
    onSuccess: (data, variables) => {
      invalidateAfterReservationMutation(queryClient);
      void triggerAdminClientNotification('payment_rejected', data.reservation.ref, {
        body: `${data.reservation.ref} : ${variables.reason.trim()}. Renvoyez votre preuve de paiement.`,
      });
    },
  });
}

export function useAdminAdvanceStatus(ref: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload: AdminAdvanceStatusPayload) =>
      adminApi.post<{ reservation: Reservation & { serverTime: string } }>(
        `/admin/reservations/${encodeURIComponent(ref)}/status`,
        payload,
      ),
    onSuccess: (data) => {
      invalidateAfterReservationMutation(queryClient);
      const pushType = pushTypeForStatus(data.reservation.status);
      if (pushType) {
        void triggerAdminClientNotification(pushType, data.reservation.ref);
      }
    },
  });
}

export function useAdminPackageReady(ref: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload: AdminPackageReadyPayload) =>
      adminApi.post<{ reservation: Reservation & { serverTime: string } }>(
        `/admin/reservations/${encodeURIComponent(ref)}/package-ready`,
        payload,
      ),
    onSuccess: (data) => {
      invalidateAfterReservationMutation(queryClient);
      const firstPhotoUrl = data.reservation.packagePhotos?.[0]?.url;
      void triggerAdminClientNotification('package_ready', data.reservation.ref, {
        ...(firstPhotoUrl ? { image: firstPhotoUrl } : {}),
      });
    },
  });
}

export function useAdminCancelReservation(ref: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload: AdminCancelReservationPayload) =>
      adminApi.post<{ reservation: Reservation & { serverTime: string } }>(
        `/admin/reservations/${encodeURIComponent(ref)}/cancel`,
        payload,
      ),
    onSuccess: () => {
      invalidateAfterReservationMutation(queryClient);
    },
  });
}

export function useAdminAddNote(ref: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload: AdminAddNotePayload) =>
      adminApi.post<{ note: AdminInternalNote; internalNotes: AdminInternalNote[] }>(
        `/admin/reservations/${encodeURIComponent(ref)}/notes`,
        payload,
      ),
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: adminQueryKeys.reservationDetail(ref),
      });
    },
  });
}

// ============================================================================
// Module A3 — Hooks Catalogue, Stocks, Catégories & Looks
// ============================================================================

function invalidateAfterCatalogMutation(
  queryClient: ReturnType<typeof useQueryClient>,
) {
  void queryClient.invalidateQueries({ queryKey: adminQueryKeys.all });
  void queryClient.invalidateQueries({ queryKey: ['products'] });
  void queryClient.invalidateQueries({ queryKey: ['product'] });
  void queryClient.invalidateQueries({ queryKey: ['categories'] });
  void queryClient.invalidateQueries({ queryKey: ['looks'] });
}

export function useAdminProductsList(params: AdminProductsListParams) {
  const status = useAdminAuthStore((s) => s.status);

  return useQuery({
    queryKey: adminQueryKeys.products(params),
    queryFn: () =>
      adminApi.get<AdminProductsListResponse>('/admin/products', {
        params: {
          q: params.q,
          category: params.category,
          stockStatus: params.stockStatus,
          sort: params.sort,
          page: params.page,
          pageSize: params.pageSize,
        },
      }),
    enabled: status === 'authenticated',
    staleTime: 10_000,
  });
}

export function useAdminProductDetail(idOrSlug: string | undefined) {
  const status = useAdminAuthStore((s) => s.status);
  const cleanId = (idOrSlug ?? '').trim();

  return useQuery({
    queryKey: adminQueryKeys.productDetail(cleanId),
    queryFn: () =>
      adminApi.get<{ product: Product }>(
        `/admin/products/${encodeURIComponent(cleanId)}`,
      ),
    enabled: status === 'authenticated' && cleanId.length > 0 && cleanId !== 'nouveau',
    staleTime: 10_000,
  });
}

export function useAdminCreateProduct() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload: AdminUpsertProductPayload) =>
      adminApi.post<{ product: Product }>('/admin/products', payload),
    onSuccess: () => {
      invalidateAfterCatalogMutation(queryClient);
    },
  });
}

export function useAdminUpdateProduct(id: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload: Partial<AdminUpsertProductPayload>) =>
      adminApi.patch<{ product: Product }>(
        `/admin/products/${encodeURIComponent(id)}`,
        payload,
      ),
    onSuccess: () => {
      invalidateAfterCatalogMutation(queryClient);
    },
  });
}

export function useAdminQuickStockUpdate() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      productId,
      variants,
    }: {
      productId: string;
      variants: AdminQuickStockPayload['variants'];
    }) =>
      adminApi.patch<{ product: Product }>(
        `/admin/products/${encodeURIComponent(productId)}/stock`,
        { variants },
      ),
    onSuccess: () => {
      invalidateAfterCatalogMutation(queryClient);
    },
  });
}

export function useAdminDeleteProduct() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (productId: string) =>
      adminApi.delete<void>(`/admin/products/${encodeURIComponent(productId)}`),
    onSuccess: () => {
      invalidateAfterCatalogMutation(queryClient);
    },
  });
}

export function useAdminCategories() {
  const status = useAdminAuthStore((s) => s.status);

  return useQuery({
    queryKey: adminQueryKeys.categories(),
    queryFn: () => adminApi.get<AdminCategoriesResponse>('/admin/categories'),
    enabled: status === 'authenticated',
    staleTime: 15_000,
  });
}

export function useAdminUpdateCategory() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      id,
      payload,
    }: {
      id: string;
      payload: Partial<AdminUpdateCategoryPayload>;
    }) =>
      adminApi.patch<{ category: Category; categories: Category[] }>(
        `/admin/categories/${encodeURIComponent(id)}`,
        payload,
      ),
    onSuccess: () => {
      invalidateAfterCatalogMutation(queryClient);
    },
  });
}

export function useAdminLooks() {
  const status = useAdminAuthStore((s) => s.status);

  return useQuery({
    queryKey: adminQueryKeys.looks(),
    queryFn: () => adminApi.get<AdminLooksResponse>('/admin/looks'),
    enabled: status === 'authenticated',
    staleTime: 15_000,
  });
}

export function useAdminCreateLook() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload: AdminUpsertLookPayload) =>
      adminApi.post<{ look: LookbookItem; looks: LookbookItem[] }>(
        '/admin/looks',
        payload,
      ),
    onSuccess: () => {
      invalidateAfterCatalogMutation(queryClient);
    },
  });
}

export function useAdminUpdateLook() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      id,
      payload,
    }: {
      id: string;
      payload: Partial<AdminUpsertLookPayload>;
    }) =>
      adminApi.patch<{ look: LookbookItem; looks: LookbookItem[] }>(
        `/admin/looks/${encodeURIComponent(id)}`,
        payload,
      ),
    onSuccess: () => {
      invalidateAfterCatalogMutation(queryClient);
    },
  });
}

export function useAdminDeleteLook() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) =>
      adminApi.delete<void>(`/admin/looks/${encodeURIComponent(id)}`),
    onSuccess: () => {
      invalidateAfterCatalogMutation(queryClient);
    },
  });
}

// ============================================================================
// Module A4 — Hooks Paramètres, Livraison/Agences, Contenus et Clients
// ============================================================================

function invalidateAfterSettingsMutation(
  queryClient: ReturnType<typeof useQueryClient>,
) {
  void queryClient.invalidateQueries({ queryKey: adminQueryKeys.all });
  void queryClient.invalidateQueries({ queryKey: ['settings'] });
  void queryClient.invalidateQueries({ queryKey: ['delivery'] });
  void queryClient.invalidateQueries({ queryKey: ['cities'] });
  void queryClient.invalidateQueries({ queryKey: ['agencies'] });
}

export function useAdminSettings() {
  const status = useAdminAuthStore((s) => s.status);

  return useQuery({
    queryKey: adminQueryKeys.settings(),
    queryFn: () => adminApi.get<{ settings: PublicSettings }>('/admin/settings'),
    enabled: status === 'authenticated',
    staleTime: 10_000,
  });
}

export function useAdminUpdateSettings() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload: AdminUpdateSettingsPayload) =>
      adminApi.patch<{ settings: PublicSettings }>('/admin/settings', payload),
    onSuccess: () => {
      invalidateAfterSettingsMutation(queryClient);
    },
  });
}

export function useAdminDeliveryCities() {
  const status = useAdminAuthStore((s) => s.status);

  return useQuery({
    queryKey: adminQueryKeys.cities(),
    queryFn: () =>
      adminApi.get<AdminDeliveryCitiesResponse>('/admin/delivery/cities'),
    enabled: status === 'authenticated',
    staleTime: 10_000,
  });
}

export function useAdminCreateCity() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload: AdminUpsertCityPayload) =>
      adminApi.post<{ city: DeliveryCity; cities: DeliveryCity[] }>(
        '/admin/delivery/cities',
        payload,
      ),
    onSuccess: () => {
      invalidateAfterSettingsMutation(queryClient);
    },
  });
}

export function useAdminUpdateCity() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      id,
      payload,
    }: {
      id: string;
      payload: Partial<AdminUpsertCityPayload>;
    }) =>
      adminApi.patch<{ city: DeliveryCity; cities: DeliveryCity[] }>(
        `/admin/delivery/cities/${encodeURIComponent(id)}`,
        payload,
      ),
    onSuccess: () => {
      invalidateAfterSettingsMutation(queryClient);
    },
  });
}

export function useAdminDeleteCity() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) =>
      adminApi.delete<void>(`/admin/delivery/cities/${encodeURIComponent(id)}`),
    onSuccess: () => {
      invalidateAfterSettingsMutation(queryClient);
    },
  });
}

export function useAdminDeliveryAgencies() {
  const status = useAdminAuthStore((s) => s.status);

  return useQuery({
    queryKey: adminQueryKeys.agencies(),
    queryFn: () =>
      adminApi.get<AdminDeliveryAgenciesResponse>('/admin/delivery/agencies'),
    enabled: status === 'authenticated',
    staleTime: 10_000,
  });
}

export function useAdminCreateAgency() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload: AdminUpsertAgencyPayload) =>
      adminApi.post<{ agency: Agency; agencies: Agency[] }>(
        '/admin/delivery/agencies',
        payload,
      ),
    onSuccess: () => {
      invalidateAfterSettingsMutation(queryClient);
    },
  });
}

export function useAdminUpdateAgency() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      id,
      payload,
    }: {
      id: string;
      payload: Partial<AdminUpsertAgencyPayload>;
    }) =>
      adminApi.patch<{ agency: Agency; agencies: Agency[] }>(
        `/admin/delivery/agencies/${encodeURIComponent(id)}`,
        payload,
      ),
    onSuccess: () => {
      invalidateAfterSettingsMutation(queryClient);
    },
  });
}

export function useAdminDeleteAgency() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) =>
      adminApi.delete<void>(`/admin/delivery/agencies/${encodeURIComponent(id)}`),
    onSuccess: () => {
      invalidateAfterSettingsMutation(queryClient);
    },
  });
}

export function useAdminPagesList() {
  const status = useAdminAuthStore((s) => s.status);

  return useQuery({
    queryKey: adminQueryKeys.pages(),
    queryFn: () => adminApi.get<AdminPagesListResponse>('/admin/pages'),
    enabled: status === 'authenticated',
    staleTime: 10_000,
  });
}

export function useAdminPageDetail(slug: string | null | undefined) {
  const status = useAdminAuthStore((s) => s.status);
  const cleanSlug = (slug ?? '').trim();

  return useQuery({
    queryKey: adminQueryKeys.pageDetail(cleanSlug),
    queryFn: () =>
      adminApi.get<AdminContentPageDetail>(
        `/admin/pages/${encodeURIComponent(cleanSlug)}`,
      ),
    enabled: status === 'authenticated' && cleanSlug.length > 0,
    staleTime: 10_000,
  });
}

export function useAdminUpdatePage() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      slug,
      payload,
    }: {
      slug: string;
      payload: AdminUpdatePagePayload;
    }) =>
      adminApi.patch<AdminContentPageDetail>(
        `/admin/pages/${encodeURIComponent(slug)}`,
        payload,
      ),
    onSuccess: (data) => {
      void queryClient.invalidateQueries({ queryKey: adminQueryKeys.pages() });
      void queryClient.invalidateQueries({
        queryKey: adminQueryKeys.pageDetail(data.slug),
      });
      void queryClient.invalidateQueries({ queryKey: ['content-page'] });
      void queryClient.invalidateQueries({ queryKey: ['pages'] });
    },
  });
}

export function useAdminCustomersList(q = '') {
  const status = useAdminAuthStore((s) => s.status);

  return useQuery({
    queryKey: adminQueryKeys.customers(q),
    queryFn: () =>
      adminApi.get<AdminCustomersListResponse>('/admin/customers', {
        params: { q: q.trim() || undefined },
      }),
    enabled: status === 'authenticated',
    staleTime: 10_000,
  });
}
