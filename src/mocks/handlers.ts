import { delay, http, HttpResponse } from 'msw';
import { reachedStatusFromTimeline } from '@/features/tracking/timeline';
import { env } from '@/lib/env';
import { normalizeCmPhone } from '@/lib/utils/phone';
import type {
  CancelReservationPayload,
  CartValidatePayload,
  CartValidationItemResult,
  CreateReservationPayload,
  OtpRequestPayload,
  OtpVerifyPayload,
  PriceRangeKey,
  ProductFacets,
  ReservationCreated,
  ReservationListItem,
  ReservationScope,
  ReservationsListPage,
  ReservationsSummary,
  SaveAddressPayload,
  UpdateAddressPayload,
  UpdateProfilePayload,
} from '@/types/api';
import type {
  Address,
  Product,
  Reservation,
  ReservationActor,
  User,
} from '@/types/domain';
import {
  isFinalStatus,
  TIMELINE_ORDER,
  type ReservationStatusCode,
} from '@/types/reservationStatus';
import { mockCategories } from './fixtures/categories';
import { mockLooks } from './fixtures/looks';
import { mockProducts } from './fixtures/products';
import {
  buildPackagePhoto,
  computeCancellable,
  JUNIOR_CUSTOMER,
  mockReservations,
  resetMockReservations,
} from './fixtures/reservations';
import {
  mockAgencies,
  mockDeliveryCities,
  mockJuniorAddresses,
  mockPublicSettings,
} from './fixtures/settings';

const DEFAULT_PAGE_SIZE = 12;

const PRICE_RANGE_DEFINITIONS: Array<{
  value: PriceRangeKey;
  label: string;
  min: number;
  max: number;
}> = [
  { value: '0-15000', label: 'Moins de 15 000 FCFA', min: 0, max: 15000 },
  { value: '15000-30000', label: '15 000 – 30 000 FCFA', min: 15000, max: 30000 },
  { value: '30000-50000', label: '30 000 – 50 000 FCFA', min: 30000, max: 50000 },
  { value: '50000+', label: 'Plus de 50 000 FCFA', min: 50001, max: Number.POSITIVE_INFINITY },
];

const ALL_KNOWN_SIZES = [
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
];

function randomMobileLatency(reservationEndpoint = false): number {
  if (import.meta.env.MODE === 'test') {
    return 10;
  }
  if (reservationEndpoint) {
    return 1200;
  }
  return Math.floor(300 + Math.random() * 600);
}

function isStockChaosEnabled(): boolean {
  return String(import.meta.env.VITE_MOCK_STOCK_CHAOS ?? '').toLowerCase() === 'true';
}

function apiUrl(path: string): string {
  return `${env.apiBaseUrl}${path}`;
}

export function normalizeSearchText(input: string): string {
  return input
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

function matchesPriceRange(price: number, rangeKey: string): boolean {
  const def = PRICE_RANGE_DEFINITIONS.find((r) => r.value === rangeKey);
  if (!def) return true;
  if (rangeKey === '0-15000') return price < 15000;
  if (rangeKey === '15000-30000') return price >= 15000 && price <= 30000;
  if (rangeKey === '30000-50000') return price > 30000 && price <= 50000;
  if (rangeKey === '50000+') return price > 50000;
  return price >= def.min && price <= def.max;
}

function computeFacets(categoryScopedProducts: Product[], activeCategorySlug?: string): ProductFacets {
  const relevantCategory = activeCategorySlug
    ? mockCategories.find(
        (c) =>
          c.slug === activeCategorySlug ||
          c.subCategories.some((sub) => sub.slug === activeCategorySlug),
      )
    : undefined;

  const sizeList =
    relevantCategory?.slug === 'vetements'
      ? ['S', 'M', 'L', 'XL', 'XXL', 'Unique']
      : relevantCategory?.slug === 'chaussures' || relevantCategory?.slug === 'babouches'
        ? ['39', '40', '41', '42', '43', '44', '45', '46']
        : ALL_KNOWN_SIZES;

  const sizes = sizeList.map((sizeVal) => ({
    value: sizeVal,
    count: categoryScopedProducts.filter((p) =>
      p.variants.some((v) => v.size.toUpperCase() === sizeVal.toUpperCase() && v.stock > 0),
    ).length,
  }));

  const priceRanges = PRICE_RANGE_DEFINITIONS.map((range) => ({
    value: range.value,
    label: range.label,
    count: categoryScopedProducts.filter((p) => matchesPriceRange(p.price, range.value)).length,
  }));

  const subCategoryDefs = relevantCategory
    ? relevantCategory.subCategories
    : mockCategories.flatMap((c) => c.subCategories);

  const subCategories = subCategoryDefs.map((sub) => ({
    slug: sub.slug,
    name: sub.name,
    count: categoryScopedProducts.filter((p) => p.subCategorySlug === sub.slug).length,
  }));

  return {
    sizes,
    priceRanges,
    subCategories,
  };
}

// ============================================================================
// État mémoire MSW pour le Module M3 (OTP, utilisateurs, adresses, réservations)
// ============================================================================

interface OtpPhoneTrack {
  requestTimestamps: number[];
  attemptsLeft: number;
  lockedUntil: number | null;
}

const otpTrackByPhone = new Map<string, OtpPhoneTrack>();
const idempotencyCache = new Map<string, ReservationCreated>();
// Map sha256 -> reservationRef pour détecter les doublons de preuve (§3.2 & §3.3)
const seenProofHashes = new Map<string, string>();
let reservationSeqCounter = 124; // Démarre à RES-000124 (§3.2)

// v2 : journal daté `{ status, at }` (M5). Les données v1 de M4 sont ignorées car incompatibles.
const MOCK_RESERVATIONS_SESSION_KEY = 'drc_mock_reservations_v2';

function loadSessionReservations(): void {
  if (typeof window === 'undefined' || import.meta.env.MODE === 'test') return;
  try {
    const raw = window.sessionStorage.getItem(MOCK_RESERVATIONS_SESSION_KEY);
    if (!raw) return;
    const parsed = JSON.parse(raw) as Record<string, Reservation>;
    for (const [ref, res] of Object.entries(parsed)) {
      mockReservations[ref] = res;
      const num = Number(ref.replace('RES-', ''));
      if (Number.isFinite(num) && num >= reservationSeqCounter) {
        reservationSeqCounter = num + 1;
      }
    }
  } catch {
    // Ignore sessionStorage errors
  }
}

function persistSessionReservations(): void {
  if (typeof window === 'undefined' || import.meta.env.MODE === 'test') return;
  try {
    window.sessionStorage.setItem(
      MOCK_RESERVATIONS_SESSION_KEY,
      JSON.stringify(mockReservations),
    );
  } catch {
    // Ignore sessionStorage errors
  }
}

loadSessionReservations();

// Synchronisation entre onglets : MSW exécute les gestionnaires dans chaque onglet (mémoire séparée).
// Le simulateur boutique de /_dev, ouvert dans un autre onglet, diffuse ses changements ici (§3.3 M5).
type MockSyncMessage = { type: 'upsert'; reservation: Reservation } | { type: 'reset' };

const mockSyncChannel: BroadcastChannel | null =
  typeof window !== 'undefined' &&
  typeof BroadcastChannel !== 'undefined' &&
  import.meta.env.MODE !== 'test'
    ? new BroadcastChannel('drc-mock-reservations')
    : null;

mockSyncChannel?.addEventListener('message', (event: MessageEvent<MockSyncMessage>) => {
  const message = event.data;
  if (message?.type === 'upsert') {
    mockReservations[message.reservation.ref] = message.reservation;
    // Une réservation créée dans un autre onglet réserve aussi sa référence ici
    const num = Number(message.reservation.ref.replace('RES-', ''));
    if (Number.isFinite(num) && num >= reservationSeqCounter) {
      reservationSeqCounter = num + 1;
    }
  } else if (message?.type === 'reset') {
    resetMockReservations();
    seenProofHashes.clear();
    idempotencyCache.clear();
  }
  persistSessionReservations();
});

/** Enregistre une réservation modifiée dans la session de l'onglet et la diffuse aux autres onglets. */
function commitReservation(reservation: Reservation): void {
  persistSessionReservations();
  mockSyncChannel?.postMessage({ type: 'upsert', reservation } satisfies MockSyncMessage);
}

/** Ajoute une entrée datée au journal et met à jour statut, `updatedAt` et `cancellable`. */
function pushTimelineEvent(
  reservation: Reservation,
  status: ReservationStatusCode,
  note?: string,
  actor?: ReservationActor,
): string {
  const at = new Date().toISOString();
  reservation.status = status;
  reservation.timeline = [
    ...reservation.timeline,
    { status, at, ...(note ? { note } : {}), ...(actor ? { actor } : {}) },
  ];
  reservation.updatedAt = at;
  reservation.cancellable = computeCancellable(status);
  return at;
}

function reservationNotFound(ref: string) {
  return HttpResponse.json(
    {
      code: 'RESERVATION_NOT_FOUND',
      message: `Aucune réservation trouvée avec la référence ${ref}.`,
    },
    { status: 404 },
  );
}

const JUNIOR_USER: User = {
  id: 'usr-junior-01',
  phone: '+237690000001',
  firstName: 'Junior',
  lastName: 'Mbarga',
  city: 'Douala',
  createdAt: '2026-09-15T10:00:00.000Z',
};

let currentSessionUser: User | null = null;
const usersByPhone = new Map<string, User>([[JUNIOR_USER.phone, { ...JUNIOR_USER }]]);
const addressesByUserId = new Map<string, Address[]>([
  [JUNIOR_USER.id, mockJuniorAddresses.map((a) => ({ ...a }))],
]);
const favoritesByUserId = new Map<string, Set<string>>();

// Session mock conservée dans l'onglet : après un rechargement (ou Android qui recharge l'onglet pendant le
// paiement USSD), le client connecté reste le même et retrouve ses réservations (contrôle de propriétaire M5).
const MOCK_SESSION_USER_KEY = 'drc_mock_session_user_v1';

function persistSessionUser(): void {
  if (typeof window === 'undefined' || import.meta.env.MODE === 'test') return;
  try {
    if (currentSessionUser) {
      window.sessionStorage.setItem(MOCK_SESSION_USER_KEY, JSON.stringify(currentSessionUser));
    } else {
      window.sessionStorage.removeItem(MOCK_SESSION_USER_KEY);
    }
  } catch {
    // Ignore sessionStorage errors
  }
}

function loadSessionUser(): void {
  if (typeof window === 'undefined' || import.meta.env.MODE === 'test') return;
  try {
    const raw = window.sessionStorage.getItem(MOCK_SESSION_USER_KEY);
    if (!raw) return;
    const user = JSON.parse(raw) as User;
    currentSessionUser = user;
    persistSessionUser();
    usersByPhone.set(user.phone, user);
  } catch {
    // Ignore sessionStorage errors
  }
}

loadSessionUser();

interface MockPushSubscription {
  endpoint: string;
  ownerPhone: string;
  platform: string;
  subscribedAt: string;
}
const pushSubscriptions = new Map<string, MockPushSubscription>();

function countOwnerSubscriptions(): number {
  const owner = currentOwnerPhone();
  return [...pushSubscriptions.values()].filter((sub) => sub.ownerPhone === owner).length;
}

export function resetMockM3State(): void {
  otpTrackByPhone.clear();
  pushSubscriptions.clear();
  idempotencyCache.clear();
  seenProofHashes.clear();
  reservationSeqCounter = 124;
  currentSessionUser = null;
  usersByPhone.clear();
  usersByPhone.set(JUNIOR_USER.phone, { ...JUNIOR_USER });
  addressesByUserId.clear();
  addressesByUserId.set(
    JUNIOR_USER.id,
    mockJuniorAddresses.map((a) => ({ ...a })),
  );
  favoritesByUserId.clear();
  // Recrée toutes les réservations de démonstration (supprime aussi celles créées à partir de RES-000124) :
  // RES-000101 redevient « reserved » et RES-000103 « payment_rejected », avec des échéances dans le futur.
  resetMockReservations();
}

/** Téléphone du client « connecté » côté mocks (Junior par défaut, comme pour les adresses). */
function currentOwnerPhone(): string {
  return currentSessionUser?.phone ?? JUNIOR_CUSTOMER.phone;
}

function isOwnedByCurrentUser(reservation: Reservation): boolean {
  return (reservation.customer?.phone ?? JUNIOR_CUSTOMER.phone) === currentOwnerPhone();
}

function ownedReservations(): Reservation[] {
  return Object.values(mockReservations).filter(isOwnedByCurrentUser);
}

/** Réponse détaillée `GET /reservations/:ref` : champs dérivés et `cancellable` calculé par le « serveur ». */
function serializeReservation(reservation: Reservation): Reservation & { serverTime: string } {
  const agencyRef = reservation.agency?.id ?? reservation.deliveryAddress?.agencyId;
  const agencyFixture = agencyRef ? mockAgencies.find((a) => a.id === agencyRef) : undefined;

  return {
    ...reservation,
    serverTime: new Date().toISOString(),
    updatedAt: reservation.updatedAt ?? reservation.createdAt,
    cancellable: computeCancellable(reservation.status),
    amount: reservation.amount ?? {
      subtotal: reservation.subtotal,
      deliveryFee: reservation.deliveryFee,
      total: reservation.total,
    },
    city: reservation.city ?? reservation.deliveryAddress?.city,
    address:
      reservation.address ??
      (reservation.deliveryAddress
        ? {
            district: reservation.deliveryAddress.district ?? reservation.deliveryAddress.quarter,
            landmark: reservation.deliveryAddress.landmark,
          }
        : undefined),
    agency:
      reservation.agency || reservation.deliveryAddress?.agencyName
        ? {
            id: agencyRef,
            name: reservation.agency?.name ?? reservation.deliveryAddress?.agencyName ?? '',
            address: reservation.agency?.address ?? agencyFixture?.address,
            city: reservation.agency?.city ?? agencyFixture?.city,
            phone: reservation.agency?.phone ?? agencyFixture?.phone,
            openingHours: reservation.agency?.openingHours ?? agencyFixture?.openingHours,
          }
        : undefined,
    rejection:
      reservation.rejection ??
      (reservation.rejectionReason
        ? { reason: reservation.rejectionReason, rejectedAt: reservation.updatedAt ?? reservation.createdAt }
        : undefined),
  };
}

function isScopeMatch(reservation: Reservation, scope: ReservationScope): boolean {
  return scope === 'done' ? isFinalStatus(reservation.status) : !isFinalStatus(reservation.status);
}

function toListItem(reservation: Reservation, serverTime: string): ReservationListItem {
  const awaitingPayment =
    reservation.status === 'reserved' || reservation.status === 'payment_rejected';
  return {
    ref: reservation.ref,
    status: reservation.status,
    createdAt: reservation.createdAt,
    updatedAt: reservation.updatedAt ?? reservation.createdAt,
    expiresAt: awaitingPayment ? reservation.expiresAt : undefined,
    serverTime,
    amount: { total: reservation.amount?.total ?? reservation.total },
    itemsCount: reservation.items.reduce((sum, item) => sum + item.quantity, 0),
    itemsPreview: reservation.items.slice(0, 3).map((item) => ({ image: item.image, name: item.name })),
    packagePhotoThumb: reservation.packagePhotos[0]?.thumbnailUrl ?? null,
    receptionMode: reservation.receptionMode,
    city:
      reservation.city ??
      reservation.deliveryAddress?.city ??
      (reservation.receptionMode === 'pickup' ? mockPublicSettings.shop.city : undefined),
    reachedStatus:
      reservation.status === 'expired' || reservation.status === 'cancelled'
        ? reachedStatusFromTimeline(reservation.timeline, reservation.receptionMode)
        : undefined,
  };
}

// HYPOTHÈSE: statuts qui demandent une action du client (payer, renvoyer une preuve, venir retirer le colis).
const NEEDS_ACTION_STATUSES: ReadonlySet<ReservationStatusCode> = new Set([
  'reserved',
  'payment_rejected',
  'ready_for_pickup',
]);

const RESERVATIONS_PAGE_SIZE = 10;

/** Statut suivant dans le parcours (simulateur « Étape suivante »), ou `null` si la réservation est terminée. */
function nextSimulatedStatus(reservation: Reservation): ReservationStatusCode | null {
  if (reservation.status === 'reserved' || reservation.status === 'payment_rejected') {
    return 'pending_validation';
  }
  const order = TIMELINE_ORDER(reservation.receptionMode);
  const index = order.indexOf(reservation.status);
  if (index < 0 || index >= order.length - 1) return null;
  return order[index + 1] ?? null;
}

/** Note datée par défaut pour chaque étape avancée par la boutique (simulateur). */
function defaultStepNote(reservation: Reservation, status: ReservationStatusCode): string | undefined {
  const agencyName = reservation.agency?.name ?? reservation.deliveryAddress?.agencyName;
  switch (status) {
    case 'pending_validation':
      return reservation.timeline.some((e) => e.status === 'payment_rejected')
        ? 'Nouvelle preuve envoyée.'
        : 'Capture Orange Money reçue.';
    case 'confirmed':
      return 'Paiement validé par la boutique.';
    case 'handed_to_agency':
      return agencyName ? `Colis remis à ${agencyName}.` : 'Colis prêt, en attente du livreur.';
    case 'ready_for_pickup':
      return 'Colis prêt à la boutique d’Akwa.';
    case 'in_delivery':
      return agencyName ? `En route vers ${reservation.city ?? 'votre ville'}.` : 'Le livreur est en route.';
    case 'delivered':
      return 'Colis remis en main propre.';
    case 'picked_up':
      return 'Colis retiré à la boutique.';
    default:
      return undefined;
  }
}

/** Passe en « pending_validation » en simulant l'envoi d'une capture si besoin (rejet → nouvelle preuve). */
function simulateProofReceived(reservation: Reservation): void {
  const at = pushTimelineEvent(
    reservation,
    'pending_validation',
    defaultStepNote(reservation, 'pending_validation'),
    'client',
  );
  reservation.proof = { thumbnailUrl: '/mock/preuve-1.svg', uploadedAt: at, operator: 'orange' };
  reservation.rejection = undefined;
  reservation.rejectionReason = undefined;
}

function getOrCreatePhoneTrack(phone: string): OtpPhoneTrack {
  const existing = otpTrackByPhone.get(phone);
  if (existing) return existing;
  const fresh: OtpPhoneTrack = {
    requestTimestamps: [],
    attemptsLeft: 5,
    lockedUntil: null,
  };
  otpTrackByPhone.set(phone, fresh);
  return fresh;
}

function safeNormalizePhone(raw: string): string | null {
  try {
    return normalizeCmPhone(raw);
  } catch {
    return null;
  }
}

export const handlers = [
  // GET /categories
  http.get(apiUrl('/categories'), async () => {
    await delay(randomMobileLatency());
    return HttpResponse.json(mockCategories);
  }),

  // GET /looks
  http.get(apiUrl('/looks'), async () => {
    await delay(randomMobileLatency());
    return HttpResponse.json(mockLooks);
  }),

  // GET /looks/:id
  http.get(apiUrl('/looks/:id'), async ({ params }) => {
    await delay(randomMobileLatency());
    const id = String(params.id ?? '');
    const look = mockLooks.find((item) => item.id === id);

    if (!look) {
      return HttpResponse.json(
        { code: 'NOT_FOUND', message: 'Ce look est introuvable.' },
        { status: 404 },
      );
    }

    const products = look.productSlugs
      .map((slug) => mockProducts.find((p) => p.slug === slug))
      .filter((p): p is Product => Boolean(p));

    return HttpResponse.json({
      ...look,
      products,
    });
  }),

  // GET /search/suggest
  http.get(apiUrl('/search/suggest'), async ({ request }) => {
    await delay(
      import.meta.env.MODE === 'test'
        ? 10
        : Math.floor(180 + Math.random() * 250),
    );
    const url = new URL(request.url);
    const rawQuery = url.searchParams.get('q') ?? '';
    const q = normalizeSearchText(rawQuery);

    if (q.length < 2) {
      return HttpResponse.json({
        query: rawQuery,
        categories: [],
        products: [],
        totalProducts: 0,
      });
    }

    const matchingCategories = mockCategories.flatMap((cat) => {
      const results: Array<{
        slug: string;
        name: string;
        parentSlug?: string;
        productCount: number;
      }> = [];
      if (
        normalizeSearchText(cat.name).includes(q) ||
        normalizeSearchText(cat.slug).includes(q)
      ) {
        results.push({
          slug: cat.slug,
          name: cat.name,
          productCount: cat.productCount,
        });
      }
      for (const sub of cat.subCategories) {
        if (
          normalizeSearchText(sub.name).includes(q) ||
          normalizeSearchText(sub.slug).includes(q)
        ) {
          results.push({
            slug: sub.slug,
            name: sub.name,
            parentSlug: cat.slug,
            productCount: sub.productCount,
          });
        }
      }
      return results;
    });

    const matchingProducts = mockProducts.filter((product) => {
      const haystack = normalizeSearchText(
        `${product.name} ${product.description} ${product.categorySlug} ${product.subCategorySlug ?? ''} ${product.sizes.join(' ')}`,
      );
      return haystack.includes(q);
    });

    const topProducts = matchingProducts.slice(0, 6).map((p) => ({
      id: p.id,
      slug: p.slug,
      name: p.name,
      price: p.price,
      image: p.images[0] ?? p.fallbackImages[0] ?? '/mock/product-tee.svg',
      fallbackImage: p.fallbackImages[0] ?? '/mock/product-tee.svg',
      categorySlug: p.categorySlug,
      totalStock: p.variants.reduce((acc, v) => acc + v.stock, 0),
    }));

    return HttpResponse.json({
      query: rawQuery,
      categories: matchingCategories.slice(0, 4),
      products: topProducts,
      totalProducts: matchingProducts.length,
    });
  }),

  // GET /products
  http.get(apiUrl('/products'), async ({ request }) => {
    await delay(randomMobileLatency());
    const url = new URL(request.url);
    const rawQ = url.searchParams.get('q')?.trim() ?? '';

    if (rawQ === '__error__') {
      return HttpResponse.json(
        {
          code: 'SIMULATED_SERVER_ERROR',
          message: 'Erreur serveur simulée lors du chargement du catalogue.',
        },
        { status: 500 },
      );
    }

    const category = url.searchParams.get('category')?.trim().toLowerCase();
    const sub = url.searchParams.get('sub')?.trim().toLowerCase();
    const sizesParam = url.searchParams
      .getAll('size')
      .flatMap((s) => s.split(','))
      .map((s) => s.trim().toUpperCase())
      .filter(Boolean);
    const priceRange = url.searchParams.get('price')?.trim();
    const minPriceRaw = url.searchParams.get('minPrice');
    const maxPriceRaw = url.searchParams.get('maxPrice');
    const availableRaw = url.searchParams.get('available');
    const lookId = url.searchParams.get('look')?.trim();
    const sort = url.searchParams.get('sort') ?? 'popular';
    const page = Math.max(1, Number(url.searchParams.get('page') ?? '1') || 1);
    const pageSize = Math.max(
      1,
      Number(url.searchParams.get('pageSize') ?? String(DEFAULT_PAGE_SIZE)) || DEFAULT_PAGE_SIZE,
    );

    let categoryScoped = [...mockProducts];

    if (category) {
      categoryScoped = categoryScoped.filter(
        (p) =>
          p.categorySlug.toLowerCase() === category ||
          p.subCategorySlug?.toLowerCase() === category,
      );
    }

    const facets = computeFacets(categoryScoped, category);

    let filtered = [...categoryScoped];

    if (sub) {
      filtered = filtered.filter((p) => p.subCategorySlug?.toLowerCase() === sub);
    }

    if (lookId) {
      const look = mockLooks.find((l) => l.id === lookId);
      if (look) {
        filtered = filtered.filter((p) => look.productSlugs.includes(p.slug));
      }
    }

    if (rawQ) {
      const normalizedQ = normalizeSearchText(rawQ);
      filtered = filtered.filter((p) => {
        const haystack = normalizeSearchText(
          `${p.name} ${p.description} ${p.categorySlug} ${p.subCategorySlug ?? ''} ${p.sizes.join(' ')}`,
        );
        return haystack.includes(normalizedQ);
      });
    }

    if (sizesParam.length > 0) {
      filtered = filtered.filter((p) =>
        p.variants.some(
          (v) => sizesParam.includes(v.size.toUpperCase()) && v.stock > 0,
        ),
      );
    }

    if (priceRange) {
      filtered = filtered.filter((p) => matchesPriceRange(p.price, priceRange));
    }

    if (minPriceRaw !== null && minPriceRaw !== '') {
      const minPrice = Number(minPriceRaw);
      if (Number.isFinite(minPrice)) {
        filtered = filtered.filter((p) => p.price >= minPrice);
      }
    }

    if (maxPriceRaw !== null && maxPriceRaw !== '') {
      const maxPrice = Number(maxPriceRaw);
      if (Number.isFinite(maxPrice)) {
        filtered = filtered.filter((p) => p.price <= maxPrice);
      }
    }

    if (availableRaw === 'true' || availableRaw === '1') {
      filtered = filtered.filter((p) => p.variants.some((v) => v.stock > 0));
    }

    if (sort === 'popular') {
      filtered.sort((a, b) => b.reservationsCount - a.reservationsCount);
    } else if (sort === 'price_asc' || sort === 'price-asc') {
      filtered.sort((a, b) => a.price - b.price);
    } else if (sort === 'price_desc' || sort === 'price-desc') {
      filtered.sort((a, b) => b.price - a.price);
    } else {
      filtered.sort(
        (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
      );
    }

    const total = filtered.length;
    const totalPages = Math.max(1, Math.ceil(total / pageSize));
    const start = (page - 1) * pageSize;
    const items = filtered.slice(start, start + pageSize);

    return HttpResponse.json({
      items,
      page,
      pageSize,
      total,
      totalPages,
      facets,
    });
  }),

  // GET /products/:slug
  http.get(apiUrl('/products/:slug'), async ({ params }) => {
    await delay(randomMobileLatency());
    const slug = String(params.slug ?? '');

    if (slug === '__error__') {
      return HttpResponse.json(
        {
          code: 'SIMULATED_SERVER_ERROR',
          message: 'Impossible de charger cet article pour le moment.',
        },
        { status: 500 },
      );
    }

    const product = mockProducts.find((item) => item.slug === slug);

    if (!product) {
      return HttpResponse.json(
        { code: 'NOT_FOUND', message: 'Cet article n’existe plus.' },
        { status: 404 },
      );
    }

    const sameSub = mockProducts.filter(
      (p) => p.id !== product.id && p.subCategorySlug === product.subCategorySlug,
    );
    const sameCategory = mockProducts.filter(
      (p) =>
        p.id !== product.id &&
        p.categorySlug === product.categorySlug &&
        p.subCategorySlug !== product.subCategorySlug,
    );
    const related = [...sameSub, ...sameCategory].slice(0, 6);

    return HttpResponse.json({
      ...product,
      related,
    });
  }),

  // GET /settings/public
  http.get(apiUrl('/settings/public'), async () => {
    await delay(randomMobileLatency());
    return HttpResponse.json(mockPublicSettings);
  }),

  // GET /delivery/cities
  http.get(apiUrl('/delivery/cities'), async () => {
    await delay(randomMobileLatency());
    return HttpResponse.json(mockDeliveryCities);
  }),

  // GET /delivery/agencies
  http.get(apiUrl('/delivery/agencies'), async ({ request }) => {
    await delay(randomMobileLatency());
    const url = new URL(request.url);
    const cityParam = url.searchParams.get('city')?.trim();
    if (cityParam) {
      const normCity = normalizeSearchText(cityParam);
      return HttpResponse.json(
        mockAgencies.filter(
          (a) =>
            a.cityId.toLowerCase() === cityParam.toLowerCase() ||
            normalizeSearchText(a.city) === normCity,
        ),
      );
    }
    return HttpResponse.json(mockAgencies);
  }),

  // POST /cart/validate (§3.1, §3.2, §4.4)
  http.post(apiUrl('/cart/validate'), async ({ request }) => {
    await delay(randomMobileLatency());
    const body = (await request.json()) as CartValidatePayload;
    const chaosHeader = request.headers.get('x-mock-chaos') === '1';
    const chaos = isStockChaosEnabled() || chaosHeader;

    const results: CartValidationItemResult[] = (body?.items ?? []).map((entry, idx) => {
      let foundProduct: Product | undefined;
      let foundVariantStock = 0;

      for (const product of mockProducts) {
        const variant = product.variants.find((v) => v.id === entry.variantId);
        if (variant) {
          foundProduct = product;
          foundVariantStock = variant.stock;
          break;
        }
      }

      if (!foundProduct || foundVariantStock <= 0) {
        return {
          variantId: entry.variantId,
          status: 'unavailable',
          availableQuantity: 0,
          unitPrice: foundProduct?.price ?? 0,
        };
      }

      // En mode VITE_MOCK_STOCK_CHAOS=true, 1 article sur 5 subit une baisse de stock (§3.2)
      if (chaos && (idx % 5 === 0 || Math.random() < 0.2)) {
        if (entry.quantity > 1) {
          return {
            variantId: entry.variantId,
            status: 'reduced',
            availableQuantity: 1,
            unitPrice: foundProduct.price,
          };
        }
        return {
          variantId: entry.variantId,
          status: 'unavailable',
          availableQuantity: 0,
          unitPrice: foundProduct.price,
        };
      }

      if (entry.quantity > foundVariantStock) {
        return {
          variantId: entry.variantId,
          status: 'reduced',
          availableQuantity: foundVariantStock,
          unitPrice: foundProduct.price,
        };
      }

      return {
        variantId: entry.variantId,
        status: 'ok',
        availableQuantity: foundVariantStock,
        unitPrice: foundProduct.price,
      };
    });

    return HttpResponse.json({
      items: results,
      checkedAt: new Date().toISOString(),
    });
  }),

  // POST /auth/otp/request (§3.1, §3.2, §5.2)
  http.post(apiUrl('/auth/otp/request'), async ({ request }) => {
    await delay(randomMobileLatency());
    const body = (await request.json()) as OtpRequestPayload;
    const normalizedPhone = body?.phone ? safeNormalizePhone(body.phone) : null;

    if (!normalizedPhone) {
      return HttpResponse.json(
        {
          code: 'INVALID_PHONE',
          message: 'Ce numéro semble incomplet. Entrez les 9 chiffres commençant par 6.',
        },
        { status: 422 },
      );
    }

    const track = getOrCreatePhoneTrack(normalizedPhone);
    const now = Date.now();
    const tenMinAgo = now - 10 * 60 * 1000;

    if (track.lockedUntil && track.lockedUntil > now) {
      const retryAfter = Math.max(1, Math.ceil((track.lockedUntil - now) / 1000));
      return HttpResponse.json(
        {
          code: 'TOO_MANY_ATTEMPTS',
          message: `Trop de tentatives. Réessayez dans ${Math.ceil(retryAfter / 60)} min.`,
          details: { retryAfter },
        },
        { status: 429 },
      );
    }

    track.requestTimestamps = track.requestTimestamps.filter((ts) => ts > tenMinAgo);
    if (track.requestTimestamps.length >= 3) {
      const oldest = track.requestTimestamps[0] ?? now;
      const retryAfter = Math.max(
        1,
        Math.ceil((oldest + 10 * 60 * 1000 - now) / 1000),
      );
      return HttpResponse.json(
        {
          code: 'TOO_MANY_OTP_REQUESTS',
          message: `Trop de demandes de code. Réessayez dans ${Math.ceil(retryAfter / 60)} min.`,
          details: { retryAfter },
        },
        { status: 429 },
      );
    }

    track.requestTimestamps.push(now);
    track.attemptsLeft = 5;
    track.lockedUntil = null;

    return HttpResponse.json({
      message: 'Code envoyé par SMS.',
      expiresIn: 300,
      resendIn: 60,
      expiresInSeconds: 300,
    });
  }),

  // POST /auth/otp/verify (§3.1, §3.2, §5.3)
  http.post(apiUrl('/auth/otp/verify'), async ({ request }) => {
    await delay(randomMobileLatency());
    const body = (await request.json()) as OtpVerifyPayload;
    const normalizedPhone = body?.phone
      ? safeNormalizePhone(body.phone) ?? body.phone
      : '+237690000000';
    const code = String(body?.code ?? '').trim();

    const track = getOrCreatePhoneTrack(normalizedPhone);
    const now = Date.now();

    if (track.lockedUntil && track.lockedUntil > now) {
      const retryAfter = Math.max(1, Math.ceil((track.lockedUntil - now) / 1000));
      return HttpResponse.json(
        {
          code: 'OTP_LOCKED',
          message: `Trop de tentatives. Réessayez dans ${Math.ceil(retryAfter / 60)} min.`,
          details: { retryAfter },
        },
        { status: 429 },
      );
    }

    if (code === '000000') {
      return HttpResponse.json(
        {
          code: 'OTP_EXPIRED',
          message: 'Ce code a expiré.',
        },
        { status: 410 },
      );
    }

    if (code !== '123456') {
      track.attemptsLeft = Math.max(0, track.attemptsLeft - 1);
      if (track.attemptsLeft <= 0) {
        track.lockedUntil = now + 10 * 60 * 1000;
        return HttpResponse.json(
          {
            code: 'OTP_LOCKED',
            message: 'Trop de tentatives. Réessayez dans 10 min.',
            details: { retryAfter: 600, attemptsLeft: 0 },
          },
          { status: 429 },
        );
      }

      return HttpResponse.json(
        {
          code: 'INVALID_OTP_CODE',
          message: `Code incorrect. Il vous reste ${track.attemptsLeft} essai${track.attemptsLeft > 1 ? 's' : ''}.`,
          details: { attemptsLeft: track.attemptsLeft },
        },
        { status: 422 },
      );
    }

    // Code 123456 valide
    track.attemptsLeft = 5;
    track.lockedUntil = null;

    const existingUser = usersByPhone.get(normalizedPhone);
    const isNewUser = !existingUser;

    const user: User = existingUser ?? {
      id: `usr-${ normalizedPhone.slice(-6) }`,
      phone: normalizedPhone,
      city: 'Douala',
      createdAt: new Date().toISOString(),
    };

    usersByPhone.set(normalizedPhone, user);
    currentSessionUser = user;
    persistSessionUser();

    return HttpResponse.json({
      accessToken: `mock-jwt-access-token-${user.id}-${Date.now()}`,
      user,
      isNewUser,
    });
  }),

  // POST /auth/refresh (§3.1, §5.5)
  http.post(apiUrl('/auth/refresh'), async () => {
    await delay(randomMobileLatency());
    if (!currentSessionUser) {
      // Tente de retrouver Junior ou le premier utilisateur connu si rafraîchissement de session
      const fallbackUser = usersByPhone.get(JUNIOR_USER.phone);
      if (!fallbackUser) {
        return HttpResponse.json(
          { code: 'NO_SESSION', message: 'Aucune session active.' },
          { status: 401 },
        );
      }
      currentSessionUser = fallbackUser;
    }

    return HttpResponse.json({
      accessToken: `mock-jwt-refreshed-${currentSessionUser.id}-${Date.now()}`,
      user: currentSessionUser,
    });
  }),

  // POST /auth/logout (§3.1, §5.5)
  http.post(apiUrl('/auth/logout'), async () => {
    await delay(randomMobileLatency());
    currentSessionUser = null;
    persistSessionUser();
    return new HttpResponse(null, { status: 204 });
  }),

  // GET /me (§3.1)
  http.get(apiUrl('/me'), async () => {
    await delay(randomMobileLatency());
    if (!currentSessionUser) {
      return HttpResponse.json(
        { code: 'UNAUTHORIZED', message: 'Veuillez vous connecter.' },
        { status: 401 },
      );
    }
    return HttpResponse.json(currentSessionUser);
  }),

  // PATCH /me (§3.1, §5.4)
  http.patch(apiUrl('/me'), async ({ request }) => {
    await delay(randomMobileLatency());
    const body = (await request.json()) as UpdateProfilePayload;
    const baseUser = currentSessionUser ?? { ...JUNIOR_USER };
    const updated: User = {
      ...baseUser,
      firstName: body.firstName?.trim() || baseUser.firstName,
      lastName: body.lastName?.trim() || baseUser.lastName,
      city: body.city?.trim() || baseUser.city,
    };
    currentSessionUser = updated;
    persistSessionUser();
    usersByPhone.set(updated.phone, updated);
    return HttpResponse.json(updated);
  }),

  // GET /me/addresses (§3.1, §6.4)
  http.get(apiUrl('/me/addresses'), async () => {
    await delay(randomMobileLatency());
    const userId = currentSessionUser?.id ?? JUNIOR_USER.id;
    const list = addressesByUserId.get(userId) ?? [];
    return HttpResponse.json(list);
  }),

  // POST /me/addresses (§3.1, §6.4)
  http.post(apiUrl('/me/addresses'), async ({ request }) => {
    await delay(randomMobileLatency());
    const body = (await request.json()) as SaveAddressPayload;
    const userId = currentSessionUser?.id ?? JUNIOR_USER.id;
    const existing = addressesByUserId.get(userId) ?? [];

    const newAddress: Address = {
      id: body.id ?? `addr-${Date.now()}`,
      label: body.label || 'Maison',
      city: body.city,
      district: body.district,
      quarter: body.district,
      landmark: body.landmark,
      details: body.landmark,
      receptionMode: body.receptionMode ?? 'delivery',
      agencyId: body.agencyId ?? undefined,
      recipientName:
        body.recipientName ??
        ([currentSessionUser?.firstName, currentSessionUser?.lastName]
          .filter(Boolean)
          .join(' ') || 'Client'),
      recipientPhone:
        body.recipientPhone ?? currentSessionUser?.phone ?? '+237690000001',
      phone: body.recipientPhone ?? currentSessionUser?.phone ?? '+237690000001',
      isDefault: body.isDefault ?? existing.length === 0,
    };

    const nextList = newAddress.isDefault
      ? [newAddress, ...existing.map((a) => ({ ...a, isDefault: false }))]
      : [...existing, newAddress];

    addressesByUserId.set(userId, nextList);
    return HttpResponse.json(newAddress, { status: 201 });
  }),

  // PATCH /me/addresses/:id (§3.1 M5) : `isDefault: true` retire le défaut des autres adresses
  http.patch(apiUrl('/me/addresses/:id'), async ({ params, request }) => {
    await delay(randomMobileLatency());
    const id = String(params.id ?? '');
    const userId = currentSessionUser?.id ?? JUNIOR_USER.id;
    const list = addressesByUserId.get(userId) ?? [];
    const current = list.find((a) => a.id === id);
    if (!current) {
      return HttpResponse.json(
        { code: 'ADDRESS_NOT_FOUND', message: 'Cette adresse est introuvable.' },
        { status: 404 },
      );
    }

    const body = (await request.json()) as UpdateAddressPayload;
    const patch = Object.fromEntries(
      Object.entries(body ?? {}).filter(([, value]) => value !== undefined),
    ) as UpdateAddressPayload;

    const updated: Address = {
      ...current,
      ...patch,
      agencyId: patch.agencyId === null ? undefined : (patch.agencyId ?? current.agencyId),
      quarter: patch.district ?? current.quarter,
      details: patch.landmark ?? current.details,
      phone: patch.recipientPhone ?? current.phone,
      isDefault: patch.isDefault ?? current.isDefault,
    };

    const nextList = updated.isDefault
      ? [updated, ...list.filter((a) => a.id !== id).map((a) => ({ ...a, isDefault: false }))]
      : list.map((a) => (a.id === id ? updated : a));

    addressesByUserId.set(userId, nextList);
    return HttpResponse.json(updated);
  }),

  // DELETE /me/addresses/:id (§3.1 M5)
  http.delete(apiUrl('/me/addresses/:id'), async ({ params }) => {
    await delay(randomMobileLatency());
    const id = String(params.id ?? '');
    const userId = currentSessionUser?.id ?? JUNIOR_USER.id;
    const list = addressesByUserId.get(userId) ?? [];
    const removed = list.find((a) => a.id === id);
    if (!removed) {
      return HttpResponse.json(
        { code: 'ADDRESS_NOT_FOUND', message: 'Cette adresse est introuvable.' },
        { status: 404 },
      );
    }
    let nextList = list.filter((a) => a.id !== id);
    // HYPOTHÈSE: si l'adresse par défaut est supprimée, la première restante devient l'adresse par défaut.
    if (removed.isDefault && nextList.length > 0 && !nextList.some((a) => a.isDefault)) {
      nextList = nextList.map((a, index) => ({ ...a, isDefault: index === 0 }));
    }
    addressesByUserId.set(userId, nextList);
    return new HttpResponse(null, { status: 204 });
  }),

  // GET /favorites & POST /favorites (§5.5)
  http.get(apiUrl('/favorites'), async () => {
    await delay(randomMobileLatency());
    const userId = currentSessionUser?.id ?? JUNIOR_USER.id;
    const set = favoritesByUserId.get(userId) ?? new Set<string>();
    return HttpResponse.json(Array.from(set));
  }),

  http.post(apiUrl('/favorites'), async ({ request }) => {
    await delay(randomMobileLatency());
    const body = (await request.json()) as { productIds?: string[]; productId?: string };
    const userId = currentSessionUser?.id ?? JUNIOR_USER.id;
    const set = favoritesByUserId.get(userId) ?? new Set<string>();
    if (Array.isArray(body?.productIds)) {
      for (const id of body.productIds) {
        if (typeof id === 'string') set.add(id);
      }
    }
    if (typeof body?.productId === 'string') {
      set.add(body.productId);
    }
    favoritesByUserId.set(userId, set);
    return HttpResponse.json(Array.from(set));
  }),

  // GET /reservations (§3.1, §7.4 M3 & §7.2 M4) — avec `scope`, liste paginée de « Mes réservations » (§3.1 M5)
  http.get(apiUrl('/reservations'), async ({ request }) => {
    await delay(randomMobileLatency());
    const url = new URL(request.url);
    const scopeParam = url.searchParams.get('scope');

    if (scopeParam === 'active' || scopeParam === 'done') {
      const page = Math.max(1, Number(url.searchParams.get('page') ?? '1') || 1);
      const owned = ownedReservations();
      // Les réservations modifiées récemment remontent en tête de leur onglet (§8.1 M5)
      const scoped = owned
        .filter((r) => isScopeMatch(r, scopeParam))
        .sort(
          (a, b) =>
            new Date(b.updatedAt ?? b.createdAt).getTime() -
            new Date(a.updatedAt ?? a.createdAt).getTime(),
        );
      const total = scoped.length;
      const totalPages = Math.max(1, Math.ceil(total / RESERVATIONS_PAGE_SIZE));
      const serverTime = new Date().toISOString();
      const body: ReservationsListPage = {
        items: scoped
          .slice((page - 1) * RESERVATIONS_PAGE_SIZE, page * RESERVATIONS_PAGE_SIZE)
          .map((r) => toListItem(r, serverTime)),
        page,
        pageSize: RESERVATIONS_PAGE_SIZE,
        total,
        totalPages,
        counts: {
          active: owned.filter((r) => isScopeMatch(r, 'active')).length,
          done: owned.filter((r) => isScopeMatch(r, 'done')).length,
        },
      };
      return HttpResponse.json(body);
    }

    const statusFilter = url.searchParams.get('status')?.trim();
    const all = ownedReservations().sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
    );
    if (statusFilter === 'reserved') {
      return HttpResponse.json(
        all.filter(
          (r) => r.status === 'reserved' || r.status === 'payment_rejected',
        ),
      );
    }
    if (statusFilter) {
      return HttpResponse.json(all.filter((r) => r.status === statusFilter));
    }
    return HttpResponse.json(all);
  }),

  // POST /reservations (§3.1, §3.2, §7.1)
  http.post(apiUrl('/reservations'), async ({ request }) => {
    await delay(randomMobileLatency(true));
    const idempotencyKey = request.headers.get('Idempotency-Key')?.trim();
    if (idempotencyKey && idempotencyCache.has(idempotencyKey)) {
      return HttpResponse.json(idempotencyCache.get(idempotencyKey)!, {
        status: 200,
      });
    }

    const body = (await request.json()) as CreateReservationPayload;
    const forceConflict = request.headers.get('x-mock-conflict') === '1';
    const chaosConflict = isStockChaosEnabled() && Math.random() < 0.1;

    // Vérification du stock de chaque article
    const conflictItems: CartValidationItemResult[] = [];
    for (const reqItem of body.items ?? []) {
      const product = mockProducts.find((p) => p.id === reqItem.productId);
      const variant = product?.variants.find((v) => v.id === reqItem.variantId);
      if (!product || !variant || variant.stock <= 0) {
        conflictItems.push({
          variantId: reqItem.variantId,
          status: 'unavailable',
          availableQuantity: 0,
          unitPrice: product?.price ?? 0,
        });
      } else if (reqItem.quantity > variant.stock) {
        conflictItems.push({
          variantId: reqItem.variantId,
          status: 'reduced',
          availableQuantity: variant.stock,
          unitPrice: product.price,
        });
      }
    }

    if (forceConflict || chaosConflict || conflictItems.length > 0) {
      const detailsItems =
        conflictItems.length > 0
          ? conflictItems
          : (body.items ?? []).slice(0, 1).map((it) => ({
              variantId: it.variantId,
              status: 'unavailable' as const,
              availableQuantity: 0,
              unitPrice: 0,
            }));

      return HttpResponse.json(
        {
          code: 'STOCK_CONFLICT',
          message:
            "Un article n'est plus disponible dans la quantité demandée. Vérifiez votre panier.",
          details: { items: detailsItems },
        },
        { status: 409 },
      );
    }

    // Construction des lignes et calcul des montants
    const reservationItems = (body.items ?? []).map((reqItem, idx) => {
      const product =
        mockProducts.find((p) => p.id === reqItem.productId) ?? mockProducts[0];
      const variant =
        product.variants.find((v) => v.id === reqItem.variantId) ??
        product.variants[0];
      const colorObj =
        product.colors.find((c) => c.code === variant?.colorCode) ??
        product.colors[0];

      return {
        id: `res-item-${reservationSeqCounter}-${idx + 1}`,
        productId: product.id,
        slug: product.slug,
        name: product.name,
        image: product.fallbackImages[0] ?? '/mock/product-tee.svg',
        variantId: reqItem.variantId,
        size: variant?.size ?? 'L',
        colorName: colorObj?.name ?? 'Noir Charbon',
        unitPrice: product.price,
        quantity: reqItem.quantity,
      };
    });

    const subtotal = reservationItems.reduce(
      (sum, item) => sum + item.unitPrice * item.quantity,
      0,
    );

    const cityObj = mockDeliveryCities.find(
      (c) =>
        c.name.toLowerCase() === (body.city ?? '').toLowerCase() ||
        c.id.toLowerCase() === (body.city ?? '').toLowerCase(),
    );

    const rawDeliveryFee =
      body.receptionMode === 'pickup' ? 0 : (cityObj?.fee ?? 1500);
    const countedDeliveryFee =
      mockPublicSettings.deliveryFeePayment === 'on_delivery' ? 0 : rawDeliveryFee;
    const total = subtotal + countedDeliveryFee;

    const ref = `RES-${String(reservationSeqCounter).padStart(6, '0')}`;
    reservationSeqCounter += 1;

    const now = new Date();
    const serverTime = now.toISOString();
    const expiresAt = new Date(
      now.getTime() + mockPublicSettings.reservationHoldHours * 3600 * 1000,
    ).toISOString();

    const selectedAgency = body.agencyId
      ? mockAgencies.find((a) => a.id === body.agencyId)
      : undefined;

    const created: ReservationCreated = {
      ref,
      status: 'reserved',
      receptionMode: body.receptionMode,
      items: reservationItems,
      subtotal,
      deliveryFee: rawDeliveryFee,
      total,
      amount: {
        subtotal,
        deliveryFee: rawDeliveryFee,
        total,
      },
      createdAt: serverTime,
      expiresAt,
      serverTime,
      notes: body.notes,
      packagePhotos: [],
      packageReadyAt: null,
      customer: {
        firstName: body.firstName ?? currentSessionUser?.firstName ?? 'Client',
        lastName: body.lastName ?? currentSessionUser?.lastName ?? '',
        // Le propriétaire est le compte connecté (le numéro du formulaire peut être saisi sans +237).
        phone:
          currentSessionUser?.phone ??
          (body.phone ? safeNormalizePhone(body.phone) : null) ??
          JUNIOR_CUSTOMER.phone,
      },
      deliveryAddress:
        body.receptionMode === 'delivery'
          ? {
              city: cityObj?.name ?? body.city ?? 'Douala',
              quarter:
                body.district ??
                selectedAgency?.name ??
                'Quartier non précisé',
              district: body.district,
              landmark: body.landmark,
              agencyId: selectedAgency?.id,
              agencyName: selectedAgency?.name,
              recipientName:
                body.recipientType === 'other'
                  ? body.recipientName
                  : [body.firstName, body.lastName].filter(Boolean).join(' '),
              recipientPhone:
                (body.recipientType === 'other' && body.recipientPhone
                  ? body.recipientPhone
                  : body.phone) ?? '+237690000001',
            }
          : undefined,
      updatedAt: serverTime,
      timeline: [
        {
          status: 'reserved',
          at: serverTime,
          note: 'Articles mis de côté pendant 24 h.',
          actor: 'client',
        },
      ],
      cancellable: true,
      cancelDeadline: null,
    };

    mockReservations[ref] = created;
    commitReservation(created);
    if (idempotencyKey) {
      idempotencyCache.set(idempotencyKey, created);
    }

    return HttpResponse.json(created, { status: 201 });
  }),

  // GET /reservations/summary (§3.1 M5) — déclaré avant /reservations/:ref pour ne pas être pris pour une référence
  http.get(apiUrl('/reservations/summary'), async () => {
    await delay(randomMobileLatency());
    const active = ownedReservations().filter((r) => !isFinalStatus(r.status));
    const lastUpdatedAt =
      ownedReservations()
        .map((r) => r.updatedAt ?? r.createdAt)
        .sort()
        .at(-1) ?? null;
    const body: ReservationsSummary = {
      needsAction: active.filter((r) => NEEDS_ACTION_STATUSES.has(r.status)).length,
      lastUpdatedAt,
      items: active.map((r) => ({
        ref: r.ref,
        status: r.status,
        updatedAt: r.updatedAt ?? r.createdAt,
        hasPackagePhotos: r.packagePhotos.length > 0,
      })),
    };
    return HttpResponse.json(body);
  }),

  // GET /reservations/:ref — 404 aussi si la réservation appartient à un autre client (§5.5 M5)
  http.get(apiUrl('/reservations/:ref'), async ({ params }) => {
    await delay(randomMobileLatency());
    const ref = String(params.ref ?? '').toUpperCase();
    const reservation = mockReservations[ref];

    if (!reservation || !isOwnedByCurrentUser(reservation)) {
      return reservationNotFound(ref);
    }

    return HttpResponse.json(serializeReservation(reservation));
  }),

  // POST /reservations/:ref/proof (§3.2 & §3.3 M4)
  http.post(apiUrl('/reservations/:ref/proof'), async ({ params, request }) => {
    const uploadDelay =
      import.meta.env.MODE === 'test'
        ? 15
        : Math.floor(1500 + Math.random() * 1500);
    await delay(uploadDelay);

    const ref = String(params.ref ?? '').toUpperCase();
    const reservation = mockReservations[ref];

    if (!reservation) {
      return HttpResponse.json(
        {
          code: 'RESERVATION_NOT_FOUND',
          message: `Aucune réservation trouvée avec la référence ${ref}.`,
        },
        { status: 404 },
      );
    }

    // Vérification d'expiration (410 RESERVATION_EXPIRED)
    const isExpiredByTime =
      new Date(reservation.expiresAt).getTime() <= Date.now();
    if (reservation.status === 'expired' || isExpiredByTime) {
      if (reservation.status !== 'expired') {
        pushTimelineEvent(
          reservation,
          'expired',
          'Délai de 24 h dépassé : articles remis en vente.',
          'system',
        );
        commitReservation(reservation);
      }
      return HttpResponse.json(
        {
          code: 'RESERVATION_EXPIRED',
          message:
            'Le délai de 24 h est dépassé : cette réservation a expiré.',
        },
        { status: 410 },
      );
    }

    // Vérification du statut (422 INVALID_STATUS si déjà validée, annulée, livrée, etc.)
    if (
      reservation.status !== 'reserved' &&
      reservation.status !== 'payment_rejected'
    ) {
      return HttpResponse.json(
        {
          code: 'INVALID_STATUS',
          message:
            'Cette réservation ne peut plus recevoir de nouvelle preuve de paiement.',
          details: { status: reservation.status },
        },
        { status: 422 },
      );
    }

    let sha256 = '';
    let operator: 'orange' | 'mtn' = 'orange';
    let payerPhone: string | undefined;
    let transactionId: string | undefined;
    let fileSize = 0;

    const contentType = (request.headers.get('content-type') ?? '').toLowerCase();

    if (contentType.includes('application/json')) {
      try {
        const json = (await request.json()) as Record<string, unknown>;
        sha256 = String(json.sha256 ?? '').trim();
        operator = json.operator === 'mtn' ? 'mtn' : 'orange';
        payerPhone = json.payerPhone ? String(json.payerPhone) : undefined;
        transactionId = json.transactionId
          ? String(json.transactionId)
          : undefined;
        fileSize = Number(json.fileSize ?? 0);
      } catch {
        // Ignoré
      }
    } else {
      try {
        const formData = await request.formData();
        const filePart = formData.get('file');
        if (filePart && typeof filePart === 'object' && 'size' in filePart) {
          fileSize = Number((filePart as Blob).size) || 0;
        }
        sha256 = String(formData.get('sha256') ?? '').trim();
        const rawOp = String(formData.get('operator') ?? 'orange').toLowerCase();
        operator = rawOp === 'mtn' ? 'mtn' : 'orange';
        const rawPhone = String(formData.get('payerPhone') ?? '').trim();
        if (rawPhone) payerPhone = rawPhone;
        const rawTx = String(formData.get('transactionId') ?? '').trim();
        if (rawTx) transactionId = rawTx;
      } catch {
        // Ignoré
      }
    }

    const maxBytes =
      (mockPublicSettings.payment?.proofMaxSizeMb ?? 10) * 1024 * 1024;
    if (fileSize > maxBytes || request.headers.get('x-mock-too-large') === '1') {
      return HttpResponse.json(
        {
          code: 'FILE_TOO_LARGE',
          message: 'Image trop lourde.',
        },
        { status: 413 },
      );
    }

    // 409 DUPLICATE_PROOF si l'empreinte SHA-256 a déjà été utilisée
    if (sha256 && seenProofHashes.has(sha256)) {
      return HttpResponse.json(
        {
          code: 'DUPLICATE_PROOF',
          message:
            'Cette capture a déjà été envoyée pour une autre réservation. Envoyez la capture de ce paiement-ci.',
        },
        { status: 409 },
      );
    }

    if (sha256) {
      seenProofHashes.set(sha256, ref);
    }

    const wasRejected = reservation.status === 'payment_rejected';
    const uploadedAt = pushTimelineEvent(
      reservation,
      'pending_validation',
      wasRejected
        ? 'Nouvelle preuve envoyée.'
        : `Capture ${operator === 'mtn' ? 'MTN MoMo' : 'Orange Money'} reçue.`,
      'client',
    );
    const proof = {
      thumbnailUrl: '/mock/preuve-1.svg',
      uploadedAt,
      sha256: sha256 || undefined,
      operator,
      payerPhone,
      transactionId,
    };

    reservation.proof = proof;
    reservation.rejection = undefined;
    reservation.rejectionReason = undefined;

    commitReservation(reservation);

    return HttpResponse.json({
      status: 'pending_validation' as const,
      proof,
      reservation,
    });
  }),

  // POST /reservations/:ref/cancel (§3.2 & §4.1 M4, §3.1 & §5.4 M5) — 422 si l'annulation n'est plus possible
  http.post(apiUrl('/reservations/:ref/cancel'), async ({ params, request }) => {
    await delay(randomMobileLatency());
    const ref = String(params.ref ?? '').toUpperCase();
    const reservation = mockReservations[ref];

    if (!reservation || !isOwnedByCurrentUser(reservation)) {
      return reservationNotFound(ref);
    }

    if (!computeCancellable(reservation.status)) {
      return HttpResponse.json(
        {
          code: 'CANCEL_NOT_ALLOWED',
          message:
            'Votre commande est déjà en préparation et ne peut plus être annulée ici.',
          details: { status: reservation.status },
        },
        { status: 422 },
      );
    }

    let reason: string | undefined;
    try {
      const body = (await request.json()) as CancelReservationPayload | null;
      reason = body?.reason?.trim() || undefined;
    } catch {
      // Corps vide : motif facultatif
    }

    pushTimelineEvent(reservation, 'cancelled', reason, 'client');
    commitReservation(reservation);

    return HttpResponse.json({
      status: 'cancelled' as const,
      reservation: serializeReservation(reservation),
    });
  }),

  // ==========================================================================
  // Simulateur boutique (mocks uniquement, §3.3 M4 et §3.3 M5)
  // Chaque action met à jour `updatedAt` et ajoute une entrée datée au journal.
  // ==========================================================================

  // POST /push/subscribe et /push/unsubscribe (M6 §7.1) : abonnements gardés en mémoire.
  // Un client peut avoir plusieurs appareils : un abonnement par point de terminaison.
  http.post(apiUrl('/push/subscribe'), async ({ request }) => {
    await delay(100);
    const body = (await request.json().catch(() => null)) as {
      subscription?: { endpoint?: unknown };
      oldEndpoint?: unknown;
      platform?: unknown;
    } | null;
    const endpoint = body?.subscription?.endpoint;
    if (typeof endpoint !== 'string' || !endpoint.startsWith('https://')) {
      return HttpResponse.json(
        { code: 'INVALID_SUBSCRIPTION', message: 'Abonnement aux notifications invalide.' },
        { status: 422 },
      );
    }
    if (typeof body?.oldEndpoint === 'string') pushSubscriptions.delete(body.oldEndpoint);
    pushSubscriptions.set(endpoint, {
      endpoint,
      ownerPhone: currentOwnerPhone(),
      platform: typeof body?.platform === 'string' ? body.platform : 'web',
      subscribedAt: new Date().toISOString(),
    });
    return HttpResponse.json({ ok: true, devices: countOwnerSubscriptions() }, { status: 201 });
  }),

  http.post(apiUrl('/push/unsubscribe'), async ({ request }) => {
    await delay(100);
    const body = (await request.json().catch(() => null)) as { endpoint?: unknown } | null;
    if (typeof body?.endpoint === 'string') pushSubscriptions.delete(body.endpoint);
    return new HttpResponse(null, { status: 204 });
  }),

  // GET /_mock/status — mode effectif des mocks pour /_dev (M6 §7.5) : « browser » (MSW dans l'onglet)
  // ou « node » (serveur de mocks), et nombre d'abonnements aux notifications enregistrés.
  http.get(apiUrl('/_mock/status'), () =>
    HttpResponse.json({
      ok: true,
      runtime: typeof window === 'undefined' ? 'node' : 'browser',
      pushSubscriptions: pushSubscriptions.size,
      sessionUser: currentSessionUser?.phone ?? null,
    }),
  ),

  // POST /_mock/reset — remet TOUT à zéro (session, OTP, adresses, favoris, réservations) :
  // utile avec le serveur de mocks Node, dont l'état survit aux rechargements de page.
  http.post(apiUrl('/_mock/reset'), async () => {
    await delay(100);
    resetMockM3State();
    persistSessionUser();
    persistSessionReservations();
    mockSyncChannel?.postMessage({ type: 'reset' } satisfies MockSyncMessage);
    return HttpResponse.json({ ok: true, count: Object.keys(mockReservations).length });
  }),

  // POST /_mock/reservations/reset — remet toutes les réservations de démonstration à zéro
  http.post(apiUrl('/_mock/reservations/reset'), async () => {
    await delay(100);
    resetMockReservations();
    // Les captures déjà envoyées redeviennent acceptées (sinon 409 DUPLICATE_PROOF après remise à zéro)
    seenProofHashes.clear();
    idempotencyCache.clear();
    persistSessionReservations();
    mockSyncChannel?.postMessage({ type: 'reset' } satisfies MockSyncMessage);
    return HttpResponse.json({ ok: true, count: Object.keys(mockReservations).length });
  }),

  // POST /_mock/reservations/:ref/validate
  http.post(apiUrl('/_mock/reservations/:ref/validate'), async ({ params }) => {
    await delay(100);
    const ref = String(params.ref ?? '').toUpperCase();
    const reservation = mockReservations[ref];
    if (!reservation) {
      return HttpResponse.json(
        { code: 'NOT_FOUND', message: `Réservation ${ref} introuvable.` },
        { status: 404 },
      );
    }

    if (reservation.status === 'reserved' || reservation.status === 'payment_rejected') {
      simulateProofReceived(reservation);
    }
    pushTimelineEvent(reservation, 'confirmed', 'Paiement validé par la boutique.', 'shop');
    reservation.rejection = undefined;
    reservation.rejectionReason = undefined;

    commitReservation(reservation);
    return HttpResponse.json(serializeReservation(reservation));
  }),

  // POST /_mock/reservations/:ref/reject
  http.post(
    apiUrl('/_mock/reservations/:ref/reject'),
    async ({ params, request }) => {
      await delay(100);
      const ref = String(params.ref ?? '').toUpperCase();
      const reservation = mockReservations[ref];
      if (!reservation) {
        return HttpResponse.json(
          { code: 'NOT_FOUND', message: `Réservation ${ref} introuvable.` },
          { status: 404 },
        );
      }

      let reason = 'Capture illisible';
      try {
        const body = (await request.json()) as { reason?: string };
        if (body?.reason?.trim()) {
          reason = body.reason.trim();
        }
      } catch {
        // Garde le motif par défaut
      }

      if (reservation.status === 'reserved') {
        simulateProofReceived(reservation);
      }
      const rejectedAt = pushTimelineEvent(reservation, 'payment_rejected', reason, 'shop');
      reservation.rejectionReason = reason;
      reservation.rejection = { reason, rejectedAt };
      if (!reservation.proof) {
        reservation.proof = { thumbnailUrl: '/mock/preuve-1.svg', uploadedAt: rejectedAt };
      }

      commitReservation(reservation);
      return HttpResponse.json(serializeReservation(reservation));
    },
  ),

  // POST /_mock/reservations/:ref/expire-soon (2 minutes restantes)
  http.post(
    apiUrl('/_mock/reservations/:ref/expire-soon'),
    async ({ params }) => {
      await delay(100);
      const ref = String(params.ref ?? '').toUpperCase();
      const reservation = mockReservations[ref];
      if (!reservation) {
        return HttpResponse.json(
          { code: 'NOT_FOUND', message: `Réservation ${ref} introuvable.` },
          { status: 404 },
        );
      }

      const now = Date.now();
      if (reservation.status !== 'reserved' && reservation.status !== 'payment_rejected') {
        pushTimelineEvent(reservation, 'reserved', 'Articles mis de côté pendant 24 h.', 'client');
      }
      reservation.serverTime = new Date(now).toISOString();
      reservation.expiresAt = new Date(now + 2 * 60 * 1000).toISOString();
      reservation.updatedAt = new Date(now).toISOString();

      commitReservation(reservation);
      return HttpResponse.json(serializeReservation(reservation));
    },
  ),

  // POST /_mock/reservations/:ref/expire
  http.post(apiUrl('/_mock/reservations/:ref/expire'), async ({ params }) => {
    await delay(100);
    const ref = String(params.ref ?? '').toUpperCase();
    const reservation = mockReservations[ref];
    if (!reservation) {
      return HttpResponse.json(
        { code: 'NOT_FOUND', message: `Réservation ${ref} introuvable.` },
        { status: 404 },
      );
    }

    const now = Date.now();
    pushTimelineEvent(
      reservation,
      'expired',
      'Délai de 24 h dépassé : articles remis en vente.',
      'system',
    );
    reservation.serverTime = new Date(now).toISOString();
    reservation.expiresAt = new Date(now - 1000).toISOString();

    commitReservation(reservation);
    return HttpResponse.json(serializeReservation(reservation));
  }),

  // POST /_mock/reservations/:ref/advance — « Étape suivante » selon TIMELINE_ORDER et le mode de réception
  http.post(apiUrl('/_mock/reservations/:ref/advance'), async ({ params }) => {
    await delay(100);
    const ref = String(params.ref ?? '').toUpperCase();
    const reservation = mockReservations[ref];
    if (!reservation) {
      return HttpResponse.json(
        { code: 'NOT_FOUND', message: `Réservation ${ref} introuvable.` },
        { status: 404 },
      );
    }

    const next = nextSimulatedStatus(reservation);
    if (!next) {
      return HttpResponse.json(
        { code: 'NO_NEXT_STEP', message: 'Cette réservation est déjà terminée.' },
        { status: 409 },
      );
    }

    if (next === 'pending_validation') {
      simulateProofReceived(reservation);
    } else {
      pushTimelineEvent(reservation, next, defaultStepNote(reservation, next), 'shop');
    }

    commitReservation(reservation);
    return HttpResponse.json(serializeReservation(reservation));
  }),

  // POST /_mock/reservations/:ref/package-ready — joint 1 à 3 photos et passe à « remise à l'agence » ou « prête »
  http.post(
    apiUrl('/_mock/reservations/:ref/package-ready'),
    async ({ params, request }) => {
      await delay(100);
      const ref = String(params.ref ?? '').toUpperCase();
      const reservation = mockReservations[ref];
      if (!reservation) {
        return HttpResponse.json(
          { code: 'NOT_FOUND', message: `Réservation ${ref} introuvable.` },
          { status: 404 },
        );
      }

      if (reservation.status !== 'confirmed' && reservation.status !== 'preparing') {
        return HttpResponse.json(
          {
            code: 'INVALID_STATUS',
            message:
              'Le colis ne peut être déclaré prêt qu’après la confirmation du paiement, avant l’envoi.',
          },
          { status: 422 },
        );
      }

      let count = 2;
      try {
        const body = (await request.json()) as { count?: number } | null;
        if (typeof body?.count === 'number') count = body.count;
      } catch {
        // Nombre de photos par défaut
      }
      count = Math.min(3, Math.max(1, Math.round(count)));

      if (reservation.status === 'confirmed') {
        pushTimelineEvent(reservation, 'preparing', undefined, 'shop');
      }

      const target: ReservationStatusCode =
        reservation.receptionMode === 'pickup' ? 'ready_for_pickup' : 'handed_to_agency';
      const takenAt = new Date().toISOString();
      const indices: Array<1 | 2 | 3 | 4> = [3, 1, 4, 2];
      reservation.packagePhotos = indices
        .slice(0, count)
        .map((index) => buildPackagePhoto(ref, index, takenAt));
      reservation.packageReadyAt = takenAt;
      pushTimelineEvent(reservation, target, defaultStepNote(reservation, target), 'shop');

      commitReservation(reservation);
      return HttpResponse.json(serializeReservation(reservation));
    },
  ),

  // POST /_mock/reservations/:ref/complete — « Marquer livrée / retirée »
  http.post(apiUrl('/_mock/reservations/:ref/complete'), async ({ params }) => {
    await delay(100);
    const ref = String(params.ref ?? '').toUpperCase();
    const reservation = mockReservations[ref];
    if (!reservation) {
      return HttpResponse.json(
        { code: 'NOT_FOUND', message: `Réservation ${ref} introuvable.` },
        { status: 404 },
      );
    }

    const paidAndOpen: ReservationStatusCode[] = [
      'confirmed',
      'preparing',
      'handed_to_agency',
      'ready_for_pickup',
      'in_delivery',
    ];
    if (!paidAndOpen.includes(reservation.status)) {
      return HttpResponse.json(
        {
          code: 'INVALID_STATUS',
          message: 'Seule une réservation payée et en cours peut être marquée livrée ou retirée.',
        },
        { status: 422 },
      );
    }

    const final: ReservationStatusCode =
      reservation.receptionMode === 'pickup' ? 'picked_up' : 'delivered';
    pushTimelineEvent(reservation, final, defaultStepNote(reservation, final), 'shop');

    commitReservation(reservation);
    return HttpResponse.json(serializeReservation(reservation));
  }),

  // POST /_mock/reservations/:ref/shop-cancel — « Annuler côté boutique »
  http.post(apiUrl('/_mock/reservations/:ref/shop-cancel'), async ({ params }) => {
    await delay(100);
    const ref = String(params.ref ?? '').toUpperCase();
    const reservation = mockReservations[ref];
    if (!reservation) {
      return HttpResponse.json(
        { code: 'NOT_FOUND', message: `Réservation ${ref} introuvable.` },
        { status: 404 },
      );
    }

    if (isFinalStatus(reservation.status)) {
      return HttpResponse.json(
        { code: 'NO_NEXT_STEP', message: 'Cette réservation est déjà terminée.' },
        { status: 409 },
      );
    }

    pushTimelineEvent(reservation, 'cancelled', 'Annulée par la boutique.', 'shop');
    commitReservation(reservation);
    return HttpResponse.json(serializeReservation(reservation));
  }),
];
