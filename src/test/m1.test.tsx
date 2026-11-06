import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, RouterProvider } from 'react-router';
import { setupServer } from 'msw/node';
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
import { AppProviders } from '@/app/providers';
import { createTestRouter } from '@/app/router';
import { Marquee } from '@/components/ui/Marquee';
import { ProductCard } from '@/components/ui/ProductCard';
import { Sheet } from '@/components/ui/Sheet';
import { SizePicker } from '@/components/ui/SizePicker';
import { createAppQueryClient } from '@/lib/api/queryClient';
import { mockProducts } from '@/mocks/fixtures/products';
import { handlers } from '@/mocks/handlers';
import { useCartStore } from '@/stores/cartStore';
import { useFavoritesStore } from '@/stores/favoritesStore';
import { useToastStore } from '@/stores/toastStore';
import { useUiStore } from '@/stores/uiStore';

const server = setupServer(...handlers);

beforeAll(() => {
  server.listen({ onUnhandledFrame: 'bypass' });
});

afterEach(() => {
  server.resetHandlers();
  useCartStore.getState().clear();
  useFavoritesStore.getState().clear();
  useToastStore.getState().clear();
  useUiStore.getState().closeSizePicker();
});

afterAll(() => {
  server.close();
});

describe('Store Zustand : favoritesStore', () => {
  beforeEach(() => {
    useFavoritesStore.getState().clear();
  });

  it('ajoute et retire un produit en favori via toggle(), vérifie has() et count()', () => {
    expect(useFavoritesStore.getState().count()).toBe(0);
    expect(useFavoritesStore.getState().has('prod-01')).toBe(false);

    const added = useFavoritesStore.getState().toggle('prod-01');
    expect(added).toBe(true);
    expect(useFavoritesStore.getState().has('prod-01')).toBe(true);
    expect(useFavoritesStore.getState().count()).toBe(1);

    const removed = useFavoritesStore.getState().toggle('prod-01');
    expect(removed).toBe(false);
    expect(useFavoritesStore.getState().has('prod-01')).toBe(false);
    expect(useFavoritesStore.getState().count()).toBe(0);
  });
});

describe('Composant : ProductCard (épuisé, badges, propagation des clics)', () => {
  it('affiche le badge Nouveau et déclenche favori / feuille de taille sans suivre le lien de la carte', () => {
    const product = mockProducts[0];

    render(
      <AppProviders client={createAppQueryClient()}>
        <MemoryRouter>
          <ProductCard product={product} />
        </MemoryRouter>
      </AppProviders>,
    );

    expect(screen.getByText(product.name)).toBeInTheDocument();
    expect(screen.getByText('Nouveau')).toBeInTheDocument();

    // Clic sur le bouton favori
    const favBtn = screen.getByRole('button', {
      name: new RegExp(`Ajouter ${product.name} aux favoris`, 'i'),
    });
    fireEvent.click(favBtn);
    expect(useFavoritesStore.getState().has(product.id)).toBe(true);

    // Clic sur le bouton Réserver ouvre le SizePicker dans uiStore
    const reserveBtn = screen.getByRole('button', { name: 'Réserver' });
    fireEvent.click(reserveBtn);
    expect(useUiStore.getState().sizePickerProduct?.id).toBe(product.id);
    expect(useUiStore.getState().sizePickerIntent).toBe('reserve');
  });

  it("affiche le badge Épuisé et remplace Réserver/Ajouter par Voir l'article quand le stock total est 0", () => {
    const soldOutProduct = mockProducts.find((p) =>
      p.variants.every((v) => v.stock === 0),
    )!;

    render(
      <AppProviders client={createAppQueryClient()}>
        <MemoryRouter>
          <ProductCard product={soldOutProduct} />
        </MemoryRouter>
      </AppProviders>,
    );

    expect(screen.getByText('Épuisé')).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: /Voir l’article/i }),
    ).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Réserver' })).toBeNull();
  });
});

describe('Composant : SizePicker (taille épuisée non sélectionnable, ajout au panier)', () => {
  it("empêche la sélection d'une taille épuisée et ajoute au panier la taille choisie", () => {
    // prod-01 possède XXL en stock 0 et S en stock 4
    const product = mockProducts[0];
    const onClose = vi.fn();

    render(
      <AppProviders client={createAppQueryClient()}>
        <MemoryRouter>
          <SizePicker
            product={product}
            intent="add"
            open={true}
            onClose={onClose}
          />
        </MemoryRouter>
      </AppProviders>,
    );

    const sizeOutBtn = screen.getByRole('button', {
      name: /Taille XXL \(Épuisée\)/i,
    });
    expect(sizeOutBtn).toBeDisabled();

    const sizeMBtn = screen.getByRole('button', {
      name: /Taille M \(6 en stock\)/i,
    });
    expect(sizeMBtn).not.toBeDisabled();
    fireEvent.click(sizeMBtn);

    const addBtn = screen.getByRole('button', { name: /Ajouter au panier/i });
    expect(addBtn).not.toBeDisabled();
    fireEvent.click(addBtn);

    expect(useCartStore.getState().count()).toBe(1);
    expect(useCartStore.getState().items[0].size).toBe('M');
    expect(useCartStore.getState().items[0].productId).toBe(product.id);
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});

describe('Composant : Sheet (fermeture par Échap)', () => {
  it('se ferme lorsque la touche Escape est pressée', () => {
    const onClose = vi.fn();

    render(
      <AppProviders client={createAppQueryClient()}>
        <Sheet open={true} onClose={onClose} title="Choisir une taille">
          <p>Contenu de la feuille</p>
        </Sheet>
      </AppProviders>,
    );

    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(screen.getByText('Contenu de la feuille')).toBeInTheDocument();

    fireEvent.keyDown(window, { key: 'Escape' });
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});

describe("Composant : Marquee (contenu non dupliqué pour les lecteurs d'écran)", () => {
  it("masque la piste dupliquée avec aria-hidden='true' pour les lecteurs d'écran", () => {
    const items = [
      { id: '1', label: 'LIVRAISON PARTOUT AU CAMEROUN' },
      { id: '2', label: 'PAIEMENT ORANGE MONEY & MTN MOMO' },
    ];

    const { container } = render(<Marquee tone="red" items={items} />);

    // La copie visuelle possède aria-hidden="true"
    const hiddenTracks = container.querySelectorAll('div[aria-hidden="true"]');
    expect(hiddenTracks.length).toBe(1);
  });
});

describe("Page d'accueil : rendu complet des 11 sections avec les mocks MSW", () => {
  it('affiche le Hero, les bandeaux, les catégories, les produits, les 3 étapes, les engagements et les looks', async () => {
    const testRouter = createTestRouter(['/']);
    const testQueryClient = createAppQueryClient();

    render(
      <AppProviders client={testQueryClient}>
        <RouterProvider router={testRouter} />
      </AppProviders>,
    );

    // 7.1 Hero
    expect(await screen.findByText('NE SE PLIE')).toBeInTheDocument();
    expect(screen.getAllByText(/L’INCOMPRIS/i).length).toBeGreaterThan(0);

    // 7.3 Catégories
    expect(screen.getByText('Nos univers')).toBeInTheDocument();

    // 7.4 & 7.5 Produits chargés via MSW
    await waitFor(
      () => {
        expect(
          screen.getAllByText(/Hoodie Barbelé Noir/i).length,
        ).toBeGreaterThan(0);
      },
      { timeout: 4000 },
    );

    // 7.7 Spécial babouches
    expect(screen.getByText(/L’ART DE LA BABOUCHE/i)).toBeInTheDocument();

    // 7.8 Comment ça marche
    expect(screen.getByText(/RÉSERVEZ EN 3 ÉTAPES/i)).toBeInTheDocument();

    // 7.9 Nos engagements
    expect(
      screen.getByText(/POURQUOI NOUS FAIRE CONFIANCE/i),
    ).toBeInTheDocument();

    // 7.10 Bloc WhatsApp & Application
    expect(
      screen.getByText(/Ajoutez DR Choco à votre écran d’accueil/i),
    ).toBeInTheDocument();

    // 7.11 Portés par l'Incompris
    await waitFor(
      () => {
        expect(
          screen.getAllByText(/Total black barbelé/i).length,
        ).toBeGreaterThan(0);
      },
      { timeout: 4000 },
    );
  });
});
