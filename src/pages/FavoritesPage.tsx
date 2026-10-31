import { ArrowRight, Smartphone } from 'lucide-react';
import { AnimatePresence } from 'motion/react';
import * as m from 'motion/react-m';
import { useEffect } from 'react';
import { BackButton } from '@/components/ui/BackButton';
import { Button } from '@/components/ui/Button';
import { Container } from '@/components/ui/Primitives';
import { ProductCard, ProductCardSkeleton } from '@/components/ui/ProductCard';
import { useFavoriteProducts } from '@/features/catalog/api/useCatalogQueries';
import { useReducedMotionPref } from '@/motion/useReducedMotionPref';
import { useAuthStore } from '@/stores/authStore';
import { useFavoritesStore } from '@/stores/favoritesStore';

function HeartEmptyIllustration() {
  return (
    <svg
      viewBox="0 0 96 88"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="h-20 w-20 text-ink"
      aria-hidden="true"
    >
      <path d="M48 76S14 54 14 30c0-10.5 8.2-18 18-18 6.4 0 12.2 3.4 16 9 3.8-5.6 9.6-9 16-9 9.8 0 18 7.5 18 18 0 24-34 46-34 46z" />
      <circle cx="64" cy="28" r="5" className="fill-red" stroke="none" />
    </svg>
  );
}

/**
 * Page Favoris (`/favoris`, §8) :
 * - Affiche en temps réel les articles enregistrés dans `favoritesStore`.
 * - Retrait animé (`scale: 0.9, opacity: 0` en 0,25 s + réorganisation `layout` des cartes restantes)
 *   accompagné d'un Toast de 4 secondes « Retiré des favoris · Annuler ».
 * - Bandeau d'information discret si le client n'est pas encore connecté.
 */
export function FavoritesPage() {
  const favoriteIds = useFavoritesStore((s) => s.ids);
  const user = useAuthStore((s) => s.user);
  const reducedMotion = useReducedMotionPref();

  const { items, isLoading } = useFavoriteProducts(favoriteIds);

  useEffect(() => {
    document.title = "Mes favoris — DR Choco L'Incompris";
  }, []);

  const count = favoriteIds.length;

  return (
    <div className="min-h-dvh bg-white py-6 lg:py-10">
      <Container>
        {/* Retour (M6 §8) : écran précédent de l'app, sinon le profil (HYPOTHÈSE: parent logique, onglet Profil) */}
        <BackButton fallback="/profil" className="mb-2 lg:hidden" />
        {/* En-tête : Titre + Compteur (§8.1) */}
        <div className="flex flex-wrap items-baseline justify-between gap-2 border-b border-silver/70 pb-4">
          <div className="flex items-baseline gap-3">
            <h1 className="text-h1 text-ink">MES FAVORIS</h1>
            <span
              aria-live="polite"
              className="text-small font-semibold text-text-2 tabular-nums"
            >
              {count} article{count > 1 ? 's' : ''} enregistré{count > 1 ? 's' : ''}
            </span>
          </div>
        </div>

        {/* Bandeau discret de sauvegarde locale si non connecté (§8.1) */}
        {!user && count > 0 && (
          <div className="mt-4 flex items-start gap-3 rounded-[var(--radius-md)] border border-silver bg-surface px-4 py-3 text-xs text-ink">
            <Smartphone
              className="mt-0.5 h-4 w-4 shrink-0 text-red"
              aria-hidden="true"
            />
            <p>
              Vos favoris sont enregistrés sur cet appareil. Connectez-vous lors
              de votre prochaine réservation pour les retrouver partout.
            </p>
          </div>
        )}

        {/* Contenu : Squelettes, État vide ou Grille animée (§8.1 & §8.2) */}
        <div className="mt-6">
          {count === 0 ? (
            <div className="mx-auto flex max-w-lg flex-col items-center justify-center rounded-[var(--radius-md)] border border-silver/70 bg-surface px-6 py-14 text-center">
              <HeartEmptyIllustration />
              <h2 className="mt-4 text-h2 text-ink">
                Vous n&rsquo;avez pas encore d&rsquo;articles favoris.
              </h2>
              <p className="mt-2 text-small text-text-2">
                Touchez le cœur ♡ sur un article pour le retrouver facilement ici.
              </p>
              <Button
                variant="primary"
                size="md"
                href="/explorer"
                iconRight={<ArrowRight className="h-4 w-4" aria-hidden="true" />}
                className="mt-6"
              >
                Explorer le catalogue
              </Button>
            </div>
          ) : isLoading && items.length === 0 ? (
            <div className="grid grid-cols-2 gap-x-3 gap-y-5 lg:grid-cols-4 lg:gap-6">
              {Array.from({ length: Math.min(4, count) }).map((_, idx) => (
                <ProductCardSkeleton key={idx} />
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-x-3 gap-y-5 lg:grid-cols-4 lg:gap-6">
              <AnimatePresence mode="popLayout">
                {items.map((product) => (
                  <m.div
                    key={product.id}
                    layout={!reducedMotion}
                    initial={reducedMotion ? false : { opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={
                      reducedMotion
                        ? undefined
                        : { opacity: 0, scale: 0.9 }
                    }
                    transition={{
                      duration: 0.25,
                      ease: [0.22, 1, 0.36, 1],
                    }}
                  >
                    <ProductCard product={product} />
                  </m.div>
                ))}
              </AnimatePresence>
            </div>
          )}
        </div>
      </Container>
    </div>
  );
}
