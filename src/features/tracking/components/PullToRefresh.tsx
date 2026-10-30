import { animate, useMotionValue, useTransform } from 'motion/react';
import * as m from 'motion/react-m';
import { RefreshCw } from 'lucide-react';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { haptic } from '@/lib/utils/haptics';
import { cn } from '@/lib/utils/cn';
import { spring } from '@/motion/tokens';

/** Distance de tirage (après amortissement) au-delà de laquelle relâcher lance l'actualisation (§4.3 M5). */
export const PULL_THRESHOLD_PX = 72;
const MAX_PULL_PX = 120;
const HOLD_PX = 56;
const RESISTANCE = 0.5;

export interface PullToRefreshProps {
  onRefresh: () => Promise<unknown>;
  disabled?: boolean;
  children: ReactNode;
}

/**
 * Tirer pour actualiser (§4.3 M5), léger et sans dépendance :
 * l'indicateur rond descend (`y`) et tourne proportionnellement (`rotate`), puis tourne en continu
 * pendant le rechargement. Actif uniquement sur écran tactile, quand la page est tout en haut.
 */
export function PullToRefresh({ onRefresh, disabled = false, children }: PullToRefreshProps) {
  const pull = useMotionValue(0);
  const rotate = useTransform(pull, [0, PULL_THRESHOLD_PX], [0, 300]);
  const opacity = useTransform(pull, [0, 20, PULL_THRESHOLD_PX], [0, 0.5, 1]);
  const scale = useTransform(pull, [0, PULL_THRESHOLD_PX], [0.6, 1]);
  const [refreshing, setRefreshing] = useState(false);
  const refreshingRef = useRef(false);
  const onRefreshRef = useRef(onRefresh);

  useEffect(() => {
    onRefreshRef.current = onRefresh;
  }, [onRefresh]);

  // Empêche le rechargement natif du navigateur (Chrome Android) quand on tire depuis le haut
  useEffect(() => {
    const root = document.documentElement;
    const previous = root.style.overscrollBehaviorY;
    root.style.overscrollBehaviorY = 'contain';
    return () => {
      root.style.overscrollBehaviorY = previous;
    };
  }, []);

  useEffect(() => {
    if (disabled || typeof window === 'undefined') return undefined;
    if (!window.matchMedia?.('(pointer: coarse)').matches) return undefined;

    let startY: number | null = null;
    let pulling = false;

    const onTouchStart = (event: TouchEvent) => {
      if (refreshingRef.current || window.scrollY > 0 || event.touches.length !== 1) return;
      startY = event.touches[0]!.clientY;
      pulling = false;
    };

    const onTouchMove = (event: TouchEvent) => {
      if (startY === null) return;
      const delta = event.touches[0]!.clientY - startY;
      if (delta <= 0 || window.scrollY > 0) {
        if (pulling) pull.set(0);
        return;
      }
      pulling = true;
      pull.set(Math.min(MAX_PULL_PX, delta * RESISTANCE));
    };

    const onTouchEnd = async () => {
      if (startY === null) return;
      startY = null;
      if (!pulling) return;
      pulling = false;

      if (pull.get() < PULL_THRESHOLD_PX) {
        animate(pull, 0, spring.snappy);
        return;
      }

      refreshingRef.current = true;
      setRefreshing(true);
      haptic('light');
      animate(pull, HOLD_PX, spring.snappy);
      try {
        await onRefreshRef.current();
      } finally {
        refreshingRef.current = false;
        setRefreshing(false);
        animate(pull, 0, spring.sheet);
      }
    };

    window.addEventListener('touchstart', onTouchStart, { passive: true });
    window.addEventListener('touchmove', onTouchMove, { passive: true });
    window.addEventListener('touchend', onTouchEnd);
    window.addEventListener('touchcancel', onTouchEnd);
    return () => {
      window.removeEventListener('touchstart', onTouchStart);
      window.removeEventListener('touchmove', onTouchMove);
      window.removeEventListener('touchend', onTouchEnd);
      window.removeEventListener('touchcancel', onTouchEnd);
    };
  }, [disabled, pull]);

  return (
    <>
      <div
        aria-hidden="true"
        className="pointer-events-none fixed top-[calc(var(--header-h)+env(safe-area-inset-top,0px)-28px)] left-1/2 z-sticky -translate-x-1/2 lg:hidden"
      >
        <m.div
          style={{ y: pull, opacity, scale }}
          className="flex h-10 w-10 items-center justify-center rounded-[var(--radius-full)] bg-white shadow-[var(--shadow-card-icon)]"
        >
          <m.span style={{ rotate }} className="flex">
            <RefreshCw className={cn('h-5 w-5 text-ink', refreshing && 'animate-spin')} />
          </m.span>
        </m.div>
      </div>
      <span role="status" aria-live="polite" className="sr-only">
        {refreshing ? 'Actualisation des réservations…' : ''}
      </span>
      {children}
    </>
  );
}
