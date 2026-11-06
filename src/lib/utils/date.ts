const dateFormatter = new Intl.DateTimeFormat('fr-FR', {
  day: 'numeric',
  month: 'short',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
});

const relativeFormatter = new Intl.RelativeTimeFormat('fr', {
  numeric: 'auto',
});

/**
 * Formate une date ISO ou Date en français lisible (ex: "29 oct. 2026, 14:30").
 */
export function formatDate(input: string | number | Date): string {
  const date = input instanceof Date ? input : new Date(input);
  if (Number.isNaN(date.getTime())) {
    return '';
  }
  return dateFormatter.format(date);
}

/**
 * Formate l'écart relatif par rapport à maintenant (ex: "il y a 2 heures").
 */
export function formatRelative(
  input: string | number | Date,
  baseDate: Date = new Date(),
): string {
  const date = input instanceof Date ? input : new Date(input);
  if (Number.isNaN(date.getTime())) {
    return '';
  }

  const diffSeconds = Math.round((date.getTime() - baseDate.getTime()) / 1000);
  const absSeconds = Math.abs(diffSeconds);

  if (absSeconds < 60) {
    return relativeFormatter.format(diffSeconds, 'second');
  }
  const diffMinutes = Math.round(diffSeconds / 60);
  if (Math.abs(diffMinutes) < 60) {
    return relativeFormatter.format(diffMinutes, 'minute');
  }
  const diffHours = Math.round(diffMinutes / 60);
  if (Math.abs(diffHours) < 24) {
    return relativeFormatter.format(diffHours, 'hour');
  }
  const diffDays = Math.round(diffHours / 24);
  return relativeFormatter.format(diffDays, 'day');
}

/**
 * Formate une durée en millisecondes sous forme de compte à rebours (ex: "23 h 58 min").
 */
export function formatCountdown(ms: number): string {
  if (!Number.isFinite(ms) || ms <= 0) {
    return '00 h 00 min';
  }
  const totalMinutes = Math.floor(ms / 60_000);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;

  const paddedHours = String(hours).padStart(2, '0');
  const paddedMinutes = String(minutes).padStart(2, '0');
  return `${paddedHours} h ${paddedMinutes} min`;
}

/**
 * Horaires au format de la charte : « Lun – Sam · 9 h – 19 h 30 » (« 09h00 » → « 9 h »,
 * « 19h30 » → « 19 h 30 », « à » ou trait d'union entre deux heures → tiret demi-cadratin),
 * avec des espaces insécables autour de « h » (l'horaire ne se coupe pas en fin de ligne).
 */
export function formatOpeningHours(raw: string): string {
  const nbsp = String.fromCharCode(0xa0);
  const normalized = raw.replace(/(\d{1,2})\s*h(?:\s*(\d{2}))?/gi, (_match, h: string, min?: string) => {
    const hours = String(Number(h));
    return min && min !== '00' ? [hours, 'h', min].join(nbsp) : [hours, 'h'].join(nbsp);
  });
  // « 9 h à 19 h 30 » → « 9 h – 19 h 30 » (l'espace insécable compte comme un blanc)
  return normalized.replace(/(h(?:\s\d{2})?)\s+(?:à|-|–)\s+(\d)/g, '$1 – $2');
}
