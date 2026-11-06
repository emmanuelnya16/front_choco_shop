import { useAdminAuthStore } from '@/features/admin/auth/adminAuthStore';
import type { AdminAuthResponse } from '@/features/admin/types';
import { ApiError } from '@/lib/api/client';
import { env } from '@/lib/env';

export interface AdminRequestOptions extends Omit<RequestInit, 'body' | 'method'> {
  params?: Record<string, string | number | boolean | undefined | null>;
  skipAuthRefresh?: boolean;
}

type RefreshOutcome =
  | { kind: 'ok'; token: string }
  | { kind: 'unauthorized' }
  | { kind: 'transient' };

let refreshPromise: Promise<RefreshOutcome> | null = null;

async function refreshAdminAccessToken(): Promise<RefreshOutcome> {
  if (refreshPromise) {
    return refreshPromise;
  }

  refreshPromise = (async (): Promise<RefreshOutcome> => {
    try {
      const response = await fetch(`${env.apiBaseUrl}/admin/auth/refresh`, {
        method: 'POST',
        credentials: 'include',
        headers: {
          Accept: 'application/json',
        },
      });

      if (response.status === 401 || response.status === 403) {
        useAdminAuthStore.getState().clearAdminSession();
        return { kind: 'unauthorized' };
      }

      if (!response.ok) {
        // Erreur serveur (5xx) : on conserve la session locale de l'administrateur
        return { kind: 'transient' };
      }

      const data = (await response.json()) as AdminAuthResponse;
      if (data.accessToken && data.admin) {
        useAdminAuthStore.getState().setAdminSession(data.accessToken, data.admin);
        return { kind: 'ok', token: data.accessToken };
      }
      if (data.accessToken) {
        useAdminAuthStore.getState().setAdminAccessToken(data.accessToken);
        return { kind: 'ok', token: data.accessToken };
      }

      useAdminAuthStore.getState().clearAdminSession();
      return { kind: 'unauthorized' };
    } catch {
      // Coupure réseau : on ne déconnecte pas l'administrateur
      return { kind: 'transient' };
    } finally {
      refreshPromise = null;
    }
  })();

  return refreshPromise;
}

/**
 * Rafraîchissement silencieux de la session d’administration au montage de `/admin`.
 * - Si un profil `admin` est connu mais `accessToken` est vide (après F5), tente `/api/admin/auth/refresh`.
 * - Si le serveur répond 401, la session est purgée (`guest`).
 * - En cas de coupure réseau ou 5xx, la session locale est préservée.
 */
export async function silentAdminRefresh(): Promise<RefreshOutcome> {
  const { admin, accessToken } = useAdminAuthStore.getState();
  if (accessToken) {
    return { kind: 'ok', token: accessToken };
  }
  if (!admin) {
    useAdminAuthStore.getState().clearAdminSession();
    return { kind: 'unauthorized' };
  }
  return refreshAdminAccessToken();
}

function buildUrl(
  path: string,
  params?: Record<string, string | number | boolean | undefined | null>,
): string {
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  const fullPath = `${env.apiBaseUrl}${normalizedPath}`;

  if (!params) {
    return fullPath;
  }

  const searchParams = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== null && value !== '') {
      searchParams.set(key, String(value));
    }
  }

  const queryString = searchParams.toString();
  return queryString ? `${fullPath}?${queryString}` : fullPath;
}

async function parseErrorPayload(response: Response): Promise<{
  code: string;
  message: string;
  details?: Record<string, unknown>;
}> {
  try {
    const body = (await response.json()) as {
      code?: string;
      message?: string;
      details?: Record<string, unknown>;
    };
    return {
      code: body.code ?? `HTTP_${response.status}`,
      message: body.message ?? (response.statusText || 'Une erreur est survenue.'),
      details: body.details,
    };
  } catch {
    return {
      code: `HTTP_${response.status}`,
      message: response.statusText || 'Une erreur réseau est survenue.',
    };
  }
}

async function request<T>(
  method: string,
  path: string,
  body?: unknown,
  options: AdminRequestOptions = {},
  isRetry = false,
): Promise<T> {
  const { params, skipAuthRefresh = false, headers: customHeaders, ...restInit } = options;
  const url = buildUrl(path, params);

  const headers = new Headers(customHeaders);
  headers.set('Accept', 'application/json');

  const isFormData = typeof FormData !== 'undefined' && body instanceof FormData;
  if (body !== undefined && !isFormData && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }

  const token = useAdminAuthStore.getState().accessToken;
  if (token && !headers.has('Authorization')) {
    headers.set('Authorization', `Bearer ${token}`);
  }

  const response = await fetch(url, {
    method,
    headers,
    credentials: 'include',
    body:
      body === undefined
        ? undefined
        : isFormData
          ? (body as FormData)
          : JSON.stringify(body),
    ...restInit,
  });

  if (response.status === 401 && !isRetry && !skipAuthRefresh) {
    const outcome = await refreshAdminAccessToken();
    if (outcome.kind === 'ok') {
      return request<T>(method, path, body, options, true);
    }
  }

  if (!response.ok) {
    const errPayload = await parseErrorPayload(response);
    throw new ApiError(response.status, errPayload.code, errPayload.message, errPayload.details);
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return (await response.json()) as T;
}

export const adminApi = {
  get: <T>(path: string, options?: AdminRequestOptions) =>
    request<T>('GET', path, undefined, options),
  post: <T>(path: string, body?: unknown, options?: AdminRequestOptions) =>
    request<T>('POST', path, body, options),
  patch: <T>(path: string, body?: unknown, options?: AdminRequestOptions) =>
    request<T>('PATCH', path, body, options),
  delete: <T>(path: string, options?: AdminRequestOptions) =>
    request<T>('DELETE', path, undefined, options),
};
