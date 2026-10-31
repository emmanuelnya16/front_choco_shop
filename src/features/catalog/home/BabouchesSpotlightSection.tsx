import * as m from 'motion/react-m';
import { Button } from '@/components/ui/Button';
import { Container, Section } from '@/components/ui/Primitives';
import { ProductCard, ProductCardSkeleton } from '@/components/ui/ProductCard';
import { SmartImage } from '@/components/ui/SmartImage';
import { useProducts } from '@/features/catalog/api/useCatalogQueries';
import { fadeUp, staggerContainer } from '@/motion/presets';
import { ease } from '@/motion/tokens';
import { useReducedMotionPref } from '@/motion/useReducedMotionPref';

export function BabouchesSpotlightSection() {
  const { data, isLoading } = useProducts({
    category: 'babouches',
    pageSize: 4,
  });
  const reducedMotion = useReducedMotionPref();

  const babouches = (data?.items ?? []).slice(0, 3);

  return (
    <Section>
      <Container>
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-12 lg:items-stretch lg:gap-6">
          {/* Left: Vertical mood tile with bottom-to-top clipPath reveal.
              La détection de visibilité est portée par le parent : un élément entièrement découpé
              (clip-path inset 100 %) n’est jamais vu comme visible, et l’animation ne démarrait pas. */}
          <m.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, amount: 0.25 }}
            className="lg:col-span-4"
          >
            <m.div
              variants={
                reducedMotion
                  ? { hidden: { opacity: 1 }, visible: { opacity: 1 } }
                  : {
                      hidden: { clipPath: 'inset(100% 0 0 0)', opacity: 0.9 },
                      visible: {
                        clipPath: 'inset(0% 0 0 0)',
                        opacity: 1,
                        transition: { duration: 0.9, ease: ease.out },
                      },
                    }
              }
              className="relative aspect-[4/5] w-full overflow-hidden rounded-[var(--radius-md)] bg-ink md:aspect-[16/9] lg:aspect-auto lg:h-full lg:min-h-[460px]"
            >
              <SmartImage
                src="/images/categories/babouches.webp"
                fallback="/images/fallback/mood-babouches.svg"
                alt=""
                tone="mood"
                ratio="auto"
                sizes="(min-width: 1024px) 420px, 100vw"
                className="h-full w-full"
                imgClassName="h-full w-full object-cover"
              />

              <div
                className="pointer-events-none absolute inset-0"
                style={{
                  background:
                    'linear-gradient(to top, var(--color-scrim-95) 0%, var(--color-scrim-55) 55%, var(--color-scrim-40) 100%)',
                }}
                aria-hidden="true"
              />

              <div className="absolute inset-0 flex flex-col justify-end p-6 lg:p-8">
                <span className="inline-flex w-fit items-center rounded-[var(--radius-sm)] bg-red px-2.5 py-1 text-label text-white">
                  Savoir-faire artisanal
                </span>
                <h2 className="mt-3 text-h1 text-white">
                  L&apos;ART DE LA BABOUCHE
                </h2>
                <p className="mt-2 max-w-sm text-small text-silver">
                  Cuir travaillé à la main, confort de tous les jours.
                </p>
                <div className="mt-6">
                  <Button variant="light" size="md" href="/explorer/babouches">
                    Voir les babouches
                  </Button>
                </div>
              </div>
            </m.div>
          </m.div>

          {/* Right: 3 ProductCards on desktop, horizontal snap carousel on mobile */}
          <div className="flex flex-col justify-between lg:col-span-8">
            <div className="mb-4 hidden items-end justify-between lg:flex">
              <div>
                <span className="text-label text-text-2">Sélection cuir</span>
                <h3 className="mt-1 text-h2 text-ink">
                  Nos modèles emblématiques
                </h3>
              </div>
            </div>

            {isLoading ? (
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                {Array.from({ length: 3 }).map((_, idx) => (
                  <ProductCardSkeleton key={idx} />
                ))}
              </div>
            ) : (
              <>
                {/* Desktop 3-column grid */}
                <m.div
                  variants={staggerContainer(0.06)}
                  initial={reducedMotion ? 'visible' : 'hidden'}
                  whileInView="visible"
                  viewport={{ once: true, amount: 0.25 }}
                  className="hidden grid-cols-3 gap-4 lg:grid"
                >
                  {babouches.map((product) => (
                    <m.div key={product.id} variants={fadeUp}>
                      <ProductCard product={product} />
                    </m.div>
                  ))}
                </m.div>

                {/* Mobile horizontal snap carousel ; tablette (md) : les 3 modèles côte à côte, sans carte coupée */}
                <div className="no-scrollbar -mx-page flex snap-x snap-mandatory scroll-px-page gap-3.5 overflow-x-auto px-page md:mx-0 md:grid md:grid-cols-3 md:gap-4 md:overflow-visible md:px-0 lg:hidden">
                  {babouches.map((product) => (
                    <div
                      key={product.id}
                      className="w-[74vw] max-w-[280px] shrink-0 snap-start md:w-auto md:max-w-none"
                    >
                      <ProductCard product={product} />
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        </div>
      </Container>
    </Section>
  );
}
