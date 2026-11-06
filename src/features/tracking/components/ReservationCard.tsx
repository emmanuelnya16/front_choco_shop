import * as m from 'motion/react-m';
import { ArrowRight, Camera } from 'lucide-react';
import { flushSync } from 'react-dom';
import { Link } from 'react-router';
import { Button } from '@/components/ui/Button';
import { Price, Skeleton } from '@/components/ui/Primitives';
import { SmartImage } from '@/components/ui/SmartImage';
import { HoldCountdown } from '@/features/reservation/components/HoldCountdown';
import { useRebook } from '@/features/tracking/api/useRebook';
import { getCardAction } from '@/features/tracking/cardAction';
import { formatItemsCount, formatShortDate } from '@/features/tracking/format';
import { hasUnseenChange, useSeenStore } from '@/features/tracking/seenStore';
import { computeProgress } from '@/features/tracking/timeline';
import { cn } from '@/lib/utils/cn';
import { duration } from '@/motion/tokens';
import { useUiStore } from '@/stores/uiStore';
import type { ReservationListItem } from '@/types/api';
import { ReservationProgressBar } from './ReservationProgressBar';
import { ReservationStatusBadge } from './ReservationStatusBadge';

/**
 * Bouton d'action d'une carte : 44 px de haut au toucher (sous 1024 px), 36 px (taille sm) sur ordinateur.
 * Un appui à côté du bouton ouvrirait le détail (lien étendu à toute la carte).
 */
const ACTION_TARGET = 'max-lg:min-h-11';

export interface ReservationCardProps {
  item: ReservationListItem;
  className?: string;
}

/** Carte de « Mes réservations » (§4.2 M5). Toute la carte mène au détail, sauf le bouton d'action. */
export function ReservationCard({ item, className }: ReservationCardProps) {
  const entry = useSeenStore((s) => s.byRef[item.ref]);
  const initializedAt = useSeenStore((s) => s.initializedAt);
  const activeTransitionRef = useUiStore((s) => s.activeReservationTransitionRef);
  const setActiveTransitionRef = useUiStore((s) => s.setActiveReservationTransitionRef);
  const rebook = useRebook();

  const isNew = hasUnseenChange(item, entry, initializedAt);
  const action = getCardAction(item);
  const progress = computeProgress(item);
  const showPackageThumb =
    Boolean(item.packagePhotoThumb) &&
    (item.status === 'handed_to_agency' || item.status === 'ready_for_pickup');

  const markAsTransitionTarget = () => {
    // Le nom de transition n'est posé que sur la carte touchée (sinon deux éléments partageraient le même nom).
    try {
      flushSync(() => setActiveTransitionRef(item.ref));
    } catch {
      setActiveTransitionRef(item.ref);
    }
  };

  return (
    <m.article
      whileTap={{ scale: 0.98 }}
      transition={{ duration: duration.tap }}
      className={cn(
        'relative flex h-full flex-col rounded-[var(--radius-md)] border border-silver/70 bg-white p-4 transition-colors [@media(hover:hover)]:hover:border-silver',
        className,
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <h2 className="min-w-0">
          <Link
            to={`/reservations/${item.ref}`}
            viewTransition
            onClick={markAsTransitionTarget}
            style={
              activeTransitionRef === item.ref
                ? { viewTransitionName: `res-${item.ref}` }
                : undefined
            }
            className="block font-mono text-body font-bold tracking-tight text-ink after:absolute after:inset-0 after:rounded-[var(--radius-md)] after:content-[''] focus-visible:outline-none focus-visible:after:outline-2 focus-visible:after:outline-offset-2 focus-visible:after:outline-red"
          >
            {item.ref}
          </Link>
        </h2>
        {isNew && (
          <span className="inline-flex shrink-0 items-center gap-1.5 text-label text-ink">
            <span className="h-2 w-2 rounded-[var(--radius-full)] bg-red" aria-hidden="true" />
            Nouveau
          </span>
        )}
      </div>

      <p className="mt-0.5 text-small text-text-2">
        {formatShortDate(item.createdAt)} · {formatItemsCount(item.itemsCount)}
      </p>

      <div className="mt-3 flex items-end justify-between gap-3">
        {showPackageThumb ? (
          <div className="flex items-center gap-2.5">
            <SmartImage
              src={item.packagePhotoThumb!}
              alt="Photo de votre colis emballé"
              ratio="1/1"
              className="h-15 w-15 shrink-0 rounded-[var(--radius-sm)]"
            />
            <span className="inline-flex items-center gap-1.5 text-small font-semibold text-ink">
              <Camera className="h-4 w-4 text-red" aria-hidden="true" />
              Colis prêt
            </span>
          </div>
        ) : (
          <ul className="flex gap-1.5" aria-label="Articles">
            {item.itemsPreview.map((preview, index) => (
              <li key={`${preview.name}-${index}`}>
                <SmartImage
                  src={preview.image}
                  alt={preview.name}
                  ratio="4/5"
                  className="h-15 w-12 rounded-[var(--radius-sm)]"
                />
              </li>
            ))}
          </ul>
        )}
        <Price amount={item.amount.total} className="text-body text-ink" />
      </div>

      <ReservationProgressBar progress={progress} className="mt-3.5" />

      <div className="mt-3 mb-3">
        <ReservationStatusBadge status={item.status} />
      </div>

      {/* z-[1] local : la rangée passe au-dessus du lien étendu à toute la carte (after:inset-0).
          Rangée d'action en bas de carte (mt-auto) et de hauteur fixe, avec ou sans bouton (box-content :
          min-h = hauteur du bouton, hors filet et pt-3) : cartes et filets alignés sur une même rangée. */}
      <div
        className="relative z-[1] mt-auto box-content flex min-h-11 items-center justify-between gap-3 border-t border-silver/70 pt-3 lg:min-h-9"
        onPointerDown={(event) => {
          // Le bouton d'action ne déclenche pas l'effet d'appui de la carte
          if ((event.target as HTMLElement).closest('a,button')) event.stopPropagation();
        }}
      >
        {action.kind === 'pay' && (
          <Button variant="primary" size="sm" className={ACTION_TARGET} href={action.href} iconRight={<ArrowRight className="h-4 w-4" />}>
            {action.label} ·{' '}
            {item.expiresAt ? (
              <HoldCountdown variant="compact" expiresAt={item.expiresAt} serverTime={item.serverTime} />
            ) : null}
          </Button>
        )}
        {action.kind === 'resend-proof' && (
          <Button variant="primary" size="sm" className={ACTION_TARGET} href={action.href} iconRight={<ArrowRight className="h-4 w-4" />}>
            {action.label}
          </Button>
        )}
        {action.kind === 'view-package' && (
          <Button
            variant="dark"
            size="sm"
            className={ACTION_TARGET}
            href={action.href}
            iconLeft={<Camera className="h-4 w-4" />}
          >
            {action.label}
          </Button>
        )}
        {action.kind === 'rebook' && (
          <>
            {action.text ? <p className="text-small text-text-2">{action.text}</p> : <span />}
            <Button
              variant="outline"
              size="sm"
              className={ACTION_TARGET}
              loading={rebook.isPending}
              onClick={() => rebook.mutate(item.ref)}
            >
              {action.label}
            </Button>
          </>
        )}
        {action.kind === 'text' && <p className="text-small font-semibold text-text-2">{action.text}</p>}
      </div>
    </m.article>
  );
}

/** Squelette au gabarit exact d'une carte (§4.1 M5). */
export function ReservationCardSkeleton() {
  return (
    <div
      aria-hidden="true"
      className="flex h-full flex-col rounded-[var(--radius-md)] border border-silver/70 bg-white p-4"
    >
      <Skeleton className="h-5 w-28" />
      <Skeleton className="mt-1.5 h-4 w-40" />
      <div className="mt-3 flex items-end justify-between">
        <div className="flex gap-1.5">
          <Skeleton className="h-15 w-12 rounded-[var(--radius-sm)]" />
          <Skeleton className="h-15 w-12 rounded-[var(--radius-sm)]" />
          <Skeleton className="h-15 w-12 rounded-[var(--radius-sm)]" />
        </div>
        <Skeleton className="h-5 w-24" />
      </div>
      <Skeleton className="mt-3.5 h-1 w-full" />
      <Skeleton className="mt-3 h-6 w-36 rounded-[var(--radius-full)]" />
      <div className="mt-3 border-t border-silver/70 pt-3">
        <Skeleton className="h-11 w-40 lg:h-9" />
      </div>
    </div>
  );
}
