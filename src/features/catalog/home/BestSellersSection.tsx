import * as m from 'motion/react-m';
import { Button } from '@/components/ui/Button';
import { Container, Section } from '@/components/ui/Primitives';
import { ProductCard, ProductCardSkeleton } from '@/components/ui/ProductCard';
import { SectionHeader } from '@/components/ui/SectionHeader';
import { useProducts } from '@/features/catalog/api/useCatalogQueries';
import { HomeSectionNotice } from '@/features/catalog/home/HomeSectionNotice';
import { homeSectionStatus } from '@/features/catalog/home/homeSectionStatus';
import { useOnlineStatus } from '@/lib/hooks/useOnlineStatus';
import { fadeUp, staggerContainer } from '@/motion/presets';
import { useReducedMotionPref } from '@/motion/useReducedMotionPref';

const GRID_CLASSES = 'mt-6 grid grid-cols-2 gap-3 lg:mt-8 lg:grid-cols-4 lg:gap-5';

export function BestSellersSection() {
  const query = useProducts({ sort: 'popular', pageSize: 8 });
  const reducedMotion = useReducedMotionPref();
  const online = useOnlineStatus();

  const products = (query.data?.items ?? []).slice(0, 4);
  const status = homeSectionStatus(query, products.length === 0, online);

  if (status === 'empty') return null;

  return (
    <Section className="pt-0">
      <Container>
        <SectionHeader
          eyebrow="Plébiscités"
          title="Les plus réservés"
          actionLabel="Voir tout"
          actionHref="/explorer?sort=popular"
        />

        {status === 'loading' && (
          <div className={GRID_CLASSES}>
            {Array.from({ length: 4 }).map((_, idx) => (
              <ProductCardSkeleton key={idx} />
            ))}
          </div>
        )}

        {(status === 'error' || status === 'offline') && (
          <HomeSectionNotice status={status} onRetry={() => void query.refetch()} />
        )}

        {status === 'ready' && (
          <>
            <m.div
              variants={staggerContainer()}
              initial={reducedMotion ? 'visible' : 'hidden'}
              whileInView="visible"
              viewport={{ once: true, amount: 0.25 }}
              className={GRID_CLASSES}
            >
              {products.map((product) => (
                <m.div key={product.id} variants={fadeUp}>
                  <ProductCard product={product} />
                </m.div>
              ))}
            </m.div>

            <div className="mt-6 lg:hidden">
              <Button variant="outline" size="md" fullWidth href="/explorer?sort=popular">
                Voir plus d&rsquo;articles
              </Button>
            </div>
          </>
        )}
      </Container>
    </Section>
  );
}
