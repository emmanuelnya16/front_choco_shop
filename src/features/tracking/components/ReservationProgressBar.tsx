import { cn } from '@/lib/utils/cn';
import type { ProgressInfo } from '@/features/tracking/timeline';

const FILL_CLASSES: Record<ProgressInfo['tone'], string> = {
  ink: 'bg-ink',
  success: 'bg-success',
  red: 'bg-red',
};

/** Barre d'avancement d'une carte (§4.2 M5) : remplissage par `scaleX` (propriété compositeur). */
export function ReservationProgressBar({
  progress,
  className,
}: {
  progress: ProgressInfo;
  className?: string;
}) {
  const ratio = progress.total > 0 ? Math.min(1, progress.done / progress.total) : 0;

  return (
    <div
      role="progressbar"
      aria-label="Avancement de la réservation"
      aria-valuemin={0}
      aria-valuemax={progress.total}
      aria-valuenow={progress.done}
      aria-valuetext={`Étape ${progress.done} sur ${progress.total}`}
      className={cn('h-1 w-full overflow-hidden rounded-[var(--radius-full)] bg-silver/45', className)}
    >
      <div
        className={cn(
          'h-full w-full origin-left rounded-[var(--radius-full)] transition-transform duration-reveal ease-brand-out',
          FILL_CLASSES[progress.tone],
        )}
        style={{ transform: `scaleX(${ratio})` }}
      />
    </div>
  );
}
