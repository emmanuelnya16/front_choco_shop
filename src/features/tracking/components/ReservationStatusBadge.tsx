import { AnimatePresence, useAnimate } from 'motion/react';
import * as m from 'motion/react-m';
import { useEffect, useRef } from 'react';
import { cn } from '@/lib/utils/cn';
import { duration, ease } from '@/motion/tokens';
import { useReducedMotionPref } from '@/motion/useReducedMotionPref';
import {
  STATUS_META,
  type ReservationStatusCode,
  type StatusTone,
} from '@/types/reservationStatus';

// Contraste : le blanc sur rouge (4,0:1) est insuffisant pour du texte de 12 px,
// le ton « danger » garde donc un texte encre sur fond blanc, avec bordure et icône rouges.
const TONE_CLASSES: Record<StatusTone, string> = {
  neutral: 'border-silver bg-surface text-ink',
  warning: 'border-warning bg-warning text-white',
  success: 'border-success bg-success text-white',
  danger: 'border-red bg-white text-ink',
};

export interface ReservationStatusBadgeProps {
  status: ReservationStatusCode;
  size?: 'sm' | 'md';
  /** Anime le changement de statut (l'ancien sort vers le haut, le nouveau entre par le bas, puis pulsation). */
  animateChange?: boolean;
  className?: string;
}

export function ReservationStatusBadge({
  status,
  size = 'sm',
  animateChange = false,
  className,
}: ReservationStatusBadgeProps) {
  const reducedMotion = useReducedMotionPref();
  const meta = STATUS_META[status];
  const Icon = meta.Icon;
  const animated = animateChange && !reducedMotion;
  const [scope, animate] = useAnimate<HTMLSpanElement>();
  const previousStatus = useRef(status);

  // Pulsation après l'échange des libellés. L'élément extérieur ne change jamais de clé : l'AnimatePresence
  // intérieur reste monté, l'ancien libellé peut sortir vers le haut et le nouveau entrer par le bas.
  useEffect(() => {
    if (previousStatus.current === status) return;
    previousStatus.current = status;
    if (!animated || !scope.current) return;
    animate(scope.current, { scale: [1, 1.06, 1] }, { duration: 0.45, delay: 0.25, ease: ease.out });
  }, [status, animated, animate, scope]);

  return (
    <span
      ref={scope}
      className={cn(
        'relative inline-flex items-center overflow-hidden rounded-[var(--radius-full)] border',
        size === 'sm' ? 'h-6 px-2.5' : 'h-8 px-3',
        TONE_CLASSES[meta.tone],
        className,
      )}
    >
      <AnimatePresence mode="popLayout" initial={false}>
        <m.span
          key={status}
          initial={animated ? { y: '110%', opacity: 0 } : false}
          animate={{ y: 0, opacity: 1 }}
          exit={animated ? { y: '-110%', opacity: 0 } : { opacity: 0 }}
          transition={{ duration: duration.fast, ease: ease.out }}
          className="inline-flex items-center gap-1.5"
        >
          <Icon
            className={cn(
              'shrink-0',
              size === 'sm' ? 'h-3.5 w-3.5' : 'h-4 w-4',
              meta.tone === 'danger' && 'text-red',
            )}
            aria-hidden="true"
          />
          <span className={cn('text-label whitespace-nowrap', size === 'sm' && 'text-[11px]')}>
            {meta.label}
          </span>
        </m.span>
      </AnimatePresence>
    </span>
  );
}
