import { getAppRegistration } from '@/features/notifications/pushService';
import { buildNotification, samplePushPayload, type PushPayload, type PushType } from '@/pwa/pushPayload';
import type { ReservationStatusCode } from '@/types/reservationStatus';

/**
 * Notifications LOCALES de /_dev (M6 §7.5) : exactement le même rendu que le service worker
 * (buildNotification), affichées par registration.showNotification, sans serveur de push.
 */
export type LocalNotificationResult = 'shown' | 'no-app-worker' | 'permission' | 'error';

/** Photo de colis de démonstration en URL absolue, comme l'URL signée envoyée par le back-end. */
export function samplePackageImageUrl(): string {
  return new URL('/mock/colis-1.svg', window.location.origin).href;
}

export function samplePayloadFor(type: PushType, ref?: string): PushPayload {
  return samplePushPayload(type, ref, type === 'package_ready' ? samplePackageImageUrl() : undefined);
}

export async function showLocalNotification(payload: PushPayload): Promise<LocalNotificationResult> {
  const registration = await getAppRegistration(0);
  if (!registration) return 'no-app-worker';
  if (typeof Notification === 'undefined' || Notification.permission !== 'granted') return 'permission';
  try {
    const { title, options } = buildNotification(payload);
    await registration.showNotification(title, options as NotificationOptions);
    return 'shown';
  } catch (error) {
    console.warn('[/_dev] Notification locale impossible :', error);
    return 'error';
  }
}

/**
 * Simulateur boutique : notification locale correspondant à l'action, seulement si l'app tourne
 * avec son service worker (npm run preview:pwa) et que la permission est accordée ; sinon rien.
 */
export async function notifyShopAction(
  type: PushType | null,
  ref: string,
  overrides: Partial<PushPayload> = {},
): Promise<boolean> {
  if (!type) return false;
  const result = await showLocalNotification({ ...samplePayloadFor(type, ref), ...overrides });
  return result === 'shown';
}

/** Notification du nouveau statut après « Étape suivante » (aucune pour les étapes internes). */
export function pushTypeAfterAdvance(status: ReservationStatusCode | undefined): PushType | null {
  if (status === 'in_delivery') return 'in_delivery';
  if (status === 'delivered' || status === 'picked_up') return 'delivered';
  return null;
}

/** Texte de la notification de rejet avec le motif choisi dans le simulateur. */
export function rejectionOverrides(ref: string, reason: string): Partial<PushPayload> {
  return { body: `${ref} : ${reason.trim() || 'capture illisible'}. Renvoyez votre preuve de paiement.` };
}
