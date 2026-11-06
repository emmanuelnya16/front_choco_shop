import { delay, http, HttpResponse } from 'msw';
import type {
  AdminAddNotePayload,
  AdminAdvanceStatusPayload,
  AdminAuthResponse,
  AdminCancelReservationPayload,
  AdminCategoriesResponse,
  AdminDashboardData,
  AdminDashboardPeriod,
  AdminInternalNote,
  AdminLoginPayload,
  AdminLooksResponse,
  AdminLowStockItem,
  AdminPackagePhotoInput,
  AdminPackageReadyPayload,
  AdminPeriodKpis,
  AdminProductSort,
  AdminProductsListResponse,
  AdminProductStockStatus,
  AdminQuickStockPayload,
  AdminRejectPaymentPayload,
  AdminReservationDetailResponse,
  AdminReservationRow,
  AdminReservationsListResponse,
  AdminReservationsTab,
  AdminReservationsTabCounts,
  AdminSearchProductItem,
  AdminSearchResponse,
  AdminUpdateCategoryPayload,
  AdminUpdatePagePayload,
  AdminUpdateSettingsPayload,
  AdminUpsertAgencyPayload,
  AdminUpsertCityPayload,
  AdminUpsertLookPayload,
  AdminUpsertProductPayload,
  AdminUser,
  AdminValidatePaymentPayload,
  AdminContentPageDetail,
  AdminContentPageSummary,
  AdminCustomerItem,
  AdminCustomersListResponse,
  AdminDeliveryAgenciesResponse,
  AdminDeliveryCitiesResponse,
  AdminPagesListResponse,
} from '@/features/admin/types';
import { frenchSpacing } from '@/features/content/markdown/typography';
import { FAQ_SLUG, HELP_PAGES, LEGAL_PAGES } from '@/features/content/registry';
import { env } from '@/lib/env';
import { isValidCmPhone, normalizeCmPhone } from '@/lib/utils/phone';
import type {
  Agency,
  DeliveryCity,
  LookbookItem,
  PackagePhoto,
  Product,
  Reservation,
  ReservationActor,
} from '@/types/domain';
import { isFinalStatus, type ReservationStatusCode } from '@/types/reservationStatus';
import { mockCategories } from './fixtures/categories';
import { mockLooks } from './fixtures/looks';
import { mockContentPages } from './fixtures/pages';
import { computeProductBadges, mockProducts } from './fixtures/products';
import {
  buildPackagePhoto,
  computeCancellable,
  JUNIOR_CUSTOMER,
  mockReservations,
} from './fixtures/reservations';
import {
  mockAgencies,
  mockDeliveryCities,
  mockJuniorAddresses,
  mockPublicSettings,
} from './fixtures/settings';

const HOUR_MS = 3600 * 1000;
const DAY_MS = 24 * HOUR_MS;

const PAID_STATUSES: ReadonlySet<ReservationStatusCode> = new Set<ReservationStatusCode>([
  'confirmed',
  'preparing',
  'handed_to_agency',
  'ready_for_pickup',
  'in_delivery',
  'delivered',
  'picked_up',
]);

export const DEMO_ADMIN_ACCOUNTS: Array<{
  user: AdminUser;
  password: string;
}> = [
  {
    user: {
      id: 'adm-01',
      email: 'admin@drchoco.cm',
      phone: '+237690000000',
      name: 'Gérant DR Choco',
      role: 'owner',
    },
    password: 'choco2026',
  },
  {
    user: {
      id: 'adm-02',
      email: 'manager@drchoco.cm',
      phone: '+237690000010',
      name: 'Responsable Boutique',
      role: 'manager',
    },
    password: 'choco2026',
  },
  {
    user: {
      id: 'adm-03',
      email: 'vendeur@drchoco.cm',
      phone: '+237690000020',
      name: 'Équipe Comptoir',
      role: 'staff',
    },
    password: 'choco2026',
  },
];

const MOCK_ADMIN_SESSION_KEY = 'drc_mock_admin_session_v1';
const MOCK_RESERVATIONS_SESSION_KEY = 'drc_mock_reservations_v1';
const MOCK_ADMIN_TOKEN_PREFIX = 'mock-admin-jwt-token-';

let currentAdminSession: AdminUser | null = null;
const loginFailuresByIdentifier = new Map<string, number>();
const internalNotesByRef = new Map<string, AdminInternalNote[]>();

const adminSyncChannel: BroadcastChannel | null =
  typeof window !== 'undefined' &&
  typeof BroadcastChannel !== 'undefined' &&
  import.meta.env.MODE !== 'test'
    ? new BroadcastChannel('drc-mock-reservations')
    : null;

function commitAdminReservation(reservation: Reservation): void {
  if (typeof window !== 'undefined' && import.meta.env.MODE !== 'test') {
    try {
      window.sessionStorage.setItem(
        MOCK_RESERVATIONS_SESSION_KEY,
        JSON.stringify(mockReservations),
      );
    } catch {
      // Ignorer
    }
  }
  adminSyncChannel?.postMessage({ type: 'upsert', reservation });
}

function pushAdminTimelineEvent(
  reservation: Reservation,
  status: ReservationStatusCode,
  note?: string,
  actor: ReservationActor = 'shop',
): string {
  const at = new Date().toISOString();
  reservation.status = status;
  reservation.timeline = [
    ...reservation.timeline,
    { status, at, ...(note ? { note } : {}), actor },
  ];
  reservation.updatedAt = at;
  reservation.cancellable = computeCancellable(status);
  return at;
}

function defaultAdminStepNote(
  reservation: Reservation,
  status: ReservationStatusCode,
): string | undefined {
  const agencyName = reservation.agency?.name ?? reservation.deliveryAddress?.agencyName;
  switch (status) {
    case 'confirmed':
      return 'Paiement validé par la boutique.';
    case 'preparing':
      return 'Préparation du colis démarrée en boutique.';
    case 'handed_to_agency':
      return agencyName
        ? `Colis remis à ${agencyName}.`
        : 'Colis prêt, en attente du livreur.';
    case 'ready_for_pickup':
      return 'Colis prêt à la boutique d’Akwa.';
    case 'in_delivery':
      return agencyName
        ? `En route vers ${reservation.city ?? 'votre ville'}.`
        : 'Le livreur est en route.';
    case 'delivered':
      return 'Colis remis en main propre.';
    case 'picked_up':
      return 'Colis retiré à la boutique.';
    default:
      return undefined;
  }
}

function serializeAdminReservation(
  reservation: Reservation,
): Reservation & { serverTime: string } {
  const serverTime = reservation.serverTime ?? new Date().toISOString();
  const subtotal =
    reservation.amount?.subtotal ??
    reservation.items.reduce((sum, item) => sum + item.unitPrice * item.quantity, 0);
  const deliveryFee = reservation.amount?.deliveryFee ?? reservation.deliveryFee;
  const total = reservation.amount?.total ?? reservation.total;
  const city =
    reservation.city ??
    reservation.deliveryAddress?.city ??
    (reservation.receptionMode === 'pickup' ? mockPublicSettings.shop.city : undefined);

  // Enrichit la preuve de démonstration avec une empreinte SHA-256 et un numéro payeur déterministes si absents
  const enrichedProof = reservation.proof
    ? {
        ...reservation.proof,
        operator: reservation.proof.operator ?? 'orange',
        payerPhone:
          reservation.proof.payerPhone ??
          reservation.customer?.phone ??
          '+237690000001',
        transactionId:
          reservation.proof.transactionId ??
          `MP2611.${reservation.ref.replace('RES-', '')}.A98`,
        sha256:
          reservation.proof.sha256 ??
          `sha256-demo-${reservation.ref.toLowerCase()}-unique-verified`,
      }
    : undefined;

  return {
    ...reservation,
    serverTime,
    subtotal,
    deliveryFee,
    total,
    amount: { subtotal, deliveryFee, total },
    city,
    proof: enrichedProof,
    cancellable: computeCancellable(reservation.status),
  };
}

function persistMockAdminSession(): void {
  if (typeof window === 'undefined' || import.meta.env.MODE === 'test') return;
  try {
    if (currentAdminSession) {
      window.sessionStorage.setItem(
        MOCK_ADMIN_SESSION_KEY,
        JSON.stringify(currentAdminSession),
      );
    } else {
      window.sessionStorage.removeItem(MOCK_ADMIN_SESSION_KEY);
    }
  } catch {
    // Ignorer les erreurs sessionStorage
  }
}

function loadMockAdminSession(): void {
  if (typeof window === 'undefined' || import.meta.env.MODE === 'test') return;
  try {
    const raw = window.sessionStorage.getItem(MOCK_ADMIN_SESSION_KEY);
    if (!raw) return;
    currentAdminSession = JSON.parse(raw) as AdminUser;
  } catch {
    // Ignorer les erreurs sessionStorage
  }
}

loadMockAdminSession();

export function resetMockAdminState(): void {
  currentAdminSession = null;
  loginFailuresByIdentifier.clear();
  internalNotesByRef.clear();
  if (typeof window !== 'undefined') {
    try {
      window.sessionStorage.removeItem(MOCK_ADMIN_SESSION_KEY);
    } catch {
      // Ignorer
    }
  }
}

function apiUrl(path: string): string {
  return `${env.apiBaseUrl}${path}`;
}

function adminDelay(): number {
  if (import.meta.env.MODE === 'test') {
    return 10;
  }
  return 180;
}

function normalizeAdminIdentifier(raw: string): string {
  const trimmed = raw.trim();
  if (isValidCmPhone(trimmed)) {
    return normalizeCmPhone(trimmed);
  }
  return trimmed.toLowerCase();
}

function findAdminAccount(identifier: string) {
  const normalized = normalizeAdminIdentifier(identifier);
  return DEMO_ADMIN_ACCOUNTS.find(
    (entry) =>
      entry.user.email.toLowerCase() === normalized || entry.user.phone === normalized,
  );
}

function requireAdminAuth(request: Request): Response | null {
  const authHeader = request.headers.get('Authorization') ?? '';
  if (!authHeader.startsWith(`Bearer ${MOCK_ADMIN_TOKEN_PREFIX}`)) {
    return HttpResponse.json(
      {
        code: 'UNAUTHORIZED',
        message: 'Session administrateur requise. Veuillez vous reconnecter.',
      },
      { status: 401 },
    );
  }
  return null;
}

function toAdminReservationRow(r: Reservation): AdminReservationRow {
  const itemsCount = r.items.reduce((sum, item) => sum + item.quantity, 0);
  const first = r.items[0];
  const firstItemSummary = first
    ? `${first.name} (${first.size} · ${first.colorName})${r.items.length > 1 ? ` +${r.items.length - 1}` : ''}`
    : 'Article';

  return {
    ref: r.ref,
    status: r.status,
    createdAt: r.createdAt,
    updatedAt: r.updatedAt,
    expiresAt: r.expiresAt,
    total: r.total,
    itemsCount,
    firstItemSummary,
    receptionMode: r.receptionMode,
    city: r.city ?? r.deliveryAddress?.city ?? r.agency?.city,
    customer: {
      firstName: r.customer?.firstName ?? 'Client',
      lastName: r.customer?.lastName,
      phone: r.customer?.phone ?? '+237690000001',
    },
    operator: r.proof?.operator,
    proofThumbnailUrl: r.proof?.thumbnailUrl,
    hasProof: Boolean(r.proof?.thumbnailUrl),
    hasPackagePhotos: (r.packagePhotos?.length ?? 0) > 0,
  };
}

function matchesTab(status: ReservationStatusCode, tab: AdminReservationsTab): boolean {
  switch (tab) {
    case 'to_validate':
      return status === 'pending_validation';
    case 'to_prepare':
      return status === 'confirmed' || status === 'preparing';
    case 'ready':
      return status === 'ready_for_pickup' || status === 'handed_to_agency';
    case 'in_delivery':
      return status === 'in_delivery';
    case 'attention':
      return status === 'reserved' || status === 'payment_rejected';
    case 'done':
      return isFinalStatus(status);
    case 'all':
    default:
      return true;
  }
}

function computeTabCounts(reservations: Reservation[]): AdminReservationsTabCounts {
  const counts: AdminReservationsTabCounts = {
    all: reservations.length,
    toValidate: 0,
    toPrepare: 0,
    ready: 0,
    inDelivery: 0,
    attention: 0,
    done: 0,
  };

  for (const r of reservations) {
    if (r.status === 'pending_validation') counts.toValidate += 1;
    else if (r.status === 'confirmed' || r.status === 'preparing') counts.toPrepare += 1;
    else if (r.status === 'ready_for_pickup' || r.status === 'handed_to_agency') counts.ready += 1;
    else if (r.status === 'in_delivery') counts.inDelivery += 1;
    else if (r.status === 'reserved' || r.status === 'payment_rejected') counts.attention += 1;
    else if (isFinalStatus(r.status)) counts.done += 1;
  }

  return counts;
}

function computePeriodKpis(
  allReservations: Reservation[],
  now: number,
  windowMs: number,
): AdminPeriodKpis {
  const cutoff = now - windowMs;
  const inPeriod = allReservations.filter(
    (r) => new Date(r.createdAt).getTime() >= cutoff,
  );
  const confirmedInPeriod = inPeriod.filter((r) => PAID_STATUSES.has(r.status));

  const revenueConfirmed = confirmedInPeriod.reduce((sum, r) => sum + r.total, 0);
  const reservationsCreated = inPeriod.length;
  const reservationsConfirmed = confirmedInPeriod.length;
  const conversionRate =
    reservationsCreated > 0
      ? Math.round((reservationsConfirmed / reservationsCreated) * 100)
      : 0;
  const averageBasket =
    reservationsConfirmed > 0 ? Math.round(revenueConfirmed / reservationsConfirmed) : 0;

  let orange = 0;
  let mtn = 0;
  let delivery = 0;
  let pickup = 0;

  for (const r of confirmedInPeriod) {
    if (r.proof?.operator === 'mtn') {
      mtn += 1;
    } else {
      orange += 1;
    }

    if (r.receptionMode === 'pickup') {
      pickup += 1;
    } else {
      delivery += 1;
    }
  }

  return {
    revenueConfirmed,
    reservationsCreated,
    reservationsConfirmed,
    conversionRate,
    averageBasket,
    byOperator: { orange, mtn },
    byReception: { delivery, pickup },
  };
}

function buildDashboardData(now: number = Date.now()): AdminDashboardData {
  const allReservations = Object.values(mockReservations);

  let pendingValidation = 0;
  let toPrepare = 0;
  let readyForHandover = 0;
  let expiringSoon = 0;
  let activeTotal = 0;

  for (const r of allReservations) {
    if (!isFinalStatus(r.status)) {
      activeTotal += 1;
    }
    if (r.status === 'pending_validation') {
      pendingValidation += 1;
    } else if (r.status === 'confirmed' || r.status === 'preparing') {
      toPrepare += 1;
    } else if (r.status === 'ready_for_pickup' || r.status === 'handed_to_agency') {
      readyForHandover += 1;
    }

    if (r.status === 'reserved' || r.status === 'payment_rejected') {
      const remainingMs = new Date(r.expiresAt).getTime() - now;
      if (remainingMs > 0 && remainingMs <= 3 * HOUR_MS) {
        expiringSoon += 1;
      }
    }
  }

  const urgentRank = (status: ReservationStatusCode): number => {
    if (status === 'pending_validation') return 1;
    if (status === 'confirmed') return 2;
    if (status === 'preparing') return 3;
    if (status === 'ready_for_pickup' || status === 'handed_to_agency') return 4;
    return 99;
  };

  const urgentReservations = allReservations
    .filter((r) => urgentRank(r.status) < 99)
    .sort((a, b) => {
      const rankDiff = urgentRank(a.status) - urgentRank(b.status);
      if (rankDiff !== 0) return rankDiff;
      return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
    })
    .slice(0, 5)
    .map(toAdminReservationRow);

  let lowStockVariants = 0;
  let outOfStockVariants = 0;
  const allLowStockItems: AdminLowStockItem[] = [];

  for (const product of mockProducts) {
    const colorByCode = new Map(product.colors.map((c) => [c.code, c]));
    for (const variant of product.variants) {
      if (variant.stock === 0) {
        outOfStockVariants += 1;
      } else if (variant.stock <= 2) {
        lowStockVariants += 1;
      }

      if (variant.stock <= 2) {
        const color = colorByCode.get(variant.colorCode) ?? product.colors[0];
        allLowStockItems.push({
          productId: product.id,
          slug: product.slug,
          name: product.name,
          image: product.images[0] ?? product.fallbackImages[0] ?? '/mock/product-tee.svg',
          variantId: variant.id,
          size: variant.size,
          colorName: color?.name ?? variant.colorCode,
          colorCode: variant.colorCode,
          colorHex: color?.hex ?? '#1A1A18',
          stock: variant.stock,
        });
      }
    }
  }

  allLowStockItems.sort((a, b) => {
    const order = (stock: number) => (stock === 1 ? 0 : stock === 0 ? 1 : 2);
    return order(a.stock) - order(b.stock);
  });

  const kpis: Record<AdminDashboardPeriod, AdminPeriodKpis> = {
    today: computePeriodKpis(allReservations, now, DAY_MS),
    '7d': computePeriodKpis(allReservations, now, 7 * DAY_MS),
    '30d': computePeriodKpis(allReservations, now, 30 * DAY_MS),
  };

  return {
    serverTime: new Date(now).toISOString(),
    counts: {
      pendingValidation,
      toPrepare,
      readyForHandover,
      expiringSoon,
      activeTotal,
      lowStockVariants,
      outOfStockVariants,
    },
    urgentReservations,
    kpis,
    lowStockItems: allLowStockItems.slice(0, 10),
  };
}

function normalizeQuery(input: string): string {
  return input
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

function restoreReservationStock(reservation: Reservation): void {
  for (const item of reservation.items) {
    const product = mockProducts.find(
      (p) => p.id === item.productId || p.slug === item.slug,
    );
    if (!product) continue;
    const variant = product.variants.find((v) => v.id === item.variantId);
    if (variant) {
      variant.stock += item.quantity;
    }
    const totalStock = product.variants.reduce((sum, v) => sum + v.stock, 0);
    product.badges = computeProductBadges(totalStock, product.isNew);
  }
}

function recomputeCategoriesProductCounts(): void {
  for (const cat of mockCategories) {
    const catProducts = mockProducts.filter((p) => p.categorySlug === cat.slug);
    cat.productCount = catProducts.length;
    for (const sub of cat.subCategories) {
      sub.productCount = catProducts.filter((p) => p.subCategorySlug === sub.slug).length;
    }
  }
}

function productTotalStock(product: Product): number {
  return product.variants.reduce((sum, v) => sum + v.stock, 0);
}

export const adminHandlers = [
  // POST /api/admin/auth/login
  http.post(apiUrl('/admin/auth/login'), async ({ request }) => {
    await delay(adminDelay());

    let body: Partial<AdminLoginPayload>;
    try {
      body = (await request.json()) as Partial<AdminLoginPayload>;
    } catch {
      return HttpResponse.json(
        { code: 'INVALID_PAYLOAD', message: 'Requête de connexion invalide.' },
        { status: 400 },
      );
    }

    const rawIdentifier = String(body.identifier ?? '').trim();
    const password = String(body.password ?? '');

    if (!rawIdentifier || !password) {
      return HttpResponse.json(
        {
          code: 'VALIDATION_ERROR',
          message: 'Veuillez renseigner votre identifiant et votre mot de passe.',
        },
        { status: 422 },
      );
    }

    const key = normalizeAdminIdentifier(rawIdentifier);
    const failures = loginFailuresByIdentifier.get(key) ?? 0;
    if (failures >= 5) {
      return HttpResponse.json(
        {
          code: 'TOO_MANY_ATTEMPTS',
          message: 'Trop de tentatives. Réessayez dans 15 minutes.',
        },
        { status: 429 },
      );
    }

    const match = findAdminAccount(rawIdentifier);
    if (!match || match.password !== password) {
      loginFailuresByIdentifier.set(key, failures + 1);
      return HttpResponse.json(
        {
          code: 'INVALID_CREDENTIALS',
          message: 'Identifiant ou mot de passe incorrect.',
        },
        { status: 401 },
      );
    }

    loginFailuresByIdentifier.delete(key);
    currentAdminSession = { ...match.user };
    persistMockAdminSession();

    const response: AdminAuthResponse = {
      accessToken: `${MOCK_ADMIN_TOKEN_PREFIX}${match.user.id}`,
      admin: currentAdminSession,
    };
    return HttpResponse.json(response);
  }),

  // POST /api/admin/auth/refresh
  http.post(apiUrl('/admin/auth/refresh'), async () => {
    await delay(adminDelay());
    if (!currentAdminSession) {
      return HttpResponse.json(
        {
          code: 'NO_ADMIN_SESSION',
          message: 'Aucune session administrateur active.',
        },
        { status: 401 },
      );
    }

    const response: AdminAuthResponse = {
      accessToken: `${MOCK_ADMIN_TOKEN_PREFIX}${currentAdminSession.id}`,
      admin: currentAdminSession,
    };
    return HttpResponse.json(response);
  }),

  // POST /api/admin/auth/logout
  http.post(apiUrl('/admin/auth/logout'), async () => {
    await delay(adminDelay());
    currentAdminSession = null;
    persistMockAdminSession();
    return new HttpResponse(null, { status: 204 });
  }),

  // GET /api/admin/dashboard
  http.get(apiUrl('/admin/dashboard'), async ({ request }) => {
    await delay(adminDelay());
    const authError = requireAdminAuth(request);
    if (authError) return authError;

    return HttpResponse.json(buildDashboardData());
  }),

  // GET /api/admin/search?q=
  http.get(apiUrl('/admin/search'), async ({ request }) => {
    await delay(adminDelay());
    const authError = requireAdminAuth(request);
    if (authError) return authError;

    const url = new URL(request.url);
    const rawQ = url.searchParams.get('q') ?? '';
    const q = normalizeQuery(rawQ);
    const digitsOnly = rawQ.replace(/\D/g, '');

    if (q.length < 2) {
      return HttpResponse.json({
        reservations: [],
        products: [],
      } satisfies AdminSearchResponse);
    }

    const reservations = Object.values(mockReservations)
      .filter((r) => {
        const refMatch = normalizeQuery(r.ref).includes(q);
        const nameMatch = normalizeQuery(
          `${r.customer?.firstName ?? ''} ${r.customer?.lastName ?? ''}`,
        ).includes(q);
        const cityMatch = normalizeQuery(r.city ?? '').includes(q);
        const phoneDigits = (r.customer?.phone ?? '').replace(/\D/g, '');
        const phoneMatch = digitsOnly.length >= 2 && phoneDigits.includes(digitsOnly);
        return refMatch || nameMatch || cityMatch || phoneMatch;
      })
      .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
      .slice(0, 6)
      .map(toAdminReservationRow);

    const products: AdminSearchProductItem[] = mockProducts
      .filter((p) => {
        return (
          normalizeQuery(p.name).includes(q) ||
          normalizeQuery(p.slug).includes(q) ||
          normalizeQuery(p.categorySlug).includes(q) ||
          normalizeQuery(p.subCategorySlug ?? '').includes(q)
        );
      })
      .slice(0, 6)
      .map((p) => ({
        id: p.id,
        slug: p.slug,
        name: p.name,
        image: p.images[0] ?? p.fallbackImages[0] ?? '/mock/product-tee.svg',
        price: p.price,
        totalStock: p.variants.reduce((sum, v) => sum + v.stock, 0),
        outOfStockCount: p.variants.filter((v) => v.stock === 0).length,
      }));

    return HttpResponse.json({
      reservations,
      products,
    } satisfies AdminSearchResponse);
  }),

  // ==========================================================================
  // Module A2 — Réservations, preuves Mobile Money et photos du colis
  // ==========================================================================

  // GET /api/admin/reservations
  http.get(apiUrl('/admin/reservations'), async ({ request }) => {
    await delay(adminDelay());
    const authError = requireAdminAuth(request);
    if (authError) return authError;

    const url = new URL(request.url);
    const tab = (url.searchParams.get('tab') as AdminReservationsTab | null) ?? 'all';
    const statusParam = url.searchParams.get('status') as ReservationStatusCode | null;
    const receptionMode = url.searchParams.get('receptionMode');
    const city = url.searchParams.get('city');
    const operator = url.searchParams.get('operator');
    const rawQ = url.searchParams.get('q') ?? '';
    const q = normalizeQuery(rawQ);
    const digitsOnly = rawQ.replace(/\D/g, '');
    const page = Math.max(1, Number(url.searchParams.get('page') ?? 1) || 1);
    const pageSize = Math.min(50, Math.max(1, Number(url.searchParams.get('pageSize') ?? 20) || 20));

    const allReservations = Object.values(mockReservations);
    const counts = computeTabCounts(allReservations);

    const filtered = allReservations.filter((r) => {
      if (statusParam) {
        if (r.status !== statusParam) return false;
      } else if (!matchesTab(r.status, tab)) {
        return false;
      }

      if (receptionMode && r.receptionMode !== receptionMode) {
        return false;
      }

      if (city) {
        const resCity = r.city ?? r.deliveryAddress?.city ?? r.agency?.city ?? '';
        if (normalizeQuery(resCity) !== normalizeQuery(city)) return false;
      }

      if (operator) {
        if ((r.proof?.operator ?? '') !== operator) return false;
      }

      if (q.length > 0) {
        const refMatch = normalizeQuery(r.ref).includes(q);
        const nameMatch = normalizeQuery(
          `${r.customer?.firstName ?? ''} ${r.customer?.lastName ?? ''}`,
        ).includes(q);
        const cityMatch = normalizeQuery(
          `${r.city ?? ''} ${r.deliveryAddress?.quarter ?? ''} ${r.agency?.name ?? ''}`,
        ).includes(q);
        const phoneDigits = (r.customer?.phone ?? '').replace(/\D/g, '');
        const phoneMatch = digitsOnly.length >= 2 && phoneDigits.includes(digitsOnly);
        if (!refMatch && !nameMatch && !cityMatch && !phoneMatch) {
          return false;
        }
      }

      return true;
    });

    // Tri opérationnel : les preuves à valider d'abord, puis par date de mise à jour décroissante
    filtered.sort((a, b) => {
      const aUrgent = a.status === 'pending_validation' ? 0 : 1;
      const bUrgent = b.status === 'pending_validation' ? 0 : 1;
      if (aUrgent !== bUrgent) return aUrgent - bUrgent;
      return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
    });

    const total = filtered.length;
    const totalPages = Math.max(1, Math.ceil(total / pageSize));
    const safePage = Math.min(page, totalPages);
    const start = (safePage - 1) * pageSize;
    const items = filtered.slice(start, start + pageSize).map(toAdminReservationRow);

    const response: AdminReservationsListResponse = {
      items,
      page: safePage,
      pageSize,
      total,
      totalPages,
      counts,
    };

    return HttpResponse.json(response);
  }),

  // GET /api/admin/reservations/:ref
  http.get(apiUrl('/admin/reservations/:ref'), async ({ params, request }) => {
    await delay(adminDelay());
    const authError = requireAdminAuth(request);
    if (authError) return authError;

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

    const serialized = serializeAdminReservation(reservation);
    const sha256 = serialized.proof?.sha256;
    const duplicateProofRefs: string[] = [];
    if (sha256) {
      for (const other of Object.values(mockReservations)) {
        if (other.ref !== ref && other.proof?.sha256 && other.proof.sha256 === sha256) {
          duplicateProofRefs.push(other.ref);
        }
      }
    }

    const response: AdminReservationDetailResponse = {
      reservation: serialized,
      duplicateProofRefs,
      internalNotes: internalNotesByRef.get(ref) ?? [],
      availableAgencies: mockAgencies,
    };

    return HttpResponse.json(response);
  }),

  // POST /api/admin/reservations/:ref/validate-payment
  http.post(
    apiUrl('/admin/reservations/:ref/validate-payment'),
    async ({ params, request }) => {
      await delay(adminDelay());
      const authError = requireAdminAuth(request);
      if (authError) return authError;

      const ref = String(params.ref ?? '').toUpperCase();
      const reservation = mockReservations[ref];
      if (!reservation) {
        return HttpResponse.json(
          { code: 'RESERVATION_NOT_FOUND', message: `Réservation ${ref} introuvable.` },
          { status: 404 },
        );
      }

      if (
        reservation.status !== 'pending_validation' &&
        reservation.status !== 'reserved' &&
        reservation.status !== 'payment_rejected'
      ) {
        return HttpResponse.json(
          {
            code: 'INVALID_STATUS',
            message: 'Le paiement de cette réservation a déjà été traité.',
          },
          { status: 422 },
        );
      }

      let note = 'Paiement validé par la boutique.';
      try {
        const body = (await request.json()) as AdminValidatePaymentPayload | null;
        if (body?.note?.trim()) {
          note = body.note.trim();
        }
      } catch {
        // Note par défaut
      }

      if (!reservation.proof) {
        const nowIso = new Date().toISOString();
        reservation.proof = {
          thumbnailUrl: '/mock/preuve-1.svg',
          uploadedAt: nowIso,
          operator: 'orange',
        };
      }

      pushAdminTimelineEvent(reservation, 'confirmed', note, 'shop');
      reservation.rejection = undefined;
      reservation.rejectionReason = undefined;

      commitAdminReservation(reservation);

      return HttpResponse.json({
        reservation: serializeAdminReservation(reservation),
      });
    },
  ),

  // POST /api/admin/reservations/:ref/reject-payment
  http.post(
    apiUrl('/admin/reservations/:ref/reject-payment'),
    async ({ params, request }) => {
      await delay(adminDelay());
      const authError = requireAdminAuth(request);
      if (authError) return authError;

      const ref = String(params.ref ?? '').toUpperCase();
      const reservation = mockReservations[ref];
      if (!reservation) {
        return HttpResponse.json(
          { code: 'RESERVATION_NOT_FOUND', message: `Réservation ${ref} introuvable.` },
          { status: 404 },
        );
      }

      let reason: string;
      try {
        const body = (await request.json()) as AdminRejectPaymentPayload | null;
        reason = String(body?.reason ?? '').trim();
      } catch {
        reason = '';
      }

      if (reason.length < 3 || reason.length > 200) {
        return HttpResponse.json(
          {
            code: 'VALIDATION_ERROR',
            message:
              'Veuillez préciser le motif du rejet (entre 3 et 200 caractères) pour informer le client.',
          },
          { status: 422 },
        );
      }

      const rejectedAt = pushAdminTimelineEvent(
        reservation,
        'payment_rejected',
        reason,
        'shop',
      );
      reservation.rejectionReason = reason;
      reservation.rejection = { reason, rejectedAt };

      commitAdminReservation(reservation);

      return HttpResponse.json({
        reservation: serializeAdminReservation(reservation),
      });
    },
  ),

  // POST /api/admin/reservations/:ref/status
  http.post(apiUrl('/admin/reservations/:ref/status'), async ({ params, request }) => {
    await delay(adminDelay());
    const authError = requireAdminAuth(request);
    if (authError) return authError;

    const ref = String(params.ref ?? '').toUpperCase();
    const reservation = mockReservations[ref];
    if (!reservation) {
      return HttpResponse.json(
        { code: 'RESERVATION_NOT_FOUND', message: `Réservation ${ref} introuvable.` },
        { status: 404 },
      );
    }

    let body: Partial<AdminAdvanceStatusPayload>;
    try {
      body = (await request.json()) as Partial<AdminAdvanceStatusPayload>;
    } catch {
      return HttpResponse.json(
        { code: 'INVALID_PAYLOAD', message: 'Requête de changement de statut invalide.' },
        { status: 400 },
      );
    }

    const nextStatus = body.status;
    if (!nextStatus) {
      return HttpResponse.json(
        { code: 'VALIDATION_ERROR', message: 'Statut cible manquant.' },
        { status: 422 },
      );
    }

    if (
      reservation.receptionMode === 'pickup' &&
      (nextStatus === 'handed_to_agency' ||
        nextStatus === 'in_delivery' ||
        nextStatus === 'delivered')
    ) {
      return HttpResponse.json(
        {
          code: 'INVALID_RECEPTION_MODE',
          message: 'Ce statut est réservé aux livraisons, pas aux retraits en boutique.',
        },
        { status: 422 },
      );
    }

    if (
      reservation.receptionMode === 'delivery' &&
      (nextStatus === 'ready_for_pickup' || nextStatus === 'picked_up')
    ) {
      return HttpResponse.json(
        {
          code: 'INVALID_RECEPTION_MODE',
          message: 'Ce statut est réservé aux retraits en boutique.',
        },
        { status: 422 },
      );
    }

    if (body.agencyId) {
      const ag = mockAgencies.find((a) => a.id === body.agencyId);
      if (ag) {
        reservation.agency = {
          id: ag.id,
          name: ag.name,
          address: ag.address,
          city: ag.city,
          phone: ag.phone,
          openingHours: ag.openingHours,
        };
        if (reservation.deliveryAddress) {
          reservation.deliveryAddress.agencyId = ag.id;
          reservation.deliveryAddress.agencyName = ag.name;
        }
      }
    }

    const note = body.note?.trim() || defaultAdminStepNote(reservation, nextStatus);
    pushAdminTimelineEvent(reservation, nextStatus, note, 'shop');

    commitAdminReservation(reservation);

    return HttpResponse.json({
      reservation: serializeAdminReservation(reservation),
    });
  }),

  // POST /api/admin/reservations/:ref/package-ready
  http.post(
    apiUrl('/admin/reservations/:ref/package-ready'),
    async ({ params, request }) => {
      await delay(adminDelay());
      const authError = requireAdminAuth(request);
      if (authError) return authError;

      const ref = String(params.ref ?? '').toUpperCase();
      const reservation = mockReservations[ref];
      if (!reservation) {
        return HttpResponse.json(
          { code: 'RESERVATION_NOT_FOUND', message: `Réservation ${ref} introuvable.` },
          { status: 404 },
        );
      }

      if (
        reservation.status !== 'confirmed' &&
        reservation.status !== 'preparing' &&
        reservation.status !== 'ready_for_pickup' &&
        reservation.status !== 'handed_to_agency'
      ) {
        return HttpResponse.json(
          {
            code: 'INVALID_STATUS',
            message:
              'Le colis ne peut être déclaré prêt qu’après la validation du paiement.',
          },
          { status: 422 },
        );
      }

      let rawPhotos: AdminPackagePhotoInput[] = [];
      let note: string | undefined;
      let agencyId: string | undefined;

      const contentType = (request.headers.get('content-type') ?? '').toLowerCase();
      if (contentType.includes('application/json')) {
        try {
          const body = (await request.json()) as Partial<AdminPackageReadyPayload>;
          if (Array.isArray(body.photos)) {
            rawPhotos = body.photos;
          }
          note = body.note?.trim() || undefined;
          agencyId = body.agencyId?.trim() || undefined;
        } catch {
          // Ignorer
        }
      } else {
        try {
          const formData = await request.formData();
          const files = formData.getAll('photos');
          rawPhotos = files.slice(0, 3).map((_, idx) => ({
            url: `/mock/colis-${(idx % 4) + 1}.svg`,
            thumbnailUrl: `/mock/colis-${(idx % 4) + 1}.svg`,
            width: 800,
            height: 1000,
          }));
          const rawNote = String(formData.get('note') ?? '').trim();
          if (rawNote) note = rawNote;
          const rawAgency = String(formData.get('agencyId') ?? '').trim();
          if (rawAgency) agencyId = rawAgency;
        } catch {
          // Ignorer
        }
      }

      if (rawPhotos.length < 1 || rawPhotos.length > 3) {
        return HttpResponse.json(
          {
            code: 'PHOTOS_REQUIRED',
            message: 'Veuillez joindre entre 1 et 3 photos du colis prêt.',
          },
          { status: 422 },
        );
      }

      if (agencyId) {
        const ag = mockAgencies.find((a) => a.id === agencyId);
        if (ag) {
          reservation.agency = {
            id: ag.id,
            name: ag.name,
            address: ag.address,
            city: ag.city,
            phone: ag.phone,
            openingHours: ag.openingHours,
          };
          if (reservation.deliveryAddress) {
            reservation.deliveryAddress.agencyId = ag.id;
            reservation.deliveryAddress.agencyName = ag.name;
          }
        }
      }

      if (reservation.status === 'confirmed') {
        pushAdminTimelineEvent(
          reservation,
          'preparing',
          'Préparation du colis démarrée en boutique.',
          'shop',
        );
      }

      const takenAt = new Date().toISOString();
      const packagePhotos: PackagePhoto[] = rawPhotos.map((p, index) => {
        if (p.url) {
          return {
            id: `pkg-${ref}-${index + 1}`,
            url: p.url,
            thumbnailUrl: p.thumbnailUrl ?? p.url,
            width: p.width || 800,
            height: p.height || 1000,
            takenAt,
          };
        }
        return buildPackagePhoto(
          ref,
          ((index % 4) + 1) as 1 | 2 | 3 | 4,
          takenAt,
        );
      });

      reservation.packagePhotos = packagePhotos;
      reservation.packageReadyAt = takenAt;

      const targetStatus: ReservationStatusCode =
        reservation.receptionMode === 'pickup' ? 'ready_for_pickup' : 'handed_to_agency';
      const stepNote = note || defaultAdminStepNote(reservation, targetStatus);
      pushAdminTimelineEvent(reservation, targetStatus, stepNote, 'shop');

      commitAdminReservation(reservation);

      return HttpResponse.json({
        reservation: serializeAdminReservation(reservation),
      });
    },
  ),

  // POST /api/admin/reservations/:ref/cancel
  http.post(apiUrl('/admin/reservations/:ref/cancel'), async ({ params, request }) => {
    await delay(adminDelay());
    const authError = requireAdminAuth(request);
    if (authError) return authError;

    const ref = String(params.ref ?? '').toUpperCase();
    const reservation = mockReservations[ref];
    if (!reservation) {
      return HttpResponse.json(
        { code: 'RESERVATION_NOT_FOUND', message: `Réservation ${ref} introuvable.` },
        { status: 404 },
      );
    }

    if (isFinalStatus(reservation.status)) {
      return HttpResponse.json(
        {
          code: 'ALREADY_FINAL',
          message: 'Cette réservation est déjà terminée et ne peut plus être annulée.',
        },
        { status: 409 },
      );
    }

    let reason: string;
    try {
      const body = (await request.json()) as AdminCancelReservationPayload | null;
      reason = String(body?.reason ?? '').trim();
    } catch {
      reason = '';
    }

    if (reason.length < 3) {
      return HttpResponse.json(
        {
          code: 'VALIDATION_ERROR',
          message: 'Veuillez indiquer le motif d’annulation (minimum 3 caractères).',
        },
        { status: 422 },
      );
    }

    restoreReservationStock(reservation);
    pushAdminTimelineEvent(reservation, 'cancelled', reason, 'shop');

    commitAdminReservation(reservation);

    return HttpResponse.json({
      reservation: serializeAdminReservation(reservation),
    });
  }),

  // POST /api/admin/reservations/:ref/notes
  http.post(apiUrl('/admin/reservations/:ref/notes'), async ({ params, request }) => {
    await delay(adminDelay());
    const authError = requireAdminAuth(request);
    if (authError) return authError;

    const ref = String(params.ref ?? '').toUpperCase();
    const reservation = mockReservations[ref];
    if (!reservation) {
      return HttpResponse.json(
        { code: 'RESERVATION_NOT_FOUND', message: `Réservation ${ref} introuvable.` },
        { status: 404 },
      );
    }

    let text: string;
    try {
      const body = (await request.json()) as AdminAddNotePayload | null;
      text = String(body?.text ?? '').trim();
    } catch {
      text = '';
    }

    if (text.length < 2) {
      return HttpResponse.json(
        {
          code: 'VALIDATION_ERROR',
          message: 'Veuillez saisir une note interne.',
        },
        { status: 422 },
      );
    }

    const existing = internalNotesByRef.get(ref) ?? [];
    const newNote: AdminInternalNote = {
      id: `note-${ref}-${existing.length + 1}`,
      author: currentAdminSession?.name ?? 'Équipe boutique',
      text,
      createdAt: new Date().toISOString(),
    };
    const updated = [...existing, newNote];
    internalNotesByRef.set(ref, updated);

    return HttpResponse.json({
      note: newNote,
      internalNotes: updated,
    });
  }),

  // ==========================================================================
  // Module A3 — Catalogue, stocks, variantes, catégories et looks
  // ==========================================================================

  // GET /api/admin/products
  http.get(apiUrl('/admin/products'), async ({ request }) => {
    await delay(adminDelay());
    const authError = requireAdminAuth(request);
    if (authError) return authError;

    const url = new URL(request.url);
    const q = normalizeQuery(url.searchParams.get('q') ?? '');
    const category = url.searchParams.get('category') ?? '';
    const stockStatus =
      (url.searchParams.get('stockStatus') as AdminProductStockStatus | null) ?? 'all';
    const sort =
      (url.searchParams.get('sort') as AdminProductSort | null) ?? 'newest';
    const page = Math.max(1, Number(url.searchParams.get('page') ?? 1) || 1);
    const pageSize = Math.min(50, Math.max(1, Number(url.searchParams.get('pageSize') ?? 24) || 24));

    let inStockProducts = 0;
    let lowStockProducts = 0;
    let outOfStockProducts = 0;

    for (const p of mockProducts) {
      const totalStock = productTotalStock(p);
      const hasZeroVariant = p.variants.some((v) => v.stock === 0);
      if (totalStock === 0) {
        outOfStockProducts += 1;
      } else if (totalStock <= 3 || hasZeroVariant) {
        lowStockProducts += 1;
      } else {
        inStockProducts += 1;
      }
    }

    const filtered = mockProducts.filter((p) => {
      if (category && p.categorySlug !== category) {
        return false;
      }

      const totalStock = productTotalStock(p);
      const hasLowVariant = p.variants.some((v) => v.stock > 0 && v.stock <= 2);
      const hasZeroVariant = p.variants.some((v) => v.stock === 0);

      if (stockStatus === 'out_of_stock' && totalStock > 0 && !hasZeroVariant) {
        return false;
      }
      if (stockStatus === 'low_stock' && !(totalStock > 0 && (totalStock <= 3 || hasLowVariant))) {
        return false;
      }
      if (stockStatus === 'in_stock' && totalStock === 0) {
        return false;
      }

      if (q.length > 0) {
        const match =
          normalizeQuery(p.name).includes(q) ||
          normalizeQuery(p.slug).includes(q) ||
          normalizeQuery(p.categorySlug).includes(q) ||
          normalizeQuery(p.subCategorySlug ?? '').includes(q);
        if (!match) return false;
      }

      return true;
    });

    filtered.sort((a, b) => {
      if (sort === 'name') {
        return a.name.localeCompare(b.name, 'fr');
      }
      if (sort === 'stock_asc') {
        return productTotalStock(a) - productTotalStock(b);
      }
      if (sort === 'price_asc') {
        return a.price - b.price;
      }
      if (sort === 'price_desc') {
        return b.price - a.price;
      }
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });

    const total = filtered.length;
    const totalPages = Math.max(1, Math.ceil(total / pageSize));
    const safePage = Math.min(page, totalPages);
    const start = (safePage - 1) * pageSize;
    const items = filtered.slice(start, start + pageSize);

    const response: AdminProductsListResponse = {
      items,
      page: safePage,
      pageSize,
      total,
      totalPages,
      summary: {
        totalProducts: mockProducts.length,
        inStockProducts,
        lowStockProducts,
        outOfStockProducts,
      },
    };

    return HttpResponse.json(response);
  }),

  // GET /api/admin/products/:id
  http.get(apiUrl('/admin/products/:id'), async ({ params, request }) => {
    await delay(adminDelay());
    const authError = requireAdminAuth(request);
    if (authError) return authError;

    const idOrSlug = String(params.id ?? '');
    const product = mockProducts.find(
      (p) => p.id === idOrSlug || p.slug === idOrSlug,
    );
    if (!product) {
      return HttpResponse.json(
        { code: 'PRODUCT_NOT_FOUND', message: `Article ${idOrSlug} introuvable.` },
        { status: 404 },
      );
    }

    return HttpResponse.json({ product });
  }),

  // POST /api/admin/products
  http.post(apiUrl('/admin/products'), async ({ request }) => {
    await delay(adminDelay());
    const authError = requireAdminAuth(request);
    if (authError) return authError;

    let body: Partial<AdminUpsertProductPayload>;
    try {
      body = (await request.json()) as Partial<AdminUpsertProductPayload>;
    } catch {
      return HttpResponse.json(
        { code: 'INVALID_PAYLOAD', message: 'Données du produit invalides.' },
        { status: 400 },
      );
    }

    const name = String(body.name ?? '').trim();
    const slug = String(body.slug ?? '')
      .trim()
      .toLowerCase();
    const price = Math.round(Number(body.price ?? 0));

    if (!name || !slug || price <= 0) {
      return HttpResponse.json(
        {
          code: 'VALIDATION_ERROR',
          message: 'Veuillez renseigner un nom, un slug et un prix valide en FCFA.',
        },
        { status: 422 },
      );
    }

    if (mockProducts.some((p) => p.slug === slug)) {
      return HttpResponse.json(
        {
          code: 'DUPLICATE_SLUG',
          message: `Un article utilise déjà le slug « ${slug} ».`,
        },
        { status: 409 },
      );
    }

    const newId = `prod-${String(mockProducts.length + 1).padStart(2, '0')}`;
    const colors =
      Array.isArray(body.colors) && body.colors.length > 0
        ? body.colors
        : [{ code: 'noir', name: 'Noir Charbon', hex: '#1A1A18' }];
    const sizes =
      Array.isArray(body.sizes) && body.sizes.length > 0 ? body.sizes : ['Unique'];

    const variants =
      Array.isArray(body.variants) && body.variants.length > 0
        ? body.variants.map((v) => ({
            id: `${newId}-${v.colorCode}-${v.size.toLowerCase()}`,
            size: v.size,
            colorCode: v.colorCode,
            stock: Math.max(0, Math.round(Number(v.stock) || 0)),
          }))
        : colors.flatMap((c) =>
            sizes.map((s) => ({
              id: `${newId}-${c.code}-${s.toLowerCase()}`,
              size: s,
              colorCode: c.code,
              stock: 3,
            })),
          );

    const mediaGallery =
      Array.isArray(body.mediaGallery) && body.mediaGallery.length > 0
        ? body.mediaGallery
        : colors.map((c) => ({
            url: '/images/products/hoodie-barbele-noir-1.webp',
            fallbackUrl: '/mock/product-hoodie.svg',
            colorCode: c.code,
            alt: `${name} — ${c.name}`,
          }));

    const totalStock = variants.reduce((sum, v) => sum + v.stock, 0);
    const isNew = Boolean(body.isNew ?? true);
    const badges = computeProductBadges(totalStock, isNew);

    const created: Product = {
      id: newId,
      slug,
      name,
      description: String(body.description ?? '').trim() || name,
      composition: String(body.composition ?? '').trim() || '100 % coton peigné',
      careInstructions:
        Array.isArray(body.careInstructions) && body.careInstructions.length > 0
          ? body.careInstructions
          : ['Lavage doux à 30 °C.'],
      sizeGuide: body.sizeGuide ?? {
        type: 'clothing',
        title: 'Guide des tailles',
        tip: 'Prenez votre taille habituelle.',
        headers: ['Taille', 'Tour de poitrine (cm)'],
        rows: sizes.map((s) => [s, '110 – 116']),
      },
      categorySlug: String(body.categorySlug ?? 'vetements'),
      subCategorySlug: body.subCategorySlug || undefined,
      price,
      images: mediaGallery.map((m) => m.url),
      fallbackImages: mediaGallery.map((m) => m.fallbackUrl || m.url),
      mediaGallery,
      colors,
      sizes,
      variants,
      isNew,
      reservationsCount: 0,
      badges,
      createdAt: new Date().toISOString(),
    };

    mockProducts.unshift(created);
    recomputeCategoriesProductCounts();

    return HttpResponse.json({ product: created }, { status: 201 });
  }),

  // PATCH /api/admin/products/:id
  http.patch(apiUrl('/admin/products/:id'), async ({ params, request }) => {
    await delay(adminDelay());
    const authError = requireAdminAuth(request);
    if (authError) return authError;

    const idOrSlug = String(params.id ?? '');
    const product = mockProducts.find(
      (p) => p.id === idOrSlug || p.slug === idOrSlug,
    );
    if (!product) {
      return HttpResponse.json(
        { code: 'PRODUCT_NOT_FOUND', message: `Article ${idOrSlug} introuvable.` },
        { status: 404 },
      );
    }

    let body: Partial<AdminUpsertProductPayload>;
    try {
      body = (await request.json()) as Partial<AdminUpsertProductPayload>;
    } catch {
      return HttpResponse.json(
        { code: 'INVALID_PAYLOAD', message: 'Données du produit invalides.' },
        { status: 400 },
      );
    }

    if (body.name !== undefined) product.name = String(body.name).trim();
    if (body.slug !== undefined) product.slug = String(body.slug).trim().toLowerCase();
    if (body.categorySlug !== undefined) product.categorySlug = String(body.categorySlug);
    if (body.subCategorySlug !== undefined) {
      product.subCategorySlug = body.subCategorySlug || undefined;
    }
    if (body.price !== undefined) product.price = Math.max(1, Math.round(Number(body.price)));
    if (body.isNew !== undefined) product.isNew = Boolean(body.isNew);
    if (body.description !== undefined) product.description = String(body.description);
    if (body.composition !== undefined) product.composition = String(body.composition);
    if (Array.isArray(body.careInstructions)) {
      product.careInstructions = body.careInstructions;
    }
    if (Array.isArray(body.colors) && body.colors.length > 0) {
      product.colors = body.colors;
    }
    if (Array.isArray(body.sizes) && body.sizes.length > 0) {
      product.sizes = body.sizes;
    }
    if (Array.isArray(body.variants) && body.variants.length > 0) {
      product.variants = body.variants.map((v) => ({
        id: v.id || `${product.id}-${v.colorCode}-${v.size.toLowerCase()}`,
        size: v.size,
        colorCode: v.colorCode,
        stock: Math.max(0, Math.round(Number(v.stock) || 0)),
      }));
    }
    if (Array.isArray(body.mediaGallery) && body.mediaGallery.length > 0) {
      product.mediaGallery = body.mediaGallery;
      product.images = body.mediaGallery.map((m) => m.url);
      product.fallbackImages = body.mediaGallery.map((m) => m.fallbackUrl || m.url);
    }
    if (body.sizeGuide) {
      product.sizeGuide = body.sizeGuide;
    }

    const totalStock = productTotalStock(product);
    product.badges = computeProductBadges(totalStock, product.isNew);
    recomputeCategoriesProductCounts();

    return HttpResponse.json({ product });
  }),

  // PATCH /api/admin/products/:id/stock
  http.patch(apiUrl('/admin/products/:id/stock'), async ({ params, request }) => {
    await delay(adminDelay());
    const authError = requireAdminAuth(request);
    if (authError) return authError;

    const idOrSlug = String(params.id ?? '');
    const product = mockProducts.find(
      (p) => p.id === idOrSlug || p.slug === idOrSlug,
    );
    if (!product) {
      return HttpResponse.json(
        { code: 'PRODUCT_NOT_FOUND', message: `Article ${idOrSlug} introuvable.` },
        { status: 404 },
      );
    }

    let body: Partial<AdminQuickStockPayload>;
    try {
      body = (await request.json()) as Partial<AdminQuickStockPayload>;
    } catch {
      return HttpResponse.json(
        { code: 'INVALID_PAYLOAD', message: 'Requête de stock invalide.' },
        { status: 400 },
      );
    }

    if (!Array.isArray(body.variants)) {
      return HttpResponse.json(
        { code: 'VALIDATION_ERROR', message: 'Liste des variantes manquante.' },
        { status: 422 },
      );
    }

    for (const update of body.variants) {
      const target = product.variants.find((v) => v.id === update.variantId);
      if (target) {
        target.stock = Math.max(0, Math.round(Number(update.stock) || 0));
      }
    }

    const totalStock = productTotalStock(product);
    product.badges = computeProductBadges(totalStock, product.isNew);

    return HttpResponse.json({ product });
  }),

  // DELETE /api/admin/products/:id
  http.delete(apiUrl('/admin/products/:id'), async ({ params, request }) => {
    await delay(adminDelay());
    const authError = requireAdminAuth(request);
    if (authError) return authError;

    const idOrSlug = String(params.id ?? '');
    const idx = mockProducts.findIndex(
      (p) => p.id === idOrSlug || p.slug === idOrSlug,
    );
    if (idx === -1) {
      return HttpResponse.json(
        { code: 'PRODUCT_NOT_FOUND', message: `Article ${idOrSlug} introuvable.` },
        { status: 404 },
      );
    }

    mockProducts.splice(idx, 1);
    recomputeCategoriesProductCounts();
    return new HttpResponse(null, { status: 204 });
  }),

  // GET /api/admin/categories
  http.get(apiUrl('/admin/categories'), async ({ request }) => {
    await delay(adminDelay());
    const authError = requireAdminAuth(request);
    if (authError) return authError;

    recomputeCategoriesProductCounts();
    return HttpResponse.json({
      categories: mockCategories,
    } satisfies AdminCategoriesResponse);
  }),

  // PATCH /api/admin/categories/:id
  http.patch(apiUrl('/admin/categories/:id'), async ({ params, request }) => {
    await delay(adminDelay());
    const authError = requireAdminAuth(request);
    if (authError) return authError;

    const idOrSlug = String(params.id ?? '');
    const cat = mockCategories.find(
      (c) => c.id === idOrSlug || c.slug === idOrSlug,
    );
    if (!cat) {
      return HttpResponse.json(
        { code: 'CATEGORY_NOT_FOUND', message: `Catégorie ${idOrSlug} introuvable.` },
        { status: 404 },
      );
    }

    let body: Partial<AdminUpdateCategoryPayload>;
    try {
      body = (await request.json()) as Partial<AdminUpdateCategoryPayload>;
    } catch {
      return HttpResponse.json(
        { code: 'INVALID_PAYLOAD', message: 'Données de catégorie invalides.' },
        { status: 400 },
      );
    }

    if (body.name !== undefined) cat.name = String(body.name).trim();
    if (body.description !== undefined) cat.description = String(body.description).trim();
    if (body.coverImage !== undefined) {
      cat.coverImage = String(body.coverImage).trim() || cat.coverImage;
    }
    if (Array.isArray(body.subCategories)) {
      cat.subCategories = body.subCategories;
    }

    recomputeCategoriesProductCounts();
    return HttpResponse.json({ category: cat, categories: mockCategories });
  }),

  // GET /api/admin/looks
  http.get(apiUrl('/admin/looks'), async ({ request }) => {
    await delay(adminDelay());
    const authError = requireAdminAuth(request);
    if (authError) return authError;

    return HttpResponse.json({ looks: mockLooks } satisfies AdminLooksResponse);
  }),

  // POST /api/admin/looks
  http.post(apiUrl('/admin/looks'), async ({ request }) => {
    await delay(adminDelay());
    const authError = requireAdminAuth(request);
    if (authError) return authError;

    let body: Partial<AdminUpsertLookPayload>;
    try {
      body = (await request.json()) as Partial<AdminUpsertLookPayload>;
    } catch {
      return HttpResponse.json(
        { code: 'INVALID_PAYLOAD', message: 'Données du look invalides.' },
        { status: 400 },
      );
    }

    const title = String(body.title ?? '').trim();
    if (!title) {
      return HttpResponse.json(
        { code: 'VALIDATION_ERROR', message: 'Veuillez donner un titre au look.' },
        { status: 422 },
      );
    }

    const newLook: LookbookItem = {
      id: `look-${Date.now()}`,
      title,
      subtitle: String(body.subtitle ?? '').trim() || 'Silhouette L’Incompris',
      image: String(body.image ?? '').trim() || '/images/looks/look-1.webp',
      fallback: String(body.fallback ?? '').trim() || '/images/fallback/mood-portrait.svg',
      productSlugs: Array.isArray(body.productSlugs) ? body.productSlugs : [],
    };

    mockLooks.push(newLook);
    return HttpResponse.json({ look: newLook, looks: mockLooks }, { status: 201 });
  }),

  // PATCH /api/admin/looks/:id
  http.patch(apiUrl('/admin/looks/:id'), async ({ params, request }) => {
    await delay(adminDelay());
    const authError = requireAdminAuth(request);
    if (authError) return authError;

    const id = String(params.id ?? '');
    const look = mockLooks.find((l) => l.id === id);
    if (!look) {
      return HttpResponse.json(
        { code: 'LOOK_NOT_FOUND', message: `Look ${id} introuvable.` },
        { status: 404 },
      );
    }

    let body: Partial<AdminUpsertLookPayload>;
    try {
      body = (await request.json()) as Partial<AdminUpsertLookPayload>;
    } catch {
      return HttpResponse.json(
        { code: 'INVALID_PAYLOAD', message: 'Données du look invalides.' },
        { status: 400 },
      );
    }

    if (body.title !== undefined) look.title = String(body.title).trim();
    if (body.subtitle !== undefined) look.subtitle = String(body.subtitle).trim();
    if (body.image !== undefined) look.image = String(body.image).trim();
    if (Array.isArray(body.productSlugs)) look.productSlugs = body.productSlugs;

    return HttpResponse.json({ look, looks: mockLooks });
  }),

  // DELETE /api/admin/looks/:id
  http.delete(apiUrl('/admin/looks/:id'), async ({ params, request }) => {
    await delay(adminDelay());
    const authError = requireAdminAuth(request);
    if (authError) return authError;

    const id = String(params.id ?? '');
    const idx = mockLooks.findIndex((l) => l.id === id);
    if (idx === -1) {
      return HttpResponse.json(
        { code: 'LOOK_NOT_FOUND', message: `Look ${id} introuvable.` },
        { status: 404 },
      );
    }

    mockLooks.splice(idx, 1);
    return new HttpResponse(null, { status: 204 });
  }),

  // ==========================================================================
  // Module A4 — Paramètres, Livraison/Agences, Contenus et Clients
  // ==========================================================================

  // GET /api/admin/settings
  http.get(apiUrl('/admin/settings'), async ({ request }) => {
    await delay(adminDelay());
    const authError = requireAdminAuth(request);
    if (authError) return authError;

    return HttpResponse.json({ settings: mockPublicSettings });
  }),

  // PATCH /api/admin/settings
  http.patch(apiUrl('/admin/settings'), async ({ request }) => {
    await delay(adminDelay());
    const authError = requireAdminAuth(request);
    if (authError) return authError;

    let body: AdminUpdateSettingsPayload;
    try {
      body = (await request.json()) as AdminUpdateSettingsPayload;
    } catch {
      return HttpResponse.json(
        { code: 'INVALID_PAYLOAD', message: 'Réglages invalides.' },
        { status: 400 },
      );
    }

    if (body.payment) {
      const enabledCount = body.payment.operators.filter((op) => op.enabled).length;
      if (enabledCount === 0) {
        return HttpResponse.json(
          {
            code: 'VALIDATION_ERROR',
            message: 'Au moins un opérateur Mobile Money doit rester actif.',
          },
          { status: 422 },
        );
      }

      mockPublicSettings.payment = {
        ...mockPublicSettings.payment,
        ...body.payment,
        operators: body.payment.operators.map((op) => ({
          ...op,
          merchantName: String(op.merchantName ?? '').trim(),
          merchantCode: String(op.merchantCode ?? '').trim(),
          ussdTemplate: op.ussdTemplate ? String(op.ussdTemplate).trim() : null,
          qrImageUrl: op.qrImageUrl ? String(op.qrImageUrl).trim() : null,
          steps: Array.isArray(op.steps)
            ? op.steps.map((s) => String(s).trim()).filter(Boolean)
            : [],
          enabled: Boolean(op.enabled),
        })),
      };

      // Synchronise le tableau legacy `operators` de PublicSettings
      mockPublicSettings.operators = mockPublicSettings.payment.operators.map((op) => ({
        code: op.id,
        name: op.id === 'orange' ? 'Orange Money' : 'MTN Mobile Money',
        merchantCode: op.merchantCode,
        ussdTemplate: op.ussdTemplate ?? '',
        accountName: op.merchantName,
        qrCodeUrl: op.qrImageUrl ?? undefined,
      }));
    }

    if (body.whatsappNumber !== undefined) {
      const rawPhone = String(body.whatsappNumber).trim();
      if (!isValidCmPhone(rawPhone)) {
        return HttpResponse.json(
          {
            code: 'VALIDATION_ERROR',
            message: 'Le numéro WhatsApp doit être un numéro camerounais valide (+237 6XX XX XX XX).',
          },
          { status: 422 },
        );
      }
      mockPublicSettings.whatsappNumber = normalizeCmPhone(rawPhone);
    }

    if (body.reservationHoldHours !== undefined) {
      const hours = Math.max(1, Math.min(72, Math.round(Number(body.reservationHoldHours) || 24)));
      mockPublicSettings.reservationHoldHours = hours;
      mockPublicSettings.reservationExpiryHours = hours;
    }

    if (body.deliveryFeePayment === 'upfront' || body.deliveryFeePayment === 'on_delivery') {
      mockPublicSettings.deliveryFeePayment = body.deliveryFeePayment;
    }

    if (body.shop) {
      mockPublicSettings.shop = {
        ...mockPublicSettings.shop,
        ...body.shop,
      };
    }

    if (body.pickupAddress) {
      mockPublicSettings.pickupAddress = {
        ...mockPublicSettings.pickupAddress,
        ...body.pickupAddress,
      };
    }

    return HttpResponse.json({ settings: mockPublicSettings });
  }),

  // GET /api/admin/delivery/cities
  http.get(apiUrl('/admin/delivery/cities'), async ({ request }) => {
    await delay(adminDelay());
    const authError = requireAdminAuth(request);
    if (authError) return authError;

    return HttpResponse.json({
      cities: mockDeliveryCities,
    } satisfies AdminDeliveryCitiesResponse);
  }),

  // POST /api/admin/delivery/cities
  http.post(apiUrl('/admin/delivery/cities'), async ({ request }) => {
    await delay(adminDelay());
    const authError = requireAdminAuth(request);
    if (authError) return authError;

    let body: Partial<AdminUpsertCityPayload>;
    try {
      body = (await request.json()) as Partial<AdminUpsertCityPayload>;
    } catch {
      return HttpResponse.json(
        { code: 'INVALID_PAYLOAD', message: 'Données de ville invalides.' },
        { status: 400 },
      );
    }

    const name = String(body.name ?? '').trim();
    if (!name) {
      return HttpResponse.json(
        { code: 'VALIDATION_ERROR', message: 'Le nom de la ville est obligatoire.' },
        { status: 422 },
      );
    }

    const slugCode = name
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .slice(0, 12);

    const newCity: DeliveryCity = {
      id: `city-${slugCode}-${Date.now().toString().slice(-3)}`,
      name,
      fee: Math.max(0, Math.round(Number(body.fee) || 0)),
      isLocal: Boolean(body.isLocal),
      hasAgencies: body.hasAgencies !== undefined ? Boolean(body.hasAgencies) : !body.isLocal,
      estimatedDelay: String(body.estimatedDelay ?? '').trim() || '1 à 3\u00A0jours',
    };

    mockDeliveryCities.push(newCity);
    return HttpResponse.json(
      { city: newCity, cities: mockDeliveryCities },
      { status: 201 },
    );
  }),

  // PATCH /api/admin/delivery/cities/:id
  http.patch(apiUrl('/admin/delivery/cities/:id'), async ({ params, request }) => {
    await delay(adminDelay());
    const authError = requireAdminAuth(request);
    if (authError) return authError;

    const id = String(params.id ?? '');
    const city = mockDeliveryCities.find((c) => c.id === id);
    if (!city) {
      return HttpResponse.json(
        { code: 'CITY_NOT_FOUND', message: `Ville ${id} introuvable.` },
        { status: 404 },
      );
    }

    let body: Partial<AdminUpsertCityPayload>;
    try {
      body = (await request.json()) as Partial<AdminUpsertCityPayload>;
    } catch {
      return HttpResponse.json(
        { code: 'INVALID_PAYLOAD', message: 'Données de ville invalides.' },
        { status: 400 },
      );
    }

    if (body.name !== undefined) city.name = String(body.name).trim();
    if (body.fee !== undefined) city.fee = Math.max(0, Math.round(Number(body.fee) || 0));
    if (body.isLocal !== undefined) city.isLocal = Boolean(body.isLocal);
    if (body.hasAgencies !== undefined) city.hasAgencies = Boolean(body.hasAgencies);
    if (body.estimatedDelay !== undefined) {
      city.estimatedDelay = String(body.estimatedDelay).trim();
    }

    // Met à jour le nom de ville dans les agences rattachées
    for (const ag of mockAgencies) {
      if (ag.cityId === city.id) {
        ag.city = city.name;
      }
    }

    return HttpResponse.json({ city, cities: mockDeliveryCities });
  }),

  // DELETE /api/admin/delivery/cities/:id
  http.delete(apiUrl('/admin/delivery/cities/:id'), async ({ params, request }) => {
    await delay(adminDelay());
    const authError = requireAdminAuth(request);
    if (authError) return authError;

    const id = String(params.id ?? '');
    const idx = mockDeliveryCities.findIndex((c) => c.id === id);
    if (idx === -1) {
      return HttpResponse.json(
        { code: 'CITY_NOT_FOUND', message: `Ville ${id} introuvable.` },
        { status: 404 },
      );
    }

    mockDeliveryCities.splice(idx, 1);
    return new HttpResponse(null, { status: 204 });
  }),

  // GET /api/admin/delivery/agencies
  http.get(apiUrl('/admin/delivery/agencies'), async ({ request }) => {
    await delay(adminDelay());
    const authError = requireAdminAuth(request);
    if (authError) return authError;

    return HttpResponse.json({
      agencies: mockAgencies,
    } satisfies AdminDeliveryAgenciesResponse);
  }),

  // POST /api/admin/delivery/agencies
  http.post(apiUrl('/admin/delivery/agencies'), async ({ request }) => {
    await delay(adminDelay());
    const authError = requireAdminAuth(request);
    if (authError) return authError;

    let body: Partial<AdminUpsertAgencyPayload>;
    try {
      body = (await request.json()) as Partial<AdminUpsertAgencyPayload>;
    } catch {
      return HttpResponse.json(
        { code: 'INVALID_PAYLOAD', message: 'Données d’agence invalides.' },
        { status: 400 },
      );
    }

    const name = String(body.name ?? '').trim();
    const cityId = String(body.cityId ?? '').trim();
    if (!name || !cityId) {
      return HttpResponse.json(
        {
          code: 'VALIDATION_ERROR',
          message: 'Le nom de l’agence et la ville sont obligatoires.',
        },
        { status: 422 },
      );
    }

    const cityObj = mockDeliveryCities.find((c) => c.id === cityId);
    const newAgency: Agency = {
      id: `ag-${Date.now().toString().slice(-5)}`,
      cityId,
      city: cityObj?.name ?? String(body.city ?? 'Ville'),
      name,
      address: String(body.address ?? '').trim() || 'Adresse agence',
      phone: String(body.phone ?? '').trim() || '+237 690 00 00 00',
      openingHours: String(body.openingHours ?? '').trim() || 'Tous les jours · 7\u00A0h à 20\u00A0h',
    };

    mockAgencies.push(newAgency);
    return HttpResponse.json(
      { agency: newAgency, agencies: mockAgencies },
      { status: 201 },
    );
  }),

  // PATCH /api/admin/delivery/agencies/:id
  http.patch(apiUrl('/admin/delivery/agencies/:id'), async ({ params, request }) => {
    await delay(adminDelay());
    const authError = requireAdminAuth(request);
    if (authError) return authError;

    const id = String(params.id ?? '');
    const agency = mockAgencies.find((a) => a.id === id);
    if (!agency) {
      return HttpResponse.json(
        { code: 'AGENCY_NOT_FOUND', message: `Agence ${id} introuvable.` },
        { status: 404 },
      );
    }

    let body: Partial<AdminUpsertAgencyPayload>;
    try {
      body = (await request.json()) as Partial<AdminUpsertAgencyPayload>;
    } catch {
      return HttpResponse.json(
        { code: 'INVALID_PAYLOAD', message: 'Données d’agence invalides.' },
        { status: 400 },
      );
    }

    if (body.name !== undefined) agency.name = String(body.name).trim();
    if (body.cityId !== undefined) {
      agency.cityId = String(body.cityId).trim();
      const cityObj = mockDeliveryCities.find((c) => c.id === agency.cityId);
      if (cityObj) agency.city = cityObj.name;
    }
    if (body.address !== undefined) agency.address = String(body.address).trim();
    if (body.phone !== undefined) agency.phone = String(body.phone).trim();
    if (body.openingHours !== undefined) {
      agency.openingHours = String(body.openingHours).trim();
    }

    return HttpResponse.json({ agency, agencies: mockAgencies });
  }),

  // DELETE /api/admin/delivery/agencies/:id
  http.delete(apiUrl('/admin/delivery/agencies/:id'), async ({ params, request }) => {
    await delay(adminDelay());
    const authError = requireAdminAuth(request);
    if (authError) return authError;

    const id = String(params.id ?? '');
    const idx = mockAgencies.findIndex((a) => a.id === id);
    if (idx === -1) {
      return HttpResponse.json(
        { code: 'AGENCY_NOT_FOUND', message: `Agence ${id} introuvable.` },
        { status: 404 },
      );
    }

    mockAgencies.splice(idx, 1);
    return new HttpResponse(null, { status: 204 });
  }),

  // GET /api/admin/pages
  http.get(apiUrl('/admin/pages'), async ({ request }) => {
    await delay(adminDelay());
    const authError = requireAdminAuth(request);
    if (authError) return authError;

    const extractPlaceholders = (text: string): string[] => {
      const matches = text.match(/\[À COMPLÉTER[^\]]*\]/gi);
      return matches ? [...matches] : [];
    };

    const resolveKind = (slug: string): 'legal' | 'help' | 'faq' => {
      if (slug === FAQ_SLUG) return 'faq';
      if (LEGAL_PAGES.some((p) => p.slug === slug)) return 'legal';
      if (HELP_PAGES.some((p) => p.slug === slug)) return 'help';
      return 'legal';
    };

    const pages: AdminContentPageSummary[] = Object.values(mockContentPages).map((p) => {
      const placeholders = extractPlaceholders(p.body);
      return {
        slug: p.slug,
        title: p.title,
        kind: resolveKind(p.slug),
        updatedAt: p.updatedAt,
        missingPlaceholdersCount: placeholders.length,
        placeholders,
      };
    });

    const totalMissingPlaceholders = pages.reduce(
      (sum, p) => sum + p.missingPlaceholdersCount,
      0,
    );

    return HttpResponse.json({
      pages,
      totalMissingPlaceholders,
    } satisfies AdminPagesListResponse);
  }),

  // GET /api/admin/pages/:slug
  http.get(apiUrl('/admin/pages/:slug'), async ({ params, request }) => {
    await delay(adminDelay());
    const authError = requireAdminAuth(request);
    if (authError) return authError;

    const slug = String(params.slug ?? '');
    const page = mockContentPages[slug];
    if (!page) {
      return HttpResponse.json(
        { code: 'PAGE_NOT_FOUND', message: `Page ${slug} introuvable.` },
        { status: 404 },
      );
    }

    const matches = page.body.match(/\[À COMPLÉTER[^\]]*\]/gi);
    const placeholders = matches ? [...matches] : [];

    return HttpResponse.json({
      slug: page.slug,
      title: page.title,
      body: page.body,
      updatedAt: page.updatedAt,
      missingPlaceholdersCount: placeholders.length,
      placeholders,
    } satisfies AdminContentPageDetail);
  }),

  // PATCH /api/admin/pages/:slug
  http.patch(apiUrl('/admin/pages/:slug'), async ({ params, request }) => {
    await delay(adminDelay());
    const authError = requireAdminAuth(request);
    if (authError) return authError;

    const slug = String(params.slug ?? '');
    const page = mockContentPages[slug];
    if (!page) {
      return HttpResponse.json(
        { code: 'PAGE_NOT_FOUND', message: `Page ${slug} introuvable.` },
        { status: 404 },
      );
    }

    let body: Partial<AdminUpdatePagePayload>;
    try {
      body = (await request.json()) as Partial<AdminUpdatePagePayload>;
    } catch {
      return HttpResponse.json(
        { code: 'INVALID_PAYLOAD', message: 'Contenu de page invalide.' },
        { status: 400 },
      );
    }

    const nextTitle = frenchSpacing(String(body.title ?? page.title).trim());
    const nextBody = frenchSpacing(String(body.body ?? page.body).trim());
    const updatedAt = new Date().toISOString();

    mockContentPages[slug] = {
      slug,
      title: nextTitle,
      body: nextBody,
      updatedAt,
    };

    const matches = nextBody.match(/\[À COMPLÉTER[^\]]*\]/gi);
    const placeholders = matches ? [...matches] : [];

    return HttpResponse.json({
      slug,
      title: nextTitle,
      body: nextBody,
      updatedAt,
      missingPlaceholdersCount: placeholders.length,
      placeholders,
    } satisfies AdminContentPageDetail);
  }),

  // GET /api/admin/customers
  http.get(apiUrl('/admin/customers'), async ({ request }) => {
    await delay(adminDelay());
    const authError = requireAdminAuth(request);
    if (authError) return authError;

    const url = new URL(request.url);
    const q = (url.searchParams.get('q') ?? '').trim().toLowerCase();

    const byPhone = new Map<string, AdminCustomerItem>();

    // Initialise Junior (client principal de démo)
    byPhone.set(JUNIOR_CUSTOMER.phone, {
      id: 'cust-junior-01',
      phone: JUNIOR_CUSTOMER.phone,
      firstName: JUNIOR_CUSTOMER.firstName,
      lastName: JUNIOR_CUSTOMER.lastName,
      fullName: `${JUNIOR_CUSTOMER.firstName} ${JUNIOR_CUSTOMER.lastName}`.trim(),
      city: 'Douala',
      reservationsCount: 0,
      confirmedTotalFcfa: 0,
      lastActivityAt: '2026-09-15T10:00:00.000Z',
      addresses: mockJuniorAddresses,
      reservations: [],
    });

    for (const res of Object.values(mockReservations)) {
      const phone = res.customer?.phone ?? JUNIOR_CUSTOMER.phone;
      const firstName = res.customer?.firstName ?? 'Client';
      const lastName = res.customer?.lastName ?? '';
      const fullName = `${firstName} ${lastName}`.trim();
      const city = res.city ?? res.deliveryAddress?.city ?? 'Douala';

      let entry = byPhone.get(phone);
      if (!entry) {
        entry = {
          id: `cust-${phone.replace(/\D/g, '').slice(-6)}`,
          phone,
          firstName,
          lastName,
          fullName,
          city,
          reservationsCount: 0,
          confirmedTotalFcfa: 0,
          lastActivityAt: res.updatedAt,
          addresses: res.deliveryAddress
            ? [
                {
                  id: `addr-${res.ref}`,
                  label: 'Adresse de livraison',
                  city: res.deliveryAddress.city,
                  district: res.deliveryAddress.quarter,
                  quarter: res.deliveryAddress.quarter,
                  landmark: res.deliveryAddress.landmark ?? '',
                  receptionMode: res.receptionMode,
                  agencyId: res.deliveryAddress.agencyId,
                  recipientName: res.deliveryAddress.recipientName,
                  recipientPhone: res.deliveryAddress.recipientPhone,
                  isDefault: true,
                },
              ]
            : [],
          reservations: [],
        };
        byPhone.set(phone, entry);
      }

      entry.reservationsCount += 1;
      if (PAID_STATUSES.has(res.status)) {
        entry.confirmedTotalFcfa += res.total;
      }
      if (new Date(res.updatedAt).getTime() > new Date(entry.lastActivityAt).getTime()) {
        entry.lastActivityAt = res.updatedAt;
      }
      entry.reservations.push(toAdminReservationRow(res));
    }

    let items = [...byPhone.values()].map((item) => ({
      ...item,
      reservations: item.reservations.sort(
        (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime(),
      ),
    }));

    if (q) {
      const qDigits = q.replace(/\D/g, '');
      items = items.filter(
        (c) =>
          c.fullName.toLowerCase().includes(q) ||
          c.city.toLowerCase().includes(q) ||
          c.phone.toLowerCase().includes(q) ||
          (qDigits.length > 0 && c.phone.replace(/\D/g, '').includes(qDigits)),
      );
    }

    items.sort(
      (a, b) =>
        new Date(b.lastActivityAt).getTime() - new Date(a.lastActivityAt).getTime(),
    );

    return HttpResponse.json({
      items,
      total: items.length,
    } satisfies AdminCustomersListResponse);
  }),
];
