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
import { cn } from '@/lib/utils/cn';
import { duration, ease } from '@/motion/tokens';
import type { ProductImageEntry } from '@/types/domain';

/** Photo de la visionneuse : `ratio` permet d'afficher une photo au format d'origine (photos du colis, M5). */
export type LightboxImage = ProductImageEntry & { ratio?: ImageAspectRatio; fit?: 'cover' | 'contain' };

/** Retour de la photo après un glissé ou un zoom (jetons de mouvement, M7 §4.4). */
const FRAME_TRANSITION = `transform ${duration.fast * 1000}ms cubic-bezier(${ease.out.join(', ')})`;

/**
 * Largeur du cadre photo selon son format : la plus petite entre la place disponible, 560 px et la hauteur
 * de la zone centrale (100cqh) multipliée par le format. La photo entière tient ainsi dans l'écran, même
 * peu haut (1024x768, téléphone à l'horizontale), au lieu d'être coupée en bas.
 */
const FRAME_WIDTH_CLASSES: Record<ImageAspectRatio, string> = {
  '4/5': 'w-[min(100%,560px,80cqh)]',
  '3/4': 'w-[min(100%,560px,75cqh)]',
  '1/1': 'w-[min(100%,560px,100cqh)]',
  '4/3': 'w-[min(100%,560px,133.33cqh)]',
  '16/10': 'w-[min(100%,560px,160cqh)]',
  '16/9': 'w-[min(100%,560px,177.78cqh)]',
  '2/1': 'w-[min(100%,560px,200cqh)]',
  auto: 'w-full max-w-[560px]',
};

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
        aria-label={label ?? `Visionneuse photo\u00a0: ${productName}`}
        initial={{ opacity: 0 }}
        animate={{ opacity: backdropOpacity }}
        exit={{ opacity: 0 }}
        transition={{ duration: duration.base, ease: ease.out }}
        className="fixed inset-0 z-toast flex flex-col justify-between bg-ink text-white select-none"
      >
        {/* Barre supérieure : Compteur (1 / 4) + actions éventuelles + Zoom + Fermer (×).
            Sous 640 px, les actions supplémentaires (« Enregistrer la photo ») passent sur une 2e ligne
            sous Zoom et Fermer : à 360 px, tout ne tient pas sur une ligne. */}
        <div className="relative z-10 flex flex-wrap items-center gap-2 px-4 pt-[calc(12px+env(safe-area-inset-top,0px))] pb-3">
          <span className="order-1 shrink-0 rounded-[var(--radius-full)] bg-ink-2 px-3 py-1 text-caption font-bold whitespace-nowrap text-white tabular-nums">
            {currentIndex + 1} / {images.length}
          </span>

          {renderActions && (
            <div className="order-3 flex w-full items-center justify-end gap-2 sm:order-2 sm:ml-auto sm:w-auto">
              {renderActions(activeEntry, currentIndex)}
            </div>
          )}

          {/* Zoom et Fermer toujours en haut à droite, après les actions supplémentaires s'il y en a */}
          <div
            className={cn(
              'order-2 ml-auto flex shrink-0 items-center gap-2',
              renderActions && 'sm:order-3 sm:ml-0',
            )}
          >
            <button
              type="button"
              onClick={() => handleToggleZoom()}
              aria-label={zoom > 1 ? 'Réduire le zoom' : 'Zoomer sur la photo'}
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

        {/* Zone centrale de l'image : conteneur de taille (unités cqh) pour adapter le cadre à sa hauteur */}
        <div
          onClick={handleImageClick}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          className="relative flex min-h-0 flex-1 items-center justify-center overflow-hidden px-4 py-2 [container-type:size]"
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
                : FRAME_TRANSITION,
            }}
            className={cn(
              'max-h-full cursor-zoom-in overflow-hidden rounded-[var(--radius-md)]',
              FRAME_WIDTH_CLASSES[activeEntry.ratio ?? '4/5'],
            )}
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
          {/* Aide selon l'appareil : gestes au doigt sur écran tactile, souris et clavier sur ordinateur */}
          <p className="text-caption text-silver">
            <span className="pointer-fine:hidden">
              Double-touchez pour zoomer · Glissez vers le bas pour fermer
            </span>
            <span className="hidden pointer-fine:inline">
              Double-cliquez pour zoomer · Échap pour fermer
            </span>
          </p>
        </div>
      </m.div>
    </AnimatePresence>
  );
}
