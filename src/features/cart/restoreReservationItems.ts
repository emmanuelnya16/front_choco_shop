import { api } from '@/lib/api/client';
import { endpoints } from '@/lib/api/endpoints';
import { useCartStore } from '@/stores/cartStore';
import type { CartValidatePayload, CartValidationResult } from '@/types/api';
import type { CartItem, ReservationItem } from '@/types/domain';

export interface RestoreReservationResult {
  /** Lignes remises dans le panier. */
  added: number;
  /** Lignes qui ne sont plus disponibles. */
  unavailable: number;
}

function toCartItem(
  item: ReservationItem,
  unitPrice: number,
  quantity: number,
  maxQuantity: number,
): CartItem {
  return {
    productId: item.productId,
    slug: item.slug,
    name: item.name,
    image: item.image,
    variantId: item.variantId,
    size: item.size,
    color: {
      code: item.colorCode ?? item.colorName.toLowerCase().replace(/\s+/g, '-'),
      name: item.colorName,
      // Teinte fournie par l'API ; à défaut, la pastille du panier prend la couleur du jeton `ink`.
      hex: item.colorHex ?? 'var(--color-ink)',
    },
    unitPrice,
    quantity,
    maxQuantity,
  };
}

/**
 * Vérifie la disponibilité réelle (`POST /cart/validate`) et remet dans le panier
 * uniquement les articles encore en stock, dans la limite du stock (§5.2 M5, §7.3 M4).
 * Lève une erreur si la vérification échoue (réseau) : l'appelant choisit le repli.
 */
export async function restoreReservationItemsToCart(
  items: ReservationItem[],
): Promise<RestoreReservationResult> {
  const payload: CartValidatePayload = {
    items: items.map((item) => ({ variantId: item.variantId, quantity: item.quantity })),
  };
  const validation = await api.post<CartValidationResult>(endpoints.cart.validate, payload);
  const byVariant = new Map(validation.items.map((v) => [v.variantId, v]));
  const cart = useCartStore.getState();

  let added = 0;
  let unavailable = 0;

  for (const item of items) {
    const check = byVariant.get(item.variantId);
    const availableQty = check ? check.availableQuantity : item.quantity;
    if (check?.status === 'unavailable' || availableQty <= 0) {
      unavailable += 1;
      continue;
    }
    cart.add(
      toCartItem(item, check?.unitPrice ?? item.unitPrice, Math.min(item.quantity, availableQty), availableQty),
    );
    added += 1;
  }

  return { added, unavailable };
}

/** Repli hors connexion : remet tout dans le panier, la page Panier revérifiera le stock. */
export function addReservationItemsWithoutCheck(items: ReservationItem[]): void {
  const cart = useCartStore.getState();
  for (const item of items) {
    cart.add(toCartItem(item, item.unitPrice, item.quantity, Math.max(1, item.quantity)));
  }
}
