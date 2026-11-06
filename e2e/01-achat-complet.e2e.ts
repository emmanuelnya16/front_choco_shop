import type { Page } from '@playwright/test';
import {
  addToCart,
  amountPattern,
  cartReserveButton,
  chooseVariant,
  completeLogin,
  confirmReservation,
  DOUALA_DELIVERY_FEE,
  expectAddedToCart,
  expectCheckoutPage,
  fillDoualaDelivery,
  goToProofFromPayment,
  loginFromProfile,
  NEW_CUSTOMER,
  openCartAfterAdd,
  PRODUCT,
  uploadProofAndSend,
} from './fixtures/app';
import { DEFECTS, RUN_FIXME } from './fixtures/defects';
import { expect, finalScreenshot, test } from './fixtures/test';

/**
 * Parcours 1 (M7 §8) : accueil → catégorie → filtre taille → fiche → couleur et taille → panier
 * → « Réserver » → connexion d'un nouveau client → livraison à Douala → confirmation → paiement
 * → envoi de la capture → « Merci ».
 */

const DELIVERY = { district: 'Bonapriso', landmark: 'En face de la boulangerie Zepol, portail bleu' };

/** Accueil → « Babouches » → filtre pointure 42 → fiche de l'article. */
async function browseToProduct(page: Page, isMobile: boolean, { workaroundD1 = false } = {}): Promise<void> {
  await page.goto('/');
  await page
    .getByRole('region', { name: 'Nos univers' })
    .getByRole('link', { name: /^Babouches \d+ articles?$/ })
    .click();
  await expect(page).toHaveURL(/\/explorer\/babouches$/);
  await expect(page.getByRole('heading', { level: 1, name: 'BABOUCHES' })).toBeVisible();

  if (isMobile) {
    // Téléphone : feuille « Filtrer par taille »
    await page.getByRole('button', { name: 'Taille', exact: true }).click();
    const sheet = page.getByRole('dialog', { name: 'Filtrer par taille' });
    const size42 = sheet.getByRole('button', { name: '42', exact: true });
    await size42.click();
    await expect(size42).toHaveAttribute('aria-pressed', 'true');
    await sheet.getByRole('button', { name: /^Voir \d+ articles?$/ }).click();
    await expect(sheet).toBeHidden();
    if (workaroundD1) {
      // Contournement du défaut D1 : la fermeture de la feuille ramène le routeur sur la liste non
      // filtrée (l'adresse garde ?size=42) ; un rechargement affiche le filtre réellement appliqué.
      await page.reload();
    }
  } else {
    // Ordinateur : filtres latéraux, section « Pointure »
    const size42 = page
      .getByRole('complementary', { name: 'Filtres du catalogue' })
      .getByRole('button', { name: '42', exact: true });
    await size42.click();
    await expect(size42).toHaveAttribute('aria-pressed', 'true');
  }

  await expect(page).toHaveURL(/[?&]size=42(&|$)/);
  const main = page.getByRole('main');
  // Données des mocks : 4 babouches en pointure 42 ; la Croco Nocturne n'a pas de 42 en stock
  await expect(main.getByRole('link', { name: /, \d+ FCFA$/ })).toHaveCount(4);
  await expect(main.getByRole('link', { name: /^Babouche Croco Nocturne,/ })).toHaveCount(0);

  await main.getByRole('link', { name: new RegExp(`^${PRODUCT.name},`) }).click();
  await expect(page).toHaveURL(`/produit/${PRODUCT.slug}`);
  await expect(page.getByRole('heading', { level: 1, name: PRODUCT.name })).toBeVisible();
}

/** Couleur « Rouge Incompris », pointure 42, ajout au panier. */
async function chooseAndAddToCart(page: Page, isMobile: boolean): Promise<void> {
  await chooseVariant(page, { color: 'Rouge Incompris', size: '42' });
  await addToCart(page, isMobile);
  await expectAddedToCart(page);
}

async function expectCartLine(page: Page): Promise<void> {
  const main = page.getByRole('main');
  await expect(main.getByRole('link', { name: PRODUCT.name }).first()).toBeVisible();
  await expect(main.getByText('Rouge Incompris · 42')).toBeVisible();
}

/** Livraison à Douala → confirmation → paiement → preuve → « Merci ». */
async function deliverPayAndSendProof(page: Page): Promise<void> {
  await expectCheckoutPage(page);
  await expect(page.getByRole('textbox', { name: /^PRÉNOM/ })).toHaveValue(NEW_CUSTOMER.firstName);
  await fillDoualaDelivery(page, DELIVERY);

  const ref = await confirmReservation(page);
  const amount = page.getByRole('region', { name: 'MONTANT EXACT À PAYER' });
  await expect(amount).toContainText(amountPattern(PRODUCT.price + DOUALA_DELIVERY_FEE));
  await expect(page.getByRole('button', { name: new RegExp(`^Référence ${ref}`) })).toBeVisible();

  await goToProofFromPayment(page);
  await uploadProofAndSend(page);
  await expect(page.getByText('Nous avons bien reçu votre preuve de paiement.')).toBeVisible();
  await expect(page.getByRole('region', { name: 'Ce qui va se passer' })).toContainText(ref);
}

test.describe('Parcours 1 · Achat complet', () => {
  // DÉFAUT D1 (application, voir le rapport M7 phase P7) : après la connexion ouverte par « Réserver »,
  // la navigation vers /reservation est annulée et le client reste sur le panier. La feuille de
  // connexion retire son entrée d'historique par history.back() ; ce retour atteint React Router, car
  // src/lib/hooks/overlayHistory.ts n'est installé qu'au chargement à la demande de la feuille, donc
  // après createBrowserRouter : son écouteur popstate passe après celui du routeur. Sur ordinateur,
  // « Voir le panier » de l'aperçu du panier est annulé de la même façon.
  // Sur téléphone, le filtre choisi dans la feuille « Filtrer par taille » n'est pas appliqué à la liste
  // (l'adresse garde ?size=42) pour la même raison.
  // Correction proposée : importer '@/lib/hooks/overlayHistory' dans src/main.tsx avant '@/app/App'.
  test('connexion pendant la réservation : accueil → filtre → fiche → panier → connexion → livraison à Douala → paiement → preuve → Merci', async ({
    page,
    isMobile,
  }, testInfo) => {
    test.fixme(!RUN_FIXME, DEFECTS.D1);
    await browseToProduct(page, isMobile);
    await chooseAndAddToCart(page, isMobile);
    await openCartAfterAdd(page, isMobile);
    await expectCartLine(page);

    await cartReserveButton(page).click();
    await completeLogin(page, { ...NEW_CUSTOMER, isNewCustomer: true });

    await deliverPayAndSendProof(page);
    await finalScreenshot(page, testInfo, '01-achat-complet');
  });

  test('connexion préalable depuis le profil : accueil → filtre → fiche → panier → livraison à Douala → paiement → preuve → Merci', async ({
    page,
    isMobile,
  }, testInfo) => {
    // Variante exécutable en attendant la correction du défaut D1 : même parcours, client connecté avant
    await loginFromProfile(page, NEW_CUSTOMER, { isNewCustomer: true });

    await browseToProduct(page, isMobile, { workaroundD1: true });
    await chooseAndAddToCart(page, isMobile);
    if (isMobile) {
      await openCartAfterAdd(page, true);
    } else {
      // Contournement du défaut D1 sur ordinateur : « Voir le panier » de l'aperçu n'aboutit pas
      await page.goto('/panier');
      await expect(page.getByRole('heading', { level: 1, name: 'MON PANIER' })).toBeVisible();
    }
    await expectCartLine(page);

    await cartReserveButton(page).click();
    await deliverPayAndSendProof(page);
    await finalScreenshot(page, testInfo, '01b-achat-complet-connexion-prealable');
  });
});
