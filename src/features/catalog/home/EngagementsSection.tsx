import { useScroll, useTransform } from 'motion/react';
import * as m from 'motion/react-m';
import { Camera, MapPin, PackageCheck, Smartphone } from 'lucide-react';
import { useRef } from 'react';
import { Section } from '@/components/ui/Primitives';
import { SmartImage } from '@/components/ui/SmartImage';
import { fadeUp } from '@/motion/presets';
import { useReducedMotionPref } from '@/motion/useReducedMotionPref';

const ENGAGEMENT_CARDS = [
  {
    id: 'reserve',
    icon: PackageCheck,
    title: 'Vos articles mis de côté',
    description:
      'Dès que vous réservez, votre taille est bloquée pour vous pendant 24 h. Personne ne peut vous la prendre.',
  },
  {
    id: 'momo',
    icon: Smartphone,
    title: 'Paiement Mobile Money',
    description:
      "Payez avec Orange Money ou MTN MoMo, comme d'habitude. Chaque paiement est vérifié par la boutique.",
  },
  {
    id: 'photo',
    icon: Camera,
    title: 'La photo de votre colis',
    description:
      "Avant l'envoi, vous recevez la photo de votre commande emballée. Vous savez exactement ce qui arrive.",
  },
  {
    id: 'cameroun',
    icon: MapPin,
    title: 'Partout au Cameroun',
    description:
      'Livraison dans votre ville ou envoi par agence de transport. Ou retrait gratuit en boutique.',
  },
];

const ENGAGEMENT_PHOTOS = [
  {
    id: 'photo-1',
    src: '/images/engagements/engagement-1.webp',
    fallback: '/images/fallback/mood-vetements.svg',
    ratio: '4/5' as const,
  },
  {
    id: 'photo-2',
    src: '/images/engagements/engagement-2.webp',
    fallback: '/images/fallback/mood-babouches.svg',
    ratio: '1/1' as const,
  },
  {
    id: 'photo-3',
    src: '/images/engagements/engagement-3.webp',
    fallback: '/images/fallback/mood-chaussures.svg',
    ratio: '4/5' as const,
  },
];

function EngagementCard({
  card,
  reducedMotion,
}: {
  card: (typeof ENGAGEMENT_CARDS)[number];
  reducedMotion: boolean;
}) {
  const Icon = card.icon;

  return (
    <m.article
      variants={fadeUp}
      initial={reducedMotion ? 'visible' : 'hidden'}
      whileInView="visible"
      viewport={{ once: true, amount: 0.25 }}
      className="rounded-[var(--radius-md)] border border-silver/60 bg-white p-6"
    >
      <div className="flex h-11 w-11 items-center justify-center rounded-[var(--radius-sm)] bg-surface text-red">
        <Icon className="h-6 w-6" aria-hidden="true" />
      </div>
      <h3 className="mt-4 text-h3 text-ink">{card.title}</h3>
      <p className="mt-2 text-small text-text-2">{card.description}</p>
    </m.article>
  );
}

function EngagementPhoto({
  photo,
  reducedMotion,
}: {
  photo: (typeof ENGAGEMENT_PHOTOS)[number];
  reducedMotion: boolean;
}) {
  return (
    <m.div
      variants={fadeUp}
      initial={reducedMotion ? 'visible' : 'hidden'}
      whileInView="visible"
      viewport={{ once: true, amount: 0.25 }}
      className="overflow-hidden rounded-[var(--radius-md)]"
    >
      <SmartImage
        src={photo.src}
        fallback={photo.fallback}
        alt=""
        tone="mood"
        ratio={photo.ratio}
        sizes="(min-width: 1024px) 380px, 100vw"
      />
    </m.div>
  );
}

export function EngagementsSection() {
  const sectionRef = useRef<HTMLElement>(null);
  const reducedMotion = useReducedMotionPref();

  const { scrollYProgress } = useScroll({
    target: sectionRef,
    offset: ['start end', 'end start'],
  });

  const colLeftY = useTransform(
    scrollYProgress,
    [0, 1],
    reducedMotion ? [0, 0] : [20, -20],
  );
  const colCenterY = useTransform(
    scrollYProgress,
    [0, 1],
    reducedMotion ? [0, 0] : [-24, 24],
  );
  const colRightY = useTransform(
    scrollYProgress,
    [0, 1],
    reducedMotion ? [0, 0] : [16, -16],
  );

  return (
    <Section ref={sectionRef} className="bg-surface/40">
      <div className="mx-auto max-w-2xl text-center">
        <span className="text-label text-red">Transparence &amp; service</span>
        <h2 className="mt-2 text-h2 text-ink">
          POURQUOI NOUS FAIRE CONFIANCE
        </h2>
      </div>

      {/* Desktop 3-column staggered mosaic with subtle parallax */}
      <div className="mt-10 hidden grid-cols-3 items-start gap-6 lg:grid">
        {/* Column 1: Card 0 + Photo 0 */}
        <m.div style={{ y: colLeftY }} className="space-y-6">
          <EngagementCard
            card={ENGAGEMENT_CARDS[0]}
            reducedMotion={reducedMotion}
          />
          <EngagementPhoto
            photo={ENGAGEMENT_PHOTOS[0]}
            reducedMotion={reducedMotion}
          />
        </m.div>

        {/* Column 2 (offset 48px downward): Photo 1 + Card 1 + Card 2 */}
        <m.div style={{ y: colCenterY }} className="mt-12 space-y-6">
          <EngagementPhoto
            photo={ENGAGEMENT_PHOTOS[1]}
            reducedMotion={reducedMotion}
          />
          <EngagementCard
            card={ENGAGEMENT_CARDS[1]}
            reducedMotion={reducedMotion}
          />
          <EngagementCard
            card={ENGAGEMENT_CARDS[2]}
            reducedMotion={reducedMotion}
          />
        </m.div>

        {/* Column 3: Photo 2 + Card 3 */}
        <m.div style={{ y: colRightY }} className="space-y-6">
          <EngagementPhoto
            photo={ENGAGEMENT_PHOTOS[2]}
            reducedMotion={reducedMotion}
          />
          <EngagementCard
            card={ENGAGEMENT_CARDS[3]}
            reducedMotion={reducedMotion}
          />
        </m.div>
      </div>

      {/* Mobile single column alternating: card, photo, card, card, photo, card */}
      <div className="mt-8 space-y-4 lg:hidden">
        <EngagementCard
          card={ENGAGEMENT_CARDS[0]}
          reducedMotion={reducedMotion}
        />
        <EngagementPhoto
          photo={ENGAGEMENT_PHOTOS[0]}
          reducedMotion={reducedMotion}
        />
        <EngagementCard
          card={ENGAGEMENT_CARDS[1]}
          reducedMotion={reducedMotion}
        />
        <EngagementCard
          card={ENGAGEMENT_CARDS[2]}
          reducedMotion={reducedMotion}
        />
        <EngagementPhoto
          photo={ENGAGEMENT_PHOTOS[1]}
          reducedMotion={reducedMotion}
        />
        <EngagementCard
          card={ENGAGEMENT_CARDS[3]}
          reducedMotion={reducedMotion}
        />
      </div>
    </Section>
  );
}
