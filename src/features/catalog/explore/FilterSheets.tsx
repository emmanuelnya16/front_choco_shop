import { Check } from 'lucide-react';
import { useState } from 'react';
import { Button } from '@/components/ui/Button';
import { Sheet } from '@/components/ui/Sheet';
import { useProducts } from '@/features/catalog/api/useCatalogQueries';
import {
  getSizesForCategory,
  PRICE_RANGE_LABELS,
  SORT_OPTION_LABELS,
  type CatalogFiltersState,
} from '@/features/catalog/filters/useCatalogFilters';
import { cn } from '@/lib/utils/cn';
import type {
  CatalogSortOption,
  PriceRangeKey,
  ProductFacets,
} from '@/types/api';

export type ActiveFilterSheet = 'size' | 'price' | 'sort' | 'all' | null;

const PRICE_RANGE_KEYS: PriceRangeKey[] = [
  '0-15000',
  '15000-30000',
  '30000-50000',
  '50000+',
];

const SORT_OPTIONS: CatalogSortOption[] = [
  'popular',
  'newest',
  'price-asc',
  'price-desc',
];

export interface FilterSheetsProps {
  activeSheet: ActiveFilterSheet;
  onClose: () => void;
  filters: CatalogFiltersState;
  facets?: ProductFacets;
  onApplyFilters: (patch: Partial<Omit<CatalogFiltersState, 'category'>>) => void;
}

/**
 * Tiroirs de filtres mobiles (§5.3) :
 * - Sélection préparatoire interne (`staged`) pour Taille, Prix et Tous les filtres
 * - Compteur en direct sur le bouton « Voir X articles » via `useProducts({ ..., pageSize: 1 })`
 * - Application immédiate pour le tiroir « Trier par »
 */
export function FilterSheets({
  activeSheet,
  onClose,
  filters,
  facets,
  onApplyFilters,
}: FilterSheetsProps) {
  if (!activeSheet) return null;

  const titles: Record<Exclude<ActiveFilterSheet, null>, string> = {
    size: 'Filtrer par taille',
    price: 'Fourchette de prix',
    sort: 'Trier par',
    all: 'Filtrer les articles',
  };

  return (
    <Sheet open={Boolean(activeSheet)} onClose={onClose} title={titles[activeSheet]}>
      <FilterSheetBody
        key={activeSheet}
        mode={activeSheet}
        filters={filters}
        facets={facets}
        onClose={onClose}
        onApplyFilters={onApplyFilters}
      />
    </Sheet>
  );
}

function FilterSheetBody({
  mode,
  filters,
  facets,
  onClose,
  onApplyFilters,
}: {
  mode: Exclude<ActiveFilterSheet, null>;
  filters: CatalogFiltersState;
  facets?: ProductFacets;
  onClose: () => void;
  onApplyFilters: (patch: Partial<Omit<CatalogFiltersState, 'category'>>) => void;
}) {
  const [stagedSizes, setStagedSizes] = useState<string[]>(filters.sizes);
  const [stagedPrice, setStagedPrice] = useState<PriceRangeKey | undefined>(
    filters.price,
  );
  const [stagedAvailable, setStagedAvailable] = useState<boolean>(
    filters.available,
  );

  // Requête légère (pageSize: 1) pour obtenir le total exact correspondant à la sélection en cours (§5.3)
  const previewQuery = useProducts(
    mode === 'sort'
      ? undefined
      : {
          category: filters.category,
          sub: filters.sub,
          sizes: stagedSizes.length > 0 ? stagedSizes : undefined,
          price: stagedPrice,
          available: stagedAvailable ? true : undefined,
          look: filters.look,
          q: filters.q,
          pageSize: 1,
        },
  );

  const previewTotal = previewQuery.data?.total ?? 0;
  const previewFacets = previewQuery.data?.facets ?? facets;

  const getSizeFacetCount = (sizeVal: string): number => {
    const entry = previewFacets?.sizes.find(
      (s) => s.value.toUpperCase() === sizeVal.toUpperCase(),
    );
    return entry ? entry.count : 1;
  };

  const getPriceFacetCount = (priceKey: PriceRangeKey): number | undefined => {
    return previewFacets?.priceRanges.find((p) => p.value === priceKey)?.count;
  };

  const toggleStagedSize = (size: string) => {
    setStagedSizes((prev) =>
      prev.includes(size) ? prev.filter((s) => s !== size) : [...prev, size],
    );
  };

  const handleApply = () => {
    if (mode === 'size') {
      onApplyFilters({ sizes: stagedSizes });
    } else if (mode === 'price') {
      onApplyFilters({ price: stagedPrice });
    } else if (mode === 'all') {
      onApplyFilters({
        sizes: stagedSizes,
        price: stagedPrice,
        available: stagedAvailable,
      });
    }
    onClose();
  };

  const handleClearCurrent = () => {
    if (mode === 'size') {
      setStagedSizes([]);
    } else if (mode === 'price') {
      setStagedPrice(undefined);
    } else if (mode === 'all') {
      setStagedSizes([]);
      setStagedPrice(undefined);
      setStagedAvailable(false);
    }
  };

  if (mode === 'sort') {
    return (
      <div role="radiogroup" aria-label="Trier les articles" className="space-y-1.5">
        {SORT_OPTIONS.map((option) => {
          const isSelected = filters.sort === option;
          return (
            <button
              key={option}
              type="button"
              role="radio"
              aria-checked={isSelected}
              onClick={() => {
                onApplyFilters({ sort: option });
                onClose();
              }}
              className={cn(
                'flex min-h-[48px] w-full items-center justify-between rounded-[var(--radius-md)] px-4 py-3 text-left text-body transition-colors',
                isSelected
                  ? 'bg-ink font-bold text-white'
                  : 'bg-surface text-ink hover:bg-silver/40',
              )}
            >
              <span>{SORT_OPTION_LABELS[option]}</span>
              {isSelected && <Check className="h-4 w-4 text-red" aria-hidden="true" />}
            </button>
          );
        })}
      </div>
    );
  }

  const { clothing, shoes } = getSizesForCategory(filters.category);

  return (
    <div className="space-y-6">
      {/* Interrupteur Disponibilité (mode 'all') */}
      {mode === 'all' && (
        <div className="flex items-center justify-between rounded-[var(--radius-md)] border border-silver bg-surface px-4 py-3.5">
          <div>
            <p className="text-small font-bold text-ink">En stock uniquement</p>
            <p className="text-xs text-text-2">
              Masquer les articles momentanément épuisés
            </p>
          </div>
          <button
            type="button"
            role="switch"
            aria-checked={stagedAvailable}
            aria-label="Afficher uniquement les articles en stock"
            onClick={() => setStagedAvailable((v) => !v)}
            className={cn(
              'relative inline-flex h-7 w-12 shrink-0 items-center rounded-[var(--radius-full)] transition-colors',
              stagedAvailable ? 'bg-red' : 'bg-silver',
            )}
          >
            <span
              className={cn(
                'inline-block h-5 w-5 rounded-[var(--radius-full)] bg-white transition-transform',
                stagedAvailable ? 'translate-x-6' : 'translate-x-1',
              )}
            />
          </button>
        </div>
      )}

      {/* Sélection des tailles (mode 'size' ou 'all') */}
      {(mode === 'size' || mode === 'all') && (
        <div className="space-y-4">
          {clothing.length > 0 && (
            <div>
              <p className="text-label text-text-2">TAILLES VÊTEMENTS</p>
              <div className="mt-2.5 grid grid-cols-5 gap-2">
                {clothing.map((size) => {
                  const count = getSizeFacetCount(size);
                  const isSelected = stagedSizes.includes(size);
                  const isDisabled = count === 0 && !isSelected;
                  return (
                    <button
                      key={size}
                      type="button"
                      disabled={isDisabled}
                      onClick={() => toggleStagedSize(size)}
                      aria-pressed={isSelected}
                      className={cn(
                        'flex h-12 flex-col items-center justify-center rounded-[var(--radius-md)] border text-small font-bold transition-colors',
                        isDisabled
                          ? 'cursor-not-allowed border-silver bg-surface text-silver line-through opacity-60'
                          : isSelected
                            ? 'border-ink bg-ink text-white'
                            : 'border-silver bg-white text-ink hover:border-ink',
                      )}
                    >
                      <span>{size}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {shoes.length > 0 && (
            <div>
              <p className="text-label text-text-2">POINTURES CHAUSSURES & BABOUCHES</p>
              <div className="mt-2.5 grid grid-cols-4 gap-2">
                {shoes.map((size) => {
                  const count = getSizeFacetCount(size);
                  const isSelected = stagedSizes.includes(size);
                  const isDisabled = count === 0 && !isSelected;
                  return (
                    <button
                      key={size}
                      type="button"
                      disabled={isDisabled}
                      onClick={() => toggleStagedSize(size)}
                      aria-pressed={isSelected}
                      className={cn(
                        'flex h-12 flex-col items-center justify-center rounded-[var(--radius-md)] border text-small font-bold transition-colors',
                        isDisabled
                          ? 'cursor-not-allowed border-silver bg-surface text-silver line-through opacity-60'
                          : isSelected
                            ? 'border-ink bg-ink text-white'
                            : 'border-silver bg-white text-ink hover:border-ink',
                      )}
                    >
                      <span>{size}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Sélection de la fourchette de prix (mode 'price' ou 'all') */}
      {(mode === 'price' || mode === 'all') && (
        <div>
          <p className="text-label text-text-2">FOURCHETTE DE PRIX</p>
          <div role="radiogroup" aria-label="Fourchette de prix" className="mt-2.5 space-y-2">
            {PRICE_RANGE_KEYS.map((priceKey) => {
              const isSelected = stagedPrice === priceKey;
              const count = getPriceFacetCount(priceKey);
              return (
                <button
                  key={priceKey}
                  type="button"
                  role="radio"
                  aria-checked={isSelected}
                  onClick={() =>
                    setStagedPrice((prev) => (prev === priceKey ? undefined : priceKey))
                  }
                  className={cn(
                    'flex min-h-[48px] w-full items-center justify-between rounded-[var(--radius-md)] border px-4 py-2.5 text-left text-small font-semibold transition-colors',
                    isSelected
                      ? 'border-ink bg-ink text-white'
                      : 'border-silver bg-white text-ink hover:bg-surface',
                  )}
                >
                  <span>{PRICE_RANGE_LABELS[priceKey]}</span>
                  {typeof count === 'number' && (
                    <span
                      className={cn(
                        'text-xs tabular-nums',
                        isSelected ? 'text-silver' : 'text-text-2',
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
      )}

      {/* Pied de tiroir : Tout effacer + Voir X articles */}
      <div className="flex items-center gap-3 pt-2">
        <Button
          variant="outline"
          size="md"
          onClick={handleClearCurrent}
          className="px-4"
        >
          Effacer
        </Button>
        <Button
          variant="primary"
          size="md"
          fullWidth
          disabled={previewTotal === 0}
          onClick={handleApply}
        >
          {previewTotal === 0
            ? 'Aucun article pour ces critères'
            : `Voir ${previewTotal} article${previewTotal > 1 ? 's' : ''}`}
        </Button>
      </div>
    </div>
  );
}
