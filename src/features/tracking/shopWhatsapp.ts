import { usePublicSettings } from '@/features/catalog/api/useCatalogQueries';
import { env } from '@/lib/env';

/**
 * Numéro WhatsApp de la boutique : réglages publics de l'API, sinon la configuration du build
 * (VITE_SHOP_WHATSAPP). `null` si aucun numéro exploitable n'est connu : les boutons WhatsApp sont alors
 * masqués, jamais remplacés par un faux numéro (M7 §4.2).
 */
export function resolveShopWhatsapp(
  settingsNumber?: string | null,
  configuredNumber: string | null | undefined = env.shopWhatsapp,
): string | null {
  for (const candidate of [settingsNumber, configuredNumber]) {
    const value = candidate?.trim();
    if (value && value.replace(/\D/g, '').length >= 9) return value;
  }
  return null;
}

/** Même numéro, lu depuis les réglages publics (en cache) avec repli sur la configuration du build. */
export function useShopWhatsapp(): string | null {
  const { data } = usePublicSettings();
  return resolveShopWhatsapp(data?.whatsappNumber);
}
