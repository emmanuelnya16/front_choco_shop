/** Identifiant visé par l'ancre de l'adresse (« #delai-de-24-h »), ou chaîne vide. */
export function readHashId(hash: string): string {
  const raw = hash.replace(/^#/, '');
  if (!raw) return '';
  try {
    return decodeURIComponent(raw);
  } catch {
    return raw;
  }
}
