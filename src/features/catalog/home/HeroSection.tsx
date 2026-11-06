import { stagger, type Variants } from 'motion/react';
import * as m from 'motion/react-m';
import { useSyncExternalStore } from 'react';
import { Button } from '@/components/ui/Button';
import { Container } from '@/components/ui/Primitives';
import { SmartImage } from '@/components/ui/SmartImage';
import { lineReveal } from '@/motion/presets';
import { delay, duration, ease, staggerSlow } from '@/motion/tokens';
import { useReducedMotionPref } from '@/motion/useReducedMotionPref';

/**
 * Photos du hero (public/images/README.md). Fichiers locaux en une seule taille : chacun doit rester
 * sous 250 Ko (`npm run check:size` le vérifie sur le build).
 * HYPOTHÈSE: pas de variante AVIF tant que les fichiers n'existent pas ; une <source> AVIF absente
 * afficherait le visuel de repli au lieu de la photo WebP.
 */
const HERO_IMAGE_MOBILE = '/images/hero/hero-mobile.webp';
const HERO_SOURCES = [
  { media: '(min-width: 64rem)', srcSet: '/images/hero/hero-desktop.webp', type: 'image/webp' },
] as const;

/**
 * Entrée du hero : le seul effet fort de l'accueil (M7 §4.4). Motion (déjà chargé par l'app) au lieu
 * de GSAP : la page s'affiche sans attendre GSAP. Pastille, trois lignes du titre, texte puis boutons,
 * à 0,1 s d'écart ; seules l'opacité et la position bougent (boutons utilisables dès l'affichage).
 */
const heroSequence: Variants = {
  hidden: {},
  visible: { transition: { delayChildren: stagger(staggerSlow, { startDelay: delay.short }) } },
};

const heroRise: Variants = {
  hidden: { opacity: 0, y: 16 },
  visible: { opacity: 1, y: 0, transition: { duration: duration.slow, ease: ease.out } },
};

// Indicateur de défilement (ordinateur seulement) : monté à partir de lg pour ne pas animer
// un élément masqué sur téléphone
const DESKTOP_QUERY = '(min-width: 64rem)';

function subscribeDesktop(onChange: () => void) {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return () => {};
  const query = window.matchMedia(DESKTOP_QUERY);
  query.addEventListener('change', onChange);
  return () => query.removeEventListener('change', onChange);
}

function readDesktop() {
  return typeof window !== 'undefined' && typeof window.matchMedia === 'function'
    ? window.matchMedia(DESKTOP_QUERY).matches
    : false;
}

export function HeroSection() {
  const reducedMotion = useReducedMotionPref();
  const isDesktop = useSyncExternalStore(subscribeDesktop, readDesktop, () => false);

  const handleScrollToHowItWorks = () => {
    const el = document.getElementById('comment-reserver');
    if (el) {
      el.scrollIntoView({ behavior: reducedMotion ? 'auto' : 'smooth' });
    }
  };

  return (
    <section
      aria-label="Présentation de la nouvelle collection"
      className="relative flex h-[88svh] min-h-140 w-full overflow-hidden bg-ink lg:h-[min(88vh,760px)]"
    >
      {/* Photo de fond : léger recul à l'arrivée (transform seul, visible dès le premier affichage) */}
      <m.div
        className="absolute inset-0 h-full w-full"
        initial={reducedMotion ? false : { scale: 1.06 }}
        animate={{ scale: 1 }}
        transition={{ duration: duration.ambient, ease: ease.out }}
      >
        {/* Une seule image téléchargée (M7 §7) : portrait 9:14 sur téléphone, 16:9 à partir de lg
            (64rem). Image du premier affichage : chargée tout de suite et en priorité. */}
        <SmartImage
          src={HERO_IMAGE_MOBILE}
          sources={HERO_SOURCES}
          fallback="/images/fallback/mood-hero.svg"
          alt=""
          tone="mood"
          ratio="auto"
          priority
          sizes="100vw"
          className="h-full w-full"
          imgClassName="h-full w-full object-cover object-center"
        />
      </m.div>

      {/* Voile mobile : ink 95 % en bas, 40 % en haut */}
      <div
        className="pointer-events-none absolute inset-0 lg:hidden"
        style={{
          background:
            'linear-gradient(to top, var(--color-scrim-95) 0%, var(--color-scrim-55) 60%, var(--color-scrim-40) 100%)',
        }}
        aria-hidden="true"
      />

      {/* Voile ordinateur : ink 85 % à gauche, transparent à droite */}
      <div
        className="pointer-events-none absolute inset-0 hidden lg:block"
        style={{
          background:
            'linear-gradient(to right, var(--color-scrim-85) 0%, var(--color-scrim-55) 50%, transparent 100%)',
        }}
        aria-hidden="true"
      />

      {/* Contenu : en bas sur téléphone (32 px du bord), centré verticalement sur ordinateur */}
      <Container className="relative flex h-full w-full flex-col justify-end pt-[var(--header-h)] pb-8 lg:justify-center lg:py-0">
        <m.div
          className="max-w-155"
          variants={heroSequence}
          initial={reducedMotion ? false : 'hidden'}
          animate="visible"
        >
          {/* 1. Pastille */}
          <m.div
            variants={heroRise}
            className="inline-flex h-8 items-center gap-2 rounded-full border border-[var(--color-glass-border)] bg-[var(--color-glass-light)] px-4 backdrop-blur-md"
          >
            <span className="h-2 w-2 rounded-full bg-red" aria-hidden="true" />
            <span className="text-label text-white">Nouvelle collection</span>
          </m.div>

          {/* 2. Titre sur 3 lignes masquées (.mask-line) */}
          <h1 className="mt-5 text-display text-white">
            <span className="mask-line">
              <m.span variants={lineReveal} className="block">
                L&rsquo;INCOMPRIS
              </m.span>
            </span>
            <span className="mask-line">
              <m.span variants={lineReveal} className="block">
                NE SE PLIE
              </m.span>
            </span>
            <span className="mask-line">
              <m.span variants={lineReveal} className="block">
                À PERSONNE<span className="text-red">.</span>
              </m.span>
            </span>
          </h1>

          {/* 3. Description */}
          <m.p variants={heroRise} className="mt-4 max-w-105 text-body text-silver">
            Vêtements, chaussures et babouches pour hommes. Réservez en ligne,
            payez par Mobile Money, recevez partout au Cameroun.
          </m.p>

          {/* 4. Deux boutons lg côte à côte (l'un sous l'autre sous 400 px) */}
          <div className="mt-7 flex flex-row flex-wrap items-center gap-3 max-[400px]:flex-col max-[400px]:items-stretch">
            <m.div variants={heroRise} className="max-[400px]:w-full">
              <Button variant="primary" size="lg" href="/explorer" className="max-[400px]:w-full">
                Découvrir la collection
              </Button>
            </m.div>
            <m.div variants={heroRise} className="max-[400px]:w-full">
              <Button
                variant="light"
                size="lg"
                onClick={handleScrollToHowItWorks}
                className="max-[400px]:w-full"
              >
                Comment réserver
              </Button>
            </m.div>
          </div>
        </m.div>
      </Container>

      {/* Indicateur de défilement (ordinateur) : trait vertical de 40 px en bas, au centre */}
      {isDesktop && (
        <div
          aria-hidden="true"
          className="pointer-events-none absolute bottom-6 left-1/2 flex -translate-x-1/2 flex-col items-center gap-2"
        >
          <div className="relative h-10 w-[2px] overflow-hidden bg-white/25">
            {reducedMotion ? (
              <div className="h-4 w-full bg-red" />
            ) : (
              <m.div
                className="h-4 w-full bg-red"
                initial={{ y: '-100%' }}
                animate={{ y: ['-100%', '250%'] }}
                transition={{ duration: duration.ambient, ease: ease.inOut, repeat: Infinity }}
              />
            )}
          </div>
        </div>
      )}
    </section>
  );
}
