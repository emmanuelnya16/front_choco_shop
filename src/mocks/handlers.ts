import { delay, http, HttpResponse } from 'msw';
import { env } from '@/lib/env';
import { normalizeCmPhone } from '@/lib/utils/phone';
import type {
  CartValidatePayload,
  CartValidationItemResult,
  CreateReservationPayload,
  OtpRequestPayload,
  OtpVerifyPayload,
  PriceRangeKey,
  ProductFacets,
  ReservationCreated,
  SaveAddressPayload,
  UpdateProfilePayload,
} from '@/types/api';
import type { Address, Product, User } from '@/types/domain';
import { mockCategories } from './fixtures/categories';
import { mockLooks } from './fixtures/looks';
import { mockProducts, mockReservations } from './fixtures/products';
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

const MOCK_RESERVATIONS_SESSION_KEY = 'drc_mock_reservations_v1';

function loadSessionReservations(): void {
  if (typeof window === 'undefined' || import.meta.env.MODE === 'test') return;
  try {
    const raw = window.sessionStorage.getItem(MOCK_RESERVATIONS_SESSION_KEY);
    if (!raw) return;
    const parsed = JSON.parse(raw) as Record<string, ReservationCreated>;
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

export function resetMockM3State(): void {
  otpTrackByPhone.clear();
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
  // Supprime les réservations créées dynamiquement (>= RES-000124)
  for (const key of Object.keys(mockReservations)) {
    const num = Number(key.replace('RES-', ''));
    if (Number.isFinite(num) && num >= 124) {
      delete mockReservations[key];
    }
  }
  // Réinitialise RES-000101 (réservation en attente de paiement)
  if (mockReservations['RES-000101']) {
    mockReservations['RES-000101'].status = 'reserved';
    mockReservations['RES-000101'].expiresAt = new Date(
      Date.now() + 24 * 3600 * 1000,
    ).toISOString();
    mockReservations['RES-000101'].proof = undefined;
    mockReservations['RES-000101'].rejection = undefined;
    mockReservations['RES-000101'].rejectionReason = undefined;
  }
  // Réinitialise RES-000103 pour les tests de rejet
  if (mockReservations['RES-000103']) {
    mockReservations['RES-000103'].status = 'payment_rejected';
    mockReservations['RES-000103'].expiresAt = new Date(
      Date.now() + 18 * 3600 * 1000,
    ).toISOString();
    mockReservations['RES-000103'].rejection = {
      reason:
        "La capture d'écran envoyée est floue et ne laisse pas apparaître l'identifiant de transaction Mobile Money.",
      rejectedAt: '2026-10-29T08:40:00.000Z',
    };
  }
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
      agencyId: body.agencyId,
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

  // GET /reservations (§3.1, §7.4 M3 & §7.2 M4)
  http.get(apiUrl('/reservations'), async ({ request }) => {
    await delay(randomMobileLatency());
    const url = new URL(request.url);
    const statusFilter = url.searchParams.get('status')?.trim();
    const all = Object.values(mockReservations).sort(
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
        phone: body.phone ?? currentSessionUser?.phone ?? '+237690000001',
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
      timeline: [
        {
          status: 'reserved',
          timestamp: serverTime,
          completed: true,
          current: true,
          note: 'Articles bloqués pendant 24 h. En attente du paiement Mobile Money.',
        },
        {
          status: 'pending_validation',
          timestamp: null,
          completed: false,
          current: false,
        },
        {
          status: 'confirmed',
          timestamp: null,
          completed: false,
          current: false,
        },
      ],
    };

    mockReservations[ref] = created;
    persistSessionReservations();
    if (idempotencyKey) {
      idempotencyCache.set(idempotencyKey, created);
    }

    return HttpResponse.json(created, { status: 201 });
  }),

  // GET /reservations/:ref
  http.get(apiUrl('/reservations/:ref'), async ({ params }) => {
    await delay(randomMobileLatency());
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

    const nowIso = new Date().toISOString();
    return HttpResponse.json({
      ...reservation,
      serverTime: nowIso,
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
              district:
                reservation.deliveryAddress.district ??
                reservation.deliveryAddress.quarter,
              landmark: reservation.deliveryAddress.landmark,
            }
          : undefined),
      agency:
        reservation.agency ??
        (reservation.deliveryAddress?.agencyName
          ? {
              id: reservation.deliveryAddress.agencyId,
              name: reservation.deliveryAddress.agencyName,
            }
          : undefined),
      rejection:
        reservation.rejection ??
        (reservation.rejectionReason
          ? {
              reason: reservation.rejectionReason,
              rejectedAt: reservation.createdAt,
            }
          : undefined),
    });
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
      reservation.status = 'expired';
      persistSessionReservations();
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

    const uploadedAt = new Date().toISOString();
    const proof = {
      thumbnailUrl: '/mock/colis-1.svg',
      uploadedAt,
      sha256: sha256 || undefined,
      operator,
      payerPhone,
      transactionId,
    };

    reservation.status = 'pending_validation';
    reservation.proof = proof;
    reservation.rejection = undefined;
    reservation.rejectionReason = undefined;
    reservation.timeline = [
      {
        status: 'reserved',
        timestamp: reservation.createdAt,
        completed: true,
        current: false,
      },
      {
        status: 'pending_validation',
        timestamp: uploadedAt,
        completed: true,
        current: true,
        note: 'Preuve de paiement reçue. Vérification en cours par la boutique.',
      },
      {
        status: 'confirmed',
        timestamp: null,
        completed: false,
        current: false,
      },
    ];

    persistSessionReservations();

    return HttpResponse.json({
      status: 'pending_validation' as const,
      proof,
      reservation,
    });
  }),

  // POST /reservations/:ref/cancel (§3.2 & §4.1 M4)
  http.post(apiUrl('/reservations/:ref/cancel'), async ({ params }) => {
    await delay(randomMobileLatency());
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

    const nowIso = new Date().toISOString();
    reservation.status = 'cancelled';
    reservation.timeline = [
      ...reservation.timeline.map((step) => ({ ...step, current: false })),
      {
        status: 'cancelled',
        timestamp: nowIso,
        completed: true,
        current: true,
        note: 'Réservation annulée à la demande du client.',
      },
    ];

    persistSessionReservations();

    return HttpResponse.json({
      status: 'cancelled' as const,
      reservation,
    });
  }),

  // ==========================================================================
  // Outils de simulation boutique (mocks uniquement, §3.3 M4)
  // ==========================================================================

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

    const nowIso = new Date().toISOString();
    reservation.status = 'confirmed';
    reservation.rejection = undefined;
    reservation.rejectionReason = undefined;
    reservation.timeline = [
      {
        status: 'reserved',
        timestamp: reservation.createdAt,
        completed: true,
        current: false,
      },
      {
        status: 'pending_validation',
        timestamp: reservation.proof?.uploadedAt ?? nowIso,
        completed: true,
        current: false,
      },
      {
        status: 'confirmed',
        timestamp: nowIso,
        completed: true,
        current: true,
        note: 'Paiement Mobile Money validé par la boutique DR Choco.',
      },
    ];

    persistSessionReservations();
    return HttpResponse.json(reservation);
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

      const nowIso = new Date().toISOString();
      reservation.status = 'payment_rejected';
      reservation.rejectionReason = reason;
      reservation.rejection = {
        reason,
        rejectedAt: nowIso,
      };
      if (!reservation.proof) {
        reservation.proof = {
          thumbnailUrl: '/mock/colis-1.svg',
          uploadedAt: nowIso,
        };
      }
      reservation.timeline = [
        {
          status: 'reserved',
          timestamp: reservation.createdAt,
          completed: true,
          current: false,
        },
        {
          status: 'payment_rejected',
          timestamp: nowIso,
          completed: false,
          current: true,
          note: reason,
        },
      ];

      persistSessionReservations();
      return HttpResponse.json(reservation);
    },
  ),

  // POST /_mock/reservations/:ref/expire-soon
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
      reservation.status = 'reserved';
      reservation.serverTime = new Date(now).toISOString();
      reservation.expiresAt = new Date(now + 2 * 60 * 1000).toISOString();

      persistSessionReservations();
      return HttpResponse.json(reservation);
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
    reservation.status = 'expired';
    reservation.serverTime = new Date(now).toISOString();
    reservation.expiresAt = new Date(now - 1000).toISOString();
    reservation.timeline = [
      ...reservation.timeline.map((s) => ({ ...s, current: false })),
      {
        status: 'expired',
        timestamp: new Date(now).toISOString(),
        completed: true,
        current: true,
        note: 'Le délai de 24 h est dépassé. Les articles ont été remis en vente.',
      },
    ];

    persistSessionReservations();
    return HttpResponse.json(reservation);
  }),
];

