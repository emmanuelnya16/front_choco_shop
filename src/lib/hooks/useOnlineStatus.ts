import { useEffect, useSyncExternalStore } from 'react';
import { useToastStore } from '@/stores/toastStore';

function subscribeOnline(callback: () => void): () => void {
  if (typeof window === 'undefined') return () => {};
  window.addEventListener('online', callback);
  window.addEventListener('offline', callback);
  return () => {
    window.removeEventListener('online', callback);
    window.removeEventListener('offline', callback);
  };
}

function getOnlineSnapshot(): boolean {
  if (typeof navigator === 'undefined') return true;
  return navigator.onLine !== false;
}

export function useOnlineStatus(): boolean {
  return useSyncExternalStore(subscribeOnline, getOnlineSnapshot, () => true);
}

/**
 * Surveille la reconnexion réseau et affiche le toast « Connexion rétablie » (§8).
 */
export function useNetworkRecoveryToast(): void {
  const showToast = useToastStore((s) => s.show);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    let wasOffline = !getOnlineSnapshot();

    const handleOffline = () => {
      wasOffline = true;
    };

    const handleOnline = () => {
      if (wasOffline) {
        wasOffline = false;
        showToast({
          message: 'Connexion rétablie',
          subtitle: 'Vous pouvez poursuivre votre réservation.',
          durationMs: 3000,
        });
      }
    };

    window.addEventListener('offline', handleOffline);
    window.addEventListener('online', handleOnline);
    return () => {
      window.removeEventListener('offline', handleOffline);
      window.removeEventListener('online', handleOnline);
    };
  }, [showToast]);
}
