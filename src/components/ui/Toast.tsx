import { Bell, CheckCircle2, X } from 'lucide-react';
import { AnimatePresence } from 'motion/react';
import * as m from 'motion/react-m';
import { Link } from 'react-router';
import { duration, ease } from '@/motion/tokens';
import { useToastStore } from '@/stores/toastStore';

const ACTION_TARGET_CLASS =
  'group inline-flex min-h-11 min-w-11 items-center justify-center px-1 text-caption font-bold text-white';
const ACTION_PILL_CLASS =
  'rounded-[var(--radius-sm)] bg-ink-2 px-2.5 py-1 underline-offset-2 group-hover:underline';

/**
 * Toaster (§5.9 & M2 §7.9 / §8) :
 * Message flash minimal en bas au-dessus de la barre de navigation sur mobile,
 * et en bas à droite sur ordinateur. Prend en charge une miniature produit et une action (lien ou bouton « Annuler »).
 * Toujours en haut de la pile du bas (index.css) : au-dessus de la barre basse ou de la barre d'action,
 * du bandeau rouge, du bandeau de mise à jour et du bouton WhatsApp. Feuille ou fenêtre ouverte :
 * déplacé hors de son bouton principal (classe `toaster`, index.css).
 */
export function Toaster() {
  const toasts = useToastStore((s) => s.toasts);
  const dismiss = useToastStore((s) => s.dismiss);

  return (
    <div
      aria-live="polite"
      className="toaster pointer-events-none fixed right-4 bottom-[calc(var(--bottom-bar-h)+var(--pending-banner-h)+var(--update-banner-h)+var(--floating-button-h)+16px)] left-4 z-toast flex flex-col items-center gap-2 lg:right-6 lg:bottom-[calc(var(--floating-button-h)+24px)] lg:left-auto lg:items-end"
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
            className="pointer-events-auto flex w-full max-w-md items-center justify-between gap-3 rounded-[var(--radius-md)] bg-ink py-2 pr-1.5 pl-4 text-small text-white shadow-[var(--shadow-sheet)]"
          >
            <div className="flex min-w-0 items-center gap-3">
              {toast.thumbnail ? (
                <img
                  src={toast.thumbnail}
                  alt=""
                  aria-hidden="true"
                  className="h-10 w-8 shrink-0 rounded-[var(--radius-sm)] bg-surface object-cover"
                />
              ) : toast.icon === 'bell' ? (
                <Bell className="h-4 w-4 shrink-0 text-silver" aria-hidden="true" />
              ) : (
                <CheckCircle2 className="h-4 w-4 shrink-0 text-red" aria-hidden="true" />
              )}
              <div className="min-w-0">
                {/* Message et texte secondaire sur deux lignes au plus : jamais coupés après quelques mots sur mobile */}
                <p className="line-clamp-2 font-medium">{toast.message}</p>
                {toast.subtitle && <p className="line-clamp-2 text-caption text-silver">{toast.subtitle}</p>}
              </div>
            </div>

            {/* Cibles de 44 px de haut ; la pastille visible garde sa taille */}
            <div className="flex shrink-0 items-center">
              {toast.actionLabel && toast.onAction && (
                <button
                  type="button"
                  onClick={() => {
                    toast.onAction?.();
                    dismiss(toast.id);
                  }}
                  className={ACTION_TARGET_CLASS}
                >
                  <span className={ACTION_PILL_CLASS}>{toast.actionLabel}</span>
                </button>
              )}
              {toast.actionLabel && toast.actionHref && !toast.onAction && (
                <Link
                  to={toast.actionHref}
                  viewTransition
                  onClick={() => dismiss(toast.id)}
                  className={ACTION_TARGET_CLASS}
                >
                  <span className={ACTION_PILL_CLASS}>{toast.actionLabel}</span>
                </Link>
              )}
              <button
                type="button"
                onClick={() => dismiss(toast.id)}
                aria-label="Fermer la notification"
                className="inline-flex h-11 w-11 items-center justify-center rounded-[var(--radius-sm)] text-silver transition-colors duration-fast hover:text-white"
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
