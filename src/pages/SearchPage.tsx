import {
  ArrowRight,
  Clock,
  Search as SearchIcon,
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
import { Container, Price } from '@/components/ui/Primitives';
import { ProductCard } from '@/components/ui/ProductCard';
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
import { useOnlineStatus } from '@/lib/hooks/useOnlineStatus';
import { cn } from '@/lib/utils/cn';
import { useReducedMotionPref } from '@/motion/useReducedMotionPref';
import { useUiStore } from '@/stores/uiStore';

const CATEGORY_LABELS: Record<string, string> = {
  vetements: 'Vêtements',
  chaussures: 'Chaussures',
  babouches: 'Babouches',
};

/**
 * Page Recherche plein écran (`/recherche`, §6.1) :
 * - S'ouvre sur mobile en plein écran sombre (`bg-ink`) par expansion circulaire (`clip-path: circle(...)`)
 *   depuis les coordonnées de l'icône loupe touchée dans l'en-tête.
 * - Comprend les deux états : Avant la frappe (< 2 caractères) et Frappe en direct (>= 2 caractères, debounce 250 ms).
 * - Permet aussi d'afficher la grille complète des résultats lorsqu'une requête `?q=` est soumise.
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
  const { data: suggestData, isFetching } = useSearchSuggest(query, 250);
  const isOnline = useOnlineStatus();

  // Si un paramètre `?q=` est validé dans l'URL, charge aussi la grille complète
  const committedQuery = searchParams.get('q')?.trim() ?? '';
  const { data: fullResults } = useProducts(
    committedQuery.length >= 2
      ? { q: committedQuery, pageSize: 24 }
      : undefined,
  );

  const suggestions = suggestData?.products ?? [];
  const totalMatches = suggestData?.totalProducts ?? 0;
  const hasTypedEnough = query.trim().length >= 2;
  const categories = categoriesData ?? [];

  useEffect(() => {
    document.title = committedQuery
      ? `Recherche “${committedQuery}” — DR Choco L'Incompris`
      : "Rechercher un article — DR Choco L'Incompris";
  }, [committedQuery]);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const originX = searchOrigin ? `${searchOrigin.x}px` : 'calc(100% - 64px)';
  const originY = searchOrigin ? `${searchOrigin.y}px` : '28px';

  const handleCancel = () => {
    if (window.history.length > 2) {
      navigate(-1);
    } else {
      navigate('/explorer', { viewTransition: true });
    }
  };

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    const trimmed = query.trim();
    if (trimmed.length >= 2) {
      addRecent(trimmed);
      setSearchParams({ q: trimmed }, { replace: true });
    }
  };

  const handleSelectTerm = (term: string, targetUrl?: string) => {
    const cleaned = term.trim();
    addRecent(cleaned);
    if (targetUrl) {
      navigate(targetUrl, { viewTransition: true });
      return;
    }
    setQuery(cleaned);
    setSearchParams({ q: cleaned }, { replace: true });
  };

  const handleSelectProduct = (slug: string, name: string) => {
    addRecent(name);
    navigate(`/produit/${slug}`, { viewTransition: true });
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Escape') {
      handleCancel();
      return;
    }
    if (!hasTypedEnough || suggestions.length === 0) return;

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
      transition={{ duration: 0.38, ease: [0.22, 1, 0.36, 1] }}
      className="min-h-dvh bg-ink pb-24 text-white"
    >
      {/* Barre de recherche en haut (52 px de haut, §6.1) */}
      <div className="sticky top-0 z-sticky border-b border-white/10 bg-ink/95 py-3 backdrop-blur-md">
        <Container className="flex items-center gap-3">
          <form onSubmit={handleSubmit} role="search" className="relative flex-1">
            <SearchIcon
              className="pointer-events-none absolute top-1/2 left-4 h-5 w-5 -translate-y-1/2 text-silver"
              aria-hidden="true"
            />
            <input
              ref={inputRef}
              type="search"
              role="combobox"
              aria-expanded={hasTypedEnough}
              aria-controls={listboxId}
              aria-activedescendant={
                activeIndex >= 0 && suggestions[activeIndex]
                  ? `search-opt-${suggestions[activeIndex].id}`
                  : undefined
              }
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setActiveIndex(-1);
              }}
              onKeyDown={handleKeyDown}
              placeholder="Rechercher un t-shirt, une babouche, une taille…"
              aria-label="Rechercher un article dans le catalogue"
              className="h-[52px] w-full rounded-[var(--radius-md)] border border-white/15 bg-ink-2 pr-11 pl-12 text-body text-white placeholder:text-grey focus:border-white focus:outline-none"
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
                className="absolute top-1/2 right-3 inline-flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-[var(--radius-full)] text-silver hover:text-white"
              >
                <X className="h-4 w-4" aria-hidden="true" />
              </button>
            )}
          </form>

          <button
            type="button"
            onClick={handleCancel}
            className="shrink-0 px-2 py-2 text-small font-bold text-silver hover:text-white"
          >
            Annuler
          </button>
        </Container>
      </div>

      <Container className="pt-6">
        {/* Recherche en direct bloquée hors connexion, avec explication (M6 §6.3) */}
        {!isOnline && (
          <p
            role="status"
            className="mb-6 flex items-start gap-2.5 rounded-[var(--radius-md)] border border-white/15 bg-ink-2 px-4 py-3 text-small text-white"
          >
            <WifiOff className="mt-0.5 h-4 w-4 shrink-0 text-silver" aria-hidden="true" />
            <span>
              Hors connexion : la recherche en direct reprendra au retour du réseau. Les articles
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
                    className="text-xs font-bold text-white underline underline-offset-2 hover:text-silver"
                  >
                    Effacer
                  </button>
                </div>

                <ul className="mt-3 divide-y divide-white/10">
                  {recentSearches.map((item) => (
                    <li
                      key={item}
                      className="flex items-center justify-between py-2.5"
                    >
                      <button
                        type="button"
                        onClick={() => handleSelectTerm(item)}
                        className="flex flex-1 items-center gap-3 text-left text-body text-white hover:text-silver"
                      >
                        <Clock className="h-4 w-4 text-grey" aria-hidden="true" />
                        <span>{item}</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => removeRecent(item)}
                        aria-label={`Supprimer ${item} de l'historique`}
                        className="inline-flex h-8 w-8 items-center justify-center rounded-[var(--radius-full)] text-grey hover:text-white"
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
                      <div className="h-14 w-12 shrink-0 overflow-hidden rounded-[var(--radius-sm)] bg-ink">
                        <SmartImage
                          src={cat.coverImage}
                          fallback={cat.fallbackImage}
                          alt={cat.name}
                          ratio="4/5"
                          className="h-full w-full"
                        />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-h3 text-white">{cat.name}</p>
                        <p className="text-xs text-silver">
                          {cat.productCount} pièces disponibles
                        </p>
                      </div>
                      <ArrowRight
                        className="h-4 w-4 text-silver transition-transform group-hover:translate-x-1 group-hover:text-white"
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
                    className="inline-flex min-h-[40px] items-center gap-2 rounded-[var(--radius-md)] border border-white/15 bg-ink-2 px-3.5 py-2 text-small font-semibold text-white transition-colors hover:border-white"
                  >
                    <TrendingUp className="h-4 w-4 text-red" aria-hidden="true" />
                    <span>{chip.label}</span>
                  </button>
                ))}
              </div>
            </section>
          </div>
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
                className="inline-flex min-h-[44px] items-center gap-2 rounded-[var(--radius-md)] bg-red px-5 py-2.5 text-small font-bold text-white"
              >
                <span>Voir le catalogue</span>
                <ArrowRight className="h-4 w-4" aria-hidden="true" />
              </Link>
            </div>
          </div>
        ) : suggestions.length === 0 && !isFetching ? (
          /* ÉTAT VIDE : Aucun résultat pour la requête (§6.1) */
          <div className="rounded-[var(--radius-md)] border border-white/15 bg-ink-2 px-6 py-12 text-center">
            <SearchIcon className="mx-auto h-9 w-9 text-silver" aria-hidden="true" />
            <h2 className="mt-3 text-h2 text-white">
              Aucun article trouvé pour « {query.trim()} »
            </h2>
            <p className="mt-1.5 text-small text-silver">
              Vérifiez l&rsquo;orthographe ou essayez l&rsquo;une de nos recherches
              populaires :
            </p>
            <div className="mt-5 flex flex-wrap justify-center gap-2">
              {POPULAR_SEARCH_CHIPS.map((chip) => (
                <button
                  key={chip.label}
                  type="button"
                  onClick={() => handleSelectTerm(chip.query, chip.targetUrl)}
                  className="rounded-[var(--radius-md)] border border-white/20 bg-ink px-3.5 py-2 text-xs font-semibold text-white hover:border-white"
                >
                  {chip.label}
                </button>
              ))}
            </div>
            <div className="mt-6">
              <Link
                to="/explorer"
                viewTransition
                className="inline-flex min-h-[44px] items-center gap-2 rounded-[var(--radius-md)] bg-red px-5 py-2.5 text-small font-bold text-white"
              >
                <span>Explorer tout le catalogue</span>
                <ArrowRight className="h-4 w-4" aria-hidden="true" />
              </Link>
            </div>
          </div>
        ) : (
          /* ÉTAT 2 : FRAPPE EN DIRECT (>= 2 caractères, §6.1) */
          <div className="space-y-8">
            <section aria-label="Suggestions directes">
              <div className="flex items-center justify-between">
                <span className="text-label text-silver">
                  SUGGESTIONS ({totalMatches})
                </span>
                {isFetching && (
                  <span className="text-xs text-silver">Mise à jour…</span>
                )}
              </div>

              <ul
                id={listboxId}
                role="listbox"
                className="mt-3 divide-y divide-white/10"
              >
                {suggestions.map((product, idx) => {
                  const totalStock = product.totalStock ?? 5;
                  const isSoldOut = totalStock === 0;
                  const isLowStock = !isSoldOut && totalStock <= 2;
                  const isHighlighted = idx === activeIndex;

                  return (
                    <li
                      key={product.id}
                      id={`search-opt-${product.id}`}
                      role="option"
                      aria-selected={isHighlighted}
                    >
                      <button
                        type="button"
                        onClick={() =>
                          handleSelectProduct(product.slug, product.name)
                        }
                        className={cn(
                          'flex w-full items-center justify-between gap-4 rounded-[var(--radius-md)] px-2 py-3 text-left transition-colors',
                          isHighlighted ? 'bg-ink-2' : 'hover:bg-ink-2',
                        )}
                      >
                        <div className="flex min-w-0 items-center gap-3.5">
                          {/* Miniature 56×70 px (§6.1) */}
                          <div className="h-[70px] w-[56px] shrink-0 overflow-hidden rounded-[var(--radius-sm)] bg-ink-2">
                            <SmartImage
                              src={product.image}
                              fallback={product.fallbackImage}
                              alt={product.name}
                              ratio="4/5"
                              className="h-full w-full"
                            />
                          </div>
                          <div className="min-w-0">
                            <p className="truncate text-body font-semibold text-white">
                              <HighlightMatch
                                text={product.name}
                                query={query}
                                highlightClassName="font-extrabold text-white underline decoration-red decoration-2 underline-offset-2"
                              />
                            </p>
                            <p className="mt-0.5 text-xs text-silver">
                              {CATEGORY_LABELS[product.categorySlug] ??
                                product.categorySlug}
                            </p>
                            <Price
                              amount={product.price}
                              className="mt-1 block text-small text-white"
                            />
                          </div>
                        </div>

                        <div className="shrink-0">
                          {isSoldOut ? (
                            <Badge variant="sold-out" />
                          ) : isLowStock ? (
                            <Badge variant="low-stock" lowStockCount={totalStock} />
                          ) : (
                            <span className="rounded-[var(--radius-sm)] bg-white/10 px-2.5 py-1 text-xs font-semibold text-white">
                              En stock
                            </span>
                          )}
                        </div>
                      </button>
                    </li>
                  );
                })}
              </ul>

              {totalMatches > 0 && (
                <div className="mt-4">
                  <button
                    type="button"
                    onClick={() => {
                      addRecent(query.trim());
                      navigate(
                        `/explorer?q=${encodeURIComponent(query.trim())}`,
                        { viewTransition: true },
                      );
                    }}
                    className="flex min-h-[48px] w-full items-center justify-between rounded-[var(--radius-md)] bg-red px-5 py-3 text-small font-bold text-white transition-opacity hover:opacity-95"
                  >
                    <span>
                      Voir les {totalMatches} résultat
                      {totalMatches > 1 ? 's' : ''} pour « {query.trim()} »
                    </span>
                    <ArrowRight className="h-4 w-4" aria-hidden="true" />
                  </button>
                </div>
              )}
            </section>

            {/* Si l'utilisateur a validé la recherche avec Entrée (?q=), affiche aussi la grille complète */}
            {committedQuery && fullResults && fullResults.items.length > 0 && (
              <section
                aria-labelledby="committed-results-heading"
                className="rounded-[var(--radius-md)] bg-white p-4 text-ink sm:p-6"
              >
                <h2 id="committed-results-heading" className="text-h2 text-ink">
                  TOUS LES RÉSULTATS POUR « {committedQuery.toUpperCase()} » (
                  {fullResults.total})
                </h2>
                <div className="mt-4 grid grid-cols-2 gap-x-3 gap-y-5 lg:grid-cols-4 lg:gap-6">
                  {fullResults.items.map((item) => (
                    <ProductCard key={item.id} product={item} />
                  ))}
                </div>
              </section>
            )}
          </div>
        )}
      </Container>
    </m.div>
  );
}
