import { env } from '@/lib/env';
import { useAuthStore } from '@/stores/authStore';
import type { ApiErrorPayload, RefreshTokenResponse } from '@/types/api';
import { endpoints } from './endpoints';

const DEFAULT_TIMEOUT_MS = 15_000;
const UPLOAD_TIMEOUT_MS = 30_000;

export class ApiError extends Error {
  readonly status: number;
  readonly code: string;
  readonly details?: Record<string, unknown>;

  constructor(
    status: number,
    code: string,
    message: string,
    details?: Record<string, unknown>,
  ) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

export interface RequestOptions extends Omit<RequestInit, 'body'> {
  timeoutMs?: number;
  skipAuthRefresh?: boolean;
}

export interface UploadOptions {
  onProgress?: (percent: number) => void;
  timeoutMs?: number;
  signal?: AbortSignal;
}

function buildUrl(path: string): string {
  if (path.startsWith('http://') || path.startsWith('https://')) {
    return path;
  }
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  return `${env.apiBaseUrl}${normalizedPath}`;
}

function getDefaultErrorMessage(status: number): { code: string; message: string } {
  if (status === 401) {
    return {
      code: 'SESSION_EXPIRED',
      message: 'Votre session a expiré. Veuillez vous reconnecter.',
    };
  }
  if (status === 403) {
    return {
      code: 'FORBIDDEN',
      message: "Vous n'avez pas l'autorisation d'effectuer cette action.",
    };
  }
  if (status === 404) {
    return {
      code: 'NOT_FOUND',
      message: 'La ressource demandée est introuvable.',
    };
  }
  if (status === 422) {
    return {
      code: 'VALIDATION_ERROR',
      message: 'Certaines informations saisies sont invalides.',
    };
  }
  if (status >= 500) {
    return {
      code: 'SERVER_ERROR',
      message: 'Erreur serveur momentanée. Veuillez réessayer dans quelques instants.',
    };
  }
  return {
    code: 'HTTP_ERROR',
    message: 'Une erreur est survenue lors de la communication avec le serveur.',
  };
}

let refreshPromise: Promise<string | null> | null = null;

async function attemptTokenRefresh(): Promise<string | null> {
  if (refreshPromise) {
    return refreshPromise;
  }

  refreshPromise = (async () => {
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), DEFAULT_TIMEOUT_MS);

      const response = await fetch(buildUrl(endpoints.auth.refresh), {
        method: 'POST',
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        signal: controller.signal,
      });

      clearTimeout(timer);

      if (!response.ok) {
        useAuthStore.getState().clearSession();
        return null;
      }

      const data = (await response.json()) as RefreshTokenResponse;
      if (data.accessToken) {
        if (data.user) {
          useAuthStore.getState().setSession(data.accessToken, data.user);
        } else {
          useAuthStore.getState().setAccessToken(data.accessToken);
        }
        return data.accessToken;
      }

      useAuthStore.getState().clearSession();
      return null;
    } catch {
      useAuthStore.getState().clearSession();
      return null;
    } finally {
      refreshPromise = null;
    }
  })();

  return refreshPromise;
}

async function request<T>(
  method: string,
  path: string,
  body?: unknown,
  options: RequestOptions = {},
): Promise<T> {
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  const isFormData = typeof FormData !== 'undefined' && body instanceof FormData;
  const headers = new Headers(options.headers);
  headers.set('Accept', 'application/json');

  if (!isFormData && body !== undefined) {
    headers.set('Content-Type', 'application/json');
  }

  const token = useAuthStore.getState().getToken();
  if (token) {
    headers.set('Authorization', `Bearer ${token}`);
  }

  try {
    const response = await fetch(buildUrl(path), {
      ...options,
      method,
      headers,
      body: isFormData ? body : body !== undefined ? JSON.stringify(body) : undefined,
      signal: controller.signal,
    });

    if (response.status === 401 && !options.skipAuthRefresh && path !== endpoints.auth.refresh) {
      clearTimeout(timeoutId);
      const newToken = await attemptTokenRefresh();
      if (newToken) {
        return request<T>(method, path, body, { ...options, skipAuthRefresh: true });
      }
      throw new ApiError(
        401,
        'SESSION_EXPIRED',
        'Votre session a expiré. Veuillez vous reconnecter.',
      );
    }

    if (!response.ok) {
      let errorPayload: ApiErrorPayload | null = null;
      try {
        errorPayload = (await response.json()) as ApiErrorPayload;
      } catch {
        // Corps non JSON
      }

      const fallback = getDefaultErrorMessage(response.status);
      throw new ApiError(
        response.status,
        errorPayload?.code ?? fallback.code,
        errorPayload?.message ?? fallback.message,
        errorPayload?.details,
      );
    }

    if (response.status === 204) {
      return undefined as T;
    }

    return (await response.json()) as T;
  } catch (error) {
    if (error instanceof ApiError) {
      throw error;
    }

    if (
      error instanceof Error &&
      (error.name === 'AbortError' || error.message.toLowerCase().includes('abort'))
    ) {
      throw new ApiError(
        408,
        'TIMEOUT',
        'Le délai de connexion est dépassé. Vérifiez votre réseau 3G/4G et réessayez.',
      );
    }

    throw new ApiError(
      0,
      'NETWORK_ERROR',
      'Réseau indisponible. Vérifiez votre connexion Internet et réessayez.',
    );
  } finally {
    clearTimeout(timeoutId);
  }
}

function upload<T>(
  path: string,
  formData: FormData,
  options: UploadOptions = {},
): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('POST', buildUrl(path), true);
    xhr.timeout = options.timeoutMs ?? UPLOAD_TIMEOUT_MS;
    xhr.setRequestHeader('Accept', 'application/json');

    const token = useAuthStore.getState().getToken();
    if (token) {
      xhr.setRequestHeader('Authorization', `Bearer ${token}`);
    }

    if (options.onProgress && xhr.upload) {
      xhr.upload.onprogress = (event: ProgressEvent) => {
        if (event.lengthComputable && event.total > 0) {
          const percent = Math.round((event.loaded / event.total) * 100);
          options.onProgress?.(percent);
        }
      };
    }

    xhr.onload = () => {
      let parsed: unknown;
      try {
        parsed = xhr.responseText ? JSON.parse(xhr.responseText) : null;
      } catch {
        parsed = null;
      }

      if (xhr.status >= 200 && xhr.status < 300) {
        resolve(parsed as T);
        return;
      }

      const payload = (parsed ?? {}) as ApiErrorPayload;
      const fallback = getDefaultErrorMessage(xhr.status);
      reject(
        new ApiError(
          xhr.status,
          payload.code ?? fallback.code,
          payload.message ?? fallback.message,
          payload.details,
        ),
      );
    };

    xhr.onerror = () => {
      reject(
        new ApiError(
          0,
          'NETWORK_ERROR',
          'Réseau indisponible lors de l’envoi du fichier. Veuillez réessayer.',
        ),
      );
    };

    xhr.ontimeout = () => {
      reject(
        new ApiError(
          408,
          'TIMEOUT',
          'Le délai d’envoi de l’image est dépassé. Vérifiez votre connexion et réessayez.',
        ),
      );
    };

    xhr.onabort = () => {
      reject(
        new ApiError(
          0,
          'UPLOAD_ABORTED',
          'Envoi annulé.',
        ),
      );
    };

    if (options.signal) {
      if (options.signal.aborted) {
        reject(new ApiError(0, 'UPLOAD_ABORTED', 'Envoi annulé.'));
        return;
      }
      options.signal.addEventListener(
        'abort',
        () => {
          xhr.abort();
          reject(new ApiError(0, 'UPLOAD_ABORTED', 'Envoi annulé.'));
        },
        { once: true },
      );
    }

    const isJsdom =
      typeof navigator !== 'undefined' && /jsdom/i.test(navigator.userAgent);

    if (isJsdom) {
      const jsonObj: Record<string, unknown> = {};
      formData.forEach((value, key) => {
        if (typeof value === 'object' && value !== null && 'size' in value) {
          jsonObj.fileSize = (value as Blob).size;
        } else {
          jsonObj[key] = value;
        }
      });
      options.onProgress?.(50);
      request<T>('POST', path, jsonObj, { timeoutMs: options.timeoutMs })
        .then((res) => {
          options.onProgress?.(100);
          resolve(res);
        })
        .catch(reject);
      return;
    }

    xhr.send(formData);
  });
}

export const api = {
  get: <T>(path: string, options?: RequestOptions) => request<T>('GET', path, undefined, options),
  post: <T>(path: string, body?: unknown, options?: RequestOptions) =>
    request<T>('POST', path, body, options),
  patch: <T>(path: string, body?: unknown, options?: RequestOptions) =>
    request<T>('PATCH', path, body, options),
  delete: <T>(path: string, options?: RequestOptions) =>
    request<T>('DELETE', path, undefined, options),
  upload,
};
