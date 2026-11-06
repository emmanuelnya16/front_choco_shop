const shortDate = new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' });
const dayMonth = new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'short' });
const longDayMonth = new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'long' });
const hourMinute = new Intl.DateTimeFormat('fr-FR', { hour: '2-digit', minute: '2-digit' });

/** Espace insécable : le jour, le mois et l'heure ne sont jamais coupés en fin de ligne. */
const NBSP = '\u00A0';

function toDate(input: string | Date): Date | null {
  const date = input instanceof Date ? input : new Date(input);
  return Number.isNaN(date.getTime()) ? null : date;
}

/**
 * Date affichée : espaces insécables et « 1ᵉʳ » pour le premier du mois (typographie française).
 * `ordinal` : « 1ᵉʳ » à l'écran, « 1er » pour les lecteurs d'écran.
 */
function typeset(formatted: string, date: Date, ordinal: '1ᵉʳ' | '1er' = '1ᵉʳ'): string {
  const text = formatted.replace(/\s/g, NBSP);
  return date.getDate() === 1 ? text.replace(/^1(?=\u00A0)/, ordinal) : text;
}

/** « 14 h 05 » */
export function formatHour(input: string | Date): string {
  const date = toDate(input);
  if (!date) return '';
  const [hours, minutes] = hourMinute.format(date).split(':');
  return `${Number(hours)}${NBSP}h${NBSP}${minutes}`;
}

/** « 30 oct. 2026 » */
export function formatShortDate(input: string | Date): string {
  const date = toDate(input);
  return date ? typeset(shortDate.format(date), date) : '';
}

/** « 2 nov. », « 1ᵉʳ nov. » */
export function formatDayMonth(input: string | Date): string {
  const date = toDate(input);
  return date ? typeset(dayMonth.format(date), date) : '';
}

/** « 30 oct. · 14 h 05 » (dates de la frise) */
export function formatStepDateTime(input: string | Date): string {
  const date = toDate(input);
  return date ? `${formatDayMonth(date)} · ${formatHour(date)}` : '';
}

/** « le 30 octobre à 14 h 05 » (lecteurs d'écran) */
export function formatSpokenDateTime(input: string | Date): string {
  const date = toDate(input);
  return date ? `le ${typeset(longDayMonth.format(date), date, '1er')} à ${formatHour(date)}` : '';
}

/** « 1ᵉʳ nov. à 16 h 20 » */
export function formatPackedAt(input: string | Date): string {
  const date = toDate(input);
  return date ? `${formatDayMonth(date)} à ${formatHour(date)}` : '';
}

/** « 3 articles » / « 1 article » */
export function formatItemsCount(count: number): string {
  return `${count}${NBSP}article${count > 1 ? 's' : ''}`;
}
