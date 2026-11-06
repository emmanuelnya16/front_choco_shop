import { X } from 'lucide-react';
import { AnimatePresence, useDragControls, type PanInfo } from 'motion/react';
import * as m from 'motion/react-m';
import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent, type ReactNode } from 'react';
import { useOverlayHistory } from '@/lib/hooks/useOverlayHistory';
import { cn } from '@/lib/utils/cn';
import { fade, sheetUp } from '@/motion/presets';

export interface SheetProps {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  className?: string;
}

/**
 * Sheet (§5.8) :
 * Feuille montante sur mobile (avec fermeture par glissement vers le bas `drag="y"`,
 * clic sur le fond ou touche Échap, piège du focus et blocage du défilement),
 * et fenêtre centrée de 440 px sur ordinateur (`lg:`).
 * Entrée d'historique à l'ouverture (M6 §8) : la touche retour d'Android ferme d'abord la feuille.
 * Contenu long : le panneau est limité à 92 % de la hauteur et seul le corps défile ; la poignée,
 * le titre et le bouton Fermer restent visibles.
 */
export function Sheet({ open, onClose, title, children, className }: SheetProps) {
  const dialogRef = useRef<HTMLDivElement | null>(null);
  const bodyRef = useRef<HTMLDivElement | null>(null);
  const contentRef = useRef<HTMLDivElement | null>(null);
  const dragControls = useDragControls();
  const [bodyScrolls, setBodyScrolls] = useState(false);

  useOverlayHistory(open, onClose);

  // Le corps dépasse-t-il ? Mesuré à l'ouverture puis à chaque changement de taille du contenu
  // (ex. liste d'agences qui apparaît dans la feuille d'adresse).
  useEffect(() => {
    const body = bodyRef.current;
    const content = contentRef.current;
    if (!open || !body || !content || typeof ResizeObserver === 'undefined') return undefined;
    const observer = new ResizeObserver(() => {
      setBodyScrolls(body.scrollHeight > body.clientHeight + 1);
    });
    observer.observe(body);
    observer.observe(content);
    return () => observer.disconnect();
  }, [open]);

  useEffect(() => {
    if (!open) {
      return undefined;
    }

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        onClose();
        return;
      }

      if (event.key === 'Tab' && dialogRef.current) {
        const focusable = dialogRef.current.querySelectorAll<HTMLElement>(
          'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
        );
        if (focusable.length === 0) return;
        const first = focusable[0];
        const last = focusable[focusable.length - 1];

        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first.focus();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [open, onClose]);

  const handleDragEnd = (_: MouseEvent | TouchEvent | PointerEvent, info: PanInfo) => {
    if (info.offset.y > 120 || info.velocity.y > 500) {
      onClose();
    }
  };

  // Glissement vers le bas depuis toute la feuille. Quand le corps défile, le doigt posé dessus le fait
  // défiler (un geste rapide ne doit pas fermer la feuille) : on glisse alors par la poignée ou l'en-tête.
  // HYPOTHÈSE: pas de fermeture par glissement depuis un corps qui défile, même remonté en haut (geste ambigu).
  const handlePointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (bodyScrolls && bodyRef.current?.contains(event.target as Node)) return;
    dragControls.start(event);
  };

  return (
    <AnimatePresence>
      {open && (
        <div
          className="fixed inset-0 z-sheet flex items-end justify-center lg:items-center"
          role="dialog"
          aria-modal="true"
          aria-label={title}
        >
          {/* Fond assombri ink à 50 % */}
          <m.div
            variants={fade}
            initial="hidden"
            animate="visible"
            exit="exit"
            onClick={onClose}
            className="fixed inset-0 bg-[var(--color-scrim-50)] backdrop-blur-[2px]"
          />

          {/* Panneau de la feuille */}
          <m.div
            ref={dialogRef}
            variants={sheetUp}
            initial="hidden"
            animate="visible"
            exit="exit"
            drag="y"
            dragControls={dragControls}
            dragListener={false}
            onPointerDown={handlePointerDown}
            dragConstraints={{ top: 0, bottom: 0 }}
            dragElastic={{ top: 0, bottom: 0.35 }}
            onDragEnd={handleDragEnd}
            className={cn(
              // touch-pan-x : le glissement vertical revient à la feuille (comme le faisait l'écouteur de Motion)
              'relative z-10 flex max-h-[92dvh] w-full max-w-lg touch-pan-x flex-col rounded-t-[var(--radius-sheet)] bg-white p-5 pb-[calc(20px+env(safe-area-inset-bottom,0px))] shadow-[var(--shadow-sheet)] lg:max-w-110 lg:rounded-[var(--radius-md)] lg:p-6',
              className,
            )}
          >
            {/* Poignée de glissement (mobile) */}
            <div
              aria-hidden="true"
              className="mx-auto mb-3 h-1 w-9 shrink-0 rounded-[var(--radius-full)] bg-silver lg:hidden"
            />

            <div className="flex shrink-0 items-center justify-between gap-4 border-b border-silver pb-3.5 select-none">
              <h2 className="min-w-0 text-h3 font-bold text-ink">{title}</h2>
              {/* shrink-0 : un titre sur deux lignes n'écrase jamais le bouton (44 × 44 px) */}
              <button
                type="button"
                onClick={onClose}
                aria-label="Fermer la fenêtre"
                className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-[var(--radius-full)] text-ink transition-colors duration-fast hover:bg-surface"
              >
                <X className="h-5 w-5" aria-hidden="true" />
              </button>
            </div>

            {/* Corps : seul à défiler. Il couvre toute la largeur du panneau (-mx-5 px-5, lg:-mx-6 lg:px-6,
                comme le p-5 / lg:p-6 du panneau) : les contenus pleine largeur (carrousel en -mx-5) et les
                contours de focus ne sont pas rognés ; pt-1 et pb-1 -mb-1 font de même en haut et en bas. */}
            <div
              ref={bodyRef}
              data-sheet-body=""
              className={cn(
                '-mx-5 mt-3 -mb-1 min-h-0 overflow-y-auto overscroll-contain px-5 pt-1 pb-1 lg:-mx-6 lg:px-6',
                // Contenu court : le corps ne défile pas, le glissement vertical ferme la feuille
                !bodyScrolls && 'touch-pan-x',
              )}
            >
              <div ref={contentRef}>{children}</div>
            </div>
          </m.div>
        </div>
      )}
    </AnimatePresence>
  );
}
