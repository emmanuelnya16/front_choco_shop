import { ChevronLeft, ChevronRight, X, ZoomIn, ZoomOut } from 'lucide-react';
import { AnimatePresence } from 'motion/react';
import * as m from 'motion/react-m';
import {
  useEffect,
  useRef,
  useState,
  type MouseEvent,
  type PointerEvent,
  type ReactNode,
} from 'react';
import { createPortal } from 'react-dom';
import { SmartImage, type ImageAspectRatio } from '@/components/ui/SmartImage';
import { useOverlayHistory } from '@/lib/hooks/useOverlayHistory';
import { duration, ease } from '@/motion/tokens';
import type { ProductImageEntry } from '@/types/domain';

/** Photo de la visionneuse : `ratio` permet d'afficher une photo au format d'origine (photos du colis, M5). */
export type LightboxImage = ProductImageEntry & { ratio?: ImageAspectRatio; fit?: 'cover' | 'contain' };

export interface ProductLightboxProps {
  open: boolean;
  onClose: () => void;
  images: LightboxImage[];
  initialIndex: number;
  productName: string;
  /** Libellé accessible de la visionneuse (par défaut « Visionneuse photo : <productName> »). */
  label?: string;
  /** Actions supplémentaires de la barre du haut (ex. « Enregistrer la photo », M5). */
  renderActions?: (image: LightboxImage, index: number) => ReactNode;
}

/**
 * Visionneuse plein écran (Lightbox, §7.3) :
 * - Modale accessible (`role="dialog"`, `aria-modal="true"`, fond `ink`)
 * - Balayage horizontal ou flèches clavier pour changer de photo
 * - Double-tap / double-clic ou bouton loupe pour zoomer à `2.5x` centré sur le point touché + déplacement libre
 * - Glissement vertical vers le bas (`> 120 px`) pour refermer la visionneuse
 * - Entrée d'historique à l'ouverture (M6 §8) : la touche retour d'Android ferme la visionneuse
 */
export function ProductLightbox({
  open,
  onClose,
  images,
  initialIndex,
  productName,
  label,
  renderActions,
}: ProductLightboxProps) {
  useOverlayHistory(open && images.length > 0, onClose);

  if (!open || typeof document === 'undefined' || images.length === 0) {
    return null;
  }

  return createPortal(
    <LightboxDialog
      key={initialIndex}
      images={images}
      initialIndex={initialIndex}
      productName={productName}
      label={label}
      renderActions={renderActions}
      onClose={onClose}
    />,
    document.body,
  );
}

function LightboxDialog({
  images,
  initialIndex,
  productName,
  label,
  renderActions,
  onClose,
}: {
  images: LightboxImage[];
  initialIndex: number;
  productName: string;
  label?: string;
  renderActions?: (image: LightboxImage, index: number) => ReactNode;
  onClose: () => void;
}) {
  const [currentIndex, setCurrentIndex] = useState(
    Math.min(Math.max(0, initialIndex), images.length - 1),
  );
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [dragDownY, setDragDownY] = useState(0);
  const [isDragging, setIsDragging] = useState(false);

  const lastTapRef = useRef<number>(0);
  const pointerStartRef = useRef<{ x: number; y: number; panX: number; panY: number } | null>(
    null,
  );
  const closeBtnRef = useRef<HTMLButtonElement>(null);

  const activeEntry = images[currentIndex] ?? images[0];

  const resetTransform = () => {
    setZoom(1);
    setPan({ x: 0, y: 0 });
    setDragDownY(0);
    setIsDragging(false);
  };

  const goPrev = () => {
    resetTransform();
    setCurrentIndex((prev) => (prev <= 0 ? images.length - 1 : prev - 1));
  };

  const goNext = () => {
    resetTransform();
    setCurrentIndex((prev) => (prev + 1) % images.length);
  };

  useEffect(() => {
    closeBtnRef.current?.focus();
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const handleKeyDown = (e: globalThis.KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      } else if (e.key === 'ArrowLeft') {
        setZoom(1);
        setPan({ x: 0, y: 0 });
        setCurrentIndex((prev) => (prev <= 0 ? images.length - 1 : prev - 1));
      } else if (e.key === 'ArrowRight') {
        setZoom(1);
        setPan({ x: 0, y: 0 });
        setCurrentIndex((prev) => (prev + 1) % images.length);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      document.body.style.overflow = prevOverflow;
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [images.length, onClose]);

  const handleToggleZoom = (clientX?: number, clientY?: number, rect?: DOMRect) => {
    if (zoom > 1) {
      resetTransform();
    } else {
      if (clientX !== undefined && clientY !== undefined && rect) {
        const offsetX = (rect.left + rect.width / 2 - clientX) * 0.8;
        const offsetY = (rect.top + rect.height / 2 - clientY) * 0.8;
        setPan({ x: offsetX, y: offsetY });
      }
      setZoom(2.5);
    }
  };

  const handleImageClick = (e: MouseEvent<HTMLDivElement>) => {
    const now = Date.now();
    const rect = e.currentTarget.getBoundingClientRect();
    if (now - lastTapRef.current < 300) {
      handleToggleZoom(e.clientX, e.clientY, rect);
      lastTapRef.current = 0;
    } else {
      lastTapRef.current = now;
    }
  };

  const handlePointerDown = (e: PointerEvent<HTMLDivElement>) => {
    setIsDragging(true);
    pointerStartRef.current = {
      x: e.clientX,
      y: e.clientY,
      panX: pan.x,
      panY: pan.y,
    };
  };

  const handlePointerMove = (e: PointerEvent<HTMLDivElement>) => {
    if (!pointerStartRef.current) return;
    const dx = e.clientX - pointerStartRef.current.x;
    const dy = e.clientY - pointerStartRef.current.y;

    if (zoom > 1) {
      setPan({
        x: pointerStartRef.current.panX + dx,
        y: pointerStartRef.current.panY + dy,
      });
    } else if (dy > 0 && Math.abs(dy) > Math.abs(dx)) {
      setDragDownY(dy);
    }
  };

  const handlePointerUp = (e: PointerEvent<HTMLDivElement>) => {
    setIsDragging(false);
    if (!pointerStartRef.current) return;
    const dx = e.clientX - pointerStartRef.current.x;
    const dy = e.clientY - pointerStartRef.current.y;
    pointerStartRef.current = null;

    if (zoom === 1) {
      if (dy > 120) {
        onClose();
        return;
      }
      setDragDownY(0);

      if (Math.abs(dx) > 60 && Math.abs(dx) > Math.abs(dy)) {
        if (dx < 0) {
          goNext();
        } else {
          goPrev();
        }
      }
    }
  };

  const backdropOpacity = Math.max(0.4, 1 - dragDownY / 320);

  return (
    <AnimatePresence>
      <m.div
        role="dialog"
        aria-modal="true"
        aria-label={label ?? `Visionneuse photo : ${productName}`}
        initial={{ opacity: 0 }}
        animate={{ opacity: backdropOpacity }}
        exit={{ opacity: 0 }}
        transition={{ duration: duration.base, ease: ease.out }}
        className="fixed inset-0 z-toast flex flex-col justify-between bg-ink text-white select-none"
      >
        {/* Barre supérieure : Compteur (1 / 4) + Zoom + Fermer (×) */}
        <div className="relative z-10 flex items-center justify-between px-4 pt-[calc(12px+env(safe-area-inset-top,0px))] pb-3">
          <span className="rounded-[var(--radius-full)] bg-ink-2 px-3 py-1 text-xs font-bold text-white tabular-nums">
            {currentIndex + 1} / {images.length}
          </span>

          <div className="flex items-center gap-2">
            {renderActions?.(activeEntry, currentIndex)}
            <button
              type="button"
              onClick={() => handleToggleZoom()}
              aria-label={zoom > 1 ? 'Réduire le zoom' : 'Zoomer à 2,5x'}
              className="inline-flex h-11 w-11 items-center justify-center rounded-[var(--radius-full)] bg-ink-2 text-white hover:bg-white/20"
            >
              {zoom > 1 ? (
                <ZoomOut className="h-5 w-5" aria-hidden="true" />
              ) : (
                <ZoomIn className="h-5 w-5" aria-hidden="true" />
              )}
            </button>

            <button
              ref={closeBtnRef}
              type="button"
              onClick={onClose}
              aria-label="Fermer la visionneuse"
              className="inline-flex h-11 w-11 items-center justify-center rounded-[var(--radius-full)] bg-ink-2 text-white hover:bg-white/20"
            >
              <X className="h-5 w-5" aria-hidden="true" />
            </button>
          </div>
        </div>

        {/* Zone centrale de l'image */}
        <div
          onClick={handleImageClick}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          className="relative flex flex-1 items-center justify-center overflow-hidden px-4"
        >
          {images.length > 1 && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                goPrev();
              }}
              aria-label="Photo précédente"
              className="absolute left-4 z-10 hidden h-11 w-11 items-center justify-center rounded-[var(--radius-full)] bg-ink-2/90 text-white hover:bg-white hover:text-ink lg:inline-flex"
            >
              <ChevronLeft className="h-5 w-5" aria-hidden="true" />
            </button>
          )}

          <div
            style={{
              transform: `translate3d(${pan.x}px, ${pan.y + dragDownY}px, 0) scale(${
                zoom > 1 ? zoom : Math.max(0.85, 1 - dragDownY / 1000)
              })`,
              transition: isDragging
                ? 'none'
                : 'transform 220ms cubic-bezier(0.22, 1, 0.36, 1)',
            }}
            className="max-h-[80dvh] w-full max-w-[560px] cursor-zoom-in overflow-hidden rounded-[var(--radius-md)]"
          >
            <SmartImage
              src={activeEntry.url}
              fallback={activeEntry.fallbackUrl}
              alt={activeEntry.alt ?? productName}
              ratio={activeEntry.ratio ?? '4/5'}
              imgClassName={activeEntry.fit === 'contain' ? 'object-contain' : undefined}
              priority
              className="h-full w-full"
            />
          </div>

          {images.length > 1 && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                goNext();
              }}
              aria-label="Photo suivante"
              className="absolute right-4 z-10 hidden h-11 w-11 items-center justify-center rounded-[var(--radius-full)] bg-ink-2/90 text-white hover:bg-white hover:text-ink lg:inline-flex"
            >
              <ChevronRight className="h-5 w-5" aria-hidden="true" />
            </button>
          )}
        </div>

        {/* Pied de visionneuse : légende + miniatures */}
        <div className="relative z-10 flex flex-col items-center gap-2 px-4 pt-4 pb-[calc(16px+env(safe-area-inset-bottom,0px))]">
          <p className="text-xs text-silver">
            Double-touchez pour zoomer · Glissez vers le bas pour fermer
          </p>
        </div>
      </m.div>
    </AnimatePresence>
  );
}
