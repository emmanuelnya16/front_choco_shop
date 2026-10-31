import { useEffect } from 'react';
import { usePwaStore } from '@/pwa/pwaStore';

/**
 * Bloque la proposition de mise à jour de l'application pendant une action en cours
 * (envoi de la preuve, création de la réservation) : M6 §4.7. Le bandeau réapparaît à la fin.
 */
export function useBlockAppUpdate(active: boolean): void {
  useEffect(() => {
    if (!active) return undefined;
    usePwaStore.getState().beginBusy();
    return () => usePwaStore.getState().endBusy();
  }, [active]);
}
