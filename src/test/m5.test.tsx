import { act, fireEvent, render, renderHook, screen, waitFor, within } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import { RouterProvider } from 'react-router';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { AppProviders } from '@/app/providers';
import { createTestRouter } from '@/app/router';
import { applyDefaultAddress, removeAddress } from '@/features/profile/api/useAddressMutations';
import { formValuesToAddressPayload } from '@/features/profile/schema/profileSchemas';
import { restoreReservationItemsToCart } from '@/features/cart/restoreReservationItems';
import { rebookToastMessage } from '@/features/tracking/api/useRebook';
import { getCardAction } from '@/features/tracking/cardAction';
import { packagePhotoRatio, useSignedUrlRefresh } from '@/features/tracking/packagePhotos';
import { createAppQueryClient } from '@/lib/api/queryClient';
import { qk } from '@/lib/api/queryKeys';
import { env } from '@/lib/env';
import { CANCEL_NOT_ALLOWED_MESSAGE } from '@/features/tracking/cancel';
import { useAuthStore } from '@/stores/authStore';
import { useCartStore } from '@/stores/cartStore';
import { useToastStore } from '@/stores/toastStore';
import {
  hasUnseenChange,
  needsAttention,
  useSeenStore,
  type SeenEntry,
} from '@/features/tracking/seenStore';
import {
  buildTimelineSteps,
  computeProgress,
  lastSeenStepIndex,
  reachedStepIndex,
} from '@/features/tracking/timeline';
import { api, ApiError } from '@/lib/api/client';
import { endpoints } from '@/lib/api/endpoints';
import { mockReservations } from '@/mocks/fixtures/reservations';
import { handlers, resetMockM3State } from '@/mocks/handlers';
import type {
  CancelReservationResponse,
  ReservationDetailResponse,
  ReservationsListPage,
  ReservationsSummary,
} from '@/types/api';
import type { Address } from '@/types/domain';

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

async function expectApiError(promise: Promise<unknown>, status: number, code?: string) {
  try {
    await promise;
  } catch (error) {
    expect(error).toBeInstanceOf(ApiError);
    expect((error as ApiError).status).toBe(status);
    if (code) expect((error as ApiError).code).toBe(code);
    return;
  }
  throw new Error(`Une erreur ${status} était attendue`);
}

describe('Module M5 — 1. Données de suivi (mocks MSW)', () => {
  beforeEach(() => {
    resetMockM3State();
  });

  it('liste paginée par onglet : 8 en cours, 11 terminées sur 2 pages, sans la réservation d’un autre client', async () => {
    const active = await api.get<ReservationsListPage>(endpoints.reservations.listScoped('active', 1));
    expect(active.total).toBe(8);
    expect(active.counts).toEqual({ active: 8, done: 11 });
    expect(active.items.map((i) => i.ref)).not.toContain('RES-000113');

    // Les réservations modifiées récemment sont en tête
    const times = active.items.map((i) => new Date(i.updatedAt).getTime());
    expect([...times].sort((a, b) => b - a)).toEqual(times);

    // Miniatures : 3 articles au plus, photo du colis quand elle existe
    const res108 = active.items.find((i) => i.ref === 'RES-000108')!;
    expect(res108.itemsPreview.length).toBeLessThanOrEqual(3);
    expect(res108.packagePhotoThumb).toBe('/mock/colis-4.svg');
    expect(active.items.find((i) => i.ref === 'RES-000101')?.expiresAt).toBeDefined();

    const done1 = await api.get<ReservationsListPage>(endpoints.reservations.listScoped('done', 1));
    const done2 = await api.get<ReservationsListPage>(endpoints.reservations.listScoped('done', 2));
    expect(done1.items).toHaveLength(10);
    expect(done1.totalPages).toBe(2);
    expect(done2.items).toHaveLength(1);
    expect(done1.items.find((i) => i.ref === 'RES-000112')?.reachedStatus).toBe('pending_validation');
  });

  it('résumé : compte les réservations qui attendent une action du client', async () => {
    const summary = await api.get<ReservationsSummary>(endpoints.reservations.summary);
    // reserved (RES-000101), payment_rejected (RES-000103), ready_for_pickup (RES-000102)
    expect(summary.needsAction).toBe(3);
    expect(summary.items).toHaveLength(8);
    expect(summary.items.find((i) => i.ref === 'RES-000102')?.hasPackagePhotos).toBe(true);
  });

  it('détail : 404 pour la réservation d’un autre client, `cancellable` calculé par le serveur', async () => {
    await expectApiError(api.get(endpoints.reservations.detail('RES-000113')), 404, 'RESERVATION_NOT_FOUND');

    const reserved = await api.get<ReservationDetailResponse>(endpoints.reservations.detail('RES-000101'));
    expect(reserved.cancellable).toBe(true);
    const preparing = await api.get<ReservationDetailResponse>(endpoints.reservations.detail('RES-000106'));
    expect(preparing.cancellable).toBe(false);
    expect(preparing.agency?.phone).toBeTruthy();
  });

  it('annulation : immédiate pour « reserved » avec motif daté, refusée (422) à partir de la préparation', async () => {
    const response = await api.post<CancelReservationResponse>(
      endpoints.reservations.cancel('RES-000101'),
      { reason: 'Erreur de taille' },
    );
    expect(response.reservation.status).toBe('cancelled');
    const last = response.reservation.timeline.at(-1)!;
    expect(last).toMatchObject({ status: 'cancelled', note: 'Erreur de taille', actor: 'client' });
    expect(response.reservation.updatedAt).toBe(last.at);

    await expectApiError(
      api.post(endpoints.reservations.cancel('RES-000106'), {}),
      422,
      'CANCEL_NOT_ALLOWED',
    );
  });

  it('simulateur : étape suivante, colis prêt avec photos, puis retirée — chaque action est datée', async () => {
    const advanced = await api.post<ReservationDetailResponse>(endpoints.mock.advanceReservation('RES-000106'));
    expect(advanced.status).toBe('handed_to_agency');
    expect(advanced.timeline.at(-1)?.note).toContain('Messagerie des Hauts-Plateaux');

    const ready = await api.post<ReservationDetailResponse>(endpoints.mock.packageReady('RES-000105'), {
      count: 3,
    });
    expect(ready.status).toBe('ready_for_pickup');
    expect(ready.packagePhotos).toHaveLength(3);
    expect(ready.packageReadyAt).toBeTruthy();
    expect(ready.timeline.map((e) => e.status).slice(-2)).toEqual(['preparing', 'ready_for_pickup']);

    const picked = await api.post<ReservationDetailResponse>(endpoints.mock.completeReservation('RES-000105'));
    expect(picked.status).toBe('picked_up');

    await expectApiError(api.post(endpoints.mock.advanceReservation('RES-000105')), 409, 'NO_NEXT_STEP');
  });

  it('adresses : PATCH `isDefault` retire le défaut des autres, DELETE retire l’adresse', async () => {
    const updated = await api.patch<Address>(endpoints.me.address('addr-junior-2'), { isDefault: true });
    expect(updated.isDefault).toBe(true);
    let list = await api.get<Address[]>(endpoints.me.addresses);
    expect(list.filter((a) => a.isDefault).map((a) => a.id)).toEqual(['addr-junior-2']);

    await api.delete(endpoints.me.address('addr-junior-2'));
    list = await api.get<Address[]>(endpoints.me.addresses);
    expect(list.map((a) => a.id)).toEqual(['addr-junior-1']);
    expect(list[0]?.isDefault).toBe(true);
  });
});

describe('Module M5 — 2. Frise de suivi et barre d’avancement', () => {
  beforeEach(() => {
    resetMockM3State();
  });

  it('suit l’ordre du mode de réception (livraison locale : 7 étapes, retrait : 6 étapes)', () => {
    const delivery = buildTimelineSteps(mockReservations['RES-000101']!);
    expect(delivery.map((s) => s.label)).toEqual([
      'Réservée',
      'Paiement envoyé',
      'Confirmée',
      'En préparation',
      'Colis prêt pour la livraison',
      'En cours de livraison',
      'Livrée',
    ]);
    expect(delivery[0]?.state).toBe('current');
    expect(delivery.slice(1).every((s) => s.state === 'upcoming')).toBe(true);

    const pickup = buildTimelineSteps(mockReservations['RES-000105']!);
    expect(pickup.map((s) => s.label)).toEqual([
      'Réservée',
      'Paiement envoyé',
      'Confirmée',
      'En préparation',
      'Prête pour retrait',
      'Retirée',
    ]);
    expect(pickup[2]?.state).toBe('current');

    // Livraison par agence : « Remise à l’agence »
    const agency = buildTimelineSteps(mockReservations['RES-000108']!);
    expect(agency.map((s) => s.label)).toContain('Remise à l’agence');
  });

  it('intercale le rejet en rouge puis « Nouvelle preuve envoyée »', () => {
    const steps = buildTimelineSteps(mockReservations['RES-000104']!);
    expect(steps.slice(0, 4).map((s) => [s.label, s.state, s.tone])).toEqual([
      ['Réservée', 'done', 'default'],
      ['Paiement envoyé', 'done', 'default'],
      ['Paiement rejeté', 'done', 'danger'],
      ['Nouvelle preuve envoyée', 'current', 'default'],
    ]);
    expect(steps[2]?.note).toBe('Capture illisible');

    // Rejet en cours : étape rouge courante, puis la nouvelle preuve à venir
    const rejected = buildTimelineSteps(mockReservations['RES-000103']!);
    const current = rejected.find((s) => s.state === 'current')!;
    expect(current).toMatchObject({ label: 'Paiement rejeté', tone: 'danger', note: 'Montant incorrect' });
    expect(rejected[rejected.indexOf(current) + 1]?.label).toBe('Nouvelle preuve envoyée');
  });

  it('s’arrête au point atteint et se termine par une étape rouge pour une réservation expirée ou annulée', () => {
    const expired = buildTimelineSteps(mockReservations['RES-000111']!);
    expect(expired.map((s) => s.label)).toEqual(['Réservée', 'Expirée']);
    expect(expired.at(-1)?.tone).toBe('danger');
    expect(expired.some((s) => s.state === 'upcoming')).toBe(false);

    const cancelled = buildTimelineSteps(mockReservations['RES-000112']!);
    expect(cancelled.map((s) => s.label)).toEqual(['Réservée', 'Paiement envoyé', 'Annulée']);
    expect(cancelled.at(-1)).toMatchObject({ actor: 'client', tone: 'danger' });
  });

  it('calcule la portion à animer à partir du dernier statut vu', () => {
    const steps = buildTimelineSteps(mockReservations['RES-000108']!);
    expect(lastSeenStepIndex(steps, undefined)).toBe(-1); // première ouverture : tout s’anime
    expect(lastSeenStepIndex(steps, 'handed_to_agency')).toBe(4);
    expect(reachedStepIndex(steps)).toBe(5); // en cours de livraison
  });

  it('barre d’avancement : étapes franchies sur le total du mode, verte si terminée, rouge au point atteint', () => {
    expect(computeProgress({ status: 'confirmed', receptionMode: 'pickup' })).toEqual({
      done: 3,
      total: 6,
      tone: 'ink',
    });
    expect(computeProgress({ status: 'payment_rejected', receptionMode: 'delivery' })).toEqual({
      done: 2,
      total: 7,
      tone: 'ink',
    });
    expect(computeProgress({ status: 'delivered', receptionMode: 'delivery' }).tone).toBe('success');
    expect(
      computeProgress({ status: 'cancelled', receptionMode: 'pickup', reachedStatus: 'pending_validation' }),
    ).toEqual({ done: 2, total: 6, tone: 'red' });
  });
});

describe('Module M5 — 3. Repères de nouveauté (seenStore)', () => {
  const baseline = '2026-10-30T10:00:00.000Z';

  beforeEach(() => {
    useSeenStore.setState({ initializedAt: baseline, byRef: {}, packageToastShown: [] });
  });

  it('signale un changement de statut non vu, et ignore l’historique antérieur à la première ouverture', () => {
    const entry: SeenEntry = { status: 'confirmed', updatedAt: baseline, photosRevealed: false };
    expect(hasUnseenChange({ status: 'preparing', updatedAt: baseline }, entry, baseline)).toBe(true);
    expect(hasUnseenChange({ status: 'confirmed', updatedAt: baseline }, entry, baseline)).toBe(false);
    expect(hasUnseenChange({ status: 'delivered', updatedAt: '2026-10-01T10:00:00.000Z' }, undefined, baseline)).toBe(false);
    expect(hasUnseenChange({ status: 'preparing', updatedAt: '2026-10-30T11:00:00.000Z' }, undefined, baseline)).toBe(true);
  });

  it('repère d’onglet : action attendue non vue, puis disparition une fois la réservation ouverte', () => {
    const old = '2026-10-29T10:00:00.000Z';
    expect(needsAttention({ status: 'reserved', updatedAt: old }, undefined, baseline)).toBe(true);
    useSeenStore.getState().markSeen('RES-000101', 'reserved', old);
    const entry = useSeenStore.getState().byRef['RES-000101'];
    expect(needsAttention({ status: 'reserved', updatedAt: old }, entry, baseline)).toBe(false);
    expect(needsAttention({ status: 'confirmed', updatedAt: old }, undefined, baseline)).toBe(false);
  });

  it('mémorise le dévoilement des photos sans le perdre lors des visites suivantes', () => {
    const store = useSeenStore.getState();
    store.markPhotosRevealed('RES-000102', 'ready_for_pickup', baseline);
    store.markSeen('RES-000102', 'ready_for_pickup', '2026-10-30T12:00:00.000Z');
    const entry = useSeenStore.getState().byRef['RES-000102'];
    expect(entry?.photosRevealed).toBe(true);
    expect(useSeenStore.getState().packageToastShown).toContain('RES-000102');
  });
});

describe('Module M5 — 4. Adresses (cache local)', () => {
  const list: Address[] = [
    { id: 'a', label: 'Maison', city: 'Douala', district: 'Akwa', quarter: 'Akwa', landmark: '', receptionMode: 'delivery', isDefault: true },
    { id: 'b', label: 'Bureau', city: 'Douala', district: 'Bonapriso', quarter: 'Bonapriso', landmark: '', receptionMode: 'delivery', isDefault: false },
    { id: 'c', label: 'Autre', city: 'Yaoundé', district: 'Bastos', quarter: 'Bastos', landmark: '', receptionMode: 'delivery', isDefault: false },
  ];

  it('une seule adresse par défaut, placée en tête', () => {
    const next = applyDefaultAddress(list, 'c');
    expect(next.map((a) => a.id)).toEqual(['c', 'a', 'b']);
    expect(next.filter((a) => a.isDefault)).toHaveLength(1);
  });

  it('supprimer l’adresse par défaut promeut la première restante', () => {
    const next = removeAddress(list, 'a');
    expect(next.map((a) => [a.id, a.isDefault])).toEqual([
      ['b', true],
      ['c', false],
    ]);
  });
});

const JUNIOR_SESSION_USER = {
  id: 'usr-junior-01',
  phone: '+237690000001',
  firstName: 'Junior',
  lastName: 'Mbarga',
  city: 'Douala',
  createdAt: '2026-09-15T10:00:00.000Z',
};

function loginAsJunior() {
  useAuthStore.getState().setSession('mock-token-m5', JUNIOR_SESSION_USER);
}

function renderRoute(path: string, client = createAppQueryClient()) {
  const router = createTestRouter([path]);
  render(
    <AppProviders client={client}>
      <RouterProvider router={router} />
    </AppProviders>,
  );
  return router;
}

describe('Module M5 — 5. Mes réservations (cartes et page)', () => {
  beforeEach(() => {
    resetMockM3State();
    useSeenStore.setState({ initializedAt: new Date().toISOString(), byRef: {}, packageToastShown: [] });
  });

  afterEach(() => {
    useAuthStore.getState().clearSession();
  });

  it('associe la bonne action contextuelle à chaque statut', () => {
    const base = { ref: 'RES-000124', city: 'Yaoundé', packagePhotoThumb: null };
    expect(getCardAction({ ...base, status: 'reserved' })).toMatchObject({
      kind: 'pay',
      href: '/reservation/RES-000124/paiement',
    });
    expect(getCardAction({ ...base, status: 'payment_rejected' })).toMatchObject({
      kind: 'resend-proof',
      label: 'Renvoyer ma preuve',
      href: '/reservation/RES-000124/preuve',
    });
    expect(getCardAction({ ...base, status: 'pending_validation' })).toEqual({
      kind: 'text',
      text: 'Vérification en cours',
    });
    expect(getCardAction({ ...base, status: 'preparing' })).toEqual({
      kind: 'text',
      text: 'Paiement validé · préparation en cours',
    });
    expect(
      getCardAction({ ...base, status: 'ready_for_pickup', packagePhotoThumb: '/mock/colis-1.svg' }),
    ).toMatchObject({ kind: 'view-package', label: 'Voir mon colis' });
    expect(getCardAction({ ...base, status: 'in_delivery' })).toEqual({
      kind: 'text',
      text: 'En route vers Yaoundé',
    });
    expect(getCardAction({ ...base, status: 'delivered' })).toMatchObject({ kind: 'rebook' });
    expect(getCardAction({ ...base, status: 'cancelled' })).toMatchObject({
      kind: 'rebook',
      text: 'Réservation annulée',
    });
  });

  it('formule le bilan de « Réserver à nouveau »', () => {
    expect(rebookToastMessage({ added: 2, unavailable: 1 })).toBe('2 articles ajoutés · 1 n’est plus disponible');
    expect(rebookToastMessage({ added: 1, unavailable: 0 })).toBe('1 article ajouté au panier');
    expect(rebookToastMessage({ added: 0, unavailable: 2 })).toBe('Ces articles ne sont plus disponibles.');
  });

  it('invite à se connecter quand le client n’est pas connecté', async () => {
    renderRoute('/reservations');
    expect(
      await screen.findByText('Connectez-vous avec votre numéro pour suivre vos réservations.'),
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Me connecter' })).toBeInTheDocument();
  });

  it('affiche les onglets avec leurs nombres, 8 cartes en cours puis les terminées', async () => {
    loginAsJunior();
    renderRoute('/reservations');

    const activeTab = await screen.findByRole('tab', { name: /En cours \(8\)/ });
    expect(activeTab).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByRole('tab', { name: /Terminées \(11\)/ })).toBeInTheDocument();

    const panel = screen.getByRole('tabpanel');
    await waitFor(() => expect(within(panel).getAllByRole('article')).toHaveLength(8));
    expect(within(panel).getByText('RES-000103')).toBeInTheDocument();
    expect(within(panel).getByRole('link', { name: /Renvoyer ma preuve/ })).toHaveAttribute(
      'href',
      '/reservation/RES-000103/preuve',
    );

    fireEvent.click(screen.getByRole('tab', { name: /Terminées/ }));
    expect(await screen.findByText('RES-000109')).toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: 'Réserver à nouveau' }).length).toBeGreaterThan(0);
  });
});

describe('Module M5 — 6. Détail d’une réservation', () => {
  beforeEach(() => {
    resetMockM3State();
    useSeenStore.setState({ initializedAt: new Date().toISOString(), byRef: {}, packageToastShown: [] });
    loginAsJunior();
  });

  afterEach(() => {
    useAuthStore.getState().clearSession();
  });

  const actionRegion = () => screen.findByRole('region', { name: 'Où en est ma réservation' });

  it.each([
    ['RES-000101', /Paiement attendu/],
    ['RES-000103', /Paiement non validé/],
    ['RES-000104', /Nous vérifions votre paiement/],
    ['RES-000105', /Paiement validé/],
    ['RES-000106', /En préparation/],
    ['RES-000107', /Votre colis est prêt/],
    ['RES-000102', /Votre colis est prêt/],
    ['RES-000108', /En route/],
    ['RES-000109', /Livrée le/],
    ['RES-000110', /Retirée le/],
    ['RES-000111', /Réservation expirée/],
    ['RES-000112', /Réservation annulée/],
  ])('bloc d’action adapté au statut de %s', async (ref, title) => {
    renderRoute(`/reservations/${ref}`);
    const region = await actionRegion();
    expect(within(region).getByRole('heading', { name: title })).toBeInTheDocument();

    if (ref === 'RES-000101') {
      expect(within(region).getByRole('link', { name: /Payer maintenant/ })).toHaveAttribute(
        'href',
        '/reservation/RES-000101/paiement',
      );
    }
    if (ref === 'RES-000103') {
      expect(within(region).getByText('Montant incorrect')).toBeInTheDocument();
    }
    if (ref === 'RES-000102') {
      expect(within(region).getByText('Code de retrait')).toBeInTheDocument();
    }
    if (ref === 'RES-000112') {
      expect(within(region).getAllByText(/Annulée par vous/).length).toBeGreaterThan(0);
    }
  });

  it('frise lisible comme une liste ordonnée, étape en cours marquée `aria-current="step"`', async () => {
    renderRoute('/reservations/RES-000105');
    const list = await screen.findByRole('list', { name: 'Suivi de la réservation' });
    const steps = within(list).getAllByRole('listitem');
    expect(steps).toHaveLength(6);
    expect(steps[2]).toHaveAttribute('aria-current', 'step');
    expect(steps[2]).toHaveTextContent(/Étape 3 sur 6, Confirmée, le .+ à .+, en cours/);
  });

  it('annule une réservation payée avec motif : message de remboursement puis statut « Annulée »', async () => {
    renderRoute('/reservations/RES-000105');
    fireEvent.click(await screen.findByRole('button', { name: 'Annuler la réservation' }));

    const dialog = await screen.findByRole('dialog', { name: 'Annuler RES-000105 ?' });
    expect(within(dialog).getByText(/Vous avez déjà payé/)).toBeInTheDocument();
    fireEvent.click(within(dialog).getByRole('button', { name: 'Erreur de taille' }));
    fireEvent.click(within(dialog).getByRole('button', { name: 'Oui, annuler' }));

    expect(await screen.findByRole('heading', { name: /Réservation annulée/ })).toBeInTheDocument();
    expect(screen.getAllByText(/Erreur de taille/).length).toBeGreaterThan(0);
  });

  it('gère le refus 422 : message et contact WhatsApp', async () => {
    server.use(
      http.post(`${env.apiBaseUrl}/reservations/:ref/cancel`, () =>
        HttpResponse.json(
          { code: 'CANCEL_NOT_ALLOWED', message: CANCEL_NOT_ALLOWED_MESSAGE },
          { status: 422 },
        ),
      ),
    );
    renderRoute('/reservations/RES-000101');
    fireEvent.click(await screen.findByRole('button', { name: 'Annuler la réservation' }));
    const dialog = await screen.findByRole('dialog', { name: 'Annuler RES-000101 ?' });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Oui, annuler' }));

    expect(await within(dialog).findByText(CANCEL_NOT_ALLOWED_MESSAGE)).toBeInTheDocument();
    expect(within(dialog).getByRole('link', { name: /WhatsApp/ })).toHaveAttribute(
      'href',
      expect.stringContaining('https://wa.me/'),
    );
  });

  it('n’affiche pas l’annulation à partir de la préparation (`cancellable` faux)', async () => {
    renderRoute('/reservations/RES-000106');
    await actionRegion();
    expect(screen.queryByRole('button', { name: 'Annuler la réservation' })).not.toBeInTheDocument();
    expect(screen.getAllByRole('link', { name: /Contacter la boutique sur WhatsApp/ }).length).toBeGreaterThan(0);
  });

  it('signale la nouvelle étape depuis la dernière visite, puis un changement détecté en direct', async () => {
    useSeenStore.getState().markSeen('RES-000106', 'confirmed', '2026-10-29T10:00:00.000Z');
    const client = createAppQueryClient();
    renderRoute('/reservations/RES-000106', client);

    expect((await screen.findAllByText('Nouvelle étape : En préparation')).length).toBeGreaterThan(0);
    await waitFor(() => expect(useSeenStore.getState().byRef['RES-000106']?.status).toBe('preparing'));

    // La boutique avance la réservation pendant que l'écran est ouvert
    await api.post(endpoints.mock.advanceReservation('RES-000106'));
    await client.invalidateQueries({ queryKey: qk.reservation('RES-000106') });

    expect(await screen.findByRole('heading', { name: /Votre colis est parti/ })).toBeInTheDocument();
    expect((await screen.findAllByText('Nouvelle étape : Remise à l’agence')).length).toBeGreaterThan(0);
    await waitFor(() =>
      expect(useSeenStore.getState().byRef['RES-000106']?.status).toBe('handed_to_agency'),
    );
  });
});

describe('Module M5 — 7. Photo du colis prêt', () => {
  const originalMatchMedia = window.matchMedia;

  function emulateReducedMotion() {
    window.matchMedia = vi.fn().mockImplementation((query: string) => ({
      matches: query.includes('prefers-reduced-motion'),
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })) as unknown as typeof window.matchMedia;
  }

  beforeEach(() => {
    resetMockM3State();
    useSeenStore.setState({ initializedAt: new Date().toISOString(), byRef: {}, packageToastShown: [] });
    loginAsJunior();
  });

  afterEach(() => {
    window.matchMedia = originalMatchMedia;
    useAuthStore.getState().clearSession();
  });

  it('choisit le format d’affichage au plus proche de la photo (4:3, carré, 4:5 au maximum)', () => {
    expect(packagePhotoRatio({ width: 800, height: 600 })).toBe('4/3');
    expect(packagePhotoRatio({ width: 800, height: 800 })).toBe('1/1');
    expect(packagePhotoRatio({ width: 800, height: 1000 })).toBe('4/5');
    expect(packagePhotoRatio({ width: 600, height: 1200 })).toBe('4/5');
  });

  it('recharge la réservation une seule fois quand un lien de photo a expiré', () => {
    const refetch = vi.fn();
    const { result } = renderHook(() => useSignedUrlRefresh(refetch));
    expect(result.current()).toBe(true);
    expect(result.current()).toBe(false);
    expect(refetch).toHaveBeenCalledTimes(1);
  });

  it('dévoile la photo une seule fois, puis l’affiche directement aux visites suivantes', async () => {
    emulateReducedMotion(); // le dévoilement se termine immédiatement (affichage direct)
    renderRoute('/reservations/RES-000102');

    expect(await screen.findByRole('heading', { name: /Votre colis est prêt.*photos du colis/, level: 2 })).toBeInTheDocument();
    expect(screen.getByText('Vérifiez votre colis à la réception : il doit correspondre à cette photo.')).toBeInTheDocument();
    expect(screen.getByRole('img', { name: 'Photo de votre colis emballé, 1 sur 2' })).toBeInTheDocument();
    await waitFor(() => expect(useSeenStore.getState().byRef['RES-000102']?.photosRevealed).toBe(true));
    expect(document.querySelector('[data-reveal-badge]')).not.toBeNull();
  });

  it('n’anime plus la photo une fois dévoilée et l’ouvre dans la visionneuse avec « Enregistrer la photo »', async () => {
    useSeenStore.getState().markPhotosRevealed('RES-000102', 'ready_for_pickup', new Date().toISOString());
    renderRoute('/reservations/RES-000102');

    await screen.findByRole('heading', { name: /Votre colis est prêt.*photos du colis/, level: 2 });
    expect(document.querySelector('[data-reveal-badge]')).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: /Agrandir : photo de votre colis emballé, 1 sur 2/ }));
    const viewer = await screen.findByRole('dialog', { name: 'Photos de votre colis' });
    expect(within(viewer).getByRole('button', { name: /Enregistrer la photo/ })).toBeInTheDocument();
  });

  it('signale à l’ouverture de l’app les colis prêts dont les photos n’ont pas été vues, une seule fois', async () => {
    renderRoute('/');
    expect(await screen.findByText('3 colis sont prêts : leurs photos vous attendent')).toBeInTheDocument();
    expect(useSeenStore.getState().packageToastShown).toEqual(
      expect.arrayContaining(['RES-000102', 'RES-000107', 'RES-000108']),
    );
  });

  it('renvoie vers la photo depuis la carte de « Mes réservations »', async () => {
    renderRoute('/reservations');
    const links = await screen.findAllByRole('link', { name: /Voir mon colis/ });
    expect(links.map((l) => l.getAttribute('href'))).toContain('/reservations/RES-000102#colis');
    await act(async () => undefined);
  });
});

describe('Module M5 — 8. Profil, adresses et informations', () => {
  beforeEach(() => {
    resetMockM3State();
    useSeenStore.setState({ initializedAt: new Date().toISOString(), byRef: {}, packageToastShown: [] });
    loginAsJunior();
  });

  afterEach(() => {
    useAuthStore.getState().clearSession();
    useCartStore.getState().clear();
  });

  const cardFor = async (label: string) =>
    (await screen.findByRole('heading', { name: label, level: 2 })).closest('article') as HTMLElement;

  it('définit une autre adresse par défaut : une seule étiquette « Par défaut », placée en tête', async () => {
    renderRoute('/profil/adresses');
    const bureau = await cardFor('Bureau');
    fireEvent.click(within(bureau).getByRole('button', { name: /Actions pour l’adresse Bureau/ }));
    fireEvent.click(await screen.findByRole('button', { name: 'Définir par défaut' }));

    await waitFor(() => {
      const headings = screen.getAllByRole('heading', { level: 2 }).map((h) => h.textContent);
      expect(headings.indexOf('Bureau')).toBeLessThan(headings.indexOf('Maison'));
    });
    expect(screen.getAllByText('Par défaut')).toHaveLength(1);
    expect(within(await cardFor('Bureau')).getByText('Par défaut')).toBeInTheDocument();
  });

  it('supprime une adresse avec « Annuler » pendant 5 s, puis définitivement', async () => {
    renderRoute('/profil/adresses');
    const openDelete = async () => {
      const maison = await cardFor('Maison');
      fireEvent.click(within(maison).getByRole('button', { name: /Actions pour l’adresse Maison/ }));
      fireEvent.click(await screen.findByRole('button', { name: 'Supprimer' }));
      const confirm = await screen.findByRole('dialog', { name: /Supprimer « Maison »/ });
      fireEvent.click(within(confirm).getByRole('button', { name: 'Supprimer' }));
    };

    await openDelete();
    await waitFor(() => expect(screen.queryByRole('heading', { name: 'Maison', level: 2 })).not.toBeInTheDocument());
    fireEvent.click(await screen.findByRole('button', { name: 'Annuler' }));
    expect(await screen.findByRole('heading', { name: 'Maison', level: 2 })).toBeInTheDocument();

    await openDelete();
    await waitFor(() => expect(screen.queryByRole('heading', { name: 'Maison', level: 2 })).not.toBeInTheDocument());
    await waitFor(
      async () => {
        const list = await api.get<Address[]>(endpoints.me.addresses);
        expect(list.map((a) => a.label)).toEqual(['Bureau']);
      },
      { timeout: 7000, interval: 250 },
    );
  }, 15_000);

  it('modifie le prénom : message, retour au profil et en-tête mis à jour', async () => {
    renderRoute('/profil/informations');
    const firstName = await screen.findByLabelText(/PRÉNOM/);
    fireEvent.change(firstName, { target: { value: 'Jules' } });
    expect(screen.getByLabelText('TÉLÉPHONE')).toHaveAttribute('readonly');
    fireEvent.click(screen.getByRole('button', { name: 'Enregistrer' }));

    expect(await screen.findByText('Vos informations sont enregistrées')).toBeInTheDocument();
    expect(await screen.findByRole('heading', { name: /Jules Mbarga/, level: 1 })).toBeInTheDocument();
  });

  it('se déconnecte en conservant le panier sur le téléphone', async () => {
    useCartStore.getState().add({
      productId: 'prod-12',
      slug: 'tshirt-essentiel-lourd',
      name: 'T-shirt Essentiel Lourd',
      image: '/mock/product-tee.svg',
      variantId: 'prod-12-noir-m',
      size: 'M',
      color: { code: 'noir', name: 'Noir Charbon', hex: '#1A1A18' },
      unitPrice: 12000,
      quantity: 1,
      maxQuantity: 5,
    });
    renderRoute('/profil');
    fireEvent.click(await screen.findByRole('button', { name: /Se déconnecter/ }));
    const dialog = await screen.findByRole('dialog', { name: 'Se déconnecter ?' });
    expect(within(dialog).getByText('Votre panier sera conservé sur ce téléphone.')).toBeInTheDocument();
    fireEvent.click(within(dialog).getByRole('button', { name: 'Me déconnecter' }));

    expect(await screen.findByRole('button', { name: 'Me connecter avec mon numéro' })).toBeInTheDocument();
    expect(useAuthStore.getState().status).toBe('guest');
    expect(useCartStore.getState().items).toHaveLength(1);
    expect(await screen.findByText('Vous êtes déconnecté. À bientôt !')).toBeInTheDocument();
  });

  it('ouvre la feuille des notifications depuis le profil', async () => {
    renderRoute('/profil?notifications=1');
    const sheet = await screen.findByRole('dialog', { name: 'Notifications' });
    expect(within(sheet).getByText(/paiement est validé, quand votre colis est prêt/)).toBeInTheDocument();
    // jsdom ne fournit pas l'API Notification
    expect(within(sheet).getByRole('status')).toHaveTextContent('Non disponibles');
  });
});

describe('Module M5 — 9. Repère de l’onglet Réservations', () => {
  beforeEach(() => {
    resetMockM3State();
    useSeenStore.setState({ initializedAt: new Date().toISOString(), byRef: {}, packageToastShown: [] });
    loginAsJunior();
  });

  afterEach(() => {
    useAuthStore.getState().clearSession();
  });

  const attentionLabel = () => screen.queryAllByText(/une réservation demande votre attention/);

  it('apparaît quand une action est attendue, disparaît une fois les réservations ouvertes, revient sur un changement', async () => {
    const client = createAppQueryClient();
    renderRoute('/explorer', client);

    // Paiement attendu (RES-000101), paiement rejeté (RES-000103), colis à retirer (RES-000102)
    await waitFor(() => expect(attentionLabel().length).toBeGreaterThan(0));

    const summary = await api.get<ReservationsSummary>(endpoints.reservations.summary);
    act(() => {
      for (const item of summary.items) {
        useSeenStore.getState().markSeen(item.ref, item.status, item.updatedAt);
      }
    });
    await waitFor(() => expect(attentionLabel()).toHaveLength(0));

    // La boutique fait avancer une réservation : le repère revient
    await api.post(endpoints.mock.advanceReservation('RES-000105'));
    await client.invalidateQueries({ queryKey: qk.reservationsSummary() });
    await waitFor(() => expect(attentionLabel().length).toBeGreaterThan(0));
  });
});

describe('Module M5 — 10. « Réserver à nouveau »', () => {
  beforeEach(() => {
    resetMockM3State();
    useCartStore.getState().clear();
  });

  it('remet au panier seulement les articles encore disponibles (RES-000109 contient un article épuisé)', async () => {
    const reservation = mockReservations['RES-000109']!;
    const result = await restoreReservationItemsToCart(reservation.items);

    expect(result).toEqual({ added: 2, unavailable: 1 });
    expect(rebookToastMessage(result)).toBe('2 articles ajoutés · 1 n’est plus disponible');
    const slugs = useCartStore.getState().items.map((i) => i.slug);
    expect(slugs).toEqual(['pantalon-large-atelier', 'tshirt-essentiel-lourd']);
    expect(slugs).not.toContain('tshirt-archive-01');
  });

  it('depuis le détail d’une réservation livrée : bilan, puis ouverture du panier', async () => {
    loginAsJunior();
    const router = renderRoute('/reservations/RES-000109');
    const region = await screen.findByRole('region', { name: 'Où en est ma réservation' });
    fireEvent.click(within(region).getByRole('button', { name: /Réserver à nouveau/ }));

    expect((await screen.findAllByText('2 articles ajoutés · 1 n’est plus disponible')).length).toBeGreaterThan(0);
    await waitFor(() => expect(router.state.location.pathname).toBe('/panier'));
    useAuthStore.getState().clearSession();
  });
});

describe('Module M5 — 11. Correctifs issus de la revue de code', () => {
  beforeEach(() => {
    resetMockM3State();
    useSeenStore.setState({ initializedAt: new Date().toISOString(), byRef: {}, packageToastShown: [] });
    useToastStore.getState().clear();
    loginAsJunior();
  });

  afterEach(() => {
    useAuthStore.getState().clearSession();
  });

  it('quitter la page des adresses valide la suppression et retire le « Annuler » devenu inutile', async () => {
    renderRoute('/profil/adresses');
    const bureau = (await screen.findByRole('heading', { name: 'Bureau', level: 2 })).closest('article') as HTMLElement;
    fireEvent.click(within(bureau).getByRole('button', { name: /Actions pour l’adresse Bureau/ }));
    fireEvent.click(await screen.findByRole('button', { name: 'Supprimer' }));
    fireEvent.click(within(await screen.findByRole('dialog', { name: /Supprimer « Bureau »/ })).getByRole('button', { name: 'Supprimer' }));
    expect(await screen.findByRole('button', { name: 'Annuler' })).toBeInTheDocument();

    fireEvent.click(screen.getAllByRole('link', { name: /Profil/ })[0]!);
    await screen.findByRole('heading', { name: /Junior Mbarga/, level: 1 });

    // Le retrait du toast suit le démontage de la page : sous charge il peut arriver un instant plus tard
    await waitFor(() =>
      expect(useToastStore.getState().toasts.some((t) => t.actionLabel === 'Annuler')).toBe(false),
    );
    await waitFor(async () => {
      const list = await api.get<Address[]>(endpoints.me.addresses);
      expect(list.map((a) => a.label)).toEqual(['Maison']);
    });
  });

  it('efface l’agence quand une adresse d’agence devient une adresse à Douala', async () => {
    const payload = formValuesToAddressPayload(
      {
        label: 'Autre',
        city: 'Douala',
        district: 'Akwa',
        landmark: 'Face à la boulangerie',
        agencyId: '',
        recipientType: 'self',
        recipientName: '',
        recipientPhone: '',
      },
      { user: JUNIOR_SESSION_USER },
    );
    expect(payload.agencyId).toBeNull();

    const created = await api.post<Address>(endpoints.me.addresses, {
      label: 'Autre',
      city: 'Yaoundé',
      district: 'Yaoundé',
      landmark: 'Agence Express Centre',
      receptionMode: 'delivery',
      agencyId: 'ag-yde-1',
    });
    const updated = await api.patch<Address>(endpoints.me.address(created.id), payload);
    expect(updated.agencyId).toBeUndefined();
    expect(updated.city).toBe('Douala');
  });

  it('annuler soi-même n’affiche qu’un message, sans « Nouvelle étape »', async () => {
    renderRoute('/reservations/RES-000101');
    fireEvent.click(await screen.findByRole('button', { name: 'Annuler la réservation' }));
    const dialog = await screen.findByRole('dialog', { name: 'Annuler RES-000101 ?' });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Oui, annuler' }));

    expect(await screen.findByRole('heading', { name: /Réservation annulée/ })).toBeInTheDocument();
    await waitFor(() =>
      expect(useToastStore.getState().toasts.map((t) => t.message)).toContain('Réservation RES-000101 annulée'),
    );
    expect(useToastStore.getState().toasts.some((t) => t.message.startsWith('Nouvelle étape'))).toBe(false);
  });
});
