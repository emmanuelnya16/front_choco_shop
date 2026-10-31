/**
 * « 31 octobre 2026 », à l'heure de Douala (M7 §3.3). Le premier du mois s'écrit « 1er ».
 * HYPOTHÈSE: la date de mise à jour est affichée au jour près, sans l'heure.
 */
const updatedAtFormatter = new Intl.DateTimeFormat('fr-FR', {
  day: 'numeric',
  month: 'long',
  year: 'numeric',
  timeZone: 'Africa/Douala',
});

export function formatUpdatedAt(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  return updatedAtFormatter
    .formatToParts(date)
    .map((part) => (part.type === 'day' && part.value === '1' ? '1er' : part.value))
    .join('');
}
