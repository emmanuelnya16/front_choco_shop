import {
  AlertCircle,
  ArrowUp,
  ChevronDown,
  ChevronRight,
  SlidersHorizontal,
  WifiOff,
  X,
} from 'lucide-react';
import { AnimatePresence } from 'motion/react';
import * as m from 'motion/react-m';
import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router';
import { Button } from '@/components/ui/Button';
import { Container } from '@/components/ui/Primitives';
import { ProductCard, ProductCardSkeleton } from '@/components/ui/ProductCard';
import { SmartImage } from '@/components/ui/SmartImage';
import {
  useLook,
  useProducts,
  useProductsInfinite,
} from '@/features/catalog/api/useCatalogQueries';
import { AnimatedCounter } from '@/features/catalog/explore/AnimatedCounter';
import { OfflineScreen } from '@/features/offline/OfflineScreen';
import { useOnlineStatus } from '@/lib/hooks/useOnlineStatus';
import { DesktopFilterSidebar } from '@/features/catalog/explore/DesktopFilterSidebar';
import {
  FilterSheets,
  type ActiveFilterSheet,
} from '@/features/catalog/explore/FilterSheets';
import {
  PRICE_RANGE_LABELS,
  SORT_OPTION_LABELS,
  SUBCATEGORY_LABELS,
  useCatalogFilters,
} from '@/features/catalog/filters/useCatalogFilters';
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

const CATEGORY_SUBCATEGORIES: Record<CategorySlug, { slug: string; label: string }[]> = {
  vetements: [
    { slug: 't-shirts', label: 'T-shirts' },
    { slug: 'ensembles', label: 'Ensembles' },
    { slug: 'pantalons', label: 'Pantalons' },
    { slug: 'vestes', label: 'Vestes' },
  ],
  chaussures: [
    { slug: 'baskets', label: 'Baskets' },
    { slug: 'ville', label: 'Chaussures de ville' },
  ],
  babouches: [
    { slug: 'cuir', label: 'Cuir lisse' },
    { slug: 'brodees', label: 'Brodées' },
    { slug: 'classiques', label: 'Classiques' },
  ],
};

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
  // État réseau unique de l'app (M6 §6.1)
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
  } = useProductsInfinite(apiFilters, 12);

  // Détail du look si le paramètre `?look=` est actif (§5.1)
  const { data: activeLook } = useLook(filters.look);

  // 4 articles populaires proposés en cas de résultat vide (§5.5)
  const { data: popularFallback } = useProducts({ sort: 'popular', pageSize: 4 });

  const pages = data?.pages ?? [];
  const items = pages.flatMap((page) => page.items);
  const total = pages[0]?.total ?? 0;
  const facets = pages[0]?.facets;

  const activeTab =
    CATEGORY_TABS.find((t) => t.slug === filters.category) ?? CATEGORY_TABS[0];

  const pageHeading = activeLook
    ? `LOOK : ${activeLook.title.toUpperCase()}`
    : activeTab.title;

  // Titre du document
  useEffect(() => {
    const docTitle = activeLook
      ? `Look ${activeLook.title} — DR Choco L'Incompris`
      : filters.category
        ? `${activeTab.label} — DR Choco L'Incompris`
        : "Explorer le catalogue — DR Choco L'Incompris";
    document.title = docTitle;
  }, [activeLook, activeTab.label, filters.category]);

  // Bouton flottant « Remonter » après 1200 px de défilement (§5.4)
  useEffect(() => {
    const onScroll = () => {
      setShowBackToTop(window.scrollY > 1200);
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  // Défilement infini via IntersectionObserver à 600 px de la fin (§5.4)
  useEffect(() => {
    const sentinel = loadMoreSentinelRef.current;
    if (!sentinel || !hasNextPage || isFetchingNextPage) return;
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
  }, [fetchNextPage, hasNextPage, isFetchingNextPage]);

  const subcategories = filters.category
    ? CATEGORY_SUBCATEGORIES[filters.category] ?? []
    : [];

  const shouldAnimateLayout = !reducedMotion && items.length <= 12;

  return (
    <div className="min-h-dvh bg-white pb-20">
      {/* Bandeau discret hors ligne si des articles en cache sont affichés (§5.5) */}
      {isOffline && items.length > 0 && (
        <div
          role="status"
          className="border-b border-silver bg-surface py-2 text-center text-xs font-semibold text-ink"
        >
          <Container className="flex items-center justify-center gap-2">
            <WifiOff className="h-3.5 w-3.5 text-warning" aria-hidden="true" />
            <span>
              Mode hors ligne — affichage des articles récemment consultés
            </span>
          </Container>
        </div>
      )}

      <Container className="pt-4 lg:pt-8">
        {/* Fil d'Ariane sur ordinateur (§5.2) */}
        <nav
          aria-label="Fil d'Ariane"
          className="mb-4 hidden items-center gap-1.5 text-xs text-text-2 lg:flex"
        >
          <Link to="/" viewTransition className="hover:text-ink">
            Accueil
          </Link>
          <ChevronRight className="h-3.5 w-3.5" aria-hidden="true" />
          <Link
            to="/explorer"
            viewTransition
            className={cn(!filters.category ? 'font-semibold text-ink' : 'hover:text-ink')}
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

          {/* Sélecteur de tri en ligne sur ordinateur */}
          <div className="hidden items-center gap-2 lg:flex">
            <label htmlFor="desktop-sort-select" className="text-small text-text-2">
              Trier par :
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
                {(Object.keys(SORT_OPTION_LABELS) as CatalogSortOption[]).map(
                  (opt) => (
                    <option key={opt} value={opt}>
                      {SORT_OPTION_LABELS[opt]}
                    </option>
                  ),
                )}
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
                <p className="text-h3 text-white">Look : {activeLook.title}</p>
                <p className="text-xs text-silver">{activeLook.subtitle}</p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setFilter('look', undefined)}
              className="inline-flex min-h-[40px] items-center gap-2 rounded-[var(--radius-md)] border border-white/25 bg-ink-2 px-3.5 py-2 text-xs font-bold text-white transition-colors hover:bg-white hover:text-ink"
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
                  'relative shrink-0 py-3 text-small font-bold transition-colors',
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

        {/* Pastilles de sous-catégorie sur mobile (§5.1) */}
        {subcategories.length > 0 && (
          <div className="no-scrollbar mt-3 flex items-center gap-2 overflow-x-auto py-1 lg:hidden">
            <button
              type="button"
              onClick={() => setFilter('sub', undefined)}
              className={cn(
                'shrink-0 rounded-[var(--radius-md)] border px-3 py-1.5 text-xs font-bold transition-colors',
                !filters.sub
                  ? 'border-ink bg-ink text-white'
                  : 'border-silver bg-surface text-ink',
              )}
            >
              Tout voir
            </button>
            {subcategories.map((subItem) => {
              const active = filters.sub === subItem.slug;
              return (
                <button
                  key={subItem.slug}
                  type="button"
                  onClick={() =>
                    setFilter('sub', active ? undefined : subItem.slug)
                  }
                  className={cn(
                    'shrink-0 rounded-[var(--radius-md)] border px-3 py-1.5 text-xs font-bold transition-colors',
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
      <div className="sticky top-[calc(var(--header-h)+env(safe-area-inset-top,0px))] z-sticky mt-2 border-b border-silver/60 bg-white/95 py-2.5 backdrop-blur-md lg:hidden">
        <Container className="no-scrollbar flex items-center gap-2 overflow-x-auto">
          <button
            type="button"
            onClick={() => setActiveSheet('all')}
            className={cn(
              'inline-flex min-h-[38px] shrink-0 items-center gap-1.5 rounded-[var(--radius-md)] border px-3 py-1.5 text-xs font-bold transition-colors',
              activeCount > 0
                ? 'border-ink bg-ink text-white'
                : 'border-silver bg-white text-ink',
            )}
          >
            <SlidersHorizontal className="h-3.5 w-3.5" aria-hidden="true" />
            <span>Filtres</span>
            {activeCount > 0 && (
              <span className="ml-0.5 inline-flex h-4 min-w-[16px] items-center justify-center rounded-[var(--radius-full)] bg-red px-1 text-[10px] font-bold text-white">
                {activeCount}
              </span>
            )}
          </button>

          <button
            type="button"
            onClick={() => setActiveSheet('size')}
            className={cn(
              'inline-flex min-h-[38px] shrink-0 items-center gap-1 rounded-[var(--radius-md)] border px-3 py-1.5 text-xs font-semibold transition-colors',
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
              'inline-flex min-h-[38px] shrink-0 items-center gap-1 rounded-[var(--radius-md)] border px-3 py-1.5 text-xs font-semibold transition-colors',
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
              'inline-flex min-h-[38px] shrink-0 items-center gap-1.5 rounded-[var(--radius-md)] border px-3 py-1.5 text-xs font-semibold transition-colors',
              filters.available
                ? 'border-ink bg-ink text-white'
                : 'border-silver bg-white text-ink',
            )}
          >
            <span>Disponible</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveSheet('sort')}
            className="ml-auto inline-flex min-h-[38px] shrink-0 items-center gap-1 rounded-[var(--radius-md)] border border-silver bg-surface px-3 py-1.5 text-xs font-semibold text-ink"
          >
            <span>Trier : {SORT_OPTION_LABELS[filters.sort]}</span>
            <ChevronDown className="h-3.5 w-3.5" aria-hidden="true" />
          </button>
        </Container>
      </div>

      <Container className="mt-4 lg:mt-6">
        {/* Ligne de pastilles des filtres actifs (§5.1 — affichée uniquement si activeCount > 0) */}
        {activeCount > 0 && (
          <div className="mb-5 flex flex-wrap items-center gap-2">
            {filters.q && (
              <ActiveFilterPill
                label={`Recherche : “${filters.q}”`}
                onRemove={() => setFilter('q', undefined)}
              />
            )}
            {filters.sub && (
              <ActiveFilterPill
                label={SUBCATEGORY_LABELS[filters.sub] ?? filters.sub}
                onRemove={() => setFilter('sub', undefined)}
              />
            )}
            {filters.sizes.map((size) => (
              <ActiveFilterPill
                key={size}
                label={`Taille : ${size}`}
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
                label={`Look : ${activeLook?.title ?? filters.look}`}
                onRemove={() => setFilter('look', undefined)}
              />
            )}
            <button
              type="button"
              onClick={reset}
              className="ml-1 text-xs font-bold text-red underline-offset-2 hover:underline"
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
              <div className="grid grid-cols-2 gap-x-3 gap-y-5 lg:grid-cols-3 lg:gap-6 xl:grid-cols-4">
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
                    Aucun article ne correspond à vos filtres.
                  </h2>
                  <p className="mt-1.5 max-w-md text-small text-text-2">
                    Essayez de retirer une taille ou une fourchette de prix pour
                    découvrir davantage de pièces DR Choco.
                  </p>
                  <Button
                    variant="primary"
                    size="md"
                    onClick={reset}
                    className="mt-6"
                  >
                    Réinitialiser tous les filtres
                  </Button>
                </div>

                {popularFallback && popularFallback.items.length > 0 && (
                  <section aria-labelledby="empty-popular-heading">
                    <h3 id="empty-popular-heading" className="text-h2 text-ink">
                      VOUS AIMEREZ PEUT-ÊTRE
                    </h3>
                    <div className="mt-4 grid grid-cols-2 gap-x-3 gap-y-5 lg:grid-cols-4 lg:gap-6">
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
                <div className="grid grid-cols-2 gap-x-3 gap-y-5 lg:grid-cols-3 lg:gap-6 xl:grid-cols-4">
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
                        transition={{
                          duration: 0.28,
                          ease: [0.22, 1, 0.36, 1],
                        }}
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
                    {items.length} sur {total} article{total > 1 ? 's' : ''} affiché
                    {items.length > 1 ? 's' : ''}
                  </p>
                  <div className="mt-2.5 h-1 w-48 overflow-hidden rounded-[var(--radius-full)] bg-surface">
                    <div
                      style={{
                        width: `${Math.min(100, Math.round((items.length / Math.max(1, total)) * 100))}%`,
                      }}
                      className="h-full bg-ink transition-[width] duration-300"
                    />
                  </div>

                  {hasNextPage && (
                    <Button
                      variant="outline"
                      size="md"
                      loading={isFetchingNextPage}
                      onClick={() => void fetchNextPage()}
                      className="mt-5"
                    >
                      Charger plus d&rsquo;articles
                    </Button>
                  )}
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

      {/* Bouton flottant « Remonter » après 1200 px de défilement (§5.4) */}
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
            className="fixed bottom-[calc(var(--bottom-nav-h)+18px+env(safe-area-inset-bottom,0px))] left-4 z-sticky inline-flex min-h-[42px] items-center gap-1.5 rounded-[var(--radius-full)] bg-ink px-4 py-2 text-xs font-bold text-white shadow-[var(--shadow-sheet)] lg:bottom-6 lg:left-6"
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
    <span className="inline-flex min-h-[32px] items-center gap-1.5 rounded-[var(--radius-md)] bg-surface px-3 py-1 text-xs font-semibold text-ink">
      <span>{label}</span>
      <button
        type="button"
        onClick={onRemove}
        aria-label={`Retirer le filtre ${label}`}
        className="inline-flex h-4 w-4 items-center justify-center rounded-[var(--radius-full)] text-text-2 hover:bg-silver/50 hover:text-ink"
      >
        <X className="h-3 w-3" aria-hidden="true" />
      </button>
    </span>
  );
}
