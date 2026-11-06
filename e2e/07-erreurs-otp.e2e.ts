import type { Page } from '@playwright/test';
import { authSheet, EXPIRED_OTP, KNOWN_CUSTOMER, otpField, requestOtp, VALID_OTP } from './fixtures/app';
import { expect, finalScreenshot, test } from './fixtures/test';

/**
 * Parcours 7 (M7 §8) : erreurs du code SMS.
 * Mocks (src/mocks/handlers.ts) : 123456 est accepté, 000000 renvoie « Ce code a expiré » (410),
 * tout autre code est refusé (422) avec les essais restants, et le 5e échec bloque 10 min (429).
 */

async function openLoginSheet(page: Page): Promise<void> {
  await page.goto('/profil');
  await page.getByRole('button', { name: 'Me connecter avec mon numéro' }).click();
  await expect(authSheet(page)).toBeVisible();
}

test.describe('Parcours 7 · Erreurs du code SMS', () => {
  test('code faux, puis code expiré, nouveau code et connexion', async ({ page }, testInfo) => {
    await openLoginSheet(page);
    await requestOtp(page, KNOWN_CUSTOMER.phone);
    const sheet = authSheet(page);
    const alert = sheet.getByRole('alert');

    // Code faux : message et essais restants, champ signalé en erreur
    await otpField(page).fill('111111');
    await expect(alert).toHaveText(/Code incorrect\. Il vous reste 4 essais\./);
    await expect(otpField(page)).toHaveAttribute('aria-invalid', 'true');

    // Code expiré : message et « Recevoir un nouveau code »
    await otpField(page).fill(EXPIRED_OTP);
    await expect(alert).toHaveText(/Ce code a expiré\./);
    await expect(otpField(page)).toHaveValue('');
    await sheet.getByRole('button', { name: 'Recevoir un nouveau code' }).click();
    await expect(sheet.getByText('Nouveau code envoyé')).toBeVisible();
    await expect(alert).toHaveCount(0);
    await finalScreenshot(page, testInfo, '07-erreurs-otp');

    // Bon code : connexion
    await otpField(page).fill(VALID_OTP);
    await expect(sheet).toBeHidden();
    await expect(page.getByRole('button', { name: 'Me connecter avec mon numéro' })).toBeHidden();
    await expect(page.getByRole('main')).toContainText(KNOWN_CUSTOMER.firstName);
  });

  test('cinq codes faux : blocage temporaire', async ({ page }) => {
    await openLoginSheet(page);
    await requestOtp(page, '677445566');
    const alert = authSheet(page).getByRole('alert');

    for (const attemptsLeft of [4, 3, 2, 1]) {
      await otpField(page).fill(`99999${attemptsLeft}`);
      await expect(alert).toContainText(`Il vous reste ${attemptsLeft} essai`);
    }
    await otpField(page).fill('999990');
    await expect(alert).toHaveText(/Trop de tentatives\. Réessayez dans 10 min\./);
    await expect(otpField(page)).toBeDisabled();
  });
});
