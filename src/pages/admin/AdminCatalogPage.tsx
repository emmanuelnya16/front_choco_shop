import {
  Edit3,
  ExternalLink,
  Layers,
  Package,
  Plus,
  Search,
  SlidersHorizontal,
  Trash2,
  X,
} from 'lucide-react';
import { useState } from 'react';
import { Link } from 'react-router';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Price, Skeleton } from '@/components/ui/Primitives';
import {
  useAdminDeleteProduct,
  useAdminProductsList,
} from '@/features/admin/api/useAdminQueries';
import { QuickStockSheet } from '@/features/admin/catalog/QuickStockSheet';
import type {
  AdminProductSort,
  AdminProductStockStatus,
} from '@/features/admin/types';
import { useSeo } from '@/lib/seo/useSeo';
import { cn } from '@/lib/utils/cn';
import { useToastStore } from '@/stores/toastStore';
import type { Product } from '@/types/domain';

const STOCK_STATUS_TABS: Array<{
  id: AdminProductStockStatus;
  label: string;
}> = [
  { id: 'all', label: 'Tous les articles' },
  { id: 'in_stock', label: 'En stock' },
  { id: 'low_stock', label: 'Stock faible (≤ 3)' },
  { id: 'out_of_stock', label: 'Rupture / variante épuisée' },
];

export default function AdminCatalogPage() {
  useSeo({
    title: 'Catalogue & Stocks — Administration DR Choco',
    description:
      'Gestion des articles, variantes, prix FCFA et ajustement rapide des stocks.',
    noindex: true,
  });

  const showToast = useToastStore((s) => s.show);
  const deleteMutation = useAdminDeleteProduct();

  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [stockStatus, setStockStatus] = useState<AdminProductStockStatus>('all');
  const [sort, setSort] = useState<AdminProductSort>('newest');
  const [page, setPage] = useState(1);

  const [quickStockProduct, setQuickStockProduct] = useState<Product | null>(null);

  const { data, isLoading } = useAdminProductsList({
    q: searchQuery.trim() || undefined,
    category: categoryFilter || undefined,
    stockStatus,
    sort,
    page,
    pageSize: 24,
  });

  const items = data?.items ?? [];
  const summary = data?.summary;
  const totalPages = data?.totalPages ?? 1;

  const handleDeleteProduct = async (product: Product) => {
    try {
      await deleteMutation.mutateAsync(product.id);
      showToast({
        message: 'Article retiré du catalogue',
        subtitle: product.name,
      });
    } catch {
      showToast({
        message: 'Impossible de supprimer cet article.',
      });
    }
  };

  return (
    <div className="space-y-6">
      {/* En-tête */}
      <header className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-label text-grey uppercase">CATALOGUE & INVENTAIRE</p>
          <h1 className="mt-1 text-h2 text-ink">Articles, variantes et stocks</h1>
          <p className="mt-1 text-small text-text-2">
            {summary
              ? `${summary.totalProducts} articles au catalogue · ${summary.lowStockProducts} en stock faible`
              : 'Chargement du catalogue…'}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <Button
            href="/admin/categories"
            variant="outline"
            size="md"
            iconLeft={<Layers className="h-4 w-4" aria-hidden="true" />}
          >
            Catégories & Looks
          </Button>
          <Button
            href="/admin/catalogue/nouveau"
            variant="primary"
            size="md"
            iconLeft={<Plus className="h-4 w-4" aria-hidden="true" />}
          >
            Nouvel article
          </Button>
        </div>
      </header>

      {/* Onglets d'état de stock */}
      <nav
        aria-label="Filtrer par état de stock"
        className="-mx-page flex gap-2 overflow-x-auto border-b border-silver px-page pb-3"
      >
        {STOCK_STATUS_TABS.map((tab) => {
          const active = stockStatus === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => {
                setStockStatus(tab.id);
                setPage(1);
              }}
              className={cn(
                'inline-flex min-h-11 shrink-0 items-center rounded-[var(--radius-full)] border px-4 py-2 text-small font-semibold transition-colors',
                active
                  ? 'border-ink bg-ink text-white'
                  : 'border-silver bg-white text-ink hover:bg-surface',
              )}
            >
              {tab.label}
            </button>
          );
        })}
      </nav>

      {/* Barre d'outils (recherche, catégorie, tri) */}
      <section
        aria-label="Recherche et filtres du catalogue"
        className="rounded-[var(--radius-lg)] border border-silver bg-white p-4"
      >
        <div className="grid grid-cols-1 gap-3 md:grid-cols-12">
          <div className="relative md:col-span-6">
            <Search
              className="pointer-events-none absolute top-1/2 left-3.5 h-4 w-4 -translate-y-1/2 text-grey"
              aria-hidden="true"
            />
            <input
              type="search"
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setPage(1);
              }}
              placeholder="Rechercher un article par nom ou slug…"
              aria-label="Rechercher un article du catalogue"
              className="h-11 w-full rounded-[var(--radius-md)] border border-silver bg-surface pr-9 pl-10 text-small text-ink placeholder:text-grey focus:border-ink focus:bg-white focus:outline-none"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => {
                  setSearchQuery('');
                  setPage(1);
                }}
                aria-label="Effacer la recherche"
                className="absolute top-1/2 right-1 inline-flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-[var(--radius-sm)] text-grey hover:text-ink"
              >
                <X className="h-4 w-4" aria-hidden="true" />
              </button>
            )}
          </div>

          <div className="md:col-span-3">
            <select
              aria-label="Filtrer par catégorie"
              value={categoryFilter}
              onChange={(e) => {
                setCategoryFilter(e.target.value);
                setPage(1);
              }}
              className="h-11 w-full rounded-[var(--radius-md)] border border-silver bg-white px-3 text-small font-medium text-ink focus:border-ink focus:outline-none"
            >
              <option value="">Toutes les catégories</option>
              <option value="vetements">Vêtements</option>
              <option value="chaussures">Chaussures</option>
              <option value="babouches">Babouches</option>
            </select>
          </div>

          <div className="md:col-span-3">
            <select
              aria-label="Trier les articles"
              value={sort}
              onChange={(e) => {
                setSort(e.target.value as AdminProductSort);
                setPage(1);
              }}
              className="h-11 w-full rounded-[var(--radius-md)] border border-silver bg-white px-3 text-small font-medium text-ink focus:border-ink focus:outline-none"
            >
              <option value="newest">Plus récents d’abord</option>
              <option value="stock_asc">Stock le plus bas d’abord</option>
              <option value="name">Ordre alphabétique (A → Z)</option>
              <option value="price_asc">Prix croissant</option>
              <option value="price_desc">Prix décroissant</option>
            </select>
          </div>
        </div>
      </section>

      {/* Liste des articles */}
      <section aria-label="Articles du catalogue">
        {isLoading ? (
          <div className="space-y-3">
            {Array.from({ length: 4 }).map((_, idx) => (
              <Skeleton key={idx} className="h-28 w-full" />
            ))}
          </div>
        ) : items.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-[var(--radius-lg)] border border-dashed border-silver bg-white p-10 text-center">
            <Package className="h-9 w-9 text-grey" aria-hidden="true" />
            <p className="mt-3 text-body font-semibold text-ink">
              Aucun article ne correspond à ces critères
            </p>
            <p className="mt-1 text-small text-text-2">
              Modifiez vos filtres ou créez un nouvel article dans le catalogue.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {items.map((product) => {
              const totalStock = product.variants.reduce((sum, v) => sum + v.stock, 0);
              const outOfStockCount = product.variants.filter((v) => v.stock === 0).length;

              return (
                <article
                  key={product.id}
                  className="flex flex-col justify-between gap-4 rounded-[var(--radius-lg)] border border-silver bg-white p-4 sm:p-5 lg:flex-row lg:items-center"
                >
                  {/* Bloc gauche : image + infos principales */}
                  <div className="flex min-w-0 flex-1 items-start gap-4">
                    <img
                      src={product.images[0] ?? product.fallbackImages[0] ?? '/mock/product-tee.svg'}
                      alt={product.name}
                      className="h-20 w-16 shrink-0 rounded-[var(--radius-md)] border border-silver bg-surface object-cover"
                    />
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <Link
                          to={`/admin/catalogue/${product.id}`}
                          className="truncate text-body font-bold text-ink hover:text-red"
                        >
                          {product.name}
                        </Link>
                        {product.badges.map((b) => (
                          <Badge
                            key={b}
                            variant={b}
                            lowStockCount={b === 'low-stock' ? totalStock : undefined}
                          />
                        ))}
                      </div>

                      <p className="mt-0.5 text-xs text-text-2">
                        <span className="font-semibold text-ink uppercase">
                          {product.categorySlug}
                        </span>
                        {product.subCategorySlug ? ` · ${product.subCategorySlug}` : ''} ·{' '}
                        <span className="font-mono">{product.slug}</span>
                      </p>

                      <div className="mt-2 flex flex-wrap items-center gap-1.5">
                        {product.colors.map((c) => (
                          <span
                            key={c.code}
                            title={c.name}
                            className="inline-flex items-center gap-1 rounded-[var(--radius-full)] border border-silver bg-surface px-2 py-0.5 text-[11px] font-medium text-ink"
                          >
                            <span
                              className="inline-block h-2.5 w-2.5 rounded-[var(--radius-full)] border border-silver"
                              style={{ backgroundColor: c.hex }}
                              aria-hidden="true"
                            />
                            <span>{c.name}</span>
                          </span>
                        ))}

                        <span className="mx-1 text-silver">·</span>

                        {product.variants.slice(0, 6).map((v) => (
                          <span
                            key={v.id}
                            className={cn(
                              'inline-flex items-center rounded-[var(--radius-sm)] border px-1.5 py-0.5 font-mono text-[11px] font-semibold tabular-nums',
                              v.stock === 0
                                ? 'border-danger bg-surface text-danger'
                                : v.stock <= 2
                                  ? 'border-warning bg-surface text-ink'
                                  : 'border-silver bg-white text-text-2',
                            )}
                          >
                            {v.size}: {v.stock}
                          </span>
                        ))}
                        {product.variants.length > 6 && (
                          <span className="text-xs text-text-2">
                            +{product.variants.length - 6}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Bloc droit : prix, stock total & actions */}
                  <div className="flex flex-wrap items-center justify-between gap-4 border-t border-silver pt-3 lg:border-t-0 lg:pt-0">
                    <div className="text-left lg:text-right">
                      <Price amount={product.price} className="text-body" />
                      <p className="mt-0.5 text-xs text-text-2">
                        Stock total&nbsp;: <strong className="text-ink">{totalStock}</strong>
                        {outOfStockCount > 0 && (
                          <span className="ml-1.5 text-danger">
                            ({outOfStockCount} rupture{outOfStockCount > 1 ? 's' : ''})
                          </span>
                        )}
                      </p>
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                      <Button
                        variant="dark"
                        size="sm"
                        onClick={() => setQuickStockProduct(product)}
                        iconLeft={<SlidersHorizontal className="h-3.5 w-3.5" aria-hidden="true" />}
                      >
                        Stock rapide
                      </Button>

                      <Button
                        href={`/admin/catalogue/${product.id}`}
                        variant="outline"
                        size="sm"
                        iconLeft={<Edit3 className="h-3.5 w-3.5" aria-hidden="true" />}
                      >
                        Modifier
                      </Button>

                      <Link
                        to={`/produit/${product.slug}`}
                        aria-label={`Voir ${product.name} en boutique`}
                        className="inline-flex h-11 w-11 items-center justify-center rounded-[var(--radius-md)] border border-silver text-text-2 transition-colors hover:border-ink hover:text-ink"
                      >
                        <ExternalLink className="h-4 w-4" aria-hidden="true" />
                      </Link>

                      <button
                        type="button"
                        onClick={() => void handleDeleteProduct(product)}
                        aria-label={`Supprimer ${product.name}`}
                        className="inline-flex h-11 w-11 items-center justify-center rounded-[var(--radius-md)] border border-silver text-danger transition-colors hover:border-danger hover:bg-surface"
                      >
                        <Trash2 className="h-4 w-4" aria-hidden="true" />
                      </button>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        )}

        {totalPages > 1 && (
          <div className="mt-4 flex items-center justify-between rounded-[var(--radius-md)] border border-silver bg-white px-4 py-3 text-small">
            <span className="text-text-2">
              Page <strong className="text-ink">{page}</strong> sur{' '}
              <strong className="text-ink">{totalPages}</strong>
            </span>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                disabled={page <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
              >
                Précédent
              </Button>
              <Button
                variant="outline"
                size="sm"
                disabled={page >= totalPages}
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              >
                Suivant
              </Button>
            </div>
          </div>
        )}
      </section>

      {/* Feuille Stock rapide (key pour réinitialiser l'état à l'ouverture d'un produit) */}
      <QuickStockSheet
        key={quickStockProduct?.id ?? 'closed'}
        product={quickStockProduct}
        onClose={() => setQuickStockProduct(null)}
      />
    </div>
  );
}

