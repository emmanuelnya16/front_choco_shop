import * as m from 'motion/react-m';
import { Chip } from '@/components/ui/Badge';
import { CategoryTile } from '@/components/ui/CategoryTile';
import { Container, Section, Skeleton } from '@/components/ui/Primitives';
import { SectionHeader } from '@/components/ui/SectionHeader';
import { useCategories } from '@/features/catalog/api/useCatalogQueries';
import { HomeSectionNotice } from '@/features/catalog/home/HomeSectionNotice';
import { homeSectionStatus } from '@/features/catalog/home/homeSectionStatus';
import { useOnlineStatus } from '@/lib/hooks/useOnlineStatus';
import { fadeUp, staggerContainer } from '@/motion/presets';
import { useReducedMotionPref } from '@/motion/useReducedMotionPref';

interface TileItem {
  id: string;
  slug: string;
  name: string;
  coverImage: string;
  fallbackImage: string;
  productCount: number;
}

const NOTICE_TEXT = {
  error: 'Nos univers n’ont pas pu s’afficher.',
  offline: 'Vous êtes hors connexion\u00A0: nos univers s’afficheront dès le retour du réseau.',
};

/** Squelette au gabarit réel : mosaïque (16:9 puis deux carrés) et pastilles sur téléphone, grille 3 × 2 sur ordinateur. */
function CategoriesSkeleton() {
  return (
    <>
      <div className="mt-6 space-y-3 lg:hidden">
        <Skeleton className="aspect-[16/9] w-full" />
        <div className="grid grid-cols-2 gap-3">
          <Skeleton className="aspect-square w-full" />
          <Skeleton className="aspect-square w-full" />
        </div>
        <div className="flex gap-2 overflow-hidden pt-2">
          {Array.from({ length: 3 }).map((_, idx) => (
            <Skeleton key={idx} className="my-1 h-9 w-32 shrink-0 rounded-full" />
          ))}
        </div>
      </div>
      <div className="mt-8 hidden grid-cols-3 gap-4 lg:grid">
        {Array.from({ length: 6 }).map((_, idx) => (
          <Skeleton key={idx} className="aspect-[4/3] w-full" />
        ))}
      </div>
    </>
  );
}

export function CategoriesSection() {
  const query = useCategories();
  const categories = query.data ?? [];
  const reducedMotion = useReducedMotionPref();
  const online = useOnlineStatus();
  const status = homeSectionStatus(query, categories.length === 0, online);

  if (status === 'empty') return null;

  const vetements = categories.find((cat) => cat.slug === 'vetements');
  const chaussures = categories.find((cat) => cat.slug === 'chaussures');
  const babouches = categories.find((cat) => cat.slug === 'babouches');

  // Ligne 1 : Vêtements, Chaussures, Babouches ; ligne 2 : T-shirts, Hoodies, Pantalons
  const vetementsSubs = vetements?.subCategories ?? [];
  const desktopTiles: TileItem[] = [
    ...(vetements ? [vetements] : []),
    ...(chaussures ? [chaussures] : []),
    ...(babouches ? [babouches] : []),
    ...vetementsSubs.slice(0, 3),
  ];

  // Sous-catégories en pastilles défilantes sur téléphone
  const mobileSubChips = categories.flatMap((cat) => cat.subCategories);

  return (
    <Section aria-label="Nos univers">
      <Container>
        <SectionHeader
          eyebrow="Explorer"
          title="Nos univers"
          actionLabel="Voir tout"
          actionHref="/explorer"
        />

        {status === 'loading' && <CategoriesSkeleton />}

        {(status === 'error' || status === 'offline') && (
          <HomeSectionNotice status={status} onRetry={() => void query.refetch()} text={NOTICE_TEXT} />
        )}

        {status === 'ready' && (
          <>
            {/* Ordinateur : grille 3 × 2 */}
            <m.div
              variants={staggerContainer()}
              initial={reducedMotion ? 'visible' : 'hidden'}
              whileInView="visible"
              viewport={{ once: true, amount: 0.25 }}
              className="mt-8 hidden grid-cols-3 gap-4 lg:grid"
            >
              {desktopTiles.map((tile) => (
                <m.div key={tile.id} variants={fadeUp}>
                  <CategoryTile
                    name={tile.name}
                    slug={tile.slug}
                    count={tile.productCount}
                    coverImage={tile.coverImage}
                    fallbackImage={tile.fallbackImage}
                    ratio="4/3"
                  />
                </m.div>
              ))}
            </m.div>

            {/* Téléphone et tablette : mosaïque et pastilles défilantes */}
            <m.div
              variants={staggerContainer()}
              initial={reducedMotion ? 'visible' : 'hidden'}
              whileInView="visible"
              viewport={{ once: true, amount: 0.25 }}
              className="mt-6 space-y-3 lg:hidden"
            >
              {vetements && (
                <m.div variants={fadeUp}>
                  <CategoryTile
                    name={vetements.name}
                    slug={vetements.slug}
                    count={vetements.productCount}
                    coverImage={vetements.coverImage}
                    fallbackImage={vetements.fallbackImage}
                    ratio="16/9"
                  />
                </m.div>
              )}

              <div className="grid grid-cols-2 gap-3">
                {chaussures && (
                  <m.div variants={fadeUp}>
                    <CategoryTile
                      name={chaussures.name}
                      slug={chaussures.slug}
                      count={chaussures.productCount}
                      coverImage={chaussures.coverImage}
                      fallbackImage={chaussures.fallbackImage}
                      ratio="1/1"
                    />
                  </m.div>
                )}
                {babouches && (
                  <m.div variants={fadeUp}>
                    <CategoryTile
                      name={babouches.name}
                      slug={babouches.slug}
                      count={babouches.productCount}
                      coverImage={babouches.coverImage}
                      fallbackImage={babouches.fallbackImage}
                      ratio="1/1"
                    />
                  </m.div>
                )}
              </div>

              {mobileSubChips.length > 0 && (
                <m.div
                  variants={fadeUp}
                  className="no-scrollbar -mx-page flex items-center gap-2 overflow-x-auto px-page pt-2"
                >
                  {mobileSubChips.map((sub) => (
                    <Chip key={sub.id} href={`/explorer/${sub.slug}`}>
                      {sub.name} ({sub.productCount})
                    </Chip>
                  ))}
                </m.div>
              )}
            </m.div>
          </>
        )}
      </Container>
    </Section>
  );
}
