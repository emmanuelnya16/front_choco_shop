import { getPushStatus } from '@/features/notifications/pushService';
import { usePushStore, type PushStatus } from '@/pwa/pushStore';

export type NotificationsDisplayState = 'enabled' | 'disabled' | 'blocked' | 'ios-install' | 'unsupported';

const DISPLAY_STATE_BY_PUSH_STATUS: Record<PushStatus, NotificationsDisplayState> = {
  // « Activées » uniquement avec un abonnement actif (permission seule : rien n'arriverait)
  subscribed: 'enabled',
  granted: 'disabled',
  default: 'disabled',
  denied: 'blocked',
  'needs-install': 'ios-install',
  unsupported: 'unsupported',
};

export function toNotificationsDisplayState(status: PushStatus): NotificationsDisplayState {
  return DISPLAY_STATE_BY_PUSH_STATUS[status];
}

/** État affiché dans le profil (§7.2 M5, §7.1 M6), lu de façon synchrone. */
export function getNotificationsDisplayState(): NotificationsDisplayState {
  return toNotificationsDisplayState(getPushStatus());
}

/** Même état, réactif : suit la permission et l'abonnement (M6 §7.1). */
export function useNotificationsDisplayState(): NotificationsDisplayState {
  return toNotificationsDisplayState(usePushStore((s) => s.status));
}

export const NOTIFICATIONS_STATE_LABELS: Record<NotificationsDisplayState, string> = {
  enabled: 'Activées',
  disabled: 'Désactivées',
  blocked: 'Bloquées dans le navigateur',
  'ios-install': 'Application à installer',
  unsupported: 'Non disponibles',
};
