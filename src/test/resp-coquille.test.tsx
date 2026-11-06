import { act, render, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { AppProviders } from '@/app/providers';
import { useBottomInsets } from '@/components/layout/bottomInsets';
import {
  hasMobileActionBar,
  isPaymentStepPath,
  isReservationPath,
} from '@/components/layout/bottomNavVisibility';
import { FloatingWhatsApp } from '@/components/layout/FloatingWhatsApp';
import { formatOpeningHours } from '@/lib/utils/date';
import { formatCmPhoneInternational, resolveShopWhatsapp } from '@/lib/utils/phone';
import { Toaster } from '@/components/ui/Toast';
import { PendingReservationBanner } from '@/features/reservation/components/PendingReservationBanner';
import { createAppQueryClient } from '@/lib/api/queryClient';
import { useCartStore } from '@/stores/cartStore';
import { useReservationStore } from '@/stores/reservationStore';
import { useToastStore } from '@/stores/toastStore';
import type { CartItem, Reservation } from '@/types/domain';

function renderAt(path: string, element: ReactNode) {
  const router = createMemoryRouter([{ path: '*', element }], { initialEntries: [path] });
  return render(
    <AppProviders client={createAppQueryClient()}>
      <RouterProvider router={router} />
    </AppProviders>,
  );
}

const CART_ITEM: CartItem = {
  productId: 'prod-01',
  slug: 'hoodie-barbele-noir',
  name: 'Hoodie Barbelé Noir',
  image: '/mock/product-hoodie.svg',
  variantId: 'prod-01-noir-l',
  size: 'L',
  color: { code: 'noir', name: 'Noir', hex: '#1A1A18' } as CartItem['color'],
  unitPrice: 45000,
  quantity: 1,
  maxQuantity: 5,
};

describe('Coquille responsive · correspondances exactes des routes', () => {
  it('ne confond pas la page d’aide « Paiement Mobile Money » avec le paiement', () => {
    expect(isPaymentStepPath('/aide/paiement-mobile-money')).toBe(false);
    expect(isReservationPath('/aide/paiement-mobile-money')).toBe(false);
    expect(isPaymentStepPath('/reservation/RES-000103/paiement')).toBe(true);
    expect(isPaymentStepPath('/reservation/RES-000103/preuve')).toBe(true);
    expect(isPaymentStepPath('/reservation/RES-000103/merci')).toBe(false);
  });

  it('reconnaît le parcours de réservation et « Mes réservations »', () => {
    for (const path of ['/reservation', '/reservation/RES-000103/merci', '/reservations', '/reservations/RES-000101']) {
      expect(isReservationPath(path)).toBe(true);
    }
    expect(isReservationPath('/reservationsx')).toBe(false);
    expect(isReservationPath('/profil')).toBe(false);
  });

  it('repère les écrans mobiles où une barre d’action remplace la barre basse', () => {
    expect(hasMobileActionBar('/produit/hoodie-barbele-noir', 0)).toBe(true);
    expect(hasMobileActionBar('/reservation', 0)).toBe(true);
    expect(hasMobileActionBar('/panier', 2)).toBe(true);
    expect(hasMobileActionBar('/panier', 0)).toBe(false);
    expect(hasMobileActionBar('/reservation/RES-000103/merci', 0)).toBe(false);
  });
});

describe('Coquille responsive · bouton WhatsApp flottant', () => {
  beforeEach(() => useCartStore.getState().clear());

  it('reste sur la page d’aide « Paiement Mobile Money », disparaît sur le paiement', async () => {
    const { unmount } = renderAt('/aide/paiement-mobile-money', <FloatingWhatsApp />);
    expect(await screen.findByRole('link', { name: 'Nous écrire sur WhatsApp' })).toBeInTheDocument();
    unmount();
    renderAt('/reservation/RES-000103/paiement', <FloatingWhatsApp />);
    await act(async () => undefined);
    expect(screen.queryByRole('link', { name: 'Nous écrire sur WhatsApp' })).not.toBeInTheDocument();
  });

  it('attend la fin du titre principal sur l’accueil et laisse la place à la recherche plein écran', async () => {
    // Témoin : sur une autre page, le bouton apparaît une fois les réglages chargés
    const witness = renderAt('/explorer', <FloatingWhatsApp />);
    expect(await screen.findByRole('link', { name: 'Nous écrire sur WhatsApp' })).toBeInTheDocument();
    witness.unmount();
    for (const path of ['/', '/recherche']) {
      const { unmount } = renderAt(path, <FloatingWhatsApp />);
      await act(async () => undefined);
      expect(screen.queryByRole('link', { name: 'Nous écrire sur WhatsApp' })).not.toBeInTheDocument();
      unmount();
    }
  });

  it('un seul numéro : réglages publics, sinon la variable ; aucun numéro valide = pas de bouton', () => {
    expect(resolveShopWhatsapp('+237 6 77 88 99 00', '+237690000000')).toBe('+237677889900');
    expect(resolveShopWhatsapp(undefined, '690 00 00 00')).toBe('+237690000000');
    expect(resolveShopWhatsapp(undefined, '')).toBeNull();
    expect(resolveShopWhatsapp('inconnu', undefined)).toBeNull();
    // Horaires du pied de page au format « 9 h – 19 h 30 »
    const plain = (value: string) => value.replace(/\u00A0/g, ' ');
    expect(plain(formatOpeningHours('Lun – Sam : 09h00 – 19h30'))).toBe('Lun – Sam : 9 h – 19 h 30');
    expect(plain(formatOpeningHours('Lun – Sam · 9 h 30 à 19 h 30'))).toBe('Lun – Sam · 9 h 30 – 19 h 30');
    expect(plain(formatOpeningHours('Tous les jours · 6 h à 22 h'))).toBe('Tous les jours · 6 h – 22 h');
    // Affichage du pied de page : « +237 6 90 00 00 00 », espaces insécables
    expect(formatCmPhoneInternational('+237690000000')).toBe('+237\u00A06\u00A090\u00A000\u00A000\u00A000');
  });

  it('se place dans la pile du bas et s’efface sur mobile au-dessus d’une barre d’action', async () => {
    const { unmount } = renderAt('/panier', <FloatingWhatsApp />);
    const onEmptyCart = await screen.findByRole('link', { name: 'Nous écrire sur WhatsApp' });
    expect(onEmptyCart).toHaveAttribute('data-floating-whatsapp', 'all');
    expect(onEmptyCart.className).toContain('bottom-[calc(var(--bottom-bar-h)+var(--pending-banner-h)+var(--update-banner-h)+16px)]');
    unmount();

    useCartStore.setState({ items: [CART_ITEM] });
    renderAt('/panier', <FloatingWhatsApp />);
    const onFilledCart = await screen.findByRole('link', { name: 'Nous écrire sur WhatsApp' });
    expect(onFilledCart).toHaveAttribute('data-floating-whatsapp', 'desktop');
    expect(onFilledCart).toHaveClass('hidden', 'lg:flex');
  });
});

describe('Coquille responsive · bandeau de réservation en attente', () => {
  beforeEach(() => {
    useReservationStore.setState({
      activeReservation: {
        ref: 'RES-000103',
        status: 'payment_rejected',
        expiresAt: new Date(Date.now() + 20 * 60 * 60 * 1000).toISOString(),
        serverTime: new Date().toISOString(),
      } as unknown as Reservation,
      serverTimeOffsetMs: 0,
      bannerDismissedRef: null,
    });
  });

  afterEach(() => {
    useReservationStore.setState({ activeReservation: null });
  });

  it('reste affiché sur la page d’aide au paiement et sur le panier, au-dessus de la barre du bas', async () => {
    for (const path of ['/aide/paiement-mobile-money', '/panier']) {
      const { unmount } = renderAt(path, <PendingReservationBanner />);
      const region = await screen.findByRole('region', { name: 'Paiement de réservation non validé' });
      expect(region).toHaveAttribute('data-pending-banner', 'all');
      expect(region.className).toContain('bottom-[var(--bottom-bar-h)]');
      // Cible tactile de 44 px
      expect(screen.getByRole('link', { name: 'Renvoyer' })).toHaveClass('min-h-11');
      unmount();
    }
  });

  it('s’efface sur mobile dans la fiche produit et disparaît sur le parcours de réservation', async () => {
    const { unmount } = renderAt('/produit/hoodie-barbele-noir', <PendingReservationBanner />);
    const region = await screen.findByRole('region', { name: 'Paiement de réservation non validé' });
    expect(region).toHaveAttribute('data-pending-banner', 'desktop');
    expect(region).toHaveClass('max-lg:hidden');
    unmount();

    renderAt('/reservations', <PendingReservationBanner />);
    await act(async () => undefined);
    expect(screen.queryByRole('region', { name: 'Paiement de réservation non validé' })).not.toBeInTheDocument();
  });
});

describe('Coquille responsive · toasts', () => {
  beforeEach(() => useToastStore.getState().clear());

  it('affichent le message sur deux lignes et des cibles de 44 px', async () => {
    renderAt('/aide', <Toaster />);
    act(() => {
      useToastStore.getState().show({
        message: '3 colis sont prêts : leurs photos vous attendent',
        actionLabel: 'Voir',
        actionHref: '/reservations',
      });
    });
    expect(await screen.findByText('3 colis sont prêts : leurs photos vous attendent')).toHaveClass('line-clamp-2');
    expect(screen.getByRole('link', { name: 'Voir' })).toHaveClass('min-h-11', 'min-w-11');
    expect(screen.getByRole('button', { name: 'Fermer la notification' })).toHaveClass('h-11', 'w-11');
    // Classe utilisée par index.css pour sortir les toasts du bouton principal d'une feuille ouverte
    expect(screen.getByRole('status').parentElement).toHaveClass('toaster');
  });
});

describe('Coquille responsive · mesure de la pile du bas', () => {
  function Probe() {
    useBottomInsets();
    return (
      <main>
        <div data-bottom-bar="" data-testid="bar" />
      </main>
    );
  }

  afterEach(() => {
    document.documentElement.style.removeProperty('--bottom-bar-h');
  });

  it('expose la hauteur de la barre d’action collante sur <html>', () => {
    const original = HTMLElement.prototype.getBoundingClientRect;
    HTMLElement.prototype.getBoundingClientRect = function getRect(this: HTMLElement) {
      if (this.dataset.testid === 'bar') return { height: 101, width: 390, top: 743, bottom: 844, left: 0, right: 390, x: 0, y: 743, toJSON: () => ({}) } as DOMRect;
      return original.call(this);
    };
    try {
      const { unmount } = render(<Probe />);
      expect(document.documentElement.style.getPropertyValue('--bottom-bar-h')).toBe('101px');
      unmount();
      // Démonté : la valeur de la feuille de style reprend la main
      expect(document.documentElement.style.getPropertyValue('--bottom-bar-h')).toBe('');
    } finally {
      HTMLElement.prototype.getBoundingClientRect = original;
    }
  });
});
