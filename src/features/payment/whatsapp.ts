import { env } from '@/lib/env';
import { formatCmPhone } from '@/lib/utils/phone';
import { formatPrice } from '@/lib/utils/price';
import type { Reservation } from '@/types/domain';

export interface WhatsAppPaymentMessageOptions {
  reservation: Reservation;
  operatorLabel?: string;
  origin?: string;
}

const MAX_WHATSAPP_ITEMS = 4;
const MAX_WHATSAPP_LENGTH = 1000;

/** Chiffres d'un numéro WhatsApp utilisable (indicatif compris), ou null si le numéro est inconnu ou incomplet. */
function toWhatsAppDigits(rawNumber?: string | null): string | null {
  const digits = (rawNumber ?? '').replace(/\D/g, '');
  return digits.length >= 8 ? digits : null;
}

/**
 * Numéro WhatsApp de la boutique (M7) : réglages reçus de l'API, puis réglages mémorisés, puis
 * VITE_SHOP_WHATSAPP. Aucun numéro fictif : `undefined` si aucun n'est connu (les boutons WhatsApp
 * sont alors masqués).
 */
export function resolveShopWhatsapp(...candidates: Array<string | null | undefined>): string | undefined {
  for (const candidate of [...candidates, env.shopWhatsapp]) {
    if (candidate && toWhatsAppDigits(candidate)) return candidate.trim();
  }
  return undefined;
}

/** Lien wa.me : numéro fourni, sinon celui de la configuration ; sans numéro connu, WhatsApp propose de choisir le destinataire. */
function waLink(whatsappNumber: string | null | undefined, text: string): string {
  const digits = toWhatsAppDigits(whatsappNumber) ?? toWhatsAppDigits(env.shopWhatsapp);
  return `https://wa.me/${digits ?? ''}?text=${encodeURIComponent(text)}`;
}

function formatReceptionLine(reservation: Reservation): string {
  if (reservation.receptionMode === 'pickup') {
    return 'Retrait en boutique';
  }
  const city = reservation.city ?? reservation.deliveryAddress?.city;
  const agencyName =
    reservation.agency?.name ?? reservation.deliveryAddress?.agencyName;
  const district =
    reservation.address?.district ??
    reservation.deliveryAddress?.district ??
    reservation.deliveryAddress?.quarter;
  const place = [city, agencyName ? `agence ${agencyName}` : district].filter(Boolean).join(', ');
  return place ? `Livraison — ${place}` : 'Livraison';
}

function formatCustomerPhoneWithPrefix(rawPhone?: string): string | null {
  if (!rawPhone) return null;
  const formatted = formatCmPhone(rawPhone);
  return formatted.startsWith('+237') ? formatted : `+237 ${formatted}`;
}

/**
 * Construit le message WhatsApp prérempli conforme au cahier des charges (§6.3 & §8.3) :
 * - Maximum 4 articles affichés puis « + X autres articles ».
 * - Moins de 1 000 caractères.
 * - Lien vers la fiche d'administration `${origin}/admin/reservations/${ref}`.
 */
export function buildWhatsAppPaymentMessage({
  reservation,
  operatorLabel,
  origin,
}: WhatsAppPaymentMessageOptions): string {
  const resolvedOrigin =
    origin ??
    (typeof window !== 'undefined'
      ? window.location.origin
      : 'https://drchoco.cm');

  const resolvedOperator =
    operatorLabel ??
    (reservation.proof?.operator === 'mtn' ? 'MTN MoMo' : 'Orange Money');

  const visibleItems = reservation.items.slice(0, MAX_WHATSAPP_ITEMS);
  const remainingCount = Math.max(
    0,
    reservation.items.length - MAX_WHATSAPP_ITEMS,
  );

  const itemLines = visibleItems.map((item) => {
    const variantParts: string[] = [];
    if (item.colorName && item.colorName.toLowerCase() !== 'unique') {
      variantParts.push(item.colorName);
    }
    if (item.size) {
      variantParts.push(item.size);
    }
    const details = variantParts.length > 0 ? ` — ${variantParts.join(', ')}` : '';
    return `• ${item.name}${details} × ${item.quantity}`;
  });

  if (remainingCount > 0) {
    itemLines.push(
      `+ ${remainingCount} autre${remainingCount > 1 ? 's' : ''} article${remainingCount > 1 ? 's' : ''}`,
    );
  }

  const totalAmount = reservation.amount?.total ?? reservation.total;
  const phoneDisplay = formatCustomerPhoneWithPrefix(
    reservation.proof?.payerPhone ??
      reservation.customer?.phone ??
      reservation.deliveryAddress?.recipientPhone,
  );

  const lines = [
    'Bonjour DR Choco 👋',
    "Je viens d’envoyer ma preuve de paiement.",
    '',
    `Réservation\u00A0: ${reservation.ref}`,
    'Articles\u00A0:',
    ...itemLines,
    `Total payé\u00A0: ${formatPrice(totalAmount)} (${resolvedOperator})`,
    `Réception\u00A0: ${formatReceptionLine(reservation)}`,
    ...(phoneDisplay ? [`Mon numéro\u00A0: ${phoneDisplay}`] : []),
    '',
    `Fiche\u00A0: ${resolvedOrigin}/admin/reservations/${reservation.ref}`,
  ];

  const message = lines.join('\n');
  if (message.length <= MAX_WHATSAPP_LENGTH) {
    return message;
  }
  return `${message.slice(0, MAX_WHATSAPP_LENGTH - 1)}…`;
}

/**
 * Construit l'URL `https://wa.me/<numéro>?text=<message encodé>` (§6.3).
 */
export function buildWhatsAppPaymentUrl(
  whatsappNumber: string | null | undefined,
  options: WhatsAppPaymentMessageOptions,
): string {
  return waLink(whatsappNumber, buildWhatsAppPaymentMessage(options));
}

/**
 * Construit l'URL WhatsApp pour le cas où la réservation a expiré (410) alors que le client a déjà payé (§7.3).
 */
export function buildWhatsAppExpiredPaidUrl(
  whatsappNumber: string | null | undefined,
  ref: string,
  totalAmount: number,
): string {
  const text = [
    'Bonjour DR Choco 👋',
    `Ma réservation ${ref} a expiré mais j’ai déjà effectué le paiement de ${formatPrice(totalAmount)}.`,
    'Voici la capture d’écran de mon paiement pour que vous puissiez le vérifier.',
  ].join('\n');
  return waLink(whatsappNumber, text);
}

/**
 * Lien WhatsApp « question sur ma réservation » (aide du détail et du profil, §5.1 M5).
 */
export function buildWhatsAppQuestionUrl(whatsappNumber: string | null | undefined, ref?: string): string {
  const text = ref
    ? `Bonjour DR Choco, j’ai une question sur ma réservation ${ref}.`
    : 'Bonjour DR Choco, j’ai une question.';
  return waLink(whatsappNumber, text);
}
