import { useEffect, useState } from 'react';
import { useInstallState } from '@/pwa/installService';
import { selectInstallData, shouldShowSuccessInstallCard, useInstallStore } from '@/pwa/installStore';

/**
 * Carte d'installation de la page Merci (M6 §5.2) : décidée à l'arrivée sur la page (première preuve
 * de paiement, pas de refus récent), puis retirée en direct dès que l'application est installée.
 * Sur iPhone sans l'application, elle prend la place de la carte des notifications.
 */
export function useSuccessInstallOffer(reservationRef: string): boolean {
  const state = useInstallState();
  // Données figées à l'arrivée : « Plus tard » ferme la carte sans faire réapparaître la carte iPhone
  const [snapshot] = useState(() => ({ data: selectInstallData(useInstallStore.getState()), now: Date.now() }));

  useEffect(() => {
    // HYPOTHÈSE: la page Merci n'est atteinte qu'après l'envoi d'une preuve ; la première affichée sur
    // ce téléphone désigne donc la « première preuve de paiement ».
    if (reservationRef) useInstallStore.getState().rememberFirstProof(reservationRef);
  }, [reservationRef]);

  return reservationRef !== '' && shouldShowSuccessInstallCard(state, snapshot.data, reservationRef, snapshot.now);
}
