import { RefreshCw, X } from 'lucide-react';
import { AnimatePresence } from 'motion/react';
import * as m from 'motion/react-m';
import { useEffect, useState } from 'react';
import { useLocation } from 'react-router';
import { isBottomNavHidden } from '@/components/layout/bottomNavVisibility';
import { Button } from '@/components/ui/Button';
import { cn } from '@/lib/utils/cn';
import { duration, ease } from '@/motion/tokens';
import { useReducedMotionPref } from '@/motion/useReducedMotionPref';
import { selectCartCount, useCartStore } from '@/stores/cartStore';
import { useToastStore } from '@/stores/toastStore';
import { isUpdateBlockedPath } from './cacheRules';
import { usePwaStore } from './pwaStore';
import { applyUpdate, UPDATED_FLAG_KEY } from './registerSW';

/** Lit puis retire le drapeau posé avant le rechargement d'une mise à jour. */
function consumeUpdatedFlag(): boolean {
  try {
    if (sessionStorage.getItem(UPDATED_FLAG_KEY) === null) return false;
    sessionStorage.removeItem(UPDATED_FLAG_KEY);
    return true;
  } catch {
    return false;
  }
}

/**
 * Bandeau « Une nouvelle version est disponible » (M6 §4.7), en bas au-dessus de la barre de
 * navigation. Jamais sur la réservation, le paiement et l'envoi de la preuve, ni pendant une
 * action en cours (`busyCount`). Si le client l'ignore, la version s'applique au prochain
 * lancement à froid. Après une mise à jour, toast « Application mise à jour ».
 */
export function UpdateBanner() {
  const { pathname } = useLocation();
  const reducedMotion = useReducedMotionPref();
  const updateReady = usePwaStore((s) => s.updateReady);
  const busy = usePwaStore((s) => s.busyCount > 0);
  const applying = usePwaStore((s) => s.applying);
  const cartCount = useCartStore(selectCartCount);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    if (!consumeUpdatedFlag()) return;
    useToastStore.getState().show({
      message: 'Application mise à jour',
      subtitle: 'Vous utilisez la dernière version de DR Choco.',
    });
  }, []);

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
            // update-banner : remonté au-dessus du bandeau « réservation en attente » (index.css)
            'update-banner fixed right-4 bottom-[calc(var(--bottom-nav-h)+12px+env(safe-area-inset-bottom,0px))] left-4 z-overlay mx-auto max-w-md items-center gap-3 rounded-[var(--radius-md)] bg-ink py-2.5 pr-2 pl-4 text-white shadow-[var(--shadow-sheet)] lg:right-auto lg:bottom-6 lg:left-6 lg:mx-0 lg:w-[400px]',
            hiddenOnMobile ? 'hidden lg:flex' : 'flex',
          )}
        >
          <RefreshCw className="h-4 w-4 shrink-0 text-silver" aria-hidden="true" />
          <p className="min-w-0 flex-1 text-small font-semibold">Une nouvelle version est disponible</p>
          <Button
            variant="primary"
            size="sm"
            loading={applying}
            onClick={applyUpdate}
            className="shrink-0"
          >
            Mettre à jour
          </Button>
          {/* HYPOTHÈSE: fermeture discrète ; la version s'applique alors au prochain lancement à froid */}
          <button
            type="button"
            onClick={() => setDismissed(true)}
            aria-label="Masquer jusqu'au prochain lancement"
            disabled={applying}
            className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-[var(--radius-full)] text-silver hover:text-white disabled:opacity-45"
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        </m.div>
      )}
    </AnimatePresence>
  );
}
