/**
 * Utilitaires pour les numéros de téléphone mobiles camerounais (+237 6XX XX XX XX).
 */

function extractNineDigits(raw: string): string | null {
  if (typeof raw !== 'string') {
    return null;
  }
  const cleaned = raw.replace(/[\s.\-()]/g, '');

  let digits = cleaned;
  if (digits.startsWith('+237')) {
    digits = digits.slice(4);
  } else if (digits.startsWith('00237')) {
    digits = digits.slice(5);
  } else if (digits.startsWith('237') && digits.length === 12) {
    digits = digits.slice(3);
  }

  if (!/^6\d{8}$/.test(digits)) {
    return null;
  }

  return digits;
}

export function isValidCmPhone(input: string): boolean {
  return extractNineDigits(input) !== null;
}

export function normalizeCmPhone(input: string): string {
  const digits = extractNineDigits(input);
  if (!digits) {
    throw new Error(`Numéro de téléphone camerounais invalide : "${input}"`);
  }
  return `+237${digits}`;
}

export function formatCmPhone(input: string): string {
  const digits = extractNineDigits(input);
  if (!digits) {
    return input.trim();
  }
  return `${digits.slice(0, 3)} ${digits.slice(3, 5)} ${digits.slice(5, 7)} ${digits.slice(7, 9)}`;
}

/**
 * Nettoie une saisie ou un collage libre (+237 6..., 00237..., espaces, tirets)
 * et retourne jusqu'à 9 chiffres nationaux.
 */
export function cleanCmPhoneDigits(raw: string): string {
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
 * Formate en direct la saisie d'un numéro camerounais sous la forme « 6XX XX XX XX » (§5.2).
 */
export function formatCmPhoneInput(raw: string): string {
  const digits = cleanCmPhoneDigits(raw);
  if (digits.length <= 3) return digits;
  if (digits.length <= 5) return `${digits.slice(0, 3)} ${digits.slice(3)}`;
  if (digits.length <= 7) {
    return `${digits.slice(0, 3)} ${digits.slice(3, 5)} ${digits.slice(5)}`;
  }
  return `${digits.slice(0, 3)} ${digits.slice(3, 5)} ${digits.slice(5, 7)} ${digits.slice(7, 9)}`;
}
