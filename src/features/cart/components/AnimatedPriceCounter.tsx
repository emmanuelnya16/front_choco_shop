import { useEffect, useRef, useState } from 'react';
import { cn } from '@/lib/utils/cn';
import { formatPrice } from '@/lib/utils/price';
import { useReducedMotionPref } from '@/motion/useReducedMotionPref';

export interface AnimatedPriceCounterProps {
  amount: number;
  className?: string;
}

/**
 * Affiche un montant en FCFA qui défile comme un compteur lorsqu'il change (§4.1 & §6.1).
 * Annonce les changements aux lecteurs d'écran via `aria-live="polite"`.
 */
export function AnimatedPriceCounter({
  amount,
  className,
}: AnimatedPriceCounterProps) {
  const reducedMotion = useReducedMotionPref();
  const [displayed, setDisplayed] = useState(amount);
  const previousRef = useRef(amount);

  useEffect(() => {
    const startVal = previousRef.current;
    const endVal = amount;
    previousRef.current = amount;

    if (startVal === endVal) return;

    if (reducedMotion) {
      const id = requestAnimationFrame(() => setDisplayed(endVal));
      return () => cancelAnimationFrame(id);
    }

    const durationMs = 320;
    const startTime = performance.now();
    let rafId = 0;

    const tick = (now: number) => {
      const progress = Math.min(1, (now - startTime) / durationMs);
      const eased = 1 - Math.pow(1 - progress, 3);
      setDisplayed(Math.round(startVal + (endVal - startVal) * eased));
      if (progress < 1) {
        rafId = requestAnimationFrame(tick);
      } else {
        setDisplayed(endVal);
      }
    };

    rafId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafId);
  }, [amount, reducedMotion]);

  return (
    <span
      aria-live="polite"
      aria-atomic="true"
      className={cn('font-extrabold tabular-nums', className)}
    >
      {formatPrice(displayed)}
    </span>
  );
}
