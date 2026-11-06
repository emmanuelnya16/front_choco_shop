import {
  ArrowRight,
  CheckCircle2,
  FileCheck2,
  RefreshCw,
  Search,
  Store,
  Truck,
  X,
} from 'lucide-react';
import { useState } from 'react';
import { Link, useSearchParams } from 'react-router';
import { Button } from '@/components/ui/Button';
import { Price, Skeleton } from '@/components/ui/Primitives';
import { useAdminReservationsList } from '@/features/admin/api/useAdminQueries';
import { AdminReservationStatusBadge } from '@/features/admin/components/AdminReservationStatusBadge';
import type {
  AdminReservationsTab,
  AdminReservationsTabCounts,
} from '@/features/admin/types';
import { useSeo } from '@/lib/seo/useSeo';
import { cn } from '@/lib/utils/cn';
import { formatDate, formatRelative } from '@/lib/utils/date';
import { formatCmPhone } from '@/lib/utils/phone';
import type { ReceptionMode } from '@/types/domain';
import type { ReservationStatusCode } from '@/types/reservationStatus';

const TAB_DEFINITIONS: Array<{
  id: AdminReservationsTab;
  label: string;
  countKey: keyof AdminReservationsTabCounts;
  urgent?: boolean;
}> = [
  { id: 'to_validate', label: 'À valider', countKey: 'toValidate', urgent: true },
  { id: 'to_prepare', label: 'À préparer', countKey: 'toPrepare' },
  { id: 'ready', label: 'Prêtes / Agence', countKey: 'ready' },
  { id: 'in_delivery', label: 'En route', countKey: 'inDelivery' },
  { id: 'attention', label: 'À surveiller', countKey: 'attention' },
  { id: 'done', label: 'Terminées', countKey: 'done' },
  { id: 'all', label: 'Toutes', countKey: 'all' },
];

function tabFromStatusParam(statusParam: string | null): AdminReservationsTab {
  if (!statusParam) return 'all';
  if (statusParam === 'pending_validation') return 'to_validate';
  if (statusParam === 'confirmed' || statusParam === 'preparing') return 'to_prepare';
  if (statusParam === 'ready_for_pickup' || statusParam === 'handed_to_agency') return 'ready';
  if (statusParam === 'in_delivery') return 'in_delivery';
  if (statusParam === 'reserved' || statusParam === 'payment_rejected') return 'attention';
  if (
    statusParam === 'delivered' ||
    statusParam === 'picked_up' ||
    statusParam === 'expired' ||
    statusParam === 'cancelled'
  ) {
    return 'done';
  }
  return 'all';
}

export default function AdminReservationsPage() {
  useSeo({
    title: 'Réservations & Preuves — Administration DR Choco',
    description:
      'File d’attente opérationnelle des réservations, preuves Mobile Money et suivi des colis.',
    noindex: true,
  });

  const [searchParams, setSearchParams] = useSearchParams();
  const initialStatus = searchParams.get('statut') as ReservationStatusCode | null;
  const initialTab =
    (searchParams.get('tab') as AdminReservationsTab | null) ??
    tabFromStatusParam(initialStatus);

  const [activeTab, setActiveTab] = useState<AdminReservationsTab>(initialTab);
  const [searchQuery, setSearchQuery] = useState('');
  const [receptionFilter, setReceptionFilter] = useState<ReceptionMode | ''>('');
  const [operatorFilter, setOperatorFilter] = useState<'orange' | 'mtn' | ''>('');
  const [cityFilter, setCityFilter] = useState('');
  const [page, setPage] = useState(1);

  const { data, isLoading, isFetching, refetch } = useAdminReservationsList({
    tab: activeTab,
    receptionMode: receptionFilter || undefined,
    operator: operatorFilter || undefined,
    city: cityFilter || undefined,
    q: searchQuery.trim() || undefined,
    page,
    pageSize: 20,
  });

  const counts = data?.counts;
  const items = data?.items ?? [];
  const totalPages = data?.totalPages ?? 1;

  const handleSelectTab = (tab: AdminReservationsTab) => {
    setActiveTab(tab);
    setPage(1);
    const nextParams = new URLSearchParams(searchParams);
    nextParams.delete('statut');
    if (tab === 'all') {
      nextParams.delete('tab');
    } else {
      nextParams.set('tab', tab);
    }
    setSearchParams(nextParams, { replace: true });
  };

  const hasActiveFilters =
    Boolean(searchQuery.trim()) ||
    Boolean(receptionFilter) ||
    Boolean(operatorFilter) ||
    Boolean(cityFilter);

  const handleResetFilters = () => {
    setSearchQuery('');
    setReceptionFilter('');
    setOperatorFilter('');
    setCityFilter('');
    setPage(1);
  };

  return (
    <div className="space-y-6">
      {/* En-tête */}
      <header className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-label text-grey uppercase">OPÉRATIONS COMPTOIR</p>
          <h1 className="mt-1 text-h2 text-ink">Réservations & Preuves Mobile Money</h1>
          <p className="mt-1 text-small text-text-2">
            Vérifiez les captures de paiement, emballez les colis et suivez les remises.
          </p>
        </div>

        <Button
          variant="outline"
          size="sm"
          onClick={() => void refetch()}
          loading={isFetching}
          iconLeft={<RefreshCw className="h-4 w-4" aria-hidden="true" />}
        >
          Actualiser
        </Button>
      </header>

      {/* Onglets opérationnels rapides */}
      <nav
        aria-label="Files de réservations par étape"
        className="-mx-page flex gap-2 overflow-x-auto border-b border-silver px-page pb-3"
      >
        {TAB_DEFINITIONS.map((tab) => {
          const isActive = activeTab === tab.id;
          const count = counts ? counts[tab.countKey] : undefined;

          return (
            <button
              key={tab.id}
              type="button"
              role="tab"
              aria-selected={isActive}
              onClick={() => handleSelectTab(tab.id)}
              className={cn(
                'inline-flex min-h-11 shrink-0 items-center gap-2 rounded-[var(--radius-full)] border px-4 py-2 text-small font-semibold transition-colors duration-fast',
                isActive
                  ? 'border-ink bg-ink text-white'
                  : 'border-silver bg-white text-ink hover:bg-surface',
              )}
            >
              <span>{tab.label}</span>
              {typeof count === 'number' && (
                <span
                  className={cn(
                    'inline-flex h-5 min-w-5 items-center justify-center rounded-[var(--radius-full)] px-1.5 text-[11px] font-bold tabular-nums',
                    isActive
                      ? tab.urgent && count > 0
                        ? 'bg-red text-white'
                        : 'bg-ink-2 text-white'
                      : tab.urgent && count > 0
                        ? 'bg-red text-white'
                        : 'bg-surface text-text-2',
                  )}
                >
                  {count}
                </span>
              )}
            </button>
          );
        })}
      </nav>

      {/* Barre de recherche et filtres rapides */}
      <section
        aria-label="Recherche et filtres des réservations"
        className="rounded-[var(--radius-lg)] border border-silver bg-white p-4"
      >
        <div className="grid grid-cols-1 gap-3 md:grid-cols-12">
          <div className="relative md:col-span-5">
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
              placeholder="Référence (RES-…), nom client, téléphone, quartier…"
              aria-label="Filtrer par référence, nom ou téléphone"
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
              aria-label="Filtrer par mode de réception"
              value={receptionFilter}
              onChange={(e) => {
                setReceptionFilter(e.target.value as ReceptionMode | '');
                setPage(1);
              }}
              className="h-11 w-full rounded-[var(--radius-md)] border border-silver bg-white px-3 text-small font-medium text-ink focus:border-ink focus:outline-none"
            >
              <option value="">Tous les modes de réception</option>
              <option value="delivery">Livraison (locale & agences)</option>
              <option value="pickup">Retrait en boutique (Akwa)</option>
            </select>
          </div>

          <div className="md:col-span-2">
            <select
              aria-label="Filtrer par opérateur Mobile Money"
              value={operatorFilter}
              onChange={(e) => {
                setOperatorFilter(e.target.value as 'orange' | 'mtn' | '');
                setPage(1);
              }}
              className="h-11 w-full rounded-[var(--radius-md)] border border-silver bg-white px-3 text-small font-medium text-ink focus:border-ink focus:outline-none"
            >
              <option value="">Tous opérateurs</option>
              <option value="orange">Orange Money</option>
              <option value="mtn">MTN MoMo</option>
            </select>
          </div>

          <div className="md:col-span-2">
            <select
              aria-label="Filtrer par ville"
              value={cityFilter}
              onChange={(e) => {
                setCityFilter(e.target.value);
                setPage(1);
              }}
              className="h-11 w-full rounded-[var(--radius-md)] border border-silver bg-white px-3 text-small font-medium text-ink focus:border-ink focus:outline-none"
            >
              <option value="">Toutes villes</option>
              <option value="Douala">Douala</option>
              <option value="Yaoundé">Yaoundé</option>
              <option value="Bafoussam">Bafoussam</option>
            </select>
          </div>
        </div>

        {hasActiveFilters && (
          <div className="mt-3 flex items-center justify-between border-t border-silver pt-3 text-xs text-text-2">
            <span>
              {data?.total ?? 0} résultat{(data?.total ?? 0) > 1 ? 's' : ''} trouvé
              {(data?.total ?? 0) > 1 ? 's' : ''}
            </span>
            <button
              type="button"
              onClick={handleResetFilters}
              className="inline-flex min-h-9 items-center gap-1 font-semibold text-red hover:underline"
            >
              <X className="h-3.5 w-3.5" aria-hidden="true" />
              <span>Réinitialiser les filtres</span>
            </button>
          </div>
        )}
      </section>

      {/* Liste des réservations */}
      <section aria-label="Liste des réservations">
        {isLoading ? (
          <div className="space-y-3">
            {Array.from({ length: 5 }).map((_, idx) => (
              <Skeleton key={idx} className="h-20 w-full" />
            ))}
          </div>
        ) : items.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-[var(--radius-lg)] border border-dashed border-silver bg-white p-10 text-center">
            <CheckCircle2 className="h-9 w-9 text-grey" aria-hidden="true" />
            <p className="mt-3 text-body font-semibold text-ink">
              Aucune réservation dans cette file
            </p>
            <p className="mt-1 text-small text-text-2">
              Changez d’onglet ou réinitialisez les filtres pour afficher d’autres réservations.
            </p>
            {hasActiveFilters && (
              <div className="mt-4">
                <Button variant="outline" size="sm" onClick={handleResetFilters}>
                  Afficher toutes les réservations
                </Button>
              </div>
            )}
          </div>
        ) : (
          <>
            {/* Tableau ordinateur (md+) */}
            <div className="hidden overflow-hidden rounded-[var(--radius-lg)] border border-silver bg-white md:block">
              <div className="overflow-x-auto">
                <table className="w-full border-collapse text-left">
                  <thead>
                    <tr className="border-b border-silver bg-surface text-label text-grey uppercase">
                      <th className="py-3.5 pr-4 pl-5">Référence</th>
                      <th className="py-3.5 pr-4">Client & Téléphone</th>
                      <th className="py-3.5 pr-4">Mode & Ville</th>
                      <th className="py-3.5 pr-4">Articles</th>
                      <th className="py-3.5 pr-4">Montant & Preuve</th>
                      <th className="py-3.5 pr-4">Statut</th>
                      <th className="py-3.5 pr-5 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-silver text-small">
                    {items.map((res) => {
                      const actionLabel =
                        res.status === 'pending_validation'
                          ? 'Vérifier la preuve'
                          : res.status === 'confirmed' || res.status === 'preparing'
                            ? 'Préparer colis'
                            : 'Ouvrir';

                      return (
                        <tr
                          key={res.ref}
                          className="transition-colors hover:bg-surface/60"
                        >
                          <td className="py-3.5 pr-4 pl-5 align-middle">
                            <Link
                              to={`/admin/reservations/${res.ref}`}
                              className="font-mono font-bold text-ink hover:text-red"
                            >
                              {res.ref}
                            </Link>
                            <p
                              className="mt-0.5 text-xs text-text-2"
                              title={formatDate(res.updatedAt)}
                            >
                              {formatRelative(res.updatedAt)}
                            </p>
                          </td>

                          <td className="py-3.5 pr-4 align-middle">
                            <p className="font-semibold text-ink">
                              {res.customer.firstName} {res.customer.lastName ?? ''}
                            </p>
                            <p className="font-mono text-xs text-text-2">
                              {formatCmPhone(res.customer.phone)}
                            </p>
                          </td>

                          <td className="py-3.5 pr-4 align-middle">
                            <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-ink">
                              {res.receptionMode === 'pickup' ? (
                                <>
                                  <Store className="h-3.5 w-3.5 text-text-2" aria-hidden="true" />
                                  <span>Retrait boutique</span>
                                </>
                              ) : (
                                <>
                                  <Truck className="h-3.5 w-3.5 text-text-2" aria-hidden="true" />
                                  <span>Livraison · {res.city ?? 'Douala'}</span>
                                </>
                              )}
                            </span>
                          </td>

                          <td className="py-3.5 pr-4 align-middle">
                            <p className="max-w-[240px] truncate font-medium text-ink">
                              {res.firstItemSummary}
                            </p>
                            <p className="text-xs text-text-2">
                              {res.itemsCount} article{res.itemsCount > 1 ? 's' : ''}
                            </p>
                          </td>

                          <td className="py-3.5 pr-4 align-middle">
                            <Price amount={res.total} className="text-small" />
                            <div className="mt-0.5 flex items-center gap-1.5 text-xs text-text-2">
                              {res.operator && (
                                <span className="font-semibold">
                                  {res.operator === 'mtn' ? 'MTN MoMo' : 'Orange Money'}
                                </span>
                              )}
                              {res.hasProof && (
                                <span className="inline-flex items-center gap-0.5 text-ink">
                                  <FileCheck2 className="h-3 w-3 text-success" aria-hidden="true" />
                                  <span>Capture</span>
                                </span>
                              )}
                            </div>
                          </td>

                          <td className="py-3.5 pr-4 align-middle">
                            <AdminReservationStatusBadge status={res.status} />
                          </td>

                          <td className="py-3.5 pr-5 text-right align-middle">
                            <Button
                              href={`/admin/reservations/${res.ref}`}
                              variant={
                                res.status === 'pending_validation' ? 'primary' : 'dark'
                              }
                              size="sm"
                              iconRight={<ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />}
                            >
                              {actionLabel}
                            </Button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Cartes mobile (< md) */}
            <div className="space-y-3 md:hidden">
              {items.map((res) => {
                const actionLabel =
                  res.status === 'pending_validation'
                    ? 'Vérifier la preuve'
                    : res.status === 'confirmed' || res.status === 'preparing'
                      ? 'Préparer le colis'
                      : 'Ouvrir la fiche';

                return (
                  <article
                    key={res.ref}
                    className="rounded-[var(--radius-lg)] border border-silver bg-white p-4"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <Link
                        to={`/admin/reservations/${res.ref}`}
                        className="font-mono text-small font-bold text-ink"
                      >
                        {res.ref}
                      </Link>
                      <AdminReservationStatusBadge status={res.status} />
                    </div>

                    <div className="mt-2.5 flex items-baseline justify-between gap-2">
                      <div>
                        <p className="text-small font-semibold text-ink">
                          {res.customer.firstName} {res.customer.lastName ?? ''}
                        </p>
                        <p className="font-mono text-xs text-text-2">
                          {formatCmPhone(res.customer.phone)}
                        </p>
                      </div>
                      <div className="text-right">
                        <Price amount={res.total} className="text-small" />
                        {res.operator && (
                          <p className="text-xs text-text-2">
                            {res.operator === 'mtn' ? 'MTN MoMo' : 'Orange Money'}
                          </p>
                        )}
                      </div>
                    </div>

                    <p className="mt-2 truncate text-xs text-text-2">
                      {res.firstItemSummary}
                    </p>

                    <div className="mt-3 flex items-center justify-between gap-2 border-t border-silver pt-3">
                      <span className="text-xs text-text-2">
                        {res.receptionMode === 'pickup'
                          ? 'Retrait boutique'
                          : `Livraison · ${res.city ?? 'Douala'}`}
                      </span>
                      <Button
                        href={`/admin/reservations/${res.ref}`}
                        variant={res.status === 'pending_validation' ? 'primary' : 'dark'}
                        size="sm"
                        iconRight={<ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />}
                      >
                        {actionLabel}
                      </Button>
                    </div>
                  </article>
                );
              })}
            </div>

            {/* Pagination */}
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
          </>
        )}
      </section>
    </div>
  );
}

