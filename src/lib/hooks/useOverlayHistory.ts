import { useEffect, useRef } from 'react';
import { openOverlay } from './overlayHistory';

/**
 * Surcouche (feuille, visionneuse, tiroir, menu) liée à l'historique (M6 §8) : une entrée est
 * ajoutée à l'ouverture, la touche retour appelle `onClose`, et une fermeture par l'interface
 * retire l'entrée. Sans routeur : utilisable partout, y compris dans les tests de Sheet.
 */
export function useOverlayHistory(open: boolean, onClose: () => void): void {
  const onCloseRef = useRef(onClose);

  useEffect(() => {
    onCloseRef.current = onClose;
  });

  useEffect(() => {
    if (!open) return undefined;
    const handle = openOverlay(() => onCloseRef.current());
    return () => handle.release();
  }, [open]);
}
