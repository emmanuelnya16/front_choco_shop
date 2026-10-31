import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { LazyMotion } from 'motion/react';
import { setupServer } from 'msw/node';
import { createMemoryRouter, RouterProvider } from 'react-router';
import {
  afterAll,
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest';
import { AuthSheet } from '@/features/auth/components/AuthSheet';
import { HoldCountdown } from '@/features/reservation/components/HoldCountdown';
import {
  computeReservationAmounts,
  createReservationFormSchema,
} from '@/features/reservation/schema/reservationSchema';
import { api } from '@/lib/api/client';
import { endpoints } from '@/lib/api/endpoints';
import { detectCmOperator, getOperatorLabel } from '@/lib/utils/operator';
import {
  cleanCmPhoneDigits,
  formatCmPhone,
  formatCmPhoneInput,
  isValidCmPhone,
  normalizeCmPhone,
} from '@/lib/utils/phone';
import { mockProducts } from '@/mocks/fixtures/products';
import { mockDeliveryCities } from '@/mocks/fixtures/settings';
import { handlers, resetMockM3State } from '@/mocks/handlers';
import loadMotionFeatures from '@/motion/features';
import { useAuthStore } from '@/stores/authStore';
import { useCartStore } from '@/stores/cartStore';
import { useReservationStore } from '@/stores/reservationStore';
import { useUiStore } from '@/stores/uiStore';
import type { CreateReservationPayload, ReservationCreated } from '@/types/api';

const server = setupServer(...handlers);

beforeAll(() => {
  server.listen();
});

afterEach(() => {
  server.resetHandlers();
});

afterAll(() => {
  server.close();
});

function createTestWrapper(children: React.ReactNode) {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });

  const router = createMemoryRouter(
    [
      {
        path: '/',
        element: (
          <QueryClientProvider client={queryClient}>
            <LazyMotion features={loadMotionFeatures} strict>
              {children}
            </LazyMotion>
          </QueryClientProvider>
        ),
      },
    ],
    { initialEntries: ['/'] },
  );

  return { queryClient, router };
}

describe('Module M3 — Panier, Connexion OTP et Réservation', () => {
  beforeEach(() => {
    resetMockM3State();
    useCartStore.getState().clear();
    useAuthStore.getState().clearSession();
    useReservationStore.getState().clearActiveReservation();
    useReservationStore.setState({
      serverTimeOffsetMs: 0,
      bannerDismissedRef: null,
    });
    useUiStore.setState({
      isAuthSheetOpen: false,
      pendingAuthAction: null,
      onAuthSheetCancel: null,
      isCartDrawerOpen: false,
      cartDrawerAutoOpened: false,
    });
  });

  it('1. cartStore : plafonne la quantité à maxQuantity, restaure à la même position/quantité et applique /cart/validate', () => {
    const store = useCartStore.getState();

    store.add({
      variantId: 'var-1',
      productId: 'prod-1',
      slug: 'babouche-1',
      name: 'Babouche Heritage',
      size: '42',
      color: { code: 'noir', name: 'Noir', hex: '#0A0A0A' },
      unitPrice: 18000,
      quantity: 2,
      maxQuantity: 3,
      image: '/img-1.jpg',
    });

    store.add({
      variantId: 'var-2',
      productId: 'prod-2',
      slug: 'tshirt-2',
      name: 'T-shirt Incompris',
      size: 'L',
      color: { code: 'blanc', name: 'Blanc', hex: '#FFFFFF' },
      unitPrice: 15000,
      quantity: 1,
      maxQuantity: 5,
      image: '/img-2.jpg',
    });

    // Plafonnement à maxQuantity lors d'un ajout ou setQuantity
    store.add({
      variantId: 'var-1',
      productId: 'prod-1',
      slug: 'babouche-1',
      name: 'Babouche Heritage',
      size: '42',
      color: { code: 'noir', name: 'Noir', hex: '#0A0A0A' },
      unitPrice: 18000,
      quantity: 5,
      maxQuantity: 3,
      image: '/img-1.jpg',
    });
    expect(useCartStore.getState().items[0]?.quantity).toBe(3);

    store.setQuantity('var-1', 10);
    expect(useCartStore.getState().items[0]?.quantity).toBe(3);

    // Suppression et annulation par restore à l'index exact (index 0) et quantité exacte (3)
    const removedItem = useCartStore.getState().items[0]!;
    store.remove('var-1');
    expect(useCartStore.getState().items).toHaveLength(1);
    expect(useCartStore.getState().items[0]?.variantId).toBe('var-2');

    store.restore(removedItem, 0);
    expect(useCartStore.getState().items).toHaveLength(2);
    expect(useCartStore.getState().items[0]?.variantId).toBe('var-1');
    expect(useCartStore.getState().items[0]?.quantity).toBe(3);

    // Application des résultats de /cart/validate (reduced, price_changed, unavailable)
    store.applyValidation({
      checkedAt: new Date().toISOString(),
      items: [
        {
          variantId: 'var-1',
          availableQuantity: 1,
          unitPrice: 19500,
          previousPrice: 18000,
          status: 'reduced',
        },
        {
          variantId: 'var-2',
          availableQuantity: 0,
          unitPrice: 15000,
          status: 'unavailable',
        },
      ],
    });

    const updatedItems = useCartStore.getState().items;
    expect(updatedItems[0]?.quantity).toBe(1);
    expect(updatedItems[0]?.maxQuantity).toBe(1);
    expect(updatedItems[0]?.unitPrice).toBe(19500);
    expect(updatedItems[1]?.maxQuantity).toBe(0);
    expect(useCartStore.getState().validationMap['var-2']?.status).toBe('unavailable');
  });

  it('2. normalizeCmPhone, formatCmPhone, formatCmPhoneInput et detectCmOperator : valide les numéros et détecte Orange vs MTN', () => {
    expect(normalizeCmPhone('+237 690 12 34 56')).toBe('+237690123456');
    expect(normalizeCmPhone('237677001122')).toBe('+237677001122');
    expect(cleanCmPhoneDigits('+237 690 12 34 56')).toBe('690123456');
    expect(isValidCmPhone('690123456')).toBe(true);
    expect(isValidCmPhone('590123456')).toBe(false);

    expect(formatCmPhone('690123456')).toBe('690\u00a012\u00a034\u00a056');
    expect(formatCmPhoneInput('690123456')).toBe('690 12 34 56');

    // Détection opérateur Orange (69, 655-659, 686-689) vs MTN (67, 650-654, 680-683)
    expect(detectCmOperator('690 00 00 01')).toBe('orange');
    expect(detectCmOperator('656 12 34 56')).toBe('orange');
    expect(detectCmOperator('688 12 34 56')).toBe('orange');
    expect(getOperatorLabel('orange')).toBe('Orange');

    expect(detectCmOperator('677 12 34 56')).toBe('mtn');
    expect(detectCmOperator('651 12 34 56')).toBe('mtn');
    expect(detectCmOperator('681 12 34 56')).toBe('mtn');
    expect(getOperatorLabel('mtn')).toBe('MTN');

    expect(detectCmOperator('6')).toBeNull();
    expect(detectCmOperator('622 00 00 00')).toBeNull();
  });

  it('3. AuthSheet : soumet au 6e chiffre, gère 422/410/429 et reprend requireAuth après connexion', async () => {
    const onSuccessSpy = vi.fn();
    useUiStore.getState().requireAuth(onSuccessSpy);

    const { router } = createTestWrapper(<AuthSheet />);
    render(<RouterProvider router={router} />);

    // Étape 1 : saisie du numéro connu 690 00 00 01 (Junior Mbarga)
    const phoneInput = await screen.findByLabelText(/Numéro de téléphone/i);
    fireEvent.change(phoneInput, { target: { value: '690000001' } });
    expect(screen.getByTestId('operator-badge')).toHaveTextContent('Orange');

    fireEvent.click(screen.getByRole('button', { name: /Recevoir mon code/i }));

    // Étape 2 : saisie du code OTP
    const otpInput = await screen.findByTestId('otp-hidden-input');

    // Code erroné -> 422 avec attemptsLeft
    fireEvent.change(otpInput, { target: { value: '111111' } });
    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent(/Code incorrect/i);
    });

    // Code expiré -> 000000 -> 410
    fireEvent.change(otpInput, { target: { value: '000000' } });
    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent(/Ce code a expiré/i);
    });

    // Code valide -> 123456 -> connexion réussie et exécution de onSuccessSpy
    fireEvent.change(otpInput, { target: { value: '123456' } });
    await waitFor(
      () => {
        expect(useAuthStore.getState().status).toBe('authenticated');
        expect(useAuthStore.getState().user?.firstName).toBe('Junior');
        expect(onSuccessSpy).toHaveBeenCalledTimes(1);
      },
      { timeout: 2500 },
    );
  });

  it('3b. AuthSheet : bloque après 5 tentatives erronées (429)', async () => {
    useUiStore.getState().requireAuth(() => {});
    const { router } = createTestWrapper(<AuthSheet />);
    render(<RouterProvider router={router} />);

    const phoneInput = await screen.findByLabelText(/Numéro de téléphone/i);
    fireEvent.change(phoneInput, { target: { value: '677112233' } });
    fireEvent.click(screen.getByRole('button', { name: /Recevoir mon code/i }));

    const otpInput = await screen.findByTestId('otp-hidden-input');
    for (let i = 0; i < 6; i += 1) {
      fireEvent.change(otpInput, { target: { value: `99999${i}` } });
      await waitFor(() => {
        expect(screen.getByRole('alert')).toBeInTheDocument();
      });
    }

    expect(screen.getByRole('alert')).toHaveTextContent(/Trop de tentatives/i);
  });

  it('4. reservationSchema : valide conditionnellement Douala local, expédition par agence et retrait en boutique', () => {
    const schema = createReservationFormSchema(mockDeliveryCities);

    // Ville locale Douala : district + landmark requis
    const invalidDouala = schema.safeParse({
      firstName: 'Junior',
      lastName: 'Mbarga',
      receptionMode: 'delivery',
      city: 'Douala',
      district: '',
      landmark: '',
      agencyId: '',
      recipientType: 'self',
      recipientName: '',
      recipientPhone: '',
      notes: '',
      saveAddress: false,
      addressLabel: 'Maison',
    });
    expect(invalidDouala.success).toBe(false);

    const validDouala = schema.safeParse({
      firstName: 'Junior',
      lastName: 'Mbarga',
      receptionMode: 'delivery',
      city: 'Douala',
      district: 'Bonapriso',
      landmark: 'En face de la boulangerie Zepol',
      agencyId: '',
      recipientType: 'self',
      recipientName: '',
      recipientPhone: '',
      notes: '',
      saveAddress: true,
      addressLabel: 'Maison',
    });
    expect(validDouala.success).toBe(true);

    // Ville interurbaine Yaoundé : agencyId requis + destinataire si 'other'
    const invalidAgencyOther = schema.safeParse({
      firstName: 'Junior',
      lastName: 'Mbarga',
      receptionMode: 'delivery',
      city: 'Yaoundé',
      district: '',
      landmark: '',
      agencyId: '',
      recipientType: 'other',
      recipientName: '',
      recipientPhone: '',
      notes: '',
      saveAddress: false,
      addressLabel: 'Maison',
    });
    expect(invalidAgencyOther.success).toBe(false);

    const validAgencyOther = schema.safeParse({
      firstName: 'Junior',
      lastName: 'Mbarga',
      receptionMode: 'delivery',
      city: 'Yaoundé',
      district: '',
      landmark: '',
      agencyId: 'ag-yao-finexs',
      recipientType: 'other',
      recipientName: 'Paul Biya Jr',
      recipientPhone: '677 12 34 56',
      notes: '',
      saveAddress: false,
      addressLabel: 'Maison',
    });
    expect(validAgencyOther.success).toBe(true);

    // Retrait en boutique : aucun quartier ni agence requis
    const validPickup = schema.safeParse({
      firstName: 'Junior',
      lastName: 'Mbarga',
      receptionMode: 'pickup',
      city: '',
      district: '',
      landmark: '',
      agencyId: '',
      recipientType: 'self',
      recipientName: '',
      recipientPhone: '',
      notes: '',
      saveAddress: false,
      addressLabel: 'Maison',
    });
    expect(validPickup.success).toBe(true);
  });

  it('5. computeReservationAmounts : calcule les frais par ville, la gratuité en boutique et le mode on_delivery', () => {
    const doualaCity = mockDeliveryCities.find((c) => c.name === 'Douala')!;
    const garouaCity = mockDeliveryCities.find((c) => c.name === 'Garoua')!;

    // Livraison Douala (1 500 FCFA)
    const doualaAmounts = computeReservationAmounts({
      subtotal: 35000,
      receptionMode: 'delivery',
      selectedCity: doualaCity,
      deliveryFeePayment: 'upfront',
    });
    expect(doualaAmounts.deliveryFee).toBe(1500);
    expect(doualaAmounts.total).toBe(36500);

    // Livraison Garoua (4 500 FCFA)
    const garouaAmounts = computeReservationAmounts({
      subtotal: 35000,
      receptionMode: 'delivery',
      selectedCity: garouaCity,
      deliveryFeePayment: 'upfront',
    });
    expect(garouaAmounts.deliveryFee).toBe(4500);
    expect(garouaAmounts.total).toBe(39500);

    // Retrait en boutique (Gratuit)
    const pickupAmounts = computeReservationAmounts({
      subtotal: 35000,
      receptionMode: 'pickup',
      selectedCity: doualaCity,
    });
    expect(pickupAmounts.deliveryFee).toBe(0);
    expect(pickupAmounts.total).toBe(35000);
    expect(pickupAmounts.deliveryLabel).toBe('Gratuit');

    // Frais de livraison réglés à la réception (on_delivery)
    const onDeliveryAmounts = computeReservationAmounts({
      subtotal: 20000,
      receptionMode: 'delivery',
      selectedCity: doualaCity,
      deliveryFeePayment: 'on_delivery',
    });
    expect(onDeliveryAmounts.deliveryFee).toBe(1500);
    expect(onDeliveryAmounts.countedDeliveryFee).toBe(0);
    expect(onDeliveryAmounts.total).toBe(20000);
    expect(onDeliveryAmounts.isOnDelivery).toBe(true);
  });

  it('6. Idempotence de POST /reservations : deux appels avec la même clé Idempotency-Key retournent la même réservation', async () => {
    const product = mockProducts[0]!;
    const stockedVariant = product.variants.find((v) => v.stock > 0)!;

    const payload: CreateReservationPayload = {
      receptionMode: 'pickup',
      firstName: 'Junior',
      lastName: 'Mbarga',
      phone: '690000001',
      items: [
        {
          productId: product.id,
          variantId: stockedVariant.id,
          quantity: 1,
        },
      ],
    };

    const res1 = await api.post<ReservationCreated>(
      endpoints.reservations.create,
      payload,
      { headers: { 'Idempotency-Key': 'idem-test-key-001' } },
    );

    const res2 = await api.post<ReservationCreated>(
      endpoints.reservations.create,
      payload,
      { headers: { 'Idempotency-Key': 'idem-test-key-001' } },
    );

    expect(res1.ref).toBe('RES-000124');
    expect(res2.ref).toBe(res1.ref);
    expect(res2.createdAt).toBe(res1.createdAt);
  });

  it('7. HoldCountdown : ajuste la couleur selon le temps restant, corrige le décalage serveur et déclenche onExpire', () => {
    vi.useFakeTimers();
    const now = Date.now();

    // > 2h : ton ink
    const { unmount: unmount1 } = render(
      <HoldCountdown
        expiresAt={new Date(now + 3 * 3600 * 1000).toISOString()}
        variant="inline"
      />,
    );
    expect(screen.getByTestId('hold-countdown')).toHaveAttribute('data-tone', 'ink');
    unmount1();

    // Entre 2h et 30m : ton warning
    const { unmount: unmount2 } = render(
      <HoldCountdown
        expiresAt={new Date(now + 60 * 60 * 1000).toISOString()}
        variant="inline"
      />,
    );
    expect(screen.getByTestId('hold-countdown')).toHaveAttribute('data-tone', 'warning');
    unmount2();

    // < 30m : ton red + déclenchement de onExpire à zéro
    const onExpireSpy = vi.fn();
    const { unmount: unmount3 } = render(
      <HoldCountdown
        expiresAt={new Date(now + 2000).toISOString()}
        variant="ring"
        onExpire={onExpireSpy}
      />,
    );
    expect(screen.getByTestId('hold-countdown')).toHaveAttribute('data-tone', 'red');

    act(() => {
      vi.advanceTimersByTime(3000);
    });

    expect(onExpireSpy).toHaveBeenCalledTimes(1);
    expect(screen.getByTestId('hold-countdown')).toHaveTextContent(
      /Réservation expirée/i,
    );
    unmount3();

    vi.useRealTimers();
  });
});
