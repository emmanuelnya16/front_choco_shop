import {
  goToProofFromPayment,
  KNOWN_CUSTOMER,
  loginFromProfile,
  openShopSimulator,
  shopM4Action,
  uploadProofAndSend,
} from './fixtures/app';
import { expect, finalScreenshot, PROOF_FILE, PROOF_FILE_2, test } from './fixtures/test';

/**
 * Parcours 3 (M7 §8) : preuve envoyée → la boutique rejette le paiement (simulateur /_dev)
 * → le client ouvre l'écran de preuve en mode renvoi → nouvel envoi.
 */

// Réservation de démonstration de Junior, « Réservée » après chaque remise à zéro des mocks
const REF = 'RES-000101';

test('rejet par la boutique → écran de preuve en mode renvoi → nouvel envoi', async ({ page, context }, testInfo) => {
  await loginFromProfile(page, KNOWN_CUSTOMER);

  // Première preuve
  await page.goto(`/reservation/${REF}/paiement`);
  await expect(page.getByRole('region', { name: 'MONTANT EXACT À PAYER' })).toBeVisible();
  await goToProofFromPayment(page);
  await uploadProofAndSend(page, { file: PROOF_FILE });

  // La boutique rejette le paiement
  const shop = await openShopSimulator(context);
  await shopM4Action(shop, REF, 'Rejeter (capture illisible)', 'Paiement rejeté');
  await shop.close();

  // Le client retrouve sa réservation, avec le motif, et renvoie une preuve
  await page.goto('/reservations');
  const card = page.getByRole('article').filter({ has: page.getByRole('heading', { name: REF }) });
  await expect(card).toContainText('Paiement rejeté');
  await card.getByRole('link', { name: 'Renvoyer ma preuve' }).click();

  await expect(page).toHaveURL(new RegExp(`/reservation/${REF}/preuve`));
  await expect(page.getByRole('heading', { level: 1, name: 'Paiement non validé' })).toBeVisible();
  await expect(page.getByRole('main')).toContainText(/Capture illisible/i);

  // Une autre capture (la même serait refusée comme doublon)
  await uploadProofAndSend(page, { file: PROOF_FILE_2, zoneName: /^Envoyer une nouvelle capture/ });

  // Le suivi repasse « En attente de validation »
  await page.goto(`/reservations/${REF}`);
  await expect(page.getByRole('main').getByText('En attente de validation').first()).toBeVisible();
  await expect(page.getByRole('list', { name: 'Suivi de la réservation' })).toContainText('Nouvelle preuve envoyée');
  await finalScreenshot(page, testInfo, '03-rejet-renvoi');
});
