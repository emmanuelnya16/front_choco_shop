// Import unique de la police Archivo Variable avec les deux axes wght (100-900) et wdth (62%-125%)
import '@fontsource-variable/archivo/wdth.css';
import '@/styles/index.css';

import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from '@/app/App';
import { env } from '@/lib/env';
import { registerServiceWorker, unregisterPwaServiceWorkers } from '@/pwa/registerSW';

async function enableMocking(): Promise<void> {
  // Démarre MSW en développement ou en prévisualisation lorsque VITE_API_MOCK=true.
  // La comparaison directe à import.meta.env permet au build de production (VITE_API_MOCK=false)
  // d'éliminer complètement le code des mocks.
  if (import.meta.env.VITE_API_MOCK === 'false' || !env.apiMock) {
    return;
  }

  // Un seul service worker par portée : celui de l'app laisse la place à MSW (M6 §3.2)
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
        <App />
      </StrictMode>,
    );
    // Application installable et hors connexion : jamais en même temps que les mocks du navigateur
    if (env.pwaEnabled && !env.apiMock) {
      registerServiceWorker();
    }
  });
