import { useAuthStore } from '@/stores/authStore';
import type { PreparedProofResult } from './prepareProof';

/**
 * Capture de paiement préparée, gardée EN MÉMOIRE SEULEMENT (M6 §6.3) : jamais dans localStorage,
 * IndexedDB ni le cache de l'application (règle M4 §5.3). Elle survit à un aller-retour entre les
 * écrans de l'app (relire le code de paiement, revenir) pendant une coupure, pas à un rechargement.
 * L'aperçu (URL objet) appartient à ce module : il est libéré quand la capture est oubliée.
 */
export interface RememberedProof extends PreparedProofResult {
  fileName: string;
  previewUrl: string;
}

// HYPOTHÈSE: la capture survit à la navigation dans l'app mais pas à un rechargement ni à la
// fermeture : c'est le prix de la règle « jamais sur le disque » (M4 §5.3).
const memory = new Map<string, RememberedProof>();

function key(ref: string): string {
  return ref.trim().toUpperCase();
}

function release(entry: RememberedProof | undefined): void {
  if (entry?.previewUrl) URL.revokeObjectURL(entry.previewUrl);
}

/** Garde la capture préparée pour cette réservation et renvoie son aperçu. */
export function rememberProof(
  ref: string,
  proof: PreparedProofResult & { fileName: string },
): RememberedProof {
  release(memory.get(key(ref)));
  const entry: RememberedProof = { ...proof, previewUrl: URL.createObjectURL(proof.blob) };
  memory.set(key(ref), entry);
  return entry;
}

export function recallProof(ref: string): RememberedProof | null {
  return memory.get(key(ref)) ?? null;
}

/** Capture envoyée ou refusée : elle quitte la mémoire et son aperçu est libéré. */
export function forgetProof(ref: string): void {
  release(memory.get(key(ref)));
  memory.delete(key(ref));
}

// Déconnexion : aucune capture ne reste en mémoire pour le compte suivant
useAuthStore.subscribe((state, previous) => {
  if (!previous.user || state.user) return;
  for (const entry of memory.values()) release(entry);
  memory.clear();
});
