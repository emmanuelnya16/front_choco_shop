import { Play, RotateCcw } from 'lucide-react';
import { useRef, useState } from 'react';
import { gsap, useGSAP } from '@/lib/gsap';
import { gsapEase } from '@/motion/tokens';
import { prefersReducedMotion } from '@/motion/useReducedMotionPref';

export default function GsapTestSandbox() {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [runCount, setRunCount] = useState(0);

  const { contextSafe } = useGSAP(
    () => {
      if (prefersReducedMotion()) {
        gsap.set('.gsap-box', { x: 88, rotation: 90, autoAlpha: 1 });
        gsap.set('.gsap-circle', { drawSVG: '100%', autoAlpha: 1 });
        gsap.set('.gsap-check', { drawSVG: '100%', autoAlpha: 1 });
        return;
      }

      gsap.set('.gsap-box', { x: 0, rotation: 0, autoAlpha: 1 });
      gsap.set('.gsap-circle', { drawSVG: '0%', autoAlpha: 1 });
      gsap.set('.gsap-check', { drawSVG: '0%', autoAlpha: 0 });
    },
    { scope: containerRef },
  );

  const handlePlayTimeline = contextSafe(() => {
    setRunCount((c) => c + 1);
    gsap.killTweensOf(['.gsap-box', '.gsap-circle', '.gsap-check']);

    if (prefersReducedMotion()) {
      gsap.set('.gsap-box', { x: 88, rotation: 90, autoAlpha: 1 });
      gsap.set('.gsap-circle', { drawSVG: '100%', autoAlpha: 1 });
      gsap.set('.gsap-check', { drawSVG: '100%', autoAlpha: 1 });
      return;
    }

    const tl = gsap.timeline({
      defaults: { ease: gsapEase.base },
    });

    tl.set('.gsap-box', { x: 0, rotation: 0, scale: 1, autoAlpha: 1 })
      .set('.gsap-circle', { drawSVG: '0%', autoAlpha: 1 })
      .set('.gsap-check', { drawSVG: '0%', autoAlpha: 0 })
      .to('.gsap-box', {
        x: 88,
        rotation: 90,
        duration: 0.48,
        ease: gsapEase.out,
      })
      .to(
        '.gsap-circle',
        {
          drawSVG: '100%',
          duration: 0.55,
          ease: gsapEase.inOut,
        },
        '-=0.15',
      )
      .set('.gsap-check', { autoAlpha: 1 })
      .to('.gsap-check', {
        drawSVG: '100%',
        duration: 0.35,
        ease: gsapEase.out,
      });
  });

  const handleReset = contextSafe(() => {
    gsap.killTweensOf(['.gsap-box', '.gsap-circle', '.gsap-check']);
    gsap.set('.gsap-box', { x: 0, rotation: 0, scale: 1, autoAlpha: 1 });
    gsap.set('.gsap-circle', { drawSVG: '0%', autoAlpha: 1 });
    gsap.set('.gsap-check', { drawSVG: '0%', autoAlpha: 0 });
  });

  return (
    <div
      ref={containerRef}
      className="rounded-[var(--radius-md)] border border-silver bg-surface p-5"
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <span className="inline-flex items-center rounded-[var(--radius-sm)] bg-success px-2.5 py-1 text-label text-white">
            GSAP chargé à la demande ✓
          </span>
          <span className="text-small text-text-2">
            useGSAP + scope + contextSafe + DrawSVGPlugin
          </span>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handlePlayTimeline}
            className="inline-flex min-h-[44px] items-center gap-2 rounded-[var(--radius-md)] bg-ink px-4 py-2 text-small font-bold text-white transition-opacity hover:opacity-90"
          >
            <Play className="h-4 w-4" aria-hidden="true" />
            Lancer la timeline GSAP
          </button>
          <button
            type="button"
            onClick={handleReset}
            className="inline-flex min-h-[44px] items-center gap-2 rounded-[var(--radius-md)] border border-silver bg-white px-3.5 py-2 text-small font-semibold text-ink hover:bg-surface"
          >
            <RotateCcw className="h-4 w-4" aria-hidden="true" />
            Réinitialiser
          </button>
        </div>
      </div>

      <div className="mt-5 flex flex-wrap items-center justify-between gap-6 rounded-[var(--radius-md)] border border-silver bg-white p-5">
        <div className="flex items-center gap-4">
          <div
            className="gsap-box flex h-14 w-14 items-center justify-center rounded-[var(--radius-sm)] bg-ink text-body font-extrabold text-white"
            aria-label="Carré anthracite animé par GSAP"
          >
            C
          </div>
          <p className="max-w-xs text-small text-text-2">
            1. Translation <code className="font-mono text-ink">x: 88</code> + rotation{' '}
            <code className="font-mono text-ink">90°</code> → 2. Tracé SVG{' '}
            <code className="font-mono text-ink">DrawSVG</code>.
          </p>
        </div>

        <div className="flex items-center gap-4">
          <svg
            width="68"
            height="68"
            viewBox="0 0 68 68"
            fill="none"
            aria-label="Cercle SVG tracé avec DrawSVGPlugin"
            className="shrink-0"
          >
            <circle
              cx="34"
              cy="34"
              r="28"
              stroke="var(--color-silver)"
              strokeWidth="4"
            />
            <circle
              className="gsap-circle"
              cx="34"
              cy="34"
              r="28"
              stroke="var(--color-red)"
              strokeWidth="4"
              strokeLinecap="round"
            />
            <path
              className="gsap-check"
              d="M22 34.5L30.5 43L46 25.5"
              stroke="var(--color-ink)"
              strokeWidth="4"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
          <div className="text-small">
            <p className="font-bold text-ink">Exécutions</p>
            <p className="font-mono tabular-nums text-text-2">{runCount}</p>
          </div>
        </div>
      </div>
    </div>
  );
}
