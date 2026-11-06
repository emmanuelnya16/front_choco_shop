import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import type { AdminUser } from '@/features/admin/types';
import { safeStorage } from '@/lib/utils/storage';

export type AdminAuthStatus = 'unknown' | 'authenticated' | 'guest';

interface AdminAuthState {
  /** Jeton court d’administration conservé uniquement en mémoire vive (jamais dans localStorage). */
  accessToken: string | null;
  /** Profil de l’administrateur connecté (persisté hors jeton dans `drc_admin_user_v1`). */
  admin: AdminUser | null;
  status: AdminAuthStatus;
  setAdminSession: (token: string, admin: AdminUser) => void;
  setAdminAccessToken: (token: string | null) => void;
  clearAdminSession: () => void;
}

export const useAdminAuthStore = create<AdminAuthState>()(
  persist(
    (set) => ({
      accessToken: null,
      admin: null,
      status: 'unknown',

      setAdminSession: (token, admin) => {
        set({
          accessToken: token,
          admin,
          status: 'authenticated',
        });
      },

      setAdminAccessToken: (token) => {
        set((state) => ({
          accessToken: token,
          status: token ? 'authenticated' : state.admin ? 'authenticated' : 'guest',
        }));
      },

      clearAdminSession: () => {
        set({
          accessToken: null,
          admin: null,
          status: 'guest',
        });
      },
    }),
    {
      name: 'drc_admin_user_v1',
      storage: createJSONStorage(() => safeStorage),
      partialize: (state) => ({
        admin: state.admin,
      }),
      onRehydrateStorage: () => (state) => {
        if (!state) return;
        if (state.admin) {
          state.status = 'authenticated';
        } else {
          state.status = 'guest';
        }
      },
    },
  ),
);

