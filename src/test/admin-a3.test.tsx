import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { setupServer } from 'msw/node';
import { RouterProvider } from 'react-router';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { AppProviders } from '@/app/providers';
import { createTestRouter } from '@/app/router';
import { useAdminAuthStore } from '@/features/admin/auth/adminAuthStore';
import { createAppQueryClient } from '@/lib/api/queryClient';
import { DEMO_ADMIN_ACCOUNTS } from '@/mocks/adminHandlers';
import { mockCategories } from '@/mocks/fixtures/categories';
import { mockLooks } from '@/mocks/fixtures/looks';
import { mockProducts } from '@/mocks/fixtures/products';
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

describe('Module A3 · Catalogue, stocks, variantes, catégories et looks', () => {
  it('1. affiche la liste du catalogue (/admin/catalogue), filtre par catégorie et met à jour les stocks via la feuille Stock rapide', async () => {
    renderAdminApp('/admin/catalogue');

    expect(
      await screen.findByRole(
        'heading',
        { name: /Articles, variantes et stocks/i },
        LAZY_TIMEOUT,
      ),
    ).toBeInTheDocument();

    const firstProduct = mockProducts[0]!;
    expect(await screen.findByText(firstProduct.name, {}, LAZY_TIMEOUT)).toBeInTheDocument();

    // Filtrage par catégorie « Babouches »
    const categorySelect = screen.getByLabelText(/Filtrer par catégorie/i);
    fireEvent.change(categorySelect, { target: { value: 'babouches' } });

    await waitFor(() => {
      const baboucheProduct = mockProducts.find((p) => p.categorySlug === 'babouches')!;
      expect(screen.getByText(baboucheProduct.name)).toBeInTheDocument();
    });

    // Remise à « Toutes les catégories »
    fireEvent.change(categorySelect, { target: { value: '' } });
    expect(await screen.findByText(firstProduct.name)).toBeInTheDocument();

    // Ouverture de la feuille « Stock rapide » sur le premier produit
    const quickStockButtons = screen.getAllByRole('button', { name: /Stock rapide/i });
    fireEvent.click(quickStockButtons[0]!);

    expect(
      await screen.findByText(new RegExp(`Stock rapide · ${firstProduct.name}`, 'i')),
    ).toBeInTheDocument();

    // Bouton « Tout mettre à 0 (épuisé) » puis enregistrement
    const zeroButton = screen.getByRole('button', { name: /Tout mettre à 0/i });
    fireEvent.click(zeroButton);

    const saveStockButton = screen.getByRole('button', { name: /Enregistrer les stocks/i });
    fireEvent.click(saveStockButton);

    await waitFor(() => {
      const updated = mockProducts.find((p) => p.id === firstProduct.id)!;
      const totalStock = updated.variants.reduce((sum, v) => sum + v.stock, 0);
      expect(totalStock).toBe(0);
      expect(updated.badges).toContain('sold-out');
    });
  });

  it('2. crée un nouveau produit complet (/admin/catalogue/nouveau) avec couleurs, photos rattachées par colorCode (SP-003), tailles et guide des tailles (SP-004)', async () => {
    const initialCount = mockProducts.length;
    renderAdminApp('/admin/catalogue/nouveau');

    expect(
      await screen.findByRole('heading', { name: /Nouveau produit/i }, LAZY_TIMEOUT),
    ).toBeInTheDocument();

    // 1. Saisie du nom (génère automatiquement le slug) et du prix
    const nameInput = screen.getByLabelText(/Nom du produit/i);
    fireEvent.change(nameInput, {
      target: { value: 'Babouche Cuir Souverain' },
    });

    const slugInput = screen.getByLabelText(/Slug URL/i) as HTMLInputElement;
    expect(slugInput.value).toBe('babouche-cuir-souverain');

    const priceInput = screen.getByLabelText(/Prix en FCFA/i);
    fireEvent.change(priceInput, { target: { value: '25000' } });

    // 2. Ajout d'une seconde couleur signature (Rouge Incompris)
    const addRedPresetBtn = screen.getByRole('button', { name: /Rouge Incompris/i });
    fireEvent.click(addRedPresetBtn);

    // L'alerte douce SP-003 signale que « Rouge Incompris » n'a pas encore de photo rattachée
    expect(
      await screen.findByText(/Couleur\(s\) sans photo rattachée : Rouge Incompris/i),
    ).toBeInTheDocument();

    // 3. Ajout d'une photo rattachée à la couleur « rouge »
    const newPhotoColorSelect = screen.getByLabelText(/Couleur associée/i);
    fireEvent.change(newPhotoColorSelect, { target: { value: 'rouge' } });

    const demoVisualBtn = screen.getByRole('button', { name: /\+ Babouche cuir Royal/i });
    fireEvent.click(demoVisualBtn);

    // L'alerte SP-003 disparaît dès que chaque couleur a au moins une photo
    await waitFor(() => {
      expect(
        screen.queryByText(/Couleur\(s\) sans photo rattachée/i),
      ).not.toBeInTheDocument();
    });

    // 4. Application du préréglage de pointures « Chaussures & Babouches (39 à 45) »
    const footwearSizesBtn = screen.getByRole('button', {
      name: /Chaussures & Babouches \(39 à 45\)/i,
    });
    fireEvent.click(footwearSizesBtn);

    // 5. Choix du gabarit de guide des tailles « Gabarit Pointures EU » (SP-004)
    const footwearGuideBtn = screen.getByRole('button', {
      name: /Gabarit Pointures EU/i,
    });
    fireEvent.click(footwearGuideBtn);

    // Soumission du formulaire
    const submitBtn = screen.getByRole('button', { name: /Créer le produit/i });
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(mockProducts.length).toBe(initialCount + 1);
    });

    const created = mockProducts.find((p) => p.slug === 'babouche-cuir-souverain');
    expect(created).toBeDefined();
    expect(created?.price).toBe(25000);
    expect(created?.colors.map((c) => c.code)).toEqual(['noir', 'rouge']);
    expect(created?.sizeGuide.type).toBe('footwear');
    expect(
      created?.mediaGallery.some((entry) => entry.colorCode === 'rouge'),
    ).toBe(true);
  });

  it('3. modifie un produit existant (/admin/catalogue/:id) et répercute les changements dans le catalogue', async () => {
    const targetProduct = mockProducts[1]!;
    const targetId = targetProduct.id;
    const originalName = targetProduct.name;
    renderAdminApp(`/admin/catalogue/${targetId}`);

    expect(
      await screen.findByRole(
        'heading',
        { name: new RegExp(`Modifier : ${originalName}`, 'i') },
        LAZY_TIMEOUT,
      ),
    ).toBeInTheDocument();

    const nameInput = screen.getByLabelText(/Nom du produit/i);
    fireEvent.change(nameInput, {
      target: { value: `${originalName} Édition Collector` },
    });

    const priceInput = screen.getByLabelText(/Prix en FCFA/i);
    fireEvent.change(priceInput, { target: { value: '32000' } });

    const saveBtn = screen.getByRole('button', {
      name: /Enregistrer les modifications/i,
    });
    fireEvent.click(saveBtn);

    await waitFor(() => {
      const updated = mockProducts.find((p) => p.id === targetId)!;
      expect(updated.name).toBe(`${originalName} Édition Collector`);
      expect(updated.price).toBe(32000);
    });
  });

  it('4. modifie une catégorie et ses sous-catégories (/admin/categories) et gère les looks « Portés par L’Incompris » (/admin/looks, SP-005)', async () => {
    renderAdminApp('/admin/categories');

    expect(
      await screen.findByRole('heading', { name: /Catégories & Looks/i }, LAZY_TIMEOUT),
    ).toBeInTheDocument();

    // Ajout d'une sous-catégorie « Kaftans » dans Vêtements
    const newSubInput = await screen.findByLabelText(
      /Nouvelle sous-catégorie pour Vêtements/i,
      {},
      LAZY_TIMEOUT,
    );
    fireEvent.change(newSubInput, { target: { value: 'Kaftans' } });

    const vetementsForm = newSubInput.closest('form')!;
    const addSubBtn = within(vetementsForm).getByRole('button', { name: /Ajouter/i });
    fireEvent.click(addSubBtn);

    const saveVetementsBtn = within(vetementsForm).getByRole('button', {
      name: /Enregistrer Vêtements/i,
    });
    fireEvent.click(saveVetementsBtn);

    await waitFor(() => {
      const vetementsCat = mockCategories.find((c) => c.slug === 'vetements')!;
      expect(vetementsCat.subCategories.some((s) => s.slug === 'kaftans')).toBe(true);
    });

    // Bascule sur l'onglet « Looks »
    const looksTab = screen.getByRole('tab', { name: /Looks/i });
    fireEvent.click(looksTab);

    expect(
      await screen.findByRole('heading', {
        name: /Silhouettes «\s*Portés par L’Incompris\s*»/i,
      }),
    ).toBeInTheDocument();

    // Création d'un nouveau look
    const initialLooksCount = mockLooks.length;
    const newLookBtn = screen.getByRole('button', { name: /Nouveau look/i });
    fireEvent.click(newLookBtn);

    const titleInput = screen.getByLabelText(/Titre du look/i);
    fireEvent.change(titleInput, { target: { value: 'Look Nocturne Douala' } });

    // Sélection du premier produit du catalogue
    const firstProductBtn = screen.getByRole('button', {
      name: new RegExp(mockProducts[0]!.name, 'i'),
    });
    fireEvent.click(firstProductBtn);

    const publishLookBtn = screen.getByRole('button', { name: /Publier le look/i });
    fireEvent.click(publishLookBtn);

    await waitFor(() => {
      expect(mockLooks.length).toBe(initialLooksCount + 1);
      expect(screen.getByText('Look Nocturne Douala')).toBeInTheDocument();
    });
  });
});
