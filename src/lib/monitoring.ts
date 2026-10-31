import { env, type AppStage } from '@/lib/env';

/**
 * Remontée des erreurs du navigateur (M7 §5.2).
 *
 * HYPOTHÈSE: endpoint POST /client-errors à créer côté back-end ; facile à remplacer par un service
 * spécialisé (Sentry…) : seule la fonction `send` change.
 *
 * Règles :
 * - envoi en production et en préproduction seulement ; en développement, `console.error` lisible ;
 * - jamais de jeton, de numéro de téléphone complet, d'e-mail, de contenu de formulaire ni de
 *   paramètres d'adresse (`?…`, `#…`) : message, pile et page passent par `scrub` ;
 * - 10 envois au plus par session (onglet) et une seule fois la même erreur ;
 * - envoi direct par `fetch` (jamais par le client de l'API, pour éviter les boucles), erreurs avalées.
 */

export type ErrorExtra = Record<string, string | number | boolean>;

export interface ErrorContext {
  /** Zone de l'app où l'erreur est survenue (ex. « page », « accueil:nouveautes », « api-contract »). */
  zone?: string;
  /** Motif de route (ex. « /reservations/:ref ») si l'appelant le connaît. */
  route?: string;
  extra?: ErrorExtra;
  /** Chemin relevé au moment de l'erreur quand l'envoi est différé ; sinon `location.pathname`. */
  page?: string;
}

export interface ClientErrorPayload {
  message: string;
  stack?: string;
  /** `location.pathname`, sans paramètres ni ancre. */
  page: string;
  appVersion: string;
  userAgent: string;
  zone?: string;
  route?: string;
  extra?: ErrorExtra;
  occurredAt: string;
}

interface MonitoringConfig {
  stage: AppStage;
  endpoint: string;
  /** Écriture dans la console en développement (coupée pendant les tests automatisés). */
  log: boolean;
}

export const MAX_REPORTS_PER_SESSION = 10;
const STACK_MAX_CHARS = 2000;
const STACK_MAX_LINES = 15;
const MESSAGE_MAX_CHARS = 500;
const COUNT_KEY = 'drc_client_errors_count';
const SEEN_KEY = 'drc_client_errors_seen';

const defaultConfig = (): MonitoringConfig => ({
  stage: env.appStage,
  endpoint: `${env.apiBaseUrl}/client-errors`,
  log: import.meta.env.MODE !== 'test',
});

let config: MonitoringConfig = defaultConfig();
let sentCount = 0;
const seen = new Set<string>();

/** Change l'étape, l'adresse d'envoi ou la console (tests, futur service spécialisé). */
export function configureMonitoring(overrides: Partial<MonitoringConfig>): void {
  config = { ...config, ...overrides };
}

/** Remet à zéro configuration, compteur et déduplication (tests). */
export function resetMonitoring(): void {
  config = defaultConfig();
  sentCount = 0;
  seen.clear();
  try {
    sessionStorage.removeItem(COUNT_KEY);
    sessionStorage.removeItem(SEEN_KEY);
  } catch {
    // Stockage indisponible (navigation privée) : compteur en mémoire seulement
  }
}

// ---------------------------------------------------------------------------
// Nettoyage des données personnelles
// ---------------------------------------------------------------------------

// Adresse (absolue ou chemin) suivie de `?…` ou `#…` : les paramètres et l'ancre sont retirés
const URL_WITH_QUERY = /((?:https?:\/\/|\/)[^\s?#"'`<>()]*)([?#][^\s"'`<>()]*)/g;
const LINE_COLUMN_SUFFIX = /(?::\d+){1,2}$/;
const EMAIL = /[\w.+-]+@[\w-]+(?:\.[\w-]+)+/g;
const BEARER = /\bBearer\s+[\w.~+/=-]+/gi;
const JWT = /\beyJ[\w-]*\.[\w-]*\.[\w-]*/g;
const SECRET_FIELD =
  /\b(access_?token|refresh_?token|id_?token|token|authorization|password|secret|api_?key|otp)(["']?\s*[:=]\s*["']?)[^\s"'&,;}]+/gi;
// Longue suite opaque (lettres et chiffres mêlés) : jeton, empreinte, identifiant de session
const OPAQUE = /\b(?=[\w-]*\d)(?=[\w-]*[A-Za-z])[\w-]{32,}/g;
const CM_PHONE = /\+ ?237(?:[ \xA0.-]?\d)*/g;
const LONG_NUMBER = /(?<!RES-)(?:\+|\b00)?\d(?:[ \xA0.()-]{0,2}\d){7,}/g;
const ISO_DATE_START = /^\d{4}-\d{2}-\d{2}/;

/** Masque tous les chiffres sauf les 2 derniers (« +237 690 00 00 01 » → « +••• ••• •• •• 01 »). */
function maskDigits(value: string): string {
  const total = value.replace(/\D/g, '').length;
  let index = 0;
  return value.replace(/\d/g, (digit) => {
    index += 1;
    return index > total - 2 ? digit : '•';
  });
}

/**
 * Retire d'un texte (message, pile, chemin) tout ce qui pourrait identifier le client :
 * paramètres d'adresse, e-mails, jetons, numéros de téléphone (8 chiffres ou plus, ou +237…).
 * Les références de réservation (RES-000124) sont conservées.
 */
export function scrub(text: string): string {
  return text
    .replace(URL_WITH_QUERY, (_match, base: string, rest: string) => {
      // Une pile garde « :ligne:colonne » après l'adresse du fichier
      return base + (LINE_COLUMN_SUFFIX.exec(rest)?.[0] ?? '');
    })
    .replace(EMAIL, '[e-mail]')
    .replace(BEARER, 'Bearer [jeton]')
    .replace(JWT, '[jeton]')
    .replace(SECRET_FIELD, '$1$2[masqué]')
    .replace(OPAQUE, '[jeton]')
    .replace(CM_PHONE, maskDigits)
    .replace(LONG_NUMBER, (match) => (ISO_DATE_START.test(match) ? match : maskDigits(match)));
}

// ---------------------------------------------------------------------------
// Charge utile
// ---------------------------------------------------------------------------

function describeError(error: unknown): { message: string; stack?: string } {
  if (error instanceof Error) {
    const prefix = error.name && error.name !== 'Error' ? `${error.name}: ` : '';
    return { message: `${prefix}${error.message}`, stack: error.stack };
  }
  if (typeof error === 'string') return { message: error };
  if (error && typeof error === 'object' && 'message' in error) {
    return { message: String((error as { message: unknown }).message) };
  }
  // Jamais de sérialisation d'un objet inconnu : il pourrait contenir un formulaire
  return { message: `Valeur rejetée sans message (${error === null ? 'null' : typeof error})` };
}

function trimStack(stack: string): string {
  return scrub(stack).split('\n').slice(0, STACK_MAX_LINES).join('\n').slice(0, STACK_MAX_CHARS);
}

function scrubExtra(extra: ErrorExtra | undefined): ErrorExtra | undefined {
  if (!extra) return undefined;
  const clean: ErrorExtra = {};
  for (const [key, value] of Object.entries(extra)) {
    clean[key] = typeof value === 'string' ? scrub(value).slice(0, 200) : value;
  }
  return clean;
}

/** Construit la charge utile envoyée au serveur (exportée pour les tests). */
export function buildErrorPayload(error: unknown, context: ErrorContext = {}): ClientErrorPayload {
  const { message, stack } = describeError(error);
  const pathname = context.page ?? (typeof location !== 'undefined' ? location.pathname : '/');
  return {
    message: scrub(message).slice(0, MESSAGE_MAX_CHARS) || 'Erreur sans message',
    stack: stack ? trimStack(stack) : undefined,
    page: scrub(pathname),
    appVersion: env.appVersion,
    userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : '',
    zone: context.zone,
    route: context.route ? scrub(context.route) : undefined,
    extra: scrubExtra(context.extra),
    occurredAt: new Date().toISOString(),
  };
}

// ---------------------------------------------------------------------------
// Limite par session et déduplication
// ---------------------------------------------------------------------------

function readStoredCount(): number {
  try {
    const value = Number(sessionStorage.getItem(COUNT_KEY));
    return Number.isFinite(value) ? value : 0;
  } catch {
    return 0;
  }
}

function fingerprint(payload: ClientErrorPayload): string {
  // Premier emplacement « fichier:ligne:colonne » de la pile (Chrome comme Firefox et Safari)
  const firstFrame = payload.stack?.split('\n').find((line) => /:\d+:\d+/.test(line)) ?? '';
  const source = `${payload.zone ?? ''}|${payload.message}|${firstFrame.trim()}`;
  // Empreinte courte (djb2) : la session ne garde jamais le texte des erreurs
  let hash = 5381;
  for (let i = 0; i < source.length; i += 1) hash = ((hash << 5) + hash + source.charCodeAt(i)) | 0;
  return (hash >>> 0).toString(36);
}

function readStoredSeen(): string[] {
  try {
    const stored = JSON.parse(sessionStorage.getItem(SEEN_KEY) ?? '[]') as unknown;
    return Array.isArray(stored) ? stored.filter((item): item is string => typeof item === 'string') : [];
  } catch {
    return [];
  }
}

function remember(key: string): void {
  seen.add(key);
  sentCount += 1;
  try {
    sessionStorage.setItem(COUNT_KEY, String(Math.max(sentCount, readStoredCount() + 1)));
    const keys = new Set([...readStoredSeen(), key]);
    sessionStorage.setItem(SEEN_KEY, JSON.stringify([...keys].slice(-MAX_REPORTS_PER_SESSION)));
  } catch {
    // Stockage indisponible : la limite reste appliquée en mémoire
  }
}

function send(payload: ClientErrorPayload): void {
  try {
    void fetch(config.endpoint, {
      method: 'POST',
      keepalive: true,
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    }).catch(() => undefined);
  } catch {
    // Remontée impossible : jamais d'erreur visible pour le client
  }
}

/**
 * Signale une erreur. Ne lève jamais d'exception et n'affiche rien au client.
 */
export function reportError(error: unknown, context: ErrorContext = {}): void {
  try {
    const payload = buildErrorPayload(error, context);

    if (config.stage === 'development') {
      if (config.log) {
        console.error(`[Erreur${payload.zone ? ` · ${payload.zone}` : ''}] ${payload.message}`, error);
      }
      return;
    }

    if (Math.max(sentCount, readStoredCount()) >= MAX_REPORTS_PER_SESSION) return;
    const key = fingerprint(payload);
    if (seen.has(key) || readStoredSeen().includes(key)) return;
    remember(key);
    send(payload);
  } catch {
    // La remontée ne doit jamais casser l'app
  }
}
