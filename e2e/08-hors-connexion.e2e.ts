import type { BrowserContext, Page } from '@playwright/test';
import {
  amountPattern,
  cartReserveButton,
  KNOWN_CUSTOMER,
  loginFromProfile,
  PRODUCT,
  putProductInCart,
  waitForServiceWorker,
} from './fixtures/app';
import { DEFECTS, RUN_FIXME } from './fixtures/defects';
import { expect, finalScreenshot, test } from './fixtures/test';

/**
 * Parcours 8 (M7 §8) : hors connexion avec le service worker actif.
 * - Mode avion (`context.setOffline`) : fiche et panier déjà consultés disponibles, bandeau, réservation bloquée.
 * - Serveur injoignable alors que le téléphone se croit en ligne : requêtes de l'API interrompues par
 *   `context.route` (y compris celles du service worker, voir PW_EXPERIMENTAL_SERVICE_WORKER_NETWORK_EVENTS
 *   dans playwright.config.ts) ; la copie servie par le service worker (en-tête X-DRC-Offline-Fallback)
 *   compte comme un échec et le bandeau apparaît.
 */

const OFFLINE_BANNER_TEXT = 'Hors connexion · contenu de votre dernière visite';
const API_PATTERN = /^http:\/\/127\.0\.0\.1:8787\/api\//;

function offlineBanner(page: Page) {
  return page.getByRole('status').filter({ hasText: OFFLINE_BANNER_TEXT });
}

/** Visite connectée : service worker actif, fiche consultée, article au panier, panier ouvert. */
async function visitProductAndCartOnline(page: Page, isMobile: boolean): Promise<void> {
  await page.goto('/');
  await waitForServiceWorker(page);
  await putProductInCart(page, isMobile);
  await page.goto('/panier');
  await expect(page.getByRole('heading', { level: 1, name: 'MON PANIER' })).toBeVisible();
  await expect(page.getByRole('main').getByRole('link', { name: PRODUCT.name }).first()).toBeVisible();
}

/** Toutes les requêtes vers l'API échouent comme un serveur qui ne répond plus. */
async function makeServerUnreachable(context: BrowserContext): Promise<void> {
  await context.route(API_PATTERN, (route) => route.abort('connectionrefused'));
}

test.describe('Parcours 8 · Hors connexion', () => {
  test('mode avion : fiche et panier disponibles, bandeau visible, réservation bloquée', async ({
    page,
    context,
    isMobile,
  }, testInfo) => {
    await visitProductAndCartOnline(page, isMobile);

    await context.setOffline(true);
    await expect(offlineBanner(page)).toBeVisible();

    // Fiche déjà consultée : rechargée sans réseau
    await page.goto(`/produit/${PRODUCT.slug}`);
    await expect(page.getByRole('heading', { level: 1, name: PRODUCT.name })).toBeVisible();
    await expect(page.getByRole('main').getByText(amountPattern(PRODUCT.price)).first()).toBeVisible();
    await expect(offlineBanner(page)).toBeVisible();

    // Panier : contenu affiché, « Réserver » désactivé avec le message
    await page.goto('/panier');
    await expect(page.getByRole('heading', { level: 1, name: 'MON PANIER' })).toBeVisible();
    await expect(page.getByRole('main').getByRole('link', { name: PRODUCT.name }).first()).toBeVisible();
    await expect(offlineBanner(page)).toBeVisible();
    await expect(cartReserveButton(page)).toBeDisabled();
    await expect(
      page.getByRole('alert').filter({ hasText: 'Vous êtes hors connexion. Reconnectez-vous pour réserver.' }).first(),
    ).toBeVisible();
    await finalScreenshot(page, testInfo, '08-hors-connexion');

    // Retour du réseau
    await context.setOffline(false);
    await expect(page.getByRole('status').filter({ hasText: 'Connexion rétablie' })).toBeVisible();
    await expect(cartReserveButton(page)).toBeEnabled();
  });

  test('serveur injoignable, téléphone en ligne : bandeau sur « Mes réservations »', async ({ page, context }, testInfo) => {
    await loginFromProfile(page, KNOWN_CUSTOMER);
    await waitForServiceWorker(page);
    await page.goto('/reservations');
    await expect(page.getByRole('heading', { level: 1, name: 'Mes réservations' })).toBeVisible();
    await expect(page.getByRole('article').first()).toBeVisible();

    await makeServerUnreachable(context);
    await page.reload();

    expect(await page.evaluate(() => navigator.onLine)).toBe(true);
    await expect(offlineBanner(page)).toBeVisible();
    await expect(page.getByRole('main').getByRole('status').filter({ hasText: 'statuts affichés depuis votre dernière visite' })).toBeVisible();
    // Les réservations restent lisibles (copie enregistrée par le service worker)
    await expect(page.getByRole('article').first()).toBeVisible();
    await finalScreenshot(page, testInfo, '08b-serveur-injoignable');
  });

  test('serveur injoignable, téléphone en ligne : bandeau sur la fiche et le panier', async ({ page, context, isMobile }) => {
    test.fixme(!RUN_FIXME, DEFECTS.D2);
    await visitProductAndCartOnline(page, isMobile);
    await makeServerUnreachable(context);

    await page.goto(`/produit/${PRODUCT.slug}`);
    await expect(page.getByRole('heading', { level: 1, name: PRODUCT.name })).toBeVisible();
    await expect(offlineBanner(page)).toBeVisible();

    await page.goto('/panier');
    await expect(offlineBanner(page)).toBeVisible();
    await expect(cartReserveButton(page)).toBeDisabled();
  });
});
