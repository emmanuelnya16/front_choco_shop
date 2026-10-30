import type { ReservationStatusCode } from './reservationStatus';

export type ReceptionMode = 'delivery' | 'pickup';

export type CategorySlug = 'vetements' | 'chaussures' | 'babouches';

export type ProductBadgeType = 'new' | 'low-stock' | 'sold-out';

export interface SubCategory {
  id: string;
  slug: string;
  name: string;
  coverImage: string;
  fallbackImage: string;
  productCount: number;
}

export interface Category {
  id: string;
  slug: string;
  name: string;
  description: string;
  image: string;
  coverImage: string;
  fallbackImage: string;
  productCount: number;
  subCategories: SubCategory[];
}

export interface ProductColor {
  code: string;
  name: string;
  hex: string;
}

export interface ProductVariant {
  id: string;
  size: string;
  colorCode: string;
  stock: number;
}

/**
 * HYPOTHÈSE: Chaque photo de la galerie produit peut être rattachée à une couleur
 * via `colorCode` afin que le changement de couleur sur la fiche affiche la photo correspondante.
 */
export interface ProductImageEntry {
  url: string;
  fallbackUrl: string;
  colorCode?: string;
  alt?: string;
}

export interface SizeGuideTable {
  type: 'clothing' | 'footwear' | 'one-size';
  title: string;
  tip: string;
  headers: string[];
  rows: string[][];
}

export interface Product {
  id: string;
  slug: string;
  name: string;
  description: string;
  composition: string;
  careInstructions: string[];
  sizeGuide: SizeGuideTable;
  categorySlug: string;
  subCategorySlug?: string;
  price: number;
  images: string[];
  fallbackImages: string[];
  mediaGallery: ProductImageEntry[];
  colors: ProductColor[];
  sizes: string[];
  variants: ProductVariant[];
  isNew: boolean;
  reservationsCount: number;
  badges: ProductBadgeType[];
  createdAt: string;
}

export interface LookbookItem {
  id: string;
  title: string;
  subtitle: string;
  image: string;
  fallback: string;
  productSlugs: string[];
}

export interface User {
  id: string;
  phone: string;
  firstName?: string;
  lastName?: string;
  city?: string;
  createdAt: string;
}

export interface Address {
  id: string;
  label: string;
  city: string;
  district: string;
  quarter: string;
  landmark: string;
  details?: string;
  receptionMode: ReceptionMode;
  agencyId?: string;
  recipientName?: string;
  recipientPhone?: string;
  phone?: string;
  isDefault: boolean;
}

export interface DeliveryCity {
  id: string;
  name: string;
  fee: number;
  isLocal: boolean;
  hasAgencies: boolean;
  estimatedDelay: string;
}

export interface Agency {
  id: string;
  cityId: string;
  city: string;
  name: string;
  address: string;
  phone: string;
  openingHours: string;
}

export interface PaymentOperatorSetting {
  code: 'orange' | 'mtn';
  name: string;
  merchantCode: string;
  ussdTemplate: string;
  accountName: string;
  qrCodeUrl?: string;
}

/**
 * Paramètre d'opérateur Mobile Money pour l'écran de paiement (§3.1 M4).
 * HYPOTHÈSE: Les codes USSD, codes marchands, QR codes et instructions sont fournis par le client
 * et configurables dans l'administration. Aucun code USSD réel n'est écrit en dur dans le code.
 */
export interface PaymentOperatorConfig {
  id: 'orange' | 'mtn';
  label: string;
  merchantName: string;
  merchantCode: string;
  ussdTemplate: string | null;
  qrImageUrl: string | null;
  steps: string[];
  enabled: boolean;
}

export interface PaymentSettings {
  operators: PaymentOperatorConfig[];
  exactAmountRequired: true;
  validationDelayText: string;
  proofMaxSizeMb: number;
}

export interface PublicSettings {
  operators: PaymentOperatorSetting[];
  payment: PaymentSettings;
  whatsappNumber: string;
  reservationExpiryHours: number;
  // HYPOTHÈSE: Champs normalisés M3 (§3.1) conservant `pickupAddress` pour la rétrocompatibilité M1/M2.
  reservationHoldHours: number;
  deliveryFeePayment: 'upfront' | 'on_delivery';
  shop: {
    name: string;
    address: string;
    city: string;
    openingHours: string;
    mapsUrl: string;
  };
  pickupAddress: {
    name: string;
    city: string;
    quarter: string;
    landmark: string;
    openingHours: string;
  };
}

export interface CartItem {
  productId: string;
  slug: string;
  name: string;
  image: string;
  variantId: string;
  size: string;
  color: ProductColor;
  unitPrice: number;
  quantity: number;
  maxQuantity: number;
}

/**
 * Photo du colis prêt (envoyée par le gérant une fois la commande emballée).
 * HYPOTHÈSE: Les photos de colis sont hébergées dans un dossier privé Cloudinary
 * par réservation et servies via des URL signées renvoyées telles quelles par l'API.
 * `cloudinaryUrl()` ne s'applique donc jamais à `PackagePhoto`.
 */
export interface PackagePhoto {
  id: string;
  url: string;
  thumbnailUrl: string;
  width: number;
  height: number;
  takenAt: string; // ISO 8601
}

export interface ReservationItem {
  id: string;
  productId: string;
  slug: string;
  name: string;
  image: string;
  variantId: string;
  size: string;
  colorName: string;
  // HYPOTHÈSE: code et teinte de la couleur renvoyés par l'API pour remettre l'article au panier (« Réserver à nouveau »).
  colorCode?: string;
  colorHex?: string;
  unitPrice: number;
  quantity: number;
}

/** Qui a déclenché une étape (sert à afficher « Annulée par vous » ou « par la boutique »). */
export type ReservationActor = 'client' | 'shop' | 'system';

/**
 * Entrée datée du journal de suivi (§3.1 M5) : une entrée par changement de statut, dans l'ordre chronologique.
 * Un rejet suivi d'une nouvelle preuve produit donc deux entrées `payment_rejected` puis `pending_validation`.
 * Les étapes à venir ne figurent pas dans le journal : elles sont déduites de `TIMELINE_ORDER(receptionMode)`.
 */
export interface ReservationTimelineEvent {
  status: ReservationStatusCode;
  at: string; // ISO 8601
  note?: string;
  // HYPOTHÈSE: champ `actor` ajouté au contrat pour savoir qui a annulé ou fait avancer la réservation.
  actor?: ReservationActor;
}

export interface ReservationProof {
  thumbnailUrl: string;
  uploadedAt: string;
  sha256?: string;
  operator?: 'orange' | 'mtn';
  payerPhone?: string;
  transactionId?: string;
}

export interface ReservationRejection {
  reason: string;
  rejectedAt: string;
}

export interface Reservation {
  ref: string;
  status: ReservationStatusCode;
  receptionMode: ReceptionMode;
  items: ReservationItem[];
  subtotal: number;
  deliveryFee: number;
  total: number;
  amount?: {
    subtotal: number;
    deliveryFee: number;
    total: number;
  };
  city?: string;
  address?: {
    district?: string;
    landmark?: string;
  };
  agency?: {
    id?: string;
    name: string;
    address?: string;
    city?: string;
    phone?: string;
    openingHours?: string;
  };
  proof?: ReservationProof;
  rejection?: ReservationRejection;
  createdAt: string;
  /** Date du dernier changement (statut, photos…) : sert au tri des listes et au repère « Nouveau ». */
  updatedAt: string;
  expiresAt: string;
  serverTime?: string;
  rejectionReason?: string;
  notes?: string;
  packagePhotos: PackagePhoto[];
  packageReadyAt: string | null;
  /** Journal daté des changements de statut, du plus ancien au plus récent (§3.1 M5). */
  timeline: ReservationTimelineEvent[];
  /** Calculé par le serveur : le front suit toujours cette valeur (§3.2 M5). */
  cancellable: boolean;
  cancelDeadline?: string | null;
  customer?: {
    firstName: string;
    lastName: string;
    phone: string;
  };
  deliveryAddress?: {
    city: string;
    quarter: string;
    district?: string;
    landmark?: string;
    agencyId?: string;
    agencyName?: string;
    recipientName?: string;
    recipientPhone: string;
  };
}

export interface Paginated<T> {
  items: T[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

/**
 * Sélecteur indiquant si la réservation possède au moins une photo de colis prêt.
 */
export function hasPackagePhotos(
  reservation: Pick<Reservation, 'packagePhotos'> | null | undefined,
): boolean {
  return Boolean(
    reservation &&
      Array.isArray(reservation.packagePhotos) &&
      reservation.packagePhotos.length > 0,
  );
}
