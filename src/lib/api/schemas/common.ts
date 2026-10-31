import { z } from 'zod';
import type { ReceptionMode } from '@/types/domain';
import type { ReservationStatusCode } from '@/types/reservationStatus';

/**
 * Briques communes des schémas de réponse (M7 §5.3).
 * Les objets sont « souples » (`z.looseObject`) : un champ en plus ne déclenche jamais d'alerte ;
 * seuls les champs que le front utilise vraiment sont requis.
 */

/** Date ISO 8601 lisible par `new Date()` (comptes à rebours, tri, « Mis à jour le … »). */
export const isoDate = z
  .string()
  .refine((value) => !Number.isNaN(Date.parse(value)), { error: 'date invalide' });

// Copie des codes de src/types/reservationStatus.ts, sans importer ce module (icônes) dans le
// morceau de validation ; la liste est comparée à STATUS_META dans src/test/m7-contrat.test.ts.
export const RESERVATION_STATUSES = [
  'reserved',
  'pending_validation',
  'payment_rejected',
  'confirmed',
  'preparing',
  'handed_to_agency',
  'ready_for_pickup',
  'in_delivery',
  'delivered',
  'picked_up',
  'expired',
  'cancelled',
] as const satisfies readonly ReservationStatusCode[];

export const reservationStatusSchema = z.enum(RESERVATION_STATUSES);

export const receptionModeSchema = z.enum(['delivery', 'pickup'] as const satisfies readonly ReceptionMode[]);

/** Pagination commune (`Paginated<T>` de src/types/domain.ts). */
export function paginated<T extends z.ZodType>(item: T) {
  return z.looseObject({
    items: z.array(item),
    page: z.number(),
    pageSize: z.number(),
    total: z.number(),
    totalPages: z.number(),
  });
}
