import { AnimatePresence } from 'motion/react';
import * as m from 'motion/react-m';
import { ArrowRight, CheckCircle2, Clock, Hourglass, MapPin, Phone, RotateCcw } from 'lucide-react';
import type { ReactNode } from 'react';
import { Link } from 'react-router';
import { Button } from '@/components/ui/Button';
import { Price } from '@/components/ui/Primitives';
import { HoldCountdown } from '@/features/reservation/components/HoldCountdown';
import { useRebook } from '@/features/tracking/api/useRebook';
import { formatDayMonth, formatSpokenDateTime, formatStepDateTime } from '@/features/tracking/format';
import { isLocalDelivery } from '@/features/tracking/timeline';
import { cn } from '@/lib/utils/cn';
import { formatCmPhone } from '@/lib/utils/phone';
import { duration, ease } from '@/motion/tokens';
import type { PublicSettings, Reservation } from '@/types/domain';

export interface ActionBlockProps {
  reservation: Reservation;
  settings?: PublicSettings;
  /** Anime le passage d'un contenu à l'autre (changement de statut détecté en direct). */
  animateChange?: boolean;
}

type Tone = 'ink' | 'surface' | 'alert';

const TONE_CLASSES: Record<Tone, string> = {
  ink: 'bg-ink text-white',
  surface: 'bg-surface text-ink',
  alert: 'border-2 border-red bg-white text-ink',
};

function telHref(phone: string): string {
  return `tel:${phone.replace(/[^\d+]/g, '')}`;
}

function lastEventAt(reservation: Reservation, status: Reservation['status']): string | undefined {
  return [...reservation.timeline].reverse().find((e) => e.status === status)?.at;
}

/**
 * Bloc d'action du détail (§5.2 M5) : toujours en tête, il dit ce qui se passe et ce que le client doit faire.
 */
export function ActionBlock({ reservation, settings, animateChange = false }: ActionBlockProps) {
  const { tone, content } = getActionBlockContent(reservation, settings);

  return (
    // Pas d'aria-live ici : le compte à rebours serait annoncé sans fin ; la page annonce les changements de statut.
    <div className="grid">
      <AnimatePresence initial={false}>
        <m.section
          key={reservation.status}
          aria-label="Où en est ma réservation"
          initial={animateChange ? { opacity: 0 } : false}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: duration.base, ease: ease.out }}
          className={cn('[grid-area:1/1] rounded-[var(--radius-md)] p-5 sm:p-6', TONE_CLASSES[tone])}
        >
          {content}
        </m.section>
      </AnimatePresence>
    </div>
  );
}

function BlockTitle({ children, icon }: { children: ReactNode; icon?: ReactNode }) {
  return (
    <h2 className="flex items-center gap-2.5 text-h2">
      {icon}
      <span>{children}</span>
    </h2>
  );
}

function RebookButton({ reservationRef }: { reservationRef: string }) {
  const rebook = useRebook();
  return (
    <Button
      variant="dark"
      size="md"
      className="mt-5"
      loading={rebook.isPending}
      iconLeft={<RotateCcw className="h-4 w-4" />}
      onClick={() => rebook.mutate(reservationRef)}
    >
      Réserver à nouveau
    </Button>
  );
}

function getActionBlockContent(
  reservation: Reservation,
  settings?: PublicSettings,
): { tone: Tone; content: ReactNode } {
  const ref = reservation.ref;
  const total = reservation.amount?.total ?? reservation.total;
  const recipientPhone = reservation.deliveryAddress?.recipientPhone ?? reservation.customer?.phone;
  const agency = reservation.agency;
  const city = reservation.city ?? reservation.deliveryAddress?.city;
  const local = isLocalDelivery(reservation);

  switch (reservation.status) {
    case 'reserved':
      return {
        tone: 'ink',
        content: (
          <>
            <BlockTitle>Paiement attendu</BlockTitle>
            <div className="mt-4 flex items-center gap-5">
              <HoldCountdown
                variant="ring"
                surface="dark"
                expiresAt={reservation.expiresAt}
                serverTime={reservation.serverTime}
              />
              <div>
                <p className="text-small text-silver">Montant exact à envoyer</p>
                {/* Montant insécable, à l'échelle des titres (22 px sur mobile) pour tenir à côté de l'anneau */}
                <Price amount={total} className="mt-0.5 block whitespace-nowrap text-h2 text-white" />
              </div>
            </div>
            <Button
              variant="primary"
              size="lg"
              fullWidth
              className="mt-5"
              href={`/reservation/${ref}/paiement`}
              iconRight={<ArrowRight className="h-4 w-4" />}
            >
              Payer maintenant
            </Button>
          </>
        ),
      };

    case 'payment_rejected':
      return {
        tone: 'alert',
        content: (
          <>
            <BlockTitle>Paiement non validé</BlockTitle>
            <p className="mt-2 text-body text-ink">
              <span className="font-semibold">Motif&nbsp;: </span>
              {reservation.rejection?.reason ?? reservation.rejectionReason ?? 'non précisé'}
            </p>
            <p className="mt-2 text-small">
              <HoldCountdown variant="inline" expiresAt={reservation.expiresAt} serverTime={reservation.serverTime} />
            </p>
            {/* Même libellé que la carte de « Mes réservations » */}
            <Button
              variant="primary"
              size="lg"
              fullWidth
              className="mt-5"
              href={`/reservation/${ref}/preuve`}
              iconRight={<ArrowRight className="h-4 w-4" />}
            >
              Renvoyer ma preuve
            </Button>
          </>
        ),
      };

    case 'pending_validation':
      return {
        tone: 'surface',
        content: (
          <>
            {/* Sablier immobile : pas d'animation en boucle (un seul effet fort par écran) */}
            <BlockTitle icon={<Hourglass className="h-6 w-6 shrink-0" aria-hidden="true" />}>
              Nous vérifions votre paiement
            </BlockTitle>
            <p className="mt-2 text-body text-text-2">
              {settings?.payment?.validationDelayText
                ? `Validation ${settings.payment.validationDelayText}.`
                : 'La boutique vérifie votre preuve de paiement.'}{' '}
              Vous n’avez rien à faire.
            </p>
          </>
        ),
      };

    case 'confirmed':
    case 'preparing':
      return {
        tone: 'surface',
        content: (
          <>
            <BlockTitle
              icon={
                reservation.status === 'confirmed' ? (
                  <CheckCircle2 className="h-6 w-6 shrink-0 text-success" aria-hidden="true" />
                ) : undefined
              }
            >
              {reservation.status === 'confirmed' ? 'Paiement validé' : 'En préparation'}
            </BlockTitle>
            <p className="mt-2 text-body text-text-2">
              {reservation.status === 'confirmed'
                ? 'Nous allons préparer votre colis.'
                : 'Nous préparons votre colis.'}{' '}
              Vous recevrez sa photo dès qu’il sera prêt.
            </p>
          </>
        ),
      };

    case 'handed_to_agency':
      if (local || !agency) {
        return {
          tone: 'ink',
          content: (
            <>
              <BlockTitle>Votre colis est prêt</BlockTitle>
              <p className="mt-2 text-body text-silver">
                Le livreur part bientôt
                {recipientPhone ? (
                  <>
                    {' '}et vous appellera au{' '}
                    <a href={telHref(recipientPhone)} className="font-semibold text-white underline">
                      {formatCmPhone(recipientPhone)}
                    </a>
                  </>
                ) : null}
                .
              </p>
            </>
          ),
        };
      }
      return {
        tone: 'ink',
        content: (
          <>
            <BlockTitle>Votre colis est parti</BlockTitle>
            <div className="mt-3 space-y-1.5 text-body">
              <p className="font-semibold text-white">{agency.name}</p>
              <p className="flex items-start gap-2 text-silver">
                <MapPin className="mt-1 h-4 w-4 shrink-0" aria-hidden="true" />
                {[agency.address, agency.city ?? city].filter(Boolean).join(', ')}
              </p>
              {agency.openingHours && (
                <p className="flex items-start gap-2 text-silver">
                  <Clock className="mt-1 h-4 w-4 shrink-0" aria-hidden="true" />
                  {agency.openingHours}
                </p>
              )}
              {agency.phone && (
                <p className="flex items-start gap-2">
                  <Phone className="mt-1 h-4 w-4 shrink-0 text-silver" aria-hidden="true" />
                  <a href={telHref(agency.phone)} className="font-semibold whitespace-nowrap text-white underline">
                    {formatCmPhone(agency.phone)}
                  </a>
                </p>
              )}
            </div>
            <p className="mt-4 rounded-[var(--radius-sm)] bg-ink-2 px-3.5 py-3 text-small text-white">
              Présentez-vous avec votre pièce d’identité et la référence{' '}
              <span className="font-mono font-bold">{ref}</span>.
            </p>
          </>
        ),
      };

    case 'ready_for_pickup': {
      const shop = settings?.shop;
      return {
        tone: 'ink',
        content: (
          <>
            <BlockTitle>Votre colis est prêt</BlockTitle>
            <div className="mt-3 space-y-1.5 text-body">
              {shop ? (
                <>
                  <p className="font-semibold text-white">{shop.name}</p>
                  <p className="flex items-start gap-2 text-silver">
                    <MapPin className="mt-1 h-4 w-4 shrink-0" aria-hidden="true" />
                    {shop.address}
                  </p>
                  <p className="flex items-start gap-2 text-silver">
                    <Clock className="mt-1 h-4 w-4 shrink-0" aria-hidden="true" />
                    {shop.openingHours}
                  </p>
                  {shop.mapsUrl && (
                    <a
                      href={shop.mapsUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex min-h-[44px] items-center gap-1.5 font-semibold text-white underline"
                    >
                      Itinéraire sur Google Maps
                      <ArrowRight className="h-4 w-4" aria-hidden="true" />
                    </a>
                  )}
                </>
              ) : (
                // Réglages de la boutique pas encore reçus : jamais d'adresse écrite en dur
                <p className="text-silver">
                  Retrait en boutique, aux heures d’ouverture. Adresse et horaires&nbsp;:{' '}
                  <Link to="/aide/livraison-retrait" className="font-semibold text-white underline">
                    Livraison et retrait
                  </Link>
                  .
                </p>
              )}
            </div>
            <div className="mt-4 rounded-[var(--radius-md)] bg-ink-2 px-4 py-4">
              <p className="text-label text-silver">Code de retrait</p>
              <p
                className="mt-1 font-mono text-[clamp(2.25rem,10vw,3rem)] leading-none font-extrabold tracking-tight text-white [font-stretch:75%]"
                aria-label={`Code de retrait\u00A0: ${ref.split('').join(' ')}`}
              >
                {ref}
              </p>
              <p className="mt-2 text-small text-silver">À montrer au comptoir avec votre pièce d’identité.</p>
            </div>
          </>
        ),
      };
    }

    case 'in_delivery':
      return {
        tone: 'ink',
        content: (
          <>
            <BlockTitle>En route</BlockTitle>
            <p className="mt-2 text-body text-silver">
              {agency && !local ? (
                <>
                  Votre colis voyage vers <span className="font-semibold text-white">{city}</span>.
                  {agency.phone ? (
                    <>
                      {' '}{agency.name} vous préviendra dès son arrivée
                      {recipientPhone ? (
                        <>
                          {' '}au{' '}
                          <a href={telHref(recipientPhone)} className="font-semibold text-white underline">
                            {formatCmPhone(recipientPhone)}
                          </a>
                        </>
                      ) : null}
                      .
                    </>
                  ) : null}
                </>
              ) : (
                <>
                  Livraison à <span className="font-semibold text-white">{city ?? 'Douala'}</span>.
                  {recipientPhone ? (
                    <>
                      {' '}Le livreur vous appellera au{' '}
                      <a href={telHref(recipientPhone)} className="font-semibold text-white underline">
                        {formatCmPhone(recipientPhone)}
                      </a>
                      .
                    </>
                  ) : null}
                </>
              )}
            </p>
          </>
        ),
      };

    case 'delivered':
    case 'picked_up': {
      const at = lastEventAt(reservation, reservation.status) ?? reservation.updatedAt;
      return {
        tone: 'surface',
        content: (
          <>
            <BlockTitle icon={<CheckCircle2 className="h-6 w-6 shrink-0 text-success" aria-hidden="true" />}>
              {reservation.status === 'delivered' ? 'Livrée' : 'Retirée'} le {formatDayMonth(at)}
            </BlockTitle>
            <p className="mt-2 text-body text-text-2">Merci pour votre confiance&nbsp;!</p>
            <RebookButton reservationRef={ref} />
          </>
        ),
      };
    }

    case 'expired':
      return {
        tone: 'surface',
        content: (
          <>
            <BlockTitle>Réservation expirée</BlockTitle>
            <p className="mt-2 text-body text-text-2">
              Le délai de {settings?.reservationHoldHours ?? 24}&nbsp;h pour payer est dépassé.
            </p>
            <RebookButton reservationRef={ref} />
          </>
        ),
      };

    case 'cancelled': {
      const event = [...reservation.timeline].reverse().find((e) => e.status === 'cancelled');
      const by =
        event?.actor === 'client'
          ? 'par vous'
          : event?.actor === 'shop'
            ? 'par la boutique'
            : '';
      const motif = event?.actor === 'client' ? event.note : undefined;
      const statusBeforeCancel = [...reservation.timeline].reverse().find((e) => e.status !== 'cancelled')?.status;
      const paidBeforeCancel = statusBeforeCancel === 'pending_validation' || statusBeforeCancel === 'confirmed';
      return {
        tone: 'surface',
        content: (
          <>
            <BlockTitle>Réservation annulée</BlockTitle>
            {event && (
              <p className="mt-2 text-body text-text-2">
                <span aria-hidden="true">
                  Annulée {by ? `${by} ` : ''}le {formatStepDateTime(event.at).replace(' · ', ' à ')}
                </span>
                <span className="sr-only">
                  Annulée {by ? `${by} ` : ''}
                  {formatSpokenDateTime(event.at)}
                </span>
                {motif ? <> · Motif&nbsp;: {motif}</> : null}
              </p>
            )}
            {/* HYPOTHÈSE: règles de remboursement à confirmer par la boutique (même texte que la feuille
                d'annulation) ; affiché seulement si la réservation était payée au moment de l'annulation. */}
            {paidBeforeCancel && (
              <p className="mt-2 text-body text-text-2">
                Vous aviez envoyé une preuve de paiement&nbsp;: la boutique vous contacte pour le remboursement
                selon la politique d’annulation.
              </p>
            )}
            <RebookButton reservationRef={ref} />
          </>
        ),
      };
    }
  }
}
