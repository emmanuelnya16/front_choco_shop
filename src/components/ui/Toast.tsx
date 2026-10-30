import { CheckCircle2, X } from 'lucide-react';
import { AnimatePresence } from 'motion/react';
import * as m from 'motion/react-m';
import { Link } from 'react-router';
import { duration, ease } from '@/motion/tokens';
import { useToastStore } from '@/stores/toastStore';

/**
 * Toaster (§5.9 & M2 §7.9 / §8) :
 * Message flash minimal en bas au-dessus de la barre de navigation sur mobile,
 * et en bas à droite sur ordinateur. Prend en charge une miniature produit et une action (lien ou bouton « Annuler »).
 */
export function Toaster() {
  const toasts = useToastStore((s) => s.toasts);
  const dismiss = useToastStore((s) => s.dismiss);

  return (
    <div
      aria-live="polite"
      className="pointer-events-none fixed right-4 bottom-[calc(var(--bottom-nav-h)+16px)] left-4 z-toast flex flex-col items-center gap-2 lg:right-6 lg:bottom-6 lg:left-auto lg:items-end"
    >
      <AnimatePresence>
        {toasts.map((toast) => (
          <m.div
            key={toast.id}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 12 }}
            transition={{ duration: duration.base, ease: ease.out }}
            role="status"
            className="pointer-events-auto flex w-full max-w-md items-center justify-between gap-3 rounded-[var(--radius-md)] bg-ink px-4 py-3 text-small text-white shadow-[var(--shadow-sheet)]"
          >
            <div className="flex min-w-0 items-center gap-3">
              {toast.thumbnail ? (
                <img
                  src={toast.thumbnail}
                  alt=""
                  aria-hidden="true"
                  className="h-10 w-8 shrink-0 rounded-[var(--radius-sm)] bg-surface object-cover"
                />
              ) : (
                <CheckCircle2 className="h-4 w-4 shrink-0 text-red" aria-hidden="true" />
              )}
              <div className="min-w-0">
                <p className="truncate font-medium">{toast.message}</p>
                {toast.subtitle && (
                  <p className="truncate text-xs text-silver">{toast.subtitle}</p>
                )}
              </div>
            </div>

            <div className="flex shrink-0 items-center gap-2">
              {toast.actionLabel && toast.onAction && (
                <button
                  type="button"
                  onClick={() => {
                    toast.onAction?.();
                    dismiss(toast.id);
                  }}
                  className="rounded-[var(--radius-sm)] bg-ink-2 px-2.5 py-1 text-xs font-bold text-white underline-offset-2 hover:underline"
                >
                  {toast.actionLabel}
                </button>
              )}
              {toast.actionLabel && toast.actionHref && !toast.onAction && (
                <Link
                  to={toast.actionHref}
                  viewTransition
                  onClick={() => dismiss(toast.id)}
                  className="rounded-[var(--radius-sm)] bg-ink-2 px-2.5 py-1 text-xs font-bold text-white underline-offset-2 hover:underline"
                >
                  {toast.actionLabel}
                </Link>
              )}
              <button
                type="button"
                onClick={() => dismiss(toast.id)}
                aria-label="Fermer la notification"
                className="inline-flex h-7 w-7 items-center justify-center rounded-[var(--radius-sm)] text-silver hover:text-white"
              >
                <X className="h-4 w-4" aria-hidden="true" />
              </button>
            </div>
          </m.div>
        ))}
      </AnimatePresence>
    </div>
  );
}
