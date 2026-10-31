/**
 * Capture précoce de l'installation (M6 §5.1, §5.5), sans aucune dépendance : importée par main.tsx
 * AVANT App, elle s'exécute au chargement du module.
 * - Retire ?source=pwa / ?source=pwa-shortcut de l'adresse avant la création du routeur (sinon le
 *   paramètre resterait dans les filtres et onglets recopiés de l'adresse).
 * - Garde beforeinstallprompt et appinstalled, qui peuvent arriver avant le premier rendu.
 * Le service complet (src/pwa/installService.ts) est chargé après le premier affichage et reprend
 * ces informations : il ne pèse pas sur le JavaScript de démarrage.
 */

export type LaunchSource = 'pwa' | 'pwa-shortcut';

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

export interface EarlyInstallCapture {
  /** beforeinstallprompt reçu avant le chargement du service (fenêtre native déjà retenue). */
  deferredPrompt: Event | null;
  /** appinstalled reçu avant le chargement du service. */
  installed: boolean;
  /** Ouverture depuis l'écran d'accueil ou un raccourci. */
  launchSource: LaunchSource | null;
}

const capture: EarlyInstallCapture = { deferredPrompt: null, installed: false, launchSource: null };
let listening = false;

function onBeforeInstallPrompt(event: Event): void {
  // Pas de mini-barre automatique du navigateur : l'application propose l'installation au bon moment
  event.preventDefault();
  capture.deferredPrompt = event;
}

function onAppInstalled(): void {
  capture.installed = true;
}

function startEarlyCapture(): void {
  if (listening || typeof window === 'undefined') return;
  listening = true;
  capture.launchSource = takeLaunchSource();
  window.addEventListener('beforeinstallprompt', onBeforeInstallPrompt);
  window.addEventListener('appinstalled', onAppInstalled);
}

/** Remet au service ce qui a été capté et arrête la capture précoce (le service prend le relais). */
export function takeEarlyInstallCapture(): EarlyInstallCapture {
  if (typeof window !== 'undefined' && listening) {
    window.removeEventListener('beforeinstallprompt', onBeforeInstallPrompt);
    window.removeEventListener('appinstalled', onAppInstalled);
  }
  listening = false;
  const taken = { ...capture };
  capture.deferredPrompt = null;
  capture.installed = false;
  capture.launchSource = null;
  return taken;
}

startEarlyCapture();
