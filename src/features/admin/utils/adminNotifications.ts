import { getAppRegistration } from '@/features/notifications/pushService';
import {
  buildNotification,
  samplePushPayload,
  type PushPayload,
  type PushType,
} from '@/pwa/pushPayload';
import type { ReservationStatusCode } from '@/types/reservationStatus';

/**
 * Déclenche une notification locale du Service Worker lors d’une action de la boutique dans `/admin`
 * (quand l’application tourne avec son Service Worker actif et que la permission est accordée).
 */
export async function triggerAdminClientNotification(
  type: PushType | null,
  ref: string,
  overrides: Partial<PushPayload> = {},
): Promise<boolean> {
  if (!type || typeof window === 'undefined') return false;
  try {
    const registration = await getAppRegistration(0);
    if (!registration) return false;
    if (typeof Notification === 'undefined' || Notification.permission !== 'granted') {
      return false;
    }
    const defaultImage =
      type === 'package_ready'
        ? new URL('/mock/colis-1.svg', window.location.origin).href
        : undefined;
    const payload: PushPayload = {
      ...samplePushPayload(type, ref, defaultImage),
      ...overrides,
    };
    const { title, options } = buildNotification(payload);
    await registration.showNotification(title, options as NotificationOptions);
    return true;
  } catch {
    return false;
  }
}

export function pushTypeForStatus(status: ReservationStatusCode): PushType | null {
  if (status === 'confirmed') return 'payment_validated';
  if (status === 'payment_rejected') return 'payment_rejected';
  if (status === 'ready_for_pickup' || status === 'handed_to_agency') return 'package_ready';
  if (status === 'in_delivery') return 'in_delivery';
  if (status === 'delivered' || status === 'picked_up') return 'delivered';
  return null;
}

