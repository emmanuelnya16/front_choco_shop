import { safeStorage } from '@/lib/utils/storage';
import type { PaymentSettings } from '@/types/domain';

/**
 * Paramètres de paiement (`GET /settings/public`) conservés sur le téléphone (M6 §6.3) :
 * après un rechargement hors connexion, l'écran de paiement affiche les VRAIS codes marchands
 * et codes USSD, jamais les codes fictifs par défaut. Données publiques uniquement.
 */
// HYPOTHÈSE: localStorage (via safeStorage) convient : ces paramètres sont publics (codes marchands,
// modèles USSD), jamais effacés à la déconnexion, et remplacés à chaque réponse du serveur.
const STORAGE_KEY = 'drc_payment_settings_v1';

export interface StoredPaymentSettings {
  payment: PaymentSettings;
  whatsappNumber?: string;
  savedAt: number;
}

function isPaymentSettings(value: unknown): value is PaymentSettings {
  if (!value || typeof value !== 'object') return false;
  const operators = (value as { operators?: unknown }).operators;
  return (
    Array.isArray(operators) &&
    operators.length > 0 &&
    operators.every(
      (op) =>
        op &&
        typeof op === 'object' &&
        typeof (op as { ussdTemplate?: unknown }).ussdTemplate === 'string' &&
        typeof (op as { merchantCode?: unknown }).merchantCode === 'string',
    )
  );
}

export function loadStoredPaymentSettings(): StoredPaymentSettings | null {
  try {
    const raw = safeStorage.getItem(STORAGE_KEY);
    if (typeof raw !== 'string') return null;
    const parsed = JSON.parse(raw) as Partial<StoredPaymentSettings>;
    if (!isPaymentSettings(parsed.payment)) return null;
    return {
      payment: parsed.payment,
      whatsappNumber: typeof parsed.whatsappNumber === 'string' ? parsed.whatsappNumber : undefined,
      savedAt: typeof parsed.savedAt === 'number' ? parsed.savedAt : 0,
    };
  } catch {
    return null;
  }
}

export function saveStoredPaymentSettings(payment: PaymentSettings, whatsappNumber?: string): void {
  if (!isPaymentSettings(payment)) return;
  try {
    const value: StoredPaymentSettings = { payment, whatsappNumber, savedAt: Date.now() };
    safeStorage.setItem(STORAGE_KEY, JSON.stringify(value));
  } catch {
    // Stockage plein ou indisponible : la valeur en mémoire de TanStack Query suffit en ligne
  }
}
