import { cn } from '@/lib/utils/cn';

export interface LogoProps {
  variant?: 'light' | 'dark';
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

const SIZE_STYLES = {
  sm: {
    wrapper: 'h-7 gap-2',
    dot: 'h-2 w-2',
    brand: 'text-[17px] leading-none',
    sub: 'text-[8px] tracking-[0.28em]',
  },
  md: {
    wrapper: 'h-8 gap-2.5',
    dot: 'h-2 w-2',
    brand: 'text-[20px] leading-none',
    sub: 'text-[9px] tracking-[0.3em]',
  },
  lg: {
    wrapper: 'h-10 gap-3',
    dot: 'h-2.5 w-2.5',
    brand: 'text-[25px] leading-none',
    sub: 'text-[10px] tracking-[0.3em]',
  },
} as const;

/**
 * Logo officiel DR Choco L'Incompris (§5.1) :
 * Cercle plein rouge de 8 px + « DR CHOCO » en Archivo 800 condensé (75 %, -0,02em)
 * + « L’INCOMPRIS » dessous en text-label (+0,3em).
 */
export function Logo({ variant = 'dark', size = 'md', className }: LogoProps) {
  const s = SIZE_STYLES[size];
  const isLight = variant === 'light';

  return (
    <span
      className={cn(
        'inline-flex shrink-0 items-center select-none whitespace-nowrap',
        s.wrapper,
        className,
      )}
    >
      <span
        aria-hidden="true"
        className={cn('shrink-0 rounded-[var(--radius-full)] bg-red', s.dot)}
      />
      <span className="flex flex-col justify-center">
        <span
          className={cn(
            'font-extrabold uppercase tracking-[-0.02em]',
            s.brand,
            isLight ? 'text-white' : 'text-ink',
          )}
          style={{ fontStretch: '75%', fontVariationSettings: "'wdth' 75" }}
        >
          DR CHOCO
        </span>
        <span
          className={cn(
            'mt-0.5 font-semibold uppercase leading-none',
            s.sub,
            isLight ? 'text-silver' : 'text-text-2',
          )}
        >
          L&rsquo;INCOMPRIS
        </span>
      </span>
    </span>
  );
}
