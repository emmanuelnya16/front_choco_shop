import {
  act,
  fireEvent,
  render,
  renderHook,
  screen,
  waitFor,
} from '@testing-library/react';
import type { ReactNode } from 'react';
import { MemoryRouter, Route, RouterProvider, Routes } from 'react-router';
import { setupServer } from 'msw/node';
import {
  afterAll,
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
} from 'vitest';
import { AppProviders } from '@/app/providers';
import { createTestRouter } from '@/app/router';
import { useCatalogFilters } from '@/features/catalog/filters/useCatalogFilters';
import {
  addRecentSearch,
  clearRecentSearches,
  getRecentSearches,
  removeRecentSearch,
} from '@/features/catalog/search/recentSearches';
import { api } from '@/lib/api/client';
import { endpoints } from '@/lib/api/endpoints';
import { createAppQueryClient } from '@/lib/api/queryClient';
import { handlers } from '@/mocks/handlers';
import { useCartStore } from '@/stores/cartStore';
import { useFavoritesStore } from '@/stores/favoritesStore';
import { useToastStore } from '@/stores/toastStore';
import { useUiStore } from '@/stores/uiStore';
import type {
  LookDetailResponse,
  ProductDetailResponse,
  ProductsResponse,
  SearchSuggestResponse,
} from '@/types/api';

const server = setupServer(...handlers);

beforeAll(() => {
  server.listen();
});

afterEach(() => {
  server.resetHandlers();
  useCartStore.getState().clear();
  useFavoritesStore.getState().clear();
  useToastStore.getState().clear();
  useUiStore.getState().closeSizePicker();
  clearRecentSearches();
});

afterAll(() => {
  server.close();
});

describe('Module M2 — 1. useCatalogFilters (lecture URL, activeCount, toggleSize, reset, valeurs invalides)', () => {
  function createWrapper(initialEntry: string) {
    return function Wrapper({ children }: { children: ReactNode }) {
      return (
        <MemoryRouter initialEntries={[initialEntry]}>
          <Routes>
            <Route path="/explorer" element={children} />
            <Route path="/explorer/:category" element={children} />
          </Routes>
        </MemoryRouter>
      );
    };
  }

  it('lit les paramètres URL, calcule activeCount hors tri, bascule les tailles et réinitialise proprement', () => {
    const { result } = renderHook(() => useCatalogFilters(), {
      wrapper: createWrapper(
        '/explorer/vetements?sub=t-shirts&size=L&size=XL&price=15000-30000&available=1&sort=price-asc',
      ),
    });

    expect(result.current.filters.category).toBe('vetements');
    expect(result.current.filters.sub).toBe('t-shirts');
    expect(result.current.filters.sizes).toEqual(['L', 'XL']);
    expect(result.current.filters.price).toBe('15000-30000');
    expect(result.current.filters.available).toBe(true);
    expect(result.current.filters.sort).toBe('price-asc');
    // activeCount = 1 (sub) + 2 (sizes) + 1 (price) + 1 (available) = 5 (sort non compté)
    expect(result.current.activeCount).toBe(5);

    // Retrait de la taille L et ajout de la taille M
    act(() => {
      result.current.toggleSize('L');
    });
    expect(result.current.filters.sizes).toEqual(['XL']);

    act(() => {
      result.current.toggleSize('M');
    });
    expect(result.current.filters.sizes).toEqual(['XL', 'M']);

    // reset() efface tous les filtres mais conserve le tri actif
    act(() => {
      result.current.reset();
    });
    expect(result.current.activeCount).toBe(0);
    expect(result.current.filters.sizes).toEqual([]);
    expect(result.current.filters.sub).toBeUndefined();
    expect(result.current.filters.price).toBeUndefined();
    expect(result.current.filters.available).toBe(false);
    expect(result.current.filters.sort).toBe('price-asc');
  });

  it('ignore silencieusement les valeurs invalides dans l’URL', () => {
    const { result } = renderHook(() => useCatalogFilters(), {
      wrapper: createWrapper(
        '/explorer/inconnu?sub=bidon&size=999&price=0-999&sort=random',
      ),
    });

    expect(result.current.filters.category).toBeUndefined();
    expect(result.current.filters.sub).toBeUndefined();
    expect(result.current.filters.sizes).toEqual([]);
    expect(result.current.filters.price).toBeUndefined();
    expect(result.current.filters.sort).toBe('popular');
    expect(result.current.activeCount).toBe(0);
  });
});

describe('Module M2 — 2. Mocks MSW enrichis (filtres combinés, facettes, tri, recherche sans accent, looks)', () => {
  it('filtre par catégorie, sous-catégorie, tailles multiples, prix et disponibilité avec facettes', async () => {
    const res = await api.get<ProductsResponse>(
      endpoints.catalog.products({
        category: 'vetements',
        sub: 't-shirts',
        sizes: ['M', 'L'],
        price: '15000-30000',
        available: true,
        sort: 'price-asc',
      }),
    );

    expect(res.items.length).toBeGreaterThan(0);
    expect(res.facets).toBeDefined();
    for (const item of res.items) {
      expect(item.categorySlug).toBe('vetements');
      expect(item.subCategorySlug).toBe('t-shirts');
      expect(item.price).toBeGreaterThanOrEqual(15000);
      expect(item.price).toBeLessThanOrEqual(30000);
      expect(
        item.variants.some(
          (v) => (v.size === 'M' || v.size === 'L') && v.stock > 0,
        ),
      ).toBe(true);
    }

    // Vérifie le tri par prix croissant
    for (let i = 1; i < res.items.length; i += 1) {
      expect(res.items[i].price).toBeGreaterThanOrEqual(res.items[i - 1].price);
    }
  });

  it('recherche de manière insensible aux accents et à la casse sur /search/suggest', async () => {
    const brodeeSuggest = await api.get<SearchSuggestResponse>(
      endpoints.catalog.searchSuggest('brodee'),
    );
    expect(brodeeSuggest.totalProducts).toBeGreaterThan(0);
    expect(
      brodeeSuggest.products.some((p) => p.name.toLowerCase().includes('brodée')),
    ).toBe(true);

    const barbeleSuggest = await api.get<SearchSuggestResponse>(
      endpoints.catalog.searchSuggest('BARBELE'),
    );
    expect(barbeleSuggest.totalProducts).toBeGreaterThan(0);
    expect(
      barbeleSuggest.products.some((p) => p.slug === 'hoodie-barbele-noir'),
    ).toBe(true);
  });

  it('retourne un produit détaillé avec ses articles similaires et 404 sur un slug inconnu', async () => {
    const detail = await api.get<ProductDetailResponse>(
      endpoints.catalog.product('hoodie-barbele-noir'),
    );
    expect(detail.id).toBe('prod-01');
    expect(detail.related.length).toBeGreaterThan(0);
    expect(detail.sizeGuide).toBeDefined();
    expect(detail.mediaGallery?.length).toBeGreaterThanOrEqual(3);

    await expect(
      api.get<ProductDetailResponse>(endpoints.catalog.product('slug-introuvable')),
    ).rejects.toMatchObject({
      code: 'NOT_FOUND',
    });

    const look = await api.get<LookDetailResponse>(
      endpoints.catalog.look('look-1'),
    );
    expect(look.id).toBe('look-1');
    expect(look.products.length).toBeGreaterThan(0);
  });
});

describe('Module M2 — 3. Fiche produit (/produit/:slug : couleurs, tailles, stock réel, taille unique, épuisé)', () => {
  it('désélectionne la taille si la nouvelle couleur est épuisée, refuse l’ajout sans taille, et affiche Plus que X uniquement pour stock 1 ou 2', async () => {
    // prod-02 (tshirt-lincompris-oversize) :
    // noir -> S:8, M:5, L:2, XL:0, XXL:1
    // rouge -> S:0, M:2, L:1, XL:0, XXL:0
    const router = createTestRouter(['/produit/tshirt-lincompris-oversize']);
    render(
      <AppProviders client={createAppQueryClient()}>
        <RouterProvider router={router} />
      </AppProviders>,
    );

    expect(
      await screen.findByRole('heading', { name: /T-shirt L'Incompris Oversize/i }),
    ).toBeInTheDocument();

    // Clic sur « Ajouter au panier » sans avoir choisi de taille -> message d'alerte
    const addButtons = screen.getAllByRole('button', {
      name: /^Ajouter( au panier)?$/i,
    });
    fireEvent.click(addButtons[0]);

    expect(
      await screen.findByRole('alert'),
    ).toHaveTextContent(/Choisissez votre taille pour continuer/i);
    expect(useCartStore.getState().count()).toBe(0);

    // Sélectionne la taille S (stock = 8 en noir -> >= 3 : pas de mention "Plus que")
    const sizeS = screen.getByRole('radio', { name: /Taille S/i });
    fireEvent.click(sizeS);
    expect(screen.queryByRole('alert')).toBeNull();
    expect(
      screen.getByText(/En stock — bloqué 24 h dès votre réservation/i),
    ).toBeInTheDocument();
    expect(screen.queryByText(/Plus que/i)).toBeNull();

    // Sélectionne la taille L (stock = 2 en noir -> affiche "Plus que 2 exemplaires en taille L")
    const sizeL = screen.getByRole('radio', { name: /Taille L/i });
    fireEvent.click(sizeL);
    expect(
      screen.getByText(/Plus que 2 exemplaires en taille L/i),
    ).toBeInTheDocument();

    // Sélectionne la taille S (en stock en noir, mais épuisée en rouge), puis change de couleur vers Rouge Incompris
    fireEvent.click(sizeS);
    const redColorRadio = screen.getByRole('radio', { name: /Rouge Incompris/i });
    fireEvent.click(redColorRadio);

    // La taille S est automatiquement désélectionnée avec un message explicite
    expect(
      await screen.findByText(
        /La taille S est épuisée dans cette couleur — veuillez choisir une autre taille/i,
      ),
    ).toBeInTheDocument();
  });

  it('pré-sélectionne automatiquement la taille Unique et permet l’ajout immédiat au panier avec mise à jour de uiStore', async () => {
    const router = createTestRouter([
      '/produit/bandana-pack-signature',
    ]);
    render(
      <AppProviders client={createAppQueryClient()}>
        <RouterProvider router={router} />
      </AppProviders>,
    );

    expect(
      await screen.findByRole('heading', {
        name: /Pack T-shirt & Foulard Signature/i,
      }),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/Taille unique — convient à toutes les morphologies/i),
    ).toBeInTheDocument();

    const addButtons = screen.getAllByRole('button', {
      name: /^Ajouter( au panier)?$/i,
    });
    fireEvent.click(addButtons[0]);

    expect(useCartStore.getState().count()).toBe(1);
    expect(useCartStore.getState().items[0].size).toBe('Unique');
  });

  it('affiche l’état épuisé quand toutes les variantes sont à stock 0', async () => {
    const router = createTestRouter(['/produit/hoodie-sans-manches-forge']);
    render(
      <AppProviders client={createAppQueryClient()}>
        <RouterProvider router={router} />
      </AppProviders>,
    );

    expect(
      await screen.findByRole('heading', {
        name: /Hoodie Sans Manches Forge/i,
      }),
    ).toBeInTheDocument();

    expect(
      screen.getAllByText(/Cet article est épuisé/i).length,
    ).toBeGreaterThan(0);
  });
});

describe('Module M2 — 4. Recherches récentes (recentSearches.ts : ajout, déduplication, plafond à 6, suppression)', () => {
  beforeEach(() => {
    clearRecentSearches();
  });

  it('ajoute, déduplique en remontant en tête, plafonne à 6 entrées et supprime individuellement ou totalement', () => {
    expect(getRecentSearches()).toEqual([]);

    addRecentSearch('Babouche cuir');
    addRecentSearch('Hoodie noir');
    addRecentSearch('babouche cuir'); // Doublon insensible à la casse -> remonte en position 0

    expect(getRecentSearches()).toEqual(['babouche cuir', 'Hoodie noir']);

    addRecentSearch('Terme 3');
    addRecentSearch('Terme 4');
    addRecentSearch('Terme 5');
    addRecentSearch('Terme 6');
    addRecentSearch('Terme 7');

    const capped = getRecentSearches();
    expect(capped.length).toBe(6);
    expect(capped[0]).toBe('Terme 7');
    expect(capped).not.toContain('Hoodie noir');

    removeRecentSearch('Terme 5');
    expect(getRecentSearches()).not.toContain('Terme 5');

    clearRecentSearches();
    expect(getRecentSearches()).toEqual([]);
  });
});

describe('Module M2 — 5. Page Favoris (/favoris : affichage, retrait et bouton Annuler du Toast)', () => {
  it('affiche les articles favoris, retire un article au clic sur le cœur et le restaure via le bouton Annuler du Toast', async () => {
    useFavoritesStore.getState().toggle('prod-01');
    useFavoritesStore.getState().toggle('prod-03');

    const router = createTestRouter(['/favoris']);
    render(
      <AppProviders client={createAppQueryClient()}>
        <RouterProvider router={router} />
      </AppProviders>,
    );

    expect(
      await screen.findByText('Hoodie Barbelé Noir'),
    ).toBeInTheDocument();
    expect(screen.getByText('Babouche Royale Akwa Cuir')).toBeInTheDocument();
    expect(screen.getByText('2 articles enregistrés')).toBeInTheDocument();

    // Retire Hoodie Barbelé Noir des favoris
    const removeBtn = screen.getByRole('button', {
      name: /Retirer Hoodie Barbelé Noir des favoris/i,
    });
    fireEvent.click(removeBtn);

    expect(useFavoritesStore.getState().has('prod-01')).toBe(false);
    expect(await screen.findByText('Retiré des favoris')).toBeInTheDocument();

    // Clique sur « Annuler » dans le Toast pour restaurer le favori
    const undoBtn = screen.getByRole('button', { name: 'Annuler' });
    fireEvent.click(undoBtn);

    await waitFor(() => {
      expect(useFavoritesStore.getState().has('prod-01')).toBe(true);
    });
  });
});
