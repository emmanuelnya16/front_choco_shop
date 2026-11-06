import { formatPrice } from '@/lib/utils/price';
import type { DeliveryCity, ReceptionMode } from '@/types/domain';

/**
 * Règles du formulaire de réservation sans dépendance à zod (M7, poids de la page Réservation) :
 * types, ville locale et calcul des montants. Le schéma zod (validation) est dans
 * `reservationSchema.ts`, chargé à la demande par le formulaire.
 */
export interface ReservationFormValues {
  firstName: string;
  lastName: string;
  receptionMode: ReceptionMode;
  city: string;
  district: string;
  landmark: string;
  agencyId: string;
  recipientType: 'self' | 'other';
  recipientName: string;
  recipientPhone: string;
  notes: string;
  saveAddress: boolean;
  addressLabel: 'Maison' | 'Bureau' | 'Autre';
}

export function isCityLocal(
  cityNameOrId: string,
  cities?: DeliveryCity[],
): boolean {
  const cleaned = cityNameOrId.trim().toLowerCase();
  if (!cleaned) return false;
  if (cities && cities.length > 0) {
    const match = cities.find(
      (c) =>
        c.name.toLowerCase() === cleaned || c.id.toLowerCase() === cleaned,
    );
    if (match) return match.isLocal;
  }
  return cleaned === 'douala' || cleaned === 'city-dla';
}

/** Frais de livraison les plus bas parmi les villes desservies (null si inconnus). */
export function minDeliveryFee(cities: DeliveryCity[]): number | null {
  const fees = cities.map((c) => c.fee).filter((fee) => Number.isFinite(fee) && fee > 0);
  return fees.length > 0 ? Math.min(...fees) : null;
}

export interface ReservationAmountInput {
  subtotal: number;
  receptionMode: ReceptionMode;
  selectedCity?: DeliveryCity | null;
  deliveryFeePayment?: 'upfront' | 'on_delivery';
}

export interface ReservationAmountComputation {
  subtotal: number;
  deliveryFee: number;
  countedDeliveryFee: number;
  total: number;
  deliveryLabel: string;
  isOnDelivery: boolean;
}

/**
 * Calcule les montants du récapitulatif de réservation (§6.6 & §9.3).
 */
export function computeReservationAmounts({
  subtotal,
  receptionMode,
  selectedCity,
  deliveryFeePayment = 'upfront',
}: ReservationAmountInput): ReservationAmountComputation {
  if (receptionMode === 'pickup') {
    return {
      subtotal,
      deliveryFee: 0,
      countedDeliveryFee: 0,
      total: subtotal,
      deliveryLabel: 'Gratuit',
      isOnDelivery: false,
    };
  }

  if (!selectedCity) {
    return {
      subtotal,
      deliveryFee: 0,
      countedDeliveryFee: 0,
      total: subtotal,
      deliveryLabel: 'À choisir',
      isOnDelivery: false,
    };
  }

  const fee = selectedCity.fee;
  if (deliveryFeePayment === 'on_delivery') {
    return {
      subtotal,
      deliveryFee: fee,
      countedDeliveryFee: 0,
      total: subtotal,
      deliveryLabel: 'À payer à la réception',
      isOnDelivery: true,
    };
  }

  return {
    subtotal,
    deliveryFee: fee,
    countedDeliveryFee: fee,
    total: subtotal + fee,
    deliveryLabel: formatPrice(fee),
    isOnDelivery: false,
  };
}
