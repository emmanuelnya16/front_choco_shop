import {
  AlertCircle,
  ArrowUp,
  ArrowUpDown,
  ChevronDown,
  ChevronRight,
  SlidersHorizontal,
  X,
} from 'lucide-react';
import { AnimatePresence } from 'motion/react';
import * as m from 'motion/react-m';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router';
import { Button } from '@/components/ui/Button';
import { Container } from '@/components/ui/Primitives';
import { ProductCard, ProductCardSkeleton } from '@/components/ui/ProductCard';
import { SmartImage } from '@/components/ui/SmartImage';
import {
  useCategories,
  useLook,
  useProducts,
  useProductsInfinite,
} from '@/features/catalog/api/useCatalogQueries';
import { AnimatedCounter } from '@/features/catalog/explore/AnimatedCounter';
import {
  DesktopFilterSidebar,
  type SubcategoryOption,
} from '@/features/catalog/explore/DesktopFilterSidebar';
import {
  FilterSheets,
  type ActiveFilterSheet,
} from '@/features/catalog/explore/FilterSheets';
import {
  CATALOG_SORT_OPTIONS,
  DEFAULT_SUBCATEGORIES,
  PRICE_RANGE_LABELS,
  SORT_OPTION_LABELS,
  SUBCATEGORY_LABELS,
  useCatalogFilters,
} from '@/features/catalog/filters/useCatalogFilters';
import { OfflineScreen } from '@/features/offline/OfflineScreen';
import { useOnlineStatus } from '@/lib/hooks/useOnlineStatus';
import { SITE_NAME } from '@/lib/seo/seo';
import { useSeo } from '@/lib/seo/useSeo';
import { cn } from '@/lib/utils/cn';
import { duration, ease, spring } from '@/motion/tokens';
import { useReducedMotionPref } from '@/motion/useReducedMotionPref';
import type { CatalogSortOption } from '@/types/api';
import type { CategorySlug } from '@/types/domain';

const CATEGORY_TABS: { slug?: CategorySlug; label: string; title: string }[] = [
  { slug: undefined, label: 'Tout', title: 'EXPLORER' },
  { slug: 'vetements', label: 'Vêtements', title: 'VÊTEMENTS' },
  { slug: 'chaussures', label: 'Chaussures', title: 'CHAUSSURES' },
  { slug: 'babouches', label: 'Babouches', title: 'BABOUCHES' },
];

/** Descriptions de référencement (M7 §7), une par catégorie. */
const CATEGORY_DESCRIPTIONS: Record<CategorySlug | 'all', string> = {
  all: 'Tout le catalogue DR Choco L’Incompris : vêtements, chaussures et babouches pour hommes. Réservez en ligne, payez par Mobile Money, retrait en boutique ou livraison.',
  vetements:
    'T-shirts, hoodies et pantalons DR Choco L’Incompris. Réservez votre taille en ligne, payez par Mobile Money, retrait en boutique ou livraison au Cameroun.',
  chaussures:
    'Sneakers, derbies et boots DR Choco L’Incompris. Réservez votre pointure en ligne, payez par Mobile Money, retrait en boutique ou livraison au Cameroun.',
  babouches:
    'Babouches en cuir DR Choco L’Incompris, travaillées à la main. Réservez votre pointure en ligne, payez par Mobile Money, retrait en boutique ou livraison.',
};

/** Le bouton « Remonter » apparaît après ce défilement (§5.4). */
const BACK_TO_TOP_SCROLL_PX = 1200;

const FILTER_CHIP_CLASSES =
  'inline-flex min-h-11 shrink-0 items-center rounded-[var(--radius-md)] border px-3 py-1.5 text-caption transition-colors';

function CoatHangerIllustration() {
  return (
    <svg
      viewBox="0 0 120 80"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="h-20 w-28 text-ink"
      aria-hidden="true"
    >
      <path d="M60 22c0-6 4.5-10 10-10s9 4 9 8.5c0 5.5-6 8.5-12 11.5L60 36" />
      <path d="M60 36L14 62c-3.5 2-2 7.5 2 7.5h88c4 0 5.5-5.5 2-7.5L60 36z" />
      <line x1="38" y1="69.5" x2="82" y2="69.5" className="stroke-red" strokeWidth="3" />
    </svg>
  );
}

/**
 * Page Explorer et Catégorie (`/explorer` et `/explorer/:category`, §5).
 */
export function ExplorePage() {
  const {
    filters,
    apiFilters,
    activeCount,
    setFilter,
    setFilters,
    toggleSize,
    setCategory,
    reset,
  } = useCatalogFilters();

  const reducedMotion = useReducedMotionPref();

  const [activeSheet, setActiveSheet] = useState<ActiveFilterSheet>(null);
  const [showBackToTop, setShowBackToTop] = useState(false);
  // État réseau unique de l'app (M6 §6.1) ; le bandeau global « Hors connexion » suffit à le signaler
  const isOffline = !useOnlineStatus();

  const loadMoreSentinelRef = useRef<HTMLDivElement>(null);

  const {
    data,
    isLoading,
    isError,
    refetch,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    isFetchNextPageError,
  } = useProductsInfinite(apiFilters, 12);

  // Détail du look si le paramètre `?look=` est actif (§5.1)
  const { data: activeLook } = useLook(filters.look);

  // Sous-catégories de l'API (mêmes noms que l'accueil), liste par défaut tant qu'elle n'est pas chargée
  const { data: categories } = useCategories();

  // 4 articles populaires proposés en cas de résultat vide (§5.5)
  const { data: popularFallback } = useProducts({ sort: 'popular', pageSize: 4 });

  const pages = data?.pages ?? [];
  const items = pages.flatMap((page) => page.items);
  const total = pages[0]?.total ?? 0;
  const facets = pages[0]?.facets;

  const activeTab =
    CATEGORY_TABS.find((t) => t.slug === filters.category) ?? CATEGORY_TABS[0];

  const subcategories = useMemo<SubcategoryOption[]>(() => {
    if (!filters.category) return [];
    const fromApi = categories?.find((c) => c.slug === filters.category)?.subCategories;
    if (fromApi && fromApi.length > 0) {
      return fromApi.map((sub) => ({ slug: sub.slug, label: sub.name }));
    }
    return DEFAULT_SUBCATEGORIES[filters.category].map((slug) => ({
      slug,
      label: SUBCATEGORY_LABELS[slug] ?? slug,
    }));
  }, [categories, filters.category]);

  const activeSubLabel = filters.sub
    ? (subcategories.find((s) => s.slug === filters.sub)?.label ??
      SUBCATEGORY_LABELS[filters.sub] ??
      filters.sub)
    : undefined;

  const pageHeading = activeLook
    ? `LOOK\u00a0: ${activeLook.title.toUpperCase()}`
    : activeTab.title;

  // Titre, description et adresse canonique (M7 §7) : un titre par catégorie et par sous-catégorie
  const seoTitle = activeLook
    ? `Look ${activeLook.title}`
    : (activeSubLabel ?? (filters.category ? activeTab.label : 'Explorer le catalogue'));
  const seoDescription = activeLook
    ? `Toutes les pièces du look « ${activeLook.title} » : ${activeLook.subtitle}. Réservez en ligne, payez par Mobile Money.`
    : activeSubLabel
      ? `${activeSubLabel} DR Choco L’Incompris. Réservez en ligne, payez par Mobile Money, retrait en boutique ou livraison au Cameroun.`
      : CATEGORY_DESCRIPTIONS[filters.category ?? 'all'];
  useSeo({
    title: `${seoTitle} — ${SITE_NAME}`,
    absoluteTitle: true,
    description: seoDescription,
  });

  // Bouton flottant « Remonter » après 1200 px de défilement (§5.4), masqué dès que le pied de page
  // entre à l'écran : il ne recouvre ni ses liens ni ses mentions
  useEffect(() => {
    let frame = 0;
    const update = () => {
      frame = 0;
      const footerTop =
        document.querySelector('footer')?.getBoundingClientRect().top ?? Number.POSITIVE_INFINITY;
      setShowBackToTop(window.scrollY > BACK_TO_TOP_SCROLL_PX && footerTop > window.innerHeight);
    };
    const onScroll = () => {
      if (!frame) frame = window.requestAnimationFrame(update);
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => {
      window.removeEventListener('scroll', onScroll);
      if (frame) window.cancelAnimationFrame(frame);
    };
  }, []);

  // Défilement infini via IntersectionObserver à 600 px de la fin (§5.4).
  // Après un échec de la page suivante, aucune relance automatique (sinon l'observateur se réarme et
  // relance la requête en boucle) : le client choisit « Réessayer ». Rien n'est demandé hors connexion.
  useEffect(() => {
    const sentinel = loadMoreSentinelRef.current;
    if (!sentinel || !hasNextPage || isFetchingNextPage || isFetchNextPageError || isOffline) return;
    if (typeof IntersectionObserver === 'undefined') return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) {
          void fetchNextPage();
        }
      },
      { rootMargin: '600px' },
    );

    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [fetchNextPage, hasNextPage, isFetchingNextPage, isFetchNextPageError, isOffline]);

  const shouldAnimateLayout = !reducedMotion && items.length <= 12;
  const loadedRatio = Math.min(1, items.length / Math.max(1, total));

  return (
    <div className="min-h-dvh bg-white pb-20">
      <Container className="pt-4 lg:pt-8">
        {/* Fil d'Ariane sur ordinateur (§5.2) */}
        <nav
          aria-label="Fil d’Ariane"
          className="mb-4 hidden items-center gap-1.5 text-caption text-text-2 lg:flex"
        >
          <Link to="/" viewTransition className="py-1 hover:text-ink">
            Accueil
          </Link>
          <ChevronRight className="h-3.5 w-3.5" aria-hidden="true" />
          <Link
            to="/explorer"
            viewTransition
            className={cn('py-1', !filters.category ? 'font-semibold text-ink' : 'hover:text-ink')}
          >
            Explorer
          </Link>
          {filters.category && (
            <>
              <ChevronRight className="h-3.5 w-3.5" aria-hidden="true" />
              <span className="font-semibold text-ink">{activeTab.label}</span>
            </>
          )}
        </nav>

        {/* En-tête de page : Titre + Compteur animé + Tri bureau (§5.1, §5.2) */}
        <div className="flex flex-wrap items-baseline justify-between gap-4">
          <div className="flex items-baseline gap-3">
            <h1 className="text-h1 text-ink">{pageHeading}</h1>
            {!isLoading && (
              <AnimatedCounter
                value={total}
                className="text-small font-semibold text-text-2 tabular-nums"
              />
            )}
          </div>

          {/* Sélecteur de tri en ligne sur ordinateur (une option par tri, sans les alias d'adresse) */}
          <div className="hidden items-center gap-2 lg:flex">
            <label htmlFor="desktop-sort-select" className="text-small text-text-2">
              Trier par&nbsp;:
            </label>
            <div className="relative">
              <select
                id="desktop-sort-select"
                value={filters.sort}
                onChange={(e) =>
                  setFilter('sort', e.target.value as CatalogSortOption)
                }
                className="h-10 appearance-none rounded-[var(--radius-md)] border border-silver bg-white pr-9 pl-3.5 text-small font-semibold text-ink focus:border-ink focus:outline-none"
              >
                {CATALOG_SORT_OPTIONS.map((opt) => (
                  <option key={opt} value={opt}>
                    {SORT_OPTION_LABELS[opt]}
                  </option>
                ))}
              </select>
              <ChevronDown
                className="pointer-events-none absolute top-1/2 right-3 h-4 w-4 -translate-y-1/2 text-ink"
                aria-hidden="true"
              />
            </div>
          </div>
        </div>

        {/* Bandeau Look lorsque `?look=` est actif (§5.1) */}
        {filters.look && activeLook && (
          <div className="mt-4 flex flex-wrap items-center justify-between gap-4 rounded-[var(--radius-md)] bg-ink p-4 text-white">
            <div className="flex items-center gap-3.5">
              <div className="h-16 w-13 shrink-0 overflow-hidden rounded-[var(--radius-sm)] bg-ink-2">
                <SmartImage
                  src={activeLook.image}
                  fallback={activeLook.fallback}
                  alt={activeLook.title}
                  ratio="4/5"
                  className="h-full w-full"
                />
              </div>
              <div>
                <span className="text-label text-silver">SÉLECTION LOOKBOOK</span>
                <p className="text-h3 text-white">Look&nbsp;: {activeLook.title}</p>
                <p className="text-caption text-silver">{activeLook.subtitle}</p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setFilter('look', undefined)}
              className="inline-flex min-h-11 items-center gap-2 rounded-[var(--radius-md)] border border-white/25 bg-ink-2 px-3.5 py-2 text-caption font-bold text-white transition-colors hover:bg-white hover:text-ink"
            >
              <span>Voir tout le catalogue</span>
              <X className="h-3.5 w-3.5" aria-hidden="true" />
            </button>
          </div>
        )}

        {/* Barre d'onglets de catégories à défilement horizontal (§5.1) */}
        <div
          role="tablist"
          aria-label="Catégories du catalogue"
          className="no-scrollbar mt-4 flex items-center gap-6 overflow-x-auto border-b border-silver/70"
        >
          {CATEGORY_TABS.map((tab) => {
            const isActive = filters.category === tab.slug;
            return (
              <button
                key={tab.label}
                type="button"
                role="tab"
                aria-selected={isActive}
                onClick={() => setCategory(tab.slug)}
                className={cn(
                  'relative min-h-11 min-w-11 shrink-0 py-3 text-center text-small font-bold transition-colors',
                  isActive ? 'text-ink' : 'text-text-2 hover:text-ink',
                )}
              >
                <span>{tab.label}</span>
                {isActive && (
                  <m.span
                    layoutId="explore-category-underline"
                    transition={spring.snappy}
                    className="absolute right-0 bottom-0 left-0 h-[2px] bg-ink"
                  />
                )}
              </button>
            );
          })}
        </div>

        {/* Pastilles de sous-catégorie sur mobile (§5.1) : mêmes sous-catégories que la colonne ordinateur */}
        {subcategories.length > 0 && (
          <div className="no-scrollbar mt-3 flex items-center gap-2 overflow-x-auto lg:hidden">
            <button
              type="button"
              aria-pressed={!filters.sub}
              onClick={() => setFilter('sub', undefined)}
              className={cn(
                FILTER_CHIP_CLASSES,
                'font-bold',
                !filters.sub
                  ? 'border-ink bg-ink text-white'
                  : 'border-silver bg-surface text-ink',
              )}
            >
              Toutes
            </button>
            {subcategories.map((subItem) => {
              const active = filters.sub === subItem.slug;
              return (
                <button
                  key={subItem.slug}
                  type="button"
                  aria-pressed={active}
                  onClick={() =>
                    setFilter('sub', active ? undefined : subItem.slug)
                  }
                  className={cn(
                    FILTER_CHIP_CLASSES,
                    'font-bold',
                    active
                      ? 'border-ink bg-ink text-white'
                      : 'border-silver bg-surface text-ink',
                  )}
                >
                  {subItem.label}
                </button>
              );
            })}
          </div>
        )}
      </Container>

      {/* Barre de filtres et tri collante sur mobile (§5.1) */}
      <div className="sticky top-[calc(var(--header-h)+env(safe-area-inset-top,0px))] z-sticky mt-2 border-b border-silver/60 bg-white/95 py-1.5 backdrop-blur-md transition-transform duration-fast ease-brand-out motion-reduce:transition-none lg:hidden [html[data-mobile-header=hidden]_&]:-translate-y-[var(--header-h)]">
        {/* Tri toujours visible à droite ; les pastilles de filtre défilent à sa gauche (à 360 px, « Trier » sortait de l'écran).
            Fondu sur le bord droit : une pastille coupée se lit comme « la rangée continue ». */}
        <Container className="flex items-center gap-2">
          <div className="no-scrollbar flex min-w-0 flex-1 items-center gap-2 overflow-x-auto pr-6 [mask-image:linear-gradient(to_right,var(--color-ink)_calc(100%-1.5rem),transparent)]">
            <button
              type="button"
              onClick={() => setActiveSheet('all')}
              className={cn(
                FILTER_CHIP_CLASSES,
                'gap-1.5 font-bold',
                activeCount > 0
                  ? 'border-ink bg-ink text-white'
                  : 'border-silver bg-white text-ink',
              )}
            >
              <SlidersHorizontal className="h-3.5 w-3.5" aria-hidden="true" />
              <span>Filtres</span>
              {activeCount > 0 && (
                <span className="ml-0.5 inline-flex h-5 min-w-5 items-center justify-center rounded-[var(--radius-full)] bg-red px-1 text-caption font-bold text-white">
                  {activeCount}
                </span>
              )}
            </button>

            <button
              type="button"
              onClick={() => setActiveSheet('size')}
              className={cn(
                FILTER_CHIP_CLASSES,
                'gap-1 font-semibold',
                filters.sizes.length > 0
                  ? 'border-ink bg-ink text-white'
                  : 'border-silver bg-white text-ink',
              )}
            >
              <span>
                {filters.sizes.length > 0
                  ? `Taille (${filters.sizes.join(', ')})`
                  : 'Taille'}
              </span>
              <ChevronDown className="h-3.5 w-3.5" aria-hidden="true" />
            </button>

            <button
              type="button"
              onClick={() => setActiveSheet('price')}
              className={cn(
                FILTER_CHIP_CLASSES,
                'gap-1 font-semibold',
                filters.price
                  ? 'border-ink bg-ink text-white'
                  : 'border-silver bg-white text-ink',
              )}
            >
              <span>
                {filters.price ? PRICE_RANGE_LABELS[filters.price] : 'Prix'}
              </span>
              <ChevronDown className="h-3.5 w-3.5" aria-hidden="true" />
            </button>

            <button
              type="button"
              aria-pressed={filters.available}
              onClick={() => setFilter('available', !filters.available)}
              className={cn(
                FILTER_CHIP_CLASSES,
                'gap-1.5 font-semibold',
                filters.available
                  ? 'border-ink bg-ink text-white'
                  : 'border-silver bg-white text-ink',
              )}
            >
              <span>En stock</span>
            </button>
          </div>

          <button
            type="button"
            onClick={() => setActiveSheet('sort')}
            aria-label={`Trier\u00a0: ${SORT_OPTION_LABELS[filters.sort]}`}
            className={cn(FILTER_CHIP_CLASSES, 'gap-1 border-silver bg-surface font-semibold text-ink')}
          >
            <ArrowUpDown className="h-3.5 w-3.5 sm:hidden" aria-hidden="true" />
            <span>
              Trier<span className="hidden sm:inline">&nbsp;: {SORT_OPTION_LABELS[filters.sort]}</span>
            </span>
            <ChevronDown className="hidden h-3.5 w-3.5 sm:block" aria-hidden="true" />
          </button>
        </Container>
      </div>

      <Container className="mt-4 lg:mt-6">
        {/* Ligne de pastilles des filtres actifs (§5.1 — affichée uniquement si activeCount > 0) */}
        {activeCount > 0 && (
          <div className="mb-5 flex flex-wrap items-center gap-2">
            {filters.q && (
              <ActiveFilterPill
                label={`Recherche\u00a0: «\u00a0${filters.q}\u00a0»`}
                onRemove={() => setFilter('q', undefined)}
              />
            )}
            {filters.sub && activeSubLabel && (
              <ActiveFilterPill
                label={activeSubLabel}
                onRemove={() => setFilter('sub', undefined)}
              />
            )}
            {filters.sizes.map((size) => (
              <ActiveFilterPill
                key={size}
                label={`Taille\u00a0: ${size}`}
                onRemove={() => toggleSize(size)}
              />
            ))}
            {filters.price && (
              <ActiveFilterPill
                label={PRICE_RANGE_LABELS[filters.price]}
                onRemove={() => setFilter('price', undefined)}
              />
            )}
            {filters.available && (
              <ActiveFilterPill
                label="En stock"
                onRemove={() => setFilter('available', false)}
              />
            )}
            {filters.look && (
              <ActiveFilterPill
                label={`Look\u00a0: ${activeLook?.title ?? filters.look}`}
                onRemove={() => setFilter('look', undefined)}
              />
            )}
            <button
              type="button"
              onClick={reset}
              className="ml-1 inline-flex min-h-11 items-center px-1 text-caption font-bold text-red underline-offset-2 hover:underline"
            >
              Tout effacer
            </button>
          </div>
        )}

        {/* Corps principal : Colonne latérale gauche (bureau) + Grille produits (§5.2) */}
        <div className="flex items-start gap-8">
          <DesktopFilterSidebar
            filters={filters}
            facets={facets}
            subcategories={subcategories}
            activeCount={activeCount}
            onSelectSub={(sub) => setFilter('sub', sub)}
            onToggleSize={toggleSize}
            onSelectPrice={(price) => setFilter('price', price)}
            onToggleAvailable={(available) => setFilter('available', available)}
            onReset={reset}
          />

          <div className="min-w-0 flex-1">
            {/* État de chargement initial : 6 squelettes (§5.5) */}
            {isLoading && items.length === 0 ? (
              <div className="grid grid-cols-2 gap-x-3 gap-y-5 md:grid-cols-3 md:gap-x-4 lg:gap-6 xl:grid-cols-4">
                {Array.from({ length: 6 }).map((_, idx) => (
                  <ProductCardSkeleton key={idx} />
                ))}
              </div>
            ) : isError && items.length === 0 && isOffline ? (
              /* Catalogue jamais consulté et réseau absent : repli « hors connexion » (M6 §6.5) */
              <OfflineScreen headingLevel="h2" onRetry={() => refetch()} className="py-6" />
            ) : isError && items.length === 0 ? (
              /* État d'erreur réseau (§5.5) */
              <div className="flex flex-col items-center justify-center rounded-[var(--radius-md)] border border-silver bg-surface px-6 py-14 text-center">
                <AlertCircle className="h-10 w-10 text-danger" aria-hidden="true" />
                <h2 className="mt-3 text-h2 text-ink">
                  Impossible de charger le catalogue
                </h2>
                <p className="mt-1.5 max-w-md text-small text-text-2">
                  Vérifiez votre connexion internet et réessayez dans un instant.
                </p>
                <Button
                  variant="primary"
                  size="md"
                  onClick={() => void refetch()}
                  className="mt-5"
                >
                  Réessayer
                </Button>
              </div>
            ) : items.length === 0 ? (
              /* État vide (0 résultat pour ces filtres, §5.5) */
              <div className="space-y-12">
                <div className="flex flex-col items-center justify-center rounded-[var(--radius-md)] border border-silver/70 bg-surface px-6 py-14 text-center">
                  <CoatHangerIllustration />
                  <h2 className="mt-4 text-h2 text-ink">
                    Aucun article ne correspond à vos filtres
                  </h2>
                  <p className="mt-1.5 max-w-md text-small text-text-2">
                    Retirez une taille ou une fourchette de prix pour découvrir davantage de
                    pièces DR Choco.
                  </p>
                  <Button
                    variant="primary"
                    size="md"
                    onClick={reset}
                    className="mt-6"
                  >
                    Réinitialiser les filtres
                  </Button>
                </div>

                {popularFallback && popularFallback.items.length > 0 && (
                  <section aria-labelledby="empty-popular-heading">
                    <h3 id="empty-popular-heading" className="text-h2 text-ink">
                      VOUS AIMEREZ PEUT-ÊTRE
                    </h3>
                    <div className="mt-4 grid grid-cols-2 gap-x-3 gap-y-5 md:grid-cols-4 md:gap-x-4 lg:gap-6">
                      {popularFallback.items.slice(0, 4).map((product) => (
                        <ProductCard key={product.id} product={product} />
                      ))}
                    </div>
                  </section>
                )}
              </div>
            ) : (
              /* Grille de cartes produits + pagination infinie (§5.4) */
              <div>
                <div className="grid grid-cols-2 gap-x-3 gap-y-5 md:grid-cols-3 md:gap-x-4 lg:gap-6 xl:grid-cols-4">
                  <AnimatePresence mode="popLayout">
                    {items.map((product) => (
                      <m.div
                        key={product.id}
                        layout={shouldAnimateLayout}
                        initial={
                          shouldAnimateLayout ? { opacity: 0, scale: 0.96 } : false
                        }
                        animate={{ opacity: 1, scale: 1 }}
                        exit={
                          shouldAnimateLayout
                            ? { opacity: 0, scale: 0.96 }
                            : undefined
                        }
                        transition={{ duration: duration.quick, ease: ease.out }}
                      >
                        <ProductCard product={product} />
                      </m.div>
                    ))}
                  </AnimatePresence>

                  {/* 4 squelettes pendant le chargement de la page suivante */}
                  {isFetchingNextPage &&
                    Array.from({ length: 4 }).map((_, idx) => (
                      <ProductCardSkeleton key={`next-skel-${idx}`} />
                    ))}
                </div>

                {/* Pied de grille : progression X sur Y + sentinelle + bouton de secours (§5.4) */}
                <div
                  ref={loadMoreSentinelRef}
                  className="mt-12 flex flex-col items-center justify-center text-center"
                >
                  <p className="text-small font-semibold text-text-2 tabular-nums">
                    {items.length} sur {total} {total > 1 ? 'articles affichés' : 'article affiché'}
                  </p>
                  <div className="mt-2.5 h-1 w-48 overflow-hidden rounded-[var(--radius-full)] bg-surface">
                    <div
                      style={{ transform: `scaleX(${loadedRatio})` }}
                      className="h-full w-full origin-left bg-ink transition-transform duration-base ease-brand-out"
                    />
                  </div>

                  {hasNextPage && isFetchNextPageError && !isFetchingNextPage ? (
                    /* Échec de la page suivante : message et relance à la demande, jamais en boucle */
                    <div role="status" className="mt-5 flex flex-col items-center gap-3">
                      <p className="max-w-sm text-small text-text-2">
                        {isOffline
                          ? 'Hors connexion : les articles suivants s’afficheront au retour du réseau.'
                          : 'Les articles suivants n’ont pas pu être chargés.'}
                      </p>
                      <Button variant="outline" size="md" onClick={() => void fetchNextPage()}>
                        Réessayer
                      </Button>
                    </div>
                  ) : hasNextPage && isOffline && !isFetchingNextPage ? (
                    <p role="status" className="mt-5 max-w-sm text-small text-text-2">
                      Hors connexion : les articles suivants s’afficheront au retour du réseau.
                    </p>
                  ) : hasNextPage ? (
                    <Button
                      variant="outline"
                      size="md"
                      loading={isFetchingNextPage}
                      onClick={() => void fetchNextPage()}
                      className="mt-5"
                    >
                      Charger plus d&rsquo;articles
                    </Button>
                  ) : null}
                </div>
              </div>
            )}
          </div>
        </div>
      </Container>

      {/* Tiroirs de filtres mobiles (§5.3) */}
      <FilterSheets
        activeSheet={activeSheet}
        onClose={() => setActiveSheet(null)}
        filters={filters}
        facets={facets}
        onApplyFilters={(patch) => setFilters(patch)}
      />

      {/* Bouton flottant « Remonter » (§5.4) : posé au-dessus de la barre basse, du bandeau rouge et du
          bandeau de mise à jour, comme les autres éléments flottants (index.css) */}
      <AnimatePresence>
        {showBackToTop && (
          <m.button
            type="button"
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 12 }}
            transition={{ duration: duration.fast, ease: ease.out }}
            onClick={() =>
              window.scrollTo({
                top: 0,
                behavior: reducedMotion ? 'auto' : 'smooth',
              })
            }
            aria-label="Remonter en haut de la page"
            className="fixed bottom-[calc(var(--bottom-bar-h)+var(--pending-banner-h)+var(--update-banner-h)+16px)] left-4 z-sticky inline-flex min-h-11 items-center gap-1.5 rounded-[var(--radius-full)] border border-white/20 bg-ink px-4 py-2 text-caption font-bold text-white shadow-pop lg:bottom-[calc(var(--update-banner-h)+24px)] lg:left-6"
          >
            <ArrowUp className="h-3.5 w-3.5" aria-hidden="true" />
            <span>Remonter</span>
          </m.button>
        )}
      </AnimatePresence>
    </div>
  );
}

function ActiveFilterPill({
  label,
  onRemove,
}: {
  label: string;
  onRemove: () => void;
}) {
  return (
    <span className="inline-flex min-h-8 items-center gap-1.5 rounded-[var(--radius-md)] bg-surface px-3 py-1 text-caption font-semibold text-ink">
      <span>{label}</span>
      <button
        type="button"
        onClick={onRemove}
        aria-label={`Retirer le filtre ${label}`}
        className="relative inline-flex h-4 w-4 items-center justify-center rounded-[var(--radius-full)] text-text-2 before:absolute before:-inset-3.5 before:content-[''] hover:bg-silver/50 hover:text-ink"
      >
        <X className="h-3 w-3" aria-hidden="true" />
      </button>
    </span>
  );
}
