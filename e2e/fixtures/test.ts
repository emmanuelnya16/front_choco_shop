import path from 'node:path';
import { test as base, expect, type Page, type TestInfo } from '@playwright/test';

/** API simulée par le serveur de mocks Node (voir .env.e2e). */
export const API_URL = 'http://127.0.0.1:8787/api';

/** Fichiers de test : fausses captures de paiement PNG (e2e/fixtures/generate-proof-fixtures.mjs). */
export const PROOF_FILE = path.join(import.meta.dirname, 'preuve.png');
export const PROOF_FILE_2 = path.join(import.meta.dirname, 'preuve-2.png');

/**
 * `test` des parcours : remet les données du serveur de mocks à zéro avant chaque test
 * (session, codes, adresses, favoris, réservations), car le serveur est partagé par tous les tests.
 */
export const test = base.extend<{ resetMocks: void }>({
  resetMocks: [
    async ({ request }, provide) => {
      const response = await request.post(`${API_URL}/_mock/reset`);
      expect(response.ok(), 'remise à zéro du serveur de mocks').toBeTruthy();
      await provide();
    },
    { auto: true },
  ],
});

export { expect };

/**
 * Capture finale d'un parcours : e2e/screenshots/<projet>-<parcours>.png (commitée avec les tests).
 * Les animations sont arrêtées pour une image stable.
 */
export async function finalScreenshot(page: Page, testInfo: TestInfo, parcours: string): Promise<void> {
  const file = path.join(testInfo.project.testDir, 'screenshots', `${testInfo.project.name}-${parcours}.png`);
  await page.screenshot({ path: file, animations: 'disabled' });
  await testInfo.attach(`capture-${parcours}`, { path: file, contentType: 'image/png' });
}
