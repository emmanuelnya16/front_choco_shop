import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router';
import {
  restoreReservationItemsToCart,
  type RestoreReservationResult,
} from '@/features/cart/restoreReservationItems';
import { api } from '@/lib/api/client';
import { endpoints } from '@/lib/api/endpoints';
import { qk } from '@/lib/api/queryKeys';
import { haptic } from '@/lib/utils/haptics';
import { useToastStore } from '@/stores/toastStore';
import type { ReservationDetailResponse } from '@/types/api';

/** Message après « Réserver à nouveau » (ex. « 2 articles ajoutés · 1 n’est plus disponible »). */
export function rebookToastMessage({ added, unavailable }: RestoreReservationResult): string {
  if (added === 0) {
    return unavailable > 1
      ? 'Ces articles ne sont plus disponibles.'
      : 'Cet article n’est plus disponible.';
  }
  const addedText = `${added} article${added > 1 ? 's' : ''} ajouté${added > 1 ? 's' : ''}`;
  if (unavailable === 0) return `${addedText} au panier`;
  return `${addedText} · ${unavailable} ${unavailable > 1 ? 'ne sont plus disponibles' : 'n’est plus disponible'}`;
}

/**
 * « Réserver à nouveau » (§5.2 M5) : charge le détail si besoin, vérifie la disponibilité,
 * ajoute au panier les articles encore disponibles, affiche le bilan puis ouvre le panier.
 * HYPOTHÈSE: fonctionnalité de fidélisation à faire valider par le client.
 */
export function useRebook() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const showToast = useToastStore((s) => s.show);

  return useMutation({
    mutationFn: async (ref: string) => {
      const normalized = ref.trim().toUpperCase();
      const reservation = await queryClient.fetchQuery({
        queryKey: qk.reservation(normalized),
        queryFn: () => api.get<ReservationDetailResponse>(endpoints.reservations.detail(normalized)),
        staleTime: 30_000,
      });
      return restoreReservationItemsToCart(reservation.items);
    },
    onSuccess: (result) => {
      haptic(result.added > 0 ? 'success' : 'light');
      showToast({
        message: rebookToastMessage(result),
        ...(result.added > 0 ? { actionLabel: 'Voir le panier', actionHref: '/panier' } : {}),
      });
      if (result.added > 0) {
        navigate('/panier', { viewTransition: true });
      }
    },
    onError: () => {
      showToast({
        message: 'Impossible de vérifier la disponibilité pour le moment. Réessayez.',
      });
    },
  });
}
