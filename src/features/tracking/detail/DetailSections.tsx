import { Clock, ExternalLink, LifeBuoy, MapPin, MessageCircle, Phone, Store, Truck, User } from 'lucide-react';
import type { ReactNode } from 'react';
import { Link } from 'react-router';
import { Button } from '@/components/ui/Button';
import { Price } from '@/components/ui/Primitives';
import { SmartImage } from '@/components/ui/SmartImage';
import { buildWhatsAppQuestionUrl } from '@/features/payment/whatsapp';
import { formatStepDateTime } from '@/features/tracking/format';
import { isLocalDelivery } from '@/features/tracking/timeline';
import { formatCmPhone } from '@/lib/utils/phone';
import type { PublicSettings, Reservation } from '@/types/domain';

function SectionCard({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="rounded-[var(--radius-md)] border border-silver/70 bg-white p-5">
      <h2 className="text-label text-text-2">{title}</h2>
      <div className="mt-3">{children}</div>
    </section>
  );
}

function telHref(phone: string): string {
  return `tel:${phone.replace(/[^\d+]/g, '')}`;
}

/** Articles : miniature, nom (lien vers la fiche), couleur, taille, quantité, prix (§5.1 M5). */
export function ItemsSection({ reservation }: { reservation: Reservation }) {
  return (
    <SectionCard title={`Articles (${reservation.items.reduce((s, i) => s + i.quantity, 0)})`}>
      <ul className="divide-y divide-silver/60">
        {reservation.items.map((item) => (
          <li key={item.id} className="relative flex gap-3 py-3 first:pt-0 last:pb-0">
            <SmartImage
              src={item.image}
              alt=""
              ratio="4/5"
              className="w-14 shrink-0 rounded-[var(--radius-sm)]"
            />
            <div className="min-w-0 flex-1">
              <Link
                to={`/produit/${item.slug}`}
                viewTransition
                // Lien étendu à toute la ligne (cible tactile de la hauteur de la miniature)
                className="line-clamp-2 text-small font-semibold text-ink underline-offset-2 after:absolute after:inset-0 after:content-[''] hover:underline focus-visible:outline-none focus-visible:after:rounded-[var(--radius-sm)] focus-visible:after:outline-2 focus-visible:after:outline-red"
              >
                {item.name}
              </Link>
              <p className="mt-0.5 text-small text-text-2">
                {item.colorName} · Taille {item.size} · Qté {item.quantity}
              </p>
            </div>
            <Price amount={item.unitPrice * item.quantity} className="shrink-0 text-small text-ink" />
          </li>
        ))}
      </ul>
    </SectionCard>
  );
}

function InfoLine({ icon, children }: { icon: ReactNode; children: ReactNode }) {
  return (
    <p className="flex items-start gap-2.5 text-small text-ink">
      <span className="mt-0.5 shrink-0 text-text-2" aria-hidden="true">
        {icon}
      </span>
      <span className="min-w-0">{children}</span>
    </p>
  );
}

/** Réception : livraison locale, agence de transport ou retrait en boutique (§5.1 M5). */
export function ReceptionSection({
  reservation,
  settings,
}: {
  reservation: Reservation;
  settings?: PublicSettings;
}) {
  const address = reservation.deliveryAddress;
  const customerName = [reservation.customer?.firstName, reservation.customer?.lastName]
    .filter(Boolean)
    .join(' ');
  const recipientDiffers =
    Boolean(address?.recipientName) && address?.recipientName !== customerName;

  if (reservation.receptionMode === 'pickup') {
    const shop = settings?.shop;
    return (
      <SectionCard title="Réception">
        <div className="space-y-2">
          <InfoLine icon={<Store className="h-4 w-4" />}>
            <span className="font-semibold">Retrait en boutique</span>
            {shop ? <> · {shop.name}</> : null}
          </InfoLine>
          {shop && (
            <>
              <InfoLine icon={<MapPin className="h-4 w-4" />}>{shop.address}</InfoLine>
              <InfoLine icon={<Clock className="h-4 w-4" />}>{shop.openingHours}</InfoLine>
            </>
          )}
        </div>
      </SectionCard>
    );
  }

  const local = isLocalDelivery(reservation);
  const agency = reservation.agency;

  return (
    <SectionCard title="Réception">
      <div className="space-y-2">
        <InfoLine icon={<Truck className="h-4 w-4" />}>
          <span className="font-semibold">{local ? 'Livraison à domicile' : 'Envoi par agence'}</span>
          {' · '}
          {reservation.city ?? address?.city}
        </InfoLine>
        {local ? (
          <>
            {(address?.district ?? address?.quarter) && (
              <InfoLine icon={<MapPin className="h-4 w-4" />}>
                {address?.district ?? address?.quarter}
                {address?.landmark ? <> — {address.landmark}</> : null}
              </InfoLine>
            )}
          </>
        ) : (
          agency && (
            <>
              <InfoLine icon={<MapPin className="h-4 w-4" />}>
                <span className="font-semibold">{agency.name}</span>
                {agency.address ? <> — {agency.address}</> : null}
              </InfoLine>
              {agency.openingHours && (
                <InfoLine icon={<Clock className="h-4 w-4" />}>{agency.openingHours}</InfoLine>
              )}
              {agency.phone && (
                <InfoLine icon={<Phone className="h-4 w-4" />}>
                  <a href={telHref(agency.phone)} className="font-semibold whitespace-nowrap underline">
                    {formatCmPhone(agency.phone)}
                  </a>
                </InfoLine>
              )}
            </>
          )
        )}
        {recipientDiffers && address && (
          <InfoLine icon={<User className="h-4 w-4" />}>
            Destinataire&nbsp;: {address.recipientName} ·{' '}
            <a href={telHref(address.recipientPhone)} className="whitespace-nowrap underline">
              {formatCmPhone(address.recipientPhone)}
            </a>
          </InfoLine>
        )}
        {reservation.notes && (
          <p className="rounded-[var(--radius-sm)] bg-surface px-3 py-2.5 text-small text-text-2">
            Remarque&nbsp;: {reservation.notes}
          </p>
        )}
      </div>
    </SectionCard>
  );
}

const OPERATOR_LABELS: Record<'orange' | 'mtn', string> = {
  orange: 'Orange Money',
  mtn: 'MTN MoMo',
};

/** Paiement : opérateur, montants, preuve envoyée (appui = visionneuse), date d'envoi (§5.1 M5). */
export function PaymentSection({
  reservation,
  onOpenProof,
}: {
  reservation: Reservation;
  onOpenProof: () => void;
}) {
  const amount = reservation.amount ?? {
    subtotal: reservation.subtotal,
    deliveryFee: reservation.deliveryFee,
    total: reservation.total,
  };
  const proof = reservation.proof;

  return (
    <SectionCard title="Paiement">
      <dl className="space-y-1.5 text-small">
        {proof?.operator && (
          <div className="flex justify-between gap-3">
            <dt className="text-text-2">Opérateur</dt>
            <dd className="font-semibold text-ink">{OPERATOR_LABELS[proof.operator]}</dd>
          </div>
        )}
        <div className="flex justify-between gap-3">
          <dt className="text-text-2">Sous-total</dt>
          <dd>
            <Price amount={amount.subtotal} className="font-normal text-ink" />
          </dd>
        </div>
        <div className="flex justify-between gap-3">
          <dt className="text-text-2">
            {reservation.receptionMode === 'pickup' ? 'Retrait en boutique' : 'Livraison'}
          </dt>
          <dd>
            {amount.deliveryFee > 0 ? (
              <Price amount={amount.deliveryFee} className="font-normal text-ink" />
            ) : (
              <span className="text-ink">
                {reservation.receptionMode === 'pickup' ? 'Gratuit' : 'Offerte'}
              </span>
            )}
          </dd>
        </div>
        <div className="flex justify-between gap-3 border-t border-silver/60 pt-2">
          <dt className="font-semibold text-ink">Total</dt>
          <dd>
            <Price amount={amount.total} className="text-body text-ink" />
          </dd>
        </div>
      </dl>

      {proof ? (
        <div className="mt-4 flex items-center gap-3">
          <button
            type="button"
            onClick={onOpenProof}
            aria-label="Agrandir la preuve de paiement envoyée"
            className="h-18 w-12 shrink-0 overflow-hidden rounded-[var(--radius-sm)] ring-1 ring-silver/70"
          >
            <SmartImage src={proof.thumbnailUrl} alt="" ratio="auto" className="h-full w-full" />
          </button>
          <p className="text-small text-text-2">
            Preuve de paiement envoyée le {formatStepDateTime(proof.uploadedAt).replace(' · ', ' à ')}
          </p>
        </div>
      ) : (
        <p className="mt-4 text-small text-text-2">Aucune preuve de paiement envoyée pour l’instant.</p>
      )}
    </SectionCard>
  );
}

/**
 * Aide : WhatsApp prérempli et lien discret d'annulation si `cancellable` (§5.1 M5).
 * Numéro de la boutique inconnu : centre d'aide à la place (jamais de faux numéro).
 */
export function HelpSection({
  reservation,
  whatsappNumber,
  onRequestCancel,
}: {
  reservation: Reservation;
  whatsappNumber: string | null;
  onRequestCancel: () => void;
}) {
  return (
    <SectionCard title="Aide">
      {whatsappNumber ? (
        <Button
          variant="outline"
          size="md"
          fullWidth
          href={buildWhatsAppQuestionUrl(whatsappNumber, reservation.ref)}
          external
          iconLeft={<MessageCircle className="h-4 w-4" />}
          iconRight={<ExternalLink className="h-3.5 w-3.5" />}
        >
          Contacter la boutique sur WhatsApp
        </Button>
      ) : (
        <Button variant="outline" size="md" fullWidth href="/aide" iconLeft={<LifeBuoy className="h-4 w-4" />}>
          Consulter le centre d’aide
        </Button>
      )}
      {reservation.cancellable && (
        <div className="mt-3 text-center">
          <button
            type="button"
            onClick={onRequestCancel}
            className="min-h-11 px-2 text-small text-text-2 underline underline-offset-2 hover:text-ink"
          >
            Annuler la réservation
          </button>
        </div>
      )}
    </SectionCard>
  );
}
