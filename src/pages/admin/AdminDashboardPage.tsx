import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  Clock,
  Hourglass,
  Package,
  RefreshCw,
  Store,
  TrendingUp,
  Truck,
} from 'lucide-react';
import { useState } from 'react';
import { Link } from 'react-router';
import { Button } from '@/components/ui/Button';
import { Price, Skeleton } from '@/components/ui/Primitives';
import { useAdminDashboard } from '@/features/admin/api/useAdminQueries';
import { useAdminAuthStore } from '@/features/admin/auth/adminAuthStore';
import { AdminReservationStatusBadge } from '@/features/admin/components/AdminReservationStatusBadge';
import type { AdminDashboardPeriod } from '@/features/admin/types';
import { useSeo } from '@/lib/seo/useSeo';
import { cn } from '@/lib/utils/cn';
import { formatDate, formatRelative } from '@/lib/utils/date';
import { formatCmPhone } from '@/lib/utils/phone';

const PERIOD_OPTIONS: Array<{ value: AdminDashboardPeriod; label: string }> = [
  { value: 'today', label: 'Aujourd’hui' },
  { value: '7d', label: '7 derniers jours' },
  { value: '30d', label: '30 derniers jours' },
];

export default function AdminDashboardPage() {
  useSeo({
    title: 'Tableau de bord — Administration DR Choco',
    description: 'Pilotage opérationnel des réservations, preuves Mobile Money et stocks.',
    noindex: true,
  });

  const admin = useAdminAuthStore((s) => s.admin);
  const [period, setPeriod] = useState<AdminDashboardPeriod>('7d');
  const { data, isLoading, isFetching, isError, refetch } = useAdminDashboard();

  const counts = data?.counts;
  const periodKpis = data?.kpis[period];
  const baseDate = data?.serverTime ? new Date(data.serverTime) : new Date();

  return (
    <div className="space-y-8">
      {/* 1. En-tête du tableau de bord */}
      <header className="flex flex-col gap-4 border-b border-silver pb-5 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <p className="text-label text-grey uppercase">PILOTAGE BOUTIQUE</p>
          <h1 className="mt-1 text-h2 text-ink">
            Bonjour{admin?.name ? `, ${admin.name}` : ''}
          </h1>
          <p className="mt-1 text-small text-text-2">
            Point opérationnel du {formatDate(baseDate)} ·{' '}
            {counts ? `${counts.activeTotal} réservation${counts.activeTotal > 1 ? 's' : ''} en cours` : 'Chargement…'}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <div
            role="group"
            aria-label="Période des statistiques"
            className="inline-flex rounded-[var(--radius-md)] border border-silver bg-white p-1"
          >
            {PERIOD_OPTIONS.map((opt) => {
              const active = period === opt.value;
              return (
                <button
                  key={opt.value}
                  type="button"
                  aria-pressed={active}
                  onClick={() => setPeriod(opt.value)}
                  className={cn(
                    'min-h-9 rounded-[var(--radius-sm)] px-3 py-1.5 text-xs font-semibold transition-colors',
                    active
                      ? 'bg-ink text-white'
                      : 'text-text-2 hover:bg-surface hover:text-ink',
                  )}
                >
                  {opt.label}
                </button>
              );
            })}
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
        </div>
      </header>

      {isError && (
        <div
          role="alert"
          className="flex flex-wrap items-center justify-between gap-3 rounded-[var(--radius-md)] border border-danger bg-white p-4 text-small text-danger"
        >
          <span>Impossible de charger les indicateurs du tableau de bord.</span>
          <Button variant="outline" size="sm" onClick={() => void refetch()}>
            Réessayer
          </Button>
        </div>
      )}

      {/* 2. Quatre compteurs d'action prioritaire */}
      <section aria-labelledby="admin-urgent-counters-heading">
        <h2 id="admin-urgent-counters-heading" className="sr-only">
          Compteurs d’urgence opérationnelle
        </h2>

        {isLoading || !counts ? (
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4 lg:gap-4">
            {Array.from({ length: 4 }).map((_, idx) => (
              <Skeleton key={idx} className="h-32 w-full" />
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4 lg:gap-4">
            <Link
              to="/admin/reservations?statut=pending_validation"
              className={cn(
                'group flex flex-col justify-between rounded-[var(--radius-lg)] border bg-white p-4 transition-colors duration-fast hover:border-ink sm:p-5',
                counts.pendingValidation > 0
                  ? 'border-red shadow-[var(--shadow-sm)]'
                  : 'border-silver',
              )}
            >
              <div className="flex items-center justify-between gap-2">
                <span className="inline-flex h-9 w-9 items-center justify-center rounded-[var(--radius-md)] bg-surface text-ink">
                  <Hourglass className="h-4 w-4 text-red" aria-hidden="true" />
                </span>
                {counts.pendingValidation > 0 && (
                  <span className="rounded-[var(--radius-full)] bg-red px-2.5 py-0.5 text-[11px] font-bold text-white uppercase">
                    À VÉRIFIER
                  </span>
                )}
              </div>
              <div className="mt-4">
                <p className="text-h1 font-extrabold text-ink tabular-nums">
                  {counts.pendingValidation}
                </p>
                <p className="mt-1 flex items-center justify-between text-small font-semibold text-ink">
                  <span>Preuves à valider</span>
                  <ArrowRight
                    className="h-4 w-4 text-grey transition-transform group-hover:translate-x-0.5 group-hover:text-ink"
                    aria-hidden="true"
                  />
                </p>
              </div>
            </Link>

            <Link
              to="/admin/reservations?statut=confirmed"
              className="group flex flex-col justify-between rounded-[var(--radius-lg)] border border-silver bg-white p-4 transition-colors duration-fast hover:border-ink sm:p-5"
            >
              <div className="flex items-center justify-between gap-2">
                <span className="inline-flex h-9 w-9 items-center justify-center rounded-[var(--radius-md)] bg-surface text-ink">
                  <Package className="h-4 w-4 text-ink" aria-hidden="true" />
                </span>
                {counts.toPrepare > 0 && (
                  <span className="rounded-[var(--radius-full)] bg-ink px-2.5 py-0.5 text-[11px] font-bold text-white uppercase">
                    COLIS
                  </span>
                )}
              </div>
              <div className="mt-4">
                <p className="text-h1 font-extrabold text-ink tabular-nums">
                  {counts.toPrepare}
                </p>
                <p className="mt-1 flex items-center justify-between text-small font-semibold text-ink">
                  <span>Colis à préparer</span>
                  <ArrowRight
                    className="h-4 w-4 text-grey transition-transform group-hover:translate-x-0.5 group-hover:text-ink"
                    aria-hidden="true"
                  />
                </p>
              </div>
            </Link>

            <Link
              to="/admin/reservations?statut=ready_for_pickup"
              className="group flex flex-col justify-between rounded-[var(--radius-lg)] border border-silver bg-white p-4 transition-colors duration-fast hover:border-ink sm:p-5"
            >
              <div className="flex items-center justify-between gap-2">
                <span className="inline-flex h-9 w-9 items-center justify-center rounded-[var(--radius-md)] bg-surface text-ink">
                  <Store className="h-4 w-4 text-success" aria-hidden="true" />
                </span>
              </div>
              <div className="mt-4">
                <p className="text-h1 font-extrabold text-ink tabular-nums">
                  {counts.readyForHandover}
                </p>
                <p className="mt-1 flex items-center justify-between text-small font-semibold text-ink">
                  <span>Prêts à remettre</span>
                  <ArrowRight
                    className="h-4 w-4 text-grey transition-transform group-hover:translate-x-0.5 group-hover:text-ink"
                    aria-hidden="true"
                  />
                </p>
              </div>
            </Link>

            <Link
              to="/admin/reservations?statut=reserved"
              className="group flex flex-col justify-between rounded-[var(--radius-lg)] border border-silver bg-white p-4 transition-colors duration-fast hover:border-ink sm:p-5"
            >
              <div className="flex items-center justify-between gap-2">
                <span className="inline-flex h-9 w-9 items-center justify-center rounded-[var(--radius-md)] bg-surface text-ink">
                  <Clock className="h-4 w-4 text-warning" aria-hidden="true" />
                </span>
                {counts.expiringSoon > 0 && (
                  <span className="rounded-[var(--radius-full)] bg-warning px-2.5 py-0.5 text-[11px] font-bold text-ink uppercase">
                    &lt; 3 H
                  </span>
                )}
              </div>
              <div className="mt-4">
                <p className="text-h1 font-extrabold text-ink tabular-nums">
                  {counts.expiringSoon}
                </p>
                <p className="mt-1 flex items-center justify-between text-small font-semibold text-ink">
                  <span>Expirent bientôt</span>
                  <ArrowRight
                    className="h-4 w-4 text-grey transition-transform group-hover:translate-x-0.5 group-hover:text-ink"
                    aria-hidden="true"
                  />
                </p>
              </div>
            </Link>
          </div>
        )}
      </section>

      {/* 3. File d'attente « À traiter maintenant » */}
      <section
        aria-labelledby="admin-queue-heading"
        className="rounded-[var(--radius-lg)] border border-silver bg-white p-5 sm:p-6"
      >
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 id="admin-queue-heading" className="text-h3 text-ink">
              À traiter maintenant
            </h2>
            <p className="mt-0.5 text-small text-text-2">
              Preuves Mobile Money en attente de validation et colis payés à préparer.
            </p>
          </div>
          <Link
            to="/admin/reservations"
            className="inline-flex min-h-11 items-center gap-1.5 text-small font-semibold text-ink transition-colors hover:text-red"
          >
            <span>Voir toutes les réservations</span>
            <ArrowRight className="h-4 w-4" aria-hidden="true" />
          </Link>
        </div>

        {isLoading ? (
          <div className="space-y-3">
            {Array.from({ length: 3 }).map((_, idx) => (
              <Skeleton key={idx} className="h-16 w-full" />
            ))}
          </div>
        ) : !data || data.urgentReservations.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-[var(--radius-md)] border border-dashed border-silver bg-surface py-8 text-center">
            <CheckCircle2 className="h-8 w-8 text-success" aria-hidden="true" />
            <p className="mt-2 text-body font-semibold text-ink">
              Aucune action urgente en attente
            </p>
            <p className="mt-1 text-small text-text-2">
              Toutes les preuves Mobile Money et tous les colis en cours sont à jour.
            </p>
          </div>
        ) : (
          <>
            {/* Vue tableau sur ordinateur (md+) */}
            <div className="hidden overflow-x-auto md:block">
              <table className="w-full border-collapse text-left">
                <thead>
                  <tr className="border-b border-silver text-label text-grey uppercase">
                    <th className="py-3 pr-4">Référence</th>
                    <th className="py-3 pr-4">Client</th>
                    <th className="py-3 pr-4">Articles & Réception</th>
                    <th className="py-3 pr-4">Montant</th>
                    <th className="py-3 pr-4">Statut</th>
                    <th className="py-3 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-silver text-small">
                  {data.urgentReservations.map((res) => (
                    <tr key={res.ref} className="transition-colors hover:bg-surface/60">
                      <td className="py-3.5 pr-4 align-middle">
                        <Link
                          to={`/admin/reservations/${res.ref}`}
                          className="font-mono font-bold text-ink hover:text-red"
                        >
                          {res.ref}
                        </Link>
                        <p className="mt-0.5 text-xs text-text-2">
                          {formatRelative(res.updatedAt, baseDate)}
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
                        <p className="max-w-[260px] truncate font-medium text-ink">
                          {res.firstItemSummary}
                        </p>
                        <p className="mt-0.5 inline-flex items-center gap-1 text-xs text-text-2">
                          {res.receptionMode === 'pickup' ? (
                            <>
                              <Store className="h-3.5 w-3.5" aria-hidden="true" />
                              <span>Retrait boutique (Akwa)</span>
                            </>
                          ) : (
                            <>
                              <Truck className="h-3.5 w-3.5" aria-hidden="true" />
                              <span>Livraison · {res.city ?? 'Douala'}</span>
                            </>
                          )}
                        </p>
                      </td>
                      <td className="py-3.5 pr-4 align-middle">
                        <Price amount={res.total} className="text-small" />
                        {res.operator && (
                          <p className="mt-0.5 text-xs font-semibold text-text-2">
                            {res.operator === 'mtn' ? 'MTN MoMo' : 'Orange Money'}
                          </p>
                        )}
                      </td>
                      <td className="py-3.5 pr-4 align-middle">
                        <AdminReservationStatusBadge status={res.status} />
                      </td>
                      <td className="py-3.5 text-right align-middle">
                        <Button
                          href={`/admin/reservations/${res.ref}`}
                          variant={res.status === 'pending_validation' ? 'primary' : 'dark'}
                          size="sm"
                          iconRight={<ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />}
                        >
                          Traiter
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Vue cartes empilées sur mobile (< md) */}
            <div className="space-y-3 md:hidden">
              {data.urgentReservations.map((res) => (
                <article
                  key={res.ref}
                  className="rounded-[var(--radius-md)] border border-silver bg-surface/50 p-4"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="font-mono text-small font-bold text-ink">{res.ref}</span>
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

                  <p className="mt-2 truncate text-xs text-text-2">{res.firstItemSummary}</p>

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
                      Traiter
                    </Button>
                  </div>
                </article>
              ))}
            </div>
          </>
        )}
      </section>

      {/* 4. Indicateurs d'activité sur la période */}
      <section aria-labelledby="admin-kpis-heading" className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 id="admin-kpis-heading" className="text-h3 text-ink">
              Activité sur la période ({PERIOD_OPTIONS.find((p) => p.value === period)?.label})
            </h2>
            <p className="mt-0.5 text-small text-text-2">
              Indicateurs calculés sur les réservations créées et confirmées.
            </p>
          </div>
        </div>

        {isLoading || !periodKpis ? (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {Array.from({ length: 4 }).map((_, idx) => (
              <Skeleton key={idx} className="h-36 w-full" />
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div className="rounded-[var(--radius-lg)] border border-silver bg-white p-5">
              <div className="flex items-center justify-between text-label text-grey uppercase">
                <span>CA CONFIRMÉ</span>
                <TrendingUp className="h-4 w-4 text-success" aria-hidden="true" />
              </div>
              <p className="mt-3">
                <Price amount={periodKpis.revenueConfirmed} className="text-h2" />
              </p>
              <p className="mt-1.5 text-xs text-text-2">
                Hors réservations non payées, rejetées ou annulées.
              </p>
            </div>

            <div className="rounded-[var(--radius-lg)] border border-silver bg-white p-5">
              <p className="text-label text-grey uppercase">TRANSFORMATION</p>
              <p className="mt-3 text-h2 font-extrabold text-ink tabular-nums">
                {periodKpis.reservationsConfirmed} / {periodKpis.reservationsCreated}
              </p>
              <p className="mt-1.5 text-xs text-text-2">
                Taux de confirmation&nbsp;:{' '}
                <span className="font-bold text-ink">{periodKpis.conversionRate}&nbsp;%</span>
              </p>
            </div>

            <div className="rounded-[var(--radius-lg)] border border-silver bg-white p-5">
              <p className="text-label text-grey uppercase">PANIER MOYEN</p>
              <p className="mt-3">
                <Price amount={periodKpis.averageBasket} className="text-h2" />
              </p>
              <p className="mt-1.5 text-xs text-text-2">
                Sur {periodKpis.reservationsConfirmed} réservation
                {periodKpis.reservationsConfirmed > 1 ? 's' : ''} confirmée
                {periodKpis.reservationsConfirmed > 1 ? 's' : ''}.
              </p>
            </div>

            <div className="rounded-[var(--radius-lg)] border border-silver bg-white p-5">
              <p className="text-label text-grey uppercase">OPÉRATEURS & RÉCEPTION</p>
              <div className="mt-3 space-y-2 text-xs">
                <div className="flex items-center justify-between">
                  <span className="text-text-2">Orange Money / MTN MoMo</span>
                  <span className="font-bold text-ink tabular-nums">
                    {periodKpis.byOperator.orange} / {periodKpis.byOperator.mtn}
                  </span>
                </div>
                <div className="flex items-center justify-between border-t border-silver pt-2">
                  <span className="text-text-2">Livraison / Retrait boutique</span>
                  <span className="font-bold text-ink tabular-nums">
                    {periodKpis.byReception.delivery} / {periodKpis.byReception.pickup}
                  </span>
                </div>
              </div>
            </div>
          </div>
        )}
      </section>

      {/* 5. Alertes de stock (ruptures et stocks faibles) */}
      <section
        aria-labelledby="admin-stock-alerts-heading"
        className="rounded-[var(--radius-lg)] border border-silver bg-white p-5 sm:p-6"
      >
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h2 id="admin-stock-alerts-heading" className="text-h3 text-ink">
                Alertes de stock
              </h2>
              {counts && counts.outOfStockVariants > 0 && (
                <span className="inline-flex items-center gap-1 rounded-[var(--radius-full)] bg-danger px-2.5 py-0.5 text-xs font-bold text-white">
                  <AlertTriangle className="h-3 w-3" aria-hidden="true" />
                  <span>
                    {counts.outOfStockVariants} en rupture
                  </span>
                </span>
              )}
              {counts && counts.lowStockVariants > 0 && (
                <span className="inline-flex items-center rounded-[var(--radius-full)] bg-warning px-2.5 py-0.5 text-xs font-bold text-ink">
                  {counts.lowStockVariants} stock faible (≤ 2)
                </span>
              )}
            </div>
            <p className="mt-0.5 text-small text-text-2">
              Variantes épuisées ou proches de la rupture dans le catalogue.
            </p>
          </div>

          <Link
            to="/admin/catalogue"
            className="inline-flex min-h-11 items-center gap-1.5 text-small font-semibold text-ink transition-colors hover:text-red"
          >
            <span>Gérer tout le catalogue</span>
            <ArrowRight className="h-4 w-4" aria-hidden="true" />
          </Link>
        </div>

        {isLoading ? (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {Array.from({ length: 4 }).map((_, idx) => (
              <Skeleton key={idx} className="h-16 w-full" />
            ))}
          </div>
        ) : !data || data.lowStockItems.length === 0 ? (
          <p className="py-4 text-small text-text-2">
            Aucune variante en rupture ou en stock critique.
          </p>
        ) : (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {data.lowStockItems.map((item) => (
              <div
                key={item.variantId}
                className="flex items-center justify-between gap-3 rounded-[var(--radius-md)] border border-silver bg-surface/40 p-3"
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate text-small font-semibold text-ink">{item.name}</p>
                  <p className="mt-0.5 flex items-center gap-1.5 text-xs text-text-2">
                    <span
                      className="inline-block h-3 w-3 shrink-0 rounded-[var(--radius-full)] border border-silver"
                      style={{ backgroundColor: item.colorHex }}
                      aria-hidden="true"
                    />
                    <span>
                      {item.colorName} · Taille <strong className="text-ink">{item.size}</strong>
                    </span>
                  </p>
                </div>

                <div className="flex shrink-0 items-center gap-2.5">
                  <span
                    className={cn(
                      'inline-flex h-6 items-center rounded-[var(--radius-full)] px-2.5 text-label',
                      item.stock === 0 ? 'bg-danger text-white' : 'bg-warning text-ink',
                    )}
                  >
                    {item.stock === 0 ? 'Rupture (0)' : `Plus que ${item.stock}`}
                  </span>
                  <Link
                    to={`/admin/catalogue/${item.productId}`}
                    className="inline-flex min-h-11 items-center gap-1 px-2 text-xs font-bold text-ink transition-colors hover:text-red"
                  >
                    <span>Ajuster</span>
                    <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
                  </Link>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

