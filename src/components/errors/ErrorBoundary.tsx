import { Component, lazy, Suspense, type ReactNode } from 'react';
import { canAutoReload, isAppOffline, isChunkError, pageReload, reloadOnceForChunkError } from './chunkReload';
import type { ErrorScreensProps } from './ErrorScreens';
import { reportErrorLater } from './reportLater';

/**
 * - `shell` : toute l'app (src/main.tsx) ;
 * - `route` : erreur remontée par le routeur (RootLayout, RouterErrorBoundary) ;
 * - `page` : le contenu de la page, sous l'en-tête (RootLayout), réinitialisé au changement de page ;
 * - `section` : une section de l'accueil, qui se masque ou affiche un encart discret.
 */
export type ErrorBoundaryVariant = 'shell' | 'route' | 'page' | 'section';

/**
 * - `reloading` : morceau de code introuvable après une mise à jour, la page se recharge (une fois) ;
 * - `offline` : morceau introuvable hors connexion, contenu « hors connexion » (M6 §6.5) ;
 * - `error` : écran d'erreur.
 */
export type ErrorResolution = 'offline' | 'reloading' | 'error';

export interface ErrorFallbackProps {
  error: unknown;
  /** Réaffiche le contenu (bouton « Réessayer »). */
  reset: () => void;
  variant: ErrorBoundaryVariant;
  resolution: ErrorResolution;
}

export interface ErrorBoundaryProps {
  variant: ErrorBoundaryVariant;
  /** Zone signalée avec l'erreur (ex. « home:new-arrivals ») ; par défaut, la variante. */
  zone?: string;
  /** La zone en erreur est réinitialisée quand cette valeur change (chemin de la page). */
  resetKey?: unknown;
  /** Section seulement : masquée en cas d'erreur au lieu d'afficher l'encart. */
  hideOnError?: boolean;
  fallback?: (props: ErrorFallbackProps) => ReactNode;
  children: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: unknown;
  resetKey: unknown;
  resolution: ErrorResolution;
}

// Écrans chargés à la demande : ils n'alourdissent pas le JavaScript de démarrage (budget M6/M7)
const LazyErrorScreens = lazy(() => import('./ErrorScreens'));

/** Si le contenu ne peut pas se charger (réseau absent), un repli minimal s'affiche (ou rien). */
class LoadGuard extends Component<{ failureText?: string; children: ReactNode }, { failed?: boolean }> {
  state: { failed?: boolean } = {};

  static getDerivedStateFromError(): { failed: boolean } {
    return { failed: true };
  }

  render(): ReactNode {
    const { failureText, children } = this.props;
    if (!this.state.failed) return children;
    if (!failureText) return null;
    return (
      <p role="alert" className="px-page py-16 text-center text-body text-ink">
        {failureText}{' '}
        <button type="button" className="min-h-[44px] font-semibold underline" onClick={() => pageReload.reload()}>
          Recharger
        </button>
      </p>
    );
  }
}

/**
 * Contenu chargé à la demande (écrans d'erreur, contenu « hors connexion ») : rien de plus dans le
 * JavaScript de démarrage. HYPOTHÈSE: en production, le service worker a déjà enregistré ces
 * morceaux ; sinon, `failureText` et « Recharger » s'affichent.
 */
export function SafeLazy({ failureText, children }: { failureText?: string; children: ReactNode }) {
  return (
    <LoadGuard failureText={failureText}>
      <Suspense fallback={null}>{children}</Suspense>
    </LoadGuard>
  );
}

/**
 * Écran d'erreur générale (« Oups, quelque chose s'est mal passé », « Recharger »,
 * « Revenir à l'accueil ») ou encart de section, chargés à la demande.
 */
export function ErrorScreen(props: ErrorScreensProps) {
  const failureText =
    props.kind === 'section'
      ? undefined
      : props.offline
        ? 'Vous êtes hors connexion.'
        : 'Oups, quelque chose s’est mal passé.';
  return (
    <SafeLazy failureText={failureText}>
      <LazyErrorScreens {...props} />
    </SafeLazy>
  );
}

function defaultFallback({ resolution }: ErrorFallbackProps): ReactNode {
  return resolution === 'reloading' ? (
    <div role="status" aria-label="Chargement de la nouvelle version" className="min-h-dvh" />
  ) : (
    <ErrorScreen fullScreen offline={resolution === 'offline'} />
  );
}

/**
 * Zone d'erreur réutilisable (M7 §5.1) : une erreur d'affichage reste contenue dans sa zone,
 * est signalée (src/lib/monitoring.ts) et remplacée par un repli adapté à la variante.
 * Un morceau de code introuvable recharge la page une seule fois (jamais hors connexion).
 */
export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = {
    hasError: false,
    error: null,
    resetKey: this.props.resetKey,
    resolution: 'error',
  };

  static getDerivedStateFromError(error: unknown): Partial<ErrorBoundaryState> {
    // Lectures seulement : le rechargement part de componentDidCatch
    const chunk = isChunkError(error);
    const resolution: ErrorResolution =
      chunk && isAppOffline() ? 'offline' : chunk && canAutoReload() ? 'reloading' : 'error';
    return { hasError: true, error, resolution };
  }

  static getDerivedStateFromProps(
    props: ErrorBoundaryProps,
    state: ErrorBoundaryState,
  ): Partial<ErrorBoundaryState> | null {
    // HYPOTHÈSE: réinitialisation par `resetKey` plutôt que `key={pathname}` : même effet pour une
    // zone en erreur, sans remonter chaque page à chaque navigation (Explorer entre deux catégories).
    return Object.is(props.resetKey, state.resetKey)
      ? null
      : { resetKey: props.resetKey, hasError: false, resolution: 'error' };
  }

  componentDidCatch(error: unknown): void {
    const { variant, zone = variant } = this.props;
    const { resolution } = this.state;
    // Hors connexion : contenu « hors connexion », ni rechargement ni remontée
    if (resolution === 'offline') return;
    // Une section ne recharge jamais la page : elle affiche son encart
    if (resolution === 'reloading' && variant !== 'section') {
      if (reloadOnceForChunkError()) return;
      this.setState({ resolution: 'error' });
    }
    reportErrorLater(error, { zone: isChunkError(error) ? 'chunk' : zone, extra: { variant } });
  }

  reset = (): void => {
    this.setState({ hasError: false, resolution: 'error' });
  };

  render(): ReactNode {
    const { children, fallback, hideOnError, variant } = this.props;
    const { hasError, error, resolution } = this.state;
    if (!hasError) return children;
    if (fallback || variant !== 'section') {
      return (fallback ?? defaultFallback)({ error, reset: this.reset, variant, resolution });
    }
    return hideOnError ? null : <ErrorScreen kind="section" onRetry={this.reset} />;
  }
}
