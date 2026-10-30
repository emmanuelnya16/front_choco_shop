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
  });
}

export const env: AppEnv = validateEnv();
