/**
 * HTTP client for the PCa mHealth API.
 *
 * - The access token lives only in memory (never in localStorage).
 * - The refresh token is an HttpOnly cookie set by the server for web
 *   clients (header `X-Client: web`); page scripts cannot read it.
 * - On `401 INVALID_TOKEN` the session is refreshed once (concurrent requests
 *   share one refresh) and the request is retried once.
 */
export const API_BASE_URL: string =
  import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:3000';
const API_ROOT = `${API_BASE_URL.replace(/\/+$/, '')}/api/v1`;

const PUBLIC_AUTH = new Set([
  '/auth/login',
  '/auth/refresh',
  '/auth/register',
  '/auth/forgot-password',
  '/auth/reset-password',
]);

export interface FieldError {
  field: string;
  errors: string[];
}

export class ApiError extends Error {
  readonly code: string;
  readonly status: number | null;
  readonly details: unknown;
  /** Seconds the server asks us to wait (429). */
  readonly retryAfter: number | null;

  constructor(
    code: string,
    message: string,
    status: number | null = null,
    details: unknown = null,
    retryAfter: number | null = null,
  ) {
    super(message);
    this.code = code;
    this.status = status;
    this.details = details;
    this.retryAfter = retryAfter;
  }

  get isNetwork(): boolean {
    return this.code === 'NETWORK_UNAVAILABLE';
  }

  fieldErrors(): Record<string, string[]> {
    const out: Record<string, string[]> = {};
    if (Array.isArray(this.details)) {
      for (const d of this.details as FieldError[]) {
        if (d && typeof d.field === 'string') out[d.field] = d.errors ?? [];
      }
    }
    return out;
  }
}

let accessToken: string | null = null;
let refreshing: Promise<boolean> | null = null;
let onExpired: () => void = () => undefined;

export function setAccessToken(token: string | null): void {
  accessToken = token;
}

/** Called when the server refuses to refresh (session over). */
export function onSessionExpired(callback: () => void): void {
  onExpired = callback;
}

async function toError(res: Response): Promise<ApiError> {
  const retryAfter = Number(res.headers.get('Retry-After')) || null;
  try {
    const body = (await res.json()) as {
      error?: { code?: string; message?: string; details?: unknown };
    };
    if (body?.error?.code) {
      return new ApiError(
        body.error.code,
        body.error.message ?? 'Something went wrong',
        res.status,
        body.error.details ?? null,
        retryAfter,
      );
    }
  } catch {
    // not JSON
  }
  return new ApiError(
    'UNKNOWN',
    'Something went wrong. Please try again.',
    res.status,
    null,
    retryAfter,
  );
}

async function send(
  method: string,
  path: string,
  body: unknown,
): Promise<Response> {
  const headers: Record<string, string> = { 'X-Client': 'web' };
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  if (accessToken && !PUBLIC_AUTH.has(path)) {
    headers.Authorization = `Bearer ${accessToken}`;
  }
  try {
    return await fetch(`${API_ROOT}${path}`, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
      // The refresh cookie is only ever sent to the auth routes.
      credentials: path.startsWith('/auth/') ? 'include' : 'omit',
    });
  } catch {
    throw new ApiError(
      'NETWORK_UNAVAILABLE',
      'Cannot reach the server. Check your connection.',
    );
  }
}

/** Exchanges the refresh cookie for a new access token. */
export function refreshSession(): Promise<boolean> {
  refreshing ??= (async () => {
    try {
      const res = await send('POST', '/auth/refresh', {});
      if (!res.ok) {
        accessToken = null;
        return false;
      }
      const data = (await res.json()) as { accessToken: string };
      accessToken = data.accessToken;
      return true;
    } finally {
      refreshing = null;
    }
  })();
  return refreshing;
}

async function request<T>(
  method: string,
  path: string,
  body?: unknown,
): Promise<T> {
  let res = await send(method, path, body);
  if (res.status === 401 && !PUBLIC_AUTH.has(path)) {
    const error = await toError(res);
    if (error.code !== 'INVALID_TOKEN') throw error;
    if (!(await refreshSession())) {
      onExpired();
      throw error;
    }
    res = await send(method, path, body);
  }
  if (!res.ok) throw await toError(res);
  if (res.status === 204) return undefined as T;
  const text = await res.text();
  return (text ? JSON.parse(text) : undefined) as T;
}

export const api = {
  get: <T>(path: string) => request<T>('GET', path),
  post: <T>(path: string, body?: unknown) =>
    request<T>('POST', path, body ?? {}),
  patch: <T>(path: string, body: unknown) => request<T>('PATCH', path, body),
  put: <T>(path: string, body: unknown) => request<T>('PUT', path, body),
  delete: <T>(path: string) => request<T>('DELETE', path),
};

/** Test helper: forget all client state. */
export function resetClientForTests(): void {
  accessToken = null;
  refreshing = null;
  onExpired = () => undefined;
}
