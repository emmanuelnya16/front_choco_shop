import type { ButtonHTMLAttributes, HTMLAttributes, ReactNode } from 'react';
import { Link } from 'react-router';
import { cn } from '@/lib/utils/cn';

export type BadgeVariant = 'new' | 'low-stock' | 'sold-out' | 'info';

export interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  variant?: BadgeVariant;
  lowStockCount?: number;
  children?: ReactNode;
}

const BADGE_STYLES: Record<BadgeVariant, string> = {
  new: 'bg-ink text-white',
  'low-stock': 'bg-red text-white',
  'sold-out': 'bg-silver text-ink',
  info: 'bg-surface text-ink border border-silver',
};

const DEFAULT_LABELS: Record<BadgeVariant, string> = {
  new: 'Nouveau',
  'low-stock': 'Plus que 2',
  'sold-out': 'Épuisé',
  info: 'Info',
};

/**
 * Badge produit (§5.4) : hauteur 24 px, rayon complet, text-label.
 */
export function Badge({
  variant = 'new',
  lowStockCount,
  children,
  className,
  ...props
}: BadgeProps) {
  const label =
    children ??
    (variant === 'low-stock' && typeof lowStockCount === 'number'
      ? `Plus que ${lowStockCount}`
      : DEFAULT_LABELS[variant]);

  return (
    <span
      className={cn(
        'inline-flex h-6 shrink-0 items-center justify-center rounded-[var(--radius-full)] px-2.5 text-label leading-none whitespace-nowrap',
        BADGE_STYLES[variant],
        className,
      )}
      {...props}
    >
      {label}
    </span>
  );
}

export interface ChipProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  active?: boolean;
  href?: string;
  children: ReactNode;
}

/**
 * Chip de filtre / sous-catégorie (§5.4) : hauteur 36 px (zone tactile 44 px), rayon complet.
 */
export function Chip({ active = false, href, children, className, ...props }: ChipProps) {
  const chipClasses = cn(
    'inline-flex h-9 shrink-0 items-center justify-center rounded-[var(--radius-full)] border px-4 text-small font-semibold whitespace-nowrap transition-colors duration-fast',
    active
      ? 'border-ink bg-ink text-white'
      : 'border-silver bg-white text-ink [@media(hover:hover)]:hover:bg-surface',
    className,
  );

  if (href) {
    return (
      <Link to={href} className="inline-flex min-h-11 items-center">
        <span className={chipClasses}>{children}</span>
      </Link>
    );
  }

  return (
    <button
      type="button"
      aria-pressed={active}
      className="inline-flex min-h-11 items-center"
      {...props}
    >
      <span className={chipClasses}>{children}</span>
    </button>
  );
}
