import { Bell, BellOff, Clipboard, Send } from 'lucide-react';
import { useEffect, useState } from 'react';
import {
  disableNotifications,
  enableNotifications,
  getAppRegistration,
  getSubscriptionJson,
  isStandaloneDisplay,
  type EnableNotificationsResult,
} from '@/features/notifications/pushService';
import { useReservationsSummary } from '@/features/tracking/api/useTrackingQueries';
import type { PushType } from '@/pwa/pushPayload';
import { usePushStore, type PushStatus } from '@/pwa/pushStore';
import { getServiceWorkerVersion } from '@/pwa/registerSW';
import { useAuthStore } from '@/stores/authStore';
import { samplePayloadFor, showLocalNotification, type LocalNotificationResult } from './devNotifications';

const TEST_NOTIFICATIONS: { type: PushType; label: string }[] = [
  { type: 'payment_validated', label: 'Tester : paiement validé' },
  { type: 'payment_rejected', label: 'Tester : paiement rejeté' },
  { type: 'package_ready', label: 'Tester : colis prêt (avec photo)' },
  { type: 'in_delivery', label: 'Tester : en route' },
  { type: 'expiring_soon', label: 'Tester : expire bientôt' },
];

const PUSH_STATUS_LABELS: Record<PushStatus, string> = {
  subscribed: 'Permission accordée + abonné',
  granted: 'Permission accordée, non abonné',
  default: 'Permission jamais demandée',
  denied: 'Bloquées dans le navigateur',
  unsupported: 'Non disponibles',
  'needs-install': 'iPhone : application à installer',
};

const ENABLE_MESSAGES: Record<EnableNotificationsResult, string> = {
  subscribed: 'Abonnement enregistré par le serveur (POST /push/subscribe).',
  denied: 'Permission refusée : réautorisez le site dans les réglages du navigateur.',
  dismissed: 'Fenêtre de permission fermée sans choix.',
  unsupported: 'Notifications indisponibles dans ce mode (voir ci-dessus).',
  failed: 'Permission accordée mais abonnement impossible (voir la console).',
};

const NO_APP_WORKER =
  'Aucun service worker d’application actif : en mode mocks MSW, les notifications ne peuvent pas s’afficher. Lancez npm run mock:api puis npm run preview:pwa et ouvrez http://127.0.0.1:4173/_dev.';

function localResultMessage(result: LocalNotificationResult, title: string): string {
  switch (result) {
    case 'shown':
      return `Notification « ${title} » affichée (registration.showNotification).`;
    case 'no-app-worker':
      return NO_APP_WORKER;
    case 'permission':
      return 'Permission non accordée : appuyez d’abord sur « Autoriser et s’abonner ».';
    case 'error':
      return 'Le navigateur a refusé d’afficher la notification (voir la console).';
  }
}

function truncateEndpoint(endpoint: string): string {
  return endpoint.length > 64 ? `${endpoint.slice(0, 44)}…${endpoint.slice(-14)}` : endpoint;
}

/**
 * Section « Notifications » de /_dev (M6 §7.5) : état, abonnement, notifications locales de test
 * (même rendu que le service worker) et copie de l'abonnement JSON.
 */
export function NotificationsDevSection() {
  const status = usePushStore((s) => s.status);
  const endpoint = usePushStore((s) => s.endpoint);
  const workerEnabled = usePushStore((s) => s.workerEnabled);
  const authStatus = useAuthStore((s) => s.status);
  const { data: summary } = useReservationsSummary();
  const [appWorker, setAppWorker] = useState<{ active: boolean; version: string | null } | null>(null);
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [subscriptionJson, setSubscriptionJson] = useState<string | null>(null);

  // Service worker de l'app actif ? Revérifié quand l'état change et quand il prend la main
  useEffect(() => {
    let cancelled = false;
    const check = async () => {
      const registration = await getAppRegistration(0);
      const version = registration ? await getServiceWorkerVersion() : null;
      if (!cancelled) setAppWorker({ active: Boolean(registration), version });
    };
    void check();
    const container = 'serviceWorker' in navigator ? navigator.serviceWorker : null;
    const onChange = () => {
      void check();
    };
    container?.addEventListener('controllerchange', onChange);
    return () => {
      cancelled = true;
      container?.removeEventListener('controllerchange', onChange);
    };
  }, [status]);

  const permission = typeof Notification === 'undefined' ? 'API absente' : Notification.permission;
  const badgeSupported = typeof navigator !== 'undefined' && 'setAppBadge' in navigator;
  const testsDisabled = busy || !appWorker?.active;

  const run = async (action: () => Promise<string>) => {
    setBusy(true);
    setFeedback(null);
    try {
      setFeedback(await action());
    } finally {
      setBusy(false);
    }
  };

  const testNotification = (type: PushType) =>
    run(async () => {
      const payload = samplePayloadFor(type);
      return localResultMessage(await showLocalNotification(payload), payload.title);
    });

  const copySubscription = () =>
    run(async () => {
      const json = await getSubscriptionJson();
      if (!json) {
        setSubscriptionJson(null);
        return 'Aucun abonnement sur ce navigateur.';
      }
      const text = JSON.stringify(json, null, 2);
      setSubscriptionJson(text);
      try {
        await navigator.clipboard.writeText(text);
        return 'Abonnement JSON copié dans le presse-papiers.';
      } catch {
        return 'Copie refusée par le navigateur : abonnement affiché ci-dessous.';
      }
    });

  return (
    <section aria-labelledby="dev-notifications">
      <div className="flex flex-wrap items-baseline justify-between gap-2 border-b border-silver pb-3">
        <div>
          <h2 id="dev-notifications" className="text-h2 text-ink">
            Notifications (Module M6)
          </h2>
          <p className="text-small text-text-2">
            Notifications locales avec exactement le même rendu que celles du service worker, sans
            serveur de push.
          </p>
        </div>
        <span className="text-label text-ink">PUSH · PASTILLE</span>
      </div>

      <dl className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <div className="rounded-[var(--radius-md)] border border-silver bg-surface p-4">
          <dt className="text-label text-text-2">PERMISSION</dt>
          <dd className="mt-1 font-mono text-small font-bold text-ink">{permission}</dd>
        </div>
        <div className="rounded-[var(--radius-md)] border border-silver bg-surface p-4">
          <dt className="text-label text-text-2">ÉTAT (PROFIL)</dt>
          <dd className={`mt-1 font-mono text-small font-bold ${status === 'subscribed' ? 'text-success' : 'text-ink'}`}>
            {PUSH_STATUS_LABELS[status]}
          </dd>
        </div>
        <div className="rounded-[var(--radius-md)] border border-silver bg-surface p-4">
          <dt className="text-label text-text-2">ABONNEMENT (POINT DE TERMINAISON)</dt>
          <dd className="mt-1 break-all font-mono text-small text-ink">
            {endpoint ? truncateEndpoint(endpoint) : 'Aucun'}
          </dd>
        </div>
        <div className="rounded-[var(--radius-md)] border border-silver bg-surface p-4">
          <dt className="text-label text-text-2">SERVICE WORKER DE L&apos;APP · VERSION</dt>
          <dd className="mt-1 font-mono text-small font-bold text-ink">
            {appWorker === null ? '…' : appWorker.active ? `Actif · ${appWorker.version ?? '?'}` : 'Absent'}
          </dd>
        </div>
        <div className="rounded-[var(--radius-md)] border border-silver bg-surface p-4">
          <dt className="text-label text-text-2">AFFICHAGE</dt>
          <dd className="mt-1 font-mono text-small font-bold text-ink">
            {isStandaloneDisplay() ? 'Standalone' : 'Navigateur'}
          </dd>
        </div>
        <div className="rounded-[var(--radius-md)] border border-silver bg-surface p-4">
          <dt className="text-label text-text-2">PASTILLE (ACTIONS ATTENDUES)</dt>
          <dd className="mt-1 font-mono text-small font-bold text-ink">
            {authStatus === 'authenticated' ? (summary?.needsAction ?? '…') : 'non connecté'} ·{' '}
            {badgeSupported ? 'API disponible' : 'API absente'}
          </dd>
        </div>
      </dl>

      <div className="mt-5 space-y-5 rounded-[var(--radius-md)] border border-silver bg-surface p-5">
        {!workerEnabled || appWorker?.active === false ? (
          <p className="rounded-[var(--radius-sm)] border border-warning bg-white px-4 py-3 text-small text-ink">
            {workerEnabled
              ? 'Le service worker de l’application n’est pas encore actif : rechargez la page dans un instant.'
              : NO_APP_WORKER}
          </p>
        ) : null}

        <div className="flex flex-wrap gap-3">
          <button
            type="button"
            disabled={busy || !workerEnabled}
            onClick={() => void run(async () => ENABLE_MESSAGES[await enableNotifications()])}
            className="inline-flex min-h-[44px] items-center gap-2 rounded-[var(--radius-md)] bg-ink px-3.5 text-small font-bold text-white disabled:opacity-50"
          >
            <Bell className="h-4 w-4" aria-hidden="true" />
            Autoriser et s&apos;abonner
          </button>
          <button
            type="button"
            disabled={busy || status !== 'subscribed'}
            onClick={() =>
              void run(async () => {
                await disableNotifications();
                return 'Désabonné (POST /push/unsubscribe puis subscription.unsubscribe()).';
              })
            }
            className="inline-flex min-h-[44px] items-center gap-2 rounded-[var(--radius-md)] border border-silver bg-white px-3.5 text-small font-bold text-ink hover:bg-surface disabled:opacity-50"
          >
            <BellOff className="h-4 w-4" aria-hidden="true" />
            Se désabonner
          </button>
          <button
            type="button"
            disabled={busy || !appWorker?.active}
            onClick={() => void copySubscription()}
            className="inline-flex min-h-[44px] items-center gap-2 rounded-[var(--radius-md)] border border-silver bg-white px-3.5 text-small font-bold text-ink hover:bg-surface disabled:opacity-50"
          >
            <Clipboard className="h-4 w-4" aria-hidden="true" />
            Copier l&apos;abonnement JSON
          </button>
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5">
          {TEST_NOTIFICATIONS.map(({ type, label }) => (
            <button
              key={type}
              type="button"
              disabled={testsDisabled}
              onClick={() => void testNotification(type)}
              className="inline-flex min-h-[48px] items-center justify-center gap-2 rounded-[var(--radius-md)] bg-red px-3 py-2.5 text-small font-bold text-white transition-opacity disabled:opacity-50"
            >
              <Send className="h-4 w-4 shrink-0" aria-hidden="true" />
              {label}
            </button>
          ))}
        </div>

        {feedback ? (
          <div
            role="status"
            aria-live="polite"
            className="rounded-[var(--radius-sm)] border border-silver bg-white px-4 py-3 font-mono text-small text-ink"
          >
            {feedback}
          </div>
        ) : null}

        {subscriptionJson ? (
          <pre className="max-h-48 overflow-auto rounded-[var(--radius-sm)] border border-silver bg-white p-3 font-mono text-xs text-ink">
            {subscriptionJson}
          </pre>
        ) : null}
      </div>
    </section>
  );
}
