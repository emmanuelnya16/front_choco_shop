/**
 * Défauts de l'application trouvés par les parcours (M7 phase P7). Les tests concernés sont marqués
 * `test.fixme` : ils ne s'exécutent pas tant que le défaut n'est pas corrigé.
 *
 * `E2E_RUN_FIXME=1 npm run e2e` les exécute quand même, pour vérifier une correction.
 */
export const RUN_FIXME = process.env.E2E_RUN_FIXME === '1';

export const DEFECTS = {
  D1:
    'D1 · Navigation annulée à la fermeture d’une feuille : après la connexion ouverte par « Réserver », ' +
    'le client reste sur le panier ; sur ordinateur, « Voir le panier » de l’aperçu du panier ne quitte pas ' +
    'la fiche ; sur téléphone, le filtre de taille choisi dans la feuille n’est pas appliqué à la liste. ' +
    'Cause : src/lib/hooks/overlayHistory.ts est installé au chargement à la demande des feuilles, après ' +
    'createBrowserRouter ; le retour d’historique de la feuille atteint React Router, qui annule la navigation. ' +
    'Correction proposée : importer « @/lib/hooks/overlayHistory » dans src/main.tsx avant « @/app/App ».',
  D2:
    'D2 · Serveur injoignable non signalé sur le catalogue et le panier : les réponses du catalogue servies ' +
    'par le service worker (StaleWhileRevalidate) comptent comme des réponses du serveur et remettent à zéro ' +
    'le compteur d’échecs ; aucun bandeau « Hors connexion », « Réserver » reste actif. ' +
    'Fichiers : src/sw.ts (stratégie catalog), src/lib/api/client.ts, src/pwa/networkStore.ts.',
  D3:
    'D3 · Le champ du code SMS ne reçoit jamais le curseur : le focus est demandé 60 ms après le passage à ' +
    'l’étape « Entrez le code reçu », alors que le champ n’existe pas encore (AnimatePresence mode="wait" ' +
    'attend la sortie de l’étape précédente, 280 ms) ; le focus tombe sur la page. Le client doit toucher ' +
    'le champ : 5 appuis au lieu de 4. Fichier : src/features/auth/components/AuthSheet.tsx (effet « Focus ' +
    'sur le champ OTP »).',
} as const;
