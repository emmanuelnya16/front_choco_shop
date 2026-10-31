import { render, screen, waitFor } from '@testing-library/react';
import { RouterProvider } from 'react-router';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { AppProviders } from '@/app/providers';
import { createTestRouter } from '@/app/router';
import { api, ApiError } from '@/lib/api/client';
import { createAppQueryClient } from '@/lib/api/queryClient';
import { cloudinarySrcSet, cloudinaryUrl } from '@/lib/utils/cloudinary';
import { formatCountdown, formatDate, formatRelative } from '@/lib/utils/date';
import { haptic } from '@/lib/utils/haptics';
import { formatCmPhone, isValidCmPhone, normalizeCmPhone } from '@/lib/utils/phone';
import { formatPrice } from '@/lib/utils/price';
import { createSafeStorage } from '@/lib/utils/storage';
import { mockReservations } from '@/mocks/fixtures/reservations';
import { useAuthStore } from '@/stores/authStore';
import { useCartStore } from '@/stores/cartStore';
import { hasPackagePhotos } from '@/types/domain';
import { isFinalStatus, STATUS_META, TIMELINE_ORDER } from '@/types/reservationStatus';

describe('Utilitaires : price.ts', () => {
  it('formate les prix en FCFA avec espaces insécables fines et sans décimales', () => {
    expect(formatPrice(45000)).toBe('45\u202f000\u00a0FCFA');
    expect(formatPrice(8000)).toBe('8\u202f000\u00a0FCFA');
    expect(formatPrice(0)).toBe('0\u00a0FCFA');
    expect(formatPrice(65000.4)).toBe('65\u202f000\u00a0FCFA');
    expect(formatPrice(Number.NaN)).toBe('0\u00a0FCFA');
  });
});

describe('Utilitaires : phone.ts (au moins 8 cas dont formats invalides)', () => {
  it('valide et normalise les numéros camerounais valides (cas 1 à 5)', () => {
    // Cas 1 : 9 chiffres commençant par 6
    expect(isValidCmPhone('691234567')).toBe(true);
    expect(normalizeCmPhone('691234567')).toBe('+237691234567');

    // Cas 2 : format avec +237
    expect(isValidCmPhone('+237677889900')).toBe(true);
    expect(normalizeCmPhone('+237677889900')).toBe('+237677889900');

    // Cas 3 : format avec 00237
    expect(isValidCmPhone('00237655443322')).toBe(true);
    expect(normalizeCmPhone('00237655443322')).toBe('+237655443322');

    // Cas 4 : format avec espaces et tirets
    expect(isValidCmPhone('+237 699-11-22-33')).toBe(true);
    expect(normalizeCmPhone('+237 699-11-22-33')).toBe('+237699112233');

    // Cas 5 : préfixe 237 sans +
    expect(isValidCmPhone('237680102030')).toBe(true);
    expect(normalizeCmPhone('237680102030')).toBe('+237680102030');
  });

  it('rejette les formats invalides (cas 6 à 9) et formate en 6XX XX XX XX', () => {
    // Cas 6 : ne commence pas par 6 (ex. fixe 2 ou numéro étranger)
    expect(isValidCmPhone('233445566')).toBe(false);
    expect(() => normalizeCmPhone('233445566')).toThrow();

    // Cas 7 : trop court (8 chiffres)
    expect(isValidCmPhone('69123456')).toBe(false);
    expect(() => normalizeCmPhone('69123456')).toThrow();

    // Cas 8 : trop long (10 chiffres)
    expect(isValidCmPhone('6912345678')).toBe(false);

    // Cas 9 : caractères alphabétiques ou vide
    expect(isValidCmPhone('69123ABCD')).toBe(false);
    expect(isValidCmPhone('')).toBe(false);

    // Format d'affichage
    expect(formatCmPhone('+237691234567')).toBe('691\u00a023\u00a045\u00a067');
    expect(formatCmPhone('00237 677 88 99 00')).toBe('677\u00a088\u00a099\u00a000');
  });
});

describe('Utilitaires : cloudinary.ts', () => {
  it('construit une URL Cloudinary avec f_auto,q_auto et transformations ou conserve les chemins locaux', () => {
    expect(cloudinaryUrl('/mock/product-hoodie.svg', { w: 480 })).toBe('/mock/product-hoodie.svg');
    expect(cloudinaryUrl('https://example.com/photo.jpg', { w: 480 })).toBe(
      'https://example.com/photo.jpg',
    );

    const url = cloudinaryUrl('products/hoodie-noir', { w: 640, h: 800, crop: 'fill' });
    expect(url).toContain('/image/upload/f_auto,q_auto,c_fill,w_640,h_800/products/hoodie-noir');

    const blurUrl = cloudinaryUrl('products/hoodie-noir', { blur: true });
    expect(blurUrl).toContain('/image/upload/f_auto,q_auto,w_24,e_blur:1000/products/hoodie-noir');

    const responsive = cloudinarySrcSet('products/hoodie-noir', [320, 480, 640, 960]);
    expect(responsive.srcSet).toContain('320w');
    expect(responsive.srcSet).toContain('960w');
    expect(responsive.sizes).toContain('48vw');
  });
});

describe('Utilitaires : date.ts & haptics.ts', () => {
  it('formate le compte à rebours en heures et minutes', () => {
    const ms = (23 * 60 + 58) * 60_000;
    expect(formatCountdown(ms)).toBe('23 h 58 min');
    expect(formatCountdown(0)).toBe('00 h 00 min');
    expect(formatCountdown(-5000)).toBe('00 h 00 min');
  });

  it('formate une date et un écart relatif en français', () => {
    const base = new Date('2026-10-29T12:00:00.000Z');
    const twoHoursAgo = new Date('2026-10-29T10:00:00.000Z');
    expect(formatDate(base)).toContain('2026');
    expect(formatRelative(twoHoursAgo, base)).toContain('2');
  });

  it('déclenche navigator.vibrate uniquement si animations non réduites', () => {
    expect(haptic('success')).toBe(true);
    expect(navigator.vibrate).toHaveBeenCalledWith([10, 40, 10]);
  });
});

describe('Utilitaires : storage.ts (échec du localStorage)', () => {
  it('bascule sur le stockage en mémoire lorsque localStorage lève une exception', () => {
    const brokenStorage: Storage = {
      length: 0,
      clear: () => {
        throw new Error('QuotaExceededError');
      },
      getItem: () => {
        throw new Error('SecurityError');
      },
      key: () => null,
      removeItem: () => {
        throw new Error('SecurityError');
      },
      setItem: () => {
        throw new Error('QuotaExceededError');
      },
    };

    const safe = createSafeStorage(() => brokenStorage);
    expect(() => safe.setItem('test-key', 'valeur-secours')).not.toThrow();
    expect(safe.getItem('test-key')).toBe('valeur-secours');
    expect(() => safe.removeItem('test-key')).not.toThrow();
    expect(safe.getItem('test-key')).toBeNull();
  });
});

describe('Store Zustand : cartStore (ajout, fusion, plafond, sous-total)', () => {
  beforeEach(() => {
    useCartStore.getState().clear();
  });

  it('ajoute un article, fusionne la même variante, plafonne à maxQuantity et calcule le sous-total', () => {
    const baseItem = {
      productId: 'prod-01',
      slug: 'hoodie-barbele-noir',
      name: 'Hoodie Barbelé Noir',
      image: '/mock/product-hoodie.svg',
      variantId: 'prod-01-noir-l',
      size: 'L',
      color: { code: 'noir', name: 'Noir Charbon', hex: 'rgb(26,26,24)' },
      unitPrice: 45000,
      quantity: 2,
      maxQuantity: 3,
    };

    useCartStore.getState().add(baseItem);
    expect(useCartStore.getState().count()).toBe(2);
    expect(useCartStore.getState().subtotal()).toBe(90000);

    // Fusion avec plafonnement à maxQuantity = 3
    useCartStore.getState().add({ ...baseItem, quantity: 5 });
    expect(useCartStore.getState().items).toHaveLength(1);
    expect(useCartStore.getState().items[0].quantity).toBe(3);
    expect(useCartStore.getState().subtotal()).toBe(135000);

    // Changement de quantité et suppression
    useCartStore.getState().setQuantity('prod-01-noir-l', 1);
    expect(useCartStore.getState().count()).toBe(1);
    expect(useCartStore.getState().subtotal()).toBe(45000);

    useCartStore.getState().remove('prod-01-noir-l');
    expect(useCartStore.getState().count()).toBe(0);
  });
});

describe('Types métier : STATUS_META, TIMELINE_ORDER et hasPackagePhotos', () => {
  it('expose les 12 statuts avec métadonnées et renvoie le bon ordre de frise selon le mode', () => {
    expect(Object.keys(STATUS_META)).toHaveLength(12);
    expect(STATUS_META.pending_validation.tone).toBe('warning');
    expect(isFinalStatus('delivered')).toBe(true);
    expect(isFinalStatus('picked_up')).toBe(true);
    expect(isFinalStatus('preparing')).toBe(false);

    const deliveryOrder = TIMELINE_ORDER('delivery');
    expect(deliveryOrder).toContain('handed_to_agency');
    expect(deliveryOrder).toContain('in_delivery');
    expect(deliveryOrder.at(-1)).toBe('delivered');

    const pickupOrder = TIMELINE_ORDER('pickup');
    expect(pickupOrder).toContain('ready_for_pickup');
    expect(pickupOrder.at(-1)).toBe('picked_up');
  });

  it('détecte correctement la présence de photos de colis prêt via hasPackagePhotos', () => {
    expect(hasPackagePhotos(mockReservations['RES-000101'])).toBe(false);
    expect(hasPackagePhotos(mockReservations['RES-000102'])).toBe(true);
    expect(mockReservations['RES-000102'].packagePhotos).toHaveLength(2);
    expect(hasPackagePhotos(null)).toBe(false);
  });
});

describe('Client API : ApiError, 401 -> refresh -> retry, et délai dépassé', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    useAuthStore.getState().clearSession();
  });

  it('tente POST /auth/refresh sur une 401 puis rejoue la requête initiale avec le nouveau jeton', async () => {
    useAuthStore.getState().setSession('expired-token', {
      id: 'u1',
      phone: '+237690000000',
      createdAt: '2026-10-01T00:00:00.000Z',
    });

    const fetchSpy = vi
      .spyOn(globalThis, 'fetch')
      // 1er appel : 401
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ message: 'Expired JWT' }), { status: 401 }),
      )
      // 2e appel : POST /auth/refresh -> 200 avec nouveau token
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ accessToken: 'fresh-jwt-token' }), { status: 200 }),
      )
      // 3e appel : requête initiale rejouée -> 200
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ id: 'u1', phone: '+237690000000' }), { status: 200 }),
      );

    const result = await api.get<{ id: string; phone: string }>('/me');
    expect(result.id).toBe('u1');
    expect(fetchSpy).toHaveBeenCalledTimes(3);
    expect(useAuthStore.getState().getToken()).toBe('fresh-jwt-token');
  });

  it('normalise un délai dépassé (AbortError) en ApiError 408 TIMEOUT', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementationOnce((_input, init) => {
      return new Promise((_resolve, reject) => {
        init?.signal?.addEventListener('abort', () => {
          const abortErr = new Error('The operation was aborted');
          abortErr.name = 'AbortError';
          reject(abortErr);
        });
      });
    });

    await expect(api.get('/products', { timeoutMs: 25 })).rejects.toMatchObject({
      name: 'ApiError',
      status: 408,
      code: 'TIMEOUT',
    } satisfies Partial<ApiError>);
  });
});

describe('Routeur : rendu de la page provisoire /panier', () => {
  it('affiche la page provisoire de /panier avec son titre et son numéro de section', async () => {
    const testRouter = createTestRouter(['/panier']);
    const testQueryClient = createAppQueryClient();

    render(
      <AppProviders client={testQueryClient}>
        <RouterProvider router={testRouter} />
      </AppProviders>,
    );

    const heading = await screen.findByRole('heading', { level: 1, name: /Panier/i });
    expect(heading).toBeInTheDocument();
    expect(screen.getByText(/Parcourez la collection/i)).toBeInTheDocument();

    await waitFor(() => {
      expect(document.title).toContain('Panier · DR Choco');
    });
  });
});
