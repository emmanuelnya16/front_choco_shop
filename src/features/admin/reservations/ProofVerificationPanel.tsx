import {
  AlertTriangle,
  Check,
  CheckCircle2,
  Copy,
  Maximize2,
  Phone,
  ShieldCheck,
  X,
  XCircle,
} from 'lucide-react';
import { useState } from 'react';
import { Link } from 'react-router';
import { Button } from '@/components/ui/Button';
import { Price } from '@/components/ui/Primitives';
import { Sheet } from '@/components/ui/Sheet';
import {
  useAdminRejectPayment,
  useAdminValidatePayment,
} from '@/features/admin/api/useAdminQueries';
import { cn } from '@/lib/utils/cn';
import { formatDate } from '@/lib/utils/date';
import { formatCmPhone } from '@/lib/utils/phone';
import { useToastStore } from '@/stores/toastStore';
import type { Reservation } from '@/types/domain';

const QUICK_REJECTION_REASONS = [
  'Montant incorrect',
  'Capture illisible ou coupée',
  'Transaction introuvable sur le compte marchand',
  'Numéro ou destinataire erroné',
] as const;

export interface ProofVerificationPanelProps {
  reservation: Reservation;
  duplicateProofRefs: string[];
}

export function ProofVerificationPanel({
  reservation,
  duplicateProofRefs,
}: ProofVerificationPanelProps) {
  const showToast = useToastStore((s) => s.show);
  const validateMutation = useAdminValidatePayment(reservation.ref);
  const rejectMutation = useAdminRejectPayment(reservation.ref);

  const [zoomOpen, setZoomOpen] = useState(false);
  const [rejectSheetOpen, setRejectSheetOpen] = useState(false);
  const [rejectReason, setRejectReason] = useState('');
  const [rejectError, setRejectError] = useState<string | null>(null);
  const [copiedField, setCopiedField] = useState<'phone' | 'tx' | null>(null);

  const proof = reservation.proof;
  const isPendingValidation = reservation.status === 'pending_validation';
  const hasDuplicates = duplicateProofRefs.length > 0;

  if (!proof && !isPendingValidation) {
    return null;
  }

  const handleCopy = async (value: string, field: 'phone' | 'tx') => {
    try {
      await navigator.clipboard?.writeText(value);
      setCopiedField(field);
      window.setTimeout(() => setCopiedField(null), 1800);
    } catch {
      // Ignorer si clipboard indisponible
    }
  };

  const handleValidatePayment = async () => {
    try {
      await validateMutation.mutateAsync({});
      showToast({
        message: 'Paiement validé · le client a été notifié',
        subtitle: `Réservation ${reservation.ref} confirmée`,
      });
    } catch {
      showToast({
        message: 'Impossible de valider le paiement.',
      });
    }
  };

  const handleConfirmReject = async () => {
    const trimmed = rejectReason.trim();
    if (trimmed.length < 3) {
      setRejectError(
        'Veuillez sélectionner ou saisir un motif d’au moins 3 caractères.',
      );
      return;
    }
    setRejectError(null);
    try {
      await rejectMutation.mutateAsync({ reason: trimmed });
      setRejectSheetOpen(false);
      setRejectReason('');
      showToast({
        message: 'Preuve rejetée · le client a été informé',
        subtitle: trimmed,
      });
    } catch {
      setRejectError('Impossible d’enregistrer le rejet. Veuillez réessayer.');
    }
  };

  return (
    <section
      aria-labelledby="proof-verification-heading"
      className={cn(
        'rounded-[var(--radius-lg)] border bg-white p-5 sm:p-6',
        isPendingValidation
          ? 'border-red shadow-[var(--shadow-md)]'
          : 'border-silver',
      )}
    >
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2 border-b border-silver pb-3.5">
        <div>
          <span className="text-label text-red uppercase">
            {isPendingValidation
              ? 'ACTION PRIORITAIRE · VÉRIFICATION DE CAPTURE'
              : 'CAPTURE DE PAIEMENT MOBILE MONEY'}
          </span>
          <h2 id="proof-verification-heading" className="mt-0.5 text-h3 text-ink">
            Vérification du paiement Mobile Money
          </h2>
        </div>

        {proof?.uploadedAt && (
          <span className="text-xs text-text-2">
            Reçue le {formatDate(proof.uploadedAt)}
          </span>
        )}
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        {/* Colonne gauche : aperçu de la capture Mobile Money */}
        <div className="lg:col-span-5">
          {proof?.thumbnailUrl ? (
            <div className="relative overflow-hidden rounded-[var(--radius-md)] border border-silver bg-surface">
              <button
                type="button"
                onClick={() => setZoomOpen(true)}
                aria-label="Agrandir la capture de paiement Mobile Money"
                className="group relative block w-full text-left"
              >
                <img
                  src={proof.thumbnailUrl}
                  alt={`Capture de paiement Mobile Money pour ${reservation.ref}`}
                  className="max-h-[360px] w-full object-contain p-2 transition-transform duration-base group-hover:scale-[1.02]"
                />
                <span className="absolute right-3 bottom-3 inline-flex min-h-9 items-center gap-1.5 rounded-[var(--radius-full)] bg-ink px-3 py-1.5 text-xs font-semibold text-white">
                  <Maximize2 className="h-3.5 w-3.5" aria-hidden="true" />
                  <span>Agrandir</span>
                </span>
              </button>
            </div>
          ) : (
            <div className="flex h-48 items-center justify-center rounded-[var(--radius-md)] border border-dashed border-silver bg-surface p-4 text-center text-small text-text-2">
              Aucune image de capture jointe.
            </div>
          )}
        </div>

        {/* Colonne droite : informations de contrôle et boutons de décision */}
        <div className="flex flex-col justify-between gap-5 lg:col-span-7">
          <div className="space-y-4">
            {/* Montant attendu mis en avant */}
            <div className="rounded-[var(--radius-md)] border border-silver bg-surface p-4">
              <p className="text-label text-grey uppercase">
                MONTANT EXACT ATTENDU SUR LA CAPTURE
              </p>
              <p className="mt-1">
                <Price amount={reservation.total} className="text-h1 text-ink" />
              </p>
              <p className="mt-1 text-xs text-text-2">
                Sous-total articles&nbsp;: <Price amount={reservation.subtotal} className="text-xs font-semibold" /> · Frais de livraison&nbsp;: <Price amount={reservation.deliveryFee} className="text-xs font-semibold" />
              </p>
            </div>

            {/* Détails opérateur, numéro payeur, ID transaction */}
            <dl className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="rounded-[var(--radius-md)] border border-silver p-3">
                <dt className="text-label text-grey uppercase">Opérateur déclaré</dt>
                <dd className="mt-1 text-small font-bold text-ink">
                  {proof?.operator === 'mtn' ? 'MTN Mobile Money' : 'Orange Money'}
                </dd>
              </div>

              <div className="rounded-[var(--radius-md)] border border-silver p-3">
                <dt className="text-label text-grey uppercase">Numéro payeur</dt>
                <dd className="mt-1 flex items-center justify-between gap-2">
                  <span className="font-mono text-small font-bold text-ink">
                    {formatCmPhone(
                      proof?.payerPhone ?? reservation.customer?.phone ?? '+237690000001',
                    )}
                  </span>
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() =>
                        void handleCopy(
                          proof?.payerPhone ?? reservation.customer?.phone ?? '',
                          'phone',
                        )
                      }
                      aria-label="Copier le numéro payeur"
                      className="inline-flex h-8 w-8 items-center justify-center rounded-[var(--radius-sm)] text-text-2 hover:bg-surface hover:text-ink"
                    >
                      {copiedField === 'phone' ? (
                        <Check className="h-3.5 w-3.5 text-success" aria-hidden="true" />
                      ) : (
                        <Copy className="h-3.5 w-3.5" aria-hidden="true" />
                      )}
                    </button>
                    <a
                      href={`tel:${proof?.payerPhone ?? reservation.customer?.phone ?? ''}`}
                      aria-label="Appeler le numéro payeur"
                      className="inline-flex h-8 w-8 items-center justify-center rounded-[var(--radius-sm)] text-text-2 hover:bg-surface hover:text-ink"
                    >
                      <Phone className="h-3.5 w-3.5" aria-hidden="true" />
                    </a>
                  </div>
                </dd>
              </div>

              {proof?.transactionId && (
                <div className="rounded-[var(--radius-md)] border border-silver p-3 sm:col-span-2">
                  <dt className="text-label text-grey uppercase">ID de transaction</dt>
                  <dd className="mt-1 flex items-center justify-between gap-2">
                    <span className="font-mono text-small font-bold text-ink">
                      {proof.transactionId}
                    </span>
                    <button
                      type="button"
                      onClick={() => void handleCopy(proof.transactionId ?? '', 'tx')}
                      aria-label="Copier l’identifiant de transaction"
                      className="inline-flex min-h-9 items-center gap-1 rounded-[var(--radius-sm)] px-2 text-xs font-semibold text-text-2 hover:bg-surface hover:text-ink"
                    >
                      {copiedField === 'tx' ? (
                        <>
                          <Check className="h-3.5 w-3.5 text-success" aria-hidden="true" />
                          <span>Copié</span>
                        </>
                      ) : (
                        <>
                          <Copy className="h-3.5 w-3.5" aria-hidden="true" />
                          <span>Copier</span>
                        </>
                      )}
                    </button>
                  </dd>
                </div>
              )}
            </dl>

            {/* Contrôle d'unicité SHA-256 */}
            {hasDuplicates ? (
              <div
                role="alert"
                className="flex items-start gap-2.5 rounded-[var(--radius-md)] border border-danger bg-surface p-3.5 text-small text-danger"
              >
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
                <div>
                  <p className="font-bold">
                    Attention&nbsp;: cette capture a déjà été utilisée sur{' '}
                    {duplicateProofRefs.map((dupRef, idx) => (
                      <span key={dupRef}>
                        {idx > 0 && ', '}
                        <Link
                          to={`/admin/reservations/${dupRef}`}
                          className="font-mono underline"
                        >
                          {dupRef}
                        </Link>
                      </span>
                    ))}
                  </p>
                  <p className="mt-0.5 text-xs">
                    Vérifiez attentivement votre solde Mobile Money avant de valider.
                  </p>
                </div>
              </div>
            ) : (
              <div className="flex items-center gap-2 rounded-[var(--radius-md)] border border-silver bg-surface px-3.5 py-2.5 text-xs text-ink">
                <ShieldCheck className="h-4 w-4 shrink-0 text-success" aria-hidden="true" />
                <span>
                  <strong>Empreinte unique vérifiée ✓</strong> — Cette capture n’a été utilisée sur aucune autre réservation.
                </span>
              </div>
            )}
          </div>

          {/* Boutons de décision */}
          {(isPendingValidation ||
            reservation.status === 'reserved' ||
            reservation.status === 'payment_rejected') && (
            <div className="flex flex-col gap-3 border-t border-silver pt-4 sm:flex-row">
              <Button
                variant="primary"
                size="lg"
                className="flex-1"
                loading={validateMutation.isPending}
                onClick={() => void handleValidatePayment()}
                iconLeft={<CheckCircle2 className="h-5 w-5" aria-hidden="true" />}
              >
                Valider le paiement ✓
              </Button>

              <Button
                variant="outline"
                size="lg"
                onClick={() => {
                  setRejectError(null);
                  setRejectSheetOpen(true);
                }}
                iconLeft={<XCircle className="h-5 w-5 text-danger" aria-hidden="true" />}
              >
                Rejeter la preuve…
              </Button>
            </div>
          )}
        </div>
      </div>

      {/* Feuille de rejet motivé */}
      <Sheet
        open={rejectSheetOpen}
        onClose={() => setRejectSheetOpen(false)}
        title={`Rejeter la preuve · ${reservation.ref}`}
      >
        <div className="space-y-4 pb-4">
          <p className="text-small text-text-2">
            Choisissez un motif rapide ou précisez la raison du rejet.{' '}
            <strong className="text-ink">
              Ce motif sera affiché tel quel au client et envoyé par notification.
            </strong>
          </p>

          <div className="flex flex-wrap gap-2">
            {QUICK_REJECTION_REASONS.map((reasonOption) => {
              const selected = rejectReason === reasonOption;
              return (
                <button
                  key={reasonOption}
                  type="button"
                  onClick={() => {
                    setRejectReason(reasonOption);
                    setRejectError(null);
                  }}
                  aria-pressed={selected}
                  className={cn(
                    'min-h-11 rounded-[var(--radius-full)] border px-3.5 py-2 text-left text-xs font-semibold transition-colors',
                    selected
                      ? 'border-ink bg-ink text-white'
                      : 'border-silver bg-surface text-ink hover:border-ink',
                  )}
                >
                  {reasonOption}
                </button>
              );
            })}
          </div>

          <div>
            <label
              htmlFor="admin-reject-reason"
              className="mb-1.5 block text-small font-semibold text-ink"
            >
              Motif communiqué au client (obligatoire)
            </label>
            <textarea
              id="admin-reject-reason"
              rows={3}
              value={rejectReason}
              onChange={(e) => {
                setRejectReason(e.target.value);
                if (rejectError) setRejectError(null);
              }}
              placeholder="Ex. : Montant reçu de 30 000 FCFA au lieu de 46 500 FCFA…"
              className="w-full rounded-[var(--radius-md)] border border-silver bg-white p-3 text-small text-ink placeholder:text-grey focus:border-ink focus:outline-none"
            />
            {rejectError && (
              <p role="alert" className="mt-1.5 text-xs font-semibold text-danger">
                {rejectError}
              </p>
            )}
          </div>

          <div className="flex flex-col-reverse gap-2.5 pt-2 sm:flex-row sm:justify-end">
            <Button
              variant="ghost"
              size="md"
              onClick={() => setRejectSheetOpen(false)}
            >
              Annuler
            </Button>
            <Button
              variant="danger"
              size="md"
              loading={rejectMutation.isPending}
              onClick={() => void handleConfirmReject()}
            >
              Confirmer le rejet
            </Button>
          </div>
        </div>
      </Sheet>

      {/* Visionneuse plein écran de la capture */}
      {zoomOpen && proof?.thumbnailUrl && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={`Capture Mobile Money plein écran · ${reservation.ref}`}
          className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-glass-dark p-4 backdrop-blur-xs"
          onClick={(e) => {
            if (e.target === e.currentTarget) setZoomOpen(false);
          }}
        >
          <div className="mb-3 flex w-full max-w-3xl items-center justify-between text-white">
            <span className="font-mono text-small font-bold">
              {reservation.ref} · Attendu&nbsp;: <Price amount={reservation.total} />
            </span>
            <button
              type="button"
              onClick={() => setZoomOpen(false)}
              aria-label="Fermer l’aperçu plein écran"
              className="inline-flex h-11 w-11 items-center justify-center rounded-[var(--radius-full)] bg-ink-2 text-white hover:bg-red"
            >
              <X className="h-5 w-5" aria-hidden="true" />
            </button>
          </div>
          <div className="max-h-[82dvh] max-w-3xl overflow-auto rounded-[var(--radius-lg)] bg-white p-3">
            <img
              src={proof.thumbnailUrl}
              alt={`Capture plein écran ${reservation.ref}`}
              className="max-h-[76dvh] w-auto object-contain"
            />
          </div>
        </div>
      )}
    </section>
  );
}

