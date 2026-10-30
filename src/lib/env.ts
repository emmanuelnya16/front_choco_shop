export interface AppEnv {
  readonly apiBaseUrl: string;
  readonly apiMock: boolean;
  readonly cloudinaryCloudName: string;
  readonly appName: string;
  readonly shopWhatsapp: string;
  readonly isDev: boolean;
  readonly enableDevPage: boolean;
  readonly appVersion: string;
}

const DEFAULTS: Record<string, string> = {
  VITE_API_BASE_URL: 'http://localhost:8000/api',
  VITE_API_MOCK: 'true',
  VITE_CLOUDINARY_CLOUD_NAME: 'demo',
  VITE_APP_NAME: "DR Choco L'Incompris",
  VITE_SHOP_WHATSAPP: '+237600000000',
};

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

  return Object.freeze({
    apiBaseUrl,
    apiMock: apiMockRaw === 'true' || apiMockRaw === '1',
    cloudinaryCloudName,
    appName,
    shopWhatsapp,
    isDev,
    // HYPOTHÈSE: Activation de /_dev en développement ou en prévisualisation si VITE_ENABLE_DEV_PAGE=true ou VITE_API_MOCK=true
    enableDevPage: isDev || enableDevPageRaw === 'true' || apiMockRaw === 'true',
    appVersion: '0.5.0',
  });
}

export const env: AppEnv = validateEnv();
