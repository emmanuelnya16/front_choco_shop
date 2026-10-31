import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import { safeStorage } from '@/lib/utils/storage';
import { useAuthStore } from '@/stores/authStore';

/**
 * État du réseau de l'app (M6 §6.1), source unique pour tous les écrans.
 *
 * - `navigator.onLine` et les évènements `online` / `offline` du navigateur ;
 * - complétés par l'échec réel des requêtes de l'app (client HTTP) : 2 échecs réseau successifs
 *   (coupure ou délai dépassé) font passer hors connexion, la première réponse reçue fait revenir en ligne.
 */

/** Nombre d'échecs réseau successifs qui font passer l'app hors connexion. */
export const NETWORK_FAILURE_THRESHOLD = 2;

interface NetworkState {
  /** Ce que dit le navigateur (navigator.onLine, évènements online / offline). */
  browserOnline: boolean;
  /** Échecs réseau successifs des requêtes de l'app. */
  consecutiveFailures: number;
  /** État retenu par l'app : faux si le navigateur est hors ligne ou après 2 échecs successifs. */
  online: boolean;
  /** Dernier passage hors connexion (horodatage), null si l'app n'a jamais été hors connexion. */
  offlineSince: number | null;
  /** Dernier retour du réseau (horodatage) : bandeau « Connexion rétablie ». */
  recoveredAt: number | null;
  setBrowserOnline: (online: boolean) => void;
  /**
   * Réponse HTTP reçue (quel que soit son statut). Renvoie `false` si elle vient très probablement
   * des données enregistrées par l'application (navigateur hors ligne avec service worker actif) :
   * elle ne prouve alors pas le retour du réseau.
   */
  reportSuccess: () => boolean;
  /** Échec réseau d'une requête (coupure, délai dépassé). */
  reportFailure: () => void;
}

function readNavigatorOnline(): boolean {
  if (typeof navigator === 'undefined') return true;
  return navigator.onLine !== false;
}

function hasServiceWorkerController(): boolean {
  return typeof navigator !== 'undefined' && Boolean(navigator.serviceWorker?.controller);
}

function goOnline(state: NetworkState): Partial<NetworkState> {
  return {
    consecutiveFailures: 0,
    online: true,
    recoveredAt: state.online ? state.recoveredAt : Date.now(),
  };
}

function goOffline(state: NetworkState): Partial<NetworkState> {
  return {
    online: false,
    offlineSince: state.online ? Date.now() : state.offlineSince,
  };
}

export const useNetworkStore = create<NetworkState>()((set, get) => {
  const initialOnline = readNavigatorOnline();
  return {
    browserOnline: initialOnline,
    consecutiveFailures: 0,
    online: initialOnline,
    offlineSince: initialOnline ? null : Date.now(),
    recoveredAt: null,

    setBrowserOnline: (browserOnline) => {
      const state = get();
      if (browserOnline) {
        // Le navigateur retrouve un réseau : on lui fait confiance, les requêtes confirmeront
        set({ browserOnline: true, ...goOnline(state) });
      } else {
        set({ browserOnline: false, ...goOffline(state) });
      }
    },

    reportSuccess: () => {
      const state = get();
      // HYPOTHÈSE: navigateur hors ligne + service worker actif = réponse servie depuis les données
      // enregistrées sur le téléphone (règles NetworkFirst / StaleWhileRevalidate), pas par le serveur.
      if (!state.browserOnline && hasServiceWorkerController()) return false;
      if (!state.online || state.consecutiveFailures > 0 || !state.browserOnline) {
        set({ browserOnline: true, ...goOnline(state) });
      }
      return true;
    },

    reportFailure: () => {
      const state = get();
      const consecutiveFailures = state.consecutiveFailures + 1;
      if (consecutiveFailures >= NETWORK_FAILURE_THRESHOLD && state.online) {
        set({ consecutiveFailures, ...goOffline(state) });
      } else {
        set({ consecutiveFailures });
      }
    },
  };
});

/** Lecture ponctuelle (hors composant) : l'app se considère-t-elle en ligne ? */
export function isAppOnline(): boolean {
  return useNetworkStore.getState().online;
}

// Évènements du navigateur, écoutés une seule fois pour toute l'app
if (typeof window !== 'undefined') {
  window.addEventListener('online', () => useNetworkStore.getState().setBrowserOnline(true));
  window.addEventListener('offline', () => useNetworkStore.getState().setBrowserOnline(false));
  // Retour sur l'app : navigator.onLine a pu changer pendant la mise en veille sans évènement
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState !== 'visible') return;
    const browserOnline = readNavigatorOnline();
    if (browserOnline !== useNetworkStore.getState().browserOnline) {
      useNetworkStore.getState().setBrowserOnline(browserOnline);
    }
  });
}

// ---------------------------------------------------------------------------
// Date de la dernière synchronisation réelle avec le serveur (« Mis à jour le … », M6 §6.3)
// ---------------------------------------------------------------------------

/** Seules les données du client affichées hors connexion avec leur date sont suivies. */
// HYPOTHÈSE: seules les réservations (liste et détail) affichent « Mis à jour le … » (§6.3) ;
// le catalogue, public et peu changeant, n'a pas besoin de date.
const TRACKED_SYNC_PATHS = [/^\/reservations(\/|\?|$)/];
const MAX_SYNC_ENTRIES = 40;

interface SyncState {
  /** Chemin d'API (avec paramètres) → horodatage de la dernière réponse reçue du serveur. */
  syncedAt: Record<string, number>;
  recordSync: (path: string, at?: number) => void;
  clear: () => void;
}

export const useSyncStore = create<SyncState>()(
  persist(
    (set) => ({
      syncedAt: {},
      recordSync: (path, at = Date.now()) => {
        if (!TRACKED_SYNC_PATHS.some((re) => re.test(path))) return;
        set((state) => {
          const entries = Object.entries({ ...state.syncedAt, [path]: at })
            .sort((a, b) => b[1] - a[1])
            .slice(0, MAX_SYNC_ENTRIES);
          return { syncedAt: Object.fromEntries(entries) };
        });
      },
      clear: () => set({ syncedAt: {} }),
    }),
    {
      // Uniquement des chemins d'API et des dates (aucune donnée personnelle), effacés à la déconnexion
      name: 'drc-last-sync',
      version: 1,
      storage: createJSONStorage(() => safeStorage),
    },
  ),
);

/** Date de la dernière réponse du serveur pour ce chemin d'API (null si inconnue). */
export function useLastSyncedAt(path: string | null | undefined): number | null {
  return useSyncStore((s) => (path ? (s.syncedAt[path] ?? null) : null));
}

// Déconnexion : les dates liées aux réservations du client disparaissent avec sa session
useAuthStore.subscribe((state, previous) => {
  if (previous.user && !state.user) useSyncStore.getState().clear();
});
