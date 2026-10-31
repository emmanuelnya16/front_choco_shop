import { useCallback, useRef, useState } from 'react';
import { useInstallStore, type InstallState, type InstallSurface } from '@/pwa/installStore';
import { getInstallState, promptInstall, useInstallState, type InstallOutcome } from '@/pwa/installService';
import { track } from '@/pwa/track';

/** Feuille à ouvrir : installation directe, instructions iPhone, ou courte explication. */
export type InstallSheetKind = 'install' | 'ios' | 'help';

export function sheetKindFor(state: InstallState): InstallSheetKind | null {
  switch (state) {
    case 'available':
      return 'install';
    case 'ios':
      return 'ios';
    case 'unsupported':
      return 'help';
    default:
      return null;
  }
}

export interface InstallController {
  surface: InstallSurface;
  state: InstallState;
  /** Faux une fois l'application installée : tous les points d'entrée disparaissent. */
  canOffer: boolean;
  /** Feuille affichée (jamais une fois l'application installée). */
  sheet: InstallSheetKind | null;
  installing: boolean;
  /** Ouvre la feuille adaptée à l'appareil. */
  open: () => void;
  /** « Plus tard », fermeture de la feuille : refus (14 jours sans invitation automatique). */
  dismiss: () => void;
  /** « J'ai compris » des instructions : fermeture sans refus. */
  acknowledge: () => void;
  /** « Installer » : fenêtre du navigateur, puis fermeture de la feuille. */
  install: () => Promise<InstallOutcome>;
}

/**
 * Contrôleur d'installation d'un point d'entrée (accueil, profil, Merci, feuille automatique) :
 * ouvre la bonne feuille selon l'état et enregistre les invitations, refus et acceptations.
 */
export function useInstallController(surface: InstallSurface): InstallController {
  const state = useInstallState();
  const [openSheet, setOpenSheet] = useState<InstallSheetKind | null>(null);
  const [installing, setInstalling] = useState(false);
  const openSheetRef = useRef<InstallSheetKind | null>(null);

  const show = useCallback((kind: InstallSheetKind | null) => {
    openSheetRef.current = kind;
    setOpenSheet(kind);
  }, []);

  const open = useCallback(() => {
    const kind = sheetKindFor(getInstallState());
    if (!kind) return;
    if (kind !== 'help') {
      useInstallStore.getState().markShown(surface);
      track('install_prompt_shown', { surface, kind });
    }
    show(kind);
  }, [show, surface]);

  const dismiss = useCallback(() => {
    const kind = openSheetRef.current;
    if (!kind) return;
    if (kind !== 'help') {
      // HYPOTHÈSE: fermer la feuille sans installer (croix, fond, glissement) vaut « Plus tard ».
      useInstallStore.getState().markDismissed();
      track('install_prompt_dismissed', { surface, kind, via: 'later' });
    }
    show(null);
  }, [show, surface]);

  const acknowledge = useCallback(() => {
    const kind = openSheetRef.current;
    if (!kind) return;
    // HYPOTHÈSE: sur iPhone, l'ajout se fait hors de la page : « J'ai compris » compte comme une acceptation.
    if (kind === 'ios') track('install_prompt_accepted', { surface, kind, via: 'instructions' });
    show(null);
  }, [show, surface]);

  const install = useCallback(async () => {
    setInstalling(true);
    const outcome = await promptInstall(surface);
    setInstalling(false);
    // Fenêtre du navigateur indisponible (déjà utilisée) : explication de l'installation par le menu
    show(outcome === 'unavailable' ? 'help' : null);
    return outcome;
  }, [show, surface]);

  return {
    surface,
    state,
    canOffer: state !== 'installed',
    sheet: state === 'installed' ? null : openSheet,
    installing,
    open,
    dismiss,
    acknowledge,
    install,
  };
}
