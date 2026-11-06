import * as m from 'motion/react-m';
import { Button } from '@/components/ui/Button';
import { Container, Section } from '@/components/ui/Primitives';
import { ProductCard, ProductCardSkeleton } from '@/components/ui/ProductCard';
import { SmartImage } from '@/components/ui/SmartImage';
import { useProducts } from '@/features/catalog/api/useCatalogQueries';
import { HomeSectionNotice } from '@/features/catalog/home/HomeSectionNotice';
import { homeSectionStatus } from '@/features/catalog/home/homeSectionStatus';
import { useOnlineStatus } from '@/lib/hooks/useOnlineStatus';
import { cn } from '@/lib/utils/cn';
import { fadeUp, staggerContainer } from '@/motion/presets';
import { useReducedMotionPref } from '@/motion/useReducedMotionPref';

const NOTICE_TEXT = {
  error: 'Nos babouches n’ont pas pu s’afficher.',
  offline: 'Vous êtes hors connexion\u00A0: nos babouches s’afficheront dès le retour du réseau.',
};

/** Carrousel sur téléphone (cartes de 74 % de l'écran, 280 px au plus), 3 colonnes à partir de la tablette. */
const ROW_CLASSES =
  'no-scrollbar -mx-page flex snap-x snap-mandatory scroll-px-page gap-3 overflow-x-auto px-page md:mx-0 md:grid md:grid-cols-3 md:gap-4 md:overflow-visible md:px-0 lg:hidden';
// relative : un élément « sr-only » (absolu) d'une carte reste dans le carrousel au lieu d'élargir la page
const ITEM_CLASSES = 'relative w-[74vw] max-w-70 shrink-0 snap-start md:w-auto md:max-w-none';

export function BabouchesSpotlightSection() {
  const query = useProducts({
    category: 'babouches',
    pageSize: 4,
  });
  const reducedMotion = useReducedMotionPref();
  const online = useOnlineStatus();

  const babouches = (query.data?.items ?? []).slice(0, 3);
  const status = homeSectionStatus(query, babouches.length === 0, online);

  return (
    <Section>
      <Container>
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-12 lg:items-stretch">
          {/* Gauche : tuile d'ambiance verticale (apparition discrète, sans rideau : un seul effet fort par écran) */}
          <m.div
            variants={fadeUp}
            initial={reducedMotion ? 'visible' : 'hidden'}
            whileInView="visible"
            viewport={{ once: true, amount: 0.25 }}
            className={cn(
              'relative aspect-[4/5] w-full overflow-hidden rounded-[var(--radius-md)] bg-ink md:aspect-[16/9] lg:aspect-auto lg:h-full lg:min-h-115',
              // Sans modèle à montrer, la tuile prend toute la largeur au lieu de laisser un vide à droite
              status === 'empty' ? 'lg:col-span-12' : 'lg:col-span-4',
            )}
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
              <span className="inline-flex w-fit items-center rounded-[var(--radius-sm)] bg-red px-3 py-1 text-label text-white">
                Savoir-faire artisanal
              </span>
              <h2 className="mt-3 text-h1 text-white">L&rsquo;ART DE LA BABOUCHE</h2>
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

          {/* Droite : 3 cartes sur ordinateur, carrousel aimanté sur téléphone */}
          {status !== 'empty' && (
            <div className="flex flex-col justify-between lg:col-span-8">
              <div className="mb-4 hidden items-end justify-between lg:flex">
                <div>
                  <span className="text-label text-text-2">Sélection cuir</span>
                  <h3 className="mt-1 text-h2 text-ink">Nos modèles emblématiques</h3>
                </div>
              </div>

              {status === 'loading' && (
                <>
                  <div className="hidden grid-cols-3 gap-4 lg:grid">
                    {Array.from({ length: 3 }).map((_, idx) => (
                      <ProductCardSkeleton key={idx} />
                    ))}
                  </div>
                  <div className={ROW_CLASSES}>
                    {Array.from({ length: 3 }).map((_, idx) => (
                      <div key={idx} className={ITEM_CLASSES}>
                        <ProductCardSkeleton />
                      </div>
                    ))}
                  </div>
                </>
              )}

              {(status === 'error' || status === 'offline') && (
                <HomeSectionNotice status={status} onRetry={() => void query.refetch()} text={NOTICE_TEXT} />
              )}

              {status === 'ready' && (
                <>
                  {/* Ordinateur : grille 3 colonnes */}
                  <m.div
                    variants={staggerContainer()}
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

                  {/* Téléphone : carrousel aimanté ; tablette (md) : les 3 modèles côte à côte, sans carte coupée */}
                  <div className={ROW_CLASSES}>
                    {babouches.map((product) => (
                      <div key={product.id} className={ITEM_CLASSES}>
                        <ProductCard product={product} />
                      </div>
                    ))}
                  </div>
                </>
              )}
            </div>
          )}
        </div>
      </Container>
    </Section>
  );
}
