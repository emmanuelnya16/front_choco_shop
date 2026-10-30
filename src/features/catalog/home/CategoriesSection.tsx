import * as m from 'motion/react-m';
import { Chip } from '@/components/ui/Badge';
import { CategoryTile } from '@/components/ui/CategoryTile';
import { Section, Skeleton } from '@/components/ui/Primitives';
import { SectionHeader } from '@/components/ui/SectionHeader';
import { useCategories } from '@/features/catalog/api/useCatalogQueries';
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

export function CategoriesSection() {
  const { data: categories = [], isLoading } = useCategories();
  const reducedMotion = useReducedMotionPref();

  const vetements = categories.find((cat) => cat.slug === 'vetements');
  const chaussures = categories.find((cat) => cat.slug === 'chaussures');
  const babouches = categories.find((cat) => cat.slug === 'babouches');

  // Row 1: Vêtements, Chaussures, Babouches; Row 2: T-shirts, Hoodies, Pantalons
  const vetementsSubs = vetements?.subCategories ?? [];
  const desktopTiles: TileItem[] = [
    ...(vetements ? [vetements] : []),
    ...(chaussures ? [chaussures] : []),
    ...(babouches ? [babouches] : []),
    ...vetementsSubs.slice(0, 3),
  ];

  // Subcategories for mobile horizontal chips
  const mobileSubChips = categories.flatMap((cat) => cat.subCategories);

  return (
    <Section aria-label="Nos univers">
      <SectionHeader
        eyebrow="Explorer"
        title="Nos univers"
        actionLabel="Tout voir"
        actionHref="/explorer"
      />

      {isLoading ? (
        <div className="mt-6 grid grid-cols-1 gap-4 lg:mt-8 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, idx) => (
            <Skeleton key={idx} className="aspect-[4/3] w-full" />
          ))}
        </div>
      ) : (
        <>
          {/* Desktop 3x2 Grid */}
          <m.div
            variants={staggerContainer(0.06)}
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

          {/* Mobile Mosaic + Horizontal Chips */}
          <m.div
            variants={staggerContainer(0.06)}
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
                  <Chip
                    key={sub.id}
                    href={`/explorer/${sub.slug}`}
                  >
                    {sub.name} ({sub.productCount})
                  </Chip>
                ))}
              </m.div>
            )}
          </m.div>
        </>
      )}
    </Section>
  );
}
