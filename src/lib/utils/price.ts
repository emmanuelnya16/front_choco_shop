const fcfaFormatter = new Intl.NumberFormat('fr-FR', {
  maximumFractionDigits: 0,
  minimumFractionDigits: 0,
});

/**
 * Formate un montant numérique en Francs CFA avec espaces insécables fines.
 * Exemple : formatPrice(45000) -> "45\u202f000 FCFA"
 */
export function formatPrice(amount: number): string {
  if (!Number.isFinite(amount)) {
    return '0 FCFA';
  }
  const rounded = Math.round(amount);
  const formattedNumber = fcfaFormatter.format(rounded).replace(/\s/g, '\u202f');
  return `${formattedNumber} FCFA`;
}
