import type { PushPayload } from './pushPayload';

/** Messages échangés entre l'app et le service worker (M6 §4.6). */
export const SW_MESSAGES = {
  skipWaiting: 'SKIP_WAITING',
  clearUserData: 'CLEAR_USER_DATA',
  getVersion: 'GET_VERSION',
  pushReceived: 'PUSH_RECEIVED',
  navigate: 'NAVIGATE',
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
  | { type: typeof SW_MESSAGES.navigate; url: string };

/** Réponses envoyées sur le port fourni avec le message. */
export type SwReply = { ok: true; version?: string } | { ok: false; error: string };

export function isSwToAppMessage(data: unknown): data is SwToAppMessage {
  if (!data || typeof data !== 'object') return false;
  const type = (data as { type?: unknown }).type;
  return type === SW_MESSAGES.pushReceived || type === SW_MESSAGES.navigate;
}
