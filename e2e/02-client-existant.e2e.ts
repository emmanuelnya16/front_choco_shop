import { expect as baseExpect, type Locator, type Page, type TestInfo } from '@playwright/test';
import {
  authSheet,
  cartReserveButton,
  expectCheckoutPage,
  KNOWN_CUSTOMER,
  loginFromProfile,
  openCartAfterAdd,
  otpField,
  phoneField,
  putProductInCart,
  VALID_OTP,
} from './fixtures/app';
import { DEFECTS, RUN_FIXME } from './fixtures/defects';
import { expect, finalScreenshot, test } from './fixtures/test';

/**
 * Parcours 2 (M7 §8) : client existant (690 00 00 01) → adresse présélectionnée → réservation en
 * 4 appuis au plus, mesurés entre le panier et la confirmation (écran de paiement).
 *
 * Un « appui » est un toucher volontaire : bouton, lien, ou champ à toucher avant de taper. Un champ qui
 * reçoit déjà le curseur (code SMS, rempli aussi automatiquement par Android) ne compte pas.
 */
// HYPOTHÈSE: « 4 appuis » (M7 §8) = au plus 4 touchers entre le panier et l'écran de paiement, saisie au
// clavier non comptée ; avec la connexion : « Réserver », champ numéro, « Recevoir mon code », « Confirmer ».
const MAX_TAPS = 4;

class TapCounter {
  readonly actions: string[] = [];

  get count(): number {
    return this.actions.length;
  }

  async tap(target: Locator, label: string): Promise<void> {
    await target.click();
    this.actions.push(label);
  }

  /** Saisie au clavier : un appui seulement si le champ n'a pas déjà le curseur. */
  async enterText(page: Page, field: Locator, text: string, label: string): Promise<void> {
    let focused = true;
    try {
      // Les feuilles placent le curseur peu après leur ouverture (≈ 60 ms) : courte attente bornée
      await baseExpect(field).toBeFocused({ timeout: 1_500 });
    } catch {
      focused = false;
    }
    if (!focused) {
      await this.tap(field, `toucher le champ « ${label} »`);
    }
    await page.keyboard.type(text);
  }

  report(testInfo: TestInfo): void {
    testInfo.annotations.push({
      type: 'appuis entre le panier et la confirmation',
      description: `${this.count} : ${this.actions.join(' → ')}`,
    });
  }
}

/** Adresse « Maison » de Junior présélectionnée : Douala, Bonamoussadi, avec son repère. */
async function expectPreselectedAddress(page: Page): Promise<void> {
  const reception = page.getByRole('region', { name: '2. MODE DE RÉCEPTION' });
  await expect(reception.getByRole('radio', { name: /^Livraison/ })).toBeChecked();
  await expect(reception.getByText('Livraison à Douala — Bonamoussadi')).toBeVisible();
  await expect(reception.getByText(/^Repère : Après la pharmacie du carrefour Eto/)).toBeVisible();
  await expect(page.getByRole('textbox', { name: /^PRÉNOM/ })).toHaveValue(KNOWN_CUSTOMER.firstName);
}

async function confirmAndExpectPayment(page: Page, taps: TapCounter): Promise<void> {
  await taps.tap(page.getByRole('button', { name: 'Confirmer la réservation' }), '« Confirmer la réservation »');
  await expect(page).toHaveURL(/\/reservation\/RES-\d{6}\/paiement$/, { timeout: 20_000 });
  await expect(page.getByRole('region', { name: 'MONTANT EXACT À PAYER' })).toBeVisible();
}

test.describe('Parcours 2 · Client existant', () => {
  // DÉFAUT D1 (application) : après la connexion ouverte par « Réserver », le client reste sur le panier
  // (navigation vers /reservation annulée par le retour d'historique de la feuille de connexion), il doit
  // appuyer une seconde fois sur « Réserver ». Sur ordinateur, « Voir le panier » de l'aperçu du panier
  // n'aboutit pas non plus. Voir 01-achat-complet.e2e.ts et le rapport M7 phase P7.
  // DÉFAUT D3 (application) : le champ du code SMS ne reçoit pas le curseur ; le client doit le toucher,
  // soit 5 appuis au lieu de 4 (vérifié sur un build corrigé de D1 : « Réserver » → champ numéro →
  // « Recevoir mon code » → champ code → « Confirmer la réservation »). Détails dans fixtures/defects.ts.
  test('connexion depuis « Réserver » : adresse présélectionnée, réservation en 4 appuis au plus', async ({
    page,
    isMobile,
  }, testInfo) => {
    test.fixme(!RUN_FIXME, `${DEFECTS.D1} ${DEFECTS.D3}`);
    await putProductInCart(page, isMobile);
    await openCartAfterAdd(page, isMobile);

    const taps = new TapCounter();
    await taps.tap(cartReserveButton(page), '« Réserver »');
    await expect(authSheet(page)).toBeVisible();
    await taps.enterText(page, phoneField(page), KNOWN_CUSTOMER.phone, 'numéro');
    await taps.tap(authSheet(page).getByRole('button', { name: 'Recevoir mon code' }), '« Recevoir mon code »');
    await expect(otpField(page)).toBeVisible();
    await taps.enterText(page, otpField(page), VALID_OTP, 'code');
    await expect(authSheet(page)).toBeHidden();

    await expectCheckoutPage(page);
    await expectPreselectedAddress(page);
    await confirmAndExpectPayment(page, taps);

    taps.report(testInfo);
    expect(taps.count, taps.actions.join(' → ')).toBeLessThanOrEqual(MAX_TAPS);
    await finalScreenshot(page, testInfo, '02-client-existant');
  });

  test('déjà connecté : adresse présélectionnée, réservation en 4 appuis au plus', async ({ page, isMobile }, testInfo) => {
    await loginFromProfile(page, KNOWN_CUSTOMER);
    await putProductInCart(page, isMobile);
    if (isMobile) {
      await openCartAfterAdd(page, true);
    } else {
      // Contournement du défaut D1 sur ordinateur : « Voir le panier » de l'aperçu n'aboutit pas
      await page.goto('/panier');
      await expect(page.getByRole('heading', { level: 1, name: 'MON PANIER' })).toBeVisible();
    }

    const taps = new TapCounter();
    await taps.tap(cartReserveButton(page), '« Réserver »');
    await expectCheckoutPage(page);
    await expectPreselectedAddress(page);
    await confirmAndExpectPayment(page, taps);

    taps.report(testInfo);
    expect(taps.count, taps.actions.join(' → ')).toBeLessThanOrEqual(MAX_TAPS);
    await finalScreenshot(page, testInfo, '02b-client-existant-deja-connecte');
  });
});
