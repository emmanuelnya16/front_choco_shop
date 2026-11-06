import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { RouterProvider } from 'react-router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AppProviders } from '@/app/providers';
import { createTestRouter } from '@/app/router';
import { saveStoredPaymentSettings } from '@/features/payment/api/paymentSettingsStorage';
import { buildUssdCode } from '@/features/payment/utils/ussd';
import { createAppQueryClient } from '@/lib/api/queryClient';
import { createSeedReservations } from '@/mocks/fixtures/reservations';
import { useNetworkStore } from '@/pwa/networkStore';
import { useAuthStore } from '@/stores/authStore';
import { useCartStore } from '@/stores/cartStore';
import { useReservationStore } from '@/stores/reservationStore';
import { useUiStore } from '@/stores/uiStore';
import type { PaymentSettings, User } from '@/types/domain';

const JUNIOR: User = {
  id: 'usr-junior-01',
  phone: '+237690000001',
  firstName: 'Junior',
  lastName: 'Mbarga',
  createdAt: '2026-09-15T10:00:00.000Z',
};

/** Pages du tunnel chargées à la demande : délai plus large quand toute la suite tourne en parallèle. */
const LAZY_ROUTE = { timeout: 8000 };

function renderApp(path: string) {
  const router = createTestRouter([path]);
  render(
    <AppProviders client={createAppQueryClient()}>
      <RouterProvider router={router} />
    </AppProviders>,
  );
  return router;
}

/** Laisse passer les effets (y compris le rafraîchissement de session lancé par la mise en page). */
async function flushEffects() {
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 50));
  });
}

/** Réseau qui ne répond jamais : /auth/refresh reste en attente, comme juste après un rechargement. */
function stallNetwork() {
  vi.spyOn(globalThis, 'fetch').mockImplementation(() => new Promise<Response>(() => undefined));
}

function fillCart() {
  useCartStore.getState().add({
    variantId: 'prod-01-noir-m',
    productId: 'prod-01',
    slug: 'hoodie-barbele-noir',
    name: 'Hoodie Barbelé Noir',
    size: 'M',
    color: { code: 'noir', name: 'Noir Charbon', hex: '#1A1A18' },
    unitPrice: 45000,
    quantity: 1,
    maxQuantity: 6,
    image: '/mock/product-hoodie.svg',
  });
}

beforeEach(() => {
  useCartStore.getState().clear();
  useAuthStore.getState().clearSession();
  useUiStore.setState({ isAuthSheetOpen: false, pendingAuthAction: null, onAuthSheetCancel: null });
});

afterEach(() => {
  vi.restoreAllMocks();
  Reflect.deleteProperty(navigator, 'onLine');
  useAuthStore.getState().clearSession();
  useCartStore.getState().clear();
  useReservationStore.getState().clearActiveReservation();
  useUiStore.setState({ isAuthSheetOpen: false, pendingAuthAction: null, onAuthSheetCancel: null });
  useNetworkStore.setState({ browserOnline: true, online: true, consecutiveFailures: 0 });
});

describe('Responsive tunnel · feuille de connexion au rechargement direct', () => {
  it('/reservation : client connecté dont la session se restaure, aucune feuille de connexion', async () => {
    stallNetwork();
    fillCart();
    useAuthStore.setState({ user: JUNIOR, accessToken: null, status: 'unknown' });

    renderApp('/reservation');
    expect(await screen.findByText('FINALISER LA RÉSERVATION', {}, LAZY_ROUTE)).toBeInTheDocument();
    await flushEffects();

    expect(useAuthStore.getState().status).toBe('unknown');
    expect(useUiStore.getState().isAuthSheetOpen).toBe(false);

    // Session refusée par le serveur : la feuille s'ouvre comme avant
    act(() => useAuthStore.getState().clearSession());
    await waitFor(() => expect(useUiStore.getState().isAuthSheetOpen).toBe(true));
  });

  it('/reservation/:ref/paiement : client connecté dont la session se restaure, aucune feuille de connexion', async () => {
    stallNetwork();
    useAuthStore.setState({ user: JUNIOR, accessToken: null, status: 'unknown' });

    renderApp('/reservation/RES-000101/paiement');
    expect(await screen.findByText('Preuve', {}, LAZY_ROUTE)).toBeInTheDocument();
    await flushEffects();

    expect(useUiStore.getState().isAuthSheetOpen).toBe(false);
  });

  it('/reservation : visiteur non connecté, la feuille de connexion s’ouvre', async () => {
    stallNetwork();
    fillCart();

    renderApp('/reservation');
    expect(await screen.findByText('FINALISER LA RÉSERVATION', {}, LAZY_ROUTE)).toBeInTheDocument();
    await waitFor(() => expect(useUiStore.getState().isAuthSheetOpen).toBe(true));
  });
});

describe('Paiement · aucun paramètre fictif (M7)', () => {
  it('sans paramètres reçus ni mémorisés : « Paiement momentanément indisponible », aucun code ni bouton « Composer »', async () => {
    const reservation = createSeedReservations()['RES-000101']!;
    window.localStorage.removeItem('drc_payment_settings_v1');
    useAuthStore.getState().setSession('jwt-junior', JUNIOR);
    useReservationStore.getState().setActiveReservation(reservation, reservation.serverTime);
    vi.spyOn(globalThis, 'fetch').mockRejectedValue(new TypeError('Failed to fetch'));
    Object.defineProperty(navigator, 'onLine', { configurable: true, get: () => false });
    act(() => useNetworkStore.getState().setBrowserOnline(false));

    renderApp('/reservation/RES-000101/paiement');

    const title = await screen.findByText('Paiement momentanément indisponible', {}, LAZY_ROUTE);
    const card = title.closest('[role="alert"]') as HTMLElement;
    expect(within(card).getByRole('button', { name: /Réessayer/ })).toBeInTheDocument();
    expect(screen.queryByTestId('ussd-plain-code')).not.toBeInTheDocument();
    expect(screen.queryByTestId('ussd-dial-link')).not.toBeInTheDocument();
    expect(screen.queryByText(/000111|000222/)).not.toBeInTheDocument();
  });
});

describe('Responsive tunnel · code USSD complet', () => {
  const PAYMENT: PaymentSettings = {
    operators: [
      {
        id: 'orange',
        label: 'Orange Money',
        merchantName: 'ETS DR CHOCO',
        merchantCode: '654321',
        ussdTemplate: '#150*47*{code}*{amount}#',
        qrImageUrl: '/mock/qr-orange.svg',
        steps: ['Composez le code.'],
        enabled: true,
      },
    ],
    exactAmountRequired: true,
    validationDelayText: 'en moins d’une heure',
    proofMaxSizeMb: 10,
  };

  it('jamais tronqué : coupure possible après chaque « * », texte copié identique', async () => {
    const reservation = createSeedReservations()['RES-000101']!;
    const total = reservation.amount?.total ?? reservation.total;
    useAuthStore.getState().setSession('jwt-junior', JUNIOR);
    useReservationStore.getState().setActiveReservation(reservation, reservation.serverTime);
    saveStoredPaymentSettings(PAYMENT, '+237690000000');
    vi.spyOn(globalThis, 'fetch').mockRejectedValue(new TypeError('Failed to fetch'));
    Object.defineProperty(navigator, 'onLine', { configurable: true, get: () => false });
    act(() => useNetworkStore.getState().setBrowserOnline(false));

    renderApp('/reservation/RES-000101/paiement');

    const code = await screen.findByTestId('ussd-plain-code', {}, LAZY_ROUTE);
    const expected = buildUssdCode('#150*47*{code}*{amount}#', '654321', total) ?? '';
    expect(code.textContent).toBe(expected);
    expect(code).not.toHaveClass('truncate');
    // « #150*47*654321*46500# » : trois « * », donc trois points de coupure
    expect(code.querySelectorAll('wbr')).toHaveLength(expected.split('*').length - 1);
  });
});

describe('Responsive tunnel · bouton retour sur /panier (mobile)', () => {
  it('affiche le bouton Retour sur mobile et renvoie vers /explorer en accès direct', async () => {
    fillCart();
    const router = renderApp('/panier');

    expect(await screen.findByRole('heading', { name: 'MON PANIER' }, LAZY_ROUTE)).toBeInTheDocument();
    const backBtn = screen.getByRole('button', { name: 'Retour' });
    expect(backBtn).toHaveClass('lg:hidden');

    fireEvent.click(backBtn);
    await waitFor(() => expect(router.state.location.pathname).toBe('/explorer'));
  });
});
