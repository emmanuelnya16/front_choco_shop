/**
 * Étape de déploiement (M7 §5) : règle la remontée d'erreurs et le contrôle des réponses de l'API.
 * - `development` : erreurs affichées dans la console, avertissements du contrat de l'API ;
 * - `preproduction` : erreurs envoyées au serveur, avertissements du contrat dans la console ;
 * - `production` : erreurs envoyées au serveur, écarts du contrat signalés au serveur.
 */
export type AppStage = 'development' | 'preproduction' | 'production';

export interface AppEnv {
  readonly apiBaseUrl: string;
  readonly apiMock: boolean;
  readonly cloudinaryCloudName: string;
  readonly appName: string;
  readonly shopWhatsapp: string;
  readonly isDev: boolean;
  readonly enableDevPage: boolean;
  readonly appVersion: string;
  /** Application installable et utilisable hors connexion (service worker) : vrai en production. */
  readonly pwaEnabled: boolean;
  /** Clé publique VAPID (base64url) pour l'abonnement aux notifications. */
  readonly vapidPublicKey: string;
  /**
   * Étape de déploiement, lue depuis VITE_APP_STAGE (`development`, `preproduction` ou `production`).
   * Absente ou invalide : `development` en développement (`vite`), `production` pour un build.
   */
  readonly appStage: AppStage;
}

const DEFAULTS: Record<string, string> = {
  VITE_API_BASE_URL: 'http://localhost:8000/api',
  VITE_API_MOCK: 'true',
  VITE_CLOUDINARY_CLOUD_NAME: 'demo',
  VITE_APP_NAME: "DR Choco L'Incompris",
  VITE_SHOP_WHATSAPP: '+237600000000',
  // HYPOTHÈSE: clé publique VAPID de démonstration (paire générée localement, clé privée non conservée) ;
  // la vraie paire est générée par le back-end et fournie via VITE_VAPID_PUBLIC_KEY.
  VITE_VAPID_PUBLIC_KEY:
    'BL7H6oeH6x1lH36fNPdj8o1XwDZ-IlzN5HMg30GAkYsFxOzrvAEel5yXgJ46qyCsy4DAq0UJYlMj5wu3LVwxYIc',
};

const VAPID_KEY_PATTERN = /^[A-Za-z0-9_-]{80,100}$/;

const APP_STAGES: readonly AppStage[] = ['development', 'preproduction', 'production'];

/**
 * VITE_APP_STAGE : `development`, `preproduction` ou `production` (M7 §5).
 * HYPOTHÈSE: une valeur absente ou inconnue ne bloque pas le démarrage : on retient l'étape par défaut
 * (`development` avec le serveur de développement, `production` pour un build).
 */
function readAppStage(rawEnv: Record<string, unknown>, isDev: boolean): AppStage {
  const raw = String(rawEnv.VITE_APP_STAGE ?? '').trim().toLowerCase();
  const match = APP_STAGES.find((stage) => stage === raw);
  return match ?? (isDev ? 'development' : 'production');
}

function readRequiredEnv(key: keyof typeof DEFAULTS, rawEnv: Record<string, unknown>): string {
  const rawValue = rawEnv[key];
  const value =
    typeof rawValue === 'string' && rawValue.trim().length > 0 ? rawValue.trim() : DEFAULTS[key];

  if (!value || value.trim().length === 0) {
    throw new Error(
      `[Configuration DR Choco] Variable d'environnement manquante ou invalide : ${key}. Vérifiez votre fichier .env.local (voir .env.example).`,
    );
  }
  return value;
}

export function validateEnv(rawEnv: Record<string, unknown> = import.meta.env): AppEnv {
  const apiBaseUrl = readRequiredEnv('VITE_API_BASE_URL', rawEnv).replace(/\/+$/, '');
  const apiMockRaw = readRequiredEnv('VITE_API_MOCK', rawEnv).toLowerCase();
  const cloudinaryCloudName = readRequiredEnv('VITE_CLOUDINARY_CLOUD_NAME', rawEnv);
  const appName = readRequiredEnv('VITE_APP_NAME', rawEnv);
  const shopWhatsapp = readRequiredEnv('VITE_SHOP_WHATSAPP', rawEnv);

  const isDev = Boolean(rawEnv.DEV);
  const enableDevPageRaw = String(rawEnv.VITE_ENABLE_DEV_PAGE ?? '').toLowerCase();
  const pwaEnabledRaw = String(rawEnv.VITE_PWA_ENABLED ?? '').trim().toLowerCase();
  const vapidPublicKey = readRequiredEnv('VITE_VAPID_PUBLIC_KEY', rawEnv);
  if (!VAPID_KEY_PATTERN.test(vapidPublicKey)) {
    throw new Error(
      "[Configuration DR Choco] VITE_VAPID_PUBLIC_KEY doit être une clé publique VAPID en base64url (65 octets, environ 87 caractères).",
    );
  }
  const appVersionRaw = rawEnv.VITE_APP_VERSION;

  return Object.freeze({
    apiBaseUrl,
    apiMock: apiMockRaw === 'true' || apiMockRaw === '1',
    cloudinaryCloudName,
    appName,
    shopWhatsapp,
    isDev,
    // HYPOTHÈSE: Activation de /_dev en développement ou en prévisualisation si VITE_ENABLE_DEV_PAGE=true ou VITE_API_MOCK=true
    enableDevPage: isDev || enableDevPageRaw === 'true' || apiMockRaw === 'true',
    // Version injectée par vite.config.ts depuis package.json
    appVersion: typeof appVersionRaw === 'string' && appVersionRaw ? appVersionRaw : '0.0.0',
    // HYPOTHÈSE: VITE_PWA_ENABLED absent = vrai en production, faux en développement (M6 §3.2)
    pwaEnabled: pwaEnabledRaw ? pwaEnabledRaw === 'true' || pwaEnabledRaw === '1' : !isDev,
    vapidPublicKey,
    appStage: readAppStage(rawEnv, isDev),
  });
}

export const env: AppEnv = validateEnv();
