import { fireEvent, render, screen, within } from '@testing-library/react';
import { MemoryRouter, RouterProvider } from 'react-router';
import { setupServer } from 'msw/node';
import { afterAll, afterEach, beforeAll, describe, expect, it, onTestFinished } from 'vitest';
import { AppProviders } from '@/app/providers';
import { createTestRouter } from '@/app/router';
import { ProductCard } from '@/components/ui/ProductCard';
import { FilterSheets } from '@/features/catalog/explore/FilterSheets';
import { ProductLightbox } from '@/features/catalog/product/ProductLightbox';
import { createAppQueryClient } from '@/lib/api/queryClient';
import { mockProducts } from '@/mocks/fixtures/products';
import { handlers } from '@/mocks/handlers';
import { useCartStore } from '@/stores/cartStore';
import { useToastStore } from '@/stores/toastStore';

const server = setupServer(...handlers);

beforeAll(() => {
  server.listen();
});

afterEach(() => {
  server.resetHandlers();
  useCartStore.getState().clear();
  useToastStore.getState().clear();
});

afterAll(() => {
  server.close();
});

describe('Responsive catalogue — carte produit', () => {
  it('réduit « Ajouter » à l’icône par requête de conteneur, avec un nom accessible complet et des cibles de 44 px', () => {
    const product = mockProducts.find((p) => p.variants.some((v) => v.stock > 0))!;
    render(
      <AppProviders client={createAppQueryClient()}>
        <MemoryRouter>
          <ProductCard product={product} />
        </MemoryRouter>
      </AppProviders>,
    );

    const reserve = screen.getByRole('button', { name: 'Réserver' });
    const add = screen.getByRole('button', { name: `Ajouter ${product.name} au panier` });

    // La rangée d'actions est le conteneur interrogé ; le libellé n'apparaît que sur une carte d'au moins 12rem
    expect(add.parentElement).toHaveClass('@container');
    expect(within(add).getByText('Ajouter')).toHaveClass('hidden', '@min-[12rem]:inline');
    // « Réserver » peut rétrécir (la base du bouton est shrink-0 whitespace-nowrap)
    expect(reserve).toHaveClass('min-w-0', 'flex-1', 'shrink');
    expect(reserve).not.toHaveClass('shrink-0');
    expect(reserve).toHaveClass('min-h-[44px]');
    expect(add).toHaveClass('min-h-[44px]', 'min-w-[44px]');
  });
});

describe('Responsive catalogue — visionneuse', () => {
  it('affiche les actions une seule fois, un compteur insécable et un cadre limité par la hauteur disponible', () => {
    render(
      <ProductLightbox
        open
        onClose={() => {}}
        initialIndex={0}
        productName="RES-000102"
        images={[
          { url: '/a.jpg', fallbackUrl: '/a.jpg', alt: 'Photo 1', ratio: '4/3' },
          { url: '/b.jpg', fallbackUrl: '/b.jpg', alt: 'Photo 2', ratio: '4/5' },
        ]}
        renderActions={() => <button type="button">Enregistrer la photo</button>}
      />,
    );

    const dialog = screen.getByRole('dialog');
    expect(within(dialog).getAllByRole('button', { name: 'Enregistrer la photo' })).toHaveLength(1);
    expect(within(dialog).getByText('1 / 2')).toHaveClass('shrink-0', 'whitespace-nowrap');
    // 4:3 → largeur ≤ hauteur de la zone × 4/3 (unités cqh de la zone centrale, conteneur de taille)
    const frame = dialog.querySelector('.cursor-zoom-in');
    expect(frame?.className).toContain('w-[min(100%,560px,133.33cqh)]');
    expect(frame?.parentElement?.className).toContain('[container-type:size]');

    fireEvent.keyDown(window, { key: 'ArrowRight' });
    expect(dialog.querySelector('.cursor-zoom-in')?.className).toContain('w-[min(100%,560px,80cqh)]');
  });
});

describe('Responsive catalogue — filtres mobiles', () => {
  it('garde le pied de la feuille visible (filtres qui défilent) et « Voir X articles » sans débordement', async () => {
    render(
      <AppProviders client={createAppQueryClient()}>
        <MemoryRouter>
          <FilterSheets
            activeSheet="all"
            onClose={() => {}}
            filters={{ sizes: [], available: false, sort: 'popular' }}
            onApplyFilters={() => {}}
          />
        </MemoryRouter>
      </AppProviders>,
    );

    const apply = await screen.findByRole('button', { name: /^Voir \d+ articles?$/ });
    expect(apply).not.toHaveClass('w-full');
    expect(apply).toHaveClass('min-w-0', 'flex-1', 'shrink');

    const scroller = screen.getByText('FOURCHETTE DE PRIX').closest('.overflow-y-auto');
    expect(scroller).not.toBeNull();
    // Le pied n'est pas dans la zone qui défile
    expect(scroller?.contains(apply)).toBe(false);
  });
});

describe('Responsive catalogue — fiche produit', () => {
  it('n’affiche qu’une coche après l’ajout et met la taille en tête du sous-titre du toast', async () => {
    // Téléphone : l'ajout affiche un toast (le tiroir du panier est réservé aux écrans ≥ 1024 px)
    const initialWidth = window.innerWidth;
    Object.defineProperty(window, 'innerWidth', { configurable: true, value: 390 });
    onTestFinished(() => {
      Object.defineProperty(window, 'innerWidth', { configurable: true, value: initialWidth });
    });
    const router = createTestRouter(['/produit/tshirt-lincompris-oversize']);
    render(
      <AppProviders client={createAppQueryClient()}>
        <RouterProvider router={router} />
      </AppProviders>,
    );

    await screen.findByRole('heading', { name: /T-shirt L'Incompris Oversize/i });
    fireEvent.click(screen.getByRole('radio', { name: /Taille S/i }));
    // Barre collante mobile (jsdom : largeur < 1024 → toast plutôt que tiroir du panier)
    const addButtons = screen.getAllByRole('button', { name: /^Ajouter( au panier)?$/i });
    fireEvent.click(addButtons[addButtons.length - 1]);

    expect(useCartStore.getState().count()).toBe(1);
    expect(screen.queryByText(/Ajouté ✓/)).toBeNull();
    expect(screen.getAllByText('Ajouté').length).toBeGreaterThan(0);
    const toast = useToastStore.getState().toasts.at(-1);
    expect(toast?.subtitle).toMatch(/^Taille S · /);
  });
});
