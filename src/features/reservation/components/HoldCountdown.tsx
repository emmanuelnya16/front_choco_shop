import { useCallback, useEffect, useRef, useState } from 'react';
import { cn } from '@/lib/utils/cn';
import { useReservationStore } from '@/stores/reservationStore';

export type HoldCountdownVariant = 'ring' | 'inline' | 'compact';

export interface HoldCountdownProps {
  expiresAt: string | Date;
  serverTime?: string | Date;
  totalHoldHours?: number;
  variant?: HoldCountdownVariant;
  onExpire?: () => void;
  className?: string;
}

const TWO_HOURS_MS = 2 * 60 * 60 * 1000;
const THIRTY_MINUTES_MS = 30 * 60 * 1000;
const ONE_HOUR_MS = 60 * 60 * 1000;

/**
 * Calcule le décalage d'horloge entre le serveur et le téléphone une seule fois à la réception (§7.3).
 */
function computeServerClockOffsetMs(
  serverTime?: string | Date,
  fallbackOffsetMs = 0,
): number {
  if (!serverTime) return fallbackOffsetMs;
  const serverMs =
    serverTime instanceof Date
      ? serverTime.getTime()
      : new Date(serverTime).getTime();
  if (Number.isNaN(serverMs)) return fallbackOffsetMs;
  return serverMs - Date.now();
}

/**
 * Composant `HoldCountdown` (§7.3) :
 * - Corrige le décalage d'horloge du téléphone grâce à `serverTime`.
 * - Variantes : `'ring'` (anneau SVG 72 px), `'inline'` (« Réservé encore 23 h 58 min »), `'compact'` (« 23:58 »).
 * - Couleurs : `ink` (> 2 h), `warning` (entre 2 h et 30 min), `red` (<= 30 min).
 * - Se met en pause lorsque l'onglet est masqué et recalcule dès le retour au premier plan.
 */
export function HoldCountdown({
  expiresAt,
  serverTime,
  totalHoldHours = 24,
  variant = 'inline',
  onExpire,
  className,
}: HoldCountdownProps) {
  const storeOffsetMs = useReservationStore((s) => s.serverTimeOffsetMs);

  // Calcule l'écart une fois à la réception de serverTime
  const [clockOffsetMs] = useState<number>(() =>
    computeServerClockOffsetMs(serverTime, storeOffsetMs),
  );

  const computeRemainingMs = useCallback((): number => {
    const targetMs =
      expiresAt instanceof Date
        ? expiresAt.getTime()
        : new Date(expiresAt).getTime();
    if (Number.isNaN(targetMs)) return 0;
    const correctedNow = Date.now() + clockOffsetMs;
    return Math.max(0, targetMs - correctedNow);
  }, [expiresAt, clockOffsetMs]);

  const [remainingMs, setRemainingMs] = useState<number>(() =>
    computeRemainingMs(),
  );
  const expiredFiredRef = useRef(false);

  // Synchronise quand expiresAt change
  useEffect(() => {
    expiredFiredRef.current = false;
    const next = computeRemainingMs();
    const id = requestAnimationFrame(() => setRemainingMs(next));
    return () => cancelAnimationFrame(id);
  }, [computeRemainingMs]);

  // Déclenche onExpire une seule fois lorsque le compte à rebours atteint 0
  useEffect(() => {
    if (remainingMs <= 0 && !expiredFiredRef.current) {
      expiredFiredRef.current = true;
      onExpire?.();
    }
  }, [remainingMs, onExpire]);

  // Minuteur adaptatif (1 s durant la dernière heure, 60 s au-delà) + pause onglet masqué (§7.3)
  useEffect(() => {
    if (remainingMs <= 0) return;

    let timerId: number | null = null;

    const scheduleNextTick = () => {
      if (timerId !== null) {
        window.clearTimeout(timerId);
      }
      if (typeof document !== 'undefined' && document.visibilityState === 'hidden') {
        return;
      }
      const current = computeRemainingMs();
      setRemainingMs(current);
      if (current <= 0) return;

      const intervalMs = current <= ONE_HOUR_MS ? 1000 : 60_000;
      timerId = window.setTimeout(scheduleNextTick, intervalMs);
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        scheduleNextTick();
      } else if (timerId !== null) {
        window.clearTimeout(timerId);
        timerId = null;
      }
    };

    const initialInterval = remainingMs <= ONE_HOUR_MS ? 1000 : 60_000;
    timerId = window.setTimeout(scheduleNextTick, initialInterval);
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      if (timerId !== null) {
        window.clearTimeout(timerId);
      }
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [computeRemainingMs, remainingMs]);

  const isExpired = remainingMs <= 0;
  const tone: 'ink' | 'warning' | 'red' =
    remainingMs <= THIRTY_MINUTES_MS
      ? 'red'
      : remainingMs <= TWO_HOURS_MS
        ? 'warning'
        : 'ink';

  const textColorClass =
    tone === 'red'
      ? 'text-red'
      : tone === 'warning'
        ? 'text-warning'
        : 'text-ink';

  const strokeColorClass =
    tone === 'red'
      ? 'stroke-red'
      : tone === 'warning'
        ? 'stroke-warning'
        : 'stroke-ink';

  if (isExpired) {
    return (
      <span
        role="status"
        data-testid="hold-countdown"
        data-tone="red"
        className={cn('font-bold text-danger', className)}
      >
        Réservation expirée
      </span>
    );
  }

  const totalSeconds = Math.ceil(remainingMs / 1000);
  const totalMinutes = Math.floor(totalSeconds / 60);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  const seconds = totalSeconds % 60;

  const paddedHours = String(hours).padStart(2, '0');
  const paddedMinutes = String(minutes).padStart(2, '0');
  const paddedSeconds = String(seconds).padStart(2, '0');

  if (variant === 'compact') {
    const compactLabel =
      remainingMs <= ONE_HOUR_MS && hours === 0
        ? `${paddedMinutes}:${paddedSeconds}`
        : `${paddedHours}:${paddedMinutes}`;

    return (
      <span
        data-testid="hold-countdown"
        data-tone={tone}
        className={cn('font-mono font-bold tabular-nums', className)}
      >
        {compactLabel}
      </span>
    );
  }

  if (variant === 'inline') {
    return (
      <span
        data-testid="hold-countdown"
        data-tone={tone}
        className={cn(
          'inline-flex items-center gap-1.5 font-bold tabular-nums',
          textColorClass,
          className,
        )}
      >
        Réservé encore {hours} h {paddedMinutes} min
      </span>
    );
  }

  // Variante 'ring' : anneau SVG de 72 px (§7.3)
  const radius = 31;
  const circumference = 2 * Math.PI * radius;
  const maxDurationMs = Math.max(1, totalHoldHours * ONE_HOUR_MS);
  const progress = Math.min(1, Math.max(0, remainingMs / maxDurationMs));
  const strokeDashoffset = circumference * (1 - progress);

  const ringCenterLabel =
    remainingMs <= ONE_HOUR_MS && hours === 0
      ? `${paddedMinutes}:${paddedSeconds}`
      : `${hours} h ${paddedMinutes}`;

  return (
    <div
      data-testid="hold-countdown"
      data-tone={tone}
      className={cn('inline-flex flex-col items-center text-center', className)}
    >
      <div className="relative flex h-[72px] w-[72px] items-center justify-center">
        <svg
          viewBox="0 0 72 72"
          className="h-[72px] w-[72px] -rotate-90"
          aria-hidden="true"
        >
          <circle
            cx="36"
            cy="36"
            r={radius}
            fill="none"
            className="stroke-silver/40"
            strokeWidth="4.5"
          />
          <circle
            cx="36"
            cy="36"
            r={radius}
            fill="none"
            className={cn('transition-[stroke-dashoffset] duration-500', strokeColorClass)}
            strokeWidth="4.5"
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={strokeDashoffset}
          />
        </svg>
        <span
          className={cn(
            'absolute font-mono text-xs font-extrabold tabular-nums',
            textColorClass,
          )}
        >
          {ringCenterLabel}
        </span>
      </div>
      <span className="mt-1.5 text-xs font-semibold text-text-2">
        Articles réservés pour vous
      </span>
    </div>
  );
}
