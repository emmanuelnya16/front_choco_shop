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

function formatReceptionLine(reservation: Reservation): string {
  if (reservation.receptionMode === 'pickup') {
    return 'Retrait en boutique — Douala Akwa';
  }
  const city =
    reservation.city ?? reservation.deliveryAddress?.city ?? 'Douala';
  const agencyName =
    reservation.agency?.name ?? reservation.deliveryAddress?.agencyName;
  if (agencyName) {
    return `Livraison — ${city}, agence ${agencyName}`;
  }
  const district =
    reservation.address?.district ??
    reservation.deliveryAddress?.district ??
    reservation.deliveryAddress?.quarter;
  if (district) {
    return `Livraison — ${city}, ${district}`;
  }
  return `Livraison — ${city}`;
}

function formatCustomerPhoneWithPrefix(rawPhone?: string): string {
  if (!rawPhone) return '+237 690 00 00 01';
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
    "Je viens d'envoyer ma preuve de paiement.",
    '',
    `Réservation : ${reservation.ref}`,
    'Articles :',
    ...itemLines,
    `Total payé : ${formatPrice(totalAmount)} (${resolvedOperator})`,
    `Réception : ${formatReceptionLine(reservation)}`,
    `Mon numéro : ${phoneDisplay}`,
    '',
    `Fiche : ${resolvedOrigin}/admin/reservations/${reservation.ref}`,
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
  whatsappNumber: string,
  options: WhatsAppPaymentMessageOptions,
): string {
  const digits = whatsappNumber.replace(/\D/g, '') || '237690000000';
  const text = buildWhatsAppPaymentMessage(options);
  return `https://wa.me/${digits}?text=${encodeURIComponent(text)}`;
}

/**
 * Construit l'URL WhatsApp pour le cas où la réservation a expiré (410) alors que le client a déjà payé (§7.3).
 */
export function buildWhatsAppExpiredPaidUrl(
  whatsappNumber: string,
  ref: string,
  totalAmount: number,
): string {
  const digits = whatsappNumber.replace(/\D/g, '') || '237690000000';
  const text = [
    'Bonjour DR Choco 👋',
    `Ma réservation ${ref} a expiré mais j'ai déjà effectué le paiement de ${formatPrice(totalAmount)}.`,
    'Voici ma capture de confirmation pour que vous puissiez vérifier mon règlement.',
  ].join('\n');
  return `https://wa.me/${digits}?text=${encodeURIComponent(text)}`;
}
