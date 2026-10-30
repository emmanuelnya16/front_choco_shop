import { create } from 'zustand';
import { useAuthStore } from './authStore';
import type { Product } from '@/types/domain';

export type SizePickerIntent = 'add' | 'reserve';

export interface SourceRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface FlyingCartItem {
  id: string;
  image: string;
  fallback?: string;
  sourceRect: SourceRect;
  targetSelector?: string;
}

export interface UiState {
  sizePickerProduct: Product | null;
  sizePickerIntent: SizePickerIntent;
  sizePickerSourceRect: SourceRect | null;
  isMegaMenuOpen: boolean;

  /** Tiroir latéral du panier sur ordinateur (§4.3) */
  isCartDrawerOpen: boolean;
  cartDrawerAutoOpened: boolean;

  /** Feuille de connexion OTP globale (§5.1) */
  isAuthSheetOpen: boolean;
  pendingAuthAction: (() => void) | null;
  onAuthSheetCancel: (() => void) | null;

  /** Slug de l'article dont la photo porte `view-transition-name: product-${slug}` (§4.2) */
  activeTransitionSlug: string | null;

  /** Coordonnées (px) de l'icône loupe pour l'ouverture circulaire de la recherche mobile (§6.1) */
  searchOrigin: { x: number; y: number } | null;

  /** File d'attente des miniatures en vol vers le panier (plafonnée à 3 simultanées, §7.9) */
  flyingItems: FlyingCartItem[];
  cartBounceTick: number;
  mobileCartPeekVisible: boolean;

  openSizePicker: (
    product: Product,
    intent?: SizePickerIntent,
    sourceRect?: SourceRect | null,
  ) => void;
  closeSizePicker: () => void;
  setMegaMenuOpen: (open: boolean) => void;
  toggleMegaMenu: () => void;

  openCartDrawer: (autoOpened?: boolean) => void;
  closeCartDrawer: () => void;

  /**
   * Exécute immédiatement `next()` si le client est authentifié,
   * sinon ouvre `AuthSheet` par-dessus l'écran courant et reprendra `next()` après connexion (§5.1).
   */
  requireAuth: (next: () => void, onCancel?: () => void) => void;
  openAuthSheet: (next?: () => void, onCancel?: () => void) => void;
  closeAuthSheet: (cancelled?: boolean) => void;
  consumeAuthAction: () => void;

  setActiveTransitionSlug: (slug: string | null) => void;
  setSearchOrigin: (origin: { x: number; y: number } | null) => void;
  triggerFlyToCart: (item: Omit<FlyingCartItem, 'id'>) => void;
  completeFlyToCart: (id: string) => void;
  bumpCartBounce: () => void;
  showMobileCartPeek: () => void;
}

let flyCounter = 0;
let peekTimer: number | null = null;

export const useUiStore = create<UiState>((set, get) => ({
  sizePickerProduct: null,
  sizePickerIntent: 'add',
  sizePickerSourceRect: null,
  isMegaMenuOpen: false,
  isCartDrawerOpen: false,
  cartDrawerAutoOpened: false,
  isAuthSheetOpen: false,
  pendingAuthAction: null,
  onAuthSheetCancel: null,
  activeTransitionSlug: null,
  searchOrigin: null,
  flyingItems: [],
  cartBounceTick: 0,
  mobileCartPeekVisible: false,

  openSizePicker: (
    product: Product,
    intent: SizePickerIntent = 'add',
    sourceRect: SourceRect | null = null,
  ) => {
    set({
      sizePickerProduct: product,
      sizePickerIntent: intent,
      sizePickerSourceRect: sourceRect,
    });
  },

  closeSizePicker: () => {
    set({
      sizePickerProduct: null,
      sizePickerSourceRect: null,
    });
  },

  setMegaMenuOpen: (open: boolean) => {
    set({ isMegaMenuOpen: open });
  },

  toggleMegaMenu: () => {
    set((state) => ({ isMegaMenuOpen: !state.isMegaMenuOpen }));
  },

  openCartDrawer: (autoOpened = false) => {
    set({ isCartDrawerOpen: true, cartDrawerAutoOpened: autoOpened });
  },

  closeCartDrawer: () => {
    set({ isCartDrawerOpen: false, cartDrawerAutoOpened: false });
  },

  requireAuth: (next: () => void, onCancel?: () => void) => {
    const authState = useAuthStore.getState();
    if (authState.status === 'authenticated' && authState.user) {
      next();
      return;
    }
    set({
      isAuthSheetOpen: true,
      pendingAuthAction: next,
      onAuthSheetCancel: onCancel ?? null,
    });
  },

  openAuthSheet: (next?: () => void, onCancel?: () => void) => {
    set({
      isAuthSheetOpen: true,
      pendingAuthAction: next ?? null,
      onAuthSheetCancel: onCancel ?? null,
    });
  },

  closeAuthSheet: (cancelled = true) => {
    const cancelCb = get().onAuthSheetCancel;
    set({
      isAuthSheetOpen: false,
      pendingAuthAction: null,
      onAuthSheetCancel: null,
    });
    if (cancelled && cancelCb) {
      cancelCb();
    }
  },

  consumeAuthAction: () => {
    const action = get().pendingAuthAction;
    set({
      isAuthSheetOpen: false,
      pendingAuthAction: null,
      onAuthSheetCancel: null,
    });
    if (action) {
      action();
    }
  },

  setActiveTransitionSlug: (slug: string | null) => {
    set({ activeTransitionSlug: slug });
  },

  setSearchOrigin: (origin) => {
    set({ searchOrigin: origin });
  },

  triggerFlyToCart: (input) => {
    flyCounter += 1;
    const id = `fly-${Date.now()}-${flyCounter}`;
    set((state) => ({
      // Maximum 3 copies simultanées (§7.9)
      flyingItems: [...state.flyingItems.slice(-2), { ...input, id }],
    }));
  },

  completeFlyToCart: (id: string) => {
    set((state) => ({
      flyingItems: state.flyingItems.filter((item) => item.id !== id),
      cartBounceTick: state.cartBounceTick + 1,
    }));
  },

  bumpCartBounce: () => {
    set((state) => ({
      cartBounceTick: state.cartBounceTick + 1,
    }));
  },

  showMobileCartPeek: () => {
    if (typeof window !== 'undefined' && peekTimer) {
      window.clearTimeout(peekTimer);
    }
    set({ mobileCartPeekVisible: true });
    if (typeof window !== 'undefined') {
      peekTimer = window.setTimeout(() => {
        set({ mobileCartPeekVisible: false });
        peekTimer = null;
      }, 2200);
    }
  },
}));
