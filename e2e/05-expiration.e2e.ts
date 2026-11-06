import { KNOWN_CUSTOMER, loginFromProfile, openShopSimulator, shopM4Action } from './fixtures/app';
import { expect, finalScreenshot, test } from './fixtures/test';

/**
 * Parcours 5 (M7 §8) : la réservation expire (simulateur /_dev « Faire expirer ») → calque
 * « Réservation expirée » sur l'écran de paiement → « Refaire ma réservation » → articles remis au panier.
 */

// Réservation de démonstration de Junior, « Réservée » : un Hoodie Barbelé Noir, taille L
const REF = 'RES-000101';
const ITEM = 'Hoodie Barbelé Noir';

test('« Faire expirer » → calque d’expiration → « Refaire ma réservation »', async ({ page, context }, testInfo) => {
  await loginFromProfile(page, KNOWN_CUSTOMER);
  await page.goto(`/reservation/${REF}/paiement`);
  await expect(page.getByRole('region', { name: 'MONTANT EXACT À PAYER' })).toBeVisible();
  await expect(page.getByRole('dialog', { name: 'Réservation expirée' })).toHaveCount(0);

  const shop = await openShopSimulator(context);
  await shopM4Action(shop, REF, 'Faire expirer', 'Expirée');
  await shop.close();

  // HYPOTHÈSE: le client revient sur son écran de paiement (rechargement, état relu sur le serveur) ;
  // la relecture automatique de l'écran ouvert n'est pas l'objet de ce parcours.
  await page.reload();
  const overlay = page.getByRole('dialog', { name: 'Réservation expirée' });
  await expect(overlay).toBeVisible();
  await expect(overlay).toContainText('Le délai de 24 h est dépassé');

  await overlay.getByRole('button', { name: 'Refaire ma réservation' }).click();
  await expect(page).toHaveURL(/\/panier$/);
  await expect(page.getByRole('status').filter({ hasText: /remis dans votre panier/ })).toBeVisible();
  await expect(page.getByRole('heading', { level: 1, name: 'MON PANIER' })).toBeVisible();
  await expect(page.getByRole('main').getByRole('link', { name: ITEM }).first()).toBeVisible();
  await expect(page.getByRole('main').getByText(/Noir Charbon · L$/)).toBeVisible();

  await finalScreenshot(page, testInfo, '05-expiration');
});
