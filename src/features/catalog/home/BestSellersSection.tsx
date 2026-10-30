import * as m from 'motion/react-m';
import { Button } from '@/components/ui/Button';
import { Section } from '@/components/ui/Primitives';
import { ProductCard, ProductCardSkeleton } from '@/components/ui/ProductCard';
import { SectionHeader } from '@/components/ui/SectionHeader';
import { useProducts } from '@/features/catalog/api/useCatalogQueries';
import { fadeUp, staggerContainer } from '@/motion/presets';
import { useReducedMotionPref } from '@/motion/useReducedMotionPref';

export function BestSellersSection() {
  const { data, isLoading } = useProducts({ sort: 'popular', pageSize: 8 });
  const reducedMotion = useReducedMotionPref();

  const products = (data?.items ?? []).slice(0, 4);

  return (
    <Section className="pt-0">
      <SectionHeader
        eyebrow="Plébiscités"
        title="Les plus réservés"
        actionLabel="Voir tout"
        actionHref="/explorer?sort=popular"
      />

      {isLoading ? (
        <div className="mt-6 grid grid-cols-2 gap-3.5 lg:mt-8 lg:grid-cols-4 lg:gap-5">
          {Array.from({ length: 4 }).map((_, idx) => (
            <ProductCardSkeleton key={idx} />
          ))}
        </div>
      ) : (
        <m.div
          variants={staggerContainer(0.06)}
          initial={reducedMotion ? 'visible' : 'hidden'}
          whileInView="visible"
          viewport={{ once: true, amount: 0.25 }}
          className="mt-6 grid grid-cols-2 gap-3.5 lg:mt-8 lg:grid-cols-4 lg:gap-5"
        >
          {products.map((product) => (
            <m.div key={product.id} variants={fadeUp}>
              <ProductCard product={product} />
            </m.div>
          ))}
        </m.div>
      )}

      <div className="mt-6 lg:hidden">
        <Button
          variant="outline"
          size="md"
          fullWidth
          href="/explorer?sort=popular"
        >
          Voir plus d&apos;articles
        </Button>
      </div>
    </Section>
  );
}
