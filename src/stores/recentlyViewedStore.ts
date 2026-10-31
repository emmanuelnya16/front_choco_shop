import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import { safeStorage } from '@/lib/utils/storage';
import type { Product } from '@/types/domain';

/** Carte minimale d'un article consulté : données publiques du catalogue uniquement (M6 §6.5). */
export interface RecentlyViewedItem {
  id: string;
  slug: string;
  name: string;
  price: number;
  /** Photo publique du catalogue (jamais une photo de colis ni une preuve de paiement). */
  image: string;
  fallbackImage?: string;
  viewedAt: number;
}

// HYPOTHÈSE: 12 articles gardés (6 affichés sur la page hors connexion) : de quoi retrouver les
// dernières fiches consultées sans encombrer le stockage du téléphone.
export const RECENTLY_VIEWED_MAX = 12;

interface RecentlyViewedState {
  items: RecentlyViewedItem[];
  record: (product: Pick<Product, 'id' | 'slug' | 'name' | 'price' | 'images' | 'fallbackImages'>) => void;
  clear: () => void;
}

/**
 * Derniers articles consultés (fiche produit), conservés sur le téléphone pour la page
 * « Vous êtes hors connexion » et les replis hors connexion (M6 §6.5).
 */
export const useRecentlyViewedStore = create<RecentlyViewedState>()(
  persist(
    (set) => ({
      items: [],
      record: (product) => {
        const image = product.images[0] ?? product.fallbackImages[0];
        if (!image) return;
        const entry: RecentlyViewedItem = {
          id: product.id,
          slug: product.slug,
          name: product.name,
          price: product.price,
          image,
          fallbackImage: product.fallbackImages[0],
          viewedAt: Date.now(),
        };
        set((state) => ({
          items: [entry, ...state.items.filter((item) => item.slug !== product.slug)].slice(
            0,
            RECENTLY_VIEWED_MAX,
          ),
        }));
      },
      clear: () => set({ items: [] }),
    }),
    {
      name: 'drchoco-recently-viewed',
      version: 1,
      storage: createJSONStorage(() => safeStorage),
      partialize: (state) => ({ items: state.items }),
    },
  ),
);
