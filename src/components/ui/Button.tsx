import { Loader2 } from 'lucide-react';
import * as m from 'motion/react-m';
import type { ButtonHTMLAttributes, ReactNode } from 'react';
import { Link } from 'react-router';
import { cn } from '@/lib/utils/cn';
import { pressable } from '@/motion/presets';

export type ButtonVariant =
  | 'primary'
  | 'dark'
  | 'light'
  | 'outline'
  | 'outline-light'
  | 'ghost'
  | 'danger';

export type ButtonSize = 'sm' | 'md' | 'lg';

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  iconLeft?: ReactNode;
  iconRight?: ReactNode;
  loading?: boolean;
  fullWidth?: boolean;
  href?: string;
  external?: boolean;
}

const VARIANT_CLASSES: Record<ButtonVariant, string> = {
  primary:
    'bg-red text-white border border-transparent [@media(hover:hover)]:hover:brightness-92',
  dark: 'bg-ink text-white border border-transparent [@media(hover:hover)]:hover:bg-ink-2',
  light: 'bg-white text-ink border border-transparent [@media(hover:hover)]:hover:bg-surface',
  outline:
    'bg-transparent text-ink border-[1.5px] border-ink [@media(hover:hover)]:hover:bg-surface',
  'outline-light':
    'bg-transparent text-white border-[1.5px] border-white [@media(hover:hover)]:hover:bg-glass-light',
  ghost:
    'bg-transparent text-ink border border-transparent [@media(hover:hover)]:hover:bg-surface',
  // Action destructive confirmée (« Oui, annuler », §5.4 M5) : même rouge que `primary`, sens distinct
  danger:
    'bg-danger text-white border border-transparent [@media(hover:hover)]:hover:brightness-92',
};

/** Liens vers une autre application du téléphone : jamais de `<Link>` du routeur ni de nouvel onglet. */
const APP_SCHEME_PATTERN = /^(tel|mailto|sms):/i;
/** Adresses web absolues (wa.me, Google Maps…) : toujours externes. */
const WEB_URL_PATTERN = /^(https?:)?\/\//i;

const SIZE_CLASSES: Record<ButtonSize, string> = {
  sm: 'min-h-[36px] px-4 py-1.5 text-[13px] gap-1.5',
  md: 'min-h-[44px] px-5 py-2.5 text-[14px] gap-2',
  lg: 'min-h-[52px] px-6 py-3 text-[15px] gap-2.5',
};

/**
 * Bouton du kit visuel M1 (§5.2) :
 * - 6 variantes, 3 tailles, non capitalisé, poids 600, rayon 8 px.
 * - Utilise `m.button` avec le preset `pressable` (scale 0.97 en 120 ms).
 */
export function Button({
  variant = 'primary',
  size = 'md',
  iconLeft,
  iconRight,
  loading = false,
  fullWidth = false,
  href,
  external = false,
  disabled,
  className,
  children,
  type = 'button',
  ...props
}: ButtonProps) {
  const isDisabled = disabled || loading;

  const baseClassName = cn(
    'relative inline-flex shrink-0 items-center justify-center rounded-[var(--radius-md)] font-semibold whitespace-nowrap transition-all select-none',
    'disabled:pointer-events-none disabled:opacity-45',
    VARIANT_CLASSES[variant],
    SIZE_CLASSES[size],
    fullWidth && 'w-full',
    className,
  );

  const content = (
    <>
      {loading ? (
        <Loader2 className="h-4 w-4 shrink-0 animate-spin" aria-hidden="true" />
      ) : (
        iconLeft && <span className="inline-flex shrink-0 items-center">{iconLeft}</span>
      )}
      <span>{children}</span>
      {!loading && iconRight && (
        <span className="inline-flex shrink-0 items-center">{iconRight}</span>
      )}
    </>
  );

  if (href && !isDisabled) {
    // Téléphone, e-mail, SMS : simple lien, l'application concernée s'ouvre sans quitter la session (M6 §8)
    if (APP_SCHEME_PATTERN.test(href)) {
      return (
        <m.a href={href} className={baseClassName} {...pressable}>
          {content}
        </m.a>
      );
    }

    // WhatsApp, Google Maps et autres sites : nouvel onglet ou application, jamais dans l'app installée
    if (external || WEB_URL_PATTERN.test(href)) {
      return (
        <m.a
          href={href}
          target="_blank"
          rel="noopener noreferrer"
          className={baseClassName}
          {...pressable}
        >
          {content}
        </m.a>
      );
    }

    return (
      <m.div className={cn('inline-flex', fullWidth && 'w-full')} {...pressable}>
        <Link to={href} className={cn(baseClassName, 'w-full')}>
          {content}
        </Link>
      </m.div>
    );
  }

  return (
    <m.button
      type={type}
      disabled={isDisabled}
      className={baseClassName}
      {...(isDisabled ? {} : pressable)}
      {...(props as Record<string, unknown>)}
    >
      {content}
    </m.button>
  );
}
