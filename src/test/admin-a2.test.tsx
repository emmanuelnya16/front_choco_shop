import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { setupServer } from 'msw/node';
import { RouterProvider } from 'react-router';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { AppProviders } from '@/app/providers';
import { createTestRouter } from '@/app/router';
import { useAdminAuthStore } from '@/features/admin/auth/adminAuthStore';
import { createAppQueryClient } from '@/lib/api/queryClient';
import { DEMO_ADMIN_ACCOUNTS } from '@/mocks/adminHandlers';
import { mockProducts } from '@/mocks/fixtures/products';
import { mockReservations } from '@/mocks/fixtures/reservations';
import { handlers, resetMockM3State } from '@/mocks/handlers';
import { useToastStore } from '@/stores/toastStore';

const server = setupServer(...handlers);

const LAZY_TIMEOUT = { timeout: 6000 };

function authenticateDemoAdmin() {
  const owner = DEMO_ADMIN_ACCOUNTS[0]!.user;
  act(() => {
    useAdminAuthStore.getState().setAdminSession(`mock-admin-jwt-token-${owner.id}`, owner);
  });
}

function renderAdminApp(initialPath: string) {
  const router = createTestRouter([initialPath]);
  const queryClient = createAppQueryClient();
  render(
    <AppProviders client={queryClient}>
      <RouterProvider router={router} />
    </AppProviders>,
  );
  return { router, queryClient };
}

beforeAll(() => {
  server.listen();
});

beforeEach(() => {
  resetMockM3State();
  act(() => {
    useToastStore.getState().clear();
  });
  authenticateDemoAdmin();
});

afterEach(() => {
  server.resetHandlers();
  act(() => {
    useAdminAuthStore.getState().clearAdminSession();
    useToastStore.getState().clear();
  });
});

afterAll(() => {
  server.close();
});

describe('Module A2 · Réservations, preuves Mobile Money et photos du colis', () => {
  it('1. filtre la liste des réservations (/admin/reservations) par onglet opérationnel, recherche et mode de réception', async () => {
    renderAdminApp('/admin/reservations');

    expect(
      await screen.findByRole(
        'heading',
        { name: /Réservations & Preuves Mobile Money/i },
        LAZY_TIMEOUT,
      ),
    ).toBeInTheDocument();

    // Attend le chargement initial (onglet Toutes par défaut)
    expect(await screen.findAllByText('RES-000104', {}, LAZY_TIMEOUT)).not.toHaveLength(0);

    // Bascule sur l'onglet « À valider » (uniquement pending_validation -> RES-000104)
    const toValidateTab = screen.getByRole('tab', { name: /À valider/i });
    fireEvent.click(toValidateTab);

    await waitFor(() => {
      expect(screen.getAllByText('RES-000104').length).toBeGreaterThan(0);
      expect(screen.queryByText('RES-000105')).not.toBeInTheDocument();
    });

    // Bascule sur l'onglet « À préparer » (confirmed / preparing -> RES-000105, RES-000106, RES-000113)
    const toPrepareTab = screen.getByRole('tab', { name: /À préparer/i });
    fireEvent.click(toPrepareTab);

    await waitFor(() => {
      expect(screen.getAllByText('RES-000105').length).toBeGreaterThan(0);
      expect(screen.getAllByText('RES-000106').length).toBeGreaterThan(0);
    });

    // Filtre par recherche sur « Aïcha » (RES-000113)
    const searchInput = screen.getByRole('searchbox', {
      name: /Filtrer par référence, nom ou téléphone/i,
    });
    fireEvent.change(searchInput, { target: { value: 'Aïcha' } });

    await waitFor(() => {
      expect(screen.getAllByText('RES-000113').length).toBeGreaterThan(0);
      expect(screen.queryByText('RES-000105')).not.toBeInTheDocument();
    });
  });

  it('2. vérifie et valide en 1 appui une preuve Mobile Money (/admin/reservations/RES-000104)', async () => {
    renderAdminApp('/admin/reservations/RES-000104');

    expect(
      await screen.findByRole('heading', { name: /Réservation RES-000104/i }, LAZY_TIMEOUT),
    ).toBeInTheDocument();

    expect(
      await screen.findByRole(
        'heading',
        { name: /Vérification du paiement Mobile Money/i },
        LAZY_TIMEOUT,
      ),
    ).toBeInTheDocument();

    expect(screen.getByText(/Empreinte unique vérifiée ✓/i)).toBeInTheDocument();

    const validateBtn = screen.getByRole('button', { name: /Valider le paiement ✓/i });
    fireEvent.click(validateBtn);

    await waitFor(() => {
      expect(mockReservations['RES-000104']?.status).toBe('confirmed');
    });

    const lastEvent = mockReservations['RES-000104']?.timeline.at(-1);
    expect(lastEvent?.status).toBe('confirmed');
    expect(lastEvent?.actor).toBe('shop');

    expect(
      await screen.findByRole(
        'heading',
        { name: /Paiement confirmé · Préparer et photographier le colis/i },
        LAZY_TIMEOUT,
      ),
    ).toBeInTheDocument();
  });

  it('3. rejette une preuve Mobile Money avec motif obligatoire et l’enregistre pour le client', async () => {
    renderAdminApp('/admin/reservations/RES-000104');

    expect(
      await screen.findByRole('heading', { name: /Réservation RES-000104/i }, LAZY_TIMEOUT),
    ).toBeInTheDocument();

    const openRejectBtn = await screen.findByRole(
      'button',
      { name: /Rejeter la preuve…/i },
      LAZY_TIMEOUT,
    );
    fireEvent.click(openRejectBtn);

    const confirmRejectBtn = await screen.findByRole('button', {
      name: /Confirmer le rejet/i,
    });

    // Motif vide refusé
    fireEvent.click(confirmRejectBtn);
    expect(
      await screen.findByText(/Veuillez sélectionner ou saisir un motif/i),
    ).toBeInTheDocument();

    // Sélection d'un motif rapide en 1 appui
    const quickChip = screen.getByRole('button', { name: 'Montant incorrect' });
    fireEvent.click(quickChip);
    fireEvent.click(confirmRejectBtn);

    await waitFor(() => {
      expect(mockReservations['RES-000104']?.status).toBe('payment_rejected');
      expect(mockReservations['RES-000104']?.rejection?.reason).toBe('Montant incorrect');
    });

    const lastEvent = mockReservations['RES-000104']?.timeline.at(-1);
    expect(lastEvent?.status).toBe('payment_rejected');
    expect(lastEvent?.actor).toBe('shop');
    expect(lastEvent?.note).toBe('Montant incorrect');
  });

  it('4. signale une alerte de sécurité si l’empreinte SHA-256 de la capture a déjà servi sur une autre réservation', async () => {
    // Assigne la même empreinte SHA-256 à RES-000104 et RES-000105
    mockReservations['RES-000104']!.proof = {
      thumbnailUrl: '/mock/preuve-1.svg',
      uploadedAt: new Date().toISOString(),
      operator: 'orange',
      sha256: 'sha256-collision-test-999',
    };
    mockReservations['RES-000105']!.proof = {
      thumbnailUrl: '/mock/preuve-1.svg',
      uploadedAt: new Date().toISOString(),
      operator: 'orange',
      sha256: 'sha256-collision-test-999',
    };

    renderAdminApp('/admin/reservations/RES-000104');

    expect(
      await screen.findByText(
        /Attention\s*: cette capture a déjà été utilisée sur/i,
        {},
        LAZY_TIMEOUT,
      ),
    ).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'RES-000105' })).toBeInTheDocument();
  });

  it('5. joint 1 à 3 photos du colis prêt, passe en prête pour retrait / remise agence, puis confirme le retrait', async () => {
    renderAdminApp('/admin/reservations/RES-000105');

    expect(
      await screen.findByRole('heading', { name: /Réservation RES-000105/i }, LAZY_TIMEOUT),
    ).toBeInTheDocument();

    // Ajoute 2 photos de colis de démonstration
    const demoPhotosBtn = await screen.findByRole(
      'button',
      { name: /Utiliser 2 photos de colis de démo/i },
      LAZY_TIMEOUT,
    );
    fireEvent.click(demoPhotosBtn);

    expect(screen.getByAltText('Aperçu photo colis 1')).toBeInTheDocument();
    expect(screen.getByAltText('Aperçu photo colis 2')).toBeInTheDocument();

    // Valide le colis prêt
    const submitPackageBtn = screen.getByRole('button', {
      name: /Valider le colis prêt et notifier le client/i,
    });
    fireEvent.click(submitPackageBtn);

    await waitFor(() => {
      expect(mockReservations['RES-000105']?.status).toBe('ready_for_pickup');
      expect(mockReservations['RES-000105']?.packagePhotos).toHaveLength(2);
      expect(mockReservations['RES-000105']?.packageReadyAt).toBeTruthy();
    });

    // Confirme ensuite le retrait en boutique au comptoir
    const confirmPickupBtn = await screen.findByRole(
      'button',
      { name: /Confirmer le retrait en boutique ✓/i },
      LAZY_TIMEOUT,
    );
    fireEvent.click(confirmPickupBtn);

    await waitFor(() => {
      expect(mockReservations['RES-000105']?.status).toBe('picked_up');
    });
  });

  it('6. annule une réservation côté boutique avec motif obligatoire, remet le stock en vente et permet d’ajouter une note interne', async () => {
    const res = mockReservations['RES-000105']!;
    const item = res.items[0]!;
    const product = mockProducts.find((p) => p.id === item.productId)!;
    const variantBefore = product.variants.find((v) => v.id === item.variantId)!;
    const stockBefore = variantBefore.stock;

    renderAdminApp('/admin/reservations/RES-000105');

    expect(
      await screen.findByRole('heading', { name: /Réservation RES-000105/i }, LAZY_TIMEOUT),
    ).toBeInTheDocument();

    // Ajoute d'abord une note interne
    const noteInput = await screen.findByPlaceholderText(
      /Ajouter une consigne interne/i,
      {},
      LAZY_TIMEOUT,
    );
    fireEvent.change(noteInput, {
      target: { value: 'Client joint au téléphone à 14 h 30.' },
    });
    fireEvent.click(screen.getByRole('button', { name: /Ajouter la note/i }));

    expect(
      await screen.findByText('Client joint au téléphone à 14 h 30.'),
    ).toBeInTheDocument();

    // Ouvre la feuille d'annulation côté boutique
    fireEvent.click(screen.getByRole('button', { name: /Annuler la réservation…/i }));

    // Rappelle que le client avait déjà payé
    expect(await screen.findByText(/Remboursement à effectuer/i)).toBeInTheDocument();

    // Choisit un motif et confirme l'annulation
    fireEvent.click(
      screen.getByRole('button', { name: 'Demande téléphonique du client' }),
    );
    fireEvent.click(
      screen.getByRole('button', {
        name: /Confirmer l’annulation et remettre en stock/i,
      }),
    );

    await waitFor(() => {
      expect(mockReservations['RES-000105']?.status).toBe('cancelled');
    });

    const variantAfter = product.variants.find((v) => v.id === item.variantId)!;
    expect(variantAfter.stock).toBe(stockBefore + item.quantity);

    const lastEvent = mockReservations['RES-000105']?.timeline.at(-1);
    expect(lastEvent?.status).toBe('cancelled');
    expect(lastEvent?.actor).toBe('shop');
    expect(lastEvent?.note).toBe('Demande téléphonique du client');
  });
});

