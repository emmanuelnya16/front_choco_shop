import { useEffect, useState } from 'react';
import { getInstallState } from '@/pwa/installService';
import {
  AUTO_SHEET_DELAY_MS,
  selectInstallData,
  shouldAutoOpenInstallSheet,
  useInstallStore,
} from '@/pwa/installStore';
import { InstallSheets } from './InstallSheets';
import { useInstallController } from './useInstallController';

const RETRY_MS = 2000;

function isEligibleNow(): boolean {
  return shouldAutoOpenInstallSheet(getInstallState(), selectInstallData(useInstallStore.getState()), Date.now());
}

/**
 * Feuille d'installation automatique de deuxième visite (M6 §5.2), montée sur l'accueil :
 * une seule fois, 8 s après l'arrivée, jamais au premier chargement ni dans les 14 jours après un refus.
 */
export function InstallAutoPrompt() {
  const controller = useInstallController('auto-sheet');
  const { state, open } = controller;
  const [arrivedAt] = useState(() => Date.now());

  useEffect(() => {
    if (!isEligibleNow()) return undefined;

    let timer = 0;
    const attempt = () => {
      if (!isEligibleNow()) return;
      // Une autre fenêtre est ouverte (connexion, tailles…) ou l'app est en arrière-plan : on patiente
      if (document.visibilityState !== 'visible' || document.querySelector('[role="dialog"][aria-modal="true"]')) {
        timer = window.setTimeout(attempt, RETRY_MS);
        return;
      }
      open();
    };
    // L'état peut devenir « available » quelques secondes après l'arrivée : le délai part de l'arrivée
    timer = window.setTimeout(attempt, Math.max(0, AUTO_SHEET_DELAY_MS - (Date.now() - arrivedAt)));
    return () => window.clearTimeout(timer);
  }, [state, open, arrivedAt]);

  return <InstallSheets controller={controller} />;
}
