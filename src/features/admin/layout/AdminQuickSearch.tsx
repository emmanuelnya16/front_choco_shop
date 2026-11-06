import { ArrowRight, Loader2, Package, ReceiptText, Search, X } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router';
import { Price } from '@/components/ui/Primitives';
import { useAdminSearch } from '@/features/admin/api/useAdminQueries';
import { AdminReservationStatusBadge } from '@/features/admin/components/AdminReservationStatusBadge';
import { formatCmPhone } from '@/lib/utils/phone';

export interface AdminQuickSearchProps {
  open: boolean;
  onClose: () => void;
}

export function AdminQuickSearch({ open, onClose }: AdminQuickSearchProps) {
  const navigate = useNavigate();
  const [query, setQuery] = useState('');
  const inputRef = useRef<HTMLInputElement | null>(null);

  const { data, isFetching } = useAdminSearch(query);

  useEffect(() => {
    if (!open) {
      return undefined;
    }
    const timer = window.setTimeout(() => {
      inputRef.current?.focus();
    }, 20);

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        setQuery('');
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [open, onClose]);

  if (!open) {
    return null;
  }

  const handleClose = () => {
    setQuery('');
    onClose();
  };

  const trimmed = query.trim();
  const reservations = data?.reservations ?? [];
  const products = data?.products ?? [];
  const hasQuery = trimmed.length >= 2;
  const isEmpty = hasQuery && !isFetching && reservations.length === 0 && products.length === 0;

  const handleSelectReservation = (ref: string) => {
    handleClose();
    navigate(`/admin/reservations/${ref}`);
  };

  const handleSelectProduct = (id: string) => {
    handleClose();
    navigate(`/admin/catalogue/${id}`);
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Recherche rapide dans l’administration"
      className="fixed inset-0 z-50 flex items-start justify-center bg-glass-dark px-page pt-14 pb-6 backdrop-blur-xs sm:pt-20"
      onClick={(event) => {
        if (event.target === event.currentTarget) {
          handleClose();
        }
      }}
    >
      <div className="flex max-h-[82dvh] w-full max-w-[640px] flex-col overflow-hidden rounded-[var(--radius-lg)] border border-silver bg-white text-ink shadow-[var(--shadow-lg)]">
        <div className="flex items-center gap-2 border-b border-silver px-4 py-2.5">
          <Search className="h-5 w-5 shrink-0 text-grey" aria-hidden="true" />
          <input
            ref={inputRef}
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Rechercher une réservation (RES-…), un numéro, un client, un produit…"
            aria-label="Rechercher une réservation, un client ou un produit"
            className="h-11 flex-1 bg-transparent text-body text-ink placeholder:text-grey focus:outline-none"
          />
          {isFetching && (
            <Loader2 className="h-4 w-4 shrink-0 animate-spin text-red" aria-hidden="true" />
          )}
          <button
            type="button"
            onClick={handleClose}
            aria-label="Fermer la recherche rapide"
            className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-[var(--radius-md)] text-text-2 transition-colors hover:bg-surface hover:text-ink"
          >
            <X className="h-5 w-5" aria-hidden="true" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4">
          {!hasQuery && (
            <div className="py-6 text-center text-small text-text-2">
              Saisissez au moins 2 caractères : référence (<span className="font-mono font-semibold text-ink">RES-000104</span>), numéro (<span className="font-mono font-semibold text-ink">690</span>), nom du client ou nom d’un article.
            </div>
          )}

          {isEmpty && (
            <div className="py-8 text-center text-small text-text-2">
              Aucun résultat pour «&nbsp;<span className="font-semibold text-ink">{trimmed}</span>&nbsp;».
            </div>
          )}

          {reservations.length > 0 && (
            <section aria-label="Réservations trouvées" className="mb-5 last:mb-0">
              <div className="mb-2 flex items-center gap-1.5 px-2 text-label text-grey">
                <ReceiptText className="h-3.5 w-3.5" aria-hidden="true" />
                <span>RÉSERVATIONS ({reservations.length})</span>
              </div>
              <ul className="divide-y divide-silver rounded-[var(--radius-md)] border border-silver">
                {reservations.map((res) => (
                  <li key={res.ref}>
                    <button
                      type="button"
                      onClick={() => handleSelectReservation(res.ref)}
                      className="flex min-h-14 w-full flex-wrap items-center justify-between gap-3 px-3.5 py-2.5 text-left transition-colors hover:bg-surface"
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-mono text-small font-bold text-ink">
                            {res.ref}
                          </span>
                          <AdminReservationStatusBadge status={res.status} />
                        </div>
                        <p className="mt-1 truncate text-small text-text-2">
                          {res.customer.firstName} {res.customer.lastName ?? ''} ·{' '}
                          <span className="font-mono">{formatCmPhone(res.customer.phone)}</span>
                          {res.city ? ` · ${res.city}` : ''}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <Price amount={res.total} className="text-small" />
                        <ArrowRight className="h-4 w-4 text-grey" aria-hidden="true" />
                      </div>
                    </button>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {products.length > 0 && (
            <section aria-label="Produits trouvés">
              <div className="mb-2 flex items-center gap-1.5 px-2 text-label text-grey">
                <Package className="h-3.5 w-3.5" aria-hidden="true" />
                <span>CATALOGUE ({products.length})</span>
              </div>
              <ul className="divide-y divide-silver rounded-[var(--radius-md)] border border-silver">
                {products.map((prod) => (
                  <li key={prod.id}>
                    <button
                      type="button"
                      onClick={() => handleSelectProduct(prod.id)}
                      className="flex min-h-14 w-full items-center justify-between gap-3 px-3.5 py-2.5 text-left transition-colors hover:bg-surface"
                    >
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-small font-semibold text-ink">{prod.name}</p>
                        <p className="mt-0.5 text-xs text-text-2">
                          Stock total&nbsp;: <span className="font-semibold text-ink">{prod.totalStock}</span>
                          {prod.outOfStockCount > 0 && (
                            <span className="ml-2 text-danger">
                              ({prod.outOfStockCount} variante{prod.outOfStockCount > 1 ? 's' : ''} épuisée{prod.outOfStockCount > 1 ? 's' : ''})
                            </span>
                          )}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <Price amount={prod.price} className="text-small" />
                        <ArrowRight className="h-4 w-4 text-grey" aria-hidden="true" />
                      </div>
                    </button>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </div>
      </div>
    </div>
  );
}

