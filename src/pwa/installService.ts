import { create } from 'zustand';
import { isIosDevice } from '@/features/payment/utils/ussd';
import { useToastStore } from '@/stores/toastStore';
import { useInstallStore, type InstallState, type InstallSurface } from './installStore';
import { track } from './track';

export type { InstallState, InstallSurface } from './installStore';

/**
 * Évènement non standard de Chrome, Edge et Samsung Internet (absent de lib.dom) :
 * il annonce que l'application peut être installée et garde la fenêtre native pour plus tard.
 */
interface BeforeInstallPromptEvent extends Event {
  readonly platforms?: string[];
  readonly userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform?: string }>;
  prompt(): Promise<void>;
}

/** Safari iOS : vrai quand la page tourne depuis l'icône de l'écran d'accueil (absent de lib.dom). */
type NavigatorWithStandalone = Navigator & { standalone?: boolean };

export type InstallOutcome = 'accepted' | 'dismissed' | 'unavailable';
export type LaunchSource = 'pwa' | 'pwa-shortcut';

// « DR Choco est installé sur votre écran d'accueil » (§5.1) en titre + sous-titre : le Toaster tronque
// chaque ligne, la phrase entière serait coupée sur un téléphone de 360 px.
export const INSTALLED_TOAST_MESSAGE = 'DR Choco est installé';
export const INSTALLED_TOAST_SUBTITLE = 'sur votre écran d’accueil';

const STANDALONE_QUERY = '(display-mode: standalone)';

let deferredPrompt: BeforeInstallPromptEvent | null = null;
/** appinstalled reçu pendant cette session. */
let installedThisSession = false;
/** Installation acceptée dans la fenêtre du navigateur, appinstalled pas encore reçu. */
let installPending = false;
let launchTracked = false;
let cleanup: (() => void) | null = null;

// ---------------------------------------------------------------------------
// Détection
// ---------------------------------------------------------------------------

/** L'application tourne en mode installé (icône de l'écran d'accueil ou fenêtre d'application). */
export function isStandaloneDisplay(): boolean {
  if (typeof window === 'undefined') return false;
  if ((navigator as NavigatorWithStandalone).standalone === true) return true;
  return typeof window.matchMedia === 'function' && window.matchMedia(STANDALONE_QUERY).matches;
}

/** Calcule l'état d'installation à partir du navigateur et de ce qui est connu sur l'appareil. */
export function computeInstallState(): InstallState {
  if (typeof window === 'undefined') return 'unsupported';
  if (installedThisSession || installPending || isStandaloneDisplay()) return 'installed';
  if (deferredPrompt) return 'available';
  // HYPOTHÈSE: appinstalled déjà reçu sur cet appareil et aucune nouvelle proposition du navigateur
  // (Chrome ne la refait que si l'application a été désinstallée) : l'application est toujours installée.
  if (useInstallStore.getState().installedAt !== null) return 'installed';
  // Safari, Chrome iOS (CriOS) et les autres navigateurs iOS : ajout manuel par le menu Partager
  if (isIosDevice()) return 'ios';
  return 'unsupported';
}

export interface IosInstallContext {
  device: 'iphone' | 'ipad';
  browser: 'safari' | 'chrome' | 'other';
  /** Position du bouton Partager : barre du bas (Safari sur iPhone) ou du haut (iPad, Chrome iOS). */
  shareLocation: 'bottom' | 'top';
  /** iOS 16.4 ou plus : notifications possibles une fois l'application installée. */
  supportsPush: boolean;
}

/** Version d'iOS lue dans le user agent (« iPhone OS 16_4 », ou « Version/17.2 » en mode ordinateur de l'iPad). */
export function parseIosVersion(userAgent: string): { major: number; minor: number } | null {
  const match = /OS (\d+)[_.](\d+)/.exec(userAgent) ?? /Version\/(\d+)\.(\d+)/.exec(userAgent);
  if (!match) return null;
  return { major: Number(match[1]), minor: Number(match[2]) };
}

export function getIosInstallContext(
  userAgent: string = typeof navigator !== 'undefined' ? navigator.userAgent : '',
  platform: string = typeof navigator !== 'undefined' ? navigator.platform : '',
  maxTouchPoints: number = typeof navigator !== 'undefined' ? (navigator.maxTouchPoints ?? 0) : 0,
): IosInstallContext {
  const isIpad = /iPad/i.test(userAgent) || (platform === 'MacIntel' && maxTouchPoints > 1);
  const browser = /CriOS/i.test(userAgent)
    ? 'chrome'
    : /FxiOS|EdgiOS|OPiOS|GSA\/|FBAN|FBAV|Instagram|Line\//i.test(userAgent)
      ? 'other'
      : 'safari';
  const version = parseIosVersion(userAgent);
  return {
    device: isIpad ? 'ipad' : 'iphone',
    browser,
    // HYPOTHÈSE: Chrome iOS place Partager dans la barre d'adresse en haut ; Safari sur iPad aussi.
    shareLocation: browser === 'chrome' || isIpad ? 'top' : 'bottom',
    // HYPOTHÈSE: version illisible = mention des notifications masquée (on ne promet rien d'incertain)
    supportsPush: version !== null && (version.major > 16 || (version.major === 16 && version.minor >= 4)),
  };
}

/** Navigateur intégré à une application (Facebook, Instagram, WebView Android) : installation impossible. */
export function isInAppBrowser(
  userAgent: string = typeof navigator !== 'undefined' ? navigator.userAgent : '',
): boolean {
  return /FBAN|FBAV|FB_IAB|Instagram|Line\/|; wv\)/i.test(userAgent);
}

// ---------------------------------------------------------------------------
// État réactif
// ---------------------------------------------------------------------------

interface InstallStatus {
  state: InstallState;
}

const useInstallStatusStore = create<InstallStatus>()(() => ({ state: computeInstallState() }));

function refreshInstallState(): void {
  const state = computeInstallState();
  if (useInstallStatusStore.getState().state !== state) useInstallStatusStore.setState({ state });
}

/** État d'installation, mis à jour en direct (évènement du navigateur, installation, mode d'affichage). */
export function useInstallState(): InstallState {
  return useInstallStatusStore((s) => s.state);
}

export function getInstallState(): InstallState {
  return useInstallStatusStore.getState().state;
}

// ---------------------------------------------------------------------------
// Ouverture depuis l'écran d'accueil (§5.5)
// ---------------------------------------------------------------------------

/** Lit ?source=pwa ou ?source=pwa-shortcut et renvoie l'adresse sans ce paramètre. */
export function parseLaunchSource(href: string): { source: LaunchSource | null; cleanUrl: string } {
  const url = new URL(href);
  const value = url.searchParams.get('source');
  if (value !== 'pwa' && value !== 'pwa-shortcut') {
    return { source: null, cleanUrl: `${url.pathname}${url.search}${url.hash}` };
  }
  url.searchParams.delete('source');
  return { source: value, cleanUrl: `${url.pathname}${url.search}${url.hash}` };
}

/** Retire le paramètre de lancement de l'adresse, sans recharger ni ajouter d'entrée d'historique. */
export function takeLaunchSource(): LaunchSource | null {
  if (typeof window === 'undefined') return null;
  try {
    const { source, cleanUrl } = parseLaunchSource(window.location.href);
    if (source) window.history.replaceState(window.history.state, '', cleanUrl);
    return source;
  } catch {
    return null;
  }
}

// Lu dès le chargement de ce module : main.tsx l'importe AVANT App, donc avant la création du routeur,
// qui ne voit jamais le paramètre (sinon il resterait dans les filtres et onglets recopiés de l'adresse).
let pendingLaunchSource: LaunchSource | null = takeLaunchSource();

// ---------------------------------------------------------------------------
// Cycle de vie
// ---------------------------------------------------------------------------

/** Demande au navigateur de ne pas effacer les données de l'application (panier, favoris, pages enregistrées). */
export async function requestPersistentStorage(): Promise<boolean> {
  try {
    if (typeof navigator === 'undefined' || !('storage' in navigator)) return false;
    const storage = navigator.storage;
    if (!storage || typeof storage.persist !== 'function') return false;
    if (typeof storage.persisted === 'function' && (await storage.persisted())) return true;
    return await storage.persist();
  } catch {
    return false;
  }
}

function handleBeforeInstallPrompt(event: Event): void {
  // Pas de mini-barre automatique du navigateur : l'application propose l'installation au bon moment
  event.preventDefault();
  deferredPrompt = event as BeforeInstallPromptEvent;
  installPending = false;
  // Le navigateur propose de nouveau l'installation : l'application a été désinstallée depuis
  if (useInstallStore.getState().installedAt !== null) useInstallStore.getState().clearInstalled();
  refreshInstallState();
}

function handleAppInstalled(): void {
  deferredPrompt = null;
  if (installedThisSession) return;
  installedThisSession = true;
  installPending = false;
  useInstallStore.getState().markInstalled();
  refreshInstallState();
  track('app_installed');
  useToastStore.getState().show({ message: INSTALLED_TOAST_MESSAGE, subtitle: INSTALLED_TOAST_SUBTITLE });
  void requestPersistentStorage();
}

/**
 * Initialisation, appelée par main.tsx AVANT le rendu : beforeinstallprompt part tôt et les pages sont
 * chargées à la demande, un écouteur posé plus tard le manquerait. Compte aussi la visite.
 */
export function initInstallService(): void {
  if (cleanup || typeof window === 'undefined') return;

  const media = typeof window.matchMedia === 'function' ? window.matchMedia(STANDALONE_QUERY) : null;
  window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
  window.addEventListener('appinstalled', handleAppInstalled);
  media?.addEventListener?.('change', refreshInstallState);
  cleanup = () => {
    window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    window.removeEventListener('appinstalled', handleAppInstalled);
    media?.removeEventListener?.('change', refreshInstallState);
  };

  useInstallStore.getState().recordVisit();

  const source = pendingLaunchSource ?? takeLaunchSource();
  pendingLaunchSource = null;
  if (source && !launchTracked) {
    launchTracked = true;
    track('app_opened_from_home_screen', { source, standalone: isStandaloneDisplay() });
  }

  refreshInstallState();
}

/** Retire les écouteurs et oublie l'évènement gardé (tests, ou arrêt de l'application). */
export function disposeInstallService(): void {
  cleanup?.();
  cleanup = null;
  deferredPrompt = null;
  installedThisSession = false;
  installPending = false;
  launchTracked = false;
  pendingLaunchSource = null;
  refreshInstallState();
}

/**
 * Ouvre la fenêtre d'installation du navigateur (une seule fois par évènement reçu) et renvoie le choix.
 * Un refus compte comme « Plus tard » : plus d'invitation automatique pendant 14 jours.
 */
export async function promptInstall(surface?: InstallSurface): Promise<InstallOutcome> {
  const event = deferredPrompt;
  if (!event) return 'unavailable';
  // L'évènement ne sert qu'une fois : le navigateur en renverra un autre s'il le juge utile
  deferredPrompt = null;

  let outcome: 'accepted' | 'dismissed';
  try {
    await event.prompt();
    const choice = await event.userChoice;
    outcome = choice.outcome === 'accepted' ? 'accepted' : 'dismissed';
  } catch {
    // Fenêtre impossible à ouvrir (déjà utilisée, geste manquant) : on garde l'état précédent
    deferredPrompt = event;
    refreshInstallState();
    return 'unavailable';
  }

  if (outcome === 'accepted') {
    // HYPOTHÈSE: installation acceptée = invitations retirées tout de suite ; le toast attend appinstalled.
    installPending = true;
    track('install_prompt_accepted', { surface, via: 'browser' });
  } else {
    useInstallStore.getState().markDismissed();
    track('install_prompt_dismissed', { surface, via: 'browser' });
  }
  refreshInstallState();
  return outcome;
}
