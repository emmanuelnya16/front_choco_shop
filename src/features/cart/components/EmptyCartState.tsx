import { useRef } from 'react';
import { Button } from '@/components/ui/Button';
import { ProductCard, ProductCardSkeleton } from '@/components/ui/ProductCard';
import { SectionHeader } from '@/components/ui/SectionHeader';
import { useProducts } from '@/features/catalog/api/useCatalogQueries';
import { gsap, useGSAP } from '@/lib/gsap';
import { useReducedMotionPref } from '@/motion/useReducedMotionPref';

/**
 * État panier vide (§4.2) :
 * - Illustration en traits (sac vide, SVG inline `ink` et `silver`) qui se dessine (DrawSVG, 1 s)
 *   à la première apparition (affichage direct si les animations sont réduites).
 * - Titre « Votre panier est vide », texte d'aide et `Button dark` « Découvrir la collection ».
 * - Rangée « Les plus réservés » en dessous.
 */
export function EmptyCartState() {
  const scopeRef = useRef<HTMLDivElement>(null);
  const reducedMotion = useReducedMotionPref();

  const { data: popularData, isLoading } = useProducts({
    sort: 'popular',
    available: true,
    page: 1,
    pageSize: 4,
  });

  useGSAP(
    () => {
      if (reducedMotion) return;
      gsap.fromTo(
        '.empty-bag-stroke',
        { drawSVG: '0%' },
        {
          drawSVG: '100%',
          duration: 1,
          stagger: 0.12,
          ease: 'power2.out',
        },
      );
    },
    { scope: scopeRef, dependencies: [reducedMotion] },
  );

  const popularProducts = popularData?.items?.slice(0, 4) ?? [];

  return (
    <div ref={scopeRef} className="space-y-14 py-6 lg:py-10">
      <div className="mx-auto flex max-w-md flex-col items-center rounded-[var(--radius-md)] border border-silver/70 bg-surface/50 px-6 py-12 text-center">
        <svg
          viewBox="0 0 96 96"
          fill="none"
          className="h-24 w-24"
          aria-hidden="true"
        >
          {/* Ombre et plis intérieurs en silver */}
          <path
            d="M26 36h44l-4 44H30l-4-44Z"
            className="empty-bag-stroke stroke-silver"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          {/* Contour du sac et anses en ink */}
          <path
            d="M22 34h52l-4.5 48a4 4 0 0 1-4 3.6H30.5a4 4 0 0 1-4-3.6L22 34Z"
            className="empty-bag-stroke stroke-ink"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <path
            d="M35 34V26a13 13 0 0 1 26 0v8"
            className="empty-bag-stroke stroke-ink"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <line
            x1="36"
            y1="56"
            x2="60"
            y2="56"
            className="empty-bag-stroke stroke-silver"
            strokeWidth="2"
            strokeLinecap="round"
          />
        </svg>

        <h1 className="mt-5 text-h2 text-ink">Votre panier est vide</h1>
        <p className="mt-2 text-small text-text-2">
          Parcourez la collection et ajoutez vos articles préférés.
        </p>

        <div className="mt-6">
          <Button variant="dark" size="lg" href="/explorer">
            Découvrir la collection
          </Button>
        </div>
      </div>

      {/* Rangée « Les plus réservés » (§4.2) */}
      <section aria-labelledby="empty-cart-popular-heading">
        <SectionHeader
          eyebrow="SÉLECTION DR CHOCO"
          title="LES PLUS RÉSERVÉS"
          actionLabel="Tout voir"
          actionHref="/explorer?sort=popular"
        />
        <div className="mt-6 grid grid-cols-2 gap-3 sm:gap-5 lg:grid-cols-4 lg:gap-6">
          {isLoading
            ? Array.from({ length: 4 }).map((_, idx) => (
                <ProductCardSkeleton key={idx} />
              ))
            : popularProducts.map((product) => (
                <ProductCard key={product.id} product={product} />
              ))}
        </div>
      </section>
    </div>
  );
}
