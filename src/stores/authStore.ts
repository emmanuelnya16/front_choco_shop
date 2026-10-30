import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import { safeStorage } from '@/lib/utils/storage';
import type { User } from '@/types/domain';

export type AuthStatus = 'unknown' | 'authenticated' | 'guest';

export interface AuthState {
  // HYPOTHÈSE: Jeton d'accès gardé uniquement en mémoire (non persisté dans localStorage)
  // et jeton de rafraîchissement géré par cookie httpOnly (durée ~90 jours côté Symfony).
  accessToken: string | null;
  user: User | null;
  status: AuthStatus;
  setSession: (accessToken: string, user: User) => void;
  setAccessToken: (accessToken: string) => void;
  clearSession: () => void;
  /** Serveur injoignable au rafraîchissement : le profil connu reste connecté (lecture hors connexion). */
  keepOfflineSession: () => void;
  getToken: () => string | null;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      accessToken: null,
      user: null,
      status: 'unknown',

      setSession: (accessToken: string, user: User) => {
        set({
          accessToken,
          user,
          status: 'authenticated',
        });
      },

      setAccessToken: (accessToken: string) => {
        set((state) => ({
          accessToken,
          status: state.user ? 'authenticated' : state.status,
        }));
      },

      clearSession: () => {
        set({
          accessToken: null,
          user: null,
          status: 'guest',
        });
      },

      // HYPOTHÈSE: sans réseau, le profil persisté est considéré comme connecté pour afficher les
      // données enregistrées ; le serveur revérifie la session à la première requête en ligne.
      keepOfflineSession: () => {
        set((state) => ({ status: state.user ? 'authenticated' : 'guest' }));
      },

      getToken: () => get().accessToken,
    }),
    {
      name: 'drchoco-auth',
      version: 1,
      storage: createJSONStorage(() => safeStorage),
      // On ne persiste que le profil utilisateur, jamais le jeton d'accès JWT
      partialize: (state) => ({ user: state.user }),
      migrate: (persistedState: unknown, version: number) => {
        if (version === 0 || !persistedState || typeof persistedState !== 'object') {
          return { user: null };
        }
        return persistedState as { user: User | null };
      },
    },
  ),
);
