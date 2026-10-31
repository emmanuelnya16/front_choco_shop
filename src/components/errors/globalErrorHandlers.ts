import { isAppOffline, isChunkError, reloadOnceForChunkError } from './chunkReload';
import { reportErrorLater } from './reportLater';

/**
 * Erreurs hors de tout affichage (M7 §5.1) : `error` et `unhandledrejection` de la fenêtre sont
 * signalés sans rien montrer au client. Seule exception : un morceau de code introuvable après
 * une mise à jour recharge la page une seule fois (jamais hors connexion).
 */

// Bruits connus des navigateurs, sans lien avec un défaut de l'app
const IGNORED_MESSAGES = /ResizeObserver loop|^Script error\.?$/i;

function handle(error: unknown, source: string): void {
  if (isChunkError(error)) {
    // Hors connexion, les écrans affichent déjà « hors connexion » : ni rechargement ni remontée
    if (!isAppOffline() && !reloadOnceForChunkError()) {
      reportErrorLater(error, { zone: 'chunk', extra: { source } });
    }
    return;
  }
  // Coupure réseau, délai dépassé ou requête annulée : un état du réseau, pas un défaut de l'app
  const { name, status } = (error ?? {}) as { name?: unknown; status?: unknown };
  if (name === 'AbortError' || (name === 'ApiError' && (status === 0 || status === 408))) return;
  reportErrorLater(error, { zone: 'global', extra: { source } });
}

/** Installe l'écoute des erreurs globales ; renvoie la fonction qui la retire. */
export function installGlobalErrorHandlers(target: Window = window): () => void {
  const onError = (event: ErrorEvent) => {
    if (!IGNORED_MESSAGES.test(event.message ?? '')) handle(event.error ?? event.message, 'error');
  };
  const onRejection = (event: PromiseRejectionEvent) => handle(event.reason, 'unhandledrejection');

  target.addEventListener('error', onError);
  target.addEventListener('unhandledrejection', onRejection);
  return () => {
    target.removeEventListener('error', onError);
    target.removeEventListener('unhandledrejection', onRejection);
  };
}
