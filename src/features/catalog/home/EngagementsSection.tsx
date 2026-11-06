import * as m from 'motion/react-m';
import { Camera, MapPin, PackageCheck, Smartphone } from 'lucide-react';
import { Container, Section } from '@/components/ui/Primitives';
import { SmartImage } from '@/components/ui/SmartImage';
import { cn } from '@/lib/utils/cn';
import { fadeUp } from '@/motion/presets';
import { useReducedMotionPref } from '@/motion/useReducedMotionPref';

const ENGAGEMENT_CARDS = [
  {
    id: 'reserve',
    icon: PackageCheck,
    title: 'Vos articles mis de côté',
    description:
      'Dès que vous réservez, votre taille est bloquée pour vous pendant 24\u00A0h. Personne ne peut vous la prendre.',
  },
  {
    id: 'momo',
    icon: Smartphone,
    title: 'Paiement Mobile Money',
    description:
      'Payez avec Orange Money ou MTN MoMo, comme d’habitude. Chaque paiement est vérifié par la boutique.',
  },
  {
    id: 'photo',
    icon: Camera,
    title: 'La photo de votre colis',
    description:
      'Avant l’envoi, vous recevez la photo de votre colis emballé. Vous savez exactement ce qui arrive.',
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
  fillCell = false,
}: {
  photo: (typeof ENGAGEMENT_PHOTOS)[number];
  reducedMotion: boolean;
  /** Tablette (md) : la photo prend la hauteur de la carte voisine dans la grille 2 colonnes au lieu de son format propre. */
  fillCell?: boolean;
}) {
  return (
    <m.div
      variants={fadeUp}
      initial={reducedMotion ? 'visible' : 'hidden'}
      whileInView="visible"
      viewport={{ once: true, amount: 0.25 }}
      className={cn('overflow-hidden rounded-[var(--radius-md)]', fillCell && 'md:relative md:min-h-48')}
    >
      <SmartImage
        src={photo.src}
        fallback={photo.fallback}
        alt=""
        tone="mood"
        ratio={photo.ratio}
        sizes="(min-width: 1024px) 380px, (min-width: 768px) 50vw, 100vw"
        className={fillCell ? 'md:absolute md:inset-0 md:aspect-auto md:h-full md:w-full' : undefined}
      />
    </m.div>
  );
}

/**
 * « Pourquoi nous faire confiance » : mosaïque décalée sur ordinateur, alternance carte / photo sur
 * téléphone. Apparitions discrètes au défilement seulement : la parallaxe des colonnes a été retirée
 * (un seul effet fort par écran, celui du hero).
 */
export function EngagementsSection() {
  const reducedMotion = useReducedMotionPref();

  return (
    <Section className="bg-surface/40">
      <Container>
        <div className="mx-auto max-w-2xl text-center">
          <span className="text-label text-red">Transparence &amp; service</span>
          <h2 className="mt-2 text-h2 text-ink">POURQUOI NOUS FAIRE CONFIANCE</h2>
        </div>

        {/* Ordinateur : mosaïque à 3 colonnes décalées */}
        <div className="mt-10 hidden grid-cols-3 items-start gap-6 lg:grid">
          {/* Colonne 1 : carte 1 et photo 1 */}
          <div className="space-y-6">
            <EngagementCard card={ENGAGEMENT_CARDS[0]} reducedMotion={reducedMotion} />
            <EngagementPhoto photo={ENGAGEMENT_PHOTOS[0]} reducedMotion={reducedMotion} />
          </div>

          {/* Colonne 2 (décalée de 48 px vers le bas) : photo 2, cartes 2 et 3 */}
          <div className="mt-12 space-y-6">
            <EngagementPhoto photo={ENGAGEMENT_PHOTOS[1]} reducedMotion={reducedMotion} />
            <EngagementCard card={ENGAGEMENT_CARDS[1]} reducedMotion={reducedMotion} />
            <EngagementCard card={ENGAGEMENT_CARDS[2]} reducedMotion={reducedMotion} />
          </div>

          {/* Colonne 3 : photo 3 et carte 4 */}
          <div className="space-y-6">
            <EngagementPhoto photo={ENGAGEMENT_PHOTOS[2]} reducedMotion={reducedMotion} />
            <EngagementCard card={ENGAGEMENT_CARDS[3]} reducedMotion={reducedMotion} />
          </div>
        </div>

        {/* Téléphone : une colonne, carte, photo, carte, carte, photo, carte.
            Tablette (md) : grille 2 colonnes (carte + photo, carte + carte, photo + carte) au lieu de
            photos pleine largeur de 700 à 900 px de haut. */}
        <div className="mt-8 space-y-4 md:grid md:grid-cols-2 md:gap-4 md:space-y-0 lg:hidden">
          <EngagementCard card={ENGAGEMENT_CARDS[0]} reducedMotion={reducedMotion} />
          <EngagementPhoto photo={ENGAGEMENT_PHOTOS[0]} reducedMotion={reducedMotion} fillCell />
          <EngagementCard card={ENGAGEMENT_CARDS[1]} reducedMotion={reducedMotion} />
          <EngagementCard card={ENGAGEMENT_CARDS[2]} reducedMotion={reducedMotion} />
          <EngagementPhoto photo={ENGAGEMENT_PHOTOS[1]} reducedMotion={reducedMotion} fillCell />
          <EngagementCard card={ENGAGEMENT_CARDS[3]} reducedMotion={reducedMotion} />
        </div>
      </Container>
    </Section>
  );
}
