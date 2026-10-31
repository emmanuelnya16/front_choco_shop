import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { api, setContractCheck } from '@/lib/api/client';
import { checkContract, findContract, resetContractWarnings, validateResponse } from '@/lib/api/contract';
import { RESERVATION_STATUSES } from '@/lib/api/schemas';
import { env } from '@/lib/env';
import { reportError } from '@/lib/monitoring';
import { mockProducts } from '@/mocks/fixtures/products';
import { JUNIOR_CUSTOMER, mockReservations } from '@/mocks/fixtures/reservations';
import { mockPublicSettings } from '@/mocks/fixtures/settings';
import { handlers, resetMockM3State } from '@/mocks/handlers';
import { useAuthStore } from '@/stores/authStore';
import { STATUS_META } from '@/types/reservationStatus';

vi.mock('@/lib/monitoring', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/monitoring')>()),
  reportError: vi.fn(),
}));

const server = setupServer(...handlers);
const MISSING_EXPIRES_AT = '[Contrat API] /reservations/RES-000124 : champ "expiresAt" manquant';

async function call(method: 'GET' | 'POST', path: string, body?: unknown): Promise<unknown> {
  const response = await fetch(`${env.apiBaseUrl}${path}`, {
    method,
    headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  expect(response.ok, `${method} ${path} → ${response.status}`).toBe(true);
  return response.json();
}

/** Valide une réponse des mocks et renvoie ses écarts (liste vide attendue). */
async function issuesOf(method: 'GET' | 'POST', path: string, body?: unknown): Promise<string[] | null> {
  return validateResponse(method, path, await call(method, path, body));
}

const juniorRefs = Object.values(mockReservations)
  .filter((reservation) => (reservation.customer?.phone ?? JUNIOR_CUSTOMER.phone) === JUNIOR_CUSTOMER.phone)
  .map((reservation) => reservation.ref);

beforeAll(() => {
  server.listen({ onUnhandledFrame: 'bypass' });
});

beforeEach(() => {
  resetMockM3State();
  resetContractWarnings();
  setContractCheck(null);
  useAuthStore.getState().clearSession();
  vi.mocked(reportError).mockClear();
});

afterEach(() => {
  server.resetHandlers();
  vi.restoreAllMocks();
});

afterAll(() => {
  setContractCheck(null);
  server.close();
});

// ---------------------------------------------------------------------------
// 1. Toutes les réponses actuelles des mocks respectent les schémas
// ---------------------------------------------------------------------------
describe('M7 §5.3 · les réponses des mocks respectent le contrat', () => {
  it('fiche produit : chacun des produits des mocks', async () => {
    expect(mockProducts.length).toBeGreaterThan(20);
    for (const product of mockProducts) {
      expect(await issuesOf('GET', `/products/${product.slug}`), product.slug).toEqual([]);
    }
  });

  it('liste de produits : pages, catégories, filtres et tris', async () => {
    const paths = [
      '/products',
      '/products?page=2',
      '/products?category=vetements',
      '/products?category=chaussures&sort=price_asc',
      '/products?category=babouches&available=1&pageSize=50',
      '/products?q=hoodie',
      '/products?size=M&size=L&sort=newest',
      '/products?q=introuvable-xyz',
    ];
    for (const path of paths) {
      expect(await issuesOf('GET', path), path).toEqual([]);
    }
  });

  it('réservation (détail) : toutes les réservations du client, et toutes les données brutes des mocks', async () => {
    expect(juniorRefs.length).toBeGreaterThan(15);
    for (const ref of juniorRefs) {
      expect(await issuesOf('GET', `/reservations/${ref}`), ref).toEqual([]);
    }
    for (const reservation of Object.values(mockReservations)) {
      expect(validateResponse('GET', `/reservations/${reservation.ref}`, reservation), reservation.ref).toEqual([]);
    }
  });

  it('listes de réservations : onglets paginés, liste complète, en attente de paiement et résumé', async () => {
    for (const path of [
      '/reservations?scope=active&page=1',
      '/reservations?scope=done&page=1',
      '/reservations?scope=done&page=2',
      '/reservations',
      '/reservations?status=reserved',
      '/reservations/summary',
    ]) {
      expect(await issuesOf('GET', path), path).toEqual([]);
    }
  });

  it('réservation créée (POST /reservations), retrait en boutique comme livraison', async () => {
    const product = mockProducts.find((item) => item.variants.some((variant) => variant.stock > 1))!;
    const variant = product.variants.find((item) => item.stock > 1)!;
    const items = [{ productId: product.id, variantId: variant.id, quantity: 1 }];
    expect(
      await issuesOf('POST', '/reservations', {
        receptionMode: 'pickup',
        items,
        firstName: 'Junior',
        lastName: 'Mbarga',
        phone: '690000001',
      }),
    ).toEqual([]);
    expect(
      await issuesOf('POST', '/reservations', {
        receptionMode: 'delivery',
        items,
        firstName: 'Junior',
        lastName: 'Mbarga',
        phone: '690000001',
        city: 'Douala',
        district: 'Bonamoussadi',
        landmark: 'Carrefour',
        recipientType: 'self',
      }),
    ).toEqual([]);
  });

  it('paramètres publics', async () => {
    expect(await issuesOf('GET', '/settings/public')).toEqual([]);
    expect(validateResponse('GET', '/settings/public', mockPublicSettings)).toEqual([]);
  });

  it('session : vérification du code (client connu et nouveau client), rafraîchissement et profil', async () => {
    expect(await issuesOf('POST', '/auth/otp/verify', { phone: '+237690000001', code: '123456' })).toEqual([]);
    expect(await issuesOf('POST', '/auth/refresh')).toEqual([]);
    expect(await issuesOf('GET', '/me')).toEqual([]);
    expect(await issuesOf('POST', '/auth/otp/verify', { phone: '+237699112233', code: '123456' })).toEqual([]);
    expect(await issuesOf('GET', '/me')).toEqual([]);
  });

  it('les statuts du schéma sont exactement ceux de l’app', () => {
    expect([...RESERVATION_STATUSES].sort()).toEqual(Object.keys(STATUS_META).sort());
  });
});

// ---------------------------------------------------------------------------
// 2. Registre
// ---------------------------------------------------------------------------
describe('M7 §5.3 · registre des routes', () => {
  it('associe méthode et motif de chemin au bon schéma', () => {
    expect(findContract('GET', '/products/hoodie-barbele-noir')?.pattern).toBe('/products/:slug');
    expect(findContract('GET', '/products?category=vetements')?.pattern).toBe('/products');
    expect(findContract('GET', '/reservations/summary')?.pattern).toBe('/reservations/summary');
    expect(findContract('GET', '/reservations/RES-000124')?.pattern).toBe('/reservations/:ref');
    expect(findContract('get', `${env.apiBaseUrl}/settings/public`)?.pattern).toBe('/settings/public');
    expect(findContract('GET', '/reservations?scope=active&page=1')?.when).toBeTypeOf('function');
    expect(findContract('GET', '/reservations?status=reserved')?.when).toBeUndefined();
    // Routes sans schéma : jamais contrôlées
    expect(findContract('POST', '/reservations/RES-000124/proof')).toBeUndefined();
    expect(findContract('GET', '/categories')).toBeUndefined();
    expect(findContract('POST', '/products')).toBeUndefined();
    expect(validateResponse('GET', '/categories', { anything: true })).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// 3. Écarts : avertissement en développement, remontée en production, donnée intacte
// ---------------------------------------------------------------------------
describe('M7 §5.3 · écarts du contrat', () => {
  async function reservationWithoutExpiresAt(): Promise<Record<string, unknown>> {
    const created = (await call('POST', '/reservations', {
      receptionMode: 'pickup',
      items: [{ productId: 'prod-01', variantId: 'prod-01-noir-s', quantity: 1 }],
    })) as Record<string, unknown>;
    expect(created.ref).toBe('RES-000124');
    const { expiresAt: _omitted, ...rest } = created;
    void _omitted;
    return rest;
  }

  it('en développement : exactement « [Contrat API] /reservations/RES-000124 : champ "expiresAt" manquant »', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const data = await reservationWithoutExpiresAt();
    const snapshot = structuredClone(data);

    const result = checkContract('GET', '/reservations/RES-000124', data, { stage: 'development' });

    expect(warn).toHaveBeenCalledTimes(1);
    expect(warn).toHaveBeenCalledWith(MISSING_EXPIRES_AT);
    expect(result).toBe(data);
    expect(data).toEqual(snapshot);
    expect(reportError).not.toHaveBeenCalled();
  });

  it('en préproduction aussi : avertissement dans la console, une ligne par écart, chemin en notation pointée', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const data = await reservationWithoutExpiresAt();
    const items = data.items as Array<Record<string, unknown>>;
    const broken = {
      ...data,
      status: 'en_route',
      items: [{ ...items[0], unitPrice: '45000' }],
    };

    checkContract('GET', '/reservations/RES-000124', broken, { stage: 'preproduction' });

    expect(warn.mock.calls.map(([line]) => line)).toEqual([
      '[Contrat API] /reservations/RES-000124 : champ "status" : attendu "reserved" | "pending_validation" | "payment_rejected" | "confirmed" | "preparing" | "handed_to_agency" | "ready_for_pickup" | "in_delivery" | "delivered" | "picked_up" | "expired" | "cancelled", reçu "en_route"',
      '[Contrat API] /reservations/RES-000124 : champ "items.0.unitPrice" : attendu number, reçu string',
      MISSING_EXPIRES_AT,
    ]);
  });

  it('en production : reportError (zone api-contract) sans la donnée, et la donnée est renvoyée intacte', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const data = { ...(await reservationWithoutExpiresAt()), status: 'en_route' };
    const snapshot = structuredClone(data);

    const result = checkContract('GET', '/reservations/RES-000124', data, { stage: 'production' });

    expect(result).toBe(data);
    expect(data).toEqual(snapshot);
    expect(warn).not.toHaveBeenCalled();
    expect(reportError).toHaveBeenCalledTimes(1);
    const [error, context] = vi.mocked(reportError).mock.calls[0];
    expect(context).toMatchObject({
      zone: 'api-contract',
      route: '/reservations/:ref',
      extra: { endpoint: 'GET /reservations/:ref', issues: 2 },
    });
    const message = (error as Error).message;
    expect(message).toContain('champ "expiresAt" manquant');
    expect(message).toContain('champ "status" : attendu');
    // Ni la valeur reçue, ni la référence, ni le client
    expect(message).not.toMatch(/en_route|RES-000124|\+237|Junior/);
  });

  it('par le client de l’API : la réponse arrive sans attendre et l’avertissement suit (contrôle demandé en test)', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const broken = await reservationWithoutExpiresAt();
    server.use(http.get(`${env.apiBaseUrl}/reservations/:ref`, () => HttpResponse.json(broken)));

    // Par défaut, aucun contrôle pendant les tests
    await api.get('/reservations/RES-000124');
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(warn).not.toHaveBeenCalled();

    setContractCheck(true);
    const received = await api.get<Record<string, unknown>>('/reservations/RES-000124');
    expect(received).toEqual(broken);
    expect(received.expiresAt).toBeUndefined();
    // Avertissement selon l'étape de test (développement)
    expect(env.appStage).toBe('development');
    await vi.waitFor(() => expect(warn).toHaveBeenCalledWith(MISSING_EXPIRES_AT));
  });
});
