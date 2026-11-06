import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { setupServer } from 'msw/node';
import { RouterProvider } from 'react-router';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { AppProviders } from '@/app/providers';
import { createTestRouter } from '@/app/router';
import { sanitizeAdminRedirect } from '@/features/admin/auth/adminRedirect';
import { useAdminAuthStore } from '@/features/admin/auth/adminAuthStore';
import { createAppQueryClient } from '@/lib/api/queryClient';
import { DEMO_ADMIN_ACCOUNTS } from '@/mocks/adminHandlers';
import { handlers, resetMockM3State } from '@/mocks/handlers';
import { useAuthStore } from '@/stores/authStore';

const server = setupServer(...handlers);

const LAZY_TIMEOUT = { timeout: 6000 };

function renderAdminApp(initialPath = '/admin') {
  const router = createTestRouter([initialPath]);
  const queryClient = createAppQueryClient();
  render(
    <AppProviders client={queryClient}>
      <RouterProvider router={router} />
    </AppProviders>,
  );
  return { router, queryClient };
}

function authenticateDemoAdmin() {
  const owner = DEMO_ADMIN_ACCOUNTS[0]!.user;
  act(() => {
    useAdminAuthStore.getState().setAdminSession(`mock-admin-jwt-token-${owner.id}`, owner);
  });
}

beforeAll(() => {
  server.listen();
});

beforeEach(() => {
  resetMockM3State();
  act(() => {
    useAdminAuthStore.getState().clearAdminSession();
    useAuthStore.getState().clearSession();
  });
});

afterEach(() => {
  server.resetHandlers();
  act(() => {
    useAdminAuthStore.getState().clearAdminSession();
    useAuthStore.getState().clearSession();
  });
});

afterAll(() => {
  server.close();
});

describe('Module A1 · Socle admin, authentification et tableau de bord', () => {
  it('1. redirige un visiteur non connecté vers /admin/connexion avec ?redirect= et filtre les cibles externes', async () => {
    expect(sanitizeAdminRedirect('/admin/reservations/RES-000101')).toBe(
      '/admin/reservations/RES-000101',
    );
    expect(sanitizeAdminRedirect('https://evil.example/phish')).toBe('/admin');
    expect(sanitizeAdminRedirect('//evil.example')).toBe('/admin');
    expect(sanitizeAdminRedirect('/admin/connexion')).toBe('/admin');

    const { router } = renderAdminApp('/admin/reservations/RES-000101');

    expect(
      await screen.findByRole('heading', { name: /Connexion boutique/i }, LAZY_TIMEOUT),
    ).toBeInTheDocument();

    expect(router.state.location.pathname).toBe('/admin/connexion');
    expect(router.state.location.search).toBe(
      '?redirect=%2Fadmin%2Freservations%2FRES-000101',
    );
  });

  it('2. valide le formulaire de connexion, affiche une erreur 401 sur mauvais mot de passe et redirige vers la cible après succès', async () => {
    const { router } = renderAdminApp(
      '/admin/connexion?redirect=%2Fadmin%2Freservations%2FRES-000101',
    );

    const identifierInput = await screen.findByLabelText(
      /Identifiant \(e-mail ou téléphone\)/i,
      {},
      LAZY_TIMEOUT,
    );
    const passwordInput = screen.getByLabelText(/^Mot de passe$/i);
    const submitBtn = screen.getByRole('button', { name: /Se connecter/i });

    // Mauvais mot de passe -> 401
    fireEvent.change(identifierInput, { target: { value: 'admin@drchoco.cm' } });
    fireEvent.change(passwordInput, { target: { value: 'mauvais-mdp' } });
    fireEvent.click(submitBtn);

    expect(
      await screen.findByRole('alert', {}, LAZY_TIMEOUT),
    ).toHaveTextContent(/Identifiant ou mot de passe incorrect/i);

    // Bon mot de passe -> redirection vers /admin/reservations/RES-000101
    fireEvent.change(passwordInput, { target: { value: 'choco2026' } });
    fireEvent.click(submitBtn);

    expect(
      await screen.findByRole('heading', { name: /Réservation RES-000101/i }, LAZY_TIMEOUT),
    ).toBeInTheDocument();
    expect(router.state.location.pathname).toBe('/admin/reservations/RES-000101');
  });

  it('3. isole strictement la session admin (useAdminAuthStore) de la session client (useAuthStore)', () => {
    useAuthStore.getState().setSession('client-jwt', {
      id: 'usr-junior-01',
      phone: '+237690000001',
      firstName: 'Junior',
      createdAt: '2026-09-15T10:00:00.000Z',
    });

    authenticateDemoAdmin();

    expect(useAdminAuthStore.getState().status).toBe('authenticated');
    expect(useAdminAuthStore.getState().admin?.email).toBe('admin@drchoco.cm');
    expect(useAuthStore.getState().status).toBe('authenticated');
    expect(useAuthStore.getState().user?.firstName).toBe('Junior');

    // La déconnexion de l'administrateur ne déconnecte pas le client
    useAdminAuthStore.getState().clearAdminSession();
    expect(useAdminAuthStore.getState().status).toBe('guest');
    expect(useAuthStore.getState().status).toBe('authenticated');
    expect(useAuthStore.getState().user?.firstName).toBe('Junior');
  });

  it('4. affiche le tableau de bord opérationnel (/admin), la file « À traiter maintenant », les KPI par période et les alertes de stock', async () => {
    authenticateDemoAdmin();
    renderAdminApp('/admin');

    expect(
      await screen.findByRole('heading', { name: /Bonjour, Gérant DR Choco/i }, LAZY_TIMEOUT),
    ).toBeInTheDocument();

    // Attend que les données du tableau de bord soient chargées (file d'attente visible)
    expect(await screen.findAllByText('RES-000104', {}, LAZY_TIMEOUT)).not.toHaveLength(0);
    expect(screen.getAllByText('RES-000105').length).toBeGreaterThan(0);

    // Compteurs d'action prioritaire
    expect(screen.getByText('Preuves à valider')).toBeInTheDocument();
    expect(screen.getByText('Colis à préparer')).toBeInTheDocument();
    expect(screen.getByText('Prêts à remettre')).toBeInTheDocument();
    expect(screen.getByText('Expirent bientôt')).toBeInTheDocument();

    // Bascule des statistiques par période (Aujourd'hui -> 30 derniers jours)
    const todayBtn = screen.getByRole('button', { name: /Aujourd’hui/i });
    fireEvent.click(todayBtn);
    expect(todayBtn).toHaveAttribute('aria-pressed', 'true');
    expect(
      screen.getByRole('heading', { name: /Activité sur la période \(Aujourd’hui\)/i }),
    ).toBeInTheDocument();

    const thirtyDaysBtn = screen.getByRole('button', { name: /30 derniers jours/i });
    fireEvent.click(thirtyDaysBtn);
    expect(thirtyDaysBtn).toHaveAttribute('aria-pressed', 'true');
    expect(
      screen.getByRole('heading', { name: /Activité sur la période \(30 derniers jours\)/i }),
    ).toBeInTheDocument();

    // Alertes de stock (ruptures et stock faible issues des fixtures produits)
    expect(screen.getByRole('heading', { name: /Alertes de stock/i })).toBeInTheDocument();
    expect(screen.getByText(/en rupture/i)).toBeInTheDocument();
  });

  it('5. permet de rechercher une réservation (RES-000102) ou un produit via la recherche rapide et d’y accéder', async () => {
    authenticateDemoAdmin();
    const { router } = renderAdminApp('/admin');

    expect(
      await screen.findByRole('heading', { name: /Bonjour, Gérant DR Choco/i }, LAZY_TIMEOUT),
    ).toBeInTheDocument();

    const searchTrigger = screen.getByRole('button', {
      name: /Rechercher une réservation, un numéro ou un produit/i,
    });
    fireEvent.click(searchTrigger);

    const dialog = await screen.findByRole('dialog', {
      name: /Recherche rapide dans l’administration/i,
    });
    const searchInput = within(dialog).getByRole('searchbox');

    fireEvent.change(searchInput, { target: { value: 'RES-000102' } });

    const reservationResult = await within(dialog).findByText('RES-000102', {}, LAZY_TIMEOUT);
    fireEvent.click(reservationResult);

    await waitFor(() => {
      expect(router.state.location.pathname).toBe('/admin/reservations/RES-000102');
    });
    expect(
      await screen.findByRole('heading', { name: /Réservation RES-000102/i }, LAZY_TIMEOUT),
    ).toBeInTheDocument();
  });
});
