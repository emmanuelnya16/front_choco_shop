import { ArrowRight } from 'lucide-react';
import type { ReactNode } from 'react';
import { Link } from 'react-router';
import { cn } from '@/lib/utils/cn';

export interface SectionHeaderProps {
  title: string;
  eyebrow?: string;
  actionLabel?: string;
  actionHref?: string;
  rightSlot?: ReactNode;
  align?: 'left' | 'center';
  className?: string;
}

/**
 * SectionHeader (§5.5) :
 * Reproduit la disposition « Best Selling … See All » de la maquette.
 * Marge basse : 20 px sur mobile (mb-5), 28 px sur ordinateur (lg:mb-7).
 */
export function SectionHeader({
  title,
  eyebrow,
  actionLabel = 'Voir tout',
  actionHref,
  rightSlot,
  align = 'left',
  className,
}: SectionHeaderProps) {
  if (align === 'center') {
    return (
      <div className={cn('mb-5 text-center lg:mb-7', className)}>
        {eyebrow && <p className="mb-1.5 text-label text-red">{eyebrow}</p>}
        <h2 className="text-h2 text-ink">{title}</h2>
      </div>
    );
  }

  return (
    <div
      className={cn(
        'mb-5 flex items-end justify-between gap-4 lg:mb-7',
        className,
      )}
    >
      <div className="min-w-0">
        {eyebrow && <p className="mb-1 text-label text-red">{eyebrow}</p>}
        <h2 className="text-h2 text-ink">{title}</h2>
      </div>

      <div className="flex shrink-0 items-center gap-3">
        {rightSlot}
        {actionHref && (
          <Link
            to={actionHref}
            className="group inline-flex min-h-[40px] items-center gap-1.5 text-small font-semibold text-ink whitespace-nowrap [@media(hover:hover)]:hover:underline"
          >
            <span>{actionLabel}</span>
            <ArrowRight
              className="h-4 w-4 transition-transform duration-200 [@media(hover:hover)]:group-hover:translate-x-1"
              aria-hidden="true"
            />
          </Link>
        )}
      </div>
    </div>
  );
}
