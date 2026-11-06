import { useState } from 'react';
import { Link } from 'react-router';
import {
  ArrowRight,
  Loader2,
  MapPin,
  MessageCircle,
  Phone,
  Search,
  ShoppingBag,
  Users,
  X,
} from 'lucide-react';
import { Price } from '@/components/ui/Primitives';
import { AdminReservationStatusBadge } from '@/features/admin/components/AdminReservationStatusBadge';
import { useAdminCustomersList } from '@/features/admin/api/useAdminQueries';
import type { AdminCustomerItem } from '@/features/admin/types';
import { formatCmPhoneInternational } from '@/lib/utils/phone';

function formatShortDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return new Intl.DateTimeFormat('fr-FR', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(d);
}

export default function AdminCustomersPage() {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCustomerPhone, setSelectedCustomerPhone] = useState<
    string | null
  >(null);

  const customersQuery = useAdminCustomersList(searchQuery);
  const customers = customersQuery.data?.items ?? [];

  const selectedCustomer: AdminCustomerItem | null =
    customers.find((c) => c.phone === selectedCustomerPhone) ??
    customers[0] ??
    null;

  return (
    <div className="space-y-6 pb-10">
      {/* En-tête + barre de recherche */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold uppercase tracking-tight text-ink">
            Répertoire des clients ({customersQuery.data?.total ?? 0})
          </h1>
          <p className="mt-0.5 font-body text-xs text-charcoal">
            Clients identifiés par SMS (+237), historique des réservations et
            adresses enregistrées.
          </p>
        </div>

        <div className="relative w-full sm:w-80">
          <Search
            className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-charcoal"
            aria-hidden="true"
          />
          <input
            type="search"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Nom, téléphone +237 ou ville..."
            aria-label="Rechercher un client par nom ou numéro"
            className="min-h-11 w-full rounded-sm border border-silver/60 bg-white pr-9 pl-9 font-body text-xs text-ink focus:border-ink focus:outline-none"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery('')}
              aria-label="Effacer la recherche client"
              className="absolute top-1/2 right-2 -translate-y-1/2 p-1 text-charcoal hover:text-ink"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      </div>

      {customersQuery.isLoading ? (
        <div className="flex min-h-[30vh] items-center justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-ink" />
        </div>
      ) : customers.length === 0 ? (
        <div className="rounded-sm border border-dashed border-silver bg-white p-10 text-center">
          <Users className="mx-auto h-8 w-8 text-charcoal" />
          <p className="mt-2 font-display text-base font-bold uppercase text-ink">
            Aucun client trouvé
          </p>
          <p className="mt-1 font-body text-xs text-charcoal">
            Essayez un autre nom ou numéro de téléphone (+237).
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
          {/* Liste des clients (7 colonnes sur lg) */}
          <div className="space-y-2.5 lg:col-span-7">
            {customers.map((customer) => {
              const isSelected = selectedCustomer?.phone === customer.phone;
              return (
                <button
                  key={customer.phone}
                  type="button"
                  onClick={() => setSelectedCustomerPhone(customer.phone)}
                  className={`flex w-full items-center justify-between gap-3 rounded-sm border p-3.5 text-left transition-colors ${
                    isSelected
                      ? 'border-ink bg-ink text-white'
                      : 'border-silver/50 bg-white text-ink hover:border-ink'
                  }`}
                >
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-body text-sm font-bold">
                        {customer.fullName}
                      </span>
                      <span
                        className={`rounded-sm px-2 py-0.5 font-mono text-[10px] font-bold uppercase ${
                          isSelected
                            ? 'bg-white/15 text-white'
                            : 'bg-surface text-charcoal'
                        }`}
                      >
                        {customer.city}
                      </span>
                    </div>
                    <p
                      className={`mt-0.5 font-mono text-xs ${
                        isSelected ? 'text-silver' : 'text-charcoal'
                      }`}
                    >
                      {formatCmPhoneInternational(customer.phone)}
                    </p>
                  </div>

                  <div className="shrink-0 text-right">
                    <Price
                      amount={customer.confirmedTotalFcfa}
                      className={`font-bold ${
                        isSelected ? 'text-white' : 'text-ink'
                      }`}
                    />
                    <p
                      className={`mt-0.5 font-body text-[11px] ${
                        isSelected ? 'text-silver' : 'text-charcoal'
                      }`}
                    >
                      {customer.reservationsCount} réservation
                      {customer.reservationsCount > 1 ? 's' : ''} ·{' '}
                      {formatShortDate(customer.lastActivityAt)}
                    </p>
                  </div>
                </button>
              );
            })}
          </div>

          {/* Fiche détaillée du client sélectionné (5 colonnes sur lg) */}
          <div className="lg:col-span-5">
            {selectedCustomer && (
              <aside
                aria-label={`Fiche client ${selectedCustomer.fullName}`}
                className="space-y-5 rounded-sm border border-silver/50 bg-white p-4 sm:p-5"
              >
                <div className="border-b border-silver/30 pb-3.5">
                  <span className="font-mono text-[10px] font-bold uppercase tracking-wider text-charcoal">
                    Fiche client · {selectedCustomer.city}
                  </span>
                  <h2 className="mt-0.5 font-display text-xl font-bold uppercase text-ink">
                    {selectedCustomer.fullName}
                  </h2>
                  <p className="mt-0.5 font-mono text-xs font-bold text-charcoal">
                    {formatCmPhoneInternational(selectedCustomer.phone)}
                  </p>

                  <div className="mt-3 flex flex-wrap gap-2">
                    <a
                      href={`tel:${selectedCustomer.phone}`}
                      className="inline-flex min-h-10 items-center gap-1.5 rounded-sm border border-silver/60 bg-surface px-3 py-1.5 font-body text-xs font-semibold text-ink hover:border-ink"
                    >
                      <Phone className="h-3.5 w-3.5" aria-hidden="true" />
                      Appeler
                    </a>
                    <a
                      href={`https://wa.me/${selectedCustomer.phone.replace(/\D/g, '')}`}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex min-h-10 items-center gap-1.5 rounded-sm bg-ink px-3 py-1.5 font-body text-xs font-bold text-white hover:bg-charcoal"
                    >
                      <MessageCircle className="h-3.5 w-3.5" aria-hidden="true" />
                      WhatsApp
                    </a>
                  </div>
                </div>

                {/* Adresses enregistrées */}
                <div>
                  <h3 className="flex items-center gap-1.5 font-display text-xs font-bold uppercase tracking-wider text-charcoal">
                    <MapPin className="h-3.5 w-3.5 text-red" />
                    Adresses enregistrées ({selectedCustomer.addresses.length})
                  </h3>
                  {selectedCustomer.addresses.length === 0 ? (
                    <p className="mt-2 font-body text-xs text-charcoal">
                      Aucune adresse enregistrée (retrait en boutique).
                    </p>
                  ) : (
                    <div className="mt-2 space-y-2">
                      {selectedCustomer.addresses.map((addr) => (
                        <div
                          key={addr.id}
                          className="rounded-sm border border-silver/40 bg-surface p-2.5 font-body text-xs"
                        >
                          <p className="font-bold text-ink">
                            {addr.label} · {addr.city} ({addr.quarter})
                          </p>
                          <p className="mt-0.5 text-charcoal">{addr.landmark}</p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Historique des réservations du client */}
                <div>
                  <h3 className="flex items-center gap-1.5 font-display text-xs font-bold uppercase tracking-wider text-charcoal">
                    <ShoppingBag className="h-3.5 w-3.5 text-red" />
                    Historique des réservations (
                    {selectedCustomer.reservations.length})
                  </h3>
                  <div className="mt-2 space-y-2">
                    {selectedCustomer.reservations.map((res) => (
                      <Link
                        key={res.ref}
                        to={`/admin/reservations/${res.ref}`}
                        className="flex items-center justify-between gap-2 rounded-sm border border-silver/40 bg-surface p-2.5 transition-colors hover:border-ink hover:bg-white"
                      >
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="font-mono text-xs font-bold text-ink">
                              {res.ref}
                            </span>
                            <AdminReservationStatusBadge status={res.status} />
                          </div>
                          <p className="mt-0.5 truncate font-body text-[11px] text-charcoal">
                            {res.firstItemSummary} · {res.itemsCount} art.
                          </p>
                        </div>
                        <div className="flex shrink-0 items-center gap-1.5">
                          <Price
                            amount={res.total}
                            className="font-mono text-xs font-bold text-ink"
                          />
                          <ArrowRight className="h-3.5 w-3.5 text-charcoal" />
                        </div>
                      </Link>
                    ))}
                  </div>
                </div>
              </aside>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

