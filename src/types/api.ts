import type {
  Address,
  Agency,
  Category,
  DeliveryCity,
  LookbookItem,
  Paginated,
  Product,
  PublicSettings,
  ReceptionMode,
  Reservation,
  User,
} from './domain';
import type { ReservationStatusCode } from './reservationStatus';

// HYPOTHÈSE: Formes des requêtes et réponses de l'API REST Symfony 6.4/7 à faire valider par l'équipe back-end.

export type CatalogSortOption =
  | 'popular'
  | 'newest'
  | 'price-asc'
  | 'price-desc'
  | 'price_asc'
  | 'price_desc';

export type PriceRangeKey = '0-15000' | '15000-30000' | '30000-50000' | '50000+';

export interface ProductFilters {
  category?: string;
  sub?: string;
  size?: string;
  sizes?: string[];
  price?: PriceRangeKey;
  minPrice?: number;
  maxPrice?: number;
  available?: boolean;
  sort?: CatalogSortOption;
  look?: string;
  q?: string;
  page?: number;
  pageSize?: number;
}

export interface ProductFacetSize {
  value: string;
  count: number;
}

export interface ProductFacetPriceRange {
  value: PriceRangeKey;
  label: string;
  count: number;
}

export interface ProductFacetSubCategory {
  slug: string;
  name: string;
  count: number;
}

export interface ProductFacets {
  sizes: ProductFacetSize[];
  priceRanges: ProductFacetPriceRange[];
  subCategories: ProductFacetSubCategory[];
}

export type CartValidationStatus = 'ok' | 'reduced' | 'unavailable' | 'price_changed';

export interface CartValidationItemPayload {
  variantId: string;
  quantity: number;
}

export interface CartValidatePayload {
  items: CartValidationItemPayload[];
}

export interface CartValidationItemResult {
  variantId: string;
  status: CartValidationStatus;
  availableQuantity: number;
  unitPrice: number;
  previousPrice?: number;
}

export interface CartValidationResult {
  items: CartValidationItemResult[];
  checkedAt: string;
}

export interface OtpRequestPayload {
  phone: string;
}

export interface OtpRequestResult {
  message?: string;
  expiresIn: number;
  resendIn: number;
  expiresInSeconds: number;
}

export type OtpRequestResponse = OtpRequestResult;

export interface OtpVerifyPayload {
  phone: string;
  code: string;
}

export interface AuthSession {
  accessToken: string;
  user: User;
  isNewUser?: boolean;
}

export type OtpVerifyResponse = AuthSession;

export interface RefreshTokenResponse {
  accessToken: string;
  user?: User;
}

export interface UpdateProfilePayload {
  firstName?: string;
  lastName?: string;
  city?: string;
}

export interface SaveAddressPayload {
  id?: string;
  label: string;
  city: string;
  district: string;
  landmark: string;
  receptionMode: ReceptionMode;
  /** `null` efface l'agence (adresse passée d'une agence à une livraison locale). */
  agencyId?: string | null;
  recipientName?: string;
  recipientPhone?: string;
  isDefault?: boolean;
}

export interface ReservationDraft {
  firstName: string;
  lastName: string;
  receptionMode: ReceptionMode;
  selectedAddressId?: string | null;
  city: string;
  district: string;
  landmark: string;
  agencyId: string;
  recipientType: 'self' | 'other';
  recipientName: string;
  recipientPhone: string;
  notes: string;
  saveAddress: boolean;
  addressLabel: 'Maison' | 'Bureau' | 'Autre';
}

export interface CreateReservationPayload {
  receptionMode: ReceptionMode;
  items: Array<{
    productId: string;
    variantId: string;
    quantity: number;
  }>;
  firstName?: string;
  lastName?: string;
  phone?: string;
  city?: string;
  district?: string;
  landmark?: string;
  agencyId?: string;
  recipientType?: 'self' | 'other';
  recipientName?: string;
  recipientPhone?: string;
  notes?: string;
  deliveryAddressId?: string;
}

export type ReservationCreated = Reservation & {
  serverTime: string;
  amount: {
    subtotal: number;
    deliveryFee: number;
    total: number;
  };
};

export interface UploadProofResponse {
  status: 'pending_validation';
  proof: {
    thumbnailUrl: string;
    uploadedAt: string;
    sha256?: string;
    operator?: 'orange' | 'mtn';
    payerPhone?: string;
    transactionId?: string;
  };
  reservation?: Reservation;
}

export interface CancelReservationPayload {
  reason?: string;
}

export interface CancelReservationResponse {
  status: 'cancelled';
  reservation: Reservation;
}

/** Onglets de « Mes réservations » : `active` = statuts non finaux, `done` = livrée, retirée, expirée, annulée. */
export type ReservationScope = 'active' | 'done';

/**
 * Élément léger de la liste paginée `GET /reservations?scope=&page=` (§3.1 M5).
 * HYPOTHÈSE: contrat à faire valider par le back-end.
 */
export interface ReservationListItem {
  ref: string;
  status: ReservationStatusCode;
  createdAt: string;
  updatedAt: string;
  expiresAt?: string;
  serverTime?: string;
  amount: { total: number };
  itemsCount: number;
  itemsPreview: Array<{ image: string; name: string }>;
  packagePhotoThumb?: string | null;
  receptionMode: ReceptionMode;
  city?: string;
  /**
   * HYPOTHÈSE: pour une réservation expirée ou annulée, dernier statut du parcours atteint avant l'arrêt
   * (barre d'avancement rouge « au point atteint », §4.2 M5).
   */
  reachedStatus?: ReservationStatusCode;
}

/**
 * HYPOTHÈSE: chaque page renvoie aussi le nombre total de réservations par onglet,
 * pour afficher « En cours (8) · Terminées (11) » sans charger les deux listes.
 */
export type ReservationsListPage = Paginated<ReservationListItem> & {
  counts: Record<ReservationScope, number>;
};

/** Entrée légère du résumé : permet de calculer le repère de l'onglet sans charger chaque détail. */
export interface ReservationSummaryEntry {
  ref: string;
  status: ReservationStatusCode;
  updatedAt: string;
  hasPackagePhotos: boolean;
}

/**
 * Résumé `GET /reservations/summary` (§3.1 M5).
 * HYPOTHÈSE: `items` (réservations en cours) est un ajout au contrat `{ needsAction, lastUpdatedAt }`.
 */
export interface ReservationsSummary {
  needsAction: number;
  lastUpdatedAt: string | null;
  items: ReservationSummaryEntry[];
}

export type UpdateAddressPayload = Partial<Omit<SaveAddressPayload, 'id'>>;

export interface ApiErrorPayload {
  code?: string;
  message?: string;
  details?: Record<string, unknown>;
}

export interface SearchSuggestProductItem {
  id: string;
  slug: string;
  name: string;
  price: number;
  image: string;
  fallbackImage: string;
  categorySlug: string;
  totalStock?: number;
}

export interface SearchSuggestCategoryItem {
  slug: string;
  name: string;
  parentSlug?: string;
  productCount: number;
}

export interface SearchSuggestResponse {
  query: string;
  categories: SearchSuggestCategoryItem[];
  products: SearchSuggestProductItem[];
  totalProducts: number;
}

export type CategoriesResponse = Category[];
export type ProductsResponse = Paginated<Product> & {
  facets?: ProductFacets;
};
export type ProductDetailResponse = Product & {
  related: Product[];
};
export type LooksResponse = LookbookItem[];
export type LookDetailResponse = LookbookItem & {
  products: Product[];
};
export type PublicSettingsResponse = PublicSettings;
export type ReservationsListResponse = Reservation[];
export type ReservationDetailResponse = Reservation;
export type CitiesResponse = DeliveryCity[];
export type AgenciesResponse = Agency[];
export type AddressesResponse = Address[];
