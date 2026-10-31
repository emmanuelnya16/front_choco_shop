// Import unique de la police Archivo Variable avec les deux axes wght (100-900) et wdth (62%-125%)
import '@fontsource-variable/archivo/wdth.css';
import '@/styles/index.css';

import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
// Avant App : ?source=pwa est retiré de l'adresse avant la création du routeur (M6 §5.5), et
// beforeinstallprompt, qui part tôt, est gardé (§5.1). Module minuscule : le service complet est
// chargé après le premier affichage.
import '@/pwa/installEarly';
import { App } from '@/app/App';
import { ErrorBoundary } from '@/components/errors/ErrorBoundary';
import { installGlobalErrorHandlers } from '@/components/errors/globalErrorHandlers';
import { env } from '@/lib/env';

// Erreurs hors affichage (M7 §5.1) : signalées sans rien montrer, rechargement unique après une
// mise à jour. Installé avant tout le reste, mocks compris.
installGlobalErrorHandlers();

async function enableMocking(): Promise<void> {
  // Démarre MSW en développement ou en prévisualisation lorsque VITE_API_MOCK=true.
  // La comparaison directe à import.meta.env permet au build de production (VITE_API_MOCK=false)
  // d'éliminer complètement le code des mocks.
  if (import.meta.env.VITE_API_MOCK === 'false' || !env.apiMock) {
    return;
  }

  // Un seul service worker par portée : celui de l'app laisse la place à MSW (M6 §3.2)
  const { unregisterPwaServiceWorkers } = await import('@/pwa/registerSW');
  await unregisterPwaServiceWorkers();
  const { worker } = await import('@/mocks/browser');
  // Note MSW 3.x : `onUnhandledRequest` est remplacé par `onUnhandledFrame`
  await worker.start({
    onUnhandledFrame: 'bypass',
  });
}

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error('Élément id="root" introuvable dans index.html');
}

enableMocking()
  .catch((err) => {
    console.error('[MSW] Impossible de démarrer le worker de mocks :', err);
  })
  .finally(() => {
    createRoot(rootElement).render(
      <StrictMode>
        {/* Zone « coquille » : dernier rempart, au-dessus des fournisseurs et du routeur */}
        <ErrorBoundary variant="shell" zone="shell">
          <App />
        </ErrorBoundary>
      </StrictMode>,
    );
    // Application installable et hors connexion : jamais en même temps que les mocks du navigateur
    // (chargé après le premier affichage : workbox-window hors du JavaScript de démarrage)
    if (env.pwaEnabled && !env.apiMock) {
      void import('@/pwa/registerSW').then(({ registerServiceWorker }) => registerServiceWorker());
    }
    // Service d'installation (visites, invitations, mesure) : hors du JavaScript de démarrage
    void import('@/pwa/installService').then(({ initInstallService }) => initInstallService());
  });
