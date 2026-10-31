import { z } from 'zod';
import { isoDate, paginated, receptionModeSchema, reservationStatusSchema } from './common';

/** Réservations : `Reservation`, `ReservationsListPage`, `ReservationsSummary`… (src/types). */

const reservationItemSchema = z.looseObject({
  id: z.string(),
  productId: z.string(),
  slug: z.string(),
  name: z.string(),
  image: z.string(),
  variantId: z.string(),
  size: z.string(),
  colorName: z.string(),
  colorCode: z.string().optional(),
  colorHex: z.string().optional(),
  unitPrice: z.number(),
  quantity: z.number(),
});

const packagePhotoSchema = z.looseObject({
  id: z.string(),
  url: z.string(),
  thumbnailUrl: z.string(),
  width: z.number(),
  height: z.number(),
  takenAt: isoDate,
});

const timelineEventSchema = z.looseObject({
  status: reservationStatusSchema,
  at: isoDate,
  note: z.string().optional(),
  actor: z.enum(['client', 'shop', 'system']).optional(),
});

const amountSchema = z.looseObject({
  subtotal: z.number(),
  deliveryFee: z.number(),
  total: z.number(),
});

/** `GET /reservations/:ref` : détail d'une réservation (suivi, paiement, preuve, merci). */
export const reservationSchema = z.looseObject({
  ref: z.string(),
  status: reservationStatusSchema,
  receptionMode: receptionModeSchema,
  items: z.array(reservationItemSchema),
  subtotal: z.number(),
  deliveryFee: z.number(),
  total: z.number(),
  amount: amountSchema.optional(),
  city: z.string().optional(),
  address: z
    .looseObject({ district: z.string().optional(), landmark: z.string().optional() })
    .optional(),
  agency: z
    .looseObject({
      id: z.string().optional(),
      name: z.string(),
      address: z.string().optional(),
      city: z.string().optional(),
      phone: z.string().optional(),
      openingHours: z.string().optional(),
    })
    .optional(),
  proof: z
    .looseObject({
      thumbnailUrl: z.string(),
      uploadedAt: isoDate,
      operator: z.enum(['orange', 'mtn']).optional(),
    })
    .optional(),
  rejection: z.looseObject({ reason: z.string(), rejectedAt: isoDate }).optional(),
  rejectionReason: z.string().optional(),
  notes: z.string().optional(),
  createdAt: isoDate,
  updatedAt: isoDate,
  // Compte à rebours du paiement (24 h) : indispensable à l'écran de paiement
  expiresAt: isoDate,
  serverTime: isoDate.optional(),
  packagePhotos: z.array(packagePhotoSchema),
  packageReadyAt: isoDate.nullable(),
  timeline: z.array(timelineEventSchema),
  cancellable: z.boolean(),
  cancelDeadline: isoDate.nullable().optional(),
  customer: z
    .looseObject({ firstName: z.string(), lastName: z.string(), phone: z.string() })
    .optional(),
  deliveryAddress: z
    .looseObject({
      city: z.string(),
      quarter: z.string(),
      district: z.string().optional(),
      landmark: z.string().optional(),
      agencyId: z.string().optional(),
      agencyName: z.string().optional(),
      recipientName: z.string().optional(),
      recipientPhone: z.string(),
    })
    .optional(),
});

/** `GET /reservations` et `GET /reservations?status=…` : réservations complètes. */
export const reservationListSchema = z.array(reservationSchema);

/** `POST /reservations` : réservation créée, avec l'heure du serveur pour le compte à rebours. */
export const reservationCreatedSchema = reservationSchema.extend({
  serverTime: isoDate,
  amount: amountSchema,
});

const reservationListItemSchema = z.looseObject({
  ref: z.string(),
  status: reservationStatusSchema,
  createdAt: isoDate,
  updatedAt: isoDate,
  expiresAt: isoDate.optional(),
  serverTime: isoDate.optional(),
  amount: z.looseObject({ total: z.number() }),
  itemsCount: z.number(),
  itemsPreview: z.array(z.looseObject({ image: z.string(), name: z.string() })),
  packagePhotoThumb: z.string().nullable().optional(),
  receptionMode: receptionModeSchema,
  city: z.string().optional(),
  reachedStatus: reservationStatusSchema.optional(),
});

/** `GET /reservations?scope=active|done&page=N` : « Mes réservations », par onglet. */
export const reservationsPageSchema = paginated(reservationListItemSchema).extend({
  counts: z.looseObject({ active: z.number(), done: z.number() }),
});

/** `GET /reservations/summary` : repère de l'onglet « Réservations ». */
export const reservationsSummarySchema = z.looseObject({
  needsAction: z.number(),
  lastUpdatedAt: isoDate.nullable(),
  items: z.array(
    z.looseObject({
      ref: z.string(),
      status: reservationStatusSchema,
      updatedAt: isoDate,
      hasPackagePhotos: z.boolean(),
    }),
  ),
});
