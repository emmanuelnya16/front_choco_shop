import { z } from 'zod';

/** `GET /settings/public` : `PublicSettings` (src/types/domain.ts). */

const paymentOperatorSchema = z.looseObject({
  id: z.enum(['orange', 'mtn']),
  label: z.string(),
  merchantName: z.string(),
  merchantCode: z.string(),
  ussdTemplate: z.string().nullable(),
  qrImageUrl: z.string().nullable(),
  steps: z.array(z.string()),
  enabled: z.boolean(),
});

const legacyOperatorSchema = z.looseObject({
  code: z.enum(['orange', 'mtn']),
  name: z.string(),
  merchantCode: z.string(),
  ussdTemplate: z.string(),
  accountName: z.string(),
  qrCodeUrl: z.string().optional(),
});

export const publicSettingsSchema = z.looseObject({
  whatsappNumber: z.string(),
  deliveryFeePayment: z.enum(['upfront', 'on_delivery']),
  shop: z.looseObject({
    name: z.string(),
    address: z.string(),
    city: z.string(),
    openingHours: z.string(),
    mapsUrl: z.string(),
  }),
  payment: z.looseObject({
    operators: z.array(paymentOperatorSchema),
    validationDelayText: z.string(),
    // Valeurs par défaut côté front si absentes (ProofPage, usePaymentSettings)
    exactAmountRequired: z.boolean().optional(),
    proofMaxSizeMb: z.number().optional(),
  }),
  // Champs historiques ou lus avec une valeur de repli (pied de page, M1/M2)
  pickupAddress: z
    .looseObject({
      name: z.string(),
      city: z.string(),
      quarter: z.string(),
      landmark: z.string(),
      openingHours: z.string(),
    })
    .optional(),
  operators: z.array(legacyOperatorSchema).optional(),
  reservationExpiryHours: z.number().optional(),
  reservationHoldHours: z.number().optional(),
});
