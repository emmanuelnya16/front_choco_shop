import {
  Camera,
  ShieldCheck,
  Smartphone,
  Store,
  Truck,
} from 'lucide-react';
import type { ReactNode } from 'react';
import { ErrorBoundary } from '@/components/errors/ErrorBoundary';
import { Marquee, type MarqueeItem } from '@/components/ui/Marquee';
import { BabouchesSpotlightSection } from '@/features/catalog/home/BabouchesSpotlightSection';
import { BestSellersSection } from '@/features/catalog/home/BestSellersSection';
import { CategoriesSection } from '@/features/catalog/home/CategoriesSection';
import { EngagementsSection } from '@/features/catalog/home/EngagementsSection';
import { HeroSection } from '@/features/catalog/home/HeroSection';
import { HowItWorksSection } from '@/features/catalog/home/HowItWorksSection';
import { LooksSection } from '@/features/catalog/home/LooksSection';
import { NewArrivalsSection } from '@/features/catalog/home/NewArrivalsSection';
import { WhatsAppAppSection } from '@/features/catalog/home/WhatsAppAppSection';
import { InstallAutoPrompt } from '@/features/install/InstallAutoPrompt';

const BENEFITS_MARQUEE_ITEMS: MarqueeItem[] = [
  { id: 'b-1', label: 'LIVRAISON PARTOUT AU CAMEROUN' },
  { id: 'b-2', label: 'PAIEMENT ORANGE MONEY & MTN MOMO' },
  { id: 'b-3', label: 'RETRAIT GRATUIT EN BOUTIQUE' },
  { id: 'b-4', label: 'ARTICLES MIS DE CÔTÉ 24 H POUR VOUS' },
  { id: 'b-5', label: "PHOTO DE VOTRE COLIS AVANT L'ENVOI" },
];

const TRUST_MARQUEE_ITEMS: MarqueeItem[] = [
  {
    id: 't-1',
    label: 'Orange Money',
    icon: <Smartphone className="h-5 w-5" aria-hidden="true" />,
  },
  {
    id: 't-2',
    label: 'MTN MoMo',
    icon: <Smartphone className="h-5 w-5" aria-hidden="true" />,
  },
  {
    id: 't-3',
    label: 'Livraison partout au Cameroun',
    icon: <Truck className="h-5 w-5" aria-hidden="true" />,
  },
  {
    id: 't-4',
    label: 'Retrait en boutique',
    icon: <Store className="h-5 w-5" aria-hidden="true" />,
  },
  {
    id: 't-5',
    label: 'Paiement vérifié par la boutique',
    icon: <ShieldCheck className="h-5 w-5" aria-hidden="true" />,
  },
  {
    id: 't-6',
    label: 'Photo de votre colis',
    icon: <Camera className="h-5 w-5" aria-hidden="true" />,
  },
];

/**
 * Zone d'erreur d'une section (M7 §5.1) : une section en échec n'emporte pas l'accueil.
 * Les bandeaux décoratifs disparaissent ; les autres sections affichent un encart discret.
 */
function HomeSection({
  zone,
  decorative = false,
  children,
}: {
  zone: string;
  decorative?: boolean;
  children: ReactNode;
}) {
  return (
    <ErrorBoundary variant="section" zone={`home:${zone}`} hideOnError={decorative}>
      {children}
    </ErrorBoundary>
  );
}

export function HomePage() {
  return (
    <div className="bg-white text-ink">
      {/* 7.1 Hero */}
      <HomeSection zone="hero">
        <HeroSection />
      </HomeSection>

      {/* 7.2 Bandeau des avantages */}
      <HomeSection zone="benefits-marquee" decorative>
        <Marquee
          tone="red"
          direction="left"
          separator="✦"
          items={BENEFITS_MARQUEE_ITEMS}
        />
      </HomeSection>

      {/* 7.3 Catégories */}
      <HomeSection zone="categories">
        <CategoriesSection />
      </HomeSection>

      {/* 7.4 Les plus réservés */}
      <HomeSection zone="best-sellers">
        <BestSellersSection />
      </HomeSection>

      {/* 7.5 Nouveautés */}
      <HomeSection zone="new-arrivals">
        <NewArrivalsSection />
      </HomeSection>

      {/* 7.6 Bandeau paiement et livraison */}
      <HomeSection zone="trust-marquee" decorative>
        <Marquee
          tone="surface"
          direction="right"
          separator="·"
          items={TRUST_MARQUEE_ITEMS}
        />
      </HomeSection>

      {/* 7.7 Spécial babouches */}
      <HomeSection zone="babouches">
        <BabouchesSpotlightSection />
      </HomeSection>

      {/* 7.8 Comment ça marche */}
      <HomeSection zone="how-it-works">
        <HowItWorksSection />
      </HomeSection>

      {/* 7.9 Nos engagements */}
      <HomeSection zone="engagements">
        <EngagementsSection />
      </HomeSection>

      {/* 7.10 Bloc WhatsApp et application */}
      <HomeSection zone="whatsapp-app">
        <WhatsAppAppSection />
      </HomeSection>

      {/* 7.11 Portés par l'Incompris */}
      <HomeSection zone="looks">
        <LooksSection />
      </HomeSection>

      {/* Feuille d'installation de deuxième visite (M6 §5.2) : rien à montrer si elle échoue */}
      <HomeSection zone="install-prompt" decorative>
        <InstallAutoPrompt />
      </HomeSection>
    </div>
  );
}

export default HomePage;

