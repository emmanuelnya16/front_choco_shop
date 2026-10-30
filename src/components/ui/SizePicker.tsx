import { Check, ShoppingBag } from 'lucide-react';
import { useRef, useState } from 'react';
import { useNavigate } from 'react-router';
import { cn } from '@/lib/utils/cn';
import { haptic } from '@/lib/utils/haptics';
import { useCartStore } from '@/stores/cartStore';
import { useToastStore } from '@/stores/toastStore';
import { useUiStore, type SizePickerIntent } from '@/stores/uiStore';
import type { Product, ProductColor } from '@/types/domain';
import { Button } from './Button';
import { Price } from './Primitives';
import { Sheet } from './Sheet';
import { SmartImage } from './SmartImage';

const COLOR_SWATCH_CLASSES: Record<string, string> = {
  noir: 'bg-ink border-ink',
  blanc: 'bg-surface border-silver',
  rouge: 'bg-red border-red',
  gris: 'bg-grey border-grey',
};

export interface SizePickerProps {
  product: Product | null;
  intent?: SizePickerIntent;
  open: boolean;
  onClose: () => void;
}

/**
 * SizePicker (§5.8 & M2 §7.9) :
 * Permet de choisir la couleur et la taille disponible avant d'ajouter au panier
 * (avec animation d'envol de la photo vers le panier) ou d'enchaîner vers `/panier` lors d'un clic sur « Réserver ».
 */
export function SizePicker({ product, intent = 'add', open, onClose }: SizePickerProps) {
  if (!product) {
    return null;
  }

  return (
    <Sheet open={open} onClose={onClose} title="Choisir votre taille">
      <SizePickerContent
        key={product.id}
        product={product}
        intent={intent}
        onClose={onClose}
      />
    </Sheet>
  );
}

function SizePickerContent({
  product,
  intent,
  onClose,
}: {
  product: Product;
  intent: SizePickerIntent;
  onClose: () => void;
}) {
  const navigate = useNavigate();
  const addToCart = useCartStore((s) => s.add);
  const showToast = useToastStore((s) => s.show);
  const sizePickerSourceRect = useUiStore((s) => s.sizePickerSourceRect);
  const triggerFlyToCart = useUiStore((s) => s.triggerFlyToCart);
  const bumpCartBounce = useUiStore((s) => s.bumpCartBounce);
  const openCartDrawer = useUiStore((s) => s.openCartDrawer);
  const requireAuth = useUiStore((s) => s.requireAuth);

  const thumbRef = useRef<HTMLDivElement>(null);

  // Choisit par défaut la première couleur ayant du stock
  const [selectedColorCode, setSelectedColorCode] = useState<string>(() => {
    const colorWithStock = product.colors.find((c) =>
      product.variants.some((v) => v.colorCode === c.code && v.stock > 0),
    );
    return colorWithStock?.code ?? product.colors[0]?.code ?? 'noir';
  });

  // Pré-sélectionne la première taille en stock pour la couleur active
  const [selectedSize, setSelectedSize] = useState<string | null>(() => {
    const initialColor =
      product.colors.find((c) =>
        product.variants.some((v) => v.colorCode === c.code && v.stock > 0),
      )?.code ??
      product.colors[0]?.code ??
      'noir';
    const firstAvailable = product.variants.find(
      (v) => v.colorCode === initialColor && v.stock > 0,
    );
    return firstAvailable?.size ?? null;
  });

  const activeColor: ProductColor =
    product.colors.find((c) => c.code === selectedColorCode) ??
    product.colors[0] ?? { code: 'noir', name: 'Noir Charbon', hex: '' };

  const variantsForColor = product.variants.filter(
    (v) => v.colorCode === activeColor.code,
  );

  const selectedVariant = variantsForColor.find((v) => v.size === selectedSize);

  const handleSelectColor = (colorCode: string) => {
    setSelectedColorCode(colorCode);
    const currentSizeVariant = product.variants.find(
      (v) => v.colorCode === colorCode && v.size === selectedSize && v.stock > 0,
    );
    if (!currentSizeVariant) {
      const firstAvail = product.variants.find(
        (v) => v.colorCode === colorCode && v.stock > 0,
      );
      setSelectedSize(firstAvail?.size ?? null);
    }
  };

  const handleConfirm = () => {
    if (!selectedVariant || selectedVariant.stock <= 0) {
      return;
    }

    const imageSrc =
      product.images[0] ?? product.fallbackImages[0] ?? '/mock/product-tee.svg';
    const fallbackSrc = product.fallbackImages[0] ?? '/mock/product-tee.svg';

    // Capture la position source pour l'animation d'envol vers le panier (§7.9)
    let sourceRect = sizePickerSourceRect;
    if (!sourceRect && thumbRef.current) {
      const r = thumbRef.current.getBoundingClientRect();
      sourceRect = { x: r.left, y: r.top, width: r.width, height: r.height };
    }

    addToCart({
      productId: product.id,
      slug: product.slug,
      name: product.name,
      image: fallbackSrc,
      variantId: selectedVariant.id,
      size: selectedVariant.size,
      color: activeColor,
      unitPrice: product.price,
      quantity: 1,
      maxQuantity: selectedVariant.stock,
    });

    haptic('success');
    onClose();

    if (intent === 'reserve') {
      bumpCartBounce();
      requireAuth(() => {
        navigate('/reservation', { viewTransition: true });
      });
      return;
    }

    if (sourceRect) {
      triggerFlyToCart({
        image: imageSrc,
        fallback: fallbackSrc,
        sourceRect,
      });
    } else {
      bumpCartBounce();
    }

    if (typeof window !== 'undefined' && window.innerWidth >= 1024) {
      openCartDrawer(true);
    } else {
      showToast({
        message: `${product.name} ajouté au panier`,
        subtitle: `${activeColor.name} · Taille ${selectedVariant.size}`,
        thumbnail: fallbackSrc,
        actionLabel: 'Voir le panier',
        actionHref: '/panier',
      });
    }
  };

  return (
    <div className="space-y-5">
      {/* En-tête miniature produit */}
      <div className="flex items-center gap-3.5">
        <div
          ref={thumbRef}
          className="h-20 w-16 shrink-0 overflow-hidden rounded-[var(--radius-sm)] bg-surface"
        >
          <SmartImage
            src={product.images[0] ?? '/mock/product-tee.svg'}
            fallback={product.fallbackImages[0] ?? '/mock/product-tee.svg'}
            alt={product.name}
            ratio="4/5"
            className="h-full w-full"
          />
        </div>
        <div className="min-w-0">
          <h3 className="truncate text-h3 text-ink">{product.name}</h3>
          <Price amount={product.price} className="mt-1 block text-body text-ink" />
          <p className="mt-0.5 text-xs text-text-2">
            Stock bloqué 24 h dès validation de votre réservation
          </p>
        </div>
      </div>

      {/* Sélecteur de couleur */}
      {product.colors.length > 0 && (
        <div>
          <p className="text-label text-text-2">
            COULEUR : <span className="text-ink">{activeColor.name}</span>
          </p>
          <div className="mt-2 flex flex-wrap items-center gap-2.5">
            {product.colors.map((color) => {
              const isSelected = color.code === activeColor.code;
              const isColorSoldOut = !product.variants.some(
                (v) => v.colorCode === color.code && v.stock > 0,
              );
              return (
                <button
                  key={color.code}
                  type="button"
                  onClick={() => handleSelectColor(color.code)}
                  className={cn(
                    'inline-flex min-h-[44px] items-center gap-2 rounded-[var(--radius-md)] border px-3 py-1.5 text-small font-semibold transition-colors',
                    isSelected
                      ? 'border-ink bg-ink text-white'
                      : 'border-silver bg-white text-ink hover:bg-surface',
                    isColorSoldOut && !isSelected && 'opacity-60',
                  )}
                >
                  <span
                    className={cn(
                      'relative h-3.5 w-3.5 overflow-hidden rounded-[var(--radius-full)] border',
                      COLOR_SWATCH_CLASSES[color.code] ?? 'bg-ink border-ink',
                    )}
                  >
                    {isColorSoldOut && (
                      <span
                        aria-hidden="true"
                        className="absolute inset-x-[-2px] top-1/2 h-[1.5px] -translate-y-1/2 -rotate-45 bg-red"
                      />
                    )}
                  </span>
                  <span className={cn(isColorSoldOut && 'line-through')}>
                    {color.name}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Grille de tailles (boutons de 48 px) */}
      <div>
        <div className="flex items-center justify-between">
          <p className="text-label text-text-2">TAILLE</p>
          {selectedVariant &&
            selectedVariant.stock > 0 &&
            selectedVariant.stock <= 2 && (
              <span className="text-xs font-semibold text-warning">
                Plus que {selectedVariant.stock} en taille {selectedVariant.size}
              </span>
            )}
        </div>

        <div className="mt-2 grid grid-cols-5 gap-2">
          {product.sizes.map((size) => {
            const variant = variantsForColor.find((v) => v.size === size);
            const stock = variant?.stock ?? 0;
            const outOfStock = stock <= 0;
            const isSelected = selectedSize === size && !outOfStock;

            return (
              <button
                key={size}
                type="button"
                disabled={outOfStock}
                onClick={() => setSelectedSize(size)}
                aria-label={
                  outOfStock
                    ? `Taille ${size} (Épuisée)`
                    : `Taille ${size} (${stock} en stock)`
                }
                aria-pressed={isSelected}
                className={cn(
                  'relative flex h-12 items-center justify-center rounded-[var(--radius-md)] border text-small font-bold transition-colors',
                  outOfStock
                    ? 'cursor-not-allowed border-silver bg-surface text-silver line-through opacity-60'
                    : isSelected
                      ? 'border-ink bg-ink text-white'
                      : 'border-silver bg-white text-ink hover:border-ink',
                )}
              >
                {size === 'Unique' ? 'Taille unique' : size}
              </button>
            );
          })}
        </div>
      </div>

      {/* Bouton principal d'ajout au panier */}
      <Button
        variant="primary"
        size="lg"
        fullWidth
        disabled={!selectedVariant || selectedVariant.stock <= 0}
        iconLeft={
          intent === 'reserve' ? (
            <Check className="h-4 w-4" aria-hidden="true" />
          ) : (
            <ShoppingBag className="h-4 w-4" aria-hidden="true" />
          )
        }
        onClick={handleConfirm}
      >
        {intent === 'reserve' ? 'Continuer vers la réservation' : 'Ajouter au panier'}
      </Button>
    </div>
  );
}
