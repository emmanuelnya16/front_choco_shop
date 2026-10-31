import { isIosDevice } from '@/features/payment/utils/ussd';
import { api } from '@/lib/api/client';
import { endpoints } from '@/lib/api/endpoints';
import { env } from '@/lib/env';
import { safeStorage } from '@/lib/utils/storage';
import { usePushStore, type PushStatus } from '@/pwa/pushStore';
import { urlBase64ToUint8Array } from '@/pwa/vapid';

const PUSH_DISMISSED_UNTIL_KEY = 'drc_push_prompt_dismissed_until';
/** Point de terminaison envoyé au serveur avec succès : sert à détecter un abonnement changé. */
const PUSH_ENDPOINT_KEY = 'drc_push_endpoint';
/** Le client a désactivé les notifications dans son profil : plus de réabonnement automatique. */
const PUSH_OPT_OUT_KEY = 'drc_push_opt_out';
const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;
/** Attente maximale du service worker de l'app (première visite : installation en cours). */
const APP_WORKER_WAIT_MS = 10_000;
/** Délai maximal du désabonnement à la déconnexion : la déconnexion ne doit jamais traîner. */
const LOGOUT_UNSUBSCRIBE_TIMEOUT_MS = 3000;
const APP_WORKER_SCRIPT = /\/sw\.js$/;

export type PushPermissionState = NotificationPermission | 'unsupported';

/** navigator.standalone (Safari iOS, app lancée depuis l'écran d'accueil) : absent de lib.dom. */
interface IosNavigator extends Navigator {
  standalone?: boolean;
}

function readStorage(key: string): string | null {
  return safeStorage.getItem(key) as string | null;
}

function wait(ms: number): Promise<null> {
  return new Promise((resolve) => {
    setTimeout(() => resolve(null), ms);
  });
}

/**
 * Le navigateur sait recevoir des notifications push : API Notification, service worker et
 * PushManager (M6 §7.1).
 */
export function isNotificationSupported(): boolean {
  return (
    typeof window !== 'undefined' &&
    'Notification' in window &&
    'PushManager' in window &&
    typeof navigator !== 'undefined' &&
    'serviceWorker' in navigator
  );
}

/** L'app est ouverte depuis l'écran d'accueil (Android, ordinateur ou iPhone). */
export function isStandaloneDisplay(): boolean {
  if (typeof window === 'undefined') return false;
  if ((navigator as IosNavigator).standalone === true) return true;
  return Boolean(window.matchMedia?.('(display-mode: standalone)').matches);
}

/**
 * iPhone où l'app n'est pas installée sur l'écran d'accueil : Safari n'y expose les notifications
 * qu'une fois l'app installée (iOS 16.4 ou plus).
 */
export function isIosWithoutHomeScreenInstall(): boolean {
  if (typeof window === 'undefined') return false;
  return isIosDevice() && !isStandaloneDisplay() && !('PushManager' in window);
}

/**
 * Les notifications peuvent réellement arriver : navigateur compatible ET service worker de l'app
 * prévu. HYPOTHÈSE: en mode mocks du navigateur (MSW occupe la place du service worker de l'app),
 * les notifications sont « Non disponibles » plutôt que promises sans pouvoir arriver ; on les teste
 * avec `npm run mock:api` + `npm run preview:pwa` (voir /_dev).
 */
export function isPushAvailable(): boolean {
  return isNotificationSupported() && usePushStore.getState().workerEnabled;
}

/** Permission utilisable pour les notifications ('unsupported' si elles ne peuvent pas arriver). */
export function getNotificationPermission(): PushPermissionState {
  if (!isPushAvailable()) {
    return 'unsupported';
  }
  return Notification.permission;
}

/** État affichable, à partir de la permission et de l'abonnement (M6 §7.1). */
export function computePushStatus(subscribed: boolean): PushStatus {
  if (isIosWithoutHomeScreenInstall()) return 'needs-install';
  if (!isPushAvailable()) return 'unsupported';
  const permission = Notification.permission;
  if (permission === 'denied') return 'denied';
  if (permission !== 'granted') return 'default';
  return subscribed ? 'subscribed' : 'granted';
}

export function getPushStatus(): PushStatus {
  return usePushStore.getState().status;
}

/** Incrémenté à chaque publication : une lecture lente ne remplace pas un état plus récent. */
let stateVersion = 0;

function publishStatus(subscribed: boolean, endpoint: string | null = null): PushStatus {
  stateVersion += 1;
  const status = computePushStatus(subscribed);
  usePushStore.getState().setPushState(status, status === 'subscribed' ? endpoint : null);
  return status;
}

function isOptedOut(): boolean {
  return readStorage(PUSH_OPT_OUT_KEY) === '1';
}

/**
 * Indique si l'utilisateur a cliqué sur « Non merci » au cours des 7 derniers jours (§6.4).
 */
export function isPushPromptDismissed(): boolean {
  const raw = readStorage(PUSH_DISMISSED_UNTIL_KEY);
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

function isAppRegistration(
  registration: ServiceWorkerRegistration | null | undefined,
): registration is ServiceWorkerRegistration {
  const worker = registration?.active ?? registration?.waiting ?? registration?.installing;
  return Boolean(worker && APP_WORKER_SCRIPT.test(worker.scriptURL));
}

/**
 * Inscription du service worker de l'app, active (null sans elle : mode mocks, navigateur ancien,
 * enregistrement échoué). Ne renvoie jamais celle de MSW, qui partage la même portée.
 */
export async function getAppRegistration(waitMs = 0): Promise<ServiceWorkerRegistration | null> {
  if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) return null;
  if (!usePushStore.getState().workerEnabled) return null;
  try {
    const current = await navigator.serviceWorker.getRegistration('/');
    if (isAppRegistration(current) && current.active) return current;
    if (waitMs <= 0) return null;
    const ready = await Promise.race([navigator.serviceWorker.ready, wait(waitMs)]);
    return isAppRegistration(ready) ? ready : null;
  } catch {
    return null;
  }
}

async function getCurrentSubscription(
  registration: ServiceWorkerRegistration | null,
): Promise<PushSubscription | null> {
  if (!registration) return null;
  try {
    return await registration.pushManager.getSubscription();
  } catch {
    return null;
  }
}

function hasSameKey(current: ArrayBuffer | null | undefined, expected: Uint8Array): boolean {
  if (!current) return true; // Clé inconnue : on garde l'abonnement existant
  const bytes = new Uint8Array(current);
  return bytes.length === expected.length && bytes.every((value, index) => value === expected[index]);
}

// HYPOTHÈSE: valeurs attendues par le back-end pour `platform` : 'ios', 'android' ou 'web'.
export function detectPushPlatform(
  userAgent = typeof navigator !== 'undefined' ? navigator.userAgent : '',
): 'ios' | 'android' | 'web' {
  if (isIosDevice(userAgent)) return 'ios';
  if (/Android/i.test(userAgent)) return 'android';
  return 'web';
}

export type PushSubscribeResult =
  | { ok: true; endpoint: string }
  | { ok: false; reason: 'unsupported' | 'permission' | 'no-app-worker' | 'subscribe-failed' | 'server' };

async function doSubscribe(): Promise<PushSubscribeResult> {
  if (!isPushAvailable()) return { ok: false, reason: 'unsupported' };
  if (Notification.permission !== 'granted') {
    publishStatus(false);
    return { ok: false, reason: 'permission' };
  }
  const registration = await getAppRegistration(APP_WORKER_WAIT_MS);
  if (!registration) {
    publishStatus(false);
    return { ok: false, reason: 'no-app-worker' };
  }

  let subscription: PushSubscription;
  try {
    const applicationServerKey = urlBase64ToUint8Array(env.vapidPublicKey);
    let existing = await registration.pushManager.getSubscription();
    // Clé du serveur changée : l'ancien abonnement ne recevrait plus rien
    if (existing && !hasSameKey(existing.options?.applicationServerKey, applicationServerKey)) {
      await existing.unsubscribe().catch(() => false);
      existing = null;
    }
    subscription =
      existing ?? (await registration.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey }));
  } catch (error) {
    console.warn('[Notifications] Abonnement impossible :', error);
    publishStatus(false);
    return { ok: false, reason: 'subscribe-failed' };
  }

  // Abonnement remplacé (clé changée, abonnement perdu par le navigateur) : le serveur oublie l'ancien,
  // comme pour pushsubscriptionchange dans le service worker
  const previousEndpoint = readStorage(PUSH_ENDPOINT_KEY);
  try {
    await api.post(endpoints.push.subscribe, {
      subscription: subscription.toJSON(),
      platform: detectPushPlatform(),
      userAgent: navigator.userAgent,
      ...(previousEndpoint && previousEndpoint !== subscription.endpoint ? { oldEndpoint: previousEndpoint } : {}),
    });
  } catch (error) {
    // Le serveur ne connaît pas cet abonnement : rien n'arriverait, on ne l'affiche donc pas comme actif.
    // L'abonnement du navigateur est gardé : il sera renvoyé au prochain démarrage.
    console.warn("[Notifications] Le serveur n'a pas enregistré l'abonnement :", error);
    publishStatus(false);
    return { ok: false, reason: 'server' };
  }

  safeStorage.setItem(PUSH_ENDPOINT_KEY, subscription.endpoint);
  publishStatus(true, subscription.endpoint);
  return { ok: true, endpoint: subscription.endpoint };
}

let subscribeInFlight: Promise<PushSubscribeResult> | null = null;

/**
 * Abonne ce téléphone aux notifications (M6 §7.1) : attend le service worker de l'app, réutilise
 * l'abonnement existant ou en crée un, puis l'envoie au serveur (POST /push/subscribe).
 * Un seul abonnement à la fois : deux appels simultanés partagent le même résultat. Ne lève jamais.
 */
export function subscribe(): Promise<PushSubscribeResult> {
  subscribeInFlight ??= doSubscribe().finally(() => {
    subscribeInFlight = null;
  });
  return subscribeInFlight;
}

/**
 * Désabonne ce téléphone (M6 §7.1) : POST /push/unsubscribe { endpoint }, puis
 * subscription.unsubscribe(). Au mieux : hors connexion, l'abonnement local est quand même retiré.
 * Ne lève jamais.
 */
export async function unsubscribe(): Promise<void> {
  try {
    const subscription = await getCurrentSubscription(await getAppRegistration(0));
    const endpoint = subscription?.endpoint ?? readStorage(PUSH_ENDPOINT_KEY);
    if (endpoint) {
      try {
        await api.post(endpoints.push.unsubscribe, { endpoint });
      } catch {
        // Au mieux : le serveur oubliera ce point de terminaison au premier envoi refusé
      }
    }
    if (subscription) await subscription.unsubscribe().catch(() => false);
  } catch {
    // Jamais bloquant
  } finally {
    safeStorage.removeItem(PUSH_ENDPOINT_KEY);
    publishStatus(false);
  }
}

/** Déconnexion : désabonnement au mieux, sans jamais retarder la déconnexion plus de 3 s. */
export async function unsubscribeOnLogout(timeoutMs = LOGOUT_UNSUBSCRIBE_TIMEOUT_MS): Promise<void> {
  await Promise.race([unsubscribe(), wait(timeoutMs)]);
}

/**
 * Demande la permission (appui explicite sur « Activer »), sans s'abonner : l'abonnement est fait par
 * enableNotifications(), une seule fois.
 */
export async function requestPermission(): Promise<PushPermissionState> {
  if (!isPushAvailable()) {
    return 'unsupported';
  }
  let permission: NotificationPermission;
  try {
    permission =
      Notification.permission === 'default' ? await Notification.requestPermission() : Notification.permission;
  } catch {
    permission = Notification.permission;
  }
  const { status, endpoint } = usePushStore.getState();
  publishStatus(status === 'subscribed' && permission === 'granted', endpoint);
  return permission;
}

export type EnableNotificationsResult = 'subscribed' | 'denied' | 'dismissed' | 'unsupported' | 'failed';

/**
 * « Activer » (carte Merci M4, feuille Notifications M5) : permission puis abonnement.
 * 'failed' : permission accordée mais abonnement impossible (jamais affiché comme « Activées »).
 */
export async function enableNotifications(): Promise<EnableNotificationsResult> {
  if (!isPushAvailable()) return 'unsupported';
  const permission = await requestPermission();
  if (permission === 'denied') return 'denied';
  if (permission !== 'granted') return 'dismissed';
  safeStorage.removeItem(PUSH_OPT_OUT_KEY);
  const result = await subscribe();
  return result.ok ? 'subscribed' : 'failed';
}

/** « Désactiver » dans le profil : désabonnement, et plus de réabonnement automatique. */
export async function disableNotifications(): Promise<void> {
  safeStorage.setItem(PUSH_OPT_OUT_KEY, '1');
  await unsubscribe();
}

/** Relit la permission et l'abonnement réels (retour sur l'app, permission changée). */
export async function refreshPushStatus(): Promise<PushStatus> {
  if (!isPushAvailable() || Notification.permission !== 'granted') {
    return publishStatus(false);
  }
  if (subscribeInFlight) await subscribeInFlight;
  const startVersion = stateVersion;
  const subscription = await getCurrentSubscription(await getAppRegistration(APP_WORKER_WAIT_MS));
  // Abonnement ou désabonnement terminé entre-temps : son résultat fait foi
  if (stateVersion !== startVersion) return getPushStatus();
  const stored = readStorage(PUSH_ENDPOINT_KEY);
  // Actif seulement si le serveur a reçu CE point de terminaison
  const active = Boolean(subscription && subscription.endpoint === stored);
  return publishStatus(active, active ? subscription!.endpoint : null);
}

/**
 * Abonnement automatique (M6 §7.1), si la permission est déjà accordée et que le client n'a pas
 * désactivé les notifications :
 * - 'login' (connexion) : abonnement renvoyé au serveur, qui l'associe au compte ;
 * - 'startup' (démarrage, session restaurée) : renvoyé seulement s'il a changé
 *   (point de terminaison mémorisé différent de l'actuel) ou s'il a disparu.
 */
export async function syncPushSubscription(trigger: 'login' | 'startup'): Promise<void> {
  if (!isPushAvailable() || Notification.permission !== 'granted' || isOptedOut()) {
    await refreshPushStatus();
    return;
  }
  const registration = await getAppRegistration(APP_WORKER_WAIT_MS);
  if (!registration) {
    publishStatus(false);
    return;
  }
  const current = await getCurrentSubscription(registration);
  const stored = readStorage(PUSH_ENDPOINT_KEY);
  // HYPOTHÈSE: permission accordée sans abonnement (accordée avant M6, ou abonnement perdu) et sans
  // désactivation explicite : on (ré)abonne, le client attend ses notifications.
  if (trigger === 'login' || !current || current.endpoint !== stored) {
    await subscribe();
    return;
  }
  publishStatus(true, current.endpoint);
}

/** Abonnement actuel au format JSON (outil « Copier l'abonnement JSON » de /_dev). */
export async function getSubscriptionJson(): Promise<PushSubscriptionJSON | null> {
  const subscription = await getCurrentSubscription(await getAppRegistration(0));
  return subscription ? subscription.toJSON() : null;
}

// État initial, lu de façon synchrone : un abonnement mémorisé est considéré actif jusqu'à la
// vérification du démarrage (pas d'interrogation rapide inutile pendant ce temps).
if (typeof window !== 'undefined') {
  const stored = readStorage(PUSH_ENDPOINT_KEY);
  publishStatus(Boolean(stored) && !isOptedOut(), stored);
}

export const pushService = {
  isNotificationSupported,
  isPushAvailable,
  isIosWithoutHomeScreenInstall,
  getNotificationPermission,
  getPushStatus,
  isPushPromptDismissed,
  dismissPushPromptFor7Days,
  requestPermission,
  enableNotifications,
  disableNotifications,
  subscribe,
  unsubscribe,
  unsubscribeOnLogout,
  refreshPushStatus,
  syncPushSubscription,
};
