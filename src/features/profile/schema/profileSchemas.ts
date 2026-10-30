import { z } from 'zod';
import {
  addDeliveryAddressIssues,
  isCityLocal,
} from '@/features/reservation/schema/reservationSchema';
import { normalizeCmPhone } from '@/lib/utils/phone';
import type { SaveAddressPayload } from '@/types/api';
import type { Address, Agency, DeliveryCity, User } from '@/types/domain';

export const ADDRESS_LABELS = ['Maison', 'Bureau', 'Autre'] as const;
export type AddressLabel = (typeof ADDRESS_LABELS)[number];

export interface AddressFormValues {
  label: AddressLabel;
  city: string;
  district: string;
  landmark: string;
  agencyId: string;
  recipientType: 'self' | 'other';
  recipientName: string;
  recipientPhone: string;
}

/** Mêmes règles que l'adresse du formulaire de réservation (M3), via `addDeliveryAddressIssues` (§7.3 M5). */
export function createAddressFormSchema(cities?: DeliveryCity[]) {
  return z
    .object({
      label: z.enum(ADDRESS_LABELS),
      city: z.string().trim(),
      district: z.string().trim(),
      landmark: z.string().trim(),
      agencyId: z.string().trim(),
      recipientType: z.enum(['self', 'other']),
      recipientName: z.string().trim(),
      recipientPhone: z.string().trim(),
    })
    .superRefine((data, ctx) => addDeliveryAddressIssues(data, ctx, cities));
}

function toLabel(label: string): AddressLabel {
  return (ADDRESS_LABELS as readonly string[]).includes(label) ? (label as AddressLabel) : 'Autre';
}

function fullName(user?: Pick<User, 'firstName' | 'lastName'> | null): string {
  return [user?.firstName, user?.lastName].filter(Boolean).join(' ').trim();
}

/** Valeurs initiales de la feuille d'adresse (nouvelle adresse ou modification). */
export function addressToFormValues(
  address: Address | null,
  user: Pick<User, 'firstName' | 'lastName' | 'phone' | 'city'> | null,
): AddressFormValues {
  if (!address) {
    return {
      label: 'Maison',
      city: user?.city ?? 'Douala',
      district: '',
      landmark: '',
      agencyId: '',
      recipientType: 'self',
      recipientName: '',
      recipientPhone: '',
    };
  }
  const recipientIsOther =
    Boolean(address.agencyId) &&
    Boolean(address.recipientPhone) &&
    address.recipientPhone !== user?.phone;
  return {
    label: toLabel(address.label),
    city: address.city,
    district: address.agencyId ? '' : address.district || address.quarter || '',
    landmark: address.agencyId ? '' : address.landmark || address.details || '',
    agencyId: address.agencyId ?? '',
    recipientType: recipientIsOther ? 'other' : 'self',
    recipientName: recipientIsOther ? (address.recipientName ?? '') : '',
    recipientPhone: recipientIsOther ? (address.recipientPhone ?? '') : '',
  };
}

/**
 * Charge utile `POST/PATCH /me/addresses`, identique à l'enregistrement d'adresse du formulaire
 * de réservation (M3) : pour une agence, `district` = ville et `landmark` = nom de l'agence.
 */
export function formValuesToAddressPayload(
  values: AddressFormValues,
  options: {
    cities?: DeliveryCity[];
    agencies?: Agency[];
    user: Pick<User, 'firstName' | 'lastName' | 'phone'> | null;
  },
): Omit<SaveAddressPayload, 'id'> {
  const local = isCityLocal(values.city, options.cities);
  const other = !local && values.recipientType === 'other';
  let recipientPhone = options.user?.phone;
  if (other) {
    try {
      recipientPhone = normalizeCmPhone(values.recipientPhone);
    } catch {
      recipientPhone = values.recipientPhone;
    }
  }

  return {
    label: values.label,
    city: values.city,
    district: local ? values.district.trim() : values.city,
    landmark: local
      ? values.landmark.trim()
      : (options.agencies?.find((a) => a.id === values.agencyId)?.name ?? 'Agence de transport'),
    receptionMode: 'delivery',
    agencyId: local ? undefined : values.agencyId,
    recipientName: other ? values.recipientName.trim() : fullName(options.user) || undefined,
    recipientPhone,
  };
}

export interface ProfileFormValues {
  firstName: string;
  lastName: string;
  city: string;
}

export const profileFormSchema = z.object({
  firstName: z
    .string()
    .trim()
    .min(1, 'Indiquez votre prénom.')
    .max(40, 'Votre prénom ne doit pas dépasser 40 caractères.'),
  lastName: z.string().trim().max(40, 'Votre nom ne doit pas dépasser 40 caractères.'),
  city: z.string().trim().min(1, 'Choisissez votre ville.'),
});
