import { RotateCcw } from 'lucide-react';
import {
  getSizesForCategory,
  PRICE_RANGE_LABELS,
  SUBCATEGORY_LABELS,
  type CatalogFiltersState,
} from '@/features/catalog/filters/useCatalogFilters';
import { cn } from '@/lib/utils/cn';
import type { PriceRangeKey, ProductFacets } from '@/types/api';

const PRICE_RANGE_KEYS: PriceRangeKey[] = [
  '0-15000',
  '15000-30000',
  '30000-50000',
  '50000+',
];

const CATEGORY_SUBCATEGORIES: Record<string, string[]> = {
  vetements: ['t-shirts', 'hoodies', 'pantalons'],
  chaussures: ['sneakers', 'derbies'],
  babouches: ['cuir-lisse', 'croco-embosse'],
};

export interface DesktopFilterSidebarProps {
  filters: CatalogFiltersState;
  facets?: ProductFacets;
  activeCount: number;
  onSelectSub: (sub?: string) => void;
  onToggleSize: (size: string) => void;
  onSelectPrice: (price?: PriceRangeKey) => void;
  onToggleAvailable: (available: boolean) => void;
  onReset: () => void;
}

/**
 * Colonne latérale gauche fixe sur ordinateur (`260 px`, collante sous l'en-tête, §5.2).
 * Expose tous les filtres directement dépliés sans ouvrir de tiroir.
 */
export function DesktopFilterSidebar({
  filters,
  facets,
  activeCount,
  onSelectSub,
  onToggleSize,
  onSelectPrice,
  onToggleAvailable,
  onReset,
}: DesktopFilterSidebarProps) {
  const subcategories = filters.category
    ? CATEGORY_SUBCATEGORIES[filters.category] ?? []
    : [];
  const { clothing, shoes } = getSizesForCategory(filters.category);

  const getSubCount = (subSlug: string): number | undefined =>
    facets?.subCategories.find((s) => s.slug === subSlug)?.count;

  const getSizeCount = (sizeVal: string): number =>
    facets?.sizes.find((s) => s.value.toUpperCase() === sizeVal.toUpperCase())
      ?.count ?? 1;

  const getPriceCount = (priceKey: PriceRangeKey): number | undefined =>
    facets?.priceRanges.find((p) => p.value === priceKey)?.count;

  return (
    <aside
      aria-label="Filtres du catalogue"
      // self-stretch : la colonne a la hauteur de la grille, sinon le bloc collant n'a aucune place pour coller
      className="hidden w-[260px] shrink-0 self-stretch lg:block"
    >
      {/* Sous l’en-tête ordinateur replié (et le bandeau rouge s’il est affiché : --desktop-shell-top) ; défile lui-même s’il dépasse l’écran */}
      <div className="sticky top-[calc(var(--desktop-shell-top)+16px)] max-h-[calc(100dvh-var(--desktop-shell-top)-32px)] space-y-7 overflow-y-auto overscroll-contain rounded-[var(--radius-md)] border border-silver/70 bg-white p-5">
        <div className="flex items-center justify-between">
          <h2 className="text-label text-ink">FILTRES</h2>
          {activeCount > 0 && (
            <button
              type="button"
              onClick={onReset}
              className="inline-flex items-center gap-1 text-xs font-bold text-red hover:underline"
            >
              <RotateCcw className="h-3 w-3" aria-hidden="true" />
              <span>Réinitialiser ({activeCount})</span>
            </button>
          )}
        </div>

        {/* 1. Sous-catégorie (si une catégorie est active) */}
        {subcategories.length > 0 && (
          <div className="border-t border-silver/50 pt-5">
            <h3 className="text-label text-text-2">SOUS-CATÉGORIE</h3>
            <ul className="mt-3 space-y-1.5">
              <li>
                <button
                  type="button"
                  onClick={() => onSelectSub(undefined)}
                  className={cn(
                    'flex w-full items-center justify-between rounded-[var(--radius-sm)] px-2.5 py-1.5 text-left text-small transition-colors',
                    !filters.sub
                      ? 'bg-ink font-semibold text-white'
                      : 'text-ink hover:bg-surface',
                  )}
                >
                  <span>Toutes</span>
                </button>
              </li>
              {subcategories.map((subSlug) => {
                const active = filters.sub === subSlug;
                const count = getSubCount(subSlug);
                return (
                  <li key={subSlug}>
                    <button
                      type="button"
                      onClick={() => onSelectSub(active ? undefined : subSlug)}
                      className={cn(
                        'flex w-full items-center justify-between rounded-[var(--radius-sm)] px-2.5 py-1.5 text-left text-small transition-colors',
                        active
                          ? 'bg-ink font-semibold text-white'
                          : 'text-ink hover:bg-surface',
                      )}
                    >
                      <span>{SUBCATEGORY_LABELS[subSlug] ?? subSlug}</span>
                      {typeof count === 'number' && (
                        <span
                          className={cn(
                            'text-xs tabular-nums',
                            active ? 'text-silver' : 'text-text-2',
                          )}
                        >
                          {count}
                        </span>
                      )}
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>
        )}

        {/* 2. Disponibilité */}
        <div className="border-t border-silver/50 pt-5">
          <div className="flex items-center justify-between gap-2">
            <span className="text-small font-semibold text-ink">
              En stock uniquement
            </span>
            <button
              type="button"
              role="switch"
              aria-checked={filters.available}
              aria-label="En stock uniquement"
              onClick={() => onToggleAvailable(!filters.available)}
              className={cn(
                'relative inline-flex h-6 w-11 shrink-0 items-center rounded-[var(--radius-full)] transition-colors',
                filters.available ? 'bg-red' : 'bg-silver',
              )}
            >
              <span
                className={cn(
                  'inline-block h-4 w-4 rounded-[var(--radius-full)] bg-white transition-transform',
                  filters.available ? 'translate-x-6' : 'translate-x-1',
                )}
              />
            </button>
          </div>
        </div>

        {/* 3. Grille de tailles */}
        <div className="space-y-4 border-t border-silver/50 pt-5">
          {clothing.length > 0 && (
            <div>
              <h3 className="text-label text-text-2">TAILLE VÊTEMENTS</h3>
              <div className="mt-2.5 grid grid-cols-4 gap-1.5">
                {clothing.map((size) => {
                  const count = getSizeCount(size);
                  const active = filters.sizes.includes(size);
                  const disabled = count === 0 && !active;
                  return (
                    <button
                      key={size}
                      type="button"
                      disabled={disabled}
                      onClick={() => onToggleSize(size)}
                      aria-pressed={active}
                      className={cn(
                        'flex h-9 items-center justify-center rounded-[var(--radius-sm)] border text-xs font-bold transition-colors',
                        disabled
                          ? 'cursor-not-allowed border-silver bg-surface text-silver line-through opacity-60'
                          : active
                            ? 'border-ink bg-ink text-white'
                            : 'border-silver bg-white text-ink hover:border-ink',
                      )}
                    >
                      {size}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {shoes.length > 0 && (
            <div>
              <h3 className="text-label text-text-2">POINTURE</h3>
              <div className="mt-2.5 grid grid-cols-4 gap-1.5">
                {shoes.map((size) => {
                  const count = getSizeCount(size);
                  const active = filters.sizes.includes(size);
                  const disabled = count === 0 && !active;
                  return (
                    <button
                      key={size}
                      type="button"
                      disabled={disabled}
                      onClick={() => onToggleSize(size)}
                      aria-pressed={active}
                      className={cn(
                        'flex h-9 items-center justify-center rounded-[var(--radius-sm)] border text-xs font-bold transition-colors',
                        disabled
                          ? 'cursor-not-allowed border-silver bg-surface text-silver line-through opacity-60'
                          : active
                            ? 'border-ink bg-ink text-white'
                            : 'border-silver bg-white text-ink hover:border-ink',
                      )}
                    >
                      {size}
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* 4. Fourchette de prix */}
        <div className="border-t border-silver/50 pt-5">
          <h3 className="text-label text-text-2">FOURCHETTE DE PRIX</h3>
          <div className="mt-2.5 space-y-1.5">
            {PRICE_RANGE_KEYS.map((priceKey) => {
              const active = filters.price === priceKey;
              const count = getPriceCount(priceKey);
              return (
                <button
                  key={priceKey}
                  type="button"
                  onClick={() => onSelectPrice(active ? undefined : priceKey)}
                  className={cn(
                    'flex w-full items-center justify-between rounded-[var(--radius-sm)] px-2.5 py-2 text-left text-xs font-semibold transition-colors',
                    active
                      ? 'bg-ink text-white'
                      : 'text-ink hover:bg-surface',
                  )}
                >
                  <span>{PRICE_RANGE_LABELS[priceKey]}</span>
                  {typeof count === 'number' && (
                    <span
                      className={cn(
                        'tabular-nums',
                        active ? 'text-silver' : 'text-text-2',
                      )}
                    >
                      ({count})
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </aside>
  );
}
