/**
 * Détection indicative de l'opérateur mobile camerounais (Orange Cameroun / MTN Cameroon)
 * à partir des 3 premiers chiffres (6XX) d'un numéro national à 9 chiffres.
 *
 * // HYPOTHÈSE: Table des préfixes indicative (la portabilité ou les nouvelles tranches ARTP
 * peuvent exister), jamais bloquante pour la validation ni pour le choix de l'opérateur de paiement.
 */

export type CmMobileOperator = 'orange' | 'mtn';

const ORANGE_PREFIXES = new Set([
  '655',
  '656',
  '657',
  '658',
  '659',
  '685',
  '686',
  '687',
  '688',
  '689',
  '690',
  '691',
  '692',
  '693',
  '694',
  '695',
  '696',
  '697',
  '698',
  '699',
]);

const MTN_PREFIXES = new Set([
  '650',
  '651',
  '652',
  '653',
  '654',
  '670',
  '671',
  '672',
  '673',
  '674',
  '675',
  '676',
  '677',
  '678',
  '679',
  '680',
  '681',
  '682',
  '683',
  '684',
]);

/**
 * Extrait les chiffres nationaux (sans l'indicatif +237 / 00237 / 237) d'une saisie libre.
 */
export function extractCmNationalDigits(raw: string): string {
  if (typeof raw !== 'string') return '';
  let digits = raw.replace(/\D/g, '');
  if (digits.startsWith('00237')) {
    digits = digits.slice(5);
  } else if (digits.startsWith('237') && digits.length > 9) {
    digits = digits.slice(3);
  }
  return digits.slice(0, 9);
}

/**
 * Détecte l'opérateur mobile dès que 3 chiffres commençant par 6 sont saisis (§5.2).
 */
export function detectCmOperator(input: string): CmMobileOperator | null {
  const digits = extractCmNationalDigits(input);
  if (digits.length < 3) return null;
  const prefix = digits.slice(0, 3);
  if (ORANGE_PREFIXES.has(prefix)) return 'orange';
  if (MTN_PREFIXES.has(prefix)) return 'mtn';
  return null;
}

export function getOperatorLabel(operator: CmMobileOperator | null): string | null {
  if (operator === 'orange') return 'Orange';
  if (operator === 'mtn') return 'MTN';
  return null;
}
