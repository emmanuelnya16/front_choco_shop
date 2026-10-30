import type {
  Agency,
  PackagePhoto,
  ReceptionMode,
  Reservation,
  ReservationActor,
  ReservationItem,
  ReservationTimelineEvent,
} from '@/types/domain';
import type { ReservationStatusCode } from '@/types/reservationStatus';
import { mockProducts } from './products';
import { mockAgencies, mockDeliveryCities, mockPublicSettings } from './settings';

/**
 * Réservations de démonstration (§3.3 M5).
 * Les dates sont relatives au moment du chargement (« il y a 5 h », « expire dans 5 h ») :
 * comptes à rebours et frises restent cohérents quel que soit le jour de la démonstration.
 *
 * Client principal : Junior Mbarga (+237 690 00 00 01).
 * - 8 en cours : reserved, payment_rejected, pending_validation (après un rejet), confirmed,
 *   preparing, handed_to_agency (livraison locale), ready_for_pickup (RES-000102), in_delivery (agence Yaoundé).
 * - 4 terminées récentes : delivered (dont un article aujourd'hui épuisé), picked_up, expired, cancelled.
 * - 7 terminées plus anciennes (RES-000090 à RES-000096) pour tester le chargement de la 2ᵉ page.
 * - RES-000113 appartient à un autre client : elle doit rester « introuvable » pour Junior.
 */

const HOUR_MS = 3600 * 1000;

export const JUNIOR_CUSTOMER = {
  firstName: 'Junior',
  lastName: 'Mbarga',
  phone: '+237690000001',
};

const OTHER_CUSTOMER = {
  firstName: 'Aïcha',
  lastName: 'Bello',
  phone: '+237677000002',
};

const JUNIOR_HOME = {
  city: 'Douala',
  quarter: 'Bonamoussadi',
  district: 'Bonamoussadi',
  landmark: 'Après la pharmacie du carrefour Eto’o, portail noir en face du glacier',
  recipientName: 'Junior Mbarga',
  recipientPhone: '+237690000001',
};

const PACKAGE_PHOTO_FILES: Record<1 | 2 | 3 | 4, { width: number; height: number }> = {
  1: { width: 800, height: 600 }, // vue de dessus, 4:3
  2: { width: 800, height: 600 }, // vue de trois-quarts, 4:3
  3: { width: 800, height: 1000 }, // vue de trois-quarts, 4:5
  4: { width: 800, height: 1000 }, // vue de dessus, 4:5
};

/**
 * Règle d'annulation par le client (§3.2 M5).
 * HYPOTHÈSE: possible jusqu'à la confirmation incluse, plus à partir de la préparation.
 * Le front n'applique jamais cette règle lui-même : il lit `cancellable` renvoyé par l'API.
 */
export function computeCancellable(status: ReservationStatusCode): boolean {
  return (
    status === 'reserved' ||
    status === 'payment_rejected' ||
    status === 'pending_validation' ||
    status === 'confirmed'
  );
}

export function buildPackagePhoto(
  ref: string,
  index: 1 | 2 | 3 | 4,
  takenAt: string,
): PackagePhoto {
  const dims = PACKAGE_PHOTO_FILES[index];
  return {
    id: `pkg-${ref}-${index}`,
    url: `/mock/colis-${index}.svg`,
    thumbnailUrl: `/mock/colis-${index}.svg`,
    width: dims.width,
    height: dims.height,
    takenAt,
  };
}

function line(
  ref: string,
  position: number,
  slug: string,
  colorCode: string,
  size: string,
  quantity = 1,
): ReservationItem {
  const product = mockProducts.find((p) => p.slug === slug);
  if (!product) {
    throw new Error(`[fixtures/reservations] Produit inconnu : ${slug}`);
  }
  const color = product.colors.find((c) => c.code === colorCode) ?? product.colors[0];
  return {
    id: `item-${ref}-${position}`,
    productId: product.id,
    slug: product.slug,
    name: product.name,
    image: product.fallbackImages[0] ?? '/mock/product-tee.svg',
    variantId: `${product.id}-${color.code}-${size.toLowerCase()}`,
    size,
    colorName: color.name,
    colorCode: color.code,
    colorHex: color.hex,
    unitPrice: product.price,
    quantity,
  };
}

function agencyById(id: string): Agency {
  const agency = mockAgencies.find((a) => a.id === id);
  if (!agency) {
    throw new Error(`[fixtures/reservations] Agence inconnue : ${id}`);
  }
  return agency;
}

function cityFee(name: string): number {
  return mockDeliveryCities.find((c) => c.name === name)?.fee ?? 1500;
}

type Destination =
  | { kind: 'pickup' }
  | { kind: 'local' }
  | { kind: 'agency'; agencyId: string; recipientName: string; recipientPhone: string };

interface SeedSpec {
  ref: string;
  status: ReservationStatusCode;
  destination: Destination;
  items: ReservationItem[];
  /** Entrées du journal : [statut, il y a N heures, note ?, acteur ?] */
  events: Array<[ReservationStatusCode, number, string?, ReservationActor?]>;
  /** Pour les statuts en attente de paiement : expiration dans N heures. */
  expiresInHours?: number;
  photos?: { indices: Array<1 | 2 | 3 | 4>; hoursAgo: number };
  proofOperator?: 'orange' | 'mtn';
  rejectionReason?: string;
  notes?: string;
  customer?: typeof JUNIOR_CUSTOMER;
}

function buildReservation(spec: SeedSpec, now: number): Reservation {
  const at = (hoursAgo: number) => new Date(now - hoursAgo * HOUR_MS).toISOString();
  const timeline: ReservationTimelineEvent[] = spec.events.map(([status, hoursAgo, note, actor]) => ({
    status,
    at: at(hoursAgo),
    ...(note ? { note } : {}),
    ...(actor ? { actor } : {}),
  }));
  const createdAt = timeline[0]?.at ?? at(1);
  const updatedAt = timeline[timeline.length - 1]?.at ?? createdAt;

  const receptionMode: ReceptionMode = spec.destination.kind === 'pickup' ? 'pickup' : 'delivery';
  const subtotal = spec.items.reduce((sum, item) => sum + item.unitPrice * item.quantity, 0);

  let deliveryFee = 0;
  let city: string | undefined = mockPublicSettings.shop.city;
  let deliveryAddress: Reservation['deliveryAddress'];
  let address: Reservation['address'];
  let agency: Reservation['agency'];

  if (spec.destination.kind === 'local') {
    deliveryFee = cityFee('Douala');
    city = JUNIOR_HOME.city;
    deliveryAddress = { ...JUNIOR_HOME };
    address = { district: JUNIOR_HOME.district, landmark: JUNIOR_HOME.landmark };
  } else if (spec.destination.kind === 'agency') {
    const ag = agencyById(spec.destination.agencyId);
    deliveryFee = cityFee(ag.city);
    city = ag.city;
    agency = {
      id: ag.id,
      name: ag.name,
      address: ag.address,
      city: ag.city,
      phone: ag.phone,
      openingHours: ag.openingHours,
    };
    deliveryAddress = {
      city: ag.city,
      quarter: ag.name,
      agencyId: ag.id,
      agencyName: ag.name,
      recipientName: spec.destination.recipientName,
      recipientPhone: spec.destination.recipientPhone,
    };
  }

  const total = subtotal + deliveryFee;
  const firstProof = timeline.find((e) => e.status === 'pending_validation');
  const lastRejection = [...timeline].reverse().find((e) => e.status === 'payment_rejected');
  const packagePhotos = spec.photos
    ? spec.photos.indices.map((index, i) =>
        buildPackagePhoto(spec.ref, index, at(spec.photos!.hoursAgo + 0.01 * (spec.photos!.indices.length - i))),
      )
    : [];

  const expiresAt =
    spec.expiresInHours !== undefined
      ? new Date(now + spec.expiresInHours * HOUR_MS).toISOString()
      : new Date(new Date(createdAt).getTime() + 24 * HOUR_MS).toISOString();

  return {
    ref: spec.ref,
    status: spec.status,
    receptionMode,
    items: spec.items,
    subtotal,
    deliveryFee,
    total,
    amount: { subtotal, deliveryFee, total },
    city,
    address,
    agency,
    deliveryAddress,
    proof: firstProof
      ? {
          thumbnailUrl: '/mock/preuve-1.svg',
          uploadedAt: [...timeline].reverse().find((e) => e.status === 'pending_validation')!.at,
          operator: spec.proofOperator ?? 'orange',
        }
      : undefined,
    rejection:
      spec.status === 'payment_rejected' && lastRejection
        ? { reason: spec.rejectionReason ?? lastRejection.note ?? 'Paiement non validé', rejectedAt: lastRejection.at }
        : undefined,
    rejectionReason: spec.status === 'payment_rejected' ? spec.rejectionReason : undefined,
    createdAt,
    updatedAt,
    expiresAt,
    notes: spec.notes,
    packagePhotos,
    packageReadyAt: spec.photos ? at(spec.photos.hoursAgo) : null,
    timeline,
    cancellable: computeCancellable(spec.status),
    cancelDeadline: null,
    customer: spec.customer ?? JUNIOR_CUSTOMER,
  };
}

const YAOUNDE_RECIPIENT = { recipientName: 'Paul Essomba', recipientPhone: '+237677889900' };

function seedSpecs(): SeedSpec[] {
  return [
    // ── En cours ──────────────────────────────────────────────────────────────
    {
      ref: 'RES-000101',
      status: 'reserved',
      destination: { kind: 'local' },
      items: [line('RES-000101', 1, 'hoodie-barbele-noir', 'noir', 'L')],
      events: [['reserved', 19, 'Articles mis de côté pendant 24 h.']],
      expiresInHours: 5,
    },
    {
      ref: 'RES-000103',
      status: 'payment_rejected',
      destination: { kind: 'agency', agencyId: 'ag-yde-1', ...YAOUNDE_RECIPIENT },
      items: [line('RES-000103', 1, 'sneaker-monolithe-v1', 'noir', '42')],
      events: [
        ['reserved', 6, 'Articles mis de côté pendant 24 h.'],
        ['pending_validation', 5.5, 'Capture MTN MoMo reçue.'],
        ['payment_rejected', 4.8, 'Montant incorrect', 'shop'],
      ],
      expiresInHours: 18,
      proofOperator: 'mtn',
      rejectionReason: 'Montant incorrect',
    },
    {
      ref: 'RES-000104',
      status: 'pending_validation',
      destination: { kind: 'local' },
      items: [
        line('RES-000104', 1, 'tshirt-essentiel-lourd', 'noir', 'M', 2),
        line('RES-000104', 2, 'cargo-tactique-bitume', 'noir', 'M'),
      ],
      events: [
        ['reserved', 3, 'Articles mis de côté pendant 24 h.'],
        ['pending_validation', 2.6, 'Capture Orange Money reçue.'],
        ['payment_rejected', 2.1, 'Capture illisible', 'shop'],
        ['pending_validation', 0.6, 'Nouvelle preuve envoyée.'],
      ],
      expiresInHours: 21,
    },
    {
      ref: 'RES-000105',
      status: 'confirmed',
      destination: { kind: 'pickup' },
      items: [line('RES-000105', 1, 'babouche-minimal-sable', 'noir', '42')],
      events: [
        ['reserved', 26, 'Articles mis de côté pendant 24 h.'],
        ['pending_validation', 25.5, 'Capture Orange Money reçue.'],
        ['confirmed', 24.9, 'Paiement validé par la boutique.', 'shop'],
      ],
    },
    {
      ref: 'RES-000106',
      status: 'preparing',
      destination: {
        kind: 'agency',
        agencyId: 'ag-baf-1',
        recipientName: 'Junior Mbarga',
        recipientPhone: '+237690000001',
      },
      items: [
        line('RES-000106', 1, 'jogger-lourd-incompris', 'noir', 'L'),
        line('RES-000106', 2, 'tshirt-manches-longues-brut', 'noir', 'L'),
      ],
      events: [
        ['reserved', 30, 'Articles mis de côté pendant 24 h.'],
        ['pending_validation', 29.6, 'Capture MTN MoMo reçue.'],
        ['confirmed', 28.8, 'Paiement validé par la boutique.', 'shop'],
        ['preparing', 4, undefined, 'shop'],
      ],
      proofOperator: 'mtn',
    },
    {
      ref: 'RES-000107',
      status: 'handed_to_agency',
      destination: { kind: 'local' },
      items: [line('RES-000107', 1, 'sneaker-basse-asphalte', 'blanc', '42')],
      events: [
        ['reserved', 40, 'Articles mis de côté pendant 24 h.'],
        ['pending_validation', 39.5, 'Capture Orange Money reçue.'],
        ['confirmed', 38, 'Paiement validé par la boutique.', 'shop'],
        ['preparing', 20, undefined, 'shop'],
        ['handed_to_agency', 1.5, 'Colis prêt, en attente du livreur.', 'shop'],
      ],
      photos: { indices: [3], hoursAgo: 1.6 },
      notes: 'Merci d’appeler avant de passer, le portail est fermé à clé.',
    },
    {
      ref: 'RES-000102',
      status: 'ready_for_pickup',
      destination: { kind: 'pickup' },
      items: [
        line('RES-000102', 1, 'hoodie-barbele-noir', 'noir', 'XL'),
        line('RES-000102', 2, 'babouche-royale-akwa-cuir', 'noir', '43'),
      ],
      events: [
        ['reserved', 52, 'Articles mis de côté pendant 24 h.'],
        ['pending_validation', 51.8, 'Capture Orange Money reçue.'],
        ['confirmed', 51.5, 'Paiement validé par la boutique.', 'shop'],
        ['preparing', 50, undefined, 'shop'],
        ['ready_for_pickup', 48.3, 'Colis prêt à la boutique d’Akwa.', 'shop'],
      ],
      photos: { indices: [1, 2], hoursAgo: 48.4 },
    },
    {
      ref: 'RES-000108',
      status: 'in_delivery',
      destination: { kind: 'agency', agencyId: 'ag-yde-1', ...YAOUNDE_RECIPIENT },
      items: [
        line('RES-000108', 1, 'babouche-croco-imperiale', 'noir', '41'),
        line('RES-000108', 2, 'tshirt-manifeste-237', 'blanc', 'M'),
        line('RES-000108', 3, 'bandana-pack-signature', 'noir', 'Unique'),
      ],
      events: [
        ['reserved', 72, 'Articles mis de côté pendant 24 h.'],
        ['pending_validation', 71.5, 'Capture Orange Money reçue.'],
        ['confirmed', 70, 'Paiement validé par la boutique.', 'shop'],
        ['preparing', 50, undefined, 'shop'],
        ['handed_to_agency', 26, 'Colis remis à Agence Express Centre.', 'shop'],
        ['in_delivery', 8, 'En route vers Yaoundé.', 'shop'],
      ],
      photos: { indices: [4, 2, 1], hoursAgo: 26.2 },
    },

    // ── Terminées récentes ─────────────────────────────────────────────────────
    {
      ref: 'RES-000109',
      status: 'delivered',
      destination: { kind: 'local' },
      items: [
        // Article aujourd'hui épuisé : « Réserver à nouveau » doit le signaler (§9.1, parcours 7)
        line('RES-000109', 1, 'tshirt-archive-01', 'noir', 'L'),
        line('RES-000109', 2, 'pantalon-large-atelier', 'noir', 'M'),
        line('RES-000109', 3, 'tshirt-essentiel-lourd', 'blanc', 'L'),
      ],
      events: [
        ['reserved', 120, 'Articles mis de côté pendant 24 h.'],
        ['pending_validation', 119.5, 'Capture Orange Money reçue.'],
        ['confirmed', 118, 'Paiement validé par la boutique.', 'shop'],
        ['preparing', 100, undefined, 'shop'],
        ['handed_to_agency', 98, 'Colis prêt, en attente du livreur.', 'shop'],
        ['in_delivery', 97, 'Le livreur est en route.', 'shop'],
        ['delivered', 95, 'Colis remis en main propre.', 'shop'],
      ],
      photos: { indices: [1], hoursAgo: 98.1 },
    },
    {
      ref: 'RES-000110',
      status: 'picked_up',
      destination: { kind: 'pickup' },
      items: [line('RES-000110', 1, 'derby-commando-douala', 'noir', '43')],
      events: [
        ['reserved', 150, 'Articles mis de côté pendant 24 h.'],
        ['pending_validation', 149.7, 'Capture MTN MoMo reçue.'],
        ['confirmed', 148, 'Paiement validé par la boutique.', 'shop'],
        ['preparing', 130, undefined, 'shop'],
        ['ready_for_pickup', 128, 'Colis prêt à la boutique d’Akwa.', 'shop'],
        ['picked_up', 110, 'Colis retiré à la boutique.', 'shop'],
      ],
      photos: { indices: [2, 4], hoursAgo: 128.1 },
      proofOperator: 'mtn',
    },
    {
      ref: 'RES-000111',
      status: 'expired',
      destination: { kind: 'local' },
      items: [line('RES-000111', 1, 'short-cargo-beton', 'gris', 'M')],
      events: [
        ['reserved', 200, 'Articles mis de côté pendant 24 h.'],
        ['expired', 176, 'Délai de 24 h dépassé : articles remis en vente.', 'system'],
      ],
    },
    {
      ref: 'RES-000112',
      status: 'cancelled',
      destination: { kind: 'pickup' },
      items: [line('RES-000112', 1, 'sneaker-runner-bonapriso', 'noir', '41')],
      events: [
        ['reserved', 230, 'Articles mis de côté pendant 24 h.'],
        ['pending_validation', 229, 'Capture Orange Money reçue.'],
        ['cancelled', 228, 'J’ai changé d’avis', 'client'],
      ],
    },

    // ── Autre client (contrôle d'accès) ───────────────────────────────────────
    {
      ref: 'RES-000113',
      status: 'confirmed',
      destination: { kind: 'pickup' },
      items: [line('RES-000113', 1, 'babouche-quotidienne-souple', 'noir', '41')],
      events: [
        ['reserved', 10, 'Articles mis de côté pendant 24 h.'],
        ['pending_validation', 9.5, 'Capture Orange Money reçue.'],
        ['confirmed', 9, 'Paiement validé par la boutique.', 'shop'],
      ],
      customer: OTHER_CUSTOMER,
    },
  ];
}

/** Archives : 7 réservations terminées plus anciennes, pour que l'onglet « Terminées » ait 2 pages (10 par page). */
function archiveSpecs(): SeedSpec[] {
  const picks: Array<[string, string, string]> = [
    ['tshirt-essentiel-lourd', 'gris', 'L'],
    ['babouche-quotidienne-souple', 'noir', '42'],
    ['jogger-lourd-incompris', 'gris', 'M'],
    ['sneaker-basse-asphalte', 'noir', '43'],
    ['tshirt-manifeste-237', 'noir', 'L'],
    ['babouche-croco-imperiale', 'blanc', '42'],
    ['short-cargo-beton', 'noir', 'L'],
  ];

  return picks.map(([slug, color, size], i) => {
    const ref = `RES-0000${90 + i}`;
    const pickup = i % 2 === 1;
    const start = 24 * (60 - i * 5); // de 60 à 30 jours
    const events: SeedSpec['events'] = pickup
      ? [
          ['reserved', start, 'Articles mis de côté pendant 24 h.'],
          ['pending_validation', start - 0.5, 'Capture Orange Money reçue.'],
          ['confirmed', start - 1.5, 'Paiement validé par la boutique.', 'shop'],
          ['preparing', start - 18, undefined, 'shop'],
          ['ready_for_pickup', start - 20, 'Colis prêt à la boutique d’Akwa.', 'shop'],
          ['picked_up', start - 44, 'Colis retiré à la boutique.', 'shop'],
        ]
      : [
          ['reserved', start, 'Articles mis de côté pendant 24 h.'],
          ['pending_validation', start - 0.5, 'Capture Orange Money reçue.'],
          ['confirmed', start - 1.5, 'Paiement validé par la boutique.', 'shop'],
          ['preparing', start - 18, undefined, 'shop'],
          ['handed_to_agency', start - 20, 'Colis prêt, en attente du livreur.', 'shop'],
          ['in_delivery', start - 21, 'Le livreur est en route.', 'shop'],
          ['delivered', start - 23, 'Colis remis en main propre.', 'shop'],
        ];
    return {
      ref,
      status: pickup ? 'picked_up' : 'delivered',
      destination: pickup ? { kind: 'pickup' } : { kind: 'local' },
      items: [line(ref, 1, slug, color, size)],
      events,
      photos: { indices: [i % 2 === 0 ? 1 : 2], hoursAgo: start - 20.1 },
    } satisfies SeedSpec;
  });
}

export function createSeedReservations(now: number = Date.now()): Record<string, Reservation> {
  const all = [...seedSpecs(), ...archiveSpecs()].map((spec) => buildReservation(spec, now));
  return Object.fromEntries(all.map((r) => [r.ref, r]));
}

/** Base mémoire mutable partagée par les gestionnaires MSW et le simulateur boutique. */
export const mockReservations: Record<string, Reservation> = createSeedReservations();

/** Remet les réservations de démonstration dans leur état initial (tests et bouton du simulateur). */
export function resetMockReservations(now: number = Date.now()): void {
  for (const key of Object.keys(mockReservations)) {
    delete mockReservations[key];
  }
  Object.assign(mockReservations, createSeedReservations(now));
}
