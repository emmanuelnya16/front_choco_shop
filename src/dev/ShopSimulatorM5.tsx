import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Ban,
  Camera,
  ChevronsRight,
  PackageCheck,
  RotateCcw,
  XCircle,
} from 'lucide-react';
import { useState } from 'react';
import { Link } from 'react-router';
import { api, ApiError } from '@/lib/api/client';
import { endpoints } from '@/lib/api/endpoints';
import { qk } from '@/lib/api/queryKeys';
import { haptic } from '@/lib/utils/haptics';
import type { ReservationDetailResponse, ReservationsListResponse } from '@/types/api';
import { isFinalStatus, STATUS_META } from '@/types/reservationStatus';

const DEV_LIST_KEY = ['dev', 'm5-simulator', 'reservations'] as const;

/**
 * Simulateur boutique enrichi (§3.3 M5) : fait avancer une réservation étape par étape.
 * Astuce : ouvrez « Mes réservations » ou un détail dans un autre onglet — les changements y arrivent
 * en moins de 30 s (synchronisation entre onglets des mocks + rechargement périodique).
 */
export function ShopSimulatorM5() {
  const queryClient = useQueryClient();
  const [selectedRef, setSelectedRef] = useState('RES-000106');
  const [rejectReason, setRejectReason] = useState('Montant incorrect');
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);

  const listQuery = useQuery({
    queryKey: DEV_LIST_KEY,
    queryFn: () => api.get<ReservationsListResponse>(endpoints.reservations.list),
  });

  const reservations = listQuery.data ?? [];
  const selected = reservations.find((r) => r.ref === selectedRef);
  const finished = selected ? isFinalStatus(selected.status) : false;

  const refreshEverything = async (ref: string) => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: DEV_LIST_KEY }),
      queryClient.invalidateQueries({ queryKey: qk.reservations() }),
      queryClient.invalidateQueries({ queryKey: qk.reservation(ref) }),
    ]);
  };

  const run = async (label: string, action: () => Promise<unknown>) => {
    const ref = selectedRef.trim().toUpperCase();
    if (!ref) return;
    setBusy(true);
    setFeedback(null);
    try {
      const result = await action();
      const updated = result as Partial<ReservationDetailResponse> | undefined;
      setFeedback(
        updated?.status
          ? `${label} · ${ref} → « ${STATUS_META[updated.status].label} »`
          : `${label} effectué.`,
      );
      haptic('success');
    } catch (err) {
      setFeedback(
        err instanceof ApiError ? `Erreur (${err.status}) : ${err.message}` : 'Erreur de simulation.',
      );
    } finally {
      await refreshEverything(ref);
      setBusy(false);
    }
  };

  const ref = selectedRef.trim().toUpperCase();
  const buttonBase =
    'inline-flex min-h-[48px] items-center justify-center gap-2 rounded-[var(--radius-md)] px-4 py-2.5 text-small font-bold transition-opacity disabled:opacity-50';

  return (
    <section aria-labelledby="dev-shop-simulator-m5">
      <div className="flex flex-wrap items-baseline justify-between gap-2 border-b border-silver pb-3">
        <div>
          <h2 id="dev-shop-simulator-m5" className="text-h2 text-ink">
            Simulateur boutique (Module M5 · Suivi)
          </h2>
          <p className="text-small text-text-2">
            Faites avancer une réservation étape par étape. Ouvrez le suivi dans un autre onglet :
            les changements y apparaissent en moins de 30 s.
          </p>
        </div>
        <span className="text-label text-ink">CLIENT 690 00 00 01</span>
      </div>

      <div className="mt-5 space-y-5 rounded-[var(--radius-md)] border border-silver bg-surface p-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
          <div className="flex-1">
            <label htmlFor="m5-simulator-ref" className="block text-label text-text-2">
              RÉSERVATION
            </label>
            <select
              id="m5-simulator-ref"
              value={selectedRef}
              onChange={(e) => setSelectedRef(e.target.value)}
              className="mt-1.5 min-h-[44px] w-full rounded-[var(--radius-md)] border border-silver bg-white px-3 font-mono text-small font-bold text-ink focus:border-ink focus:outline-none"
            >
              {reservations.map((r) => (
                <option key={r.ref} value={r.ref}>
                  {r.ref} · {STATUS_META[r.status].label} ·{' '}
                  {r.receptionMode === 'pickup' ? 'Retrait' : 'Livraison'}
                </option>
              ))}
            </select>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link
              to="/reservations"
              target="_blank"
              className="inline-flex min-h-[44px] items-center rounded-[var(--radius-md)] border border-silver bg-white px-3.5 text-small font-bold text-ink hover:bg-surface"
            >
              Mes réservations ↗
            </Link>
            <Link
              to={`/reservations/${ref}`}
              target="_blank"
              className="inline-flex min-h-[44px] items-center rounded-[var(--radius-md)] border border-silver bg-white px-3.5 text-small font-bold text-ink hover:bg-surface"
            >
              Détail ↗
            </Link>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <button
            type="button"
            disabled={busy || finished}
            onClick={() => void run('Étape suivante', () => api.post(endpoints.mock.advanceReservation(ref)))}
            className={`${buttonBase} bg-ink text-white`}
          >
            <ChevronsRight className="h-4 w-4 shrink-0" aria-hidden="true" />
            Étape suivante
          </button>

          <div className="grid grid-cols-3 gap-2 sm:col-span-1">
            {[1, 2, 3].map((count) => (
              <button
                key={count}
                type="button"
                disabled={busy || finished}
                onClick={() =>
                  void run(`Colis prêt + ${count} photo${count > 1 ? 's' : ''}`, () =>
                    api.post(endpoints.mock.packageReady(ref), { count }),
                  )
                }
                className={`${buttonBase} bg-red px-2 text-white`}
                aria-label={`Colis prêt avec ${count} photo${count > 1 ? 's' : ''}`}
              >
                <Camera className="h-4 w-4 shrink-0" aria-hidden="true" />
                {count}
              </button>
            ))}
          </div>

          <button
            type="button"
            disabled={busy || finished}
            onClick={() =>
              void run('Livrée / retirée', () => api.post(endpoints.mock.completeReservation(ref)))
            }
            className={`${buttonBase} bg-success text-white`}
          >
            <PackageCheck className="h-4 w-4 shrink-0" aria-hidden="true" />
            Marquer livrée / retirée
          </button>

          <div className="flex gap-2 sm:col-span-2 lg:col-span-2">
            <label htmlFor="m5-reject-reason" className="sr-only">
              Motif du rejet
            </label>
            <input
              id="m5-reject-reason"
              type="text"
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              className="min-h-[48px] flex-1 rounded-[var(--radius-md)] border border-silver bg-white px-3 text-small text-ink focus:border-ink focus:outline-none"
            />
            <button
              type="button"
              disabled={busy || finished}
              onClick={() =>
                void run('Paiement rejeté', () =>
                  api.post(endpoints.mock.rejectReservation(ref), { reason: rejectReason }),
                )
              }
              className={`${buttonBase} border border-danger bg-white text-danger`}
            >
              <XCircle className="h-4 w-4 shrink-0" aria-hidden="true" />
              Rejeter le paiement
            </button>
          </div>

          <button
            type="button"
            disabled={busy || finished}
            onClick={() =>
              void run('Annulée par la boutique', () => api.post(endpoints.mock.shopCancelReservation(ref)))
            }
            className={`${buttonBase} bg-danger text-white`}
          >
            <Ban className="h-4 w-4 shrink-0" aria-hidden="true" />
            Annuler côté boutique
          </button>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-silver pt-4">
          <p className="text-small text-text-2">
            {selected
              ? `${selected.ref} · ${STATUS_META[selected.status].label} · ${selected.timeline.length} étape${selected.timeline.length > 1 ? 's' : ''} datée${selected.timeline.length > 1 ? 's' : ''}`
              : 'Choisissez une réservation.'}
          </p>
          <button
            type="button"
            disabled={busy}
            onClick={() => void run('Réinitialisation', () => api.post(endpoints.mock.resetReservations))}
            className="inline-flex min-h-[44px] items-center gap-2 rounded-[var(--radius-md)] border border-silver bg-white px-3.5 text-small font-bold text-ink hover:bg-surface disabled:opacity-50"
          >
            <RotateCcw className="h-4 w-4" aria-hidden="true" />
            Remettre les réservations à zéro
          </button>
        </div>

        {feedback ? (
          <div
            role="status"
            aria-live="polite"
            className="rounded-[var(--radius-sm)] border border-silver bg-white px-4 py-3 font-mono text-small text-ink"
          >
            {feedback}
          </div>
        ) : null}
      </div>
    </section>
  );
}
