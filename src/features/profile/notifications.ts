import { pushService, type PushPermissionState } from '@/features/notifications/pushService';

export type NotificationsDisplayState = 'enabled' | 'disabled' | 'blocked' | 'ios-install' | 'unsupported';

/** État affiché dans le profil (§7.2 M5). */
export function getNotificationsDisplayState(): NotificationsDisplayState {
  if (pushService.isIosWithoutHomeScreenInstall()) return 'ios-install';
  const permission: PushPermissionState = pushService.getNotificationPermission();
  if (permission === 'unsupported') return 'unsupported';
  if (permission === 'granted') return 'enabled';
  if (permission === 'denied') return 'blocked';
  return 'disabled';
}

export const NOTIFICATIONS_STATE_LABELS: Record<NotificationsDisplayState, string> = {
  enabled: 'Activées',
  disabled: 'Désactivées',
  blocked: 'Bloquées dans le navigateur',
  'ios-install': 'Application à installer',
  unsupported: 'Non disponibles',
};
