import { isIosDevice } from '@/features/payment/utils/ussd';
import { safeStorage } from '@/lib/utils/storage';

const PUSH_DISMISSED_UNTIL_KEY = 'drc_push_prompt_dismissed_until';
const PUSH_PERMISSION_CACHE_KEY = 'drc_push_permission_state';
const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;

export type PushPermissionState = NotificationPermission | 'unsupported';

/**
 * Vérifie si l'API Notification du navigateur est disponible (§6.4).
 */
export function isNotificationSupported(): boolean {
  return typeof window !== 'undefined' && 'Notification' in window;
}

/**
 * Détecte un iPhone où l'application n'est pas installée sur l'écran d'accueil (`Notification` absent, §6.4).
 */
export function isIosWithoutHomeScreenInstall(): boolean {
  if (typeof window === 'undefined') return false;
  return isIosDevice() && !('Notification' in window);
}

/**
 * Retourne l'état actuel de la permission de notifications.
 */
export function getNotificationPermission(): PushPermissionState {
  if (!isNotificationSupported()) {
    return 'unsupported';
  }
  return Notification.permission;
}

/**
 * Indique si l'utilisateur a cliqué sur « Non merci » au cours des 7 derniers jours (§6.4).
 */
export function isPushPromptDismissed(): boolean {
  const raw = safeStorage.getItem(PUSH_DISMISSED_UNTIL_KEY);
  if (!raw) return false;
  const until = Number(raw);
  return Number.isFinite(until) && until > Date.now();
}

/**
 * Masque la carte de proposition de notifications pendant 7 jours (`safeStorage`, §6.4).
 */
export function dismissPushPromptFor7Days(): void {
  const until = Date.now() + SEVEN_DAYS_MS;
  safeStorage.setItem(PUSH_DISMISSED_UNTIL_KEY, String(until));
}

/**
 * Demande la permission de notifications suite à l'appui explicite sur « Activer » (§6.4).
 */
export async function requestPermission(): Promise<PushPermissionState> {
  if (!isNotificationSupported()) {
    return 'unsupported';
  }
  try {
    const result = await Notification.requestPermission();
    safeStorage.setItem(PUSH_PERMISSION_CACHE_KEY, result);
    if (result === 'granted') {
      await subscribe();
    }
    return result;
  } catch {
    return Notification.permission;
  }
}

/**
 * HYPOTHÈSE: L'abonnement réel PushManager (`POST /push/subscribe`) sera implémenté au Module M6 (§6.4).
 * Cette fonction est volontairement vide et documentée en M4.
 */
export async function subscribe(): Promise<void> {
  // Sera connecté au Service Worker et à POST /api/v1/push/subscribe au Module M6.
}

export const pushService = {
  isNotificationSupported,
  isIosWithoutHomeScreenInstall,
  getNotificationPermission,
  isPushPromptDismissed,
  dismissPushPromptFor7Days,
  requestPermission,
  subscribe,
};
