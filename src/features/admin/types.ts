import type {
  Address,
  Agency,
  Category,
  DeliveryCity,
  LookbookItem,
  PaymentSettings,
  Product,
  ProductColor,
  ProductImageEntry,
  ProductVariant,
  PublicSettings,
  ReceptionMode,
  Reservation,
  SizeGuideTable,
  SubCategory,
} from '@/types/domain';
import type { ReservationStatusCode } from '@/types/reservationStatus';

export type AdminRole = 'owner' | 'manager' | 'staff';

export const ADMIN_ROLE_LABELS: Record<AdminRole, string> = {
  owner: 'Propriétaire',
  manager: 'Gérant',
  staff: 'Équipe boutique',
};

export interface AdminUser {
  id: string;
  email: string;
  phone: string;
  name: string;
  role: AdminRole;
}

export interface AdminLoginPayload {
  identifier: string;
  password: string;
}

export interface AdminAuthResponse {
  accessToken: string;
  admin: AdminUser;
}

export type AdminDashboardPeriod = 'today' | '7d' | '30d';

export interface AdminReservationRow {
  ref: string;
  status: ReservationStatusCode;
  createdAt: string;
  updatedAt: string;
  expiresAt: string;
  total: number;
  itemsCount: number;
  firstItemSummary: string;
  receptionMode: ReceptionMode;
  city?: string;
  customer: {
    firstName: string;
    lastName?: string;
    phone: string;
  };
  operator?: 'orange' | 'mtn';
  proofThumbnailUrl?: string;
  hasProof: boolean;
  hasPackagePhotos: boolean;
}

export interface AdminLowStockItem {
  productId: string;
  slug: string;
  name: string;
  image: string;
  variantId: string;
  size: string;
  colorName: string;
  colorCode: string;
  colorHex: string;
  stock: number;
}

export interface AdminDashboardCounts {
  /** Réservations en attente de vérification de preuve Mobile Money (`pending_validation`). */
  pendingValidation: number;
  /** Réservations payées dont le colis est à préparer ou photographier (`confirmed` ou `preparing`). */
  toPrepare: number;
  /** Colis prêts en boutique ou remis à l’agence (`ready_for_pickup` ou `handed_to_agency`). */
  readyForHandover: number;
  /** Réservations non payées (`reserved` ou `payment_rejected`) qui expirent dans moins de 3 h. */
  expiringSoon: number;
  /** Total des réservations actives (non terminées). */
  activeTotal: number;
  /** Variantes dont le stock est faible (1 ou 2 unités). */
  lowStockVariants: number;
  /** Variantes en rupture complète (stock === 0). */
  outOfStockVariants: number;
}

export interface AdminPeriodKpis {
  /** Chiffre d’affaires confirmé en FCFA (hors annulées, expirées, non payées). */
  revenueConfirmed: number;
  /** Nombre total de réservations créées sur la période. */
  reservationsCreated: number;
  /** Nombre de réservations confirmées (payées) sur la période. */
  reservationsConfirmed: number;
  /** Taux de transformation confirmées / créées (0 à 100). */
  conversionRate: number;
  /** Panier moyen des réservations confirmées en FCFA. */
  averageBasket: number;
  /** Répartition des paiements confirmés par opérateur Mobile Money. */
  byOperator: {
    orange: number;
    mtn: number;
  };
  /** Répartition des réservations confirmées par mode de réception. */
  byReception: {
    delivery: number;
    pickup: number;
  };
}

export interface AdminDashboardData {
  serverTime: string;
  counts: AdminDashboardCounts;
  urgentReservations: AdminReservationRow[];
  kpis: Record<AdminDashboardPeriod, AdminPeriodKpis>;
  lowStockItems: AdminLowStockItem[];
}

export interface AdminSearchProductItem {
  id: string;
  slug: string;
  name: string;
  image: string;
  price: number;
  totalStock: number;
  outOfStockCount: number;
}

export interface AdminSearchResponse {
  reservations: AdminReservationRow[];
  products: AdminSearchProductItem[];
}

// ============================================================================
// Module A2 — Gestion des réservations, preuves Mobile Money et photos du colis
// ============================================================================

export type AdminReservationsTab =
  | 'all'
  | 'to_validate'
  | 'to_prepare'
  | 'ready'
  | 'in_delivery'
  | 'attention'
  | 'done';

export interface AdminReservationsListParams {
  tab?: AdminReservationsTab;
  status?: ReservationStatusCode;
  receptionMode?: ReceptionMode;
  city?: string;
  operator?: 'orange' | 'mtn';
  q?: string;
  page?: number;
  pageSize?: number;
}

export interface AdminReservationsTabCounts {
  all: number;
  toValidate: number;
  toPrepare: number;
  ready: number;
  inDelivery: number;
  attention: number;
  done: number;
}

export interface AdminReservationsListResponse {
  items: AdminReservationRow[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
  counts: AdminReservationsTabCounts;
}

export interface AdminInternalNote {
  id: string;
  author: string;
  text: string;
  createdAt: string;
}

export interface AdminReservationDetailResponse {
  reservation: Reservation & { serverTime: string };
  duplicateProofRefs: string[];
  internalNotes: AdminInternalNote[];
  availableAgencies: Agency[];
}

export interface AdminValidatePaymentPayload {
  note?: string;
}

export interface AdminRejectPaymentPayload {
  reason: string;
}

export interface AdminAdvanceStatusPayload {
  status: ReservationStatusCode;
  note?: string;
  agencyId?: string;
}

export interface AdminPackagePhotoInput {
  url: string;
  thumbnailUrl?: string;
  width: number;
  height: number;
}

export interface AdminPackageReadyPayload {
  photos: AdminPackagePhotoInput[];
  note?: string;
  agencyId?: string;
}

export interface AdminCancelReservationPayload {
  reason: string;
}

export interface AdminAddNotePayload {
  text: string;
}

// ============================================================================
// Module A3 — Catalogue, stocks, variantes, catégories et looks
// ============================================================================

export type AdminProductStockStatus =
  | 'all'
  | 'in_stock'
  | 'low_stock'
  | 'out_of_stock';

export type AdminProductSort =
  | 'newest'
  | 'name'
  | 'stock_asc'
  | 'price_asc'
  | 'price_desc';

export interface AdminProductsListParams {
  q?: string;
  category?: string;
  stockStatus?: AdminProductStockStatus;
  sort?: AdminProductSort;
  page?: number;
  pageSize?: number;
}

export interface AdminProductsSummary {
  totalProducts: number;
  inStockProducts: number;
  lowStockProducts: number;
  outOfStockProducts: number;
}

export interface AdminProductsListResponse {
  items: Product[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
  summary: AdminProductsSummary;
}

export interface AdminQuickStockPayload {
  variants: Array<{
    variantId: string;
    stock: number;
  }>;
}

export interface AdminUpsertProductPayload {
  name: string;
  slug: string;
  categorySlug: string;
  subCategorySlug?: string;
  price: number;
  isNew: boolean;
  description: string;
  composition: string;
  careInstructions: string[];
  colors: ProductColor[];
  sizes: string[];
  variants: ProductVariant[];
  mediaGallery: ProductImageEntry[];
  sizeGuide: SizeGuideTable;
}

export interface AdminUpdateCategoryPayload {
  name: string;
  description: string;
  coverImage: string;
  subCategories: SubCategory[];
}

export interface AdminUpsertLookPayload {
  title: string;
  subtitle: string;
  image: string;
  fallback?: string;
  productSlugs: string[];
}

export interface AdminCategoriesResponse {
  categories: Category[];
}

export interface AdminLooksResponse {
  looks: LookbookItem[];
}

// ============================================================================
// Module A4 — Paramètres, Livraison/Agences, Contenus et Clients
// ============================================================================

export interface AdminUpdateSettingsPayload {
  payment?: PaymentSettings;
  whatsappNumber?: string;
  reservationHoldHours?: number;
  deliveryFeePayment?: 'upfront' | 'on_delivery';
  shop?: PublicSettings['shop'];
  pickupAddress?: PublicSettings['pickupAddress'];
}

export interface AdminUpsertCityPayload {
  name: string;
  fee: number;
  isLocal: boolean;
  hasAgencies: boolean;
  estimatedDelay: string;
}

export interface AdminUpsertAgencyPayload {
  cityId: string;
  city?: string;
  name: string;
  address: string;
  phone: string;
  openingHours: string;
}

export interface AdminDeliveryCitiesResponse {
  cities: DeliveryCity[];
}

export interface AdminDeliveryAgenciesResponse {
  agencies: Agency[];
}

export interface AdminContentPageSummary {
  slug: string;
  title: string;
  kind: 'legal' | 'help' | 'faq';
  updatedAt: string;
  missingPlaceholdersCount: number;
  placeholders: string[];
}

export interface AdminPagesListResponse {
  pages: AdminContentPageSummary[];
  totalMissingPlaceholders: number;
}

export interface AdminContentPageDetail {
  slug: string;
  title: string;
  body: string;
  updatedAt: string;
  missingPlaceholdersCount: number;
  placeholders: string[];
}

export interface AdminUpdatePagePayload {
  title: string;
  body: string;
}

export interface AdminCustomerItem {
  id: string;
  phone: string;
  firstName: string;
  lastName: string;
  fullName: string;
  city: string;
  reservationsCount: number;
  confirmedTotalFcfa: number;
  lastActivityAt: string;
  addresses: Address[];
  reservations: AdminReservationRow[];
}

export interface AdminCustomersListResponse {
  items: AdminCustomerItem[];
  total: number;
}
