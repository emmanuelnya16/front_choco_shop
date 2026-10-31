import { cn } from '@/lib/utils/cn';
import { LOGO_EMBLEM_SRC_SMALL, LOGO_EMBLEM_SRCSET } from './logoAssets';

export interface LogoProps {
  variant?: 'light' | 'dark';
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

const SIZE_STYLES = {
  sm: {
    wrapper: 'h-8 gap-2',
    emblem: 'h-8 w-8',
    emblemSizes: '32px',
    brand: 'text-[17px] leading-none',
    sub: 'text-[8px] tracking-[0.28em]',
  },
  md: {
    wrapper: 'h-10 gap-2.5',
    emblem: 'h-10 w-10',
    emblemSizes: '40px',
    brand: 'text-[20px] leading-none',
    sub: 'text-[9px] tracking-[0.3em]',
  },
  lg: {
    wrapper: 'h-12 gap-3',
    emblem: 'h-12 w-12',
    emblemSizes: '48px',
    brand: 'text-[25px] leading-none',
    sub: 'text-[10px] tracking-[0.3em]',
  },
} as const;

/**
 * Logo DR Choco L'Incompris : emblème officiel du client (rond, blanc sur ink) + nom
 * « DR CHOCO » en Archivo 800 condensé (75 %, -0,02em) et « L’INCOMPRIS » dessous (+0,3em).
 * Le nom reste écrit à côté : le texte de l'emblème n'est pas lisible à la taille d'un en-tête.
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
      <img
        src={LOGO_EMBLEM_SRC_SMALL}
        srcSet={LOGO_EMBLEM_SRCSET}
        sizes={s.emblemSizes}
        alt=""
        aria-hidden="true"
        width={128}
        height={128}
        decoding="async"
        draggable={false}
        className={cn('shrink-0 rounded-[var(--radius-full)]', s.emblem)}
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
