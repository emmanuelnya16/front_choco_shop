import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { setupServer } from 'msw/node';
import { RouterProvider } from 'react-router';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { AppProviders } from '@/app/providers';
import { createTestRouter } from '@/app/router';
import { applyDefaultAddress, removeAddress } from '@/features/profile/api/useAddressMutations';
import { rebookToastMessage } from '@/features/tracking/api/useRebook';
import { getCardAction } from '@/features/tracking/cardAction';
import { createAppQueryClient } from '@/lib/api/queryClient';
import { useAuthStore } from '@/stores/authStore';
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

function renderRoute(path: string) {
  const router = createTestRouter([path]);
  render(
    <AppProviders client={createAppQueryClient()}>
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
