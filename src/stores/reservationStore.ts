import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import { safeStorage } from '@/lib/utils/storage';
import type { Reservation } from '@/types/domain';

const DISMISSED_BANNER_SESSION_KEY = 'drc_dismissed_pending_banner_ref';

function getDismissedRefFromSession(): string | null {
  if (typeof window === 'undefined') return null;
  try {
    return window.sessionStorage.getItem(DISMISSED_BANNER_SESSION_KEY);
  } catch {
    return null;
  }
}

function setDismissedRefInSession(ref: string | null) {
  if (typeof window === 'undefined') return;
  try {
    if (ref) {
      window.sessionStorage.setItem(DISMISSED_BANNER_SESSION_KEY, ref);
    } else {
      window.sessionStorage.removeItem(DISMISSED_BANNER_SESSION_KEY);
    }
  } catch {
    // Ignore storage errors
  }
}

export interface ReservationStoreState {
  activeReservation: Reservation | null;
  serverTimeOffsetMs: number;
  bannerDismissedRef: string | null;
  setActiveReservation: (
    reservation: Reservation | null,
    serverTimeIso?: string,
  ) => void;
  dismissBanner: (ref: string) => void;
  clearActiveReservation: () => void;
}

export const useReservationStore = create<ReservationStoreState>()(
  persist(
    (set) => ({
      activeReservation: null,
      serverTimeOffsetMs: 0,
      bannerDismissedRef: getDismissedRefFromSession(),

      setActiveReservation: (reservation, serverTimeIso) => {
        let offsetMs = 0;
        const rawServerTime = serverTimeIso ?? reservation?.serverTime;
        if (rawServerTime) {
          const parsed = new Date(rawServerTime).getTime();
          if (!Number.isNaN(parsed)) {
            offsetMs = parsed - Date.now();
          }
        }
        set({
          activeReservation: reservation,
          serverTimeOffsetMs: offsetMs,
        });
      },

      dismissBanner: (ref: string) => {
        setDismissedRefInSession(ref);
        set({ bannerDismissedRef: ref });
      },

      clearActiveReservation: () => {
        setDismissedRefInSession(null);
        set({
          activeReservation: null,
          serverTimeOffsetMs: 0,
          bannerDismissedRef: null,
        });
      },
    }),
    {
      name: 'drchoco-active-reservation',
      version: 1,
      storage: createJSONStorage(() => safeStorage),
      partialize: (state) => ({
        activeReservation: state.activeReservation,
        serverTimeOffsetMs: state.serverTimeOffsetMs,
      }),
    },
  ),
);
