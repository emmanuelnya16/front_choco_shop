import { z } from 'zod';
import { isValidCmPhone } from '@/lib/utils/phone';
import { formatPrice } from '@/lib/utils/price';
import type { DeliveryCity, ReceptionMode } from '@/types/domain';

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

/**
 * Schéma Zod du formulaire de réservation (§6.1 à §6.7 & §9.3) :
 * - Ville locale (Douala) : quartier (`district`) et point de repère (`landmark`) obligatoires.
 * - Autre ville (envoi par agence) : agence (`agencyId`) obligatoire ; nom et téléphone du destinataire obligatoires si `recipientType === 'other'`.
 * - Retrait en boutique (`pickup`) : aucune adresse ni agence requise.
 */
export function createReservationFormSchema(cities?: DeliveryCity[]) {
  return z
    .object({
      firstName: z
        .string()
        .trim()
        .min(1, 'Indiquez votre prénom pour préparer votre commande.'),
      lastName: z.string().trim(),
      receptionMode: z.enum(['delivery', 'pickup']),
      city: z.string().trim(),
      district: z.string().trim(),
      landmark: z.string().trim(),
      agencyId: z.string().trim(),
      recipientType: z.enum(['self', 'other']),
      recipientName: z.string().trim(),
      recipientPhone: z.string().trim(),
      notes: z
        .string()
        .max(200, 'Vos remarques ne doivent pas dépasser 200 caractères.'),
      saveAddress: z.boolean(),
      addressLabel: z.enum(['Maison', 'Bureau', 'Autre']),
    })
    .superRefine((data, ctx) => {
      if (data.receptionMode !== 'delivery') {
        return;
      }

      if (!data.city) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['city'],
          message: 'Choisissez votre ville de livraison.',
        });
        return;
      }

      const local = isCityLocal(data.city, cities);

      if (local) {
        if (data.district.length < 2) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ['district'],
            message: 'Indiquez votre quartier (ex. : Bonamoussadi, Akwa).',
          });
        }
        if (data.landmark.length < 5) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ['landmark'],
            message:
              'Précisez un point de repère connu pour guider le livreur.',
          });
        }
      } else {
        if (!data.agencyId) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ['agencyId'],
            message:
              'Choisissez l’agence de transport où récupérer votre colis.',
          });
        }
        if (data.recipientType === 'other') {
          if (data.recipientName.length < 2) {
            ctx.addIssue({
              code: z.ZodIssueCode.custom,
              path: ['recipientName'],
              message:
                'Indiquez le nom complet de la personne qui récupérera le colis.',
            });
          }
          if (!isValidCmPhone(data.recipientPhone)) {
            ctx.addIssue({
              code: z.ZodIssueCode.custom,
              path: ['recipientPhone'],
              message:
                'Entrez un numéro mobile camerounais valide (9 chiffres commençant par 6).',
            });
          }
        }
      }
    });
}

export const reservationFormSchema = createReservationFormSchema();

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
