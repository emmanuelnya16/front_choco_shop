import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { describe, expect, it, vi } from 'vitest';
import { AppProviders } from '@/app/providers';
import { Sheet } from '@/components/ui/Sheet';
import { ReservationCard } from '@/features/tracking/components/ReservationCard';
import { createAppQueryClient } from '@/lib/api/queryClient';
import { formatCmPhone, isValidCmPhone, normalizeCmPhone } from '@/lib/utils/phone';
import { formatPrice } from '@/lib/utils/price';
import type { ReservationListItem } from '@/types/api';

/** Corrections responsive du suivi et du profil (feuilles, cartes de réservation, valeurs insécables). */

describe('Sheet : en-tête fixe et corps défilant', () => {
  it('garde la poignée, le titre et le bouton Fermer hors de la zone qui défile', () => {
    const onClose = vi.fn();
    render(
      <AppProviders client={createAppQueryClient()}>
        <Sheet open={true} onClose={onClose} title="Nouvelle adresse">
          <p>Contenu long de la feuille</p>
        </Sheet>
      </AppProviders>,
    );

    const content = screen.getByText('Contenu long de la feuille');
    const body = content.closest('[data-sheet-body]');
    expect(body).not.toBeNull();
    expect(body?.className).toContain('overflow-y-auto');
    expect(body?.className).toContain('min-h-0');

    const title = screen.getByRole('heading', { name: 'Nouvelle adresse' });
    const close = screen.getByRole('button', { name: 'Fermer la fenêtre' });
    expect(body?.contains(title)).toBe(false);
    expect(body?.contains(close)).toBe(false);

    // Le panneau est limité en hauteur et empile en-tête et corps en colonne
    const panel = body?.parentElement;
    expect(panel?.className).toContain('max-h-[92dvh]');
    expect(panel?.className).toContain('flex-col');
    // Marge basse conservée sous le dernier élément (20 px + zone sûre)
    expect(panel?.className).toContain('pb-[calc(20px+env(safe-area-inset-bottom,0px))]');

    fireEvent.keyDown(window, { key: 'Escape' });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('ferme la feuille avec le bouton Fermer, une seule fois', () => {
    const onClose = vi.fn();
    render(
      <AppProviders client={createAppQueryClient()}>
        <Sheet open={true} onClose={onClose} title="Notifications">
          <button type="button">Activer</button>
        </Sheet>
      </AppProviders>,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Fermer la fenêtre' }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});

describe('Valeurs insécables : montants et numéros', () => {
  it('formatPrice ne laisse aucune espace sécable (pas de « FCFA » seul en début de ligne)', () => {
    expect(formatPrice(46500)).toBe('46\u202f500\u00a0FCFA');
    expect(formatPrice(1500)).toBe('1\u202f500\u00a0FCFA');
    expect(formatPrice(46500)).not.toMatch(/ /);
  });

  it('formatCmPhone groupe les chiffres avec des espaces insécables, et reste relisible', () => {
    const formatted = formatCmPhone('+237677889900');
    expect(formatted).toBe('677\u00a088\u00a099\u00a000');
    expect(formatted).not.toMatch(/ /);
    // Un numéro affiché puis recopié dans un champ reste valide et se normalise à l'identique
    expect(isValidCmPhone(formatted)).toBe(true);
    expect(normalizeCmPhone(`+237 ${formatted}`)).toBe('+237677889900');
  });
});

function makeItem(overrides: Partial<ReservationListItem>): ReservationListItem {
  return {
    ref: 'RES-000999',
    status: 'payment_rejected',
    createdAt: '2026-10-20T10:00:00.000Z',
    updatedAt: '2026-10-20T10:00:00.000Z',
    amount: { total: 46500 },
    itemsCount: 2,
    itemsPreview: [{ image: '/img/a.jpg', name: 'Hoodie barbelé' }],
    receptionMode: 'delivery',
    city: 'Douala',
    ...overrides,
  };
}

function renderCard(item: ReservationListItem) {
  return render(
    <AppProviders client={createAppQueryClient()}>
      <MemoryRouter>
        <ReservationCard item={item} />
      </MemoryRouter>
    </AppProviders>,
  );
}

describe('Carte de réservation : cibles tactiles et hauteur égale', () => {
  it('donne 44 px au bouton d’action sous 1024 px et étire la carte sur la hauteur de la rangée', () => {
    const { container } = renderCard(makeItem({ status: 'payment_rejected' }));
    const action = screen.getByRole('link', { name: /Renvoyer ma preuve/ });
    expect(action.className).toContain('max-lg:min-h-[44px]');
    expect(action.className).toContain('min-h-[36px]');
    expect(container.querySelector('article')?.className).toContain('h-full');
  });

  it('applique la même cible au bouton « Réserver à nouveau »', () => {
    renderCard(makeItem({ status: 'delivered' }));
    expect(screen.getByRole('button', { name: 'Réserver à nouveau' }).className).toContain(
      'max-lg:min-h-[44px]',
    );
  });
});
