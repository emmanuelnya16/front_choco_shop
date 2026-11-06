import { usePublicSettings } from '@/features/catalog/api/useCatalogQueries';
import { env } from '@/lib/env';
import { resolveShopWhatsapp } from '@/lib/utils/phone';

/** Message prérempli des boutons « Nous écrire sur WhatsApp » de la coquille. */
export const SHOP_WHATSAPP_GREETING = 'Bonjour DR Choco, j’ai une question.';

export interface ShopWhatsapp {
  /** Numéro au format +2376XXXXXXXX. */
  number: string;
  /** Lien wa.me avec le message prérempli. */
  url: string;
}

export function buildShopWhatsappUrl(number: string, text: string = SHOP_WHATSAPP_GREETING): string {
  return `https://wa.me/${number.replace(/\D/g, '')}?text=${encodeURIComponent(text)}`;
}

/**
 * Numéro WhatsApp de la boutique pour la coquille (bouton flottant, pied de page, aide) : réglages
 * publics de l'API, sinon VITE_SHOP_WHATSAPP. Null tant qu'aucun numéro valide n'est connu : les
 * boutons sont alors masqués plutôt que d'ouvrir une conversation avec un faux numéro.
 */
export function useShopWhatsapp(): ShopWhatsapp | null {
  const { data: settings } = usePublicSettings();
  const number = resolveShopWhatsapp(settings?.whatsappNumber, env.shopWhatsapp);
  return number ? { number, url: buildShopWhatsappUrl(number) } : null;
}
