/**
 * Schémas des réponses principales de l'API (M7 §5.3), utilisés par src/lib/api/contract.ts.
 * Chargés à la demande : zod n'entre jamais dans le JavaScript de démarrage.
 */
export { isoDate, RESERVATION_STATUSES } from './common';
export { productCardSchema, productDetailSchema, productsPageSchema } from './product';
export {
  reservationCreatedSchema,
  reservationListSchema,
  reservationSchema,
  reservationsPageSchema,
  reservationsSummarySchema,
} from './reservation';
export { publicSettingsSchema } from './settings';
export { authSessionSchema, refreshSessionSchema, userSchema } from './session';
