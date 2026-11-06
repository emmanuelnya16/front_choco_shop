import type { PushPayload } from './pushPayload';

/**
 * En-tête posé par le service worker quand il répond avec une copie enregistrée faute de réseau
 * (NetworkFirst en échec ou délai dépassé) : le client le compte comme un échec réseau (M6 §6.1),
 * pour détecter un téléphone « en ligne » sans vraie connexion, tout en affichant les données.
 */
export const OFFLINE_FALLBACK_HEADER = 'X-DRC-Offline-Fallback';

/**
 * En-tête posé par le service worker sur toute réponse de l'API servie depuis ses données
 * enregistrées (catalogue en StaleWhileRevalidate, copie de secours des données du client) : elle ne
 * prouve pas que le serveur répond, le client ne la compte ni comme un succès ni comme un échec.
 * L'échec éventuel de la mise à jour en arrière-plan est signalé par le message NETWORK_STATUS.
 */
export const FROM_CACHE_HEADER = 'X-DRC-From-Cache';

/** Messages échangés entre l'app et le service worker (M6 §4.6). */
export const SW_MESSAGES = {
  skipWaiting: 'SKIP_WAITING',
  clearUserData: 'CLEAR_USER_DATA',
  getVersion: 'GET_VERSION',
  pushReceived: 'PUSH_RECEIVED',
  navigate: 'NAVIGATE',
  /** Mise à jour en arrière-plan d'une réponse du catalogue : serveur joignable ou non. */
  networkStatus: 'NETWORK_STATUS',
} as const;

export type AppToSwMessage =
  | { type: typeof SW_MESSAGES.skipWaiting }
  | { type: typeof SW_MESSAGES.clearUserData }
  | { type: typeof SW_MESSAGES.getVersion };

export type SwToAppMessage =
  | {
      type: typeof SW_MESSAGES.pushReceived;
      payload: PushPayload;
      /** Vrai si le service worker a affiché une notification système (app en arrière-plan). */
      shownAsNotification: boolean;
    }
  | { type: typeof SW_MESSAGES.navigate; url: string }
  | { type: typeof SW_MESSAGES.networkStatus; reachable: boolean };

/** Réponses envoyées sur le port fourni avec le message. */
export type SwReply = { ok: true; version?: string } | { ok: false; error: string };

export function isSwToAppMessage(data: unknown): data is SwToAppMessage {
  if (!data || typeof data !== 'object') return false;
  const type = (data as { type?: unknown }).type;
  return type === SW_MESSAGES.pushReceived || type === SW_MESSAGES.navigate || type === SW_MESSAGES.networkStatus;
}
