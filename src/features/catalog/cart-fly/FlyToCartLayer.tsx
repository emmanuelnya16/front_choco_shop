import { ShoppingBag } from 'lucide-react';
import { AnimatePresence } from 'motion/react';
import * as m from 'motion/react-m';
import { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { Link, useLocation } from 'react-router';
import { cn } from '@/lib/utils/cn';
import { duration, ease, gsapEase, spring } from '@/motion/tokens';
import { useReducedMotionPref } from '@/motion/useReducedMotionPref';
import { selectCartCount, useCartStore } from '@/stores/cartStore';
import { useUiStore, type FlyingCartItem } from '@/stores/uiStore';

function resolveTargetRect(customSelector?: string): { x: number; y: number } {
  if (typeof document === 'undefined') {
    return { x: 0, y: 0 };
  }

  const selectors = [
    customSelector,
    '[data-cart-target="desktop"]',
    '[data-cart-target="mobile"]',
    '[data-cart-target="product-bar"]',
    '[data-cart-target="mobile-header"]',
  ].filter((s): s is string => Boolean(s));

  for (const selector of selectors) {
    const el = document.querySelector<HTMLElement>(selector);
    if (el) {
      const rect = el.getBoundingClientRect();
      if (rect.width > 0 && rect.height > 0) {
        return {
          x: rect.left + rect.width / 2,
          y: rect.top + rect.height / 2,
        };
      }
    }
  }

  return {
    x: window.innerWidth - 48,
    y: window.innerHeight - 40,
  };
}

function FlyingClone({
  item,
  reducedMotion,
  onComplete,
}: {
  item: FlyingCartItem;
  reducedMotion: boolean;
  onComplete: (id: string) => void;
}) {
  const elRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (reducedMotion) {
      onComplete(item.id);
      return;
    }

    const node = elRef.current;
    if (!node) {
      onComplete(item.id);
      return;
    }

    let cancelled = false;

    void import('@/lib/gsap').then(({ gsap }) => {
      if (cancelled || !elRef.current) return;

      const target = resolveTargetRect(item.targetSelector);
      const startCenterX = item.sourceRect.x + item.sourceRect.width / 2;
      const startCenterY = item.sourceRect.y + item.sourceRect.height / 2;
      const deltaX = target.x - startCenterX;
      const deltaY = target.y - startCenterY;

      // Trajectoire en arc (§7.9) : l'horizontale part vite et ralentit, la verticale part lentement
      // puis accélère (même durée, courbes différentes)
      gsap.to(node, {
        x: deltaX,
        duration: duration.reveal,
        ease: gsapEase.soft,
      });

      gsap.to(node, {
        y: deltaY,
        scale: 0.12,
        rotation: -8,
        opacity: 0.85,
        duration: duration.reveal,
        ease: gsapEase.inOut,
        onComplete: () => {
          if (!cancelled) {
            onComplete(item.id);
          }
        },
      });
    });

    return () => {
      cancelled = true;
    };
  }, [item, onComplete, reducedMotion]);

  if (reducedMotion) {
    return null;
  }

  return (
    <div
      ref={elRef}
      aria-hidden="true"
      style={{
        left: `${item.sourceRect.x}px`,
        top: `${item.sourceRect.y}px`,
        width: `${item.sourceRect.width}px`,
        height: `${item.sourceRect.height}px`,
      }}
      className="pointer-events-none fixed z-toast overflow-hidden rounded-[var(--radius-md)] bg-surface shadow-[var(--shadow-sheet)] will-change-transform"
    >
      <img
        src={item.image}
        onError={(e) => {
          if (item.fallback && e.currentTarget.src !== item.fallback) {
            e.currentTarget.src = item.fallback;
          }
        }}
        alt=""
        className="h-full w-full object-cover"
      />
    </div>
  );
}

/**
 * Portail d'animation d'ajout au panier (§7.9) :
 * - Fait voler jusqu'à 3 miniatures simultanées suivant une parabole GSAP vers l'icône panier.
 * - Affiche sur la fiche produit mobile une pastille flottante temporaire (2 s) « Panier (X) » en haut à droite.
 */
export function FlyToCartLayer() {
  const flyingItems = useUiStore((s) => s.flyingItems);
  const completeFlyToCart = useUiStore((s) => s.completeFlyToCart);
  const mobileCartPeekVisible = useUiStore((s) => s.mobileCartPeekVisible);
  // Fiche produit : la pastille passe sous les boutons ronds Favori et Partager (44 px en haut à droite)
  const onProductPage = useLocation().pathname.startsWith('/produit/');
  const cartCount = useCartStore(selectCartCount);
  const reducedMotion = useReducedMotionPref();

  if (typeof document === 'undefined') {
    return null;
  }

  return createPortal(
    <>
      {flyingItems.map((item) => (
        <FlyingClone
          key={item.id}
          item={item}
          reducedMotion={reducedMotion}
          onComplete={completeFlyToCart}
        />
      ))}

      <AnimatePresence>
        {mobileCartPeekVisible && cartCount > 0 && (
          <m.div
            initial={{ opacity: 0, y: -12, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -8, scale: 0.92 }}
            transition={{ duration: duration.fast, ease: ease.out }}
            className={cn(
              'fixed right-4 z-toast pt-safe lg:hidden',
              // Fiche : sous les boutons ronds (12 px + 44 px + 16 px d'écart), décalés comme eux par le bandeau hors connexion
              onProductPage ? 'top-[calc(4.5rem+var(--offline-banner-h,0px))]' : 'top-4',
            )}
          >
            <Link
              to="/panier"
              viewTransition
              className="inline-flex min-h-11 items-center gap-2 rounded-[var(--radius-full)] bg-ink px-4 py-2 text-caption font-bold text-white shadow-pop"
            >
              <ShoppingBag className="h-4 w-4 text-red" aria-hidden="true" />
              <span>Panier</span>
              <m.span
                key={cartCount}
                initial={reducedMotion ? false : { scale: 0.5 }}
                animate={{ scale: 1 }}
                transition={spring.bounce}
                className="inline-flex h-5 min-w-5 items-center justify-center rounded-[var(--radius-full)] bg-red px-1.5 font-mono text-caption font-bold text-white"
              >
                {cartCount}
              </m.span>
            </Link>
          </m.div>
        )}
      </AnimatePresence>
    </>,
    document.body,
  );
}
