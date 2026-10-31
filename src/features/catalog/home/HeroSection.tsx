import { useRef } from 'react';
import { Button } from '@/components/ui/Button';
import { Container } from '@/components/ui/Primitives';
import { SmartImage } from '@/components/ui/SmartImage';
import { gsap, useGSAP } from '@/lib/gsap';
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

export function HeroSection() {
  const scopeRef = useRef<HTMLElement>(null);
  const reducedMotion = useReducedMotionPref();

  useGSAP(
    () => {
      if (reducedMotion || !scopeRef.current) {
        gsap.set(
          [
            '.hero-bg-media',
            '.hero-pill',
            '.hero-line',
            '.hero-desc',
            '.hero-cta',
            '.hero-scroll-dot',
          ],
          { clearProps: 'all' },
        );
        return;
      }

      const tl = gsap.timeline({ defaults: { ease: 'power3.out' } });

      tl.fromTo(
        '.hero-bg-media',
        { scale: 1.12, autoAlpha: 0 },
        { scale: 1, autoAlpha: 1, duration: 1.6, ease: 'power3.out' },
        0,
      )
        .fromTo(
          '.hero-pill',
          { y: 12, autoAlpha: 0 },
          { y: 0, autoAlpha: 1, duration: 0.5 },
          0.15,
        )
        .fromTo(
          '.hero-line',
          { yPercent: 110 },
          { yPercent: 0, duration: 1, ease: 'power4.out', stagger: 0.1 },
          0.25,
        )
        .fromTo(
          '.hero-desc',
          { y: 16, autoAlpha: 0 },
          { y: 0, autoAlpha: 1, duration: 0.7 },
          0.75,
        )
        .fromTo(
          '.hero-cta',
          { y: 16, autoAlpha: 0 },
          { y: 0, autoAlpha: 1, duration: 0.55, stagger: 0.08 },
          0.9,
        );

      // Scroll parallax on the hero background media
      gsap.fromTo(
        '.hero-bg-parallax',
        { yPercent: 0, scale: 1 },
        {
          yPercent: 12,
          scale: 1.06,
          ease: 'none',
          scrollTrigger: {
            trigger: scopeRef.current,
            start: 'top top',
            end: 'bottom top',
            scrub: true,
          },
        },
      );

      // Desktop scroll indicator loop
      gsap.fromTo(
        '.hero-scroll-dot',
        { yPercent: -100 },
        {
          yPercent: 200,
          duration: 1.6,
          ease: 'power2.inOut',
          repeat: -1,
        },
      );
    },
    { scope: scopeRef, dependencies: [reducedMotion] },
  );

  const handleScrollToHowItWorks = () => {
    const el = document.getElementById('comment-reserver');
    if (el) {
      el.scrollIntoView({ behavior: reducedMotion ? 'auto' : 'smooth' });
    }
  };

  return (
    <section
      ref={scopeRef}
      aria-label="Présentation de la nouvelle collection"
      className="relative flex h-[88svh] min-h-[560px] w-full overflow-hidden bg-ink lg:h-[min(88vh,760px)]"
    >
      {/* Background images with parallax wrapper */}
      <div className="hero-bg-parallax absolute inset-0 h-full w-full">
        <div className="hero-bg-media relative h-full w-full">
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
        </div>
      </div>

      {/* Mobile Scrim: bottom ink 95% to top 55% */}
      <div
        className="pointer-events-none absolute inset-0 lg:hidden"
        style={{
          background:
            'linear-gradient(to top, var(--color-scrim-95) 0%, var(--color-scrim-55) 60%, var(--color-scrim-40) 100%)',
        }}
        aria-hidden="true"
      />

      {/* Desktop Scrim: left ink 85% to right transparent */}
      <div
        className="pointer-events-none absolute inset-0 hidden lg:block"
        style={{
          background:
            'linear-gradient(to right, var(--color-scrim-85) 0%, var(--color-scrim-55) 50%, transparent 100%)',
        }}
        aria-hidden="true"
      />

      {/* Foreground Content: bottom-aligned on mobile (32px from bottom), vertically centered on desktop */}
      <Container className="relative z-10 flex h-full w-full flex-col justify-end pt-[var(--header-h)] pb-8 lg:justify-center lg:py-0">
        <div className="max-w-[620px]">
          {/* 1. Pill */}
          <div className="hero-pill inline-flex items-center gap-2 rounded-full border border-[var(--color-glass-border)] bg-[var(--color-glass-light)] px-3.5 py-1.5 backdrop-blur-md">
            <span
              className="h-2 w-2 rounded-full bg-red"
              aria-hidden="true"
            />
            <span className="text-label text-white">Nouvelle collection</span>
          </div>

          {/* 2. Title on 3 lines inside .mask-line */}
          <h1 className="mt-5 text-display text-white">
            <span className="mask-line">
              <span className="hero-line block">L&apos;INCOMPRIS</span>
            </span>
            <span className="mask-line">
              <span className="hero-line block">NE SE PLIE</span>
            </span>
            <span className="mask-line">
              <span className="hero-line block">
                À PERSONNE<span className="text-red">.</span>
              </span>
            </span>
          </h1>

          {/* 3. Description */}
          <p className="hero-desc mt-4 max-w-[420px] text-body text-silver">
            Vêtements, chaussures et babouches pour hommes. Réservez en ligne,
            payez par Mobile Money, recevez partout au Cameroun.
          </p>

          {/* 4. Two lg buttons side by side (stacked under 400px) */}
          <div className="mt-7 flex flex-row flex-wrap items-center gap-3 max-[400px]:flex-col max-[400px]:items-stretch">
            <div className="hero-cta max-[400px]:w-full">
              <Button
                variant="primary"
                size="lg"
                href="/explorer"
                className="max-[400px]:w-full"
              >
                Découvrir la collection
              </Button>
            </div>
            <div className="hero-cta max-[400px]:w-full">
              <Button
                variant="light"
                size="lg"
                onClick={handleScrollToHowItWorks}
                className="max-[400px]:w-full"
              >
                Comment réserver
              </Button>
            </div>
          </div>
        </div>
      </Container>

      {/* Desktop Scroll Indicator (40px vertical line at bottom center) */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute bottom-6 left-1/2 z-10 hidden -translate-x-1/2 flex-col items-center gap-2 lg:flex"
      >
        <div className="relative h-10 w-[2px] overflow-hidden bg-white/25">
          <div className="hero-scroll-dot h-4 w-full bg-red" />
        </div>
      </div>
    </section>
  );
}
