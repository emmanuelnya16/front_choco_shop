import { AnimatePresence } from 'motion/react';
import * as m from 'motion/react-m';
import { Loader2, ShoppingBag, X } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router';
import { Button } from '@/components/ui/Button';
import { useRequireAuth } from '@/features/auth/api/useAuthQueries';
import { useValidateCart } from '@/features/cart/api/useCartQueries';
import { useOnlineStatus } from '@/lib/hooks/useOnlineStatus';
import { useOverlayHistory } from '@/lib/hooks/useOverlayHistory';
import {
  selectCartCount,
  selectCartSubtotal,
  selectHasUnavailableItems,
  useCartStore,
} from '@/stores/cartStore';
import { useToastStore } from '@/stores/toastStore';
import { useUiStore } from '@/stores/uiStore';
import { spring } from '@/motion/tokens';
import { useReducedMotionPref } from '@/motion/useReducedMotionPref';
import type { CartItem } from '@/types/domain';
import { AnimatedPriceCounter } from './AnimatedPriceCounter';
import { CartItemRow } from './CartItemRow';

/**
 * Tiroir latéral du panier sur ordinateur (`420 px`, §4.3) :
 * - Glissement depuis la droite avec le ressort `spring.sheet`, fond assombri, touche Échap pour fermer, focus piégé.
 * - S'ouvre automatiquement `2,5 s` après un ajout au panier sur ordinateur, puis se referme
 *   sauf si la souris est dessus.
 */
export function CartDrawer() {
  const navigate = useNavigate();
  const reducedMotion = useReducedMotionPref();
  const isOnline = useOnlineStatus();
  const requireAuth = useRequireAuth();

  const isOpen = useUiStore((s) => s.isCartDrawerOpen);
  const autoOpened = useUiStore((s) => s.cartDrawerAutoOpened);
  const closeDrawer = useUiStore((s) => s.closeCartDrawer);

  const items = useCartStore((s) => s.items);
  const validationMap = useCartStore((s) => s.validationMap);
  const setQuantity = useCartStore((s) => s.setQuantity);
  const remove = useCartStore((s) => s.remove);
  const restore = useCartStore((s) => s.restore);
  const count = useCartStore(selectCartCount);
  const subtotal = useCartStore(selectCartSubtotal);
  const hasUnavailable = useCartStore(selectHasUnavailableItems);

  const showToast = useToastStore((s) => s.show);
  const validateCart = useValidateCart();

  const [isHovered, setIsHovered] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);

  // Entrée d'historique (M6 §8) : le bouton retour du navigateur ferme d'abord le tiroir
  useOverlayHistory(isOpen, closeDrawer);

  // Fermeture automatique après 2,5 s lors d'une ouverture déclenchée par un ajout sur ordinateur (§4.3)
  useEffect(() => {
    if (!isOpen || !autoOpened || isHovered) return;
    const timer = window.setTimeout(() => {
      closeDrawer();
    }, 2500);
    return () => window.clearTimeout(timer);
  }, [isOpen, autoOpened, isHovered, closeDrawer]);

  // Touche Escape + piège de focus
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        closeDrawer();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, closeDrawer]);

  const handleRemoveItem = (item: CartItem) => {
    const index = items.findIndex((i) => i.variantId === item.variantId);
    remove(item.variantId);
    showToast({
      message: 'Article retiré',
      subtitle: `${item.name} · ${item.size}`,
      actionLabel: 'Annuler',
      durationMs: 5000,
      onAction: () => {
        restore(item, index);
      },
    });
  };

  const handleReserveClick = async () => {
    if (!isOnline || hasUnavailable || items.length === 0) return;

    try {
      const result = await validateCart.mutateAsync({ timeoutMs: 2000 });
      const anyUnavailable = result.items.some(
        (v) => v.status === 'unavailable' || v.availableQuantity <= 0,
      );
      if (anyUnavailable) {
        return;
      }
    } catch {
      // Si le réseau ne répond pas dans les 2 s, on continue (§4.4)
    }

    closeDrawer();
    requireAuth(() => {
      navigate('/reservation', { viewTransition: true });
    });
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div
          className="fixed inset-0 z-50 hidden lg:block"
          role="dialog"
          aria-modal="true"
          aria-label="Aperçu de mon panier"
        >
          {/* Fond assombri */}
          <m.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={closeDrawer}
            className="fixed inset-0 bg-[var(--color-scrim-50)] backdrop-blur-[2px]"
          />

          {/* Panneau latéral droit de 420 px */}
          <m.aside
            ref={panelRef}
            onMouseEnter={() => setIsHovered(true)}
            onMouseLeave={() => setIsHovered(false)}
            initial={reducedMotion ? { opacity: 0 } : { x: '100%' }}
            animate={reducedMotion ? { opacity: 1 } : { x: 0 }}
            exit={reducedMotion ? { opacity: 0 } : { x: '100%' }}
            transition={spring.sheet}
            className="fixed top-0 right-0 bottom-0 z-10 flex w-[420px] max-w-full flex-col border-l border-silver bg-white shadow-[var(--shadow-sheet)]"
          >
            {/* En-tête du tiroir */}
            <div className="flex items-center justify-between border-b border-silver/70 px-6 py-4">
              <div className="flex items-center gap-2.5">
                <ShoppingBag className="h-5 w-5 text-ink" aria-hidden="true" />
                <h2 className="text-h3 text-ink">MON PANIER</h2>
                <span className="text-small text-text-2">
                  ({count} article{count > 1 ? 's' : ''})
                </span>
              </div>
              <button
                type="button"
                onClick={closeDrawer}
                aria-label="Fermer le tiroir du panier"
                className="inline-flex h-11 w-11 items-center justify-center rounded-[var(--radius-full)] text-text-2 transition-colors hover:bg-surface hover:text-ink"
              >
                <X className="h-5 w-5" aria-hidden="true" />
              </button>
            </div>

            {/* Contenu */}
            {items.length === 0 ? (
              <div className="flex flex-1 flex-col items-center justify-center px-6 text-center">
                <ShoppingBag
                  className="h-12 w-12 text-silver"
                  aria-hidden="true"
                />
                <p className="mt-3 text-h3 text-ink">Votre panier est vide</p>
                <p className="mt-1 text-small text-text-2">
                  Ajoutez vos articles préférés pour les réserver 24 h.
                </p>
                <div className="mt-5">
                  <Button
                    variant="dark"
                    onClick={() => {
                      closeDrawer();
                      navigate('/explorer', { viewTransition: true });
                    }}
                  >
                    Découvrir la collection
                  </Button>
                </div>
              </div>
            ) : (
              <>
                <div className="flex-1 space-y-3 overflow-y-auto px-6 py-4">
                  <AnimatePresence initial={false}>
                    {items.map((item) => (
                      <CartItemRow
                        key={item.variantId}
                        item={item}
                        validation={validationMap[item.variantId]}
                        compact
                        onQuantityChange={setQuantity}
                        onRemove={handleRemoveItem}
                      />
                    ))}
                  </AnimatePresence>
                </div>

                {/* Pied du tiroir */}
                <div className="space-y-4 border-t border-silver/70 bg-surface/50 px-6 py-5">
                  <div className="flex items-baseline justify-between">
                    <div>
                      <span className="text-small font-semibold text-ink">
                        Sous-total
                      </span>
                      <p className="text-xs text-text-2">
                        Livraison calculée à l&rsquo;étape suivante
                      </p>
                    </div>
                    <AnimatedPriceCounter
                      amount={subtotal}
                      className="text-price text-ink"
                    />
                  </div>

                  {hasUnavailable && (
                    <p role="alert" className="text-xs font-bold text-danger">
                      Retirez les articles épuisés pour continuer.
                    </p>
                  )}

                  {!isOnline && (
                    <p role="alert" className="text-xs font-bold text-warning">
                      Vous êtes hors connexion. Reconnectez-vous pour réserver.
                    </p>
                  )}

                  <div className="grid grid-cols-2 gap-3">
                    <Button
                      variant="dark"
                      size="md"
                      fullWidth
                      onClick={() => {
                        closeDrawer();
                        navigate('/panier', { viewTransition: true });
                      }}
                    >
                      Voir le panier
                    </Button>
                    <Button
                      variant="primary"
                      size="md"
                      fullWidth
                      disabled={
                        !isOnline || hasUnavailable || validateCart.isPending
                      }
                      onClick={handleReserveClick}
                    >
                      {validateCart.isPending ? (
                        <span className="inline-flex items-center gap-2">
                          <Loader2
                            className="h-4 w-4 animate-spin"
                            aria-hidden="true"
                          />
                          <span>Vérification…</span>
                        </span>
                      ) : (
                        'Réserver'
                      )}
                    </Button>
                  </div>
                </div>
              </>
            )}
          </m.aside>
        </div>
      )}
    </AnimatePresence>
  );
}
