import { useMotionValueEvent, useScroll } from 'motion/react';
import * as m from 'motion/react-m';
import { useRef, useState } from 'react';
import { Button } from '@/components/ui/Button';
import { Container, Section } from '@/components/ui/Primitives';
import { SmartImage } from '@/components/ui/SmartImage';
import { cn } from '@/lib/utils/cn';
import { useReducedMotionPref } from '@/motion/useReducedMotionPref';

const STEPS = [
  {
    number: '01',
    label: 'Étape 01',
    title: 'Réservez',
    description:
      'Choisissez vos articles et votre taille. Ils sont mis de côté pour vous pendant 24\u00A0h.',
  },
  {
    number: '02',
    label: 'Étape 02',
    title: 'Payez par Mobile Money',
    description:
      'Orange Money ou MTN MoMo. Envoyez votre preuve de paiement en un geste.',
  },
  {
    number: '03',
    label: 'Étape 03',
    title: 'Recevez ou retirez',
    description:
      'Nous validons, préparons et vous envoyons la photo de votre colis. Livraison ou retrait en boutique.',
  },
];

/** Avancement du trait (0 à 1) à partir duquel les étapes 2 et 3 s'allument. */
const STEP_THRESHOLDS = [0, 0.34, 0.72];

/**
 * « Réservez en 3 étapes » : le trait rouge suit le défilement et allume les étapes une à une
 * (transform scaleY seul). Les étapes pas encore atteintes restent lisibles (opacité 0,6).
 * Motion (déjà chargé par l'app) au lieu de GSAP ScrollTrigger : l'accueil n'attend pas GSAP.
 */
export function HowItWorksSection() {
  const stepsContainerRef = useRef<HTMLDivElement>(null);
  const reducedMotion = useReducedMotionPref();
  const [activeCount, setActiveCount] = useState(1);

  const { scrollYProgress } = useScroll({
    target: stepsContainerRef,
    offset: ['start 70%', 'end 60%'],
  });

  useMotionValueEvent(scrollYProgress, 'change', (progress) => {
    const reached = STEP_THRESHOLDS.filter((threshold) => progress >= threshold).length;
    setActiveCount(Math.max(1, reached));
  });

  return (
    <Section id="comment-reserver" className="scroll-mt-20">
      <Container>
        <div className="grid grid-cols-1 gap-8 lg:grid-cols-12 lg:items-start lg:gap-12">
          {/* Photo en haut sur téléphone (16:10) */}
          <div className="overflow-hidden rounded-[var(--radius-md)] lg:hidden">
            <SmartImage
              src="/images/how/how-it-works.webp"
              fallback="/images/fallback/mood-portrait.svg"
              alt=""
              tone="mood"
              ratio="16/10"
              sizes="100vw"
            />
          </div>

          {/* Colonne gauche : titre, 3 étapes et bouton */}
          <div className="lg:col-span-6">
            <span className="text-label text-red">Simple &amp; rapide</span>
            <h2 className="mt-2 text-h1 text-ink">RÉSERVEZ EN 3 ÉTAPES</h2>
            <p className="mt-3 max-w-md text-body text-text-2">
              Pas besoin de carte bancaire. Votre réservation bloque votre taille
              immédiatement pendant 24&nbsp;heures.
            </p>

            {/* Étapes reliées par un trait vertical */}
            <div ref={stepsContainerRef} className="relative mt-10 space-y-10">
              {/* Trait entre l'étape 1 et l'étape 3, centré sous les carrés de 44 px */}
              <div
                aria-hidden="true"
                className="absolute top-5 bottom-8 left-0 flex w-11 justify-center"
              >
                <div className="h-full w-[2px] bg-silver">
                  <m.div
                    className="h-full w-full origin-top bg-red"
                    style={{ scaleY: reducedMotion ? 1 : scrollYProgress }}
                  />
                </div>
              </div>

              {STEPS.map((step, index) => {
                const isReached = reducedMotion || activeCount >= index + 1;

                return (
                  <div key={step.number} className="relative flex items-start gap-5">
                    {/* Carré numéroté de 44 px */}
                    <div
                      className={cn(
                        'relative flex h-11 w-11 shrink-0 items-center justify-center rounded-[var(--radius-sm)] border-2 border-ink font-mono text-small font-bold transition-colors duration-quick',
                        isReached ? 'bg-ink text-white' : 'bg-white text-ink',
                      )}
                    >
                      {step.number}
                    </div>

                    {/* Texte de l'étape */}
                    <div
                      className={cn(
                        'pt-1 transition-opacity duration-base',
                        isReached ? 'opacity-100' : 'opacity-60',
                      )}
                    >
                      <span className="text-label text-text-2">{step.label}</span>
                      <h3 className="mt-1 text-h3 text-ink">{step.title}</h3>
                      <p className="mt-2 max-w-md text-small text-text-2">{step.description}</p>
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

          {/* Colonne droite (ordinateur) : photo 4:5 qui reste à l'écran */}
          <div className="hidden lg:sticky lg:top-[calc(var(--desktop-shell-top)+--spacing(6))] lg:col-span-6 lg:block">
            <div className="overflow-hidden rounded-[var(--radius-md)]">
              <SmartImage
                src="/images/how/how-it-works.webp"
                fallback="/images/fallback/mood-portrait.svg"
                alt=""
                tone="mood"
                ratio="4/5"
                sizes="580px"
              />
            </div>
          </div>
        </div>
      </Container>
    </Section>
  );
}
