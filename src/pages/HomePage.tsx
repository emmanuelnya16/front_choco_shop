import {
  Camera,
  ShieldCheck,
  Smartphone,
  Store,
  Truck,
} from 'lucide-react';
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

export function HomePage() {
  return (
    <div className="bg-white text-ink">
      {/* 7.1 Hero */}
      <HeroSection />

      {/* 7.2 Bandeau des avantages */}
      <Marquee
        tone="red"
        direction="left"
        separator="✦"
        items={BENEFITS_MARQUEE_ITEMS}
      />

      {/* 7.3 Catégories */}
      <CategoriesSection />

      {/* 7.4 Les plus réservés */}
      <BestSellersSection />

      {/* 7.5 Nouveautés */}
      <NewArrivalsSection />

      {/* 7.6 Bandeau paiement et livraison */}
      <Marquee
        tone="surface"
        direction="right"
        separator="·"
        items={TRUST_MARQUEE_ITEMS}
      />

      {/* 7.7 Spécial babouches */}
      <BabouchesSpotlightSection />

      {/* 7.8 Comment ça marche */}
      <HowItWorksSection />

      {/* 7.9 Nos engagements */}
      <EngagementsSection />

      {/* 7.10 Bloc WhatsApp et application */}
      <WhatsAppAppSection />

      {/* 7.11 Portés par l'Incompris */}
      <LooksSection />

      {/* Feuille d'installation de deuxième visite (M6 §5.2) */}
      <InstallAutoPrompt />
    </div>
  );
}

export default HomePage;

