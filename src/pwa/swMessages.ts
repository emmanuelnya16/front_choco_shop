import { useQueryClient, type QueryClient } from '@tanstack/react-query';
import { useEffect, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router';
import { useSeenStore } from '@/features/tracking/seenStore';
import { qk } from '@/lib/api/queryKeys';
import { useToastStore, type ToastState } from '@/stores/toastStore';
import { parsePushPayload } from './pushPayload';
import { isSwToAppMessage, SW_MESSAGES } from './swProtocol';

/**
 * Messages du service worker vers l'app (M6 §7.4) :
 * - PUSH_RECEIVED : les écrans ouverts sont rafraîchis tout de suite ; si aucune notification
 *   système n'a été montrée (app au premier plan), un toast riche la remplace ;
 * - NAVIGATE : clic sur une notification alors que l'app est déjà ouverte.
 */
export interface SwMessageContext {
  queryClient: QueryClient;
  navigate: (url: string) => void;
  showToast: ToastState['show'];
  /** Chemin de la page affichée, sans paramètres ni ancre. */
  currentPath: string;
  pageVisible: boolean;
}

const PUSH_TOAST_DURATION_MS = 6000;

/** Seules les pages de l'app peuvent être ouvertes (jamais une autre origine). */
function isSafeAppPath(url: string): boolean {
  return url.startsWith('/') && !url.startsWith('//');
}

function samePage(currentPath: string, url: string): boolean {
  const normalize = (path: string) => (path.split(/[?#]/)[0] ?? '').replace(/\/+$/, '').toUpperCase() || '/';
  return normalize(currentPath) === normalize(url);
}

/** Traite un message reçu ; renvoie false s'il ne vient pas du service worker de l'app. */
export function handleServiceWorkerMessage(data: unknown, ctx: SwMessageContext): boolean {
  if (!isSwToAppMessage(data)) return false;

  if (data.type === SW_MESSAGES.navigate) {
    if (typeof data.url === 'string' && isSafeAppPath(data.url)) ctx.navigate(data.url);
    return true;
  }
  // État du réseau : traité dès le démarrage par le store réseau (src/pwa/networkStore.ts)
  if (data.type === SW_MESSAGES.networkStatus) return true;

  const payload = parsePushPayload(data.payload);
  if (!payload) return true;

  // Détail (Merci, Paiement, Preuve, suivi) puis préfixe ['reservations'] : liste, résumé, en attente
  if (payload.ref) {
    void ctx.queryClient.invalidateQueries({ queryKey: qk.reservation(payload.ref) });
  }
  void ctx.queryClient.invalidateQueries({ queryKey: qk.reservations() });

  if (data.shownAsNotification || !ctx.pageVisible) return true;

  // Le toast « colis prêt » de M5 ne doit pas doubler celui-ci
  if (payload.type === 'package_ready' && payload.ref) {
    useSeenStore.getState().markPackageToastShown(payload.ref);
  }
  const onTargetPage = samePage(ctx.currentPath, payload.url);
  ctx.showToast({
    message: payload.title,
    subtitle: payload.body,
    ...(payload.type === 'package_ready' && payload.image ? { thumbnail: payload.image } : {}),
    icon: 'bell',
    wrap: true,
    // HYPOTHÈSE: déjà sur la page concernée, elle vient d'être mise à jour : pas de bouton « Voir »
    ...(onTargetPage ? {} : { actionLabel: 'Voir', onAction: () => ctx.navigate(payload.url) }),
    durationMs: PUSH_TOAST_DURATION_MS,
  });
  return true;
}

/**
 * Écoute navigator.serviceWorker (monté une fois dans RootLayout, sous le routeur et le QueryClient).
 * Sans service worker (tests, navigateur ancien) : ne fait rien.
 */
export function useServiceWorkerMessages(): void {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const location = useLocation();
  const showToast = useToastStore((s) => s.show);
  const pathRef = useRef(location.pathname);

  useEffect(() => {
    pathRef.current = location.pathname;
  }, [location.pathname]);

  useEffect(() => {
    if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) return undefined;
    const container = navigator.serviceWorker;
    const onMessage = (event: MessageEvent) => {
      handleServiceWorkerMessage(event.data, {
        queryClient,
        navigate: (url) => {
          void navigate(url);
        },
        showToast,
        currentPath: pathRef.current,
        pageVisible: document.visibilityState === 'visible',
      });
    };
    container.addEventListener('message', onMessage);
    // Les messages arrivés avant l'écoute sont délivrés maintenant
    container.startMessages?.();
    return () => {
      container.removeEventListener('message', onMessage);
    };
  }, [queryClient, navigate, showToast]);
}
