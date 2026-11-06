import {
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  Clock,
  Search as SearchIcon,
  SlidersHorizontal,
  TrendingUp,
  WifiOff,
  X,
} from 'lucide-react';
import * as m from 'motion/react-m';
import {
  useEffect,
  useId,
  useRef,
  useState,
  type FormEvent,
  type KeyboardEvent,
} from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router';
import { Badge } from '@/components/ui/Badge';
import { Container, Price, Skeleton } from '@/components/ui/Primitives';
import { ProductCard, ProductCardSkeleton } from '@/components/ui/ProductCard';
import { SmartImage } from '@/components/ui/SmartImage';
import {
  useCategories,
  useProducts,
  useSearchSuggest,
} from '@/features/catalog/api/useCatalogQueries';
import { HighlightMatch } from '@/features/catalog/search/HighlightMatch';
import {
  POPULAR_SEARCH_CHIPS,
  useRecentSearches,
} from '@/features/catalog/search/recentSearches';
import { seeResultsLabel } from '@/features/catalog/search/searchLabels';
import { useBackNavigation } from '@/lib/hooks/useBackNavigation';
import { useOnlineStatus } from '@/lib/hooks/useOnlineStatus';
import { SITE_NAME } from '@/lib/seo/seo';
import { useSeo } from '@/lib/seo/useSeo';
import { cn } from '@/lib/utils/cn';
import { duration, ease } from '@/motion/tokens';
import { useReducedMotionPref } from '@/motion/useReducedMotionPref';
import { useUiStore } from '@/stores/uiStore';

/**
 * Grille des résultats validés : bande blanche (les cartes produit sont prévues pour un fond clair),
 * bord à bord sur téléphone pour garder des cartes à la même taille que dans le catalogue.
 */
const RESULTS_PANEL_CLASSES =
  '-mx-page mt-5 grid grid-cols-2 gap-x-3 gap-y-5 bg-white px-page py-5 text-ink sm:mx-0 sm:rounded-[var(--radius-md)] sm:px-5 md:grid-cols-3 lg:grid-cols-4 lg:gap-6';

const CATEGORY_LABELS: Record<string, string> = {
  vetements: 'Vêtements',
  chaussures: 'Chaussures',
  babouches: 'Babouches',
};

/**
 * Page Recherche plein écran (`/recherche`, §6.1) :
 * - S'ouvre sur mobile en plein écran sombre (`bg-ink`) par expansion circulaire (`clip-path: circle(...)`)
 *   depuis les coordonnées de l'icône loupe touchée dans l'en-tête (seul effet marqué de l'écran).
 * - Comprend les deux états : Avant la frappe (< 2 caractères) et Frappe en direct (>= 2 caractères, debounce 250 ms).
 * - Une recherche validée (`?q=`) affiche la grille complète des résultats à la place des suggestions.
 */
export function SearchPage() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const reducedMotion = useReducedMotionPref();
  const searchOrigin = useUiStore((s) => s.searchOrigin);

  const initialUrlQuery = searchParams.get('q') ?? '';
  const [query, setQuery] = useState(initialUrlQuery);
  const [activeIndex, setActiveIndex] = useState(-1);

  const inputRef = useRef<HTMLInputElement>(null);
  const listboxId = useId();

  const {
    searches: recentSearches,
    add: addRecent,
    remove: removeRecent,
    clear: clearRecent,
  } = useRecentSearches();

  const { data: categoriesData } = useCategories();
  const {
    data: suggestData,
    isFetching,
    isError: isSuggestError,
    refetch: refetchSuggest,
  } = useSearchSuggest(query, 250);
  const isOnline = useOnlineStatus();

  // Si un paramètre `?q=` est validé dans l'URL, charge aussi la grille complète
  const committedQuery = searchParams.get('q')?.trim() ?? '';
  const {
    data: fullResults,
    isLoading: isLoadingResults,
    isError: isResultsError,
    refetch: refetchResults,
  } = useProducts(
    committedQuery.length >= 2
      ? { q: committedQuery, pageSize: 24 }
      : undefined,
  );

  const suggestions = suggestData?.products ?? [];
  const totalMatches = suggestData?.totalProducts ?? 0;
  const trimmedQuery = query.trim();
  const hasTypedEnough = trimmedQuery.length >= 2;
  const categories = categoriesData ?? [];
  // Recherche validée et inchangée : une seule présentation, la grille des résultats
  const showCommittedResults = committedQuery.length >= 2 && trimmedQuery === committedQuery;

  // Page de recherche : jamais indexée (contenu propre à chaque saisie)
  useSeo({
    title: committedQuery
      ? `Recherche «\u00a0${committedQuery}\u00a0» — ${SITE_NAME}`
      : `Rechercher un article — ${SITE_NAME}`,
    absoluteTitle: true,
    description: 'Recherchez un vêtement, une paire de chaussures ou de babouches dans le catalogue DR Choco L’Incompris.',
    noindex: true,
  });

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const originX = searchOrigin ? `${searchOrigin.x}px` : 'calc(100% - 64px)';
  const originY = searchOrigin ? `${searchOrigin.y}px` : '28px';

  // Retour (M6 §8) : écran précédent de l'app, sinon le catalogue
  const handleCancel = useBackNavigation('/explorer');

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (trimmedQuery.length >= 2) {
      addRecent(trimmedQuery);
      setSearchParams({ q: trimmedQuery }, { replace: true });
    }
  };

  const handleSelectTerm = (term: string, targetUrl?: string) => {
    const cleaned = term.trim();
    if (targetUrl) {
      // Raccourci vers un filtre (taille, prix) : ce n'est pas un terme à garder dans l'historique
      navigate(targetUrl, { viewTransition: true });
      return;
    }
    addRecent(cleaned);
    setQuery(cleaned);
    setSearchParams({ q: cleaned }, { replace: true });
  };

  const handleSelectProduct = (slug: string, name: string) => {
    addRecent(name);
    navigate(`/produit/${slug}`, { viewTransition: true });
  };

  const goToCatalogResults = () => {
    addRecent(trimmedQuery);
    navigate(`/explorer?q=${encodeURIComponent(trimmedQuery)}`, { viewTransition: true });
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Escape') {
      handleCancel();
      return;
    }
    if (!hasTypedEnough || showCommittedResults || suggestions.length === 0) return;

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActiveIndex((prev) => (prev + 1) % suggestions.length);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveIndex((prev) => (prev <= 0 ? suggestions.length - 1 : prev - 1));
    } else if (e.key === 'Enter' && activeIndex >= 0 && suggestions[activeIndex]) {
      e.preventDefault();
      const target = suggestions[activeIndex];
      handleSelectProduct(target.slug, target.name);
    }
  };

  const listExpanded = hasTypedEnough && !showCommittedResults;

  return (
    <m.div
      initial={
        reducedMotion
          ? { opacity: 1 }
          : { clipPath: `circle(0% at ${originX} ${originY})` }
      }
      animate={
        reducedMotion
          ? { opacity: 1 }
          : { clipPath: `circle(150% at ${originX} ${originY})` }
      }
      transition={{ duration: duration.curtain, ease: ease.inOut }}
      className="min-h-dvh bg-ink pb-24 text-white"
    >
      <h1 className="sr-only">Rechercher un article</h1>

      {/*
        Barre de recherche en haut (52 px de haut, §6.1). Ordinateur : collée sous l'en-tête replié
        (et sous le bandeau de réservation s'il est affiché), colonne de lecture de 768 px.
      */}
      <div className="sticky top-0 z-sticky border-b border-white/10 bg-ink/95 pt-[calc(12px+env(safe-area-inset-top,0px))] pb-3 backdrop-blur-md lg:top-[var(--desktop-shell-top)]">
        <Container className="flex items-center gap-3 lg:max-w-3xl">
          <button
            type="button"
            onClick={handleCancel}
            aria-label="Retour"
            className="-ml-2 inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-[var(--radius-full)] text-white hover:bg-ink-2 lg:hidden"
          >
            <ArrowLeft className="h-5 w-5" aria-hidden="true" />
          </button>
          <form onSubmit={handleSubmit} role="search" className="relative flex-1">
            <SearchIcon
              className="pointer-events-none absolute top-1/2 left-4 h-5 w-5 -translate-y-1/2 text-silver"
              aria-hidden="true"
            />
            <input
              ref={inputRef}
              type="search"
              enterKeyHint="search"
              role="combobox"
              aria-expanded={listExpanded}
              aria-controls={listboxId}
              aria-activedescendant={
                listExpanded && activeIndex >= 0 && suggestions[activeIndex]
                  ? `search-opt-${suggestions[activeIndex].id}`
                  : undefined
              }
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setActiveIndex(-1);
              }}
              onKeyDown={handleKeyDown}
              // Texte indicatif court : lisible en entier dès 360 px
              placeholder="Rechercher un article…"
              aria-label="Rechercher un article dans le catalogue"
              className={cn(
                // Croix native du navigateur masquée : seule la croix de l'app (ci-dessous) reste
                'h-13 w-full rounded-[var(--radius-md)] border border-white/15 bg-ink-2 pl-12 text-body text-white placeholder:text-grey focus:border-white focus:outline-none [&::-webkit-search-cancel-button]:appearance-none',
                // Place du bouton d'effacement seulement quand il est affiché
                query.length > 0 ? 'pr-12' : 'pr-4',
              )}
            />
            {query.length > 0 && (
              <button
                type="button"
                onClick={() => {
                  setQuery('');
                  setSearchParams({}, { replace: true });
                  inputRef.current?.focus();
                }}
                aria-label="Effacer la saisie"
                className="absolute top-1/2 right-1 inline-flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-[var(--radius-full)] text-silver hover:text-white"
              >
                <X className="h-4 w-4" aria-hidden="true" />
              </button>
            )}
          </form>

          <button
            type="button"
            onClick={handleCancel}
            className="hidden min-h-11 shrink-0 items-center px-2 text-small font-bold text-silver hover:text-white lg:inline-flex"
          >
            Annuler
          </button>
        </Container>
      </div>

      <Container className={cn('pt-6', showCommittedResults ? 'lg:max-w-content' : 'lg:max-w-3xl')}>
        {/* Recherche en direct bloquée hors connexion, avec explication (M6 §6.3) */}
        {!isOnline && (
          <p
            role="status"
            className="mb-6 flex items-start gap-2.5 rounded-[var(--radius-md)] border border-white/15 bg-ink-2 px-4 py-3 text-small text-white"
          >
            <WifiOff className="mt-0.5 h-4 w-4 shrink-0 text-silver" aria-hidden="true" />
            <span>
              Hors connexion&nbsp;: la recherche en direct reprendra au retour du réseau. Les articles
              déjà consultés restent visibles dans le catalogue.
            </span>
          </p>
        )}
        {!hasTypedEnough ? (
          /* ÉTAT 1 : AVANT LA FRAPPE (< 2 caractères, §6.1) */
          <div className="space-y-8">
            {/* 1. Recherches récentes */}
            {recentSearches.length > 0 && (
              <section aria-labelledby="recent-searches-heading">
                <div className="flex items-center justify-between">
                  <h2 id="recent-searches-heading" className="text-label text-silver">
                    RECHERCHES RÉCENTES
                  </h2>
                  <button
                    type="button"
                    onClick={clearRecent}
                    className="-mr-2 inline-flex min-h-11 items-center px-2 text-caption font-bold text-white underline underline-offset-2 hover:text-silver"
                  >
                    Effacer
                  </button>
                </div>

                <ul className="mt-3 divide-y divide-white/10">
                  {recentSearches.map((item) => (
                    <li
                      key={item}
                      className="flex items-center justify-between"
                    >
                      <button
                        type="button"
                        onClick={() => handleSelectTerm(item)}
                        className="flex min-h-11 flex-1 items-center gap-3 text-left text-body text-white hover:text-silver"
                      >
                        <Clock className="h-4 w-4 text-grey" aria-hidden="true" />
                        <span>{item}</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => removeRecent(item)}
                        aria-label={`Supprimer ${item} de l’historique`}
                        className="-mr-2.5 inline-flex h-11 w-11 items-center justify-center rounded-[var(--radius-full)] text-grey hover:text-white"
                      >
                        <X className="h-4 w-4" aria-hidden="true" />
                      </button>
                    </li>
                  ))}
                </ul>
              </section>
            )}

            {/* 2. Parcourir par catégorie (3 tuiles compactes horizontales) */}
            {categories.length > 0 && (
              <section aria-labelledby="search-categories-heading">
                <h2 id="search-categories-heading" className="text-label text-silver">
                  PARCOURIR PAR CATÉGORIE
                </h2>
                <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-3">
                  {categories.map((cat) => (
                    <Link
                      key={cat.id}
                      to={`/explorer/${cat.slug}`}
                      viewTransition
                      className="group flex items-center gap-3.5 rounded-[var(--radius-md)] border border-white/15 bg-ink-2 p-3 transition-colors hover:border-white"
                    >
                      <div className="w-12 shrink-0 overflow-hidden rounded-[var(--radius-sm)] bg-ink">
                        <SmartImage
                          src={cat.coverImage}
                          fallback={cat.fallbackImage}
                          alt=""
                          ratio="4/5"
                          className="h-full w-full"
                        />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-h3 text-white">{cat.name}</p>
                        <p className="text-caption text-silver">
                          {cat.productCount} {cat.productCount > 1 ? 'articles' : 'article'}
                        </p>
                      </div>
                      <ArrowRight
                        className="h-4 w-4 text-silver transition-transform duration-fast group-hover:translate-x-1 group-hover:text-white"
                        aria-hidden="true"
                      />
                    </Link>
                  ))}
                </div>
              </section>
            )}

            {/* 3. Recherches populaires (6 pastilles rapides) */}
            <section aria-labelledby="popular-searches-heading">
              <h2 id="popular-searches-heading" className="text-label text-silver">
                RECHERCHES POPULAIRES
              </h2>
              <div className="mt-3 flex flex-wrap gap-2.5">
                {POPULAR_SEARCH_CHIPS.map((chip) => (
                  <button
                    key={chip.label}
                    type="button"
                    onClick={() => handleSelectTerm(chip.query, chip.targetUrl)}
                    className="inline-flex min-h-11 items-center gap-2 rounded-[var(--radius-md)] border border-white/15 bg-ink-2 px-3.5 py-2 text-small font-semibold text-white transition-colors hover:border-white"
                  >
                    <TrendingUp className="h-4 w-4 text-red" aria-hidden="true" />
                    <span>{chip.label}</span>
                  </button>
                ))}
              </div>
            </section>
          </div>
        ) : showCommittedResults ? (
          /* RECHERCHE VALIDÉE (?q=) : la grille complète, pleine largeur sur ordinateur */
          <section aria-labelledby="committed-results-heading">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 id="committed-results-heading" className="text-h2 text-white">
                {fullResults
                  ? `${fullResults.total} ${fullResults.total > 1 ? 'résultats' : 'résultat'} pour `
                  : 'Résultats pour '}
                <span className="normal-case">«&nbsp;{committedQuery}&nbsp;»</span>
              </h2>
              {fullResults && fullResults.total > 0 && (
                <Link
                  to={`/explorer?q=${encodeURIComponent(committedQuery)}`}
                  viewTransition
                  onClick={() => addRecent(committedQuery)}
                  className="inline-flex min-h-11 items-center gap-2 rounded-[var(--radius-md)] border border-white/20 px-4 text-small font-bold text-white transition-colors hover:border-white"
                >
                  <SlidersHorizontal className="h-4 w-4" aria-hidden="true" />
                  <span>Filtrer dans le catalogue</span>
                </Link>
              )}
            </div>

            {isLoadingResults && !fullResults ? (
              <div className={RESULTS_PANEL_CLASSES}>
                {Array.from({ length: 4 }).map((_, idx) => (
                  <ProductCardSkeleton key={idx} />
                ))}
              </div>
            ) : isResultsError && !fullResults ? (
              <SearchErrorState
                offline={!isOnline}
                onRetry={() => void refetchResults()}
              />
            ) : fullResults && fullResults.items.length > 0 ? (
              <div className={RESULTS_PANEL_CLASSES}>
                {fullResults.items.map((item) => (
                  <ProductCard key={item.id} product={item} />
                ))}
              </div>
            ) : (
              <NoResultState query={committedQuery} onSelectChip={handleSelectTerm} />
            )}
          </section>
        ) : !isOnline && !suggestData ? (
          /* Hors connexion sans résultat enregistré : pas de faux « Aucun article trouvé » */
          <div className="rounded-[var(--radius-md)] border border-white/15 bg-ink-2 px-6 py-12 text-center">
            <WifiOff className="mx-auto h-9 w-9 text-silver" aria-hidden="true" />
            <h2 className="mt-3 text-h2 text-white">Recherche indisponible hors connexion</h2>
            <p className="mt-1.5 text-small text-silver">
              Réessayez au retour du réseau ou parcourez le catalogue déjà enregistré.
            </p>
            <div className="mt-6">
              <Link
                to="/explorer"
                viewTransition
                className="inline-flex min-h-11 items-center gap-2 rounded-[var(--radius-md)] bg-red px-5 py-2.5 text-small font-bold text-white"
              >
                <span>Voir le catalogue</span>
                <ArrowRight className="h-4 w-4" aria-hidden="true" />
              </Link>
            </div>
          </div>
        ) : isSuggestError && !suggestData && !isFetching ? (
          /* Échec de la recherche : message humain et relance, pas de faux « Aucun article trouvé » */
          <SearchErrorState offline={!isOnline} onRetry={() => void refetchSuggest()} />
        ) : !suggestData && isFetching ? (
          /* Premières suggestions en cours : lignes au gabarit des résultats */
          <div aria-hidden="true" className="space-y-3">
            {Array.from({ length: 3 }).map((_, idx) => (
              <div key={idx} className="flex items-center gap-3.5 px-2 py-3">
                <Skeleton tone="dark" className="aspect-[4/5] w-14 shrink-0" />
                <div className="flex-1 space-y-2">
                  <Skeleton tone="dark" className="h-4 w-3/5" />
                  <Skeleton tone="dark" className="h-3 w-1/4" />
                  <Skeleton tone="dark" className="h-4 w-1/3" />
                </div>
              </div>
            ))}
          </div>
        ) : suggestions.length === 0 && !isFetching ? (
          /* ÉTAT VIDE : Aucun résultat pour la requête (§6.1) */
          <NoResultState query={trimmedQuery} onSelectChip={handleSelectTerm} />
        ) : (
          /* ÉTAT 2 : FRAPPE EN DIRECT (>= 2 caractères, §6.1) */
          <div className="space-y-8">
            <section aria-label="Suggestions directes">
              <div className="flex items-center justify-between">
                <span className="text-label text-silver">
                  SUGGESTIONS ({totalMatches})
                </span>
                {isFetching && (
                  <span className="text-caption text-silver">Mise à jour…</span>
                )}
              </div>

              <ul
                id={listboxId}
                role="listbox"
                aria-label="Articles suggérés"
                className="mt-3 divide-y divide-white/10"
              >
                {suggestions.map((product, idx) => {
                  const totalStock = product.totalStock ?? 5;
                  const isSoldOut = totalStock === 0;
                  const isLowStock = !isSoldOut && totalStock <= 2;
                  const isHighlighted = idx === activeIndex;

                  return (
                    <li key={product.id} role="none">
                      {/* L'option est le bouton lui-même (pas de bouton dans une option) */}
                      <button
                        type="button"
                        role="option"
                        id={`search-opt-${product.id}`}
                        aria-selected={isHighlighted}
                        onClick={() =>
                          handleSelectProduct(product.slug, product.name)
                        }
                        className={cn(
                          'flex w-full items-center justify-between gap-3 rounded-[var(--radius-md)] px-2 py-3 text-left transition-colors',
                          isHighlighted ? 'bg-ink-2' : 'hover:bg-ink-2',
                        )}
                      >
                        <div className="flex min-w-0 items-center gap-3.5">
                          {/* Miniature 56×70 px (§6.1) */}
                          <div className="w-14 shrink-0 overflow-hidden rounded-[var(--radius-sm)] bg-ink-2">
                            <SmartImage
                              src={product.image}
                              fallback={product.fallbackImage}
                              alt=""
                              ratio="4/5"
                              className="h-full w-full"
                            />
                          </div>
                          <div className="min-w-0">
                            {/* Nom sur 2 lignes au plus : lisible en entier à 360 px */}
                            <p className="line-clamp-2 text-body font-semibold text-white">
                              <HighlightMatch
                                text={product.name}
                                query={query}
                                highlightClassName="font-extrabold text-white underline decoration-red decoration-2 underline-offset-2"
                              />
                            </p>
                            <p className="mt-0.5 text-caption text-silver">
                              {CATEGORY_LABELS[product.categorySlug] ??
                                product.categorySlug}
                            </p>
                            <Price
                              amount={product.price}
                              className="mt-1 block text-small font-bold text-white"
                            />
                          </div>
                        </div>

                        {/* Pastille de stock seulement quand elle informe : épuisé ou dernières pièces */}
                        {(isSoldOut || isLowStock) && (
                          <div className="shrink-0">
                            {isSoldOut ? (
                              <Badge variant="sold-out" />
                            ) : (
                              <Badge variant="low-stock" lowStockCount={totalStock} />
                            )}
                          </div>
                        )}
                      </button>
                    </li>
                  );
                })}
              </ul>

              {totalMatches > 0 && (
                <div className="mt-4">
                  <button
                    type="button"
                    onClick={goToCatalogResults}
                    className="flex min-h-12 w-full items-center justify-between gap-3 rounded-[var(--radius-md)] bg-red px-5 py-3 text-left text-small font-bold text-white transition-opacity hover:opacity-95"
                  >
                    <span>{seeResultsLabel(totalMatches, trimmedQuery)}</span>
                    <ArrowRight className="h-4 w-4 shrink-0" aria-hidden="true" />
                  </button>
                </div>
              )}
            </section>
          </div>
        )}
      </Container>
    </m.div>
  );
}

function NoResultState({
  query,
  onSelectChip,
}: {
  query: string;
  onSelectChip: (term: string, targetUrl?: string) => void;
}) {
  return (
    <div className="mt-5 rounded-[var(--radius-md)] border border-white/15 bg-ink-2 px-6 py-12 text-center first:mt-0">
      <SearchIcon className="mx-auto h-9 w-9 text-silver" aria-hidden="true" />
      <h2 className="mt-3 text-h2 text-white">
        Aucun article trouvé pour <span className="normal-case">«&nbsp;{query}&nbsp;»</span>
      </h2>
      <p className="mt-1.5 text-small text-silver">
        Vérifiez l&rsquo;orthographe ou essayez l&rsquo;une de nos recherches populaires&nbsp;:
      </p>
      <div className="mt-5 flex flex-wrap justify-center gap-2">
        {POPULAR_SEARCH_CHIPS.map((chip) => (
          <button
            key={chip.label}
            type="button"
            onClick={() => onSelectChip(chip.query, chip.targetUrl)}
            className="inline-flex min-h-11 items-center rounded-[var(--radius-md)] border border-white/20 bg-ink px-3.5 py-2 text-caption font-semibold text-white hover:border-white"
          >
            {chip.label}
          </button>
        ))}
      </div>
      <div className="mt-6">
        <Link
          to="/explorer"
          viewTransition
          className="inline-flex min-h-11 items-center gap-2 rounded-[var(--radius-md)] bg-red px-5 py-2.5 text-small font-bold text-white"
        >
          <span>Explorer tout le catalogue</span>
          <ArrowRight className="h-4 w-4" aria-hidden="true" />
        </Link>
      </div>
    </div>
  );
}

function SearchErrorState({ offline, onRetry }: { offline: boolean; onRetry: () => void }) {
  return (
    <div className="mt-5 rounded-[var(--radius-md)] border border-white/15 bg-ink-2 px-6 py-12 text-center first:mt-0">
      {offline ? (
        <WifiOff className="mx-auto h-9 w-9 text-silver" aria-hidden="true" />
      ) : (
        <AlertCircle className="mx-auto h-9 w-9 text-silver" aria-hidden="true" />
      )}
      <h2 className="mt-3 text-h2 text-white">La recherche n&rsquo;a pas abouti</h2>
      <p className="mt-1.5 text-small text-silver">
        {offline
          ? 'Vous êtes hors connexion. Réessayez au retour du réseau.'
          : 'Vérifiez votre connexion internet et réessayez dans un instant.'}
      </p>
      <button
        type="button"
        onClick={onRetry}
        className="mt-6 inline-flex min-h-11 items-center rounded-[var(--radius-md)] bg-red px-5 py-2.5 text-small font-bold text-white"
      >
        Réessayer
      </button>
    </div>
  );
}
