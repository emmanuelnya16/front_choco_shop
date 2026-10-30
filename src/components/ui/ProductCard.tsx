import { Heart, ShoppingBag } from 'lucide-react';
import * as m from 'motion/react-m';
import { useRef, useState, type MouseEvent } from 'react';
import { flushSync } from 'react-dom';
import { useNavigate } from 'react-router';
import { usePrefetchProduct } from '@/features/catalog/api/useCatalogQueries';
import { cn } from '@/lib/utils/cn';
import { haptic } from '@/lib/utils/haptics';
import { duration, ease } from '@/motion/tokens';
import { useFavoritesStore } from '@/stores/favoritesStore';
import { useToastStore } from '@/stores/toastStore';
import { useUiStore, type SourceRect } from '@/stores/uiStore';
import type { Product } from '@/types/domain';
import { Badge } from './Badge';
import { Button } from './Button';
import { Price, Skeleton } from './Primitives';
import { SmartImage } from './SmartImage';

const CATEGORY_LABELS: Record<string, string> = {
  vetements: 'Vêtements',
  chaussures: 'Chaussures',
  babouches: 'Babouches',
};

const COLOR_DOT_CLASSES: Record<string, string> = {
  noir: 'bg-ink border-ink',
  blanc: 'bg-surface border-silver',
  rouge: 'bg-red border-red',
  gris: 'bg-grey border-grey',
};

const PARTICLE_OFFSETS = [
  { x: 0, y: -16 },
  { x: 14, y: -8 },
  { x: 14, y: 8 },
  { x: 0, y: 16 },
  { x: -14, y: 8 },
  { x: -14, y: -8 },
] as const;

export interface ProductCardProps {
  product: Product;
  className?: string;
}

/**
 * ProductCard (§5.6 & M2 §3.4, §4.2, §7.9, §8) :
 * - Pré-charge la fiche produit au survol (> 150 ms) ou au `pointerdown`.
 * - Porte `view-transition-name: product-${slug}` uniquement sur la carte touchée.
 * - Transmet les coordonnées de l'image au `SizePicker` pour l'animation d'envol vers le panier.
 */
export function ProductCard({ product, className }: ProductCardProps) {
  const navigate = useNavigate();
  const isFavorite = useFavoritesStore((s) => s.ids.includes(product.id));
  const toggleFavorite = useFavoritesStore((s) => s.toggle);
  const showToast = useToastStore((s) => s.show);
  const openSizePicker = useUiStore((s) => s.openSizePicker);
  const activeTransitionSlug = useUiStore((s) => s.activeTransitionSlug);
  const setActiveTransitionSlug = useUiStore((s) => s.setActiveTransitionSlug);

  const { onPointerEnter, onPointerLeave, onPointerDown } = usePrefetchProduct();
  const imageFrameRef = useRef<HTMLDivElement>(null);

  const [burstKey, setBurstKey] = useState(0);

  const totalStock = product.variants.reduce((sum, v) => sum + v.stock, 0);
  const isSoldOut = totalStock === 0 || product.badges.includes('sold-out');
  const isLowStock = !isSoldOut && (totalStock <= 3 || product.badges.includes('low-stock'));
  const isNew = !isSoldOut && !isLowStock && (product.isNew || product.badges.includes('new'));

  const primaryImage = product.images[0] ?? product.fallbackImages[0] ?? '/mock/product-tee.svg';
  const primaryFallback = product.fallbackImages[0] ?? '/mock/product-tee.svg';
  const secondaryImage = product.images[1] ?? product.fallbackImages[1];
  const secondaryFallback = product.fallbackImages[1] ?? primaryFallback;

  const visibleColors = product.colors.slice(0, 3);
  const extraColorsCount = Math.max(0, product.colors.length - 3);
  const categoryLabel = CATEGORY_LABELS[product.categorySlug] ?? product.categorySlug;

  const getCardSourceRect = (): SourceRect | null => {
    const el = imageFrameRef.current;
    if (!el) return null;
    const rect = el.getBoundingClientRect();
    return {
      x: rect.left,
      y: rect.top,
      width: rect.width,
      height: rect.height,
    };
  };

  const navigateToProduct = () => {
    try {
      flushSync(() => {
        setActiveTransitionSlug(product.slug);
      });
    } catch {
      setActiveTransitionSlug(product.slug);
    }
    navigate(`/produit/${product.slug}`, { viewTransition: true });
  };

  const handleCardClick = () => {
    navigateToProduct();
  };

  const handleToggleFavorite = (event: MouseEvent<HTMLButtonElement>) => {
    event.preventDefault();
    event.stopPropagation();
    const added = toggleFavorite(product.id);
    haptic('light');
    if (added) {
      setBurstKey((k) => k + 1);
    } else {
      showToast({
        message: 'Retiré des favoris',
        subtitle: product.name,
        actionLabel: 'Annuler',
        onAction: () => {
          if (!useFavoritesStore.getState().has(product.id)) {
            useFavoritesStore.getState().toggle(product.id);
          }
        },
        durationMs: 4000,
      });
    }
  };

  const handleReserveClick = (event: MouseEvent<HTMLButtonElement>) => {
    event.preventDefault();
    event.stopPropagation();
    openSizePicker(product, 'reserve', getCardSourceRect());
  };

  const handleAddClick = (event: MouseEvent<HTMLButtonElement>) => {
    event.preventDefault();
    event.stopPropagation();
    openSizePicker(product, 'add', getCardSourceRect());
  };

  const handleViewClick = (event: MouseEvent<HTMLButtonElement>) => {
    event.preventDefault();
    event.stopPropagation();
    navigateToProduct();
  };

  const isTransitionTarget = activeTransitionSlug === product.slug;

  return (
    <m.article
      whileTap={{ scale: 0.98 }}
      transition={{ duration: duration.tap }}
      onClick={handleCardClick}
      onPointerEnter={() => onPointerEnter(product.slug)}
      onPointerLeave={onPointerLeave}
      onPointerDown={() => onPointerDown(product.slug)}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          handleCardClick();
        }
      }}
      role="link"
      tabIndex={0}
      aria-label={`${product.name}, ${product.price} FCFA`}
      className={cn(
        'group/card flex cursor-pointer flex-col justify-between rounded-[var(--radius-md)] select-none',
        className,
      )}
    >
      <div>
        {/* Cadre photo 4:5 */}
        <div
          ref={imageFrameRef}
          style={
            isTransitionTarget
              ? { viewTransitionName: `product-${product.slug}` }
              : undefined
          }
          className="relative aspect-[4/5] w-full overflow-hidden rounded-[var(--radius-md)] bg-surface"
        >
          <div
            className={cn(
              'h-full w-full transition-transform duration-900 ease-[cubic-bezier(0.22,1,0.36,1)] [@media(hover:hover)]:group-hover/card:scale-105',
              isSoldOut && 'opacity-60',
            )}
          >
            <SmartImage
              src={primaryImage}
              fallback={primaryFallback}
              alt={product.name}
              ratio="4/5"
              sizes="(max-width: 640px) 48vw, (max-width: 1024px) 32vw, 280px"
              className="h-full w-full"
            />

            {secondaryImage && !isSoldOut && (
              <div className="pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-500 [@media(hover:hover)]:group-hover/card:opacity-100">
                <SmartImage
                  src={secondaryImage}
                  fallback={secondaryFallback}
                  alt={product.name}
                  ratio="4/5"
                  sizes="(max-width: 640px) 48vw, (max-width: 1024px) 32vw, 280px"
                  className="h-full w-full"
                />
              </div>
            )}
          </div>

          {/* Cœur favori en haut à gauche (cercle blanc 32 px dans cible tactile 44 px) */}
          <button
            type="button"
            onClick={handleToggleFavorite}
            aria-label={
              isFavorite
                ? `Retirer ${product.name} des favoris`
                : `Ajouter ${product.name} aux favoris`
            }
            aria-pressed={isFavorite}
            className="absolute top-1.5 left-1.5 z-10 flex h-11 w-11 items-center justify-center rounded-[var(--radius-full)]"
          >
            <span className="relative flex h-8 w-8 items-center justify-center rounded-[var(--radius-full)] bg-white shadow-[var(--shadow-card-icon)]">
              <m.span
                key={isFavorite ? `fav-on-${burstKey}` : 'fav-off'}
                initial={isFavorite ? { scale: 0.8 } : false}
                animate={isFavorite ? { scale: [0.8, 1.25, 1] } : { scale: 1 }}
                transition={{ duration: 0.35, ease: ease.out }}
                className="inline-flex items-center justify-center"
              >
                <Heart
                  className={cn(
                    'h-4 w-4 transition-colors',
                    isFavorite ? 'fill-red text-red' : 'text-ink',
                  )}
                  strokeWidth={1.75}
                  aria-hidden="true"
                />
              </m.span>

              {/* 6 petites particules rouges qui s'écartent en 0,4 s */}
              {burstKey > 0 && isFavorite && (
                <span
                  key={`particles-${burstKey}`}
                  aria-hidden="true"
                  className="pointer-events-none absolute inset-0 flex items-center justify-center"
                >
                  {PARTICLE_OFFSETS.map((offset, idx) => (
                    <m.span
                      key={idx}
                      initial={{ x: 0, y: 0, opacity: 1, scale: 1 }}
                      animate={{
                        x: offset.x,
                        y: offset.y,
                        opacity: 0,
                        scale: 0.4,
                      }}
                      transition={{ duration: 0.4, ease: ease.out }}
                      className="absolute h-1.5 w-1.5 rounded-[var(--radius-full)] bg-red"
                    />
                  ))}
                </span>
              )}
            </span>
          </button>

          {/* Badge en haut à droite */}
          <div className="pointer-events-none absolute top-3 right-3 z-10">
            {isSoldOut ? (
              <Badge variant="sold-out" />
            ) : isLowStock ? (
              <Badge variant="low-stock" lowStockCount={totalStock} />
            ) : isNew ? (
              <Badge variant="new" />
            ) : null}
          </div>
        </div>

        {/* Informations produit */}
        <div className="mt-3">
          <h3 className="line-clamp-2 text-h3 text-ink">{product.name}</h3>

          <div className="mt-1 flex items-center gap-2 text-small text-text-2">
            <span>{categoryLabel}</span>
            <span aria-hidden="true">·</span>
            <span
              className="inline-flex items-center gap-1"
              aria-label={`${product.colors.length} couleurs`}
            >
              {visibleColors.map((color) => (
                <span
                  key={color.code}
                  title={color.name}
                  className={cn(
                    'inline-block h-2.5 w-2.5 rounded-[var(--radius-full)] border',
                    COLOR_DOT_CLASSES[color.code] ?? 'bg-ink border-ink',
                  )}
                />
              ))}
              {extraColorsCount > 0 && (
                <span className="ml-0.5 text-xs font-semibold text-text-2">
                  +{extraColorsCount}
                </span>
              )}
            </span>
          </div>

          <div className="mt-1.5">
            <Price amount={product.price} className="text-[16px] text-ink" />
          </div>
        </div>
      </div>

      {/* Actions en bas de carte */}
      <div className="mt-3 flex items-center gap-2">
        {isSoldOut ? (
          <Button
            variant="outline"
            size="sm"
            fullWidth
            onClick={handleViewClick}
            className="min-h-[40px]"
          >
            Voir l&rsquo;article
          </Button>
        ) : (
          <>
            <Button
              variant="dark"
              size="sm"
              onClick={handleReserveClick}
              className="min-h-[40px] flex-1 px-3"
            >
              Réserver
            </Button>
            <Button
              variant="ghost"
              size="sm"
              iconLeft={<ShoppingBag className="h-3.5 w-3.5" aria-hidden="true" />}
              onClick={handleAddClick}
              className="min-h-[40px] px-2.5"
            >
              Ajouter
            </Button>
          </>
        )}
      </div>
    </m.article>
  );
}

export function ProductCardSkeleton({ className }: { className?: string }) {
  return (
    <div className={cn('flex flex-col justify-between', className)} aria-hidden="true">
      <div>
        <Skeleton className="aspect-[4/5] w-full" />
        <Skeleton className="mt-3 h-5 w-4/5" />
        <Skeleton className="mt-1.5 h-4 w-1/2" />
        <Skeleton className="mt-2 h-5 w-2/5" />
      </div>
      <div className="mt-3 flex items-center gap-2">
        <Skeleton className="h-9 flex-1" />
        <Skeleton className="h-9 w-20" />
      </div>
    </div>
  );
}
