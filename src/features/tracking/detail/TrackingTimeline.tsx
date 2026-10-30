import { Check, X } from 'lucide-react';
import { useRef } from 'react';
import { SmartImage } from '@/components/ui/SmartImage';
import { formatSpokenDateTime, formatStepDateTime } from '@/features/tracking/format';
import { reachedStepIndex, type TimelineStepView } from '@/features/tracking/timeline';
import { gsap, useGSAP } from '@/lib/gsap';
import { cn } from '@/lib/utils/cn';
import { prefersReducedMotion } from '@/motion/useReducedMotionPref';

export interface TrackingTimelineProps {
  steps: TimelineStepView[];
  /**
   * Index de la dernière étape déjà vue : seule la portion suivante s'anime (§5.3 M5).
   * `-1` : première ouverture, toute la frise se remplit. `null` : affichage direct.
   */
  animateFromIndex: number | null;
  /** Miniature de la photo du colis affichée sur l'étape « Remise à l'agence » / « Prête pour retrait ». */
  packageThumbUrl?: string;
  onOpenPackagePhoto?: () => void;
}

const STATE_SPOKEN: Record<TimelineStepView['state'], string> = {
  done: 'terminée',
  current: 'en cours',
  upcoming: 'à venir',
};

function stepNote(step: TimelineStepView): string | undefined {
  if (step.status === 'cancelled') {
    const by = step.actor === 'client' ? 'Par vous' : step.actor === 'shop' ? 'Par la boutique' : undefined;
    return [by, step.actor === 'client' ? step.note : undefined].filter(Boolean).join(' · ') || step.note;
  }
  return step.note;
}

/**
 * Frise de suivi verticale animée (§5.3 M5) : la ligne se remplit de haut en bas (`scaleY`, origine en haut,
 * ~0,15 s par étape, `power2.inOut`), chaque pastille passe à l'état franchi quand la ligne l'atteint
 * (rebond 0,6 → 1), puis l'étape en cours s'allume. Animations réduites : état final direct.
 */
export function TrackingTimeline({
  steps,
  animateFromIndex,
  packageThumbUrl,
  onOpenPackagePhoto,
}: TrackingTimelineProps) {
  const scopeRef = useRef<HTMLOListElement | null>(null);
  const reached = reachedStepIndex(steps);
  const total = steps.length;
  const animationKey = `${steps.map((s) => `${s.key}:${s.state}`).join('|')}#${animateFromIndex ?? 'none'}`;

  useGSAP(
    () => {
      if (animateFromIndex === null || reached < 0 || prefersReducedMotion()) return;
      const from = Math.min(animateFromIndex, reached);
      if (from === reached && from >= 0) return; // Rien de nouveau depuis la dernière visite

      const q = gsap.utils.selector(scopeRef);
      const fill = (i: number) => q(`[data-fill="${i}"]`);
      const dot = (i: number) => q(`[data-dot="${i}"]`);
      const halo = q('[data-halo]');

      const firstDot = from < 0 ? 0 : from + 1;
      const firstSegment = Math.max(from, 0);

      for (let i = firstSegment; i < reached; i += 1) gsap.set(fill(i), { scaleY: 0 });
      for (let i = firstDot; i <= reached; i += 1) gsap.set(dot(i), { scale: 0.6, autoAlpha: 0 });
      gsap.set(halo, { autoAlpha: 0 });

      const tl = gsap.timeline({ delay: 0.15 });
      if (from < 0) {
        tl.to(dot(0), { scale: 1, autoAlpha: 1, duration: 0.25, ease: 'back.out(2.5)' });
      }
      for (let i = firstSegment; i < reached; i += 1) {
        tl.to(fill(i), { scaleY: 1, duration: 0.15, ease: 'power2.inOut' });
        tl.to(dot(i + 1), { scale: 1, autoAlpha: 1, duration: 0.25, ease: 'back.out(2.5)' }, '-=0.04');
      }
      tl.to(halo, { autoAlpha: 1, duration: 0.3, ease: 'power2.out' });
    },
    { scope: scopeRef, dependencies: [animationKey] },
  );

  return (
    <ol ref={scopeRef} aria-label="Suivi de la réservation" className="relative">
      {steps.map((step, index) => {
        const isUpcoming = step.state === 'upcoming';
        const isDanger = step.tone === 'danger';
        const isCurrent = step.state === 'current';
        const note = stepNote(step);
        const showThumb = Boolean(packageThumbUrl) && step.isPackageStep && !isUpcoming;
        const titleWithNote =
          step.status === 'payment_rejected' && step.note ? `${step.label} · ${step.note}` : step.label;

        return (
          <li
            key={step.key}
            aria-current={isCurrent ? 'step' : undefined}
            className="relative flex gap-4 pb-6 last:pb-0"
          >
            {/* Segment vers l'étape suivante : rail gris + remplissage animé */}
            {index < total - 1 && (
              <span
                aria-hidden="true"
                className="absolute top-[30px] bottom-[2px] left-[11px] w-[2px] overflow-hidden rounded-[var(--radius-full)] bg-silver/60"
              >
                <span
                  data-fill={index}
                  className="block h-full w-full origin-top bg-ink"
                  style={{ transform: `scaleY(${index < reached ? 1 : 0})` }}
                />
              </span>
            )}

            {/* Pastille : cercle « à venir » dessous, état franchi / en cours par-dessus */}
            <span aria-hidden="true" className="relative mt-0.5 h-6 w-6 shrink-0">
              <span className="absolute inset-0 rounded-[var(--radius-full)] border-2 border-silver bg-white" />
              {isCurrent && (
                <span data-halo className="absolute -inset-1.5">
                  <span className="absolute inset-0 animate-[ping_2.2s_cubic-bezier(0,0,0.2,1)_infinite] rounded-[var(--radius-full)] bg-red/30" />
                </span>
              )}
              {!isUpcoming && (
                <span
                  data-dot={index}
                  className={cn(
                    'absolute inset-0 flex items-center justify-center rounded-[var(--radius-full)] text-white',
                    isCurrent || isDanger ? 'bg-red' : 'bg-ink',
                  )}
                >
                  {isDanger ? (
                    <X className="h-3.5 w-3.5" strokeWidth={3} />
                  ) : isCurrent ? (
                    <span className="h-2 w-2 rounded-[var(--radius-full)] bg-white" />
                  ) : (
                    <Check className="h-3.5 w-3.5" strokeWidth={3} />
                  )}
                </span>
              )}
            </span>

            <div className="flex min-w-0 flex-1 items-start justify-between gap-3" aria-hidden="true">
              <div className="min-w-0">
                <p className={cn('text-h3', isUpcoming ? 'text-text-2' : 'text-ink')}>{titleWithNote}</p>
                {step.at && !isUpcoming && (
                  <p className="mt-0.5 text-small text-text-2 tabular-nums">{formatStepDateTime(step.at)}</p>
                )}
                {note && step.status !== 'payment_rejected' && !isUpcoming && (
                  <p className="mt-1 text-small text-text-2">{note}</p>
                )}
              </div>
            </div>

            {showThumb && (
              <button
                type="button"
                onClick={onOpenPackagePhoto}
                aria-label="Voir la photo de votre colis"
                className="relative z-[1] h-12 w-12 shrink-0 overflow-hidden rounded-[var(--radius-sm)] ring-1 ring-silver/70"
              >
                <SmartImage src={packageThumbUrl!} alt="" ratio="1/1" className="h-full w-full" />
              </button>
            )}

            <span className="sr-only">
              {`Étape ${index + 1} sur ${total}, ${titleWithNote}${
                step.at && !isUpcoming ? `, ${formatSpokenDateTime(step.at)}` : ''
              }, ${STATE_SPOKEN[step.state]}${note && step.status !== 'payment_rejected' && !isUpcoming ? `. ${note}` : ''}`}
            </span>
          </li>
        );
      })}
    </ol>
  );
}
