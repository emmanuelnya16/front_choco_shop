import { cn } from '@/lib/utils/cn';
import {
  STATUS_META,
  type ReservationStatusCode,
  type StatusTone,
} from '@/types/reservationStatus';

const TONE_CLASSES: Record<StatusTone, string> = {
  neutral: 'bg-surface text-ink border border-silver',
  warning: 'bg-warning text-ink border border-warning',
  danger: 'bg-danger text-white border border-danger',
  success: 'bg-success text-white border border-success',
};

export interface AdminReservationStatusBadgeProps {
  status: ReservationStatusCode;
  className?: string;
}

export function AdminReservationStatusBadge({
  status,
  className,
}: AdminReservationStatusBadgeProps) {
  const meta = STATUS_META[status] ?? STATUS_META.reserved;
  const Icon = meta.Icon;

  return (
    <span
      className={cn(
        'inline-flex h-6 shrink-0 items-center gap-1.5 rounded-[var(--radius-full)] px-2.5 text-label leading-none whitespace-nowrap',
        TONE_CLASSES[meta.tone],
        className,
      )}
    >
      <Icon className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
      <span>{meta.label}</span>
    </span>
  );
}

