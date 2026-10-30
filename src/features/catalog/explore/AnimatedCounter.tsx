import { animate, useMotionValue } from 'motion/react';
import { useEffect, useState } from 'react';
import { useReducedMotionPref } from '@/motion/useReducedMotionPref';

export interface AnimatedCounterProps {
  value: number;
  className?: string;
}

/**
 * Compteur animé de résultats (§5.1) :
 * Interpole en douceur l'ancien nombre vers le nouveau en 0,25 s avec `tabular-nums`
 * et annonce la mise à jour aux lecteurs d'écran via `aria-live="polite"`.
 */
export function AnimatedCounter({ value, className }: AnimatedCounterProps) {
  const reducedMotion = useReducedMotionPref();
  const motionValue = useMotionValue(value);
  const [displayValue, setDisplayValue] = useState(value);

  useEffect(() => {
    if (reducedMotion) {
      const id = window.setTimeout(() => setDisplayValue(value), 0);
      motionValue.set(value);
      return () => window.clearTimeout(id);
    }

    const controls = animate(motionValue, value, {
      duration: 0.25,
      ease: [0.22, 1, 0.36, 1],
      onUpdate: (latest) => {
        setDisplayValue(Math.round(latest));
      },
    });

    return () => controls.stop();
  }, [motionValue, reducedMotion, value]);

  const label = `${displayValue} article${displayValue > 1 ? 's' : ''}`;

  return (
    <span aria-live="polite" className={className}>
      {label}
    </span>
  );
}
