/**
 * Réponses de l'API servies par le service worker depuis ses données enregistrées (M6 §6.1, M7) :
 * marquage des copies et signalement de l'état réel du serveur à l'app. Importé par src/sw.ts
 * (imports relatifs uniquement) et testé sans navigateur (dépendances injectées).
 */
import type { WorkboxPlugin } from 'workbox-core/types';
import { FROM_CACHE_HEADER, OFFLINE_FALLBACK_HEADER } from './swProtocol';

export interface MarkCachedOptions {
  /** NetworkFirst : la copie n'est servie qu'après un échec du réseau, qui est donc avéré. */
  offlineFallback: boolean;
}

/**
 * Ajoute nos en-têtes à Access-Control-Expose-Headers : quand l'API est sur une autre origine
 * (sous-domaine, serveur de mocks des parcours e2e), le navigateur ne laisse lire à la page que les
 * en-têtes de réponse listés là. Sans cela, l'app ne verrait jamais la marque « copie enregistrée ».
 */
function exposeHeaders(headers: Headers, names: string[]): void {
  const listed = (headers.get('Access-Control-Expose-Headers') ?? '')
    .split(',')
    .map((name) => name.trim())
    .filter(Boolean);
  // « * » ne vaut pas pour une requête avec identifiants (cookie) : les noms sont toujours ajoutés
  const lower = listed.map((name) => name.toLowerCase());
  const missing = names.filter((name) => !lower.includes(name.toLowerCase()));
  if (missing.length > 0) headers.set('Access-Control-Expose-Headers', [...listed, ...missing].join(', '));
}

/**
 * Copie d'une réponse enregistrée avec l'en-tête « servie depuis les données enregistrées »
 * (et « copie de secours » pour une stratégie réseau d'abord), lisibles par l'app même si l'API est
 * sur une autre origine.
 */
export async function markCachedResponse(response: Response, { offlineFallback }: MarkCachedOptions): Promise<Response> {
  const headers = new Headers(response.headers);
  headers.set(FROM_CACHE_HEADER, '1');
  if (offlineFallback) headers.set(OFFLINE_FALLBACK_HEADER, '1');
  exposeHeaders(headers, offlineFallback ? [FROM_CACHE_HEADER, OFFLINE_FALLBACK_HEADER] : [FROM_CACHE_HEADER]);
  return new Response(await response.blob(), {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

/** Marque les réponses lues dans le cache (à placer après le plugin d'expiration). */
export function markCachedResponsePlugin(options: MarkCachedOptions): WorkboxPlugin {
  return {
    cachedResponseWillBeUsed: async ({ cachedResponse }) =>
      cachedResponse ? markCachedResponse(cachedResponse, options) : cachedResponse,
  };
}

export interface NetworkStatusDeps {
  /** Une copie de cette requête est-elle enregistrée (donc déjà servie à l'app sans le réseau) ? */
  hasCachedCopy: (request: Request) => Promise<boolean>;
  /** Prévient la page qui a fait la requête (ou toutes les fenêtres si elle est inconnue). */
  notify: (reachable: boolean, clientId: string | undefined) => Promise<void> | void;
}

function readClientId(event: unknown): string | undefined {
  const id = (event as { clientId?: unknown } | undefined)?.clientId;
  return typeof id === 'string' && id ? id : undefined;
}

/**
 * Catalogue en StaleWhileRevalidate : la copie enregistrée part vers l'app AVANT la réponse du
 * réseau (elle porte l'en-tête FROM_CACHE_HEADER, neutre pour l'app). La mise à jour en
 * arrière-plan dit ensuite si le serveur répond :
 * - réponse reçue (quel que soit son statut) → serveur joignable ;
 * - échec alors qu'une copie existe → serveur injoignable (sans copie, la requête de l'app échoue
 *   elle-même et le client compte déjà l'échec : pas de double comptage).
 */
export function networkStatusPlugin({ hasCachedCopy, notify }: NetworkStatusDeps): WorkboxPlugin {
  return {
    fetchDidSucceed: async ({ response, event }) => {
      await notify(true, readClientId(event));
      return response;
    },
    fetchDidFail: async ({ request, originalRequest, event }) => {
      const copy = await hasCachedCopy(originalRequest ?? request).catch(() => false);
      if (copy) await notify(false, readClientId(event));
    },
  };
}
