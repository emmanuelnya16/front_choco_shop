import { AnimatePresence } from 'motion/react';
import * as m from 'motion/react-m';
import { cn } from '@/lib/utils/cn';
import { spring } from '@/motion/tokens';
import { useReducedMotionPref } from '@/motion/useReducedMotionPref';

/**
 * Repère rouge de 8 px (§8.2 M5) : apparaît avec le ressort `bounce` (échelle 0 → 1).
 * Purement visuel : le texte équivalent est fourni par l'élément parent (`sr-only`).
 */
export function AttentionDot({ show, className }: { show: boolean; className?: string }) {
  const reducedMotion = useReducedMotionPref();

  return (
    <AnimatePresence>
      {show && (
        <m.span
          key="attention-dot"
          aria-hidden="true"
          initial={reducedMotion ? false : { scale: 0 }}
          animate={{ scale: 1 }}
          exit={{ scale: 0 }}
          transition={spring.bounce}
          className={cn(
            'pointer-events-none absolute h-2 w-2 rounded-[var(--radius-full)] bg-red ring-2 ring-white',
            className,
          )}
        />
      )}
    </AnimatePresence>
  );
}
