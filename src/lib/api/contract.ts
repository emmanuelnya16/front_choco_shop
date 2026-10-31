import type { ZodType } from 'zod';
import { env, type AppStage } from '@/lib/env';
import { reportError } from '@/lib/monitoring';
import {
  authSessionSchema,
  productDetailSchema,
  productsPageSchema,
  publicSettingsSchema,
  refreshSessionSchema,
  reservationCreatedSchema,
  reservationListSchema,
  reservationSchema,
  reservationsPageSchema,
  reservationsSummarySchema,
  userSchema,
} from './schemas';

/**
 * Contrat des réponses de l'API (M7 §5.3).
 *
 * `checkContract` est appelé par src/lib/api/client.ts sur chaque réponse JSON réussie, chargé à
 * la demande et sans retarder la réponse :
 * - développement et préproduction : un `console.warn` par écart
 *   (« [Contrat API] /reservations/RES-000124 : champ "expiresAt" manquant ») ;
 * - production : `reportError` (zone `api-contract`), sans la donnée elle-même ;
 * - dans tous les cas, l'app continue avec la donnée reçue : rien n'est jamais levé.
 */

interface ContractEntry {
  method: string;
  pattern: string;
  /** Distingue deux réponses d'un même chemin selon ses paramètres (`?scope=` de « Mes réservations »). */
  when?: (query: URLSearchParams) => boolean;
  schema: ZodType;
}

/** Registre méthode + motif de chemin → schéma. Le premier motif qui correspond l'emporte. */
export const contractRegistry: readonly ContractEntry[] = [
  { method: 'GET', pattern: '/products', schema: productsPageSchema },
  { method: 'GET', pattern: '/products/:slug', schema: productDetailSchema },
  {
    method: 'GET',
    pattern: '/reservations',
    when: (query) => query.has('scope'),
    schema: reservationsPageSchema,
  },
  { method: 'GET', pattern: '/reservations', schema: reservationListSchema },
  { method: 'POST', pattern: '/reservations', schema: reservationCreatedSchema },
  // Avant /reservations/:ref, pour ne pas être pris pour une référence
  { method: 'GET', pattern: '/reservations/summary', schema: reservationsSummarySchema },
  { method: 'GET', pattern: '/reservations/:ref', schema: reservationSchema },
  { method: 'GET', pattern: '/settings/public', schema: publicSettingsSchema },
  { method: 'POST', pattern: '/auth/otp/verify', schema: authSessionSchema },
  { method: 'POST', pattern: '/auth/refresh', schema: refreshSessionSchema },
  { method: 'GET', pattern: '/me', schema: userSchema },
];

const MAX_LINES_PER_RESPONSE = 10;
const warned = new Set<string>();

/** Oublie les avertissements déjà affichés (tests). */
export function resetContractWarnings(): void {
  warned.clear();
}

function patternToRegExp(pattern: string): RegExp {
  const source = pattern
    .split('/')
    .map((segment) => (segment.startsWith(':') ? '[^/]+' : segment.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')))
    .join('/');
  return new RegExp(`^${source}/?$`);
}

const compiled = contractRegistry.map((entry) => ({ entry, regexp: patternToRegExp(entry.pattern) }));

/** Chemin relatif à l'API, sans paramètres : `/reservations/RES-000124`. */
function splitPath(path: string): { pathname: string; query: URLSearchParams } {
  let relative = path;
  if (relative.startsWith(env.apiBaseUrl)) relative = relative.slice(env.apiBaseUrl.length);
  else if (/^https?:\/\//.test(relative)) relative = new URL(relative).pathname;
  const [pathname = '/', search = ''] = relative.split('?');
  return {
    pathname: pathname.startsWith('/') ? pathname : `/${pathname}`,
    query: new URLSearchParams(search.split('#')[0]),
  };
}

export function findContract(method: string, path: string): ContractEntry | undefined {
  const { pathname, query } = splitPath(path);
  const verb = method.toUpperCase();
  return compiled.find(
    ({ entry, regexp }) =>
      entry.method === verb && regexp.test(pathname) && (!entry.when || entry.when(query)),
  )?.entry;
}

// ---------------------------------------------------------------------------
// Description des écarts
// ---------------------------------------------------------------------------

interface ContractIssue {
  code: string;
  path: PropertyKey[];
  message: string;
  expected?: unknown;
  values?: unknown[];
}

interface Problem {
  /** Avec la valeur reçue pour une liste fermée (console de développement seulement). */
  detail: string;
  /** Sans aucune valeur reçue (remontée en production). */
  summary: string;
}

function valueAt(data: unknown, path: PropertyKey[]): unknown {
  let current: unknown = data;
  for (const key of path) {
    if (current === null || typeof current !== 'object') return undefined;
    current = (current as Record<PropertyKey, unknown>)[key];
  }
  return current;
}

function typeName(value: unknown): string {
  if (value === null) return 'null';
  if (Array.isArray(value)) return 'array';
  return typeof value;
}

function shortValue(value: unknown): string {
  const text = typeof value === 'string' ? JSON.stringify(value) : String(value);
  return text.length > 40 ? `${text.slice(0, 39)}…` : text;
}

function describeIssue(issue: ContractIssue, data: unknown): Problem {
  const field = issue.path.map(String).join('.');
  const label = field ? `champ "${field}"` : 'réponse';
  const value = valueAt(data, issue.path);

  if (issue.code === 'invalid_type') {
    if (value === undefined && field) {
      const text = `${label} manquant`;
      return { detail: text, summary: text };
    }
    const text = `${label} : attendu ${String(issue.expected)}, reçu ${typeName(value)}`;
    return { detail: text, summary: text };
  }
  if (issue.code === 'invalid_value' && Array.isArray(issue.values)) {
    const expected = issue.values.map((item) => JSON.stringify(item)).join(' | ');
    return {
      detail: `${label} : attendu ${expected}, reçu ${shortValue(value)}`,
      summary: `${label} : attendu ${expected}, reçu une autre valeur (${typeName(value)})`,
    };
  }
  const text = `${label} : ${issue.message}`;
  return { detail: text, summary: text };
}

/**
 * Valide une réponse et renvoie la liste des écarts (lignes sans préfixe), ou `null` si aucun
 * schéma ne correspond à cette route.
 */
export function validateResponse(method: string, path: string, data: unknown): string[] | null {
  const entry = findContract(method, path);
  if (!entry) return null;
  const result = entry.schema.safeParse(data);
  if (result.success) return [];
  return result.error.issues.map((issue) => describeIssue(issue as ContractIssue, data).detail);
}

export interface CheckContractOptions {
  /** Étape de déploiement ; par défaut `env.appStage`. */
  stage?: AppStage;
}

/**
 * Contrôle une réponse réussie de l'API. Renvoie toujours la donnée reçue, intacte.
 */
export function checkContract<T>(method: string, path: string, data: T, options: CheckContractOptions = {}): T {
  try {
    const entry = findContract(method, path);
    if (!entry) return data;
    const result = entry.schema.safeParse(data);
    if (result.success) return data;

    const problems = result.error.issues.map((issue) => describeIssue(issue as ContractIssue, data));
    const endpoint = `${method.toUpperCase()} ${entry.pattern}`;
    const stage = options.stage ?? env.appStage;

    if (stage === 'production') {
      const shown = problems.slice(0, MAX_LINES_PER_RESPONSE).map((problem) => problem.summary);
      reportError(new Error(`[Contrat API] ${endpoint} : ${shown.join(' ; ')}`), {
        zone: 'api-contract',
        route: entry.pattern,
        extra: { endpoint, issues: problems.length },
      });
      return data;
    }

    const { pathname } = splitPath(path);
    const fresh = problems.filter((problem) => {
      const key = `${endpoint} ${problem.detail}`;
      if (warned.has(key)) return false;
      warned.add(key);
      return true;
    });
    for (const problem of fresh.slice(0, MAX_LINES_PER_RESPONSE)) {
      console.warn(`[Contrat API] ${pathname} : ${problem.detail}`);
    }
    if (fresh.length > MAX_LINES_PER_RESPONSE) {
      console.warn(`[Contrat API] ${pathname} : … et ${fresh.length - MAX_LINES_PER_RESPONSE} autre(s) écart(s)`);
    }
  } catch {
    // Le contrôle ne doit jamais gêner l'app
  }
  return data;
}
