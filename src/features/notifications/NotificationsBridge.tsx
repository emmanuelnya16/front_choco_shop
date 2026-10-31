import { useEffect, useRef } from 'react';
import { useAppBadge } from '@/features/notifications/appBadge';
import { refreshPushStatus, syncPushSubscription } from '@/features/notifications/pushService';
import { useServiceWorkerMessages } from '@/pwa/swMessages';
import { useAuthStore } from '@/stores/authStore';

/**
 * Abonnement automatique (M6 §7.1) : à chaque connexion si la permission est déjà accordée, et au
 * démarrage si l'abonnement a changé. Attend une session authentifiée AVEC jeton (sinon le POST
 * partirait sans jeton : hors connexion, la session gardée n'en a pas).
 */
function usePushSubscriptionSync(): void {
  const status = useAuthStore((s) => s.status);
  const hasToken = useAuthStore((s) => Boolean(s.accessToken));
  // Un passage par « invité » dans cet onglet : la prochaine session authentifiée est une connexion
  const sawGuestRef = useRef(false);

  useEffect(() => {
    if (status === 'guest') {
      sawGuestRef.current = true;
      return;
    }
    if (status !== 'authenticated' || !hasToken) return;
    const trigger = sawGuestRef.current ? 'login' : 'startup';
    sawGuestRef.current = false;
    void syncPushSubscription(trigger);
  }, [status, hasToken]);

  // État tenu à jour : retour sur l'app et permission changée dans les réglages du navigateur
  useEffect(() => {
    const resync = () => {
      const { status: authStatus, accessToken } = useAuthStore.getState();
      if (authStatus === 'authenticated' && accessToken) void syncPushSubscription('startup');
      else void refreshPushStatus();
    };
    const onVisible = () => {
      if (document.visibilityState === 'visible') void refreshPushStatus();
    };
    void refreshPushStatus();
    document.addEventListener('visibilitychange', onVisible);

    let cancelled = false;
    let permissionStatus: PermissionStatus | null = null;
    void navigator.permissions
      ?.query({ name: 'notifications' })
      .then((result) => {
        if (cancelled) return;
        permissionStatus = result;
        result.addEventListener('change', resync);
      })
      .catch(() => undefined);

    return () => {
      cancelled = true;
      document.removeEventListener('visibilitychange', onVisible);
      permissionStatus?.removeEventListener('change', resync);
    };
  }, []);
}

/**
 * Pont des notifications, monté une fois dans RootLayout : messages du service worker
 * (rafraîchissement, toast, navigation), abonnement automatique et pastille de l'icône.
 */
export function NotificationsBridge() {
  useServiceWorkerMessages();
  usePushSubscriptionSync();
  useAppBadge();
  return null;
}
