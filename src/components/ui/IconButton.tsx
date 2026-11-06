import * as m from 'motion/react-m';
import type { ButtonHTMLAttributes, ReactNode } from 'react';
import { Link } from 'react-router';
import { cn } from '@/lib/utils/cn';
import { pressable } from '@/motion/presets';
import { spring } from '@/motion/tokens';

export type IconButtonVariant = 'plain' | 'surface' | 'dark' | 'light-ghost';

export interface IconButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  icon: ReactNode;
  label: string;
  variant?: IconButtonVariant;
  badge?: number;
  href?: string;
}

const VARIANT_CLASSES: Record<IconButtonVariant, string> = {
  plain: 'bg-transparent text-ink [@media(hover:hover)]:hover:bg-surface',
  surface:
    'bg-white text-ink shadow-[var(--shadow-card-icon)] [@media(hover:hover)]:hover:bg-surface',
  dark: 'bg-ink text-white [@media(hover:hover)]:hover:bg-ink-2',
  'light-ghost': 'bg-transparent text-white [@media(hover:hover)]:hover:bg-glass-light',
};

/**
 * IconButton (§5.3) :
 * Zone tactile garantie de 44×44 px avec disque visuel de 40 px et pastille badge rebondissante.
 */
export function IconButton({
  icon,
  label,
  variant = 'plain',
  badge,
  href,
  disabled,
  className,
  type = 'button',
  ...props
}: IconButtonProps) {
  const showBadge = typeof badge === 'number' && badge > 0;

  const innerCircle = (
    <span
      className={cn(
        'relative flex h-10 w-10 items-center justify-center rounded-[var(--radius-full)] transition-colors duration-fast',
        VARIANT_CLASSES[variant],
        className,
      )}
    >
      {icon}
      {showBadge && (
        <m.span
          key={badge}
          initial={{ scale: 0.5 }}
          animate={{ scale: 1 }}
          transition={spring.bounce}
          className="absolute -top-1 -right-1 flex h-5 min-w-5 items-center justify-center rounded-[var(--radius-full)] bg-red px-1 text-caption leading-none font-bold tabular-nums text-white"
        >
          {badge > 99 ? '99+' : badge}
        </m.span>
      )}
    </span>
  );

  if (href && !disabled) {
    return (
      <Link
        to={href}
        aria-label={showBadge ? `${label} (${badge})` : label}
        className="inline-flex min-h-11 min-w-11 shrink-0 items-center justify-center rounded-[var(--radius-full)]"
      >
        {innerCircle}
      </Link>
    );
  }

  return (
    <m.button
      type={type}
      disabled={disabled}
      aria-label={showBadge ? `${label} (${badge})` : label}
      className="inline-flex min-h-11 min-w-11 shrink-0 items-center justify-center rounded-[var(--radius-full)] disabled:pointer-events-none disabled:opacity-35"
      {...(disabled ? {} : pressable)}
      {...(props as Record<string, unknown>)}
    >
      {innerCircle}
    </m.button>
  );
}
