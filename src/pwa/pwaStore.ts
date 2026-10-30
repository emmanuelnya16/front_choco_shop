import { create } from 'zustand';

/** État de l'application installable : mise à jour en attente et actions en cours (M6 §4.7). */
interface PwaState {
  /** Le service worker est enregistré (l'app fonctionne hors connexion). */
  registered: boolean;
  /** Une nouvelle version est prête et attend l'accord du client. */
  updateReady: boolean;
  /** Mise à jour en cours d'application (rechargement imminent). */
  applying: boolean;
  /** Nombre d'actions en cours (envoi de preuve, création de réservation) : aucune mise à jour. */
  busyCount: number;
  setRegistered: (value: boolean) => void;
  setUpdateReady: (value: boolean) => void;
  setApplying: (value: boolean) => void;
  beginBusy: () => void;
  endBusy: () => void;
}

export const usePwaStore = create<PwaState>()((set) => ({
  registered: false,
  updateReady: false,
  applying: false,
  busyCount: 0,
  setRegistered: (registered) => set({ registered }),
  setUpdateReady: (updateReady) => set({ updateReady }),
  setApplying: (applying) => set({ applying }),
  beginBusy: () => set((s) => ({ busyCount: s.busyCount + 1 })),
  endBusy: () => set((s) => ({ busyCount: Math.max(0, s.busyCount - 1) })),
}));
