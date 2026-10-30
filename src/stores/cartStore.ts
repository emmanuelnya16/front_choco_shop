import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import { safeStorage } from '@/lib/utils/storage';
import type { CartValidationItemResult, CartValidationResult } from '@/types/api';
import type { CartItem } from '@/types/domain';

export interface CartState {
  items: CartItem[];
  validationMap: Record<string, CartValidationItemResult>;
  lastValidatedAt: number | null;
  add: (item: CartItem) => void;
  remove: (variantId: string) => void;
  restore: (item: CartItem, index?: number) => void;
  setQuantity: (variantId: string, quantity: number) => void;
  applyValidation: (result: CartValidationResult) => void;
  clearValidation: () => void;
  clear: () => void;
  count: () => number;
  subtotal: () => number;
}

export const selectCartCount = (state: Pick<CartState, 'items'>): number =>
  state.items.reduce((sum, item) => sum + item.quantity, 0);

export const selectCartSubtotal = (
  state: Pick<CartState, 'items' | 'validationMap'>,
): number =>
  state.items.reduce((sum, item) => {
    const validation = state.validationMap?.[item.variantId];
    if (validation?.status === 'unavailable' || item.maxQuantity <= 0) {
      return sum;
    }
    return sum + item.unitPrice * item.quantity;
  }, 0);

export const selectHasUnavailableItems = (
  state: Pick<CartState, 'items' | 'validationMap'>,
): boolean =>
  state.items.some(
    (item) =>
      state.validationMap?.[item.variantId]?.status === 'unavailable' ||
      item.maxQuantity <= 0,
  );

export const useCartStore = create<CartState>()(
  persist(
    (set, get) => ({
      items: [],
      validationMap: {},
      lastValidatedAt: null,

      add: (incoming: CartItem) => {
        if (incoming.quantity <= 0 || incoming.maxQuantity <= 0) {
          return;
        }
        set((state) => {
          const existingIndex = state.items.findIndex(
            (item) => item.variantId === incoming.variantId,
          );

          const nextValidation = { ...state.validationMap };
          delete nextValidation[incoming.variantId];

          if (existingIndex === -1) {
            const clampedQty = Math.min(incoming.quantity, incoming.maxQuantity);
            return {
              items: [...state.items, { ...incoming, quantity: clampedQty }],
              validationMap: nextValidation,
            };
          }

          const updated = [...state.items];
          const current = updated[existingIndex];
          const maxQty = Math.max(1, incoming.maxQuantity);
          const mergedQty = Math.min(current.quantity + incoming.quantity, maxQty);

          updated[existingIndex] = {
            ...current,
            ...incoming,
            maxQuantity: maxQty,
            quantity: mergedQty,
          };

          return {
            items: updated,
            validationMap: nextValidation,
          };
        });
      },

      remove: (variantId: string) => {
        set((state) => {
          const nextValidation = { ...state.validationMap };
          delete nextValidation[variantId];
          return {
            items: state.items.filter((item) => item.variantId !== variantId),
            validationMap: nextValidation,
          };
        });
      },

      restore: (restored: CartItem, index?: number) => {
        set((state) => {
          const filtered = state.items.filter(
            (item) => item.variantId !== restored.variantId,
          );
          const targetIdx =
            typeof index === 'number' && index >= 0 && index <= filtered.length
              ? index
              : filtered.length;
          const nextItems = [...filtered];
          nextItems.splice(targetIdx, 0, restored);
          return { items: nextItems };
        });
      },

      setQuantity: (variantId: string, quantity: number) => {
        if (quantity <= 0) {
          get().remove(variantId);
          return;
        }
        set((state) => ({
          items: state.items.map((item) => {
            if (item.variantId !== variantId) {
              return item;
            }
            if (item.maxQuantity <= 0) {
              return item;
            }
            const clamped = Math.min(
              Math.max(1, Math.round(quantity)),
              item.maxQuantity,
            );
            return { ...item, quantity: clamped };
          }),
        }));
      },

      applyValidation: (result: CartValidationResult) => {
        set((state) => {
          const byVariant = new Map(result.items.map((v) => [v.variantId, v]));
          const nextValidationMap: Record<string, CartValidationItemResult> = {};

          const nextItems = state.items.map((item) => {
            const v = byVariant.get(item.variantId);
            if (!v) {
              return item;
            }

            if (v.status === 'unavailable' || v.availableQuantity <= 0) {
              nextValidationMap[item.variantId] = {
                ...v,
                status: 'unavailable',
                availableQuantity: 0,
              };
              return {
                ...item,
                maxQuantity: 0,
              };
            }

            if (v.status === 'reduced') {
              const newQty = Math.min(item.quantity, v.availableQuantity);
              nextValidationMap[item.variantId] = v;
              return {
                ...item,
                quantity: Math.max(1, newQty),
                maxQuantity: v.availableQuantity,
                unitPrice: v.unitPrice,
              };
            }

            if (v.status === 'price_changed') {
              nextValidationMap[item.variantId] = {
                ...v,
                previousPrice: v.previousPrice ?? item.unitPrice,
              };
              return {
                ...item,
                maxQuantity: v.availableQuantity,
                quantity: Math.min(item.quantity, v.availableQuantity),
                unitPrice: v.unitPrice,
              };
            }

            return {
              ...item,
              maxQuantity: v.availableQuantity,
              quantity: Math.min(item.quantity, v.availableQuantity),
              unitPrice: v.unitPrice,
            };
          });

          return {
            items: nextItems,
            validationMap: nextValidationMap,
            lastValidatedAt: new Date(result.checkedAt).getTime() || Date.now(),
          };
        });
      },

      clearValidation: () => {
        set({ validationMap: {}, lastValidatedAt: null });
      },

      clear: () => {
        set({ items: [], validationMap: {}, lastValidatedAt: null });
      },

      count: () => selectCartCount(get()),

      subtotal: () => selectCartSubtotal(get()),
    }),
    {
      name: 'drchoco-cart',
      version: 1,
      storage: createJSONStorage(() => safeStorage),
      partialize: (state) => ({ items: state.items }),
      migrate: (persistedState: unknown, version: number) => {
        if (version < 1 || !persistedState || typeof persistedState !== 'object') {
          return { items: [] };
        }
        const candidate = persistedState as { items?: unknown };
        if (!Array.isArray(candidate.items)) {
          return { items: [] };
        }
        return { items: candidate.items as CartItem[] };
      },
    },
  ),
);
