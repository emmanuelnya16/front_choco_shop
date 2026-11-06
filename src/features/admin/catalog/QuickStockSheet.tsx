import { CheckCircle2, Minus, Plus, RotateCcw } from 'lucide-react';
import { useState } from 'react';
import { Button } from '@/components/ui/Button';
import { Sheet } from '@/components/ui/Sheet';
import { useAdminQuickStockUpdate } from '@/features/admin/api/useAdminQueries';
import { cn } from '@/lib/utils/cn';
import { useToastStore } from '@/stores/toastStore';
import type { Product } from '@/types/domain';

export interface QuickStockSheetProps {
  product: Product | null;
  onClose: () => void;
}

export function QuickStockSheet({ product, onClose }: QuickStockSheetProps) {
  const showToast = useToastStore((s) => s.show);
  const quickStockMutation = useAdminQuickStockUpdate();

  const [draftStocks, setDraftStocks] = useState<Record<string, number>>(() => {
    if (!product) return {};
    return Object.fromEntries(product.variants.map((v) => [v.id, v.stock]));
  });

  if (!product) return null;

  const getStock = (variantId: string, fallback: number): number => {
    return draftStocks[variantId] !== undefined ? draftStocks[variantId] : fallback;
  };

  const setVariantStock = (variantId: string, value: number) => {
    const clamped = Math.max(0, Math.min(999, Math.round(Number(value) || 0)));
    setDraftStocks((prev) => ({
      ...prev,
      [variantId]: clamped,
    }));
  };

  const handleSetAllZero = () => {
    const next: Record<string, number> = {};
    for (const v of product.variants) {
      next[v.id] = 0;
    }
    setDraftStocks(next);
  };

  const handleSave = async () => {
    const variantsPayload = product.variants.map((v) => ({
      variantId: v.id,
      stock: getStock(v.id, v.stock),
    }));

    try {
      await quickStockMutation.mutateAsync({
        productId: product.id,
        variants: variantsPayload,
      });
      showToast({
        message: 'Stocks mis à jour',
        subtitle: product.name,
      });
      onClose();
    } catch {
      showToast({
        message: 'Impossible d’enregistrer les stocks.',
      });
    }
  };

  const colorMap = new Map(product.colors.map((c) => [c.code, c]));

  return (
    <Sheet
      open={Boolean(product)}
      onClose={onClose}
      title={`Stock rapide · ${product.name}`}
    >
      <div className="space-y-4 pb-4">
        <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-text-2">
          <span>Ajustez les quantités disponibles par couleur et par taille.</span>
          <button
            type="button"
            onClick={handleSetAllZero}
            className="inline-flex min-h-9 items-center gap-1 rounded-[var(--radius-sm)] px-2 font-semibold text-danger hover:bg-surface"
          >
            <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" />
            <span>Tout mettre à 0 (épuisé)</span>
          </button>
        </div>

        <ul className="divide-y divide-silver rounded-[var(--radius-md)] border border-silver bg-white">
          {product.variants.map((variant) => {
            const color = colorMap.get(variant.colorCode);
            const currentStock = getStock(variant.id, variant.stock);

            return (
              <li
                key={variant.id}
                className="flex items-center justify-between gap-3 px-3.5 py-2.5"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span
                      className="inline-block h-3.5 w-3.5 shrink-0 rounded-[var(--radius-full)] border border-silver"
                      style={{ backgroundColor: color?.hex ?? '#1A1A18' }}
                      aria-hidden="true"
                    />
                    <span className="text-small font-semibold text-ink">
                      {color?.name ?? variant.colorCode}
                    </span>
                    <span className="rounded-[var(--radius-sm)] bg-surface px-2 py-0.5 font-mono text-xs font-bold text-ink">
                      {variant.size}
                    </span>
                  </div>
                  <p className="mt-0.5 text-xs text-text-2">
                    {currentStock === 0 ? (
                      <span className="font-semibold text-danger">Rupture (0)</span>
                    ) : currentStock <= 2 ? (
                      <span className="font-semibold text-ink">
                        Stock faible ({currentStock})
                      </span>
                    ) : (
                      <span>En stock ({currentStock})</span>
                    )}
                  </p>
                </div>

                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => setVariantStock(variant.id, currentStock - 1)}
                    disabled={currentStock <= 0}
                    aria-label={`Diminuer le stock de ${color?.name ?? variant.colorCode} ${variant.size}`}
                    className="inline-flex h-11 w-11 items-center justify-center rounded-[var(--radius-md)] border border-silver bg-surface text-ink transition-colors hover:border-ink disabled:opacity-40"
                  >
                    <Minus className="h-4 w-4" aria-hidden="true" />
                  </button>

                  <input
                    type="number"
                    min={0}
                    max={999}
                    aria-label={`Stock ${color?.name ?? variant.colorCode} taille ${variant.size}`}
                    value={currentStock}
                    onChange={(e) => setVariantStock(variant.id, Number(e.target.value))}
                    className={cn(
                      'h-11 w-16 rounded-[var(--radius-md)] border text-center font-mono text-small font-bold tabular-nums focus:border-ink focus:outline-none',
                      currentStock === 0
                        ? 'border-danger bg-surface text-danger'
                        : 'border-silver bg-white text-ink',
                    )}
                  />

                  <button
                    type="button"
                    onClick={() => setVariantStock(variant.id, currentStock + 1)}
                    aria-label={`Augmenter le stock de ${color?.name ?? variant.colorCode} ${variant.size}`}
                    className="inline-flex h-11 w-11 items-center justify-center rounded-[var(--radius-md)] border border-silver bg-surface text-ink transition-colors hover:border-ink"
                  >
                    <Plus className="h-4 w-4" aria-hidden="true" />
                  </button>
                </div>
              </li>
            );
          })}
        </ul>

        <div className="flex flex-col-reverse gap-2.5 pt-2 sm:flex-row sm:justify-end">
          <Button variant="ghost" size="md" onClick={onClose}>
            Annuler
          </Button>
          <Button
            variant="primary"
            size="md"
            loading={quickStockMutation.isPending}
            onClick={() => void handleSave()}
            iconLeft={<CheckCircle2 className="h-4 w-4" aria-hidden="true" />}
          >
            Enregistrer les stocks
          </Button>
        </div>
      </div>
    </Sheet>
  );
}

