import { keepPreviousData, useQuery, useQueryClient } from '@tanstack/react-query';
import { DownloadCloud, HardDrive, RefreshCw, RotateCcw, Trash2, Wifi, WifiOff } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { isStandaloneDisplay } from '@/features/notifications/pushService';
import { api, ApiError } from '@/lib/api/client';
import { endpoints } from '@/lib/api/endpoints';
import { env } from '@/lib/env';
import { useOnlineStatus } from '@/lib/hooks/useOnlineStatus';
import { usePushStore } from '@/pwa/pushStore';
import { usePwaStore } from '@/pwa/pwaStore';
import { applyUpdate, getServiceWorkerVersion } from '@/pwa/registerSW';

interface WorkerInfo {
  scope: string;
  script: string | null;
  installing: string | null;
  waiting: string | null;
  active: string | null;
  isApp: boolean;
  controlled: boolean;
}

interface CacheInfo {
  name: string;
  entries: number;
}

interface PwaDiagnostics {
  swSupported: boolean;
  worker: WorkerInfo | null;
  version: string | null;
  caches: CacheInfo[] | null;
  storage: { usage: number; quota: number } | null;
  persisted: boolean | null;
}

interface MockStatus {
  runtime: 'node' | 'browser';
  pushSubscriptions: number;
  sessionUser: string | null;
}

const MOCK_STATUS_KEY = ['dev', 'mock-status'] as const;

async function readWorker(): Promise<WorkerInfo | null> {
  if (!('serviceWorker' in navigator)) return null;
  const registration = await navigator.serviceWorker.getRegistration('/').catch(() => undefined);
  if (!registration) return null;
  const script = (registration.active ?? registration.waiting ?? registration.installing)?.scriptURL ?? null;
  return {
    scope: registration.scope,
    script,
    installing: registration.installing?.state ?? null,
    waiting: registration.waiting?.state ?? null,
    active: registration.active?.state ?? null,
    isApp: Boolean(script && /\/sw\.js$/.test(script)),
    controlled: Boolean(navigator.serviceWorker.controller),
  };
}

async function readCaches(): Promise<CacheInfo[] | null> {
  if (typeof caches === 'undefined') return null;
  const names = await caches.keys();
  return Promise.all(
    names.map(async (name) => ({ name, entries: (await (await caches.open(name)).keys()).length })),
  );
}

async function readPwaDiagnostics(): Promise<PwaDiagnostics> {
  const worker = await readWorker();
  const [version, cacheList, estimate, persisted] = await Promise.all([
    worker?.isApp ? getServiceWorkerVersion() : Promise.resolve(null),
    readCaches().catch(() => null),
    navigator.storage?.estimate ? navigator.storage.estimate().catch(() => null) : Promise.resolve(null),
    navigator.storage?.persisted ? navigator.storage.persisted().catch(() => null) : Promise.resolve(null),
  ]);
  return {
    swSupported: 'serviceWorker' in navigator,
    worker,
    version,
    caches: cacheList,
    storage: estimate ? { usage: estimate.usage ?? 0, quota: estimate.quota ?? 0 } : null,
    persisted,
  };
}

function formatBytes(bytes: number): string {
  if (bytes >= 1024 ** 3) return `${(bytes / 1024 ** 3).toFixed(1)} Go`;
  if (bytes >= 1024 ** 2) return `${(bytes / 1024 ** 2).toFixed(2)} Mo`;
  return `${Math.round(bytes / 1024)} Ko`;
}

function DevStat({ label, value, tone = 'ink' }: { label: string; value: string; tone?: 'ink' | 'success' | 'danger' }) {
  const toneClass = tone === 'success' ? 'text-success' : tone === 'danger' ? 'text-danger' : 'text-ink';
  return (
    <div className="rounded-[var(--radius-md)] border border-silver bg-surface p-4">
      <dt className="text-label text-text-2">{label}</dt>
      <dd className={`mt-1 break-all font-mono text-small font-bold ${toneClass}`}>{value}</dd>
    </div>
  );
}

/**
 * Section « Application installable » de /_dev (M6 §4.4 à §4.7, §6.4) : mode effectif, service
 * worker et version, mise à jour forcée, caches, stockage, affichage et réseau, remise à zéro.
 */
export function PwaDevSection() {
  const queryClient = useQueryClient();
  const online = useOnlineStatus();
  const updateReady = usePwaStore((s) => s.updateReady);
  const workerEnabled = usePushStore((s) => s.workerEnabled);
  // Abonnement créé ou retiré : le nombre d'abonnements des mocks est relu
  const pushEndpoint = usePushStore((s) => s.endpoint);
  const [diag, setDiag] = useState<PwaDiagnostics | null>(null);
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);

  const mockStatus = useQuery({
    queryKey: [...MOCK_STATUS_KEY, pushEndpoint],
    queryFn: () => api.get<MockStatus>(endpoints.mock.status),
    retry: false,
    staleTime: 0,
    placeholderData: keepPreviousData,
  });

  const { refetch: refetchMockStatus } = mockStatus;
  const reload = useCallback(async () => {
    void refetchMockStatus();
    setDiag(await readPwaDiagnostics().catch(() => null));
  }, [refetchMockStatus]);

  // Relu à l'ouverture, quand une mise à jour attend et quand un nouveau service worker prend la main
  useEffect(() => {
    let cancelled = false;
    const refresh = async () => {
      const next = await readPwaDiagnostics().catch(() => null);
      if (!cancelled) setDiag(next);
    };
    void refresh();
    const container = 'serviceWorker' in navigator ? navigator.serviceWorker : null;
    const onControllerChange = () => {
      void refresh();
    };
    container?.addEventListener('controllerchange', onControllerChange);
    return () => {
      cancelled = true;
      container?.removeEventListener('controllerchange', onControllerChange);
    };
  }, [updateReady]);

  const run = async (action: () => Promise<string>) => {
    setBusy(true);
    setFeedback(null);
    try {
      setFeedback(await action());
    } catch (error) {
      setFeedback(error instanceof ApiError ? `Erreur (${error.status}) : ${error.message}` : String(error));
    } finally {
      await reload();
      setBusy(false);
    }
  };

  const effectiveMode = env.apiMock
    ? 'MSW dans le navigateur'
    : mockStatus.data?.runtime === 'node'
      ? 'Serveur de mocks Node'
      : mockStatus.data?.runtime === 'browser'
        ? 'MSW dans le navigateur'
        : mockStatus.isError
          ? mockStatus.error instanceof ApiError && mockStatus.error.status === 0
            ? 'API injoignable'
            : 'API réelle'
          : '…';

  const worker = diag?.worker ?? null;
  const cacheList = diag?.caches;
  const workerLabel = !diag
    ? '…'
    : !diag.swSupported
      ? 'Navigateur sans service worker'
      : !worker
        ? 'Aucun enregistré'
        : worker.isApp
          ? 'Application (/sw.js)'
          : 'MSW (mockServiceWorker.js)';
  const hasWaiting = Boolean(worker?.waiting) || updateReady;

  const clearCache = (name: string) =>
    run(async () => {
      await caches.delete(name);
      return `Cache « ${name} » vidé.`;
    });

  const clearAllCaches = () =>
    run(async () => {
      const names = await caches.keys();
      await Promise.all(names.map((name) => caches.delete(name)));
      return `${names.length} cache(s) vidé(s).`;
    });

  const checkForUpdate = () =>
    run(async () => {
      const registration = await navigator.serviceWorker.getRegistration('/');
      if (!registration) return 'Aucun service worker enregistré.';
      await registration.update();
      return 'Recherche de mise à jour lancée.';
    });

  const resetAll = () =>
    run(async () => {
      const result = await api.post<{ ok: boolean; count: number }>(endpoints.mock.resetAll);
      await queryClient.invalidateQueries();
      return `Mocks remis à zéro : session, codes, adresses, favoris, abonnements et ${result.count} réservations.`;
    });

  return (
    <section aria-labelledby="dev-pwa">
      <div className="flex flex-wrap items-baseline justify-between gap-2 border-b border-silver pb-3">
        <div>
          <h2 id="dev-pwa" className="text-h2 text-ink">
            Application installable (Module M6)
          </h2>
          <p className="text-small text-text-2">
            Service worker, mises à jour, caches et stockage. Test réel : <code>npm run mock:api</code> puis{' '}
            <code>npm run preview:pwa</code>, sur http://127.0.0.1:4173.
          </p>
        </div>
        <button
          type="button"
          onClick={() => void reload()}
          className="inline-flex min-h-[40px] items-center gap-2 rounded-[var(--radius-md)] border border-silver bg-white px-3 text-small font-bold text-ink hover:bg-surface"
        >
          <RefreshCw className="h-4 w-4" aria-hidden="true" />
          Actualiser
        </button>
      </div>

      <dl className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <DevStat label="MODE EFFECTIF" value={effectiveMode} />
        <DevStat
          label="APPLICATION INSTALLABLE (VITE_PWA_ENABLED)"
          value={env.pwaEnabled ? (workerEnabled ? 'Activée' : 'Activée, mais mocks MSW prioritaires') : 'Désactivée'}
          tone={workerEnabled ? 'success' : 'ink'}
        />
        <DevStat label="SERVICE WORKER" value={workerLabel} tone={worker?.isApp ? 'success' : 'ink'} />
        <DevStat
          label="ÉTATS (INSTALLATION · ATTENTE · ACTIF)"
          value={worker ? `${worker.installing ?? '—'} · ${worker.waiting ?? '—'} · ${worker.active ?? '—'}` : '—'}
        />
        <DevStat label="PORTÉE · PAGE CONTRÔLÉE" value={worker ? `${worker.scope} · ${worker.controlled ? 'oui' : 'non'}` : '—'} />
        <DevStat label="VERSION DU SERVICE WORKER" value={diag?.version ?? '—'} />
        <DevStat label="VERSION DE L'APP" value={env.appVersion} />
        <DevStat
          label="STOCKAGE OCCUPÉ / QUOTA"
          value={diag?.storage ? `${formatBytes(diag.storage.usage)} / ${formatBytes(diag.storage.quota)}` : 'API absente'}
        />
        <DevStat
          label="STOCKAGE PERSISTANT"
          value={!diag ? '…' : diag.persisted === null ? 'API absente' : diag.persisted ? 'Oui' : 'Non'}
          tone={diag?.persisted ? 'success' : 'ink'}
        />
        <DevStat label="AFFICHAGE" value={isStandaloneDisplay() ? 'Standalone (app installée)' : 'Navigateur'} />
        <DevStat label="RÉSEAU" value={online ? 'En ligne' : 'Hors connexion'} tone={online ? 'success' : 'danger'} />
        <DevStat
          label="MOCKS : ABONNEMENTS PUSH · SESSION"
          value={mockStatus.data ? `${mockStatus.data.pushSubscriptions} · ${mockStatus.data.sessionUser ?? 'aucune'}` : '—'}
        />
      </dl>

      <div className="mt-5 space-y-5 rounded-[var(--radius-md)] border border-silver bg-surface p-5">
        <div className="flex flex-wrap gap-3">
          <button
            type="button"
            disabled={busy || !diag?.swSupported}
            onClick={() => void checkForUpdate()}
            className="inline-flex min-h-[44px] items-center gap-2 rounded-[var(--radius-md)] border border-silver bg-white px-3.5 text-small font-bold text-ink hover:bg-surface disabled:opacity-50"
          >
            <RefreshCw className="h-4 w-4" aria-hidden="true" />
            Rechercher une mise à jour
          </button>
          <button
            type="button"
            disabled={busy || !hasWaiting}
            onClick={() => {
              applyUpdate();
              setFeedback('Mise à jour appliquée : la page va se recharger.');
            }}
            className="inline-flex min-h-[44px] items-center gap-2 rounded-[var(--radius-md)] bg-ink px-3.5 text-small font-bold text-white disabled:opacity-50"
          >
            <DownloadCloud className="h-4 w-4" aria-hidden="true" />
            Forcer la mise à jour
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() => void resetAll()}
            className="inline-flex min-h-[44px] items-center gap-2 rounded-[var(--radius-md)] bg-danger px-3.5 text-small font-bold text-white disabled:opacity-50"
          >
            <RotateCcw className="h-4 w-4" aria-hidden="true" />
            Remise à zéro complète
          </button>
        </div>

        <div>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="flex items-center gap-2 text-label text-text-2">
              <HardDrive className="h-4 w-4" aria-hidden="true" />
              CACHES ({cacheList?.length ?? 0})
            </p>
            <button
              type="button"
              disabled={busy || !cacheList?.length}
              onClick={() => void clearAllCaches()}
              className="inline-flex min-h-[36px] items-center gap-1.5 rounded-[var(--radius-sm)] border border-silver bg-white px-3 text-xs font-bold text-ink hover:bg-surface disabled:opacity-50"
            >
              <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
              Tout vider
            </button>
          </div>
          {cacheList === null ? (
            <p className="mt-2 text-small text-text-2">API Cache Storage absente (contexte non sécurisé ?).</p>
          ) : !cacheList || cacheList.length === 0 ? (
            <p className="mt-2 text-small text-text-2">{cacheList ? 'Aucun cache.' : '…'}</p>
          ) : (
            <ul className="mt-2 divide-y divide-silver overflow-hidden rounded-[var(--radius-md)] border border-silver bg-white">
              {cacheList.map((cache) => (
                <li key={cache.name} className="flex items-center justify-between gap-3 px-4 py-2.5">
                  <span className="min-w-0 truncate font-mono text-small text-ink">{cache.name}</span>
                  <span className="flex shrink-0 items-center gap-3">
                    <span className="font-mono text-small font-bold text-ink">
                      {cache.entries} entrée{cache.entries > 1 ? 's' : ''}
                    </span>
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => void clearCache(cache.name)}
                      className="inline-flex min-h-[32px] items-center rounded-[var(--radius-sm)] border border-silver px-2.5 text-xs font-bold text-ink hover:bg-surface disabled:opacity-50"
                    >
                      Vider
                    </button>
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>

        <p className="flex items-center gap-2 text-small text-text-2">
          {online ? <Wifi className="h-4 w-4" aria-hidden="true" /> : <WifiOff className="h-4 w-4" aria-hidden="true" />}
          Pour simuler une coupure : DevTools → Réseau → Hors connexion (avec le serveur de mocks Node,
          pas avec MSW dans le navigateur).
        </p>

        {feedback ? (
          <div
            role="status"
            aria-live="polite"
            className="rounded-[var(--radius-sm)] border border-silver bg-white px-4 py-3 font-mono text-small text-ink"
          >
            {feedback}
          </div>
        ) : null}
      </div>
    </section>
  );
}
