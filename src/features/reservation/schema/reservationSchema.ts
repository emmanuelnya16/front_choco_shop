import { zodResolver } from '@hookform/resolvers/zod';
import type { Resolver } from 'react-hook-form';
import { z } from 'zod';
import { isValidCmPhone } from '@/lib/utils/phone';
import type { DeliveryCity } from '@/types/domain';
import { isCityLocal, type ReservationFormValues } from './reservationRules';

// Règles sans zod, réexportées pour les modules existants (profil, tests)
export {
  computeReservationAmounts,
  isCityLocal,
  minDeliveryFee,
  type ReservationAmountComputation,
  type ReservationAmountInput,
  type ReservationFormValues,
} from './reservationRules';

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
        .min(1, 'Indiquez votre prénom pour préparer votre réservation.'),
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
      addDeliveryAddressIssues(data, ctx, cities);
    });
}

export const reservationFormSchema = createReservationFormSchema();

/** Champs d'adresse de livraison validés par `addDeliveryAddressIssues`. */
export interface DeliveryAddressRuleInput {
  city: string;
  district: string;
  landmark: string;
  agencyId: string;
  recipientType: 'self' | 'other';
  recipientName: string;
  recipientPhone: string;
}

/**
 * Règles d'une adresse de livraison (§6.4 M3), partagées par le formulaire de réservation
 * et les adresses du profil (§7.3 M5) :
 * - Ville locale (Douala) : quartier et point de repère obligatoires.
 * - Autre ville (agence) : agence obligatoire ; destinataire complet si `recipientType === 'other'`.
 */
export function addDeliveryAddressIssues(
  data: DeliveryAddressRuleInput,
  ctx: z.RefinementCtx,
  cities?: DeliveryCity[],
): void {
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
        message: 'Indiquez votre quartier (ex.\u00A0: Bonamoussadi, Akwa).',
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
}


/**
 * Validation du formulaire de réservation pour react-hook-form, construite à la demande :
 * la page Réservation charge ce module (et zod) seulement au moment de valider (M7, poids).
 */
export function buildReservationResolver(cities?: DeliveryCity[]): Resolver<ReservationFormValues> {
  return zodResolver(createReservationFormSchema(cities));
}
