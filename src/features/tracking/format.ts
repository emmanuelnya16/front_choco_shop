const shortDate = new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' });
const dayMonth = new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'short' });
const longDayMonth = new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'long' });
const hourMinute = new Intl.DateTimeFormat('fr-FR', { hour: '2-digit', minute: '2-digit' });

function toDate(input: string | Date): Date | null {
  const date = input instanceof Date ? input : new Date(input);
  return Number.isNaN(date.getTime()) ? null : date;
}

/** « 14 h 05 » */
export function formatHour(input: string | Date): string {
  const date = toDate(input);
  if (!date) return '';
  const [hours, minutes] = hourMinute.format(date).split(':');
  return `${Number(hours)} h ${minutes}`;
}

/** « 30 oct. 2026 » */
export function formatShortDate(input: string | Date): string {
  const date = toDate(input);
  return date ? shortDate.format(date) : '';
}

/** « 2 nov. » */
export function formatDayMonth(input: string | Date): string {
  const date = toDate(input);
  return date ? dayMonth.format(date) : '';
}

/** « 30 oct. · 14 h 05 » (dates de la frise) */
export function formatStepDateTime(input: string | Date): string {
  const date = toDate(input);
  return date ? `${dayMonth.format(date)} · ${formatHour(date)}` : '';
}

/** « le 30 octobre à 14 h 05 » (lecteurs d'écran) */
export function formatSpokenDateTime(input: string | Date): string {
  const date = toDate(input);
  return date ? `le ${longDayMonth.format(date)} à ${formatHour(date)}` : '';
}

/** « 1ᵉʳ nov. à 16 h 20 » */
export function formatPackedAt(input: string | Date): string {
  const date = toDate(input);
  if (!date) return '';
  const day = date.getDate() === 1 ? '1ᵉʳ' : String(date.getDate());
  const month = dayMonth.format(date).replace(/^\d+\s/, '');
  return `${day} ${month} à ${formatHour(date)}`;
}

/** « 3 articles » / « 1 article » */
export function formatItemsCount(count: number): string {
  return `${count} article${count > 1 ? 's' : ''}`;
}
