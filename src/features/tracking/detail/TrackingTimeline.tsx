import { Check, X } from 'lucide-react';
import * as m from 'motion/react-m';
import { SmartImage } from '@/components/ui/SmartImage';
import { formatSpokenDateTime, formatStepDateTime } from '@/features/tracking/format';
import { reachedStepIndex, type TimelineStepView } from '@/features/tracking/timeline';
import { cn } from '@/lib/utils/cn';
import { delay, duration, ease, spring } from '@/motion/tokens';
import { useReducedMotionPref } from '@/motion/useReducedMotionPref';

export interface TrackingTimelineProps {
  steps: TimelineStepView[];
  /**
   * Index de la dernière étape déjà vue : seule la portion suivante s'anime (§5.3 M5).
   * `-1` : première ouverture, toute la frise se remplit. `null` : affichage direct.
   */
  animateFromIndex: number | null;
  /** Miniature de la photo du colis affichée sur l'étape « Remise à l’agence » / « Prête pour retrait ». */
  packageThumbUrl?: string;
  onOpenPackagePhoto?: () => void;
}

const STATE_SPOKEN: Record<TimelineStepView['state'], string> = {
  done: 'terminée',
  current: 'en cours',
  upcoming: 'à venir',
};

/** Remplissage d'un segment, puis rebond de la pastille suivante (durées de src/motion/tokens.ts). */
const FILL = duration.tap;
const POP = duration.quick;
const STEP = FILL + POP;

interface AnimationPlan {
  /** Dernière étape déjà vue (-1 : aucune). */
  from: number;
  firstDot: number;
  firstSegment: number;
  /** Premier rebond : la pastille de départ quand toute la frise se remplit. */
  lead: number;
}

function buildPlan(animateFromIndex: number | null, reached: number, reduced: boolean): AnimationPlan | null {
  if (animateFromIndex === null || reached < 0 || reduced) return null;
  const from = Math.min(animateFromIndex, reached);
  if (from === reached && from >= 0) return null; // Rien de nouveau depuis la dernière visite
  return {
    from,
    firstDot: from < 0 ? 0 : from + 1,
    firstSegment: Math.max(from, 0),
    lead: from < 0 ? POP : 0,
  };
}

function stepNote(step: TimelineStepView): string | undefined {
  if (step.status === 'cancelled') {
    const by = step.actor === 'client' ? 'Par vous' : step.actor === 'shop' ? 'Par la boutique' : undefined;
    return [by, step.actor === 'client' ? step.note : undefined].filter(Boolean).join(' · ') || step.note;
  }
  return step.note;
}

/**
 * Frise de suivi verticale animée (§5.3 M5) : la ligne se remplit de haut en bas (`scaleY`, origine en haut),
 * chaque pastille rebondit (0,6 → 1) quand la ligne l'atteint, puis l'étape en cours s'allume.
 * Seule la portion nouvelle s'anime, y compris quand le statut change écran ouvert (le segment déjà monté
 * passe de 0 à 1, la nouvelle étape apparaît). Uniquement transform et opacité ; animations réduites :
 * état final direct.
 */
export function TrackingTimeline({
  steps,
  animateFromIndex,
  packageThumbUrl,
  onOpenPackagePhoto,
}: TrackingTimelineProps) {
  const reducedMotion = useReducedMotionPref();
  const reached = reachedStepIndex(steps);
  const total = steps.length;
  const plan = buildPlan(animateFromIndex, reached, reducedMotion);

  const segmentDelay = (index: number) =>
    plan ? delay.short + plan.lead + (index - plan.firstSegment) * STEP : 0;
  const dotDelay = (index: number) => {
    if (!plan) return 0;
    if (index === 0 && plan.from < 0) return delay.short;
    return segmentDelay(index - 1) + FILL;
  };
  const animatesSegment = (index: number) =>
    Boolean(plan) && index >= plan!.firstSegment && index < reached;
  const animatesDot = (index: number) => Boolean(plan) && index >= plan!.firstDot && index <= reached;

  return (
    <ol aria-label="Suivi de la réservation" className="relative">
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
            {/* Segment vers l'étape suivante : rail gris + remplissage animé, centré sous la pastille */}
            {index < total - 1 && (
              <span
                aria-hidden="true"
                className="absolute top-8 bottom-1 left-3 w-0.5 -translate-x-1/2 overflow-hidden rounded-[var(--radius-full)] bg-silver/60"
              >
                <m.span
                  data-fill={index}
                  className="block h-full w-full origin-top bg-ink"
                  initial={animatesSegment(index) ? { scaleY: 0 } : false}
                  animate={{ scaleY: index < reached ? 1 : 0 }}
                  transition={{ duration: FILL, ease: ease.inOut, delay: segmentDelay(index) }}
                />
              </span>
            )}

            {/* Pastille : cercle « à venir » dessous, état franchi / en cours par-dessus */}
            <span aria-hidden="true" className="relative mt-0.5 h-6 w-6 shrink-0">
              <span className="absolute inset-0 rounded-[var(--radius-full)] border-2 border-silver bg-white" />
              {isCurrent && (
                <m.span
                  data-halo
                  className="absolute -inset-1.5"
                  initial={plan ? { opacity: 0 } : false}
                  animate={{ opacity: 1 }}
                  transition={{ duration: duration.base, ease: ease.out, delay: dotDelay(index) + POP }}
                >
                  <span className="absolute inset-0 animate-[ping_var(--duration-ambient)_var(--ease-brand-out)_infinite] rounded-[var(--radius-full)] bg-red/30" />
                </m.span>
              )}
              {!isUpcoming && (
                <m.span
                  data-dot={index}
                  initial={animatesDot(index) ? { scale: 0.6, opacity: 0 } : false}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={{
                    scale: { ...spring.snappy, delay: dotDelay(index) },
                    opacity: { duration: duration.fast, ease: ease.out, delay: dotDelay(index) },
                  }}
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
                </m.span>
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
              // z-[1] local : la miniature passe au-dessus du rail de l'étape (même élément de liste)
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
