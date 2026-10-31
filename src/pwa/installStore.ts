import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import { safeStorage } from '@/lib/utils/storage';

/** État d'installation de l'application sur cet appareil (M6 §5.1). */
export type InstallState = 'installed' | 'available' | 'ios' | 'unsupported';

/** Endroits où l'installation est proposée (M6 §5.2). */
export type InstallSurface = 'auto-sheet' | 'home' | 'profile' | 'success';

const MINUTE_MS = 60 * 1000;
const DAY_MS = 24 * 60 * MINUTE_MS;

// HYPOTHÈSE: une « visite » est un chargement de l'application au moins 30 minutes après la dernière
// visite comptée ; les rechargements et retours rapprochés font partie de la même visite.
export const VISIT_GAP_MS = 30 * MINUTE_MS;
/** La feuille automatique attend une visite au moins un jour après la première (§5.2). */
export const SECOND_VISIT_MIN_DELAY_MS = DAY_MS;
/** Après « Plus tard », plus aucune invitation automatique pendant 14 jours (§5.2). */
export const DISMISS_SNOOZE_MS = 14 * DAY_MS;
/** Délai entre l'arrivée sur l'accueil et la feuille automatique (§5.2). */
export const AUTO_SHEET_DELAY_MS = 8000;

/** Données de visite et d'invitation, conservées sur le téléphone. */
export interface InstallVisitData {
  visitCount: number;
  firstVisitAt: number | null;
  /** Date de la dernière visite comptée (pas du dernier rechargement). */
  lastVisitAt: number | null;
  /** Dernier refus (« Plus tard », fermeture de la feuille ou refus dans la fenêtre du navigateur). */
  lastDismissedAt: number | null;
  /** La feuille automatique de deuxième visite a été montrée (une seule fois, §5.2). */
  autoSheetShownAt: number | null;
  /** Nombre d'invitations déjà montrées, par endroit. */
  shownCount: Partial<Record<InstallSurface, number>>;
  /** Réservation de la toute première preuve de paiement : seule sa page « Merci » propose l'installation. */
  firstProofRef: string | null;
  /** Installation confirmée par le navigateur (appinstalled) sur cet appareil. */
  installedAt: number | null;
}

export const INITIAL_INSTALL_DATA: InstallVisitData = {
  visitCount: 0,
  firstVisitAt: null,
  lastVisitAt: null,
  lastDismissedAt: null,
  autoSheetShownAt: null,
  shownCount: {},
  firstProofRef: null,
  installedAt: null,
};

// ---------------------------------------------------------------------------
// Règles (§5.2), en fonctions pures
// ---------------------------------------------------------------------------

/** Compte la visite en cours si la précédente date d'au moins 30 minutes. */
export function nextVisitData(data: InstallVisitData, now: number): InstallVisitData {
  if (data.lastVisitAt === null || data.visitCount === 0) {
    return { ...data, visitCount: 1, firstVisitAt: data.firstVisitAt ?? now, lastVisitAt: now };
  }
  if (now - data.lastVisitAt < VISIT_GAP_MS) return data;
  return { ...data, visitCount: data.visitCount + 1, lastVisitAt: now };
}

/** Premier chargement de l'application sur ce téléphone : jamais d'invitation automatique. */
export function isFirstVisit(data: InstallVisitData): boolean {
  return data.visitCount <= 1;
}

/** Un refus de moins de 14 jours bloque les invitations automatiques (pas les boutons accueil et profil). */
export function isInstallSnoozed(data: InstallVisitData, now: number): boolean {
  return data.lastDismissedAt !== null && now - data.lastDismissedAt < DISMISS_SNOOZE_MS;
}

/** L'installation peut être proposée (tout est masqué une fois l'application installée). */
export function canOfferInstall(state: InstallState): boolean {
  return state !== 'installed';
}

/**
 * Feuille automatique de deuxième visite : une seule fois, à une visite au moins un jour après la
 * première, sauf refus récent, seulement si l'installation est réellement possible.
 */
export function shouldAutoOpenInstallSheet(state: InstallState, data: InstallVisitData, now: number): boolean {
  if (state !== 'available' && state !== 'ios') return false;
  if (isFirstVisit(data) || data.firstVisitAt === null) return false;
  // HYPOTHÈSE: « deuxième visite » = la première visite de retour au moins 1 jour après la première ;
  // si le client revient d'abord le jour même, la feuille attend sa visite du lendemain.
  if (now - data.firstVisitAt < SECOND_VISIT_MIN_DELAY_MS) return false;
  if (data.autoSheetShownAt !== null) return false;
  return !isInstallSnoozed(data, now);
}

/**
 * Carte « Suivez votre commande depuis votre écran d'accueil » de la page Merci : uniquement pour la
 * toute première preuve de paiement, quand l'application peut être installée (directement, ou par le
 * menu Partager sur iPhone, où elle remplace la carte des notifications).
 */
export function shouldShowSuccessInstallCard(
  state: InstallState,
  data: InstallVisitData,
  reservationRef: string,
  now: number,
): boolean {
  if (state !== 'available' && state !== 'ios') return false;
  if (data.firstProofRef !== null && data.firstProofRef !== reservationRef) return false;
  // HYPOTHÈSE: « jamais au premier chargement » vise l'arrivée sur le site ; la page Merci vient après
  // une réservation et une preuve envoyées, elle peut donc proposer l'installation dès la première visite.
  return !isInstallSnoozed(data, now);
}

// ---------------------------------------------------------------------------
// Store persistant
// ---------------------------------------------------------------------------

interface InstallStoreState extends InstallVisitData {
  /** Compte la visite au démarrage ; renvoie vrai si une nouvelle visite a été comptée. */
  recordVisit: (now?: number) => boolean;
  markShown: (surface: InstallSurface, now?: number) => void;
  markDismissed: (now?: number) => void;
  /** Retient la réservation de la première preuve de paiement (sans effet ensuite). */
  rememberFirstProof: (reservationRef: string) => void;
  markInstalled: (now?: number) => void;
  /** Le navigateur propose de nouveau l'installation : l'application a été désinstallée depuis. */
  clearInstalled: () => void;
  reset: () => void;
}

export const useInstallStore = create<InstallStoreState>()(
  persist(
    (set, get) => ({
      ...INITIAL_INSTALL_DATA,
      recordVisit: (now = Date.now()) => {
        const current = get();
        const next = nextVisitData(current, now);
        if (next === current) return false;
        set({ visitCount: next.visitCount, firstVisitAt: next.firstVisitAt, lastVisitAt: next.lastVisitAt });
        return true;
      },
      markShown: (surface, now = Date.now()) =>
        set((s) => ({
          shownCount: { ...s.shownCount, [surface]: (s.shownCount[surface] ?? 0) + 1 },
          autoSheetShownAt: surface === 'auto-sheet' ? now : s.autoSheetShownAt,
        })),
      markDismissed: (now = Date.now()) => set({ lastDismissedAt: now }),
      rememberFirstProof: (reservationRef) => {
        if (!reservationRef || get().firstProofRef !== null) return;
        set({ firstProofRef: reservationRef });
      },
      markInstalled: (now = Date.now()) => set({ installedAt: now }),
      clearInstalled: () => set({ installedAt: null }),
      reset: () => set({ ...INITIAL_INSTALL_DATA }),
    }),
    {
      name: 'drchoco-install',
      version: 1,
      storage: createJSONStorage(() => safeStorage),
      partialize: (s): InstallVisitData => ({
        visitCount: s.visitCount,
        firstVisitAt: s.firstVisitAt,
        lastVisitAt: s.lastVisitAt,
        lastDismissedAt: s.lastDismissedAt,
        autoSheetShownAt: s.autoSheetShownAt,
        shownCount: s.shownCount,
        firstProofRef: s.firstProofRef,
        installedAt: s.installedAt,
      }),
    },
  ),
);

/** Données de visite seules (pour les règles pures). */
export function selectInstallData(s: InstallVisitData): InstallVisitData {
  return {
    visitCount: s.visitCount,
    firstVisitAt: s.firstVisitAt,
    lastVisitAt: s.lastVisitAt,
    lastDismissedAt: s.lastDismissedAt,
    autoSheetShownAt: s.autoSheetShownAt,
    shownCount: s.shownCount,
    firstProofRef: s.firstProofRef,
    installedAt: s.installedAt,
  };
}
