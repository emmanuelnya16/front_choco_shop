import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { setupServer } from 'msw/node';
import { RouterProvider } from 'react-router';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { AppProviders } from '@/app/providers';
import { createTestRouter } from '@/app/router';
import { useAdminAuthStore } from '@/features/admin/auth/adminAuthStore';
import { createAppQueryClient } from '@/lib/api/queryClient';
import { DEMO_ADMIN_ACCOUNTS } from '@/mocks/adminHandlers';
import { mockContentPages } from '@/mocks/fixtures/pages';
import {
  mockAgencies,
  mockDeliveryCities,
  mockPublicSettings,
} from '@/mocks/fixtures/settings';
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

describe('Module A4 · Paramètres, livraison/agences, contenus et répertoire clients', () => {
  it('1. met à jour un code marchand et la formule USSD avec aperçu en direct (/admin/parametres/paiement) ainsi que la boutique (/admin/parametres/boutique)', async () => {
    renderAdminApp('/admin/parametres/paiement');

    expect(
      await screen.findByRole(
        'heading',
        { name: /Paramètres de la boutique/i },
        LAZY_TIMEOUT,
      ),
    ).toBeInTheDocument();

    // Modification du code marchand et de la formule USSD Orange Money
    const orangeCodeInput = await screen.findByLabelText(
      /Code marchand \(Orange Money\)/i,
      {},
      LAZY_TIMEOUT,
    );
    fireEvent.change(orangeCodeInput, { target: { value: '778899' } });

    const orangeUssdInput = screen.getByLabelText(/Formule USSD \(Orange Money\)/i);
    fireEvent.change(orangeUssdInput, {
      target: { value: '#150*47*{code}*{amount}#' },
    });

    // Vérifie l'aperçu en direct pour un panier de 45 000 FCFA
    const previewEl = screen.getByTestId('ussd-preview-orange');
    expect(previewEl.textContent).toBe('#150*47*778899*45000#');

    // Enregistrement des paramètres de paiement
    const savePaymentBtn = screen.getByRole('button', {
      name: /Enregistrer les paramètres de paiement/i,
    });
    fireEvent.click(savePaymentBtn);

    await waitFor(() => {
      const orangeOp = mockPublicSettings.payment.operators.find(
        (o) => o.id === 'orange',
      )!;
      expect(orangeOp.merchantCode).toBe('778899');
      expect(orangeOp.ussdTemplate).toBe('#150*47*{code}*{amount}#');
    });

    // Bascule sur l'onglet « Boutique & WhatsApp »
    const boutiqueTab = screen.getByRole('tab', { name: /Boutique & WhatsApp/i });
    fireEvent.click(boutiqueTab);

    const whatsappInput = await screen.findByLabelText(
      /Numéro WhatsApp officiel/i,
      {},
      LAZY_TIMEOUT,
    );
    fireEvent.change(whatsappInput, { target: { value: '+237 699 88 77 66' } });

    const saveShopBtn = screen.getByRole('button', {
      name: /Enregistrer les informations boutique/i,
    });
    fireEvent.click(saveShopBtn);

    await waitFor(() => {
      expect(mockPublicSettings.whatsappNumber).toBe('+237699887766');
    });
  });

  it('2. ajoute une ville de livraison et une agence de transport (/admin/parametres/livraison)', async () => {
    const initialCitiesCount = mockDeliveryCities.length;
    const initialAgenciesCount = mockAgencies.length;

    renderAdminApp('/admin/parametres/livraison');

    expect(
      await screen.findByRole(
        'heading',
        { name: /1\. Villes de livraison/i },
        LAZY_TIMEOUT,
      ),
    ).toBeInTheDocument();

    // Ajout d'une nouvelle ville « Sangmélima »
    const addCityBtn = screen.getByRole('button', { name: /Ajouter une ville/i });
    fireEvent.click(addCityBtn);

    const cityNameInput = screen.getByLabelText(/Nom de la ville/i);
    fireEvent.change(cityNameInput, { target: { value: 'Sangmélima' } });

    const cityFeeInput = screen.getByLabelText(/Tarif livraison \(FCFA\)/i);
    fireEvent.change(cityFeeInput, { target: { value: '3500' } });

    const createCityBtn = screen.getByRole('button', { name: /Créer la ville/i });
    fireEvent.click(createCityBtn);

    await waitFor(() => {
      expect(mockDeliveryCities.length).toBe(initialCitiesCount + 1);
      expect(
        mockDeliveryCities.some((c) => c.name === 'Sangmélima' && c.fee === 3500),
      ).toBe(true);
    });

    // Ajout d'une nouvelle agence de transport
    const addAgencyBtn = screen.getByRole('button', { name: /Ajouter une agence/i });
    fireEvent.click(addAgencyBtn);

    const agencyNameInput = screen.getByLabelText(/Nom de l’agence/i);
    fireEvent.change(agencyNameInput, {
      target: { value: 'Bucheron Express Sud' },
    });

    const agencyAddressInput = screen.getByLabelText(/Adresse & repère/i);
    fireEvent.change(agencyAddressInput, {
      target: { value: 'Carrefour Marché Central' },
    });

    const createAgencyBtn = screen.getByRole('button', {
      name: /Créer l’agence/i,
    });
    fireEvent.click(createAgencyBtn);

    await waitFor(() => {
      expect(mockAgencies.length).toBe(initialAgenciesCount + 1);
      expect(
        mockAgencies.some((a) => a.name === 'Bucheron Express Sud'),
      ).toBe(true);
    });
  });

  it('3. édite une page légale en Markdown (/admin/contenus), réduit le compteur [À COMPLÉTER] et met à jour le contenu public', async () => {
    renderAdminApp('/admin/contenus');

    expect(
      await screen.findByRole(
        'heading',
        { name: /Pages légales, Guides d’aide & FAQ/i },
        LAZY_TIMEOUT,
      ),
    ).toBeInTheDocument();

    const markdownTextarea = (await screen.findByLabelText(
      /Contenu Markdown de la page/i,
      {},
      LAZY_TIMEOUT,
    )) as HTMLTextAreaElement;

    const initialPlaceholders = (
      markdownTextarea.value.match(/\[À COMPLÉTER[^\]]*\]/gi) ?? []
    ).length;
    expect(initialPlaceholders).toBeGreaterThan(0);

    // Remplace tous les passages [À COMPLÉTER...] par la mention officielle validée
    const cleanedMarkdown = markdownTextarea.value.replace(
      /\[À COMPLÉTER[^\]]*\]/gi,
      'ETS DR CHOCO L’INCOMPRIS — RCCM RC/DLA/2026/B/1042',
    );
    fireEvent.change(markdownTextarea, { target: { value: cleanedMarkdown } });

    // Vérifie que l'aperçu en direct reflète immédiatement le nouveau texte
    const previewBox = screen.getByTestId('markdown-live-preview');
    expect(previewBox.textContent).toContain('RC/DLA/2026/B/1042');

    // Enregistrement de la page
    const savePageBtn = screen.getByRole('button', {
      name: /Enregistrer la page/i,
    });
    fireEvent.click(savePageBtn);

    await waitFor(() => {
      const updatedCgv = mockContentPages['conditions-generales']!;
      expect(updatedCgv.body).toContain('RC/DLA/2026/B/1042');
      expect(updatedCgv.body).not.toMatch(/\[À COMPLÉTER/i);
    });
  });

  it('4. affiche et filtre le répertoire des clients (/admin/clients) avec leurs adresses et réservations', async () => {
    renderAdminApp('/admin/clients');

    expect(
      await screen.findByRole(
        'heading',
        { name: /Répertoire des clients/i },
        LAZY_TIMEOUT,
      ),
    ).toBeInTheDocument();

    // Junior Mbarga est affiché avec ses réservations
    expect(
      await screen.findAllByText(/Junior Mbarga/i, {}, LAZY_TIMEOUT),
    ).not.toHaveLength(0);

    // Filtre par recherche sur « Aïcha »
    const searchInput = screen.getByRole('searchbox', {
      name: /Rechercher un client par nom ou numéro/i,
    });
    fireEvent.change(searchInput, { target: { value: 'Aïcha' } });

    await waitFor(() => {
      expect(screen.getAllByText(/Aïcha/i).length).toBeGreaterThan(0);
    });
  });
});

