const fcfaFormatter = new Intl.NumberFormat('fr-FR', {
  maximumFractionDigits: 0,
  minimumFractionDigits: 0,
});

/**
 * Formate un montant numérique en Francs CFA, sans aucune espace sécable : espaces fines insécables
 * entre les milliers et espace insécable avant « FCFA » (le montant ne se coupe jamais en fin de ligne).
 * Exemple : formatPrice(45000) -> "45\u202f000\u00a0FCFA"
 */
export function formatPrice(amount: number): string {
  if (!Number.isFinite(amount)) {
    return '0\u00a0FCFA';
  }
  const rounded = Math.round(amount);
  const formattedNumber = fcfaFormatter.format(rounded).replace(/\s/g, '\u202f');
  return `${formattedNumber}\u00a0FCFA`;
}
