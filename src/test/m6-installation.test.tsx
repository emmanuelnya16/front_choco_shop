import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import type { SetupServer } from 'msw/node';
import type { ReactElement } from 'react';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { AppProviders } from '@/app/providers';
import { InstallAutoPrompt } from '@/features/install/InstallAutoPrompt';
import { InstallSheets } from '@/features/install/InstallSheets';
import { SuccessInstallCard } from '@/features/install/SuccessInstallCard';
import { sheetKindFor, useInstallController } from '@/features/install/useInstallController';
import { useSuccessInstallOffer } from '@/features/install/useSuccessInstallOffer';
import { createAppQueryClient } from '@/lib/api/queryClient';
import {
  disposeInstallService,
  getInstallState,
  getIosInstallContext,
  initInstallService,
  INSTALLED_TOAST_MESSAGE,
  INSTALLED_TOAST_SUBTITLE,
  isInAppBrowser,
  parseIosVersion,
  parseLaunchSource,
  promptInstall,
} from '@/pwa/installService';
import {
  AUTO_SHEET_DELAY_MS,
  DISMISS_SNOOZE_MS,
  INITIAL_INSTALL_DATA,
  isInstallSnoozed,
  nextVisitData,
  shouldAutoOpenInstallSheet,
  shouldShowSuccessInstallCard,
  useInstallStore,
  VISIT_GAP_MS,
  type InstallSurface,
  type InstallVisitData,
} from '@/pwa/installStore';
import { setTrackSink, type TrackEvent, type TrackProps } from '@/pwa/track';
import { useAuthStore } from '@/stores/authStore';
import { useToastStore } from '@/stores/toastStore';

// ---------------------------------------------------------------------------
// Simulations locales des API du navigateur (jsdom n'a ni beforeinstallprompt, ni standalone, ni storage)
// ---------------------------------------------------------------------------

const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;
const NOW = Date.UTC(2026, 9, 30, 10, 0, 0);

const UA = {
  iphone17:
    'Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Mobile/15E148 Safari/604.1',
  iphone15:
    'Mozilla/5.0 (iPhone; CPU iPhone OS 15_7 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/15.6 Mobile/15E148 Safari/604.1',
  chromeIos:
    'Mozilla/5.0 (iPhone; CPU iPhone OS 18_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/131.0.6778.73 Mobile/15E148 Safari/604.1',
  ipadDesktop:
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.2 Safari/605.1.15',
  androidChrome:
    'Mozilla/5.0 (Linux; Android 14; SM-A155F) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Mobile Safari/537.36',
  facebookAndroid:
    'Mozilla/5.0 (Linux; Android 14; SM-A155F; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/131.0.0.0 Mobile Safari/537.36 [FB_IAB/FB4A;FBAV/489.0.0.0;]',
};

const restorers: Array<() => void> = [];

/** Remplace une propriété de navigator (getter du prototype) le temps d'un test. */
function stubNavigator(key: 'userAgent' | 'standalone' | 'storage' | 'platform' | 'maxTouchPoints', value: unknown) {
  Object.defineProperty(window.navigator, key, { configurable: true, get: () => value });
  restorers.push(() => {
    Reflect.deleteProperty(window.navigator, key);
  });
}

/** matchMedia qui répond « vrai » pour le mode installé (setup.ts répond toujours « faux »). */
function stubStandaloneDisplay() {
  const original = window.matchMedia;
  window.matchMedia = vi.fn().mockImplementation((query: string) => ({
    matches: query === '(display-mode: standalone)',
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })) as unknown as typeof window.matchMedia;
  restorers.push(() => {
    window.matchMedia = original;
  });
}

function stubPersistentStorage() {
  const storage = {
    persist: vi.fn().mockResolvedValue(true),
    persisted: vi.fn().mockResolvedValue(false),
  };
  stubNavigator('storage', storage);
  return storage;
}

/** Évènement beforeinstallprompt de Chrome, avec prompt() et userChoice. */
function fireBeforeInstallPrompt(outcome: 'accepted' | 'dismissed' = 'accepted') {
  const event = new Event('beforeinstallprompt', { cancelable: true });
  const prompt = vi.fn().mockResolvedValue(undefined);
  Object.assign(event, { prompt, userChoice: Promise.resolve({ outcome, platform: 'web' }), platforms: ['web'] });
  act(() => {
    window.dispatchEvent(event);
  });
  return { event, prompt };
}

let tracked: Array<{ event: TrackEvent; props?: TrackProps }> = [];

function visit(overrides: Partial<InstallVisitData>): InstallVisitData {
  return { ...INITIAL_INSTALL_DATA, ...overrides };
}

beforeEach(() => {
  disposeInstallService();
  useInstallStore.getState().reset();
  useToastStore.getState().clear();
  tracked = [];
  setTrackSink((event, props) => tracked.push({ event, props }));
});

afterEach(() => {
  // Démonter avant de réinitialiser le service : aucune mise à jour d'un composant hors act()
  cleanup();
  while (restorers.length > 0) restorers.pop()?.();
  vi.useRealTimers();
  disposeInstallService();
  useInstallStore.getState().reset();
  setTrackSink(null);
  window.history.replaceState(null, '', '/');
});

// ---------------------------------------------------------------------------
// 1. Règles (§5.2)
// ---------------------------------------------------------------------------
describe('M6 · Installation · 1. Règles', () => {
  it('compte une visite par chargement espacé d’au moins 30 minutes', () => {
    const first = nextVisitData(INITIAL_INSTALL_DATA, NOW);
    expect(first).toMatchObject({ visitCount: 1, firstVisitAt: NOW, lastVisitAt: NOW });

    // Rechargement 10 minutes plus tard : même visite (objet inchangé)
    expect(nextVisitData(first, NOW + 10 * 60 * 1000)).toBe(first);

    const second = nextVisitData(first, NOW + VISIT_GAP_MS);
    expect(second).toMatchObject({ visitCount: 2, firstVisitAt: NOW, lastVisitAt: NOW + VISIT_GAP_MS });
  });

  it('jamais au premier chargement, même plusieurs jours après', () => {
    const firstVisit = visit({ visitCount: 1, firstVisitAt: NOW - 5 * DAY, lastVisitAt: NOW - 5 * DAY });
    expect(shouldAutoOpenInstallSheet('available', firstVisit, NOW)).toBe(false);
    expect(shouldAutoOpenInstallSheet('available', INITIAL_INSTALL_DATA, NOW)).toBe(false);
  });

  it('feuille automatique à la deuxième visite, au moins un jour après la première, une seule fois', () => {
    const sameDay = visit({ visitCount: 2, firstVisitAt: NOW - 3 * HOUR, lastVisitAt: NOW });
    expect(shouldAutoOpenInstallSheet('available', sameDay, NOW)).toBe(false);

    const nextDay = visit({ visitCount: 2, firstVisitAt: NOW - DAY, lastVisitAt: NOW });
    expect(shouldAutoOpenInstallSheet('available', nextDay, NOW)).toBe(true);
    expect(shouldAutoOpenInstallSheet('ios', nextDay, NOW)).toBe(true);
    // Installation impossible ou déjà faite : rien d'automatique
    expect(shouldAutoOpenInstallSheet('unsupported', nextDay, NOW)).toBe(false);
    expect(shouldAutoOpenInstallSheet('installed', nextDay, NOW)).toBe(false);

    // Retour d'abord le jour même, puis le lendemain : la feuille vient au lendemain
    const thirdVisit = visit({ visitCount: 3, firstVisitAt: NOW - 2 * DAY, lastVisitAt: NOW });
    expect(shouldAutoOpenInstallSheet('available', thirdVisit, NOW)).toBe(true);

    const alreadyShown = { ...nextDay, autoSheetShownAt: NOW - HOUR };
    expect(shouldAutoOpenInstallSheet('available', alreadyShown, NOW)).toBe(false);
  });

  it('après « Plus tard », aucune invitation automatique pendant 14 jours', () => {
    const base = visit({ visitCount: 4, firstVisitAt: NOW - 30 * DAY, lastVisitAt: NOW });
    const refusedRecently = { ...base, lastDismissedAt: NOW - 13 * DAY };
    expect(isInstallSnoozed(refusedRecently, NOW)).toBe(true);
    expect(shouldAutoOpenInstallSheet('available', refusedRecently, NOW)).toBe(false);
    expect(shouldShowSuccessInstallCard('available', refusedRecently, 'RES-1', NOW)).toBe(false);

    const refusedLongAgo = { ...base, lastDismissedAt: NOW - DISMISS_SNOOZE_MS };
    expect(isInstallSnoozed(refusedLongAgo, NOW)).toBe(false);
    expect(shouldAutoOpenInstallSheet('available', refusedLongAgo, NOW)).toBe(true);
    expect(shouldShowSuccessInstallCard('available', refusedLongAgo, 'RES-1', NOW)).toBe(true);
  });

  it('carte Merci : première preuve seulement, si l’installation est possible', () => {
    expect(shouldShowSuccessInstallCard('available', INITIAL_INSTALL_DATA, 'RES-1', NOW)).toBe(true);
    const remembered = visit({ firstProofRef: 'RES-1' });
    expect(shouldShowSuccessInstallCard('available', remembered, 'RES-1', NOW)).toBe(true);
    expect(shouldShowSuccessInstallCard('available', remembered, 'RES-2', NOW)).toBe(false);
    // iPhone sans l'application : la carte remplace celle des notifications ; installée : tout est masqué
    expect(shouldShowSuccessInstallCard('ios', INITIAL_INSTALL_DATA, 'RES-1', NOW)).toBe(true);
    expect(shouldShowSuccessInstallCard('ios', remembered, 'RES-2', NOW)).toBe(false);
    expect(shouldShowSuccessInstallCard('installed', INITIAL_INSTALL_DATA, 'RES-1', NOW)).toBe(false);
    expect(shouldShowSuccessInstallCard('unsupported', INITIAL_INSTALL_DATA, 'RES-1', NOW)).toBe(false);
  });

  it('store : visites, invitations montrées, refus et première preuve', () => {
    const store = useInstallStore.getState();
    expect(store.recordVisit(NOW)).toBe(true);
    expect(useInstallStore.getState().recordVisit(NOW + 5 * 60 * 1000)).toBe(false);
    expect(useInstallStore.getState().recordVisit(NOW + DAY)).toBe(true);
    expect(useInstallStore.getState()).toMatchObject({ visitCount: 2, firstVisitAt: NOW, lastVisitAt: NOW + DAY });

    useInstallStore.getState().markShown('home', NOW);
    useInstallStore.getState().markShown('auto-sheet', NOW + 1);
    useInstallStore.getState().markShown('home', NOW + 2);
    expect(useInstallStore.getState().shownCount).toEqual({ home: 2, 'auto-sheet': 1 });
    expect(useInstallStore.getState().autoSheetShownAt).toBe(NOW + 1);

    useInstallStore.getState().markDismissed(NOW + 3);
    expect(useInstallStore.getState().lastDismissedAt).toBe(NOW + 3);

    useInstallStore.getState().rememberFirstProof('RES-000201');
    useInstallStore.getState().rememberFirstProof('RES-000202');
    expect(useInstallStore.getState().firstProofRef).toBe('RES-000201');

    // Conservé sur le téléphone
    const saved = JSON.parse(window.localStorage.getItem('drchoco-install') ?? '{}') as { state: InstallVisitData };
    expect(saved.state).toMatchObject({ visitCount: 2, firstProofRef: 'RES-000201', lastDismissedAt: NOW + 3 });
  });

  it('feuille selon l’état : installation directe, iPhone, explication', () => {
    expect(sheetKindFor('available')).toBe('install');
    expect(sheetKindFor('ios')).toBe('ios');
    expect(sheetKindFor('unsupported')).toBe('help');
    expect(sheetKindFor('installed')).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// 2. Service d'installation : transitions d'état (§5.1)
// ---------------------------------------------------------------------------
describe('M6 · Installation · 2. Service', () => {
  it('sans évènement du navigateur (jsdom) : « unsupported », et la visite est comptée au démarrage', () => {
    initInstallService();
    initInstallService();
    expect(getInstallState()).toBe('unsupported');
    expect(useInstallStore.getState().visitCount).toBe(1);
  });

  it('beforeinstallprompt : fenêtre automatique empêchée, état « available », puis fenêtre native acceptée', async () => {
    initInstallService();
    const { event, prompt } = fireBeforeInstallPrompt('accepted');
    expect(event.defaultPrevented).toBe(true);
    expect(getInstallState()).toBe('available');

    await expect(promptInstall('profile')).resolves.toBe('accepted');
    expect(prompt).toHaveBeenCalledTimes(1);
    // Invitations retirées tout de suite ; l'évènement ne sert qu'une fois
    expect(getInstallState()).toBe('installed');
    await expect(promptInstall('profile')).resolves.toBe('unavailable');
    expect(tracked).toContainEqual({ event: 'install_prompt_accepted', props: { surface: 'profile', via: 'browser' } });
  });

  it('refus dans la fenêtre native : compte comme « Plus tard » (14 jours)', async () => {
    initInstallService();
    fireBeforeInstallPrompt('dismissed');
    await expect(promptInstall('home')).resolves.toBe('dismissed');
    expect(useInstallStore.getState().lastDismissedAt).not.toBeNull();
    expect(getInstallState()).toBe('unsupported');
    expect(tracked.map((t) => t.event)).toContain('install_prompt_dismissed');
  });

  it('appinstalled : état « installed », toast, stockage persistant demandé, mémorisé sur l’appareil', async () => {
    const storage = stubPersistentStorage();
    initInstallService();
    fireBeforeInstallPrompt();
    act(() => {
      window.dispatchEvent(new Event('appinstalled'));
    });

    expect(getInstallState()).toBe('installed');
    expect(useInstallStore.getState().installedAt).not.toBeNull();
    const toasts = useToastStore.getState().toasts;
    expect(toasts).toHaveLength(1);
    expect(`${toasts[0].message} ${toasts[0].subtitle}`).toBe('DR Choco est installé sur votre écran d’accueil');
    expect(toasts[0]).toMatchObject({ message: INSTALLED_TOAST_MESSAGE, subtitle: INSTALLED_TOAST_SUBTITLE });
    await waitFor(() => expect(storage.persist).toHaveBeenCalledTimes(1));
    expect(tracked.map((t) => t.event)).toContain('app_installed');

    // Un second évènement ne répète pas le toast
    act(() => {
      window.dispatchEvent(new Event('appinstalled'));
    });
    expect(useToastStore.getState().toasts).toHaveLength(1);
  });

  it('application déjà installée sur l’appareil : masquée jusqu’à ce que le navigateur la repropose', () => {
    useInstallStore.getState().markInstalled(NOW);
    initInstallService();
    expect(getInstallState()).toBe('installed');

    // Chrome ne repropose l'installation que si l'application a été désinstallée
    fireBeforeInstallPrompt();
    expect(getInstallState()).toBe('available');
    expect(useInstallStore.getState().installedAt).toBeNull();
  });

  it('mode installé : matchMedia(display-mode: standalone) ou navigator.standalone (iOS)', () => {
    stubStandaloneDisplay();
    initInstallService();
    expect(getInstallState()).toBe('installed');
    while (restorers.length > 0) restorers.pop()?.();
    disposeInstallService();
    expect(getInstallState()).toBe('unsupported');

    stubNavigator('userAgent', UA.iphone17);
    stubNavigator('standalone', true);
    initInstallService();
    expect(getInstallState()).toBe('installed');
  });

  it('iPhone, iPad et Chrome iOS : installation manuelle « ios »', () => {
    stubNavigator('userAgent', UA.iphone17);
    initInstallService();
    expect(getInstallState()).toBe('ios');

    expect(getIosInstallContext(UA.iphone17, 'iPhone', 5)).toEqual({
      device: 'iphone',
      browser: 'safari',
      shareLocation: 'bottom',
      supportsPush: true,
    });
    expect(getIosInstallContext(UA.chromeIos, 'iPhone', 5)).toMatchObject({ browser: 'chrome', shareLocation: 'top' });
    expect(getIosInstallContext(UA.ipadDesktop, 'MacIntel', 5)).toMatchObject({ device: 'ipad', shareLocation: 'top' });
    expect(getIosInstallContext(UA.iphone15, 'iPhone', 5).supportsPush).toBe(false);
  });

  it('Chrome iOS (CriOS) est aussi une installation manuelle', () => {
    stubNavigator('userAgent', UA.chromeIos);
    initInstallService();
    expect(getInstallState()).toBe('ios');
  });

  it('version d’iOS et navigateurs intégrés', () => {
    expect(parseIosVersion(UA.iphone17)).toEqual({ major: 17, minor: 4 });
    expect(parseIosVersion('Mozilla/5.0 (iPhone; CPU iPhone OS 16_3 like Mac OS X)')).toEqual({ major: 16, minor: 3 });
    expect(getIosInstallContext('Mozilla/5.0 (iPhone; CPU iPhone OS 16_3 like Mac OS X)', 'iPhone', 5).supportsPush).toBe(false);
    expect(getIosInstallContext('Mozilla/5.0 (iPhone; CPU iPhone OS 16_4 like Mac OS X)', 'iPhone', 5).supportsPush).toBe(true);
    expect(isInAppBrowser(UA.facebookAndroid)).toBe(true);
    expect(isInAppBrowser(UA.androidChrome)).toBe(false);
  });

  it('ouverture depuis l’écran d’accueil : mesurée puis retirée de l’adresse, sans recharger', () => {
    expect(parseLaunchSource('https://drchoco.cm/?source=pwa')).toEqual({ source: 'pwa', cleanUrl: '/' });
    expect(parseLaunchSource('https://drchoco.cm/panier?source=pwa-shortcut')).toEqual({
      source: 'pwa-shortcut',
      cleanUrl: '/panier',
    });
    expect(parseLaunchSource('https://drchoco.cm/explorer?source=instagram').source).toBeNull();

    window.history.replaceState({ idx: 0 }, '', '/explorer?source=pwa-shortcut&categorie=babouches#haut');
    initInstallService();
    expect(`${window.location.pathname}${window.location.search}${window.location.hash}`).toBe(
      '/explorer?categorie=babouches#haut',
    );
    // L'état d'historique du routeur est conservé
    expect(window.history.state).toEqual({ idx: 0 });
    expect(tracked).toContainEqual({
      event: 'app_opened_from_home_screen',
      props: { source: 'pwa-shortcut', standalone: false },
    });
  });
});

// ---------------------------------------------------------------------------
// 3. Feuilles et points d'entrée (§5.2 à §5.4)
// ---------------------------------------------------------------------------

function Harness({ surface = 'home' }: { surface?: InstallSurface }) {
  const controller = useInstallController(surface);
  return (
    <>
      {controller.canOffer && (
        <button type="button" onClick={controller.open}>
          Installer l’application
        </button>
      )}
      <InstallSheets controller={controller} />
    </>
  );
}

/** Page Merci réduite à sa carte d'installation (même décision que SuccessPage). */
function SuccessHarness({ reservationRef }: { reservationRef: string }) {
  const showInstallCard = useSuccessInstallOffer(reservationRef);
  return showInstallCard ? <SuccessInstallCard /> : null;
}

function renderWithProviders(ui: ReactElement) {
  return render(<AppProviders client={createAppQueryClient()}>{ui}</AppProviders>);
}

describe('M6 · Installation · 3. Feuilles', () => {
  it('iPhone : la feuille d’instructions s’affiche, avec la mention des notifications (iOS ≥ 16.4)', async () => {
    stubNavigator('userAgent', UA.iphone17);
    initInstallService();
    renderWithProviders(<Harness surface="profile" />);

    fireEvent.click(screen.getByRole('button', { name: 'Installer l’application' }));
    const dialog = await screen.findByRole('dialog', { name: 'Installer sur votre iPhone' });
    const steps = within(dialog).getByRole('list', { name: 'Étapes d’installation' });
    expect(within(steps).getAllByRole('listitem')).toHaveLength(3);
    expect(within(dialog).getByText('Partager')).toBeInTheDocument();
    expect(within(dialog).getAllByText('Sur l’écran d’accueil').length).toBeGreaterThan(0);
    expect(within(dialog).getByText(/En bas de l’écran dans Safari/)).toBeInTheDocument();
    expect(
      within(dialog).getByText('Une fois installée, vous pourrez recevoir les notifications de vos réservations.'),
    ).toBeInTheDocument();
    expect(within(dialog).getByText('Le bouton Partager est juste en dessous')).toBeInTheDocument();
    expect(tracked).toContainEqual({ event: 'install_prompt_shown', props: { surface: 'profile', kind: 'ios' } });

    fireEvent.click(within(dialog).getByRole('button', { name: 'J’ai compris' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    // Lire les instructions n'est pas un refus
    expect(useInstallStore.getState().lastDismissedAt).toBeNull();
  });

  it('iPhone sous iOS 15 : pas de promesse de notifications', async () => {
    stubNavigator('userAgent', UA.iphone15);
    initInstallService();
    renderWithProviders(<Harness />);
    fireEvent.click(screen.getByRole('button', { name: 'Installer l’application' }));
    const dialog = await screen.findByRole('dialog', { name: 'Installer sur votre iPhone' });
    expect(within(dialog).queryByText(/recevoir les notifications/)).not.toBeInTheDocument();
  });

  it('Android : feuille d’installation, puis fenêtre native au bouton « Installer »', async () => {
    initInstallService();
    const { prompt } = fireBeforeInstallPrompt('accepted');
    renderWithProviders(<Harness />);

    fireEvent.click(screen.getByRole('button', { name: 'Installer l’application' }));
    const dialog = await screen.findByRole('dialog', { name: 'Installer l’application' });
    expect(within(dialog).getByText('DR Choco L’Incompris')).toBeInTheDocument();
    expect(within(dialog).getByText('Gratuit · moins de 1 Mo')).toBeInTheDocument();
    for (const benefit of [
      'Ouverture instantanée, même avec peu de réseau',
      'Notification dès que votre colis est prêt',
      'Vos réservations toujours à portée de main',
    ]) {
      expect(within(dialog).getByText(benefit)).toBeInTheDocument();
    }
    expect(within(dialog).getByRole('group', { name: 'Aperçu de l’application' })).toBeInTheDocument();

    fireEvent.click(within(dialog).getByRole('button', { name: 'Installer' }));
    await waitFor(() => expect(prompt).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    // Installation acceptée : le point d'entrée disparaît
    expect(screen.queryByRole('button', { name: 'Installer l’application' })).not.toBeInTheDocument();
  });

  it('« Plus tard » : feuille fermée et refus mémorisé', async () => {
    initInstallService();
    fireBeforeInstallPrompt();
    renderWithProviders(<Harness />);
    fireEvent.click(screen.getByRole('button', { name: 'Installer l’application' }));
    const dialog = await screen.findByRole('dialog', { name: 'Installer l’application' });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Plus tard' }));

    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(useInstallStore.getState().lastDismissedAt).not.toBeNull();
    expect(tracked).toContainEqual({
      event: 'install_prompt_dismissed',
      props: { surface: 'home', kind: 'install', via: 'later' },
    });
    // Le bouton reste disponible après un refus
    expect(screen.getByRole('button', { name: 'Installer l’application' })).toBeInTheDocument();
  });

  it('navigateur sans installation directe : courte explication', async () => {
    initInstallService();
    renderWithProviders(<Harness />);
    fireEvent.click(screen.getByRole('button', { name: 'Installer l’application' }));
    const dialog = await screen.findByRole('dialog', { name: 'Installer l’application' });
    expect(within(dialog).getByText(/ne propose pas l’installation directe/)).toBeInTheDocument();
  });

  it('application installée : aucun point d’entrée', () => {
    stubStandaloneDisplay();
    initInstallService();
    renderWithProviders(<Harness />);
    expect(screen.queryByRole('button', { name: 'Installer l’application' })).not.toBeInTheDocument();
  });

  it('deuxième visite : feuille automatique 8 s après l’arrivée sur l’accueil, une seule fois', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'Date'] });
    vi.setSystemTime(NOW);
    useInstallStore.setState({ visitCount: 1, firstVisitAt: NOW - 2 * DAY, lastVisitAt: NOW - 2 * DAY });
    initInstallService(); // deuxième visite comptée
    expect(useInstallStore.getState().visitCount).toBe(2);
    fireBeforeInstallPrompt();

    const view = renderWithProviders(<InstallAutoPrompt />);
    act(() => {
      vi.advanceTimersByTime(AUTO_SHEET_DELAY_MS - 100);
    });
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    act(() => {
      vi.advanceTimersByTime(100);
    });
    expect(screen.getByRole('dialog', { name: 'Installer l’application' })).toBeInTheDocument();
    expect(useInstallStore.getState().autoSheetShownAt).toBe(NOW + AUTO_SHEET_DELAY_MS);
    expect(tracked).toContainEqual({ event: 'install_prompt_shown', props: { surface: 'auto-sheet', kind: 'install' } });

    // Retour sur l'accueil plus tard : plus jamais automatiquement
    view.unmount();
    renderWithProviders(<InstallAutoPrompt />);
    act(() => {
      vi.advanceTimersByTime(AUTO_SHEET_DELAY_MS * 2);
    });
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('premier chargement : aucune feuille automatique', () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'Date'] });
    vi.setSystemTime(NOW);
    initInstallService();
    fireBeforeInstallPrompt();
    renderWithProviders(<InstallAutoPrompt />);
    act(() => {
      vi.advanceTimersByTime(AUTO_SHEET_DELAY_MS * 3);
    });
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('page Merci : carte d’installation pour la première preuve seulement', async () => {
    initInstallService();
    const { prompt } = fireBeforeInstallPrompt('dismissed');

    const first = renderWithProviders(<SuccessHarness reservationRef="RES-000201" />);
    expect(screen.getByRole('heading', { name: 'Suivez votre réservation depuis votre écran d’accueil' })).toBeInTheDocument();
    await waitFor(() => expect(useInstallStore.getState().firstProofRef).toBe('RES-000201'));
    expect(useInstallStore.getState().shownCount.success).toBe(1);
    first.unmount();

    // Deuxième réservation : plus de carte
    const second = renderWithProviders(<SuccessHarness reservationRef="RES-000202" />);
    expect(screen.queryByRole('heading', { name: /Suivez votre réservation/ })).not.toBeInTheDocument();
    second.unmount();

    // Retour sur la page Merci de la première : la carte est toujours là ; « Installer » ouvre la fenêtre native
    renderWithProviders(<SuccessHarness reservationRef="RES-000201" />);
    fireEvent.click(screen.getByRole('button', { name: 'Installer' }));
    await waitFor(() => expect(prompt).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(screen.queryByRole('heading', { name: /Suivez votre réservation/ })).not.toBeInTheDocument());
  });

  it('page Merci : « Plus tard » masque la carte et suspend les invitations automatiques', () => {
    initInstallService();
    fireBeforeInstallPrompt();
    renderWithProviders(<SuccessHarness reservationRef="RES-000201" />);
    fireEvent.click(screen.getByRole('button', { name: 'Plus tard' }));
    expect(screen.queryByRole('heading', { name: /Suivez votre réservation/ })).not.toBeInTheDocument();
    expect(isInstallSnoozed(useInstallStore.getState(), Date.now())).toBe(true);
  });

  it('page Merci sur iPhone : la carte ouvre les instructions d’installation', async () => {
    stubNavigator('userAgent', UA.iphone17);
    initInstallService();
    renderWithProviders(<SuccessHarness reservationRef="RES-000201" />);
    const card = screen.getByRole('region', { name: 'Installer l’application' });
    expect(within(card).getByRole('heading', { name: 'Suivez votre réservation depuis votre écran d’accueil' })).toBeInTheDocument();
    expect(within(card).getByText(/vous pourrez recevoir ses notifications/)).toBeInTheDocument();
    expect(within(card).queryByRole('button', { name: 'Installer' })).not.toBeInTheDocument();
    expect(tracked).toContainEqual({ event: 'install_prompt_shown', props: { surface: 'success', kind: 'ios-card' } });

    fireEvent.click(within(card).getByRole('button', { name: 'Voir comment installer' }));
    const dialog = await screen.findByRole('dialog', { name: 'Installer sur votre iPhone' });
    expect(within(dialog).getByRole('list', { name: 'Étapes d’installation' })).toBeInTheDocument();
    expect(useToastStore.getState().toasts).toHaveLength(0);
  });

  it('page Merci : rien sur un navigateur qui ne sait pas installer, ni une fois installée', () => {
    initInstallService();
    const view = renderWithProviders(<SuccessHarness reservationRef="RES-000201" />);
    expect(screen.queryByRole('heading', { name: /Suivez votre réservation/ })).not.toBeInTheDocument();
    view.unmount();

    disposeInstallService();
    stubStandaloneDisplay();
    initInstallService();
    renderWithProviders(<SuccessHarness reservationRef="RES-000201" />);
    expect(screen.queryByRole('heading', { name: /Suivez votre réservation/ })).not.toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// 4. Branchements : accueil et profil (mocks MSW)
// ---------------------------------------------------------------------------
describe('M6 · Installation · 4. Accueil et profil', () => {
  // Modules lourds (application complète, page Merci, mocks) chargés ici seulement : ce fichier démarre
  // en même temps que les autres, et le test de l'accueil complet de m1 est déjà proche de sa limite de 5 s.
  let server: SetupServer;
  let app: {
    createTestRouter: typeof import('@/app/router').createTestRouter;
    WhatsAppAppSection: typeof import('@/features/catalog/home/WhatsAppAppSection').WhatsAppAppSection;
    SuccessPage: typeof import('@/pages/SuccessPage').SuccessPage;
  };

  beforeAll(async () => {
    const [{ setupServer }, { handlers }, router, home, success] = await Promise.all([
      import('msw/node'),
      import('@/mocks/handlers'),
      import('@/app/router'),
      import('@/features/catalog/home/WhatsAppAppSection'),
      import('@/pages/SuccessPage'),
    ]);
    app = {
      createTestRouter: router.createTestRouter,
      WhatsAppAppSection: home.WhatsAppAppSection,
      SuccessPage: success.SuccessPage,
    };
    server = setupServer(...handlers);
    server.listen();
  }, 30_000);
  afterEach(() => {
    server.resetHandlers();
    useAuthStore.getState().clearSession();
  });
  afterAll(() => server.close());

  it('accueil : le bloc reste affiché sans évènement du navigateur et ouvre la bonne feuille', async () => {
    stubNavigator('userAgent', UA.iphone17);
    initInstallService();
    renderWithProviders(<app.WhatsAppAppSection />);
    // Apostrophe droite ou typographique (passe de finition M7 de l'accueil)
    const card = screen.getByText(/^Ajoutez DR Choco à votre écran d['’]accueil$/).parentElement;
    expect(card).not.toHaveAttribute('hidden');
    fireEvent.click(screen.getByRole('button', { name: /^Installer l['’]application$/ }));
    expect(await screen.findByRole('dialog', { name: 'Installer sur votre iPhone' })).toBeInTheDocument();
    expect(useToastStore.getState().toasts).toHaveLength(0);
  });

  it('accueil : bloc masqué une fois l’application installée', () => {
    stubStandaloneDisplay();
    initInstallService();
    renderWithProviders(<app.WhatsAppAppSection />);
    const card = screen.getByText(/^Ajoutez DR Choco à votre écran d['’]accueil$/).parentElement;
    expect(card).toHaveAttribute('hidden');
  });

  it('profil : la ligne « Installer l’application » ouvre la feuille, puis disparaît après l’installation', async () => {
    initInstallService();
    fireBeforeInstallPrompt();
    useAuthStore.getState().setSession('jwt-test', {
      id: 'usr-junior-01',
      phone: '+237690000001',
      firstName: 'Junior',
      createdAt: '2026-09-15T10:00:00.000Z',
    });
    const router = app.createTestRouter(['/profil']);
    render(
      <AppProviders client={createAppQueryClient()}>
        <RouterProvider router={router} />
      </AppProviders>,
    );

    fireEvent.click(await screen.findByRole('button', { name: /Installer l’application/ }));
    const dialog = await screen.findByRole('dialog', { name: 'Installer l’application' });
    expect(within(dialog).getByText('Gratuit · moins de 1 Mo')).toBeInTheDocument();
    expect(useToastStore.getState().toasts.map((t) => t.message)).not.toContain(
      'Bientôt disponible : l’installation arrive avec la prochaine mise à jour.',
    );

    act(() => {
      window.dispatchEvent(new Event('appinstalled'));
    });
    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Installer l’application' })).not.toBeInTheDocument());
    expect(screen.queryByRole('button', { name: /Installer l’application/ })).not.toBeInTheDocument();
  });

  it('page Merci sur iPhone : carte d’installation à la place de la carte des notifications, première preuve seulement', async () => {
    stubNavigator('userAgent', UA.iphone17);
    initInstallService();
    const renderSuccess = (ref: string) => {
      const router = createMemoryRouter([{ path: '/reservation/:ref/merci', element: <app.SuccessPage /> }], {
        initialEntries: [`/reservation/${ref}/merci`],
      });
      return render(
        <AppProviders client={createAppQueryClient()}>
          <RouterProvider router={router} />
        </AppProviders>,
      );
    };
    const iosNotificationsCard = /Ajoutez l.app à votre écran d.accueil pour recevoir les notifications/;

    // Première preuve : la carte d'installation remplace la carte iPhone des notifications
    const first = renderSuccess('RES-000104');
    // (l'animation d'entrée masque encore les cartes aux requêtes par rôle : recherche par le texte)
    expect(await screen.findByText('Suivez votre réservation depuis votre écran d’accueil')).toBeInTheDocument();
    expect(screen.queryByText(iosNotificationsCard)).not.toBeInTheDocument();
    expect(screen.getAllByText('Voir comment installer')).toHaveLength(1);
    expect(useInstallStore.getState().firstProofRef).toBe('RES-000104');
    first.unmount();

    // Réservation suivante : la carte des notifications revient, et ouvre aussi les instructions
    renderSuccess('RES-000105');
    expect(await screen.findByText(iosNotificationsCard)).toBeInTheDocument();
    expect(screen.queryByText(/Suivez votre réservation/)).not.toBeInTheDocument();
    fireEvent.click(screen.getByText('Voir comment installer'));
    expect(await screen.findByRole('dialog', { name: 'Installer sur votre iPhone' })).toBeInTheDocument();
    expect(useToastStore.getState().toasts.map((toast) => toast.message)).not.toContain('Bientôt disponible');
  }, 15_000);
});
