/**
 * Demande au navigateur de ne pas effacer les données de l'app en cas de manque d'espace
 * (M6 §6.4) : appelée après la première réservation créée (l'installation l'appelle aussi).
 * Sans effet si l'API n'existe pas ; ne lève jamais d'erreur.
 */
export async function requestPersistentStorage(): Promise<boolean> {
  try {
    if (typeof navigator === 'undefined' || !navigator.storage || !('persist' in navigator.storage)) {
      return false;
    }
    if (await navigator.storage.persisted()) return true;
    return await navigator.storage.persist();
  } catch {
    return false;
  }
}
