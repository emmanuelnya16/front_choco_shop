import {
  AlertTriangle,
  ArrowLeft,
  Ban,
  CheckCircle2,
  Clock,
  MessageCircle,
  Package,
  PackageCheck,
  Phone,
  Send,
  Store,
  Truck,
} from 'lucide-react';
import { useState } from 'react';
import { Link, useParams } from 'react-router';
import { Button } from '@/components/ui/Button';
import { Price, Skeleton } from '@/components/ui/Primitives';
import { Sheet } from '@/components/ui/Sheet';
import {
  useAdminAddNote,
  useAdminAdvanceStatus,
  useAdminCancelReservation,
  useAdminReservationDetail,
  useAdminValidatePayment,
} from '@/features/admin/api/useAdminQueries';
import { AdminReservationStatusBadge } from '@/features/admin/components/AdminReservationStatusBadge';
import { PackagePhotosUploader } from '@/features/admin/reservations/PackagePhotosUploader';
import { ProofVerificationPanel } from '@/features/admin/reservations/ProofVerificationPanel';
import { useSeo } from '@/lib/seo/useSeo';
import { cn } from '@/lib/utils/cn';
import { formatCountdown, formatDate } from '@/lib/utils/date';
import { formatCmPhone } from '@/lib/utils/phone';
import { formatPrice } from '@/lib/utils/price';
import { useToastStore } from '@/stores/toastStore';
import type { Reservation, ReservationActor } from '@/types/domain';
import {
  isFinalStatus,
  STATUS_META,
  type ReservationStatusCode,
} from '@/types/reservationStatus';

const SHOP_CANCEL_REASONS = [
  'Article endommagé constaté au comptoir',
  'Rupture de stock en boutique',
  'Demande téléphonique du client',
  'Paiement non reçu après relance',
] as const;

const ACTOR_LABELS: Record<ReservationActor, string> = {
  shop: 'Boutique',
  client: 'Client',
  system: 'Système',
};

function buildClientWhatsappUrl(reservation: Reservation): string {
  const rawPhone =
    reservation.customer?.phone ??
    reservation.deliveryAddress?.recipientPhone ??
    '+237690000001';
  const digits = rawPhone.replace(/\D/g, '');
  const firstName = reservation.customer?.firstName ?? '';

  let message = `Bonjour ${firstName}, ici la boutique DR Choco L’Incompris à propos de votre réservation ${reservation.ref} (${formatPrice(reservation.total)}).`;
  if (reservation.status === 'reserved') {
    message +=
      ' Vos articles sont mis de côté : n’hésitez pas à envoyer votre capture Mobile Money pour valider votre réservation.';
  } else if (reservation.status === 'payment_rejected') {
    message += ` Votre capture n’a pas pu être validée (${reservation.rejection?.reason ?? 'motif indiqué dans votre suivi'}). Vous pouvez renvoyer une nouvelle capture depuis votre lien de suivi.`;
  } else if (reservation.status === 'ready_for_pickup') {
    message +=
      ' Votre colis est prêt à la boutique d’Akwa ! Vous pouvez passer le retirer avec votre référence.';
  }

  return `https://wa.me/${digits}?text=${encodeURIComponent(message)}`;
}

export default function AdminReservationDetailPage() {
  const params = useParams<{ ref: string }>();
  const ref = (params.ref ?? '').toUpperCase();

  useSeo({
    title: `Réservation ${ref} — Administration DR Choco`,
    description: `Traitement opérationnel de la réservation ${ref}.`,
    noindex: true,
  });

  const showToast = useToastStore((s) => s.show);
  const { data, isLoading, isError, refetch } = useAdminReservationDetail(ref);
  const advanceStatusMutation = useAdminAdvanceStatus(ref);
  const validatePaymentMutation = useAdminValidatePayment(ref);
  const cancelMutation = useAdminCancelReservation(ref);
  const addNoteMutation = useAdminAddNote(ref);

  const [checkedItemIds, setCheckedItemIds] = useState<Record<string, boolean>>({});
  const [cancelSheetOpen, setCancelSheetOpen] = useState(false);
  const [cancelReason, setCancelReason] = useState('');
  const [cancelError, setCancelError] = useState<string | null>(null);
  const [noteText, setNoteText] = useState('');

  if (isLoading) {
    return (
      <div className="space-y-5">
        <Skeleton className="h-12 w-64" />
        <Skeleton className="h-56 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (isError || !data) {
    return (
      <div className="space-y-4">
        <Button
          href="/admin/reservations"
          variant="ghost"
          size="sm"
          iconLeft={<ArrowLeft className="h-4 w-4" aria-hidden="true" />}
        >
          Retour aux réservations
        </Button>

        <div
          role="alert"
          className="rounded-[var(--radius-lg)] border border-danger bg-white p-6 text-center"
        >
          <p className="text-h3 text-ink">Réservation {ref} introuvable</p>
          <p className="mt-1 text-small text-text-2">
            Vérifiez la référence ou retournez à la liste des réservations.
          </p>
          <div className="mt-4 flex justify-center gap-3">
            <Button variant="outline" size="sm" onClick={() => void refetch()}>
              Réessayer
            </Button>
            <Button href="/admin/reservations" variant="dark" size="sm">
              Voir toutes les réservations
            </Button>
          </div>
        </div>
      </div>
    );
  }

  const { reservation, duplicateProofRefs, internalNotes, availableAgencies } = data;
  const isFinal = isFinalStatus(reservation.status);
  const wasPaid =
    reservation.status === 'confirmed' ||
    reservation.status === 'preparing' ||
    reservation.status === 'handed_to_agency' ||
    reservation.status === 'ready_for_pickup' ||
    reservation.status === 'in_delivery';

  const baseNow = new Date(
    reservation.serverTime ?? reservation.updatedAt ?? reservation.createdAt,
  ).getTime();
  const remainingMs = new Date(reservation.expiresAt).getTime() - baseNow;

  const handleAdvanceStatus = async (
    nextStatus: ReservationStatusCode,
    toastLabel: string,
  ) => {
    try {
      await advanceStatusMutation.mutateAsync({ status: nextStatus });
      showToast({
        message: toastLabel,
        subtitle: `Réservation ${reservation.ref}`,
      });
    } catch {
      showToast({
        message: 'Impossible de mettre à jour le statut.',
      });
    }
  };

  const handleManualPaymentValidation = async () => {
    try {
      await validatePaymentMutation.mutateAsync({
        note: 'Paiement vérifié et validé manuellement par la boutique.',
      });
      showToast({
        message: 'Paiement validé manuellement · réservation confirmée',
      });
    } catch {
      showToast({
        message: 'Impossible de valider manuellement le paiement.',
      });
    }
  };

  const handleConfirmShopCancel = async () => {
    const trimmed = cancelReason.trim();
    if (trimmed.length < 3) {
      setCancelError('Veuillez choisir ou saisir un motif d’annulation.');
      return;
    }
    setCancelError(null);
    try {
      await cancelMutation.mutateAsync({ reason: trimmed });
      setCancelSheetOpen(false);
      setCancelReason('');
      showToast({
        message: 'Réservation annulée · stocks remis en vente',
        subtitle: trimmed,
      });
    } catch {
      setCancelError('Impossible d’annuler cette réservation.');
    }
  };

  const handleAddInternalNote = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = noteText.trim();
    if (trimmed.length < 2) return;
    try {
      await addNoteMutation.mutateAsync({ text: trimmed });
      setNoteText('');
      showToast({ message: 'Note interne enregistrée' });
    } catch {
      showToast({ message: 'Erreur lors de l’ajout de la note.' });
    }
  };

  const toggleItemChecked = (itemId: string) => {
    setCheckedItemIds((prev) => ({ ...prev, [itemId]: !prev[itemId] }));
  };

  return (
    <div className="space-y-6">
      {/* Barre supérieure de navigation et d'identification */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Button
          href="/admin/reservations"
          variant="ghost"
          size="sm"
          iconLeft={<ArrowLeft className="h-4 w-4" aria-hidden="true" />}
        >
          Retour aux réservations
        </Button>

        {!isFinal && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              setCancelError(null);
              setCancelSheetOpen(true);
            }}
            iconLeft={<Ban className="h-4 w-4 text-danger" aria-hidden="true" />}
          >
            Annuler la réservation…
          </Button>
        )}
      </div>

      {/* En-tête de la réservation */}
      <header className="rounded-[var(--radius-lg)] border border-silver bg-white p-5 sm:p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="flex flex-wrap items-center gap-2.5">
              <h1 className="font-mono text-h2 text-ink">
                Réservation {reservation.ref}
              </h1>
              <AdminReservationStatusBadge status={reservation.status} />
              <span className="inline-flex items-center gap-1.5 rounded-[var(--radius-full)] border border-silver bg-surface px-3 py-1 text-xs font-semibold text-ink">
                {reservation.receptionMode === 'pickup' ? (
                  <>
                    <Store className="h-3.5 w-3.5" aria-hidden="true" />
                    <span>Retrait boutique (Akwa)</span>
                  </>
                ) : (
                  <>
                    <Truck className="h-3.5 w-3.5" aria-hidden="true" />
                    <span>Livraison · {reservation.city ?? 'Douala'}</span>
                  </>
                )}
              </span>
            </div>
            <p className="mt-1.5 text-small text-text-2">
              Créée le {formatDate(reservation.createdAt)} · Client&nbsp;:{' '}
              <strong className="text-ink">
                {reservation.customer?.firstName} {reservation.customer?.lastName ?? ''}
              </strong>{' '}
              (<span className="font-mono">{formatCmPhone(reservation.customer?.phone ?? '')}</span>)
            </p>
          </div>

          <div className="text-left sm:text-right">
            <p className="text-label text-grey uppercase">TOTAL RÉSERVATION</p>
            <p className="mt-0.5">
              <Price amount={reservation.total} className="text-h2 text-ink" />
            </p>
          </div>
        </div>
      </header>

      {/* 1. Panneau de vérification de preuve Mobile Money (si preuve présente ou en attente) */}
      {(reservation.status === 'pending_validation' || Boolean(reservation.proof)) && (
        <ProofVerificationPanel
          reservation={reservation}
          duplicateProofRefs={duplicateProofRefs}
        />
      )}

      {/* 2. Poste d'action selon le statut actuel (§6.1) */}
      {!isFinal && reservation.status !== 'pending_validation' && (
        <section
          aria-labelledby="admin-action-station-heading"
          className="rounded-[var(--radius-lg)] border border-silver bg-white p-5 sm:p-6"
        >
          <span className="text-label text-grey uppercase">PROCHAINE ÉTAPE BOUTIQUE</span>
          <h2 id="admin-action-station-heading" className="mt-0.5 text-h3 text-ink">
            {reservation.status === 'reserved' && 'En attente du paiement Mobile Money du client'}
            {reservation.status === 'payment_rejected' &&
              'Preuve rejetée · En attente d’une nouvelle capture client'}
            {reservation.status === 'confirmed' &&
              'Paiement confirmé · Préparer et photographier le colis'}
            {reservation.status === 'preparing' &&
              'Colis en préparation · Joindre les photos du colis prêt'}
            {reservation.status === 'handed_to_agency' &&
              'Colis remis à l’agence / livreur · Suivi de l’acheminement'}
            {reservation.status === 'in_delivery' &&
              'Colis en cours de livraison · Confirmer la remise finale'}
            {reservation.status === 'ready_for_pickup' &&
              'Colis prêt en boutique · Remise au comptoir'}
          </h2>

          {reservation.status === 'reserved' && (
            <div className="mt-4 space-y-4">
              <div className="flex flex-wrap items-center gap-2 rounded-[var(--radius-md)] border border-silver bg-surface px-4 py-3 text-small text-ink">
                <Clock className="h-4 w-4 text-warning" aria-hidden="true" />
                <span>
                  Temps restant avant expiration automatique&nbsp;:{' '}
                  <strong className="font-mono">{formatCountdown(remainingMs)}</strong>
                </span>
              </div>
              <div className="flex flex-wrap gap-3">
                <Button
                  href={buildClientWhatsappUrl(reservation)}
                  external
                  variant="dark"
                  size="md"
                  iconLeft={<MessageCircle className="h-4 w-4" aria-hidden="true" />}
                >
                  Relancer sur WhatsApp
                </Button>
                <Button
                  variant="outline"
                  size="md"
                  loading={validatePaymentMutation.isPending}
                  onClick={() => void handleManualPaymentValidation()}
                  iconLeft={<CheckCircle2 className="h-4 w-4" aria-hidden="true" />}
                >
                  Marquer payée manuellement
                </Button>
              </div>
            </div>
          )}

          {reservation.status === 'payment_rejected' && (
            <div className="mt-4 space-y-4">
              <div className="rounded-[var(--radius-md)] border border-danger bg-surface p-3.5 text-small text-danger">
                Motif communiqué au client&nbsp;:{' '}
                <strong>{reservation.rejection?.reason ?? reservation.rejectionReason}</strong>
              </div>
              <div className="flex flex-wrap gap-3">
                <Button
                  href={buildClientWhatsappUrl(reservation)}
                  external
                  variant="dark"
                  size="md"
                  iconLeft={<MessageCircle className="h-4 w-4" aria-hidden="true" />}
                >
                  Relancer sur WhatsApp
                </Button>
              </div>
            </div>
          )}

          {(reservation.status === 'confirmed' || reservation.status === 'preparing') && (
            <div className="mt-4 space-y-5">
              {reservation.status === 'confirmed' && (
                <div className="flex flex-wrap items-center justify-between gap-3 rounded-[var(--radius-md)] border border-silver bg-surface p-4">
                  <div>
                    <p className="text-small font-semibold text-ink">
                      Étape 1 : Signaler le début de la préparation
                    </p>
                    <p className="text-xs text-text-2">
                      Vous pouvez passer en « En préparation » maintenant ou déclarer directement le colis prêt ci-dessous.
                    </p>
                  </div>
                  <Button
                    variant="dark"
                    size="md"
                    loading={advanceStatusMutation.isPending}
                    onClick={() =>
                      void handleAdvanceStatus(
                        'preparing',
                        'Statut mis à jour : En préparation',
                      )
                    }
                    iconLeft={<Package className="h-4 w-4" aria-hidden="true" />}
                  >
                    Démarrer la préparation
                  </Button>
                </div>
              )}

              <PackagePhotosUploader
                reservation={reservation}
                availableAgencies={availableAgencies}
              />
            </div>
          )}

          {reservation.status === 'handed_to_agency' && (
            <div className="mt-4 flex flex-wrap gap-3">
              <Button
                variant="primary"
                size="lg"
                loading={advanceStatusMutation.isPending}
                onClick={() =>
                  void handleAdvanceStatus(
                    'in_delivery',
                    'Statut mis à jour : En cours de livraison · client notifié',
                  )
                }
                iconLeft={<Truck className="h-5 w-5" aria-hidden="true" />}
              >
                Marquer en cours de livraison
              </Button>

              <Button
                variant="dark"
                size="lg"
                loading={advanceStatusMutation.isPending}
                onClick={() =>
                  void handleAdvanceStatus(
                    'delivered',
                    'Réservation marquée livrée ✓ · client notifié',
                  )
                }
                iconLeft={<PackageCheck className="h-5 w-5" aria-hidden="true" />}
              >
                Confirmer la livraison au client ✓
              </Button>
            </div>
          )}

          {reservation.status === 'in_delivery' && (
            <div className="mt-4">
              <Button
                variant="primary"
                size="lg"
                loading={advanceStatusMutation.isPending}
                onClick={() =>
                  void handleAdvanceStatus(
                    'delivered',
                    'Réservation marquée livrée ✓ · client notifié',
                  )
                }
                iconLeft={<PackageCheck className="h-5 w-5" aria-hidden="true" />}
              >
                Confirmer la livraison au client ✓
              </Button>
            </div>
          )}

          {reservation.status === 'ready_for_pickup' && (
            <div className="mt-4 space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-3 rounded-[var(--radius-md)] border border-silver bg-surface p-4">
                <div>
                  <p className="text-label text-grey uppercase">
                    CODE DE RETRAIT À VÉRIFIER AU COMPTOIR
                  </p>
                  <p className="mt-1 font-mono text-h2 font-extrabold text-ink">
                    {reservation.ref}
                  </p>
                </div>
                <Button
                  href={buildClientWhatsappUrl(reservation)}
                  external
                  variant="outline"
                  size="sm"
                  iconLeft={<MessageCircle className="h-4 w-4" aria-hidden="true" />}
                >
                  Prévenir sur WhatsApp
                </Button>
              </div>

              <Button
                variant="primary"
                size="lg"
                loading={advanceStatusMutation.isPending}
                onClick={() =>
                  void handleAdvanceStatus(
                    'picked_up',
                    'Retrait en boutique confirmé ✓',
                  )
                }
                iconLeft={<PackageCheck className="h-5 w-5" aria-hidden="true" />}
              >
                Confirmer le retrait en boutique ✓
              </Button>
            </div>
          )}
        </section>
      )}

      {/* 3. Photos du colis envoyées au client (si déjà jointes) */}
      {reservation.packagePhotos && reservation.packagePhotos.length > 0 && (
        <section
          aria-labelledby="admin-package-photos-heading"
          className="rounded-[var(--radius-lg)] border border-silver bg-white p-5 sm:p-6"
        >
          <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
            <div>
              <h2 id="admin-package-photos-heading" className="text-h3 text-ink">
                Photos du colis prêt ({reservation.packagePhotos.length})
              </h2>
              <p className="text-small text-text-2">
                Visibles par le client dans le suivi de sa réservation.
              </p>
            </div>
            {reservation.packageReadyAt && (
              <span className="text-xs text-text-2">
                Prises le {formatDate(reservation.packageReadyAt)}
              </span>
            )}
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            {reservation.packagePhotos.map((photo, index) => (
              <div
                key={photo.id}
                className="overflow-hidden rounded-[var(--radius-md)] border border-silver bg-surface p-2"
              >
                <img
                  src={photo.url}
                  alt={`Photo du colis ${reservation.ref} (${index + 1})`}
                  className="h-44 w-full rounded-[var(--radius-sm)] object-cover"
                />
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Grille principale : Liste de colisage + Client & Réception */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        {/* 4. Liste de colisage (articles à préparer) */}
        <section
          aria-labelledby="admin-packing-list-heading"
          className="rounded-[var(--radius-lg)] border border-silver bg-white p-5 sm:p-6 lg:col-span-7"
        >
          <h2 id="admin-packing-list-heading" className="text-h3 text-ink">
            Articles à préparer ({reservation.items.reduce((s, i) => s + i.quantity, 0)})
          </h2>
          <p className="mt-0.5 mb-4 text-small text-text-2">
            Cochez chaque article vérifié lors de la mise en colis.
          </p>

          <ul className="divide-y divide-silver">
            {reservation.items.map((item) => {
              const checked = Boolean(checkedItemIds[item.id]);
              return (
                <li
                  key={item.id}
                  className={cn(
                    'flex items-center justify-between gap-3 py-3.5 transition-colors',
                    checked && 'opacity-65',
                  )}
                >
                  <label className="flex min-w-0 flex-1 cursor-pointer items-center gap-3.5">
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => toggleItemChecked(item.id)}
                      className="h-5 w-5 shrink-0 accent-ink"
                    />
                    <img
                      src={item.image}
                      alt={item.name}
                      className="h-14 w-12 shrink-0 rounded-[var(--radius-sm)] border border-silver bg-surface object-cover"
                    />
                    <div className="min-w-0 flex-1">
                      <Link
                        to={`/admin/catalogue/${item.productId}`}
                        className="truncate text-small font-bold text-ink hover:text-red"
                      >
                        {item.name}
                      </Link>
                      <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-text-2">
                        <span className="inline-flex items-center rounded-[var(--radius-sm)] bg-ink px-2 py-0.5 font-bold text-white">
                          Taille {item.size}
                        </span>
                        <span className="inline-flex items-center gap-1">
                          {item.colorHex && (
                            <span
                              className="inline-block h-3 w-3 rounded-[var(--radius-full)] border border-silver"
                              style={{ backgroundColor: item.colorHex }}
                              aria-hidden="true"
                            />
                          )}
                          <span>{item.colorName}</span>
                        </span>
                        <span>· Qté&nbsp;: <strong className="text-ink">{item.quantity}</strong></span>
                      </div>
                    </div>
                  </label>

                  <div className="text-right">
                    <Price amount={item.unitPrice * item.quantity} className="text-small" />
                    {item.quantity > 1 && (
                      <p className="text-xs text-text-2">
                        <Price amount={item.unitPrice} className="text-xs" /> / unité
                      </p>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>

          <div className="mt-4 space-y-1.5 border-t border-silver pt-4 text-small">
            <div className="flex justify-between text-text-2">
              <span>Sous-total articles</span>
              <Price amount={reservation.subtotal} className="text-small" />
            </div>
            <div className="flex justify-between text-text-2">
              <span>
                {reservation.receptionMode === 'pickup'
                  ? 'Retrait en boutique'
                  : `Frais de livraison (${reservation.city ?? 'Douala'})`}
              </span>
              <Price amount={reservation.deliveryFee} className="text-small" />
            </div>
            <div className="flex justify-between border-t border-silver pt-2 text-body font-bold text-ink">
              <span>Total</span>
              <Price amount={reservation.total} className="text-body" />
            </div>
          </div>
        </section>

        {/* 5. Coordonnées Client & Réception */}
        <section
          aria-labelledby="admin-customer-info-heading"
          className="space-y-4 rounded-[var(--radius-lg)] border border-silver bg-white p-5 sm:p-6 lg:col-span-5"
        >
          <h2 id="admin-customer-info-heading" className="text-h3 text-ink">
            Client & Réception
          </h2>

          <div className="rounded-[var(--radius-md)] border border-silver bg-surface p-4">
            <p className="text-label text-grey uppercase">CLIENT</p>
            <p className="mt-1 text-body font-bold text-ink">
              {reservation.customer?.firstName} {reservation.customer?.lastName ?? ''}
            </p>
            <p className="mt-0.5 font-mono text-small text-text-2">
              {formatCmPhone(reservation.customer?.phone ?? '+237690000001')}
            </p>

            <div className="mt-3 flex flex-wrap gap-2">
              <Button
                href={`tel:${reservation.customer?.phone ?? '+237690000001'}`}
                variant="outline"
                size="sm"
                iconLeft={<Phone className="h-3.5 w-3.5" aria-hidden="true" />}
              >
                Appeler
              </Button>
              <Button
                href={buildClientWhatsappUrl(reservation)}
                external
                variant="dark"
                size="sm"
                iconLeft={<MessageCircle className="h-3.5 w-3.5" aria-hidden="true" />}
              >
                WhatsApp
              </Button>
            </div>
          </div>

          <div className="rounded-[var(--radius-md)] border border-silver p-4">
            <p className="text-label text-grey uppercase">MODE DE RÉCEPTION</p>
            {reservation.receptionMode === 'pickup' ? (
              <div className="mt-1.5 space-y-1 text-small">
                <p className="font-bold text-ink">Retrait en boutique (Douala · Akwa)</p>
                <p className="text-text-2">
                  Le client présentera la référence{' '}
                  <strong className="font-mono text-ink">{reservation.ref}</strong> au comptoir.
                </p>
              </div>
            ) : (
              <div className="mt-1.5 space-y-1.5 text-small">
                <p className="font-bold text-ink">
                  Livraison · {reservation.city ?? reservation.deliveryAddress?.city ?? 'Douala'}
                </p>
                {(reservation.deliveryAddress?.district ||
                  reservation.deliveryAddress?.quarter ||
                  reservation.address?.district) && (
                  <p className="text-text-2">
                    Quartier / Point&nbsp;:{' '}
                    <strong className="text-ink">
                      {reservation.deliveryAddress?.district ??
                        reservation.deliveryAddress?.quarter ??
                        reservation.address?.district}
                    </strong>
                  </p>
                )}
                {(reservation.deliveryAddress?.landmark ||
                  reservation.address?.landmark) && (
                  <p className="text-text-2">
                    Repère&nbsp;:{' '}
                    <span className="text-ink">
                      {reservation.deliveryAddress?.landmark ??
                        reservation.address?.landmark}
                    </span>
                  </p>
                )}
                {reservation.agency && (
                  <p className="text-text-2">
                    Agence de transport&nbsp;:{' '}
                    <strong className="text-ink">
                      {reservation.agency.name} ({reservation.agency.city})
                    </strong>
                  </p>
                )}
                {reservation.deliveryAddress?.recipientName && (
                  <p className="border-t border-silver pt-2 text-xs text-text-2">
                    Destinataire du colis&nbsp;:{' '}
                    <strong className="text-ink">
                      {reservation.deliveryAddress.recipientName}
                    </strong>{' '}
                    ({formatCmPhone(reservation.deliveryAddress.recipientPhone)})
                  </p>
                )}
              </div>
            )}
          </div>

          {reservation.notes && (
            <div className="rounded-[var(--radius-md)] border border-warning bg-surface p-3.5 text-small text-ink">
              <p className="text-label text-grey uppercase">CONSIGNE DU CLIENT</p>
              <p className="mt-1">{reservation.notes}</p>
            </div>
          )}
        </section>
      </div>

      {/* Grille inférieure : Journal complet (timeline) + Notes internes boutique */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        {/* 6. Journal complet de la réservation */}
        <section
          aria-labelledby="admin-timeline-heading"
          className="rounded-[var(--radius-lg)] border border-silver bg-white p-5 sm:p-6 lg:col-span-7"
        >
          <h2 id="admin-timeline-heading" className="text-h3 text-ink">
            Journal complet ({reservation.timeline.length})
          </h2>
          <p className="mt-0.5 mb-4 text-small text-text-2">
            Historique chronologique des actions client, boutique et système.
          </p>

          <ol className="space-y-3">
            {reservation.timeline.map((event, idx) => {
              const meta = STATUS_META[event.status] ?? STATUS_META.reserved;
              const actorLabel = event.actor ? ACTOR_LABELS[event.actor] : 'Système';

              return (
                <li
                  key={`${event.status}-${event.at}-${idx}`}
                  className="flex items-start justify-between gap-3 rounded-[var(--radius-md)] border border-silver bg-surface/50 p-3.5"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-small font-bold text-ink">{meta.label}</span>
                      <span className="rounded-[var(--radius-full)] border border-silver bg-white px-2 py-0.5 text-[11px] font-semibold text-text-2">
                        {actorLabel}
                      </span>
                    </div>
                    {event.note && (
                      <p className="mt-1 text-small text-ink">{event.note}</p>
                    )}
                  </div>
                  <time
                    dateTime={event.at}
                    className="shrink-0 text-xs text-text-2 tabular-nums"
                  >
                    {formatDate(event.at)}
                  </time>
                </li>
              );
            })}
          </ol>
        </section>

        {/* 7. Notes internes boutique */}
        <section
          aria-labelledby="admin-internal-notes-heading"
          className="rounded-[var(--radius-lg)] border border-silver bg-white p-5 sm:p-6 lg:col-span-5"
        >
          <h2 id="admin-internal-notes-heading" className="text-h3 text-ink">
            Notes internes équipe ({internalNotes.length})
          </h2>
          <p className="mt-0.5 mb-4 text-small text-text-2">
            Visibles uniquement par l’équipe dans l’administration.
          </p>

          {internalNotes.length === 0 ? (
            <p className="mb-4 rounded-[var(--radius-md)] border border-dashed border-silver bg-surface p-4 text-center text-xs text-text-2">
              Aucune note interne sur cette réservation.
            </p>
          ) : (
            <ul className="mb-4 space-y-2.5">
              {internalNotes.map((n) => (
                <li
                  key={n.id}
                  className="rounded-[var(--radius-md)] border border-silver bg-surface p-3 text-small"
                >
                  <div className="flex items-center justify-between text-xs text-text-2">
                    <strong className="text-ink">{n.author}</strong>
                    <span>{formatDate(n.createdAt)}</span>
                  </div>
                  <p className="mt-1 text-ink">{n.text}</p>
                </li>
              ))}
            </ul>
          )}

          <form onSubmit={(e) => void handleAddInternalNote(e)} className="space-y-2.5">
            <label htmlFor="admin-new-note" className="sr-only">
              Ajouter une note interne
            </label>
            <textarea
              id="admin-new-note"
              rows={2}
              value={noteText}
              onChange={(e) => setNoteText(e.target.value)}
              placeholder="Ajouter une consigne interne (ex. appelé le client à 15 h)…"
              className="w-full rounded-[var(--radius-md)] border border-silver bg-white p-3 text-small text-ink placeholder:text-grey focus:border-ink focus:outline-none"
            />
            <Button
              type="submit"
              variant="outline"
              size="sm"
              loading={addNoteMutation.isPending}
              disabled={noteText.trim().length < 2}
              iconLeft={<Send className="h-3.5 w-3.5" aria-hidden="true" />}
            >
              Ajouter la note
            </Button>
          </form>
        </section>
      </div>

      {/* Feuille d'annulation côté boutique */}
      <Sheet
        open={cancelSheetOpen}
        onClose={() => setCancelSheetOpen(false)}
        title={`Annuler la réservation · ${reservation.ref}`}
      >
        <div className="space-y-4 pb-4">
          {wasPaid && (
            <div
              role="alert"
              className="flex items-start gap-2.5 rounded-[var(--radius-md)] border border-warning bg-surface p-3.5 text-small text-ink"
            >
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-warning" aria-hidden="true" />
              <div>
                <p className="font-bold">Remboursement à effectuer</p>
                <p className="mt-0.5 text-xs text-text-2">
                  Le paiement de <Price amount={reservation.total} className="font-bold text-ink" /> a déjà été validé. Pensez à rembourser le client par Mobile Money.
                </p>
              </div>
            </div>
          )}

          <p className="text-small text-text-2">
            L’annulation remet immédiatement les articles en stock dans le catalogue et affiche le motif au client.
          </p>

          <div className="flex flex-wrap gap-2">
            {SHOP_CANCEL_REASONS.map((reasonOption) => {
              const selected = cancelReason === reasonOption;
              return (
                <button
                  key={reasonOption}
                  type="button"
                  onClick={() => {
                    setCancelReason(reasonOption);
                    setCancelError(null);
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
              htmlFor="admin-shop-cancel-reason"
              className="mb-1.5 block text-small font-semibold text-ink"
            >
              Motif d’annulation (obligatoire)
            </label>
            <textarea
              id="admin-shop-cancel-reason"
              rows={3}
              value={cancelReason}
              onChange={(e) => {
                setCancelReason(e.target.value);
                if (cancelError) setCancelError(null);
              }}
              placeholder="Indiquez la raison de l’annulation…"
              className="w-full rounded-[var(--radius-md)] border border-silver bg-white p-3 text-small text-ink placeholder:text-grey focus:border-ink focus:outline-none"
            />
            {cancelError && (
              <p role="alert" className="mt-1.5 text-xs font-semibold text-danger">
                {cancelError}
              </p>
            )}
          </div>

          <div className="flex flex-col-reverse gap-2.5 pt-2 sm:flex-row sm:justify-end">
            <Button
              variant="ghost"
              size="md"
              onClick={() => setCancelSheetOpen(false)}
            >
              Retour
            </Button>
            <Button
              variant="danger"
              size="md"
              loading={cancelMutation.isPending}
              onClick={() => void handleConfirmShopCancel()}
            >
              Confirmer l’annulation et remettre en stock
            </Button>
          </div>
        </div>
      </Sheet>
    </div>
  );
}
