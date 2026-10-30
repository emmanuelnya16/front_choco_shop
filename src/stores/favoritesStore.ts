import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import { safeStorage } from '@/lib/utils/storage';

export interface FavoritesState {
  ids: string[];
  toggle: (productId: string) => boolean;
  has: (productId: string) => boolean;
  remove: (productId: string) => void;
  clear: () => void;
  count: () => number;
}

export const selectFavoritesCount = (state: Pick<FavoritesState, 'ids'>): number =>
  state.ids.length;

export const useFavoritesStore = create<FavoritesState>()(
  persist(
    (set, get) => ({
      ids: [],

      toggle: (productId: string) => {
        const exists = get().ids.includes(productId);
        if (exists) {
          set((state) => ({
            ids: state.ids.filter((id) => id !== productId),
          }));
          return false;
        }
        set((state) => ({
          ids: [...state.ids, productId],
        }));
        return true;
      },

      has: (productId: string) => get().ids.includes(productId),

      remove: (productId: string) => {
        set((state) => ({
          ids: state.ids.filter((id) => id !== productId),
        }));
      },

      clear: () => {
        set({ ids: [] });
      },

      count: () => get().ids.length,
    }),
    {
      name: 'drchoco-favorites',
      version: 1,
      storage: createJSONStorage(() => safeStorage),
      partialize: (state) => ({ ids: state.ids }),
      migrate: (persistedState: unknown, version: number) => {
        if (version < 1 || !persistedState || typeof persistedState !== 'object') {
          return { ids: [] };
        }
        const candidate = persistedState as { ids?: unknown };
        if (!Array.isArray(candidate.ids)) {
          return { ids: [] };
        }
        return { ids: candidate.ids.filter((x): x is string => typeof x === 'string') };
      },
    },
  ),
);
