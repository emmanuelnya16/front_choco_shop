import { useQueryClient } from '@tanstack/react-query';
import { AnimatePresence, useMotionValueEvent, useScroll } from 'motion/react';
import * as m from 'motion/react-m';
import { Wifi, WifiOff } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { useLocation } from 'react-router';
import { cn } from '@/lib/utils/cn';
import { duration, ease } from '@/motion/tokens';
import { useReducedMotionPref } from '@/motion/useReducedMotionPref';
import { useNetworkStore } from '@/pwa/networkStore';
import { retryNetwork } from './offlineAvailability';

/** Durée d'affichage de « Connexion rétablie » avant disparition. */
// HYPOTHÈSE: « brièvement » (§6.2) = 2,2 s, assez pour lire deux mots sans gêner.
const RECOVERED_VISIBLE_MS = 2200;
/** Hors connexion détecté par les requêtes alors que le navigateur se dit en ligne : vérification régulière. */
// HYPOTHÈSE: une vérification toutes les 30 s suffit (le client peut aussi appuyer sur « Réessayer »).
const AUTO_RETRY_MS = 30_000;
/** Hauteur de la bande (h-8), exposée aux écrans qui ont des éléments fixes en haut (fiche produit). */
const BANNER_HEIGHT = '32px';

function readHeaderHeight(): number {
  if (typeof window === 'undefined') return 56;
  const value = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--header-h'));
  return Number.isFinite(value) && value > 0 ? value : 56;
}

/**
 * Bandeau global hors connexion (M6 §6.2), monté une fois dans RootLayout :
 * - hors connexion : fine bande ink sous l'en-tête (en haut sur la fiche produit), icône WifiOff,
 *   « Hors connexion · contenu de votre dernière visite » et lien « Réessayer » ;
 * - retour du réseau : la bande passe brièvement en vert « Connexion rétablie », puis disparaît
 *   (les données sont relancées par useNetworkRecovery).
 */
export function OfflineBanner() {
  const online = useNetworkStore((s) => s.online);
  const browserOnline = useNetworkStore((s) => s.browserOnline);
  const recoveredAt = useNetworkStore((s) => s.recoveredAt);
  const queryClient = useQueryClient();
  const location = useLocation();
  const reducedMotion = useReducedMotionPref();

  // Un retour du réseau déjà ancien (bandeau remonté après une erreur de page) n'est pas réannoncé
  const [dismissedRecoveryAt, setDismissedRecoveryAt] = useState<number | null>(() => {
    const previous = useNetworkStore.getState().recoveredAt;
    return previous !== null && Date.now() - previous > RECOVERED_VISIBLE_MS ? previous : null;
  });
  const [checking, setChecking] = useState(false);
  const [headerHeight] = useState(readHeaderHeight);

  const path = location.pathname;
  const isProductPage = path.startsWith('/produit/');
  const isSearchPage = path.startsWith('/recherche');
  const isHomePage = path === '/';
  // Page qui explique déjà elle-même la coupure (le retour du réseau y reste annoncé)
  const hiddenOnRoute = path.startsWith('/hors-ligne');
  const hasMobileHeader = !isProductPage && !isSearchPage;

  const showRecovered = online && recoveredAt !== null && recoveredAt !== dismissedRecoveryAt;
  const visible = (!online && !hiddenOnRoute) || showRecovered;

  // « Connexion rétablie » s'efface tout seul
  useEffect(() => {
    if (!online || recoveredAt === null) return undefined;
    const timer = window.setTimeout(() => setDismissedRecoveryAt(recoveredAt), RECOVERED_VISIBLE_MS);
    return () => window.clearTimeout(timer);
  }, [online, recoveredAt]);

  // Le navigateur se dit en ligne mais les requêtes échouent : on revérifie de temps en temps
  useEffect(() => {
    if (online || !browserOnline) return undefined;
    const timer = window.setInterval(() => void retryNetwork(queryClient), AUTO_RETRY_MS);
    return () => window.clearInterval(timer);
  }, [online, browserOnline, queryClient]);

  // Hauteur occupée en haut de l'écran sur mobile (éléments fixes de la fiche produit)
  useEffect(() => {
    const rootStyle = document.documentElement.style;
    rootStyle.setProperty('--offline-banner-h', visible ? BANNER_HEIGHT : '0px');
    return () => rootStyle.setProperty('--offline-banner-h', '0px');
  }, [visible]);

  // Suit l'en-tête mobile qui se masque au défilement (mêmes seuils que AppHeader)
  const { scrollY } = useScroll();
  const lastScrollY = useRef(0);
  const [headerHidden, setHeaderHidden] = useState(false);
  useMotionValueEvent(scrollY, 'change', (latest) => {
    const delta = latest - lastScrollY.current;
    lastScrollY.current = latest;
    if (latest <= 40) setHeaderHidden(false);
    else if (delta > 8) setHeaderHidden(true);
    else if (delta < -4) setHeaderHidden(false);
  });
  const followHeader = hasMobileHeader && headerHidden && !reducedMotion;

  const handleRetry = async () => {
    setChecking(true);
    try {
      await retryNetwork(queryClient);
    } finally {
      setChecking(false);
    }
  };

  return (
    <>
      <div
        aria-live="polite"
        className={cn(
          // Mobile : bande fixe sous l'en-tête (ou tout en haut sans en-tête) ; ordinateur : sous l'en-tête
          'fixed inset-x-0 lg:static',
          hasMobileHeader
            ? 'top-[calc(env(safe-area-inset-top)+var(--header-h))] z-header'
            : 'top-0 z-nav',
          isSearchPage && 'max-lg:hidden',
        )}
      >
        <AnimatePresence initial={false}>
          {visible && (
            <m.div
              key="offline-banner"
              role="status"
              initial={reducedMotion ? { opacity: 0 } : { opacity: 0, y: -40 }}
              animate={{ opacity: 1, y: followHeader ? -headerHeight : 0 }}
              exit={reducedMotion ? { opacity: 0 } : { opacity: 0, y: -40 }}
              transition={{ duration: duration.fast, ease: ease.out }}
              className={cn(
                'text-white',
                online ? 'bg-success' : 'bg-ink',
                !hasMobileHeader && 'pt-safe lg:pt-0',
              )}
            >
              <div className="mx-auto flex h-8 max-w-content items-center justify-center gap-1.5 px-3 text-[11px] font-semibold sm:gap-2 sm:px-page sm:text-xs">
                {online ? (
                  <>
                    <Wifi className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                    <span>Connexion rétablie</span>
                  </>
                ) : (
                  <>
                    <WifiOff className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                    <span className="truncate">Hors connexion · contenu de votre dernière visite</span>
                    <button
                      type="button"
                      onClick={() => void handleRetry()}
                      disabled={checking}
                      className="-my-2 inline-flex min-h-[32px] shrink-0 items-center px-1 text-white underline underline-offset-2 disabled:opacity-60"
                    >
                      {checking ? 'Vérification…' : 'Réessayer'}
                    </button>
                  </>
                )}
              </div>
            </m.div>
          )}
        </AnimatePresence>
      </div>
      {/* Réserve la place de la bande fixe sous l'en-tête mobile (sauf accueil : bande posée sur la photo) */}
      {visible && hasMobileHeader && !isHomePage && (
        <div aria-hidden="true" className="h-8 lg:hidden" />
      )}
    </>
  );
}
