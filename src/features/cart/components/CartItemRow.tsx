import { AnimatePresence, type PanInfo } from 'motion/react';
import * as m from 'motion/react-m';
import { AlertTriangle, Minus, Plus, Trash2 } from 'lucide-react';
import { useRef, useState } from 'react';
import { Link } from 'react-router';
import { Price } from '@/components/ui/Primitives';
import { SmartImage } from '@/components/ui/SmartImage';
import { cn } from '@/lib/utils/cn';
import { haptic } from '@/lib/utils/haptics';
import { formatPrice } from '@/lib/utils/price';
import { ease, spring } from '@/motion/tokens';
import { useReducedMotionPref } from '@/motion/useReducedMotionPref';
import type { CartValidationItemResult } from '@/types/api';
import type { CartItem } from '@/types/domain';

export interface CartItemRowProps {
  item: CartItem;
  validation?: CartValidationItemResult;
  compact?: boolean;
  onQuantityChange: (variantId: string, quantity: number) => void;
  onRemove: (item: CartItem) => void;
}

/**
 * Ligne d'article du panier (§4.1 & §4.4) :
 * - Miniature 80 × 100 px (4:5, rayon 8, lien vers la fiche).
 * - Sélecteur de quantité avec chiffre qui défile verticalement (0,2 s), « − » à 1 transformé en corbeille,
 *   « + » désactivé au stock maximum avec mention « Maximum disponible ».
 * - Glisser vers la gauche (`drag="x"`) révélant un fond `bg-red` avec corbeille blanche ;
 *   suppression au-delà de 40 % de la largeur ou vitesse > 500.
 * - États de vérification : `reduced` (bordure `warning`), `unavailable` (50 % d'opacité + « Épuisé entre-temps »),
 *   `price_changed` (ancien prix barré + « Le prix a changé. »).
 */
export function CartItemRow({
  item,
  validation,
  compact = false,
  onQuantityChange,
  onRemove,
}: CartItemRowProps) {
  const reducedMotion = useReducedMotionPref();
  const rowRef = useRef<HTMLDivElement>(null);
  const [qtyDirection, setQtyDirection] = useState<'up' | 'down'>('up');

  const isUnavailable =
    validation?.status === 'unavailable' || item.maxQuantity <= 0;
  const isReduced = validation?.status === 'reduced';
  const isPriceChanged = validation?.status === 'price_changed';
  const isAtMaxStock = !isUnavailable && item.quantity >= item.maxQuantity;

  const handleDecrement = () => {
    haptic('light');
    if (item.quantity <= 1) {
      onRemove(item);
      return;
    }
    setQtyDirection('down');
    onQuantityChange(item.variantId, item.quantity - 1);
  };

  const handleIncrement = () => {
    if (isAtMaxStock || isUnavailable) return;
    haptic('light');
    setQtyDirection('up');
    onQuantityChange(item.variantId, item.quantity + 1);
  };

  const handleDragEnd = (
    _event: MouseEvent | TouchEvent | PointerEvent,
    info: PanInfo,
  ) => {
    const rowWidth = rowRef.current?.offsetWidth ?? 320;
    const swipedFarEnough = info.offset.x < -(rowWidth * 0.4);
    const swipedFastEnough = info.velocity.x < -500;

    if (swipedFarEnough || swipedFastEnough) {
      haptic('light');
      onRemove(item);
    }
  };

  return (
    <m.div
      ref={rowRef}
      layout
      initial={reducedMotion ? false : { opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={
        reducedMotion
          ? { opacity: 0 }
          : { opacity: 0, x: -320, transition: { duration: 0.22, ease: ease.out } }
      }
      transition={spring.snappy}
      className="relative overflow-hidden rounded-[var(--radius-md)]"
    >
      {/* Fond rouge révélé au glissement vers la gauche (§4.1) */}
      {!compact && (
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 flex items-center justify-end rounded-[var(--radius-md)] bg-red px-6 text-white"
        >
          <div className="flex items-center gap-2 text-small font-bold">
            <Trash2 className="h-5 w-5" />
            <span>Retirer</span>
          </div>
        </div>
      )}

      <m.div
        drag={!compact && !reducedMotion ? 'x' : false}
        dragConstraints={{ left: -140, right: 0 }}
        dragElastic={{ left: 0.25, right: 0 }}
        onDragEnd={!compact ? handleDragEnd : undefined}
        className={cn(
          'relative rounded-[var(--radius-md)] border bg-white p-3.5 transition-colors sm:p-4',
          isReduced
            ? 'border-2 border-warning'
            : isUnavailable
              ? 'border-danger/60 bg-surface/60'
              : 'border-silver/70',
        )}
      >
        <div className="flex items-start gap-3.5">
          {/* Miniature 80 × 100 px (4:5, rayon 8) */}
          <Link
            to={`/produit/${item.slug}`}
            viewTransition
            className={cn(
              'block shrink-0 overflow-hidden rounded-[var(--radius-md)] bg-surface',
              compact ? 'h-[85px] w-[68px]' : 'h-[100px] w-[80px]',
              isUnavailable && 'opacity-50',
            )}
          >
            <SmartImage
              src={item.image}
              fallback={item.image}
              alt={item.name}
              ratio="4/5"
              className="h-full w-full"
            />
          </Link>

          {/* Informations + actions */}
          <div className="min-w-0 flex-1">
            <div className="flex items-start justify-between gap-2">
              <div className={cn('min-w-0', isUnavailable && 'opacity-50')}>
                <Link
                  to={`/produit/${item.slug}`}
                  viewTransition
                  className="line-clamp-2 text-h3 text-ink hover:underline"
                >
                  {item.name}
                </Link>
                <p className="mt-0.5 text-small text-text-2">
                  {item.color.name} ·{' '}
                  {item.size === 'Unique' ? 'Taille unique' : item.size}
                </p>
              </div>

              {/* Bouton Retirer discret (ou mis en avant si épuisé) */}
              {isUnavailable ? (
                <button
                  type="button"
                  onClick={() => onRemove(item)}
                  className="inline-flex min-h-[44px] shrink-0 items-center gap-1.5 rounded-[var(--radius-md)] bg-red px-3 py-1.5 text-xs font-bold text-white transition-colors hover:bg-ink"
                >
                  <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                  <span>Retirer</span>
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => onRemove(item)}
                  aria-label={`Retirer ${item.name} du panier`}
                  className="-mt-1 -mr-1 inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-[var(--radius-full)] text-text-2 transition-colors hover:bg-surface hover:text-red"
                >
                  <Trash2 className="h-4 w-4" aria-hidden="true" />
                </button>
              )}
            </div>

            {/* Prix unitaire et total de la ligne */}
            <div
              className={cn(
                'mt-2 flex flex-wrap items-baseline gap-x-2 gap-y-0.5',
                isUnavailable && 'opacity-50',
              )}
            >
              <Price
                amount={item.unitPrice}
                className="text-body font-bold text-ink"
              />
              {isPriceChanged && validation?.previousPrice && (
                <span className="text-xs text-text-2 line-through tabular-nums">
                  {formatPrice(validation.previousPrice)}
                </span>
              )}
              {item.quantity > 1 && !isUnavailable && (
                <span className="text-xs font-semibold text-text-2 tabular-nums">
                  · Total : {formatPrice(item.unitPrice * item.quantity)}
                </span>
              )}
            </div>

            {/* Mentions d'état de vérification (§4.4) */}
            {isUnavailable && (
              <p
                role="alert"
                className="mt-2 inline-flex items-center gap-1.5 text-xs font-bold text-danger"
              >
                <AlertTriangle className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                <span>Épuisé entre-temps</span>
              </p>
            )}

            {isReduced && !isUnavailable && (
              <p
                role="status"
                className="mt-2 inline-flex items-center gap-1.5 text-xs font-semibold text-warning"
              >
                <AlertTriangle className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                <span>
                  Il ne reste que {item.maxQuantity} pièce
                  {item.maxQuantity > 1 ? 's' : ''} : quantité ajustée.
                </span>
              </p>
            )}

            {isPriceChanged && !isUnavailable && (
              <p
                role="status"
                className="mt-1.5 text-xs font-semibold text-warning"
              >
                Le prix a changé.
              </p>
            )}

            {/* Sélecteur de quantité (§4.1) */}
            {!isUnavailable && (
              <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
                <div className="inline-flex items-center rounded-[var(--radius-md)] border border-silver bg-surface/60">
                  <button
                    type="button"
                    onClick={handleDecrement}
                    aria-label={
                      item.quantity <= 1
                        ? `Retirer ${item.name}`
                        : `Diminuer la quantité de ${item.name}`
                    }
                    className="inline-flex h-11 w-11 items-center justify-center text-ink transition-colors hover:bg-surface"
                  >
                    <span className="flex h-9 w-9 items-center justify-center rounded-[var(--radius-sm)]">
                      {item.quantity <= 1 ? (
                        <Trash2
                          className="h-4 w-4 text-text-2"
                          aria-hidden="true"
                        />
                      ) : (
                        <Minus className="h-4 w-4" aria-hidden="true" />
                      )}
                    </span>
                  </button>

                  {/* Chiffre qui défile verticalement en 0,2 s (§4.1) */}
                  <div
                    aria-live="polite"
                    aria-atomic="true"
                    className="relative flex h-9 min-w-[36px] items-center justify-center overflow-hidden px-2 text-small font-extrabold tabular-nums text-ink"
                  >
                    <AnimatePresence mode="popLayout" initial={false}>
                      <m.span
                        key={item.quantity}
                        initial={
                          reducedMotion
                            ? false
                            : {
                                y: qtyDirection === 'up' ? 14 : -14,
                                opacity: 0,
                              }
                        }
                        animate={{ y: 0, opacity: 1 }}
                        exit={
                          reducedMotion
                            ? { opacity: 0 }
                            : {
                                y: qtyDirection === 'up' ? -14 : 14,
                                opacity: 0,
                              }
                        }
                        transition={{ duration: 0.2, ease: ease.out }}
                        className="inline-block"
                      >
                        {item.quantity}
                      </m.span>
                    </AnimatePresence>
                  </div>

                  <button
                    type="button"
                    disabled={isAtMaxStock}
                    onClick={handleIncrement}
                    aria-label={`Augmenter la quantité de ${item.name}`}
                    className={cn(
                      'inline-flex h-11 w-11 items-center justify-center transition-colors',
                      isAtMaxStock
                        ? 'cursor-not-allowed text-silver'
                        : 'text-ink hover:bg-surface',
                    )}
                  >
                    <span className="flex h-9 w-9 items-center justify-center rounded-[var(--radius-sm)]">
                      <Plus className="h-4 w-4" aria-hidden="true" />
                    </span>
                  </button>
                </div>

                {isAtMaxStock && (
                  <span className="text-xs font-semibold text-text-2">
                    Maximum disponible
                  </span>
                )}
              </div>
            )}
          </div>
        </div>
      </m.div>
    </m.div>
  );
}
