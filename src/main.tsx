// Import unique de la police Archivo Variable avec les deux axes wght (100-900) et wdth (62%-125%)
import '@fontsource-variable/archivo/wdth.css';
import '@/styles/index.css';

import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from '@/app/App';
import { env } from '@/lib/env';

async function enableMocking(): Promise<void> {
  // Démarre MSW en développement ou en prévisualisation lorsque VITE_API_MOCK=true
  if (!env.apiMock) {
    return;
  }

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
  });
