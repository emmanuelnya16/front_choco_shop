import type { LucideIcon } from 'lucide-react';
import {
  Ban,
  CheckCircle2,
  Clock,
  Hourglass,
  Package,
  PackageCheck,
  Store,
  TimerOff,
  Truck,
  XCircle,
} from 'lucide-react';
import type { ReceptionMode } from './domain';

export type ReservationStatusCode =
  | 'reserved'
  | 'pending_validation'
  | 'payment_rejected'
  | 'confirmed'
  | 'preparing'
  | 'handed_to_agency'
  | 'ready_for_pickup'
  | 'in_delivery'
  | 'delivered'
  | 'picked_up'
  | 'expired'
  | 'cancelled';

export type StatusTone = 'neutral' | 'warning' | 'danger' | 'success';

export interface ReservationStatusMeta {
  code: ReservationStatusCode;
  label: string;
  tone: StatusTone;
  iconName: string;
  Icon: LucideIcon;
}

export const STATUS_META: Record<ReservationStatusCode, ReservationStatusMeta> = {
  reserved: {
    code: 'reserved',
    label: 'Réservée',
    tone: 'neutral',
    iconName: 'Clock',
    Icon: Clock,
  },
  pending_validation: {
    code: 'pending_validation',
    label: 'En attente de validation',
    tone: 'warning',
    iconName: 'Hourglass',
    Icon: Hourglass,
  },
  payment_rejected: {
    code: 'payment_rejected',
    label: 'Paiement rejeté',
    tone: 'danger',
    iconName: 'XCircle',
    Icon: XCircle,
  },
  confirmed: {
    code: 'confirmed',
    label: 'Confirmée',
    tone: 'success',
    iconName: 'CheckCircle2',
    Icon: CheckCircle2,
  },
  preparing: {
    code: 'preparing',
    label: 'En préparation',
    tone: 'neutral',
    iconName: 'Package',
    Icon: Package,
  },
  handed_to_agency: {
    code: 'handed_to_agency',
    label: 'Remise à l’agence',
    tone: 'neutral',
    iconName: 'Truck',
    Icon: Truck,
  },
  ready_for_pickup: {
    code: 'ready_for_pickup',
    label: 'Prête pour retrait',
    tone: 'success',
    iconName: 'Store',
    Icon: Store,
  },
  in_delivery: {
    code: 'in_delivery',
    label: 'En cours de livraison',
    tone: 'neutral',
    iconName: 'Truck',
    Icon: Truck,
  },
  delivered: {
    code: 'delivered',
    label: 'Livrée',
    tone: 'success',
    iconName: 'PackageCheck',
    Icon: PackageCheck,
  },
  picked_up: {
    code: 'picked_up',
    label: 'Retirée',
    tone: 'success',
    iconName: 'PackageCheck',
    Icon: PackageCheck,
  },
  expired: {
    code: 'expired',
    label: 'Expirée',
    tone: 'danger',
    iconName: 'TimerOff',
    Icon: TimerOff,
  },
  cancelled: {
    code: 'cancelled',
    label: 'Annulée',
    tone: 'danger',
    iconName: 'Ban',
    Icon: Ban,
  },
};

const FINAL_STATUSES: ReadonlySet<ReservationStatusCode> = new Set([
  'delivered',
  'picked_up',
  'expired',
  'cancelled',
]);

export function isFinalStatus(status: ReservationStatusCode): boolean {
  return FINAL_STATUSES.has(status);
}

export function TIMELINE_ORDER(mode: ReceptionMode): ReservationStatusCode[] {
  if (mode === 'pickup') {
    return [
      'reserved',
      'pending_validation',
      'confirmed',
      'preparing',
      'ready_for_pickup',
      'picked_up',
    ];
  }
  return [
    'reserved',
    'pending_validation',
    'confirmed',
    'preparing',
    'handed_to_agency',
    'in_delivery',
    'delivered',
  ];
}
