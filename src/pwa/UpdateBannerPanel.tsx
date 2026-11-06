import { RefreshCw, X } from 'lucide-react';
import { AnimatePresence } from 'motion/react';
import * as m from 'motion/react-m';
import { useState } from 'react';
import { useLocation } from 'react-router';
import { isBottomNavHidden } from '@/components/layout/bottomNavVisibility';
import { Button } from '@/components/ui/Button';
import { cn } from '@/lib/utils/cn';
import { duration, ease } from '@/motion/tokens';
import { useReducedMotionPref } from '@/motion/useReducedMotionPref';
import { selectCartCount, useCartStore } from '@/stores/cartStore';
import { isUpdateBlockedPath } from './cacheNames';
import { usePwaStore } from './pwaStore';

/** registerSW (et workbox-window) n'est chargé qu'à l'appui : hors du JavaScript de démarrage. */
function applyUpdateLazily() {
  void import('./registerSW').then(({ applyUpdate }) => applyUpdate());
}

/**
 * Bandeau « Une nouvelle version est disponible » (M6 §4.7), en bas au-dessus de la barre de
 * navigation. Jamais sur la réservation, le paiement et l'envoi de la preuve, ni pendant une
 * action en cours (`busyCount`). Si le client l'ignore, la version s'applique au prochain
 * lancement à froid. Chargé à la demande par UpdateBanner, seulement quand une version attend.
 */
export function UpdateBannerPanel() {
  const { pathname } = useLocation();
  const reducedMotion = useReducedMotionPref();
  const updateReady = usePwaStore((s) => s.updateReady);
  const busy = usePwaStore((s) => s.busyCount > 0);
  const applying = usePwaStore((s) => s.applying);
  const cartCount = useCartStore(selectCartCount);
  const [dismissed, setDismissed] = useState(false);

  const visible = updateReady && !busy && !dismissed && !isUpdateBlockedPath(pathname);
  // HYPOTHÈSE: sur mobile, les écrans sans barre basse (fiche produit, panier rempli) ont déjà une
  // barre d'action collante en bas : le bandeau y est masqué et revient sur l'écran suivant.
  // Sur ordinateur, il reste affiché partout (en bas à gauche, rien ne le recouvre).
  const hiddenOnMobile = isBottomNavHidden(pathname, cartCount);

  return (
    <AnimatePresence>
      {visible && (
        <m.div
          key="update-banner"
          role="status"
          initial={reducedMotion ? { opacity: 0 } : { opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          exit={reducedMotion ? { opacity: 0 } : { opacity: 0, y: 16 }}
          transition={{ duration: duration.base, ease: ease.out }}
          className={cn(
            // update-banner : remonté au-dessus du bandeau « réservation en attente » (index.css) ; sa
            // hauteur est mesurée (--update-banner-h) pour placer le bouton WhatsApp et les toasts au-dessus
            'update-banner fixed right-4 bottom-[calc(var(--bottom-bar-h)+12px)] left-4 z-overlay mx-auto max-w-md items-center gap-3 rounded-[var(--radius-md)] bg-ink py-1 pr-1 pl-4 text-white shadow-[var(--shadow-sheet)] lg:right-auto lg:bottom-6 lg:left-6 lg:mx-0 lg:w-100',
            hiddenOnMobile ? 'hidden lg:flex' : 'flex',
          )}
        >
          <RefreshCw className="h-4 w-4 shrink-0 text-silver" aria-hidden="true" />
          <p className="min-w-0 flex-1 text-small font-semibold">Une nouvelle version est disponible</p>
          <Button
            variant="primary"
            size="sm"
            loading={applying}
            onClick={applyUpdateLazily}
            className="shrink-0"
          >
            Mettre à jour
          </Button>
          {/* HYPOTHÈSE: fermeture discrète ; la version s'applique alors au prochain lancement à froid */}
          <button
            type="button"
            onClick={() => setDismissed(true)}
            aria-label="Masquer jusqu’au prochain lancement"
            disabled={applying}
            className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-[var(--radius-full)] text-silver transition-colors duration-fast hover:text-white disabled:opacity-45"
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        </m.div>
      )}
    </AnimatePresence>
  );
}
