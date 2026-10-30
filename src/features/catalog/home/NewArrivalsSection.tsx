import * as m from 'motion/react-m';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useRef, useState } from 'react';
import { IconButton } from '@/components/ui/IconButton';
import { Container } from '@/components/ui/Primitives';
import { ProductCard, ProductCardSkeleton } from '@/components/ui/ProductCard';
import { SectionHeader } from '@/components/ui/SectionHeader';
import { useProducts } from '@/features/catalog/api/useCatalogQueries';
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

export function NewArrivalsSection() {
  const { data, isLoading } = useProducts({ sort: 'newest', pageSize: 8 });
  const reducedMotion = useReducedMotionPref();

  const scrollerRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(true);

  const products = (data?.items ?? []).slice(0, 6);

  const updateScrollButtons = () => {
    const el = scrollerRef.current;
    if (!el) return;
    setCanScrollLeft(el.scrollLeft > 8);
    setCanScrollRight(el.scrollLeft + el.clientWidth < el.scrollWidth - 8);
  };

  const scrollByAmount = (direction: -1 | 1) => {
    const el = scrollerRef.current;
    if (!el) return;
    const cardWidth = 310;
    el.scrollBy({
      left: direction * cardWidth,
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
            <div className="hidden items-center gap-1.5 lg:flex">
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
          }
        />
      </Container>

      {/* Horizontal Carousel aligned left on Container, overflowing right to screen edge */}
      <div className="mt-6 lg:mt-8">
        <div
          ref={scrollerRef}
          onScroll={updateScrollButtons}
          className="no-scrollbar flex snap-x snap-mandatory gap-4 overflow-x-auto scroll-smooth pr-page pl-[max(var(--spacing-page),calc((100vw-var(--container-content))/2+var(--spacing-page)))]"
        >
          {isLoading ? (
            Array.from({ length: 5 }).map((_, idx) => (
              <div
                key={idx}
                className="w-[72vw] max-w-[290px] shrink-0 snap-start sm:w-[270px] lg:w-[290px]"
              >
                <ProductCardSkeleton />
              </div>
            ))
          ) : (
            <m.div
              variants={staggerContainer(0.06)}
              initial={reducedMotion ? 'visible' : 'hidden'}
              whileInView="visible"
              viewport={{ once: true, amount: 0.2 }}
              className="flex gap-4"
            >
              {products.map((product) => (
                <m.div
                  key={product.id}
                  variants={slideInRight}
                  className="w-[72vw] max-w-[290px] shrink-0 snap-start sm:w-[270px] lg:w-[290px]"
                >
                  <ProductCard product={product} />
                </m.div>
              ))}
            </m.div>
          )}
        </div>
      </div>
    </section>
  );
}
