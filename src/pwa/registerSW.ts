import { Workbox } from 'workbox-window';
import { UPDATED_FLAG_KEY, usePwaStore } from './pwaStore';
import { SW_MESSAGES, type AppToSwMessage, type SwReply } from './swProtocol';

const SW_URL = '/sw.js';
const UPDATE_CHECK_INTERVAL_MS = 60 * 60 * 1000;
export { UPDATED_FLAG_KEY } from './pwaStore';

let workbox: Workbox | null = null;

function hasServiceWorker(): boolean {
  return typeof navigator !== 'undefined' && 'serviceWorker' in navigator;
}

/**
 * Enregistre le service worker de l'app (M6 §4.4). Appelé par main.tsx uniquement si la PWA est
 * activée et que les mocks MSW ne tournent pas (un seul service worker par portée).
 */
export function registerServiceWorker(): void {
  if (!hasServiceWorker() || workbox) return;
  const wb = new Workbox(SW_URL, { scope: '/' });
  workbox = wb;

  // Nouvelle version installée, en attente : le bandeau la propose au bon moment (§4.7)
  wb.addEventListener('waiting', () => {
    usePwaStore.getState().setUpdateReady(true);
  });

  // La nouvelle version a pris la main après « Mettre à jour » : on recharge une seule fois
  wb.addEventListener('controlling', (event) => {
    // `isUpdate` reste faux si aucune version ne contrôlait la page à l'enregistrement (première
    // visite gardée ouverte) : l'accord du client (`applying`) suffit alors à recharger (M6 §4.7)
    if (!event.isUpdate && !usePwaStore.getState().applying) return;
    try {
      sessionStorage.setItem(UPDATED_FLAG_KEY, '1');
    } catch {
      // Stockage indisponible : pas de toast, la mise à jour s'applique quand même
    }
    window.location.reload();
  });

  void wb
    .register()
    .then((registration) => {
      usePwaStore.getState().setRegistered(Boolean(registration));
      // Vérifications : au démarrage (register), au retour sur l'app et toutes les 60 minutes
      const check = () => {
        void wb.update().catch(() => undefined);
      };
      window.setInterval(check, UPDATE_CHECK_INTERVAL_MS);
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') check();
      });
    })
    .catch((error: unknown) => {
      console.warn('[PWA] Enregistrement impossible :', error);
    });
}

/** Active la version en attente ; la page se recharge quand elle prend la main. */
export function applyUpdate(): void {
  if (!workbox) return;
  usePwaStore.getState().setApplying(true);
  workbox.messageSkipWaiting();
}

/** Envoie un message au service worker actif et attend sa réponse (null sans service worker). */
export async function messageServiceWorker(message: AppToSwMessage, timeoutMs = 3000): Promise<SwReply | null> {
  if (!hasServiceWorker()) return null;
  const registration = await navigator.serviceWorker.getRegistration('/');
  const target = registration?.active;
  if (!target || !/\/sw\.js$/.test(target.scriptURL)) return null;
  return new Promise((resolve) => {
    const channel = new MessageChannel();
    const timer = window.setTimeout(() => resolve(null), timeoutMs);
    channel.port1.onmessage = (event: MessageEvent<SwReply>) => {
      window.clearTimeout(timer);
      resolve(event.data);
    };
    target.postMessage(message, [channel.port2]);
  });
}

/** Déconnexion : le service worker vide les données personnelles enregistrées (§4.5). */
export async function clearUserDataCache(): Promise<void> {
  await messageServiceWorker({ type: SW_MESSAGES.clearUserData });
}

/** Version du service worker actif (profil et /_dev). */
export async function getServiceWorkerVersion(): Promise<string | null> {
  const replyMessage = await messageServiceWorker({ type: SW_MESSAGES.getVersion });
  return replyMessage && replyMessage.ok ? (replyMessage.version ?? null) : null;
}

/**
 * Mode mocks : désinscrit un service worker PWA resté d'une session précédente,
 * sinon il remplacerait celui de MSW (M6 §3.2).
 */
export async function unregisterPwaServiceWorkers(): Promise<number> {
  if (!hasServiceWorker()) return 0;
  const registrations = await navigator.serviceWorker.getRegistrations();
  let removed = 0;
  for (const registration of registrations) {
    const script = (registration.active ?? registration.waiting ?? registration.installing)?.scriptURL ?? '';
    if (/\/sw\.js$/.test(script)) {
      await registration.unregister();
      removed += 1;
    }
  }
  if (removed > 0) {
    console.warn(
      `[PWA] Mode mocks : ${removed} service worker d'application désinscrit pour laisser la place à MSW.`,
    );
  }
  return removed;
}
