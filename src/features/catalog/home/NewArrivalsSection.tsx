import * as m from 'motion/react-m';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useRef, useState } from 'react';
import { IconButton } from '@/components/ui/IconButton';
import { Container } from '@/components/ui/Primitives';
import { ProductCard, ProductCardSkeleton } from '@/components/ui/ProductCard';
import { SectionHeader } from '@/components/ui/SectionHeader';
import { useProducts } from '@/features/catalog/api/useCatalogQueries';
import { HomeSectionNotice } from '@/features/catalog/home/HomeSectionNotice';
import { homeSectionStatus } from '@/features/catalog/home/homeSectionStatus';
import { useOnlineStatus } from '@/lib/hooks/useOnlineStatus';
import { staggerContainer } from '@/motion/presets';
import { duration, ease } from '@/motion/tokens';
import { useReducedMotionPref } from '@/motion/useReducedMotionPref';

const slideInRight = {
  hidden: { opacity: 0, x: 40 },
  visible: {
    opacity: 1,
    x: 0,
    transition: { duration: duration.base, ease: ease.out },
  },
};

/** Largeur d'une carte du carrousel : 72 % de l'écran (288 px au plus), 272 px sur tablette, 288 px sur ordinateur. */
// relative : un élément « sr-only » (absolu) d'une carte reste dans le carrousel au lieu d'élargir la page
const CARD_WIDTH_CLASSES = 'relative w-[72vw] max-w-72 shrink-0 snap-start sm:w-68 lg:w-72';
/** Écart entre deux cartes (gap-4), ajouté au pas des flèches. */
const CARD_GAP_PX = 16;

export function NewArrivalsSection() {
  const query = useProducts({ sort: 'newest', pageSize: 8 });
  const reducedMotion = useReducedMotionPref();
  const online = useOnlineStatus();

  const scrollerRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(true);

  const products = (query.data?.items ?? []).slice(0, 6);
  const status = homeSectionStatus(query, products.length === 0, online);

  if (status === 'empty') return null;

  const updateScrollButtons = () => {
    const el = scrollerRef.current;
    if (!el) return;
    setCanScrollLeft(el.scrollLeft > 8);
    setCanScrollRight(el.scrollLeft + el.clientWidth < el.scrollWidth - 8);
  };

  // Une carte par appui : pas mesuré sur la première carte (largeur réelle selon l'écran)
  const scrollByAmount = (direction: -1 | 1) => {
    const el = scrollerRef.current;
    if (!el) return;
    const card = el.querySelector<HTMLElement>('[data-carousel-card]');
    const step = (card?.offsetWidth ?? el.clientWidth * 0.8) + CARD_GAP_PX;
    el.scrollBy({
      left: direction * step,
      behavior: reducedMotion ? 'auto' : 'smooth',
    });
  };

  return (
    <section className="overflow-hidden py-section">
      <Container>
        <SectionHeader
          eyebrow="Tout juste arrivés"
          title="Nouveautés"
          actionLabel="Voir tout"
          actionHref="/explorer?sort=newest"
          rightSlot={
            status === 'ready' ? (
              <div className="hidden items-center gap-2 lg:flex">
                <IconButton
                  variant="surface"
                  icon={<ChevronLeft className="h-4 w-4" aria-hidden="true" />}
                  label="Articles précédents"
                  disabled={!canScrollLeft}
                  onClick={() => scrollByAmount(-1)}
                />
                <IconButton
                  variant="surface"
                  icon={<ChevronRight className="h-4 w-4" aria-hidden="true" />}
                  label="Articles suivants"
                  disabled={!canScrollRight}
                  onClick={() => scrollByAmount(1)}
                />
              </div>
            ) : undefined
          }
        />
      </Container>

      {(status === 'error' || status === 'offline') && (
        <Container className="mt-6 lg:mt-8">
          <HomeSectionNotice status={status} onRetry={() => void query.refetch()} />
        </Container>
      )}

      {/* Carrousel aligné à gauche sur le conteneur, qui déborde jusqu'au bord droit de l'écran.
          scroll-padding = padding : l'aimantation cale la première carte sur le conteneur, pas sur le bord de l'écran */}
      {(status === 'loading' || status === 'ready') && (
        <div className="mt-6 lg:mt-8">
          <div
            ref={scrollerRef}
            onScroll={updateScrollButtons}
            className="no-scrollbar flex snap-x snap-mandatory gap-4 overflow-x-auto scroll-smooth pr-page [--carousel-inset:max(var(--spacing-page),calc((100%-var(--container-content))/2+var(--spacing-page)))] pl-(--carousel-inset) scroll-pl-(--carousel-inset)"
          >
            {status === 'loading' ? (
              Array.from({ length: 5 }).map((_, idx) => (
                <div key={idx} className={CARD_WIDTH_CLASSES}>
                  <ProductCardSkeleton />
                </div>
              ))
            ) : (
              <m.div
                variants={staggerContainer()}
                initial={reducedMotion ? 'visible' : 'hidden'}
                whileInView="visible"
                viewport={{ once: true, amount: 0.2 }}
                className="flex gap-4"
              >
                {products.map((product) => (
                  // Le glissement est porté par l'enfant : un décalage sur l'élément aimanté fausserait la position de départ
                  <div key={product.id} data-carousel-card className={CARD_WIDTH_CLASSES}>
                    <m.div variants={slideInRight}>
                      <ProductCard product={product} />
                    </m.div>
                  </div>
                ))}
              </m.div>
            )}
          </div>
        </div>
      )}
    </section>
  );
}
