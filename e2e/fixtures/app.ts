import type { BrowserContext, Locator, Page } from '@playwright/test';
import { expect, PROOF_FILE } from './test';

/**
 * Actions de l'utilisateur réutilisées par les parcours, avec des sélecteurs accessibles
 * (rôles, noms accessibles et libellés réels de l'interface).
 */

/** Client connu des mocks : Junior Mbarga, deux adresses enregistrées (Maison par défaut). */
export const KNOWN_CUSTOMER = { phone: '690000001', firstName: 'Junior' } as const;
/** Numéro inconnu des mocks : nouveau client (étape « Comment vous appelez-vous ? »). */
export const NEW_CUSTOMER = { phone: '677112233', firstName: 'Aïcha' } as const;
/** Code accepté par les mocks ; 000000 renvoie « Ce code a expiré » (410). */
export const VALID_OTP = '123456';
export const EXPIRED_OTP = '000000';

/** Article du parcours d'achat : babouche en cuir, deux couleurs, pointure 42 disponible. */
export const PRODUCT = {
  slug: 'babouche-royale-akwa-cuir',
  name: 'Babouche Royale Akwa Cuir',
  price: 35_000,
} as const;
/** Frais de livraison à Douala dans les mocks (/delivery/cities). */
export const DOUALA_DELIVERY_FEE = 1_500;

/** Montant affiché (« 36 500 FCFA ») : espace normale, insécable ou fine insécable entre les milliers. */
export function amountPattern(value: number): RegExp {
  const digits = value.toLocaleString('en-US').replace(/,/g, '[\\s\\u00a0\\u202f]');
  return new RegExp(`${digits}[\\s\\u00a0\\u202f]FCFA`);
}

// ---------------------------------------------------------------------------
// Connexion par SMS
// ---------------------------------------------------------------------------

export function authSheet(page: Page): Locator {
  return page.getByRole('dialog', { name: 'Connexion par SMS' });
}

export function phoneField(page: Page): Locator {
  return authSheet(page).getByLabel(/Numéro de téléphone mobile/i);
}

export function otpField(page: Page): Locator {
  return authSheet(page).getByLabel('Code de vérification à 6 chiffres');
}

/** Étape 1 : numéro, puis « Recevoir mon code ». */
export async function requestOtp(page: Page, phone: string): Promise<void> {
  await phoneField(page).fill(phone);
  await authSheet(page).getByRole('button', { name: 'Recevoir mon code' }).click();
  await expect(authSheet(page).getByRole('heading', { name: 'Entrez le code reçu' })).toBeVisible();
}

/**
 * Connexion complète dans la feuille déjà ouverte : numéro, code, et prénom pour un nouveau client.
 * Attend la fermeture de la feuille.
 */
export async function completeLogin(
  page: Page,
  { phone, firstName, isNewCustomer = false }: { phone: string; firstName?: string; isNewCustomer?: boolean },
): Promise<void> {
  const sheet = authSheet(page);
  await expect(sheet).toBeVisible();
  await requestOtp(page, phone);
  // Le code part tout seul au 6e chiffre
  await otpField(page).fill(VALID_OTP);
  if (isNewCustomer) {
    await expect(sheet.getByRole('heading', { name: 'Comment vous appelez-vous ?' })).toBeVisible();
    await sheet.getByLabel('PRÉNOM', { exact: true }).fill(firstName ?? 'Client');
    await sheet.getByRole('button', { name: 'Continuer' }).click();
  }
  await expect(sheet).toBeHidden();
}

/** Connexion depuis l'onglet Profil (« Me connecter avec mon numéro »). */
export async function loginFromProfile(
  page: Page,
  customer: { phone: string; firstName: string },
  { isNewCustomer = false }: { isNewCustomer?: boolean } = {},
): Promise<void> {
  await page.goto('/profil');
  await page.getByRole('button', { name: 'Me connecter avec mon numéro' }).click();
  await completeLogin(page, { ...customer, isNewCustomer });
  await expect(page.getByRole('button', { name: 'Me connecter avec mon numéro' })).toBeHidden();
}

// ---------------------------------------------------------------------------
// Fiche produit et panier
// ---------------------------------------------------------------------------

/** Choix de la couleur (facultatif) et de la taille sur la fiche produit. */
export async function chooseVariant(page: Page, { color, size }: { color?: string; size: string }): Promise<void> {
  if (color) {
    const colorRadio = page.getByRole('radiogroup', { name: 'Choisir une couleur' }).getByRole('radio', { name: color, exact: true });
    await colorRadio.click();
    await expect(colorRadio).toBeChecked();
  }
  const sizeRadio = page
    .getByRole('radiogroup', { name: 'Choisir une taille' })
    .getByRole('radio', { name: new RegExp(`^Taille ${size} \\(`) });
  await sizeRadio.click();
  await expect(sizeRadio).toBeChecked();
}

/** « Ajouter » (barre collante sur téléphone) ou « Ajouter au panier » (ordinateur). */
export async function addToCart(page: Page, isMobile: boolean): Promise<void> {
  await page.getByRole('button', { name: isMobile ? 'Ajouter' : 'Ajouter au panier', exact: true }).click();
}

/**
 * Après l'ajout : « Voir le panier » dans la notification (téléphone) ou dans l'aperçu du panier
 * qui s'ouvre sur le côté (ordinateur).
 */
export async function openCartAfterAdd(page: Page, isMobile: boolean): Promise<void> {
  if (isMobile) {
    await page.getByRole('status').getByRole('link', { name: 'Voir le panier' }).click();
  } else {
    await page
      .getByRole('dialog', { name: 'Aperçu de mon panier' })
      .getByRole('button', { name: 'Voir le panier' })
      .click();
  }
  await expect(page).toHaveURL(/\/panier$/);
  await expect(page.getByRole('heading', { level: 1, name: 'MON PANIER' })).toBeVisible();
}

/**
 * Bouton principal « Réserver » du panier (barre collante sur téléphone, récapitulatif sur ordinateur),
 * à distinguer des boutons « Réserver » des cartes « Vous aimerez aussi ».
 */
export function cartReserveButton(page: Page): Locator {
  return page
    .getByRole('button', { name: 'Réserver', exact: true })
    .filter({ visible: true })
    .and(page.locator('xpath=//button[not(ancestor::a or ancestor::*[@role="link"])]'));
}

/** Ajoute l'article de test au panier depuis sa fiche (sans passer par le panier). */
export async function putProductInCart(
  page: Page,
  isMobile: boolean,
  variant: { color?: string; size: string } = { size: '42' },
): Promise<void> {
  await page.goto(`/produit/${PRODUCT.slug}`);
  await expect(page.getByRole('heading', { level: 1, name: PRODUCT.name })).toBeVisible();
  await chooseVariant(page, variant);
  await addToCart(page, isMobile);
  await expectAddedToCart(page);
}

/** Confirmation de l'ajout : notification (téléphone) ou aperçu du panier ouvert (ordinateur). */
export async function expectAddedToCart(page: Page): Promise<void> {
  await expect(
    page
      .getByRole('status')
      .filter({ hasText: 'ajouté au panier' })
      .or(page.getByRole('dialog', { name: 'Aperçu de mon panier' }))
      .first(),
  ).toBeVisible();
}

// ---------------------------------------------------------------------------
// Réservation, paiement, preuve
// ---------------------------------------------------------------------------

export async function expectCheckoutPage(page: Page): Promise<void> {
  await expect(page).toHaveURL(/\/reservation$/);
  await expect(page.getByRole('heading', { level: 1, name: 'FINALISER LA RÉSERVATION' })).toBeVisible();
}

/** Livraison à Douala avec une nouvelle adresse : quartier et point de repère. */
export async function fillDoualaDelivery(
  page: Page,
  { district, landmark }: { district: string; landmark: string },
): Promise<void> {
  const reception = page.getByRole('region', { name: '2. MODE DE RÉCEPTION' });
  await expect(reception.getByRole('radio', { name: /^Livraison/ })).toBeChecked();
  // Douala est la ville proposée par défaut
  await expect(reception.getByRole('button', { name: /^Douala/ })).toBeVisible();
  await reception.getByRole('textbox', { name: /^QUARTIER/ }).fill(district);
  await reception.getByRole('textbox', { name: /^POINT DE REPÈRE/ }).fill(landmark);
}

/**
 * « Confirmer la réservation » puis écran de paiement ; renvoie la référence RES-XXXXXX.
 * Animations réduites : le moment « Vos articles sont mis de côté » ne s'enchaîne pas tout seul,
 * le client appuie sur « Payer maintenant ».
 */
export async function confirmReservation(
  page: Page,
  { reducedMotion = false }: { reducedMotion?: boolean } = {},
): Promise<string> {
  await page.getByRole('button', { name: 'Confirmer la réservation' }).click();
  if (reducedMotion) {
    await page
      .getByRole('dialog', { name: 'Vos articles sont mis de côté' })
      .getByRole('button', { name: 'Payer maintenant' })
      .click({ timeout: 20_000 });
  }
  await expect(page).toHaveURL(/\/reservation\/RES-\d{6}\/paiement$/, { timeout: 20_000 });
  await expect(page.getByRole('region', { name: 'MONTANT EXACT À PAYER' })).toBeVisible();
  const ref = /RES-\d{6}/.exec(page.url())?.[0];
  if (!ref) throw new Error(`Référence absente de l'adresse ${page.url()}`);
  return ref;
}

/**
 * Choisit une capture avec le sélecteur de fichiers du téléphone (ou de l'ordinateur), depuis la zone
 * d'envoi (« Ajouter ma capture d'écran », ou « Envoyer une nouvelle capture » après un rejet).
 */
export async function pickProofFile(page: Page, zoneName: RegExp, file: string): Promise<void> {
  const chooser = page.waitForEvent('filechooser');
  await page.getByRole('region', { name: zoneName }).getByRole('button', { name: zoneName }).click();
  await (await chooser).setFiles(file);
  await expect(page.getByRole('region', { name: /^Aperçu de votre capture d(’|')écran$/ })).toBeVisible();
}

/** Écran de preuve : capture choisie, « Envoyer ma preuve », écran « Merci ». */
export async function uploadProofAndSend(
  page: Page,
  { file = PROOF_FILE, zoneName = /^Ajouter ma capture d(’|')écran/ }: { file?: string; zoneName?: RegExp } = {},
): Promise<void> {
  await pickProofFile(page, zoneName, file);
  await page.getByRole('button', { name: 'Envoyer ma preuve' }).click();
  // Envoi simulé : 1,5 à 3 s
  await expect(page).toHaveURL(/\/reservation\/RES-\d{6}\/merci(\?|$)/, { timeout: 20_000 });
  await expect(page.getByRole('heading', { level: 1, name: 'MERCI !' })).toBeVisible();
}

/** Écran de paiement → « J’ai payé, envoyer ma preuve » → écran de preuve. */
export async function goToProofFromPayment(page: Page): Promise<void> {
  await page.getByRole('link', { name: /J(’|')ai payé, envoyer ma preuve/ }).click();
  await expect(page).toHaveURL(/\/reservation\/RES-\d{6}\/preuve/);
}

// ---------------------------------------------------------------------------
// Simulateur boutique (/_dev)
// ---------------------------------------------------------------------------

/** Ouvre le simulateur boutique dans un second onglet, comme le ferait la boutique. */
export async function openShopSimulator(context: BrowserContext): Promise<Page> {
  const shop = await context.newPage();
  await shop.goto('/_dev');
  await expect(shopM4(shop)).toBeVisible({ timeout: 20_000 });
  return shop;
}

/** Simulateur M4 (paiement et preuve) : valider, rejeter, faire expirer. */
export function shopM4(shop: Page): Locator {
  return shop.getByRole('region', { name: /Simulateur boutique \(Module M4/ });
}

/** Simulateur M5 (suivi) : étape suivante, colis prêt avec photos, rejet, annulation. */
export function shopM5(shop: Page): Locator {
  return shop.getByRole('region', { name: /Simulateur boutique \(Module M5/ });
}

/** Action du simulateur M4 sur une référence, puis attente du statut annoncé. */
export async function shopM4Action(shop: Page, ref: string, button: string, expectedStatus: string): Promise<void> {
  const m4 = shopM4(shop);
  await m4.getByLabel('RÉFÉRENCE DE LA RÉSERVATION').fill(ref);
  await m4.getByRole('button', { name: button, exact: true }).click();
  await expect(m4.getByRole('status')).toContainText(`${ref} → statut « ${expectedStatus} »`);
}

/** Action du simulateur M5 sur une référence, puis attente du statut annoncé. */
export async function shopM5Action(shop: Page, ref: string, button: string, expectedStatus: string): Promise<void> {
  const m5 = shopM5(shop);
  await m5.getByLabel('RÉSERVATION', { exact: true }).selectOption(ref);
  await m5.getByRole('button', { name: button, exact: true }).click();
  await expect(m5.getByRole('status')).toContainText(`${ref} → « ${expectedStatus} »`);
}

// ---------------------------------------------------------------------------
// Application installable
// ---------------------------------------------------------------------------

/** Attend que le service worker de l'app contrôle la page (précache prêt, hors connexion possible). */
export async function waitForServiceWorker(page: Page): Promise<void> {
  await page.waitForFunction(() => navigator.serviceWorker?.controller != null, null, { timeout: 30_000 });
}
