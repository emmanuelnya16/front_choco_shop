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
  agencyId?: string;
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

export interface CancelReservationResponse {
  status: 'cancelled';
  reservation: Reservation;
}

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
