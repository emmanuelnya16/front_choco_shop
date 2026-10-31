import { create } from 'zustand';
import { env } from '@/lib/env';

/**
 * État des notifications push sur ce téléphone (M6 §7.1) :
 * - `subscribed` : permission accordée ET abonnement actif (les notifications arrivent) ;
 * - `granted` : permission accordée, mais pas (ou plus) d'abonnement (désactivées dans le profil,
 *   ou abonnement impossible pour le moment) ;
 * - `default` : permission jamais demandée ;
 * - `denied` : bloquées dans le navigateur ;
 * - `unsupported` : navigateur sans Notification, service worker ou PushManager, ou application
 *   lancée sans son service worker (mode mocks du navigateur) ;
 * - `needs-install` : iPhone où l'app n'est pas installée sur l'écran d'accueil.
 */
export type PushStatus = 'subscribed' | 'granted' | 'default' | 'denied' | 'unsupported' | 'needs-install';

interface PushState {
  /**
   * Le service worker de l'app est prévu (PWA activée, pas de mocks MSW dans le navigateur) :
   * sans lui, aucune notification ne peut arriver (même condition que main.tsx).
   */
  workerEnabled: boolean;
  status: PushStatus;
  /** Point de terminaison de l'abonnement actif, ou null. */
  endpoint: string | null;
  setPushState: (status: PushStatus, endpoint: string | null) => void;
}

export const usePushStore = create<PushState>()((set) => ({
  workerEnabled: env.pwaEnabled && !env.apiMock,
  // Calculé au chargement de pushService (lecture synchrone de la permission), puis tenu à jour
  status: 'unsupported',
  endpoint: null,
  setPushState: (status, endpoint) => set({ status, endpoint }),
}));

/** Les notifications fonctionnent : permission accordée et abonnement actif. */
export const selectPushActive = (state: PushState): boolean => state.status === 'subscribed';

/** Intervalle des interrogations périodiques quand les notifications prennent le relais (M6 §7.4). */
export const PUSH_POLL_INTERVAL_MS = 2 * 60 * 1000;

/**
 * Intervalle d'interrogation des écrans de suivi : 2 minutes quand les notifications fonctionnent
 * (chaque notification rafraîchit déjà les écrans ouverts), sinon l'intervalle habituel.
 */
export function usePollIntervalMs(defaultMs: number): number {
  const pushActive = usePushStore(selectPushActive);
  return pushActive ? PUSH_POLL_INTERVAL_MS : defaultMs;
}
