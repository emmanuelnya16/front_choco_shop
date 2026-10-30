import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import { safeStorage } from '@/lib/utils/storage';
import type { ReservationStatusCode } from '@/types/reservationStatus';

/**
 * Suivi des nouveautés (§3.4 M5), persistant sur le téléphone.
 * Ne contient que des références et des statuts : jamais d'URL de photo (§6.4 M5).
 */
export interface SeenEntry {
  /** Dernier statut affiché au client dans le détail. */
  status: ReservationStatusCode;
  updatedAt: string;
  /** Le dévoilement animé des photos du colis a déjà été joué. */
  photosRevealed: boolean;
}

export interface TrackingSeenState {
  /**
   * Date de première utilisation du suivi sur ce téléphone : une réservation jamais ouverte
   * n'est « nouvelle » que si elle a changé après cette date (évite un repère sur tout l'historique).
   */
  initializedAt: string;
  byRef: Record<string, SeenEntry>;
  /** Références pour lesquelles le message « Votre colis est prêt » a déjà été montré à l'ouverture. */
  packageToastShown: string[];
  markSeen: (ref: string, status: ReservationStatusCode, updatedAt: string) => void;
  markPhotosRevealed: (ref: string, status: ReservationStatusCode, updatedAt: string) => void;
  markPackageToastShown: (ref: string) => void;
  reset: () => void;
}

export const useSeenStore = create<TrackingSeenState>()(
  persist(
    (set) => ({
      initializedAt: '',
      byRef: {},
      packageToastShown: [],

      markSeen: (ref, status, updatedAt) => {
        set((state) => {
          const previous = state.byRef[ref];
          if (previous && previous.status === status && previous.updatedAt === updatedAt) {
            return state;
          }
          return {
            byRef: {
              ...state.byRef,
              [ref]: { status, updatedAt, photosRevealed: previous?.photosRevealed ?? false },
            },
          };
        });
      },

      markPhotosRevealed: (ref, status, updatedAt) => {
        set((state) => ({
          byRef: {
            ...state.byRef,
            [ref]: {
              status: state.byRef[ref]?.status ?? status,
              updatedAt: state.byRef[ref]?.updatedAt ?? updatedAt,
              photosRevealed: true,
            },
          },
          packageToastShown: state.packageToastShown.includes(ref)
            ? state.packageToastShown
            : [...state.packageToastShown, ref],
        }));
      },

      markPackageToastShown: (ref) => {
        set((state) =>
          state.packageToastShown.includes(ref)
            ? state
            : { packageToastShown: [...state.packageToastShown, ref] },
        );
      },

      reset: () => {
        set({ initializedAt: new Date().toISOString(), byRef: {}, packageToastShown: [] });
      },
    }),
    {
      name: 'drchoco-tracking-seen',
      version: 1,
      storage: createJSONStorage(() => safeStorage),
      partialize: (state) => ({
        initializedAt: state.initializedAt,
        byRef: state.byRef,
        packageToastShown: state.packageToastShown,
      }),
    },
  ),
);

// Fixe la date de référence à la toute première ouverture de l'app (le stockage est lu de façon synchrone).
if (!useSeenStore.getState().initializedAt) {
  useSeenStore.setState({ initializedAt: new Date().toISOString() });
}

// HYPOTHÈSE: statuts qui demandent une action du client (identiques au calcul serveur de `needsAction`).
const CLIENT_ACTION_STATUSES: ReadonlySet<ReservationStatusCode> = new Set([
  'reserved',
  'payment_rejected',
  'ready_for_pickup',
]);

export function isClientActionStatus(status: ReservationStatusCode): boolean {
  return CLIENT_ACTION_STATUSES.has(status);
}

interface TrackedItem {
  status: ReservationStatusCode;
  updatedAt: string;
}

/**
 * Point « Nouveau » d'une carte : le statut a changé depuis la dernière ouverture du détail,
 * ou, pour une réservation jamais ouverte, elle a changé après la date de référence.
 */
export function hasUnseenChange(
  item: TrackedItem,
  entry: SeenEntry | undefined,
  initializedAt: string,
): boolean {
  if (entry) {
    return entry.status !== item.status;
  }
  const baseline = new Date(initializedAt).getTime();
  return Number.isFinite(baseline) && new Date(item.updatedAt).getTime() > baseline;
}

/** Repère de l'onglet : une action est attendue et pas encore vue, ou un changement n'a pas été vu. */
export function needsAttention(
  item: TrackedItem,
  entry: SeenEntry | undefined,
  initializedAt: string,
): boolean {
  if (hasUnseenChange(item, entry, initializedAt)) return true;
  return isClientActionStatus(item.status) && entry?.status !== item.status;
}
