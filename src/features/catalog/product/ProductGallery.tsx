import { Expand } from 'lucide-react';
import {
  useEffect,
  useRef,
  type MouseEvent,
  type RefObject,
  type UIEvent,
} from 'react';
import { Badge } from '@/components/ui/Badge';
import { SmartImage } from '@/components/ui/SmartImage';
import { cn } from '@/lib/utils/cn';
import { useReducedMotionPref } from '@/motion/useReducedMotionPref';
import type { ProductImageEntry } from '@/types/domain';

export interface ProductGalleryProps {
  slug: string;
  images: ProductImageEntry[];
  activeIndex: number;
  onActiveIndexChange: (index: number) => void;
  onOpenLightbox: (index: number) => void;
  mainImageRef: RefObject<HTMLDivElement | null>;
  isSoldOut: boolean;
  isLowStock: boolean;
  totalStock: number;
  isNew: boolean;
}

/**
 * Galerie photo produit (§7.2) :
 * - Mobile (`< lg`) : Carrousel horizontal plein bord `4:5` avec `scroll-snap-type: x mandatory`,
 *   pastilles de pagination (`20×6 px` rouge pour l'image active) et badge compteur (`1 / 4`).
 * - Ordinateur (`lg:`) : Colonne verticale de miniatures `72 px` à gauche + grande image principale `4:5`
 *   avec loupe fluide au survol (`1.8x` piloté par `gsap.quickTo`) et ouverture de la visionneuse au clic.
 */
export function ProductGallery({
  slug,
  images,
  activeIndex,
  onActiveIndexChange,
  onOpenLightbox,
  mainImageRef,
  isSoldOut,
  isLowStock,
  totalStock,
  isNew,
}: ProductGalleryProps) {
  const reducedMotion = useReducedMotionPref();
  const mobileCarouselRef = useRef<HTMLDivElement>(null);
  const desktopZoomImgRef = useRef<HTMLDivElement>(null);
  const quickXRef = useRef<((v: number) => void) | null>(null);
  const quickYRef = useRef<((v: number) => void) | null>(null);
  const isProgrammaticScrollRef = useRef(false);

  const safeIndex = Math.min(Math.max(0, activeIndex), Math.max(0, images.length - 1));
  const activeImage = images[safeIndex] ?? images[0];

  // Synchronise la position du carrousel mobile lorsque `activeIndex` change (ex. sélection d'une couleur)
  useEffect(() => {
    const container = mobileCarouselRef.current;
    if (!container) return;
    const width = container.clientWidth;
    if (width <= 0) return;

    const targetLeft = safeIndex * width;
    if (Math.abs(container.scrollLeft - targetLeft) > 8) {
      isProgrammaticScrollRef.current = true;
      container.scrollTo({
        left: targetLeft,
        behavior: reducedMotion ? 'auto' : 'smooth',
      });
      const timer = window.setTimeout(() => {
        isProgrammaticScrollRef.current = false;
      }, 350);
      return () => window.clearTimeout(timer);
    }
  }, [reducedMotion, safeIndex]);

  const handleMobileScroll = (e: UIEvent<HTMLDivElement>) => {
    if (isProgrammaticScrollRef.current) return;
    const container = e.currentTarget;
    if (container.clientWidth <= 0) return;
    const nextIdx = Math.round(container.scrollLeft / container.clientWidth);
    if (nextIdx !== safeIndex && nextIdx >= 0 && nextIdx < images.length) {
      onActiveIndexChange(nextIdx);
    }
  };

  // Loupe au survol sur ordinateur (1.8x via gsap.quickTo, §7.2)
  const handleDesktopMouseEnter = () => {
    if (reducedMotion || !desktopZoomImgRef.current) return;
    if (
      typeof window !== 'undefined' &&
      !window.matchMedia('(hover: hover)').matches
    ) {
      return;
    }

    void import('@/lib/gsap').then(({ gsap }) => {
      const node = desktopZoomImgRef.current;
      if (!node) return;
      gsap.to(node, { scale: 1.8, duration: 0.25, ease: 'power2.out' });
      quickXRef.current = gsap.quickTo(node, 'xPercent', {
        duration: 0.25,
        ease: 'power2.out',
      });
      quickYRef.current = gsap.quickTo(node, 'yPercent', {
        duration: 0.25,
        ease: 'power2.out',
      });
    });
  };

  const handleDesktopMouseMove = (e: MouseEvent<HTMLDivElement>) => {
    if (!quickXRef.current || !quickYRef.current) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const relX = (e.clientX - rect.left) / rect.width - 0.5;
    const relY = (e.clientY - rect.top) / rect.height - 0.5;
    quickXRef.current(-relX * 38);
    quickYRef.current(-relY * 38);
  };

  const handleDesktopMouseLeave = () => {
    if (!desktopZoomImgRef.current) return;
    void import('@/lib/gsap').then(({ gsap }) => {
      const node = desktopZoomImgRef.current;
      if (!node) return;
      gsap.to(node, {
        scale: 1,
        xPercent: 0,
        yPercent: 0,
        duration: 0.28,
        ease: 'power2.out',
      });
    });
  };

  return (
    <div ref={mainImageRef}>
      {/* =====================================================================
       * GALERIE MOBILE (< lg) : Carrousel plein bord 4:5 scroll-snap
       * ===================================================================== */}
      <div className="relative w-full bg-surface lg:hidden">
        <div
          ref={mobileCarouselRef}
          onScroll={handleMobileScroll}
          className="no-scrollbar flex aspect-[4/5] w-full snap-x snap-mandatory overflow-x-auto"
        >
          {images.map((img, idx) => (
            <div
              key={`${img.url}-${idx}`}
              style={
                idx === 0 ? { viewTransitionName: `product-${slug}` } : undefined
              }
              onClick={() => onOpenLightbox(idx)}
              className="relative aspect-[4/5] w-full shrink-0 snap-center cursor-zoom-in overflow-hidden"
            >
              <SmartImage
                src={img.url}
                fallback={img.fallbackUrl}
                alt={img.alt ?? slug}
                ratio="4/5"
                priority={idx === 0}
                sizes="100vw"
                className="h-full w-full"
              />
            </div>
          ))}
        </div>

        {/* Pastilles de pagination en bas au centre + compteur 1 / N en bas à droite (§7.2) */}
        <div className="pointer-events-none absolute right-4 bottom-9 left-4 z-10 flex items-center justify-between">
          <div className="w-12" aria-hidden="true" />

          {images.length > 1 && (
            <div className="pointer-events-auto flex items-center gap-1.5 rounded-[var(--radius-full)] bg-[var(--color-scrim-40)] px-2.5 py-1.5 backdrop-blur-xs">
              {images.map((_, idx) => {
                const isActive = idx === safeIndex;
                return (
                  <button
                    key={idx}
                    type="button"
                    aria-label={`Voir la photo ${idx + 1}`}
                    onClick={() => onActiveIndexChange(idx)}
                    className={cn(
                      'h-1.5 rounded-[var(--radius-full)] transition-all duration-200',
                      isActive ? 'w-5 bg-red' : 'w-1.5 bg-silver',
                    )}
                  />
                );
              })}
            </div>
          )}

          <span className="rounded-[var(--radius-full)] bg-[var(--color-scrim-55)] px-2.5 py-1 text-[11px] font-bold text-white tabular-nums">
            {safeIndex + 1} / {images.length}
          </span>
        </div>
      </div>

      {/* =====================================================================
       * GALERIE ORDINATEUR (lg:) : Miniatures verticales 72 px + Image 4:5 avec loupe 1.8x
       * ===================================================================== */}
      <div className="hidden gap-4 lg:flex">
        {/* Colonne de miniatures verticales (72 px de large) */}
        <div className="flex w-[72px] shrink-0 flex-col gap-3">
          {images.map((img, idx) => {
            const isActive = idx === safeIndex;
            return (
              <button
                key={`thumb-${idx}`}
                type="button"
                onClick={() => onActiveIndexChange(idx)}
                aria-label={`Afficher la photo ${idx + 1}`}
                aria-current={isActive ? 'true' : undefined}
                className={cn(
                  'aspect-[4/5] w-full overflow-hidden rounded-[var(--radius-sm)] border-2 bg-surface transition-all',
                  isActive
                    ? 'border-ink opacity-100'
                    : 'border-transparent opacity-70 hover:opacity-100',
                )}
              >
                <SmartImage
                  src={img.url}
                  fallback={img.fallbackUrl}
                  alt={img.alt ?? slug}
                  ratio="4/5"
                  sizes="72px"
                  className="h-full w-full"
                />
              </button>
            );
          })}
        </div>

        {/* Grande image principale 4:5 (hauteur max 760 px) */}
        <div
          style={{ viewTransitionName: `product-${slug}` }}
          onClick={() => onOpenLightbox(safeIndex)}
          onMouseEnter={handleDesktopMouseEnter}
          onMouseMove={handleDesktopMouseMove}
          onMouseLeave={handleDesktopMouseLeave}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              onOpenLightbox(safeIndex);
            }
          }}
          aria-label={`Agrandir la photo de ${activeImage?.alt ?? ''}`}
          className="group relative aspect-[4/5] max-h-[760px] flex-1 cursor-zoom-in overflow-hidden rounded-[var(--radius-md)] bg-surface"
        >
          <div ref={desktopZoomImgRef} className="h-full w-full will-change-transform">
            {activeImage && (
              <SmartImage
                src={activeImage.url}
                fallback={activeImage.fallbackUrl}
                alt={activeImage.alt ?? slug}
                ratio="4/5"
                priority
                sizes="(max-width: 1280px) 52vw, 680px"
                className="h-full w-full"
              />
            )}
          </div>

          {/* Badge produit en haut à gauche */}
          <div className="pointer-events-none absolute top-4 left-4 z-10">
            {isSoldOut ? (
              <Badge variant="sold-out" />
            ) : isLowStock ? (
              <Badge variant="low-stock" lowStockCount={totalStock} />
            ) : isNew ? (
              <Badge variant="new" />
            ) : null}
          </div>

          {/* Bouton discret d'ouverture plein écran en bas à droite */}
          <span className="pointer-events-none absolute right-4 bottom-4 inline-flex items-center gap-1.5 rounded-[var(--radius-full)] bg-white/90 px-3 py-1.5 text-xs font-bold text-ink shadow-[var(--shadow-card-icon)] transition-transform group-hover:scale-105">
            <Expand className="h-3.5 w-3.5" aria-hidden="true" />
            <span>Plein écran</span>
          </span>
        </div>
      </div>
    </div>
  );
}
