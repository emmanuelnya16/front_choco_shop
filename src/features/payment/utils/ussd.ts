/**
 * Utilitaires de construction des codes USSD Mobile Money et détection iOS (§4.1, §4.3 & §8.3).
 */

/**
 * Construit le code USSD en clair en remplaçant `{code}` par le code marchand
 * et `{amount}` par le montant entier sans espaces ni séparateurs.
 */
export function buildUssdCode(
  ussdTemplate: string | null | undefined,
  merchantCode: string,
  amount: number,
): string | null {
  if (!ussdTemplate || !ussdTemplate.trim()) {
    return null;
  }
  const cleanCode = String(merchantCode).trim();
  const cleanAmount = String(Math.max(0, Math.round(amount))).replace(/\D/g, '');
  return ussdTemplate
    .trim()
    .replace(/\{code\}/g, cleanCode)
    .replace(/\{amount\}/g, cleanAmount);
}

/**
 * Construit le lien `tel:` ouvrant directement le composeur téléphonique Android
 * avec `#` encodé en `%23` et `*` conservé tel quel (§4.1 & §8.3).
 */
export function buildUssdTelHref(ussdCode: string): string {
  const clean = ussdCode.trim().replace(/\s+/g, '');
  const encoded = clean.replace(/#/g, '%23');
  return `tel:${encoded}`;
}

/**
 * Détecte iOS (iPhone, iPad, iPod) où Safari bloque l'ouverture d'un lien `tel:` contenant `*` ou `#` (§4.1).
 */
export function isIosDevice(
  userAgent?: string,
  platform?: string,
  maxTouchPoints?: number,
): boolean {
  const ua =
    userAgent ??
    (typeof navigator !== 'undefined' ? navigator.userAgent : '');
  const plat =
    platform ??
    (typeof navigator !== 'undefined' ? navigator.platform : '');
  const touchPoints =
    maxTouchPoints ??
    (typeof navigator !== 'undefined' ? navigator.maxTouchPoints ?? 0 : 0);

  if (/iPad|iPhone|iPod/i.test(ua)) {
    return true;
  }
  if (plat === 'MacIntel' && touchPoints > 1) {
    return true;
  }
  return false;
}

/**
 * Choisit le comportement du bouton principal de paiement :
 * - `'dial'` sur Android (« Composer le code de paiement » -> `tel:...%23`)
 * - `'copy'` sur iPhone / iPad (« Copier le code de paiement »)
 */
export function resolveUssdActionMode(isIos: boolean): 'dial' | 'copy' {
  return isIos ? 'copy' : 'dial';
}

/**
 * Formate un montant brut sans espaces pour le presse-papiers (« 63000 », §4.1).
 */
export function formatRawAmountForClipboard(amount: number): string {
  return String(Math.max(0, Math.round(amount)));
}
