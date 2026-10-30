import { X } from 'lucide-react';
import { AnimatePresence, type PanInfo } from 'motion/react';
import * as m from 'motion/react-m';
import { useEffect, useRef, type ReactNode } from 'react';
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
 */
export function Sheet({ open, onClose, title, children, className }: SheetProps) {
  const dialogRef = useRef<HTMLDivElement | null>(null);

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
            dragConstraints={{ top: 0, bottom: 0 }}
            dragElastic={{ top: 0, bottom: 0.35 }}
            onDragEnd={handleDragEnd}
            className={cn(
              'relative z-10 w-full max-w-lg rounded-t-[var(--radius-sheet)] bg-white p-5 pb-safe shadow-[var(--shadow-sheet)] lg:max-w-[440px] lg:rounded-[var(--radius-md)] lg:p-6',
              className,
            )}
          >
            {/* Poignée de glissement (mobile) */}
            <div
              aria-hidden="true"
              className="mx-auto mb-3 h-1 w-9 rounded-[var(--radius-full)] bg-silver lg:hidden"
            />

            <div className="flex items-center justify-between gap-4 border-b border-silver pb-3.5">
              <h2 className="text-h3 font-bold text-ink">{title}</h2>
              <button
                type="button"
                onClick={onClose}
                aria-label="Fermer la fenêtre"
                className="inline-flex h-11 w-11 items-center justify-center rounded-[var(--radius-full)] text-ink hover:bg-surface"
              >
                <X className="h-5 w-5" aria-hidden="true" />
              </button>
            </div>

            <div className="mt-4">{children}</div>
          </m.div>
        </div>
      )}
    </AnimatePresence>
  );
}
