import { useQueryClient } from '@tanstack/react-query';
import * as m from 'motion/react-m';
import { RefreshCw, ShoppingBag } from 'lucide-react';
import { useState } from 'react';
import { Link } from 'react-router';
import { Button } from '@/components/ui/Button';
import { Price } from '@/components/ui/Primitives';
import { SmartImage } from '@/components/ui/SmartImage';
import { cn } from '@/lib/utils/cn';
import { fadeUp } from '@/motion/presets';
import { ease } from '@/motion/tokens';
import { useReducedMotionPref } from '@/motion/useReducedMotionPref';
import { useRecentlyViewedStore } from '@/stores/recentlyViewedStore';
import { CloudOffIllustration } from './CloudOffIllustration';
import { retryNetwork, useOfflineAvailableItems } from './offlineAvailability';

export interface OfflineScreenProps {
  /** Niveau du titre : h1 pour une page entière, h2 dans une page qui a déjà son titre. */
  headingLevel?: 'h1' | 'h2';
  /**
   * « Réessayer » : par défaut, vérifie le réseau puis recharge la page s'il est revenu.
   * Les replis (fiche produit, catalogue) relancent plutôt leur propre chargement.
   */
  onRetry?: () => unknown;
  className?: string;
}

/**
 * Contenu « Vous êtes hors connexion » (M6 §6.5) : page /hors-ligne et repli des pages jamais
 * consultées (fiche produit sans données, morceau de page introuvable hors connexion).
 */
export function OfflineScreen({ headingLevel = 'h1', onRetry, className }: OfflineScreenProps) {
  const queryClient = useQueryClient();
  const reducedMotion = useReducedMotionPref();
  const [checking, setChecking] = useState(false);
  const [stillOffline, setStillOffline] = useState(false);
  const Heading = headingLevel;

  const handleRetry = async () => {
    setChecking(true);
    setStillOffline(false);
    try {
      if (onRetry) {
        await onRetry();
        return;
      }
      const online = await retryNetwork(queryClient);
      if (online) {
        window.location.reload();
      } else {
        setStillOffline(true);
      }
    } finally {
      setChecking(false);
    }
  };

  return (
    <section
      aria-labelledby="hors-connexion-titre"
      className={cn('mx-auto flex w-full max-w-[640px] flex-col items-center text-center', className)}
    >
      <m.div
        initial={reducedMotion ? false : { opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.45, ease: ease.out }}
        className="text-silver"
      >
        <CloudOffIllustration />
      </m.div>

      <Heading id="hors-connexion-titre" className="mt-5 text-h1 text-ink">
        Vous êtes hors connexion
      </Heading>
      <p className="mt-2 max-w-sm text-body text-text-2">
        Cette page n&rsquo;a pas encore été enregistrée sur votre téléphone.
      </p>

      <div className="mt-6 flex w-full flex-col gap-2.5 sm:w-auto sm:flex-row">
        <Button
          variant="dark"
          size="lg"
          loading={checking}
          iconLeft={<RefreshCw className="h-4 w-4" aria-hidden="true" />}
          onClick={() => void handleRetry()}
        >
          Réessayer
        </Button>
        <Button
          variant="outline"
          size="lg"
          href="/panier"
          iconLeft={<ShoppingBag className="h-4 w-4" aria-hidden="true" />}
        >
          Voir mon panier
        </Button>
      </div>
      <p role="status" aria-live="polite" className="mt-3 min-h-5 text-small text-text-2">
        {stillOffline ? 'Toujours hors connexion. Réessayez dans un instant.' : ''}
      </p>

      <RecentlyViewedOffline />
    </section>
  );
}

/** Derniers articles consultés disponibles sans réseau (enregistrés par l'application). */
function RecentlyViewedOffline() {
  const items = useRecentlyViewedStore((s) => s.items);
  const available = useOfflineAvailableItems(items);
  const reducedMotion = useReducedMotionPref();

  if (!available || available.length === 0) return null;

  return (
    <div className="mt-10 w-full text-left">
      <h2 className="text-label text-text-2">Disponibles hors connexion</h2>
      <p className="mt-1 text-small text-text-2">Les derniers articles que vous avez consultés.</p>
      <ul className="mt-4 grid grid-cols-2 gap-x-3 gap-y-5 sm:grid-cols-3">
        {available.slice(0, 6).map((item, index) => (
          <m.li
            key={item.slug}
            variants={fadeUp}
            initial={reducedMotion ? false : 'hidden'}
            animate="visible"
            transition={{ delay: reducedMotion ? 0 : index * 0.05 }}
          >
            <Link
              to={`/produit/${item.slug}`}
              viewTransition
              className="group block rounded-[var(--radius-md)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink"
            >
              <div className="overflow-hidden rounded-[var(--radius-md)] bg-surface">
                <SmartImage
                  src={item.image}
                  fallback={item.fallbackImage}
                  alt={item.name}
                  ratio="4/5"
                  className="w-full"
                />
              </div>
              <p className="mt-2 line-clamp-2 text-small font-semibold text-ink">{item.name}</p>
              <Price amount={item.price} className="mt-0.5 block text-small text-text-2" />
            </Link>
          </m.li>
        ))}
      </ul>
    </div>
  );
}
