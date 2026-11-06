import { useEffect, useRef, type RefObject } from 'react';
import type { MarqueeItem, MarqueeProps } from '@/components/ui/Marquee';
import { cn } from '@/lib/utils/cn';
import { useReducedMotionPref } from '@/motion/useReducedMotionPref';

/**
 * Bandeau défilant de l'accueil (M1 §7.2 et §7.6, finitions M7).
 *
 * Même rendu que le Marquee du kit, mais le défilement est une animation Web (WAAPI) de `transform`,
 * exécutée par le compositeur : rien à calculer à chaque image sur le fil principal. Mesuré sur
 * l'accueil avec un processeur ralenti ×4, les deux bandeaux GSAP doublaient le travail du fil
 * principal pendant le défilement de la page (≈ 20 s contre ≈ 10 s sans eux). Sans accélération au
 * défilement (un seul effet fort par écran) et sans GSAP à télécharger.
 * - Pause hors de l'écran et quand l'onglet est masqué.
 * - En mouvement réduit : textes immobiles, sur plusieurs lignes si besoin (le bandeau grandit au
 *   lieu de couper les textes).
 * - La piste dupliquée (boucle sans couture) est masquée aux lecteurs d'écran.
 */

type HomeMarqueeTone = Extract<NonNullable<MarqueeProps['tone']>, 'red' | 'surface'>;

interface HomeMarqueeProps {
  items: MarqueeItem[];
  tone: HomeMarqueeTone;
  direction: NonNullable<MarqueeProps['direction']>;
  separator: string;
}

/**
 * Durée d'un tour complet de la piste (vitesse de défilement, même valeur que le Marquee du kit).
 * HYPOTHÈSE: vitesse de lecture, pas une durée de transition : hors de l'échelle de src/motion/tokens.ts.
 */
const LOOP_SECONDS = 40;

// Mêmes hauteurs, couleurs et textes que Marquee (src/components/ui/Marquee.tsx)
const TONE_CLASSES: Record<HomeMarqueeTone, string> = {
  red: 'bg-red text-white',
  surface: 'bg-surface text-ink border-y border-silver/60',
};
const ROW_HEIGHT: Record<HomeMarqueeTone, string> = { red: 'h-12', surface: 'h-18' };
const WRAP_HEIGHT: Record<HomeMarqueeTone, string> = { red: 'min-h-12 py-3', surface: 'min-h-18 py-4' };

function BandItems({
  items,
  tone,
  separator,
  hideLastSeparator = false,
}: Pick<HomeMarqueeProps, 'items' | 'tone' | 'separator'> & { hideLastSeparator?: boolean }) {
  return items.map((item, index) => (
    <span
      key={item.id}
      className={cn(
        // Classes identiques à celles d'un élément du Marquee du kit (même gabarit)
        'inline-flex shrink-0 items-center gap-2.5 whitespace-nowrap',
        tone === 'surface' ? 'text-body font-bold' : 'text-label',
      )}
    >
      {item.icon && <span className="inline-flex shrink-0 items-center">{item.icon}</span>}
      <span>{item.label}</span>
      {!(hideLastSeparator && index === items.length - 1) && (
        <span aria-hidden="true" className={cn('mx-4', tone === 'surface' ? 'text-silver' : 'opacity-75')}>
          {separator}
        </span>
      )}
    </span>
  ));
}

function useMarqueeLoop(
  bandRef: RefObject<HTMLDivElement | null>,
  trackRef: RefObject<HTMLDivElement | null>,
  direction: HomeMarqueeProps['direction'],
  enabled: boolean,
) {
  useEffect(() => {
    const band = bandRef.current;
    const track = trackRef.current;
    if (!enabled || !band || !track || typeof track.animate !== 'function') return undefined;

    const keyframes =
      direction === 'left'
        ? [{ transform: 'translateX(0)' }, { transform: 'translateX(-50%)' }]
        : [{ transform: 'translateX(-50%)' }, { transform: 'translateX(0)' }];
    const animation = track.animate(keyframes, {
      duration: LOOP_SECONDS * 1000,
      iterations: Infinity,
      easing: 'linear',
    });

    let inView = true;
    const sync = () => {
      if (inView && !document.hidden) animation.play();
      else animation.pause();
    };
    const observer =
      typeof IntersectionObserver === 'function'
        ? new IntersectionObserver(([entry]) => {
            inView = entry.isIntersecting;
            sync();
          })
        : null;
    observer?.observe(band);
    document.addEventListener('visibilitychange', sync);

    return () => {
      observer?.disconnect();
      document.removeEventListener('visibilitychange', sync);
      animation.cancel();
    };
  }, [bandRef, trackRef, direction, enabled]);
}

export function HomeMarquee({ items, tone, direction, separator }: HomeMarqueeProps) {
  const reducedMotion = useReducedMotionPref();
  const bandRef = useRef<HTMLDivElement>(null);
  const trackRef = useRef<HTMLDivElement>(null);
  useMarqueeLoop(bandRef, trackRef, direction, !reducedMotion);

  return (
    <div
      ref={bandRef}
      className={cn(
        'relative flex w-full items-center overflow-hidden select-none',
        TONE_CLASSES[tone],
        reducedMotion ? WRAP_HEIGHT[tone] : ROW_HEIGHT[tone],
      )}
    >
      {reducedMotion ? (
        <div className="mx-auto flex max-w-content flex-wrap items-center justify-center gap-y-2 px-page">
          <BandItems items={items} tone={tone} separator={separator} hideLastSeparator />
        </div>
      ) : (
        <div ref={trackRef} className="flex w-max items-center">
          <div className="flex shrink-0 items-center">
            <BandItems items={items} tone={tone} separator={separator} />
          </div>
          <div aria-hidden="true" className="flex shrink-0 items-center">
            <BandItems items={items} tone={tone} separator={separator} />
          </div>
        </div>
      )}
    </div>
  );
}
