import { useRef, type ReactNode } from 'react';
import { gsap, ScrollTrigger, useGSAP } from '@/lib/gsap';
import { cn } from '@/lib/utils/cn';
import { duration, gsapEase } from '@/motion/tokens';
import { useReducedMotionPref } from '@/motion/useReducedMotionPref';

export interface MarqueeItem {
  id: string;
  label: string;
  icon?: ReactNode;
}

export interface MarqueeProps {
  items: MarqueeItem[];
  tone?: 'red' | 'surface' | 'ink';
  speed?: number; // durée en secondes pour un tour complet (défaut: 40s)
  direction?: 'left' | 'right';
  separator?: string;
  className?: string;
}

const TONE_CLASSES: Record<NonNullable<MarqueeProps['tone']>, string> = {
  red: 'bg-red text-white h-12',
  surface: 'bg-surface text-ink h-18 border-y border-silver/60',
  ink: 'bg-ink text-white h-12',
};

/**
 * Marquee (§5.10 & §8.3) :
 * - Piste infinie GSAP (`xPercent: -50`, `ease: "none"`, `repeat: -1`).
 * - Réagit à la vitesse de défilement via `ScrollTrigger` (`self.getVelocity()`).
 * - Se met en pause hors de l'écran ou quand l'onglet est masqué.
 * - En mode `prefers-reduced-motion: reduce`, reste immobile et n'affiche le contenu qu'une fois.
 * - La piste dupliquée porte `aria-hidden="true"` pour les lecteurs d'écran.
 */
export function Marquee({
  items,
  tone = 'red',
  speed = 40,
  direction = 'left',
  separator = '✦',
  className,
}: MarqueeProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const trackRef = useRef<HTMLDivElement | null>(null);
  const reducedMotion = useReducedMotionPref();

  useGSAP(
    () => {
      if (reducedMotion || !trackRef.current || !containerRef.current) {
        return;
      }

      const baseDir = direction === 'left' ? 1 : -1;
      gsap.set(trackRef.current, { xPercent: baseDir === 1 ? 0 : -50 });

      const loopTween = gsap.to(trackRef.current, {
        xPercent: baseDir === 1 ? -50 : 0,
        duration: speed,
        ease: 'none',
        repeat: -1,
      });

      const st = ScrollTrigger.create({
        trigger: containerRef.current,
        start: 'top bottom',
        end: 'bottom top',
        onToggle: (self) => {
          if (self.isActive) {
            loopTween.play();
          } else {
            loopTween.pause();
          }
        },
        onUpdate: (self) => {
          if (!self.isActive) return;
          const velocity = self.getVelocity();
          const boost = gsap.utils.clamp(-3, 3, velocity / 600);
          const targetScale = boost < -0.4 ? -1.4 : 1 + Math.abs(boost);

          gsap.to(loopTween, {
            timeScale: targetScale,
            duration: duration.fast,
            overwrite: true,
            onComplete: () => {
              gsap.to(loopTween, {
                timeScale: 1,
                duration: duration.reveal,
                ease: gsapEase.soft,
              });
            },
          });
        },
      });

      const handleVisibilityChange = () => {
        if (document.hidden) {
          loopTween.pause();
        } else if (st.isActive) {
          loopTween.play();
        }
      };

      document.addEventListener('visibilitychange', handleVisibilityChange);
      return () => {
        document.removeEventListener('visibilitychange', handleVisibilityChange);
        st.kill();
        loopTween.kill();
      };
    },
    { scope: containerRef, dependencies: [reducedMotion, speed, direction] },
  );

  const renderTrackItems = (keyPrefix: string) =>
    items.map((item) => (
      <span
        key={`${keyPrefix}-${item.id}`}
        className={cn(
          'inline-flex shrink-0 items-center gap-2.5 whitespace-nowrap',
          tone === 'surface' ? 'text-body font-bold' : 'text-label',
        )}
      >
        {item.icon && <span className="inline-flex shrink-0 items-center">{item.icon}</span>}
        <span>{item.label}</span>
        <span
          aria-hidden="true"
          className={cn(
            'mx-4',
            tone === 'surface' ? 'text-silver' : 'opacity-75',
          )}
        >
          {separator}
        </span>
      </span>
    ));

  return (
    <div
      ref={containerRef}
      className={cn(
        'relative flex w-full items-center overflow-hidden select-none',
        TONE_CLASSES[tone],
        className,
      )}
    >
      {reducedMotion ? (
        <div className="mx-auto flex max-w-content flex-wrap items-center justify-center gap-y-2 px-page">
          {renderTrackItems('static')}
        </div>
      ) : (
        <div ref={trackRef} className="flex w-max items-center">
          <div className="flex shrink-0 items-center">{renderTrackItems('primary')}</div>
          <div aria-hidden="true" className="flex shrink-0 items-center">
            {renderTrackItems('duplicate')}
          </div>
        </div>
      )}
    </div>
  );
}
