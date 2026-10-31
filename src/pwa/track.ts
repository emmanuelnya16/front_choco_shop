/**
 * Mesure d'usage (M6 §5.5) : point d'entrée unique, volontairement vide pour l'instant.
 * Aucun outil de mesure n'est branché : en développement, chaque évènement est tracé dans la console ;
 * un futur outil se branchera avec `setTrackSink` sans toucher aux appels.
 */
export type TrackEvent =
  /** Une invitation à installer l'application est affichée (feuille ou carte). */
  | 'install_prompt_shown'
  /** Le client accepte l'installation (fenêtre du navigateur ou instructions iPhone suivies). */
  | 'install_prompt_accepted'
  /** Le client refuse (« Plus tard », fermeture, ou refus dans la fenêtre du navigateur). */
  | 'install_prompt_dismissed'
  /** Le navigateur confirme l'installation (évènement appinstalled). */
  | 'app_installed'
  /** Lancement depuis l'icône de l'écran d'accueil ou un raccourci (?source=pwa, ?source=pwa-shortcut). */
  | 'app_opened_from_home_screen';

export type TrackProps = Record<string, string | number | boolean | null | undefined>;

type TrackSink = (event: TrackEvent, props?: TrackProps) => void;

let sink: TrackSink | null = null;

/** Branche (ou retire avec `null`) l'outil de mesure qui recevra les évènements. */
export function setTrackSink(next: TrackSink | null): void {
  sink = next;
}

/** Enregistre un évènement d'usage. Ne lève jamais d'erreur : la mesure ne doit rien casser. */
export function track(event: TrackEvent, props?: TrackProps): void {
  if (import.meta.env.DEV && import.meta.env.MODE !== 'test') {
    // eslint-disable-next-line no-console -- trace de mesure, en développement uniquement
    console.info('[mesure]', event, props ?? {});
  }
  // HYPOTHÈSE: aucun outil de mesure choisi par le client ; rien ne part du téléphone tant qu'il n'est pas branché.
  try {
    sink?.(event, props);
  } catch {
    // Un outil de mesure défaillant ne doit pas gêner le client
  }
}
