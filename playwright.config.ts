import { defineConfig, devices } from '@playwright/test';

/**
 * Parcours de bout en bout (M7 §8) : `npm run e2e`.
 *
 * - Deux projets : « pixel-7 » (téléphone) et « desktop-chrome » (ordinateur), avec le Chrome installé
 *   sur le poste (`channel: 'chrome'`) : aucun navigateur Playwright n'est téléchargé.
 * - Deux serveurs lancés automatiquement : le serveur de mocks Node (port 8787, mêmes gestionnaires MSW
 *   que l'app) et un build de prévisualisation en mode `e2e` (`.env.e2e`, port 4174) avec le service
 *   worker actif (parcours hors connexion).
 * - Les données du serveur de mocks sont partagées : remise à zéro avant chaque test (e2e/fixtures/test.ts)
 *   et exécution en série (un seul worker).
 */

// Requêtes du service worker visibles par `context.route()` (cas « serveur injoignable » du parcours 8).
// Option expérimentale de Playwright pour Chromium, lue par le processus qui pilote le navigateur.
process.env.PW_EXPERIMENTAL_SERVICE_WORKER_NETWORK_EVENTS ??= '1';

const APP_URL = 'http://127.0.0.1:4174';
const MOCK_API_STATUS_URL = 'http://127.0.0.1:8787/api/_mock/status';
// Build hors de dist/ (le dossier de build de l'équipe n'est jamais écrasé par les tests)
const E2E_DIST = 'node_modules/.cache/e2e-dist';

export default defineConfig({
  testDir: './e2e',
  // *.e2e.ts : jamais ramassés par Vitest (motif *.test|spec.*)
  testMatch: '**/*.e2e.ts',
  outputDir: 'test-results',
  fullyParallel: false,
  workers: 1,
  // Aucun test intermittent toléré : pas de nouvel essai automatique
  retries: 0,
  forbidOnly: Boolean(process.env.CI),
  // Parcours complets (connexion, réservation, envoi de la capture avec 1,5 à 3 s de délai simulé)
  timeout: 120_000,
  expect: { timeout: 10_000 },
  reporter: [
    ['list'],
    ['html', { open: 'never', outputFolder: 'playwright-report' }],
    ['json', { outputFile: 'test-results/e2e-results.json' }],
  ],
  use: {
    // E2E_BASE_URL : rejouer les parcours sur un autre build déjà servi (ex. vérification d'une correction)
    baseURL: process.env.E2E_BASE_URL ?? APP_URL,
    locale: 'fr-FR',
    timezoneId: 'Africa/Douala',
    actionTimeout: 15_000,
    navigationTimeout: 30_000,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'off',
  },
  projects: [
    {
      name: 'pixel-7',
      use: { ...devices['Pixel 7'], channel: 'chrome' },
    },
    {
      name: 'desktop-chrome',
      use: { ...devices['Desktop Chrome'], channel: 'chrome' },
    },
  ],
  webServer: [
    {
      // server/mock-api.ts lit le mode dans MOCK_API_MODE : .env.e2e (API sur http://127.0.0.1:8787/api)
      command: 'npm run mock:api',
      url: MOCK_API_STATUS_URL,
      env: { MOCK_API_MODE: 'e2e' },
      reuseExistingServer: !process.env.CI,
      timeout: 60_000,
      stdout: 'ignore',
      stderr: 'pipe',
    },
    {
      // Pas de `tsc -b` : les parcours ne dépendent pas de la vérification des types du reste du projet
      command:
        `npx vite build --mode e2e --outDir ${E2E_DIST} --emptyOutDir` +
        ` && npx vite preview --mode e2e --outDir ${E2E_DIST} --port 4174 --strictPort --host 127.0.0.1`,
      url: APP_URL,
      reuseExistingServer: !process.env.CI,
      timeout: 300_000,
      stdout: 'ignore',
      stderr: 'pipe',
    },
  ],
});
