import type {
  ReceptionMode,
  Reservation,
  ReservationActor,
  ReservationTimelineEvent,
} from '@/types/domain';
import {
  isFinalStatus,
  TIMELINE_ORDER,
  type ReservationStatusCode,
} from '@/types/reservationStatus';

export type TimelineStepState = 'done' | 'current' | 'upcoming';
export type TimelineStepTone = 'default' | 'danger';

export interface TimelineStepView {
  key: string;
  status: ReservationStatusCode;
  label: string;
  state: TimelineStepState;
  tone: TimelineStepTone;
  at?: string;
  note?: string;
  actor?: ReservationActor;
  /** Étape où la photo du colis est jointe (« Remise à l'agence » ou « Prête pour retrait »). */
  isPackageStep: boolean;
}

const DANGER_STATUSES: ReadonlySet<ReservationStatusCode> = new Set([
  'payment_rejected',
  'expired',
  'cancelled',
]);

/** Livraison à domicile à Douala, sans agence de transport : l'étape « Remise à l'agence » devient « Colis prêt ». */
export function isLocalDelivery(
  reservation: Pick<Reservation, 'receptionMode' | 'agency' | 'deliveryAddress'>,
): boolean {
  return (
    reservation.receptionMode === 'delivery' &&
    !reservation.agency?.name &&
    !reservation.deliveryAddress?.agencyName
  );
}

export function timelineStepLabel(
  status: ReservationStatusCode,
  options: { localDelivery?: boolean; afterRejection?: boolean } = {},
): string {
  switch (status) {
    case 'reserved':
      return 'Réservée';
    case 'pending_validation':
      return options.afterRejection ? 'Nouvelle preuve envoyée' : 'Paiement envoyé';
    case 'payment_rejected':
      return 'Paiement rejeté';
    case 'confirmed':
      return 'Confirmée';
    case 'preparing':
      return 'En préparation';
    case 'handed_to_agency':
      return options.localDelivery ? 'Colis prêt pour la livraison' : 'Remise à l’agence';
    case 'ready_for_pickup':
      return 'Prête pour retrait';
    case 'in_delivery':
      return 'En cours de livraison';
    case 'delivered':
      return 'Livrée';
    case 'picked_up':
      return 'Retirée';
    case 'expired':
      return 'Expirée';
    case 'cancelled':
      return 'Annulée';
  }
}

function sortEvents(events: ReservationTimelineEvent[]): ReservationTimelineEvent[] {
  return events
    .map((event, index) => ({ event, index }))
    .sort((a, b) => {
      const diff = new Date(a.event.at).getTime() - new Date(b.event.at).getTime();
      return diff !== 0 ? diff : a.index - b.index;
    })
    .map(({ event }) => event);
}

/**
 * Construit la frise affichée (§5.3 M5) à partir du journal daté et de `TIMELINE_ORDER(receptionMode)` :
 * - étapes passées dans l'ordre chronologique, avec un rejet intercalé puis « Nouvelle preuve envoyée » ;
 * - étape en cours (dernier statut), sauf livraison ou retrait terminés ;
 * - étapes à venir déduites du parcours ;
 * - arrêt au point atteint pour une réservation expirée ou annulée, terminée par une étape rouge.
 */
export function buildTimelineSteps(
  reservation: Pick<
    Reservation,
    'status' | 'receptionMode' | 'timeline' | 'agency' | 'deliveryAddress' | 'createdAt'
  >,
): TimelineStepView[] {
  const localDelivery = isLocalDelivery(reservation);
  const events = sortEvents(reservation.timeline ?? []);
  const effectiveEvents: ReservationTimelineEvent[] =
    events.length > 0 ? events : [{ status: reservation.status, at: reservation.createdAt }];

  const steps: TimelineStepView[] = [];
  let rejectionSeen = false;

  effectiveEvents.forEach((event, index) => {
    const previous = steps[steps.length - 1];
    // Deux entrées identiques consécutives (ex. relance du simulateur) ne forment qu'une étape.
    if (previous && previous.status === event.status) {
      previous.at = event.at;
      previous.note = event.note ?? previous.note;
      return;
    }
    steps.push({
      key: `${event.status}-${index}`,
      status: event.status,
      label: timelineStepLabel(event.status, {
        localDelivery,
        afterRejection: event.status === 'pending_validation' && rejectionSeen,
      }),
      state: 'done',
      tone: DANGER_STATUSES.has(event.status) ? 'danger' : 'default',
      at: event.at,
      note: event.note,
      actor: event.actor,
      isPackageStep: event.status === 'handed_to_agency' || event.status === 'ready_for_pickup',
    });
    if (event.status === 'payment_rejected') rejectionSeen = true;
  });

  const status = reservation.status;
  const last = steps[steps.length - 1];

  // Livrée, retirée, expirée ou annulée : rien après, la dernière étape reste « franchie ».
  if (isFinalStatus(status)) {
    return steps;
  }

  if (last) {
    last.state = 'current';
  }

  const order = TIMELINE_ORDER(reservation.receptionMode);
  // Après un rejet, la prochaine étape attendue est l'envoi d'une nouvelle preuve.
  const anchor: ReservationStatusCode = status === 'payment_rejected' ? 'reserved' : status;
  const anchorIndex = order.indexOf(anchor);
  const upcoming = anchorIndex >= 0 ? order.slice(anchorIndex + 1) : [];

  upcoming.forEach((upcomingStatus) => {
    steps.push({
      key: `${upcomingStatus}-upcoming`,
      status: upcomingStatus,
      label: timelineStepLabel(upcomingStatus, {
        localDelivery,
        afterRejection: upcomingStatus === 'pending_validation' && rejectionSeen,
      }),
      state: 'upcoming',
      tone: 'default',
      isPackageStep: upcomingStatus === 'handed_to_agency' || upcomingStatus === 'ready_for_pickup',
    });
  });

  return steps;
}

/**
 * Index de la dernière étape déjà vue par le client dans une frise reconstruite :
 * sert à n'animer que la portion nouvelle (§5.3 M5). Renvoie -1 si rien n'a été vu (première ouverture).
 */
export function lastSeenStepIndex(
  steps: TimelineStepView[],
  seenStatus: ReservationStatusCode | undefined,
): number {
  if (!seenStatus) return -1;
  for (let i = steps.length - 1; i >= 0; i -= 1) {
    const step = steps[i];
    if (step.state !== 'upcoming' && step.status === seenStatus) return i;
  }
  return -1;
}

/** Index de l'étape atteinte (en cours, ou dernière franchie pour une réservation terminée). */
export function reachedStepIndex(steps: TimelineStepView[]): number {
  for (let i = steps.length - 1; i >= 0; i -= 1) {
    if (steps[i].state !== 'upcoming') return i;
  }
  return -1;
}

/**
 * Pour une réservation expirée ou annulée : dernier statut du parcours atteint avant l'arrêt.
 * Un rejet compte comme « paiement envoyé ».
 */
export function reachedStatusFromTimeline(
  timeline: ReservationTimelineEvent[],
  receptionMode: ReceptionMode,
): ReservationStatusCode | undefined {
  const order = TIMELINE_ORDER(receptionMode);
  const events = sortEvents(timeline);
  for (let i = events.length - 1; i >= 0; i -= 1) {
    const status = events[i].status === 'payment_rejected' ? 'pending_validation' : events[i].status;
    if (order.includes(status)) return status;
  }
  return undefined;
}

export interface ProgressInfo {
  done: number;
  total: number;
  tone: 'ink' | 'success' | 'red';
}

/**
 * Barre d'avancement des cartes (§4.2 M5) : étapes franchies sur le total de `TIMELINE_ORDER(mode)`.
 * Verte pour une livraison ou un retrait terminés, rouge au point atteint pour une réservation expirée ou annulée.
 */
export function computeProgress(item: {
  status: ReservationStatusCode;
  receptionMode: ReceptionMode;
  reachedStatus?: ReservationStatusCode;
}): ProgressInfo {
  const order = TIMELINE_ORDER(item.receptionMode);
  const total = order.length;

  if (item.status === 'delivered' || item.status === 'picked_up') {
    return { done: total, total, tone: 'success' };
  }
  if (item.status === 'expired' || item.status === 'cancelled') {
    const reached = item.reachedStatus ? order.indexOf(item.reachedStatus) + 1 : 1;
    return { done: Math.max(1, reached), total, tone: 'red' };
  }
  if (item.status === 'payment_rejected') {
    // Réservée + paiement envoyé (puis rejeté)
    return { done: 2, total, tone: 'ink' };
  }
  const index = order.indexOf(item.status);
  return { done: index >= 0 ? index + 1 : 1, total, tone: 'ink' };
}
