import { useMutation } from '@tanstack/react-query';
import { api } from '@/lib/api/client';
import { endpoints } from '@/lib/api/endpoints';
import { useCartStore } from '@/stores/cartStore';
import type { CartValidatePayload, CartValidationResult } from '@/types/api';

/**
 * Vérification du stock et des prix du panier (`POST /cart/validate`, §3.3 & §4.4).
 * Plafond de délai d'attente de 2 000 ms au moment de réserver pour ne jamais bloquer le client.
 */
export function useValidateCart() {
  const applyValidation = useCartStore((s) => s.applyValidation);

  return useMutation({
    mutationFn: async (options?: {
      payload?: CartValidatePayload;
      timeoutMs?: number;
      chaos?: boolean;
    }): Promise<CartValidationResult> => {
      const currentItems = useCartStore.getState().items;
      const body: CartValidatePayload = options?.payload ?? {
        items: currentItems.map((item) => ({
          variantId: item.variantId,
          quantity: item.quantity,
        })),
      };

      if (body.items.length === 0) {
        return {
          items: [],
          checkedAt: new Date().toISOString(),
        };
      }

      const headers: Record<string, string> = {};
      if (options?.chaos) {
        headers['x-mock-chaos'] = '1';
      }

      const result = await api.post<CartValidationResult>(
        endpoints.cart.validate,
        body,
        {
          timeoutMs: options?.timeoutMs ?? 2000,
          headers,
        },
      );

      applyValidation(result);
      return result;
    },
  });
}
