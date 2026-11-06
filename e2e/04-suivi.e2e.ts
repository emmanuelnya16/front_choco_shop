import {
  chooseVariant,
  confirmReservation,
  expectCheckoutPage,
  KNOWN_CUSTOMER,
  loginFromProfile,
  openShopSimulator,
  PRODUCT,
  shopM5Action,
} from './fixtures/app';
import { expect, finalScreenshot, test } from './fixtures/test';

/**
 * Parcours 4 (M7 §8) : réservation en « Retrait en boutique » → la boutique la fait avancer
 * (simulateur /_dev, « Étape suivante » puis « Colis prêt » avec photos) jusqu'à « Prête pour retrait »
 * → le détail montre la photo du colis.
 */
test('« Étape suivante » jusqu’à « Prête pour retrait » avec photos → détail avec la photo du colis', async ({
  page,
  context,
}, testInfo) => {
  await loginFromProfile(page, KNOWN_CUSTOMER);

  // Réservation directe depuis la fiche, retrait en boutique
  await page.goto(`/produit/${PRODUCT.slug}`);
  await chooseVariant(page, { size: '42' });
  await page.getByRole('button', { name: /^Réserver · / }).click();
  await expectCheckoutPage(page);
  const reception = page.getByRole('region', { name: '2. MODE DE RÉCEPTION' });
  const pickup = reception.getByRole('radio', { name: /^Retrait en boutique/ });
  await pickup.click();
  await expect(pickup).toBeChecked();
  const ref = await confirmReservation(page);

  // La boutique : preuve reçue, paiement validé, colis prêt avec 2 photos
  const shop = await openShopSimulator(context);
  await shopM5Action(shop, ref, 'Étape suivante', 'En attente de validation');
  await shopM5Action(shop, ref, 'Étape suivante', 'Confirmée');
  await shopM5Action(shop, ref, 'Colis prêt avec 2 photos', 'Prête pour retrait');
  await shop.close();

  // Le client : Mes réservations → détail
  await page.goto('/reservations');
  const card = page.getByRole('article').filter({ has: page.getByRole('heading', { name: ref }) });
  await expect(card).toContainText('Prête pour retrait');
  await card.getByRole('link', { name: ref }).click();

  await expect(page).toHaveURL(new RegExp(`/reservations/${ref}$`));
  const main = page.getByRole('main');
  await expect(main.getByRole('heading', { level: 2, name: 'Votre colis est prêt' })).toBeVisible();
  await expect(main.getByText('Retrait en boutique', { exact: false }).first()).toBeVisible();

  // Les photos se dévoilent quand leur bloc entre à l'écran (animation au défilement) : sur ordinateur,
  // le bloc est sous la ligne de flottaison, le client fait défiler jusqu'au suivi
  await main.getByRole('region', { name: 'Suivi' }).scrollIntoViewIfNeeded();
  const photos = main.getByRole('region', { name: /photos du colis/ });
  const firstPhoto = photos.getByRole('img', { name: /^Photo de votre colis emballé, 1 sur 2/ });
  await expect(firstPhoto).toBeVisible();
  // L'image est réellement chargée (pas une vignette cassée)
  await expect.poll(() => firstPhoto.evaluate((img: HTMLImageElement) => img.complete && img.naturalWidth > 0)).toBe(true);
  await expect(page.getByRole('list', { name: 'Suivi de la réservation' })).toContainText('Prête pour retrait');

  await firstPhoto.scrollIntoViewIfNeeded();
  await finalScreenshot(page, testInfo, '04-suivi');
});
