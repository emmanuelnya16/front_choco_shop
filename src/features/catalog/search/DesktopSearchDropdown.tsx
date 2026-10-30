import { ArrowRight, Clock, Search, TrendingUp, X } from 'lucide-react';
import { useEffect, useId, useRef, useState, type KeyboardEvent } from 'react';
import { Link, useNavigate } from 'react-router';
import { Badge } from '@/components/ui/Badge';
import { Price } from '@/components/ui/Primitives';
import { SmartImage } from '@/components/ui/SmartImage';
import {
  useCategories,
  useSearchSuggest,
} from '@/features/catalog/api/useCatalogQueries';
import { HighlightMatch } from '@/features/catalog/search/HighlightMatch';
import {
  POPULAR_SEARCH_CHIPS,
  useRecentSearches,
} from '@/features/catalog/search/recentSearches';
import { cn } from '@/lib/utils/cn';

const CATEGORY_LABELS: Record<string, string> = {
  vetements: 'Vêtements',
  chaussures: 'Chaussures',
  babouches: 'Babouches',
};

export interface DesktopSearchDropdownProps {
  query: string;
  onQueryChange: (q: string) => void;
  open: boolean;
  onClose: () => void;
}

/**
 * Panneau déroulant de recherche sur ordinateur (`640 px`, §6.2) :
 * S'ouvre sous le champ de recherche de l'en-tête avec un voile léger sur le reste de la page.
 */
export function DesktopSearchDropdown({
  query,
  onQueryChange,
  open,
  onClose,
}: DesktopSearchDropdownProps) {
  const navigate = useNavigate();
  const listboxId = useId();
  const containerRef = useRef<HTMLDivElement>(null);

  const {
    searches: recentSearches,
    add: addRecent,
    remove: removeRecent,
    clear: clearRecent,
  } = useRecentSearches();
  const { data: categoriesData } = useCategories();
  const { data: suggestData, isFetching } = useSearchSuggest(query, 250);

  const [activeIndex, setActiveIndex] = useState<number>(-1);

  const suggestions = suggestData?.products ?? [];
  const totalMatches = suggestData?.totalProducts ?? 0;
  const hasTypedEnough = query.trim().length >= 2;
  const categories = categoriesData ?? [];

  useEffect(() => {
    if (!open) return;
    const handleKeyDown = (event: globalThis.KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [open, onClose]);

  if (!open) return null;

  const handleSelectTerm = (term: string, targetUrl?: string) => {
    addRecent(term);
    onClose();
    if (targetUrl) {
      navigate(targetUrl, { viewTransition: true });
    } else {
      navigate(`/explorer?q=${encodeURIComponent(term.trim())}`, {
        viewTransition: true,
      });
    }
  };

  const handleSelectProduct = (slug: string, name: string) => {
    addRecent(name);
    onClose();
    navigate(`/produit/${slug}`, { viewTransition: true });
  };

  const handleKeyDownInput = (e: KeyboardEvent<HTMLDivElement>) => {
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
    <>
      {/* Voile léger sur la page sous l'en-tête */}
      <div
        aria-hidden="true"
        onClick={onClose}
        className="fixed inset-0 top-[72px] z-30 bg-[var(--color-scrim-40)]"
      />

      <div
        ref={containerRef}
        id={listboxId}
        role="listbox"
        aria-label="Suggestions de recherche"
        onKeyDown={handleKeyDownInput}
        className="absolute top-[calc(100%+8px)] left-1/2 z-50 w-[640px] -translate-x-1/2 overflow-hidden rounded-[var(--radius-md)] border border-silver bg-white p-5 text-ink shadow-[var(--shadow-sheet)]"
      >
        {!hasTypedEnough ? (
          <div className="space-y-6">
            {/* 1. Recherches récentes */}
            {recentSearches.length > 0 && (
              <div>
                <div className="flex items-center justify-between">
                  <span className="text-label text-text-2">RECHERCHES RÉCENTES</span>
                  <button
                    type="button"
                    onClick={clearRecent}
                    className="text-xs font-bold text-red hover:underline"
                  >
                    Effacer
                  </button>
                </div>
                <div className="mt-2.5 flex flex-wrap gap-2">
                  {recentSearches.map((item) => (
                    <div
                      key={item}
                      className="inline-flex items-center gap-1.5 rounded-[var(--radius-md)] border border-silver bg-surface px-3 py-1.5 text-xs font-semibold text-ink"
                    >
                      <button
                        type="button"
                        onClick={() => {
                          onQueryChange(item);
                          handleSelectTerm(item);
                        }}
                        className="inline-flex items-center gap-1.5 hover:text-red"
                      >
                        <Clock className="h-3.5 w-3.5 text-text-2" aria-hidden="true" />
                        <span>{item}</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => removeRecent(item)}
                        aria-label={`Supprimer ${item} des recherches récentes`}
                        className="ml-1 text-text-2 hover:text-ink"
                      >
                        <X className="h-3 w-3" aria-hidden="true" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* 2. Parcourir par catégorie */}
            {categories.length > 0 && (
              <div>
                <span className="text-label text-text-2">PARCOURIR PAR CATÉGORIE</span>
                <div className="mt-2.5 grid grid-cols-3 gap-3">
                  {categories.map((cat) => (
                    <Link
                      key={cat.id}
                      to={`/explorer/${cat.slug}`}
                      viewTransition
                      onClick={onClose}
                      className="group flex items-center gap-3 rounded-[var(--radius-md)] border border-silver/70 bg-surface p-2 transition-colors hover:border-ink"
                    >
                      <div className="h-12 w-10 shrink-0 overflow-hidden rounded-[var(--radius-sm)] bg-white">
                        <SmartImage
                          src={cat.coverImage}
                          fallback={cat.fallbackImage}
                          alt={cat.name}
                          ratio="4/5"
                          className="h-full w-full"
                        />
                      </div>
                      <div className="min-w-0">
                        <p className="truncate text-small font-bold text-ink group-hover:text-red">
                          {cat.name}
                        </p>
                        <p className="text-xs text-text-2">
                          {cat.productCount} articles
                        </p>
                      </div>
                    </Link>
                  ))}
                </div>
              </div>
            )}

            {/* 3. Recherches populaires */}
            <div>
              <span className="text-label text-text-2">RECHERCHES POPULAIRES</span>
              <div className="mt-2.5 flex flex-wrap gap-2">
                {POPULAR_SEARCH_CHIPS.map((chip) => (
                  <button
                    key={chip.label}
                    type="button"
                    onClick={() => handleSelectTerm(chip.query, chip.targetUrl)}
                    className="inline-flex items-center gap-1.5 rounded-[var(--radius-md)] border border-silver bg-white px-3 py-1.5 text-xs font-semibold text-ink transition-colors hover:border-ink hover:bg-surface"
                  >
                    <TrendingUp className="h-3.5 w-3.5 text-red" aria-hidden="true" />
                    <span>{chip.label}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>
        ) : suggestions.length === 0 && !isFetching ? (
          /* Aucun résultat */
          <div className="py-6 text-center">
            <Search className="mx-auto h-7 w-7 text-text-2" aria-hidden="true" />
            <p className="mt-2 text-body font-bold text-ink">
              Aucun article trouvé pour « {query.trim()} »
            </p>
            <p className="mt-1 text-xs text-text-2">
              Essayez un terme plus court ou choisissez une suggestion populaire :
            </p>
            <div className="mt-4 flex flex-wrap justify-center gap-2">
              {POPULAR_SEARCH_CHIPS.map((chip) => (
                <button
                  key={chip.label}
                  type="button"
                  onClick={() => handleSelectTerm(chip.query, chip.targetUrl)}
                  className="rounded-[var(--radius-md)] border border-silver bg-surface px-3 py-1.5 text-xs font-semibold text-ink hover:border-ink"
                >
                  {chip.label}
                </button>
              ))}
            </div>
          </div>
        ) : (
          /* Suggestions en direct */
          <div>
            <div className="flex items-center justify-between pb-2">
              <span className="text-label text-text-2">ARTICLES SUGGÉRÉS</span>
              {isFetching && (
                <span className="text-xs text-text-2">Recherche…</span>
              )}
            </div>

            <ul className="divide-y divide-silver/40">
              {suggestions.map((product, idx) => {
                const totalStock = product.totalStock ?? 5;
                const isSoldOut = totalStock === 0;
                const isLowStock = !isSoldOut && totalStock <= 2;
                const isHighlighted = idx === activeIndex;

                return (
                  <li key={product.id}>
                    <button
                      type="button"
                      role="option"
                      aria-selected={isHighlighted}
                      onClick={() => handleSelectProduct(product.slug, product.name)}
                      className={cn(
                        'flex w-full items-center justify-between gap-4 rounded-[var(--radius-sm)] px-2 py-2.5 text-left transition-colors',
                        isHighlighted ? 'bg-surface' : 'hover:bg-surface',
                      )}
                    >
                      <div className="flex min-w-0 items-center gap-3.5">
                        <div className="h-[70px] w-[56px] shrink-0 overflow-hidden rounded-[var(--radius-sm)] bg-surface">
                          <SmartImage
                            src={product.image}
                            fallback={product.fallbackImage}
                            alt={product.name}
                            ratio="4/5"
                            className="h-full w-full"
                          />
                        </div>
                        <div className="min-w-0">
                          <p className="truncate text-small font-semibold text-ink">
                            <HighlightMatch text={product.name} query={query} />
                          </p>
                          <p className="mt-0.5 text-xs text-text-2">
                            {CATEGORY_LABELS[product.categorySlug] ??
                              product.categorySlug}
                          </p>
                          <Price
                            amount={product.price}
                            className="mt-1 block text-small text-ink"
                          />
                        </div>
                      </div>

                      <div className="shrink-0">
                        {isSoldOut ? (
                          <Badge variant="sold-out" />
                        ) : isLowStock ? (
                          <Badge variant="low-stock" lowStockCount={totalStock} />
                        ) : (
                          <span className="text-xs font-semibold text-success">
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
              <div className="mt-3 border-t border-silver pt-3">
                <button
                  type="button"
                  onClick={() => handleSelectTerm(query.trim())}
                  className="flex w-full items-center justify-between rounded-[var(--radius-md)] bg-ink px-4 py-2.5 text-small font-bold text-white transition-colors hover:bg-ink-2"
                >
                  <span>
                    Voir les {totalMatches} résultat{totalMatches > 1 ? 's' : ''} pour «{' '}
                    {query.trim()} »
                  </span>
                  <ArrowRight className="h-4 w-4" aria-hidden="true" />
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </>
  );
}
