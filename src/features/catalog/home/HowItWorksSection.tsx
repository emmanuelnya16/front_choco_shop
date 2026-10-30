import { useRef, useState } from 'react';
import { Button } from '@/components/ui/Button';
import { Section } from '@/components/ui/Primitives';
import { SmartImage } from '@/components/ui/SmartImage';
import { gsap, ScrollTrigger, useGSAP } from '@/lib/gsap';
import { cn } from '@/lib/utils/cn';
import { useReducedMotionPref } from '@/motion/useReducedMotionPref';

const STEPS = [
  {
    number: '01',
    label: 'Étape 01',
    title: 'Réservez',
    description:
      'Choisissez vos articles et votre taille. Ils sont mis de côté pour vous pendant 24 h.',
  },
  {
    number: '02',
    label: 'Étape 02',
    title: 'Payez par Mobile Money',
    description:
      'Orange Money ou MTN MoMo. Envoyez la capture de votre paiement en un geste.',
  },
  {
    number: '03',
    label: 'Étape 03',
    title: 'Recevez ou retirez',
    description:
      'Nous validons, préparons et vous envoyons la photo de votre colis. Livraison ou retrait en boutique.',
  },
];

export function HowItWorksSection() {
  const scopeRef = useRef<HTMLElement>(null);
  const stepsContainerRef = useRef<HTMLDivElement>(null);
  const reducedMotion = useReducedMotionPref();
  const [activeCount, setActiveCount] = useState(1);

  useGSAP(
    () => {
      if (reducedMotion || !stepsContainerRef.current) {
        gsap.set('.how-progress-line', { scaleY: 1 });
        return;
      }

      gsap.fromTo(
        '.how-progress-line',
        { scaleY: 0 },
        {
          scaleY: 1,
          ease: 'none',
          transformOrigin: 'top center',
          scrollTrigger: {
            trigger: stepsContainerRef.current,
            start: 'top 70%',
            end: 'bottom 60%',
            scrub: 0.6,
            onUpdate: (self) => {
              const p = self.progress;
              if (p >= 0.72) {
                setActiveCount(3);
              } else if (p >= 0.34) {
                setActiveCount(2);
              } else {
                setActiveCount(1);
              }
            },
          },
        },
      );
    },
    { scope: scopeRef, dependencies: [reducedMotion] },
  );

  return (
    <Section id="comment-reserver" ref={scopeRef} className="scroll-mt-20">
      <div className="grid grid-cols-1 gap-8 lg:grid-cols-12 lg:items-start lg:gap-12">
        {/* Mobile photo on top (16:10) */}
        <div className="overflow-hidden rounded-[var(--radius-md)] lg:hidden">
          <SmartImage
            src="/images/how/how-it-works.webp"
            fallback="/images/fallback/mood-portrait.svg"
            alt=""
            tone="mood"
            ratio="16/10"
            sizes="100vw"
            onLoadComplete={() => ScrollTrigger.refresh()}
          />
        </div>

        {/* Left Column: Title + 3 Steps + CTA */}
        <div className="lg:col-span-6">
          <span className="text-label text-red">Simple &amp; rapide</span>
          <h2 className="mt-2 text-h1 text-ink">RÉSERVEZ EN 3 ÉTAPES</h2>
          <p className="mt-3 max-w-md text-body text-text-2">
            Pas besoin de carte bancaire. Votre réservation bloque votre taille
            immédiatement pendant 24 heures.
          </p>

          {/* Steps with vertical connecting line */}
          <div ref={stepsContainerRef} className="relative mt-10 space-y-10">
            {/* Vertical track line between step 1 and step 3 */}
            <div
              aria-hidden="true"
              className="absolute top-5 bottom-8 left-[21px] w-[2px] bg-silver"
            >
              <div className="how-progress-line h-full w-full origin-top bg-red" />
            </div>

            {STEPS.map((step, index) => {
              const stepIndex = index + 1;
              const isReached = reducedMotion || activeCount >= stepIndex;

              return (
                <div
                  key={step.number}
                  className="relative flex items-start gap-5"
                >
                  {/* 44px numbered square */}
                  <div
                    className={cn(
                      'relative z-10 flex h-11 w-11 shrink-0 items-center justify-center rounded-[var(--radius-sm)] border-2 border-ink font-mono text-small font-bold transition-colors duration-250',
                      isReached
                        ? 'bg-ink text-white'
                        : 'bg-white text-ink',
                    )}
                  >
                    {step.number}
                  </div>

                  {/* Step content */}
                  <div
                    className={cn(
                      'pt-0.5 transition-opacity duration-300',
                      isReached ? 'opacity-100' : 'opacity-40',
                    )}
                  >
                    <span className="text-label text-text-2">{step.label}</span>
                    <h3 className="mt-1 text-h3 text-ink">{step.title}</h3>
                    <p className="mt-1.5 max-w-md text-small text-text-2">
                      {step.description}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="mt-10">
            <Button variant="dark" size="lg" href="/explorer">
              Commencer mes achats
            </Button>
          </div>
        </div>

        {/* Right Column (Desktop): Sticky 4:5 mood photo */}
        <div className="hidden lg:sticky lg:top-24 lg:col-span-6 lg:block">
          <div className="overflow-hidden rounded-[var(--radius-md)]">
            <SmartImage
              src="/images/how/how-it-works.webp"
              fallback="/images/fallback/mood-portrait.svg"
              alt=""
              tone="mood"
              ratio="4/5"
              sizes="580px"
              onLoadComplete={() => ScrollTrigger.refresh()}
            />
          </div>
        </div>
      </div>
    </Section>
  );
}
