import type { Request, Response } from 'express';
import type { AppConfig } from '../../config/app-config';

/**
 * Browser clients (the admin web app) send `X-Client: web`. For them the
 * refresh token is kept in an HttpOnly, SameSite=Strict cookie scoped to the
 * auth routes instead of the response body, so page scripts can never read
 * it. The custom header also protects the cookie-based refresh against
 * cross-site requests: a foreign page cannot send it without passing the
 * CORS allow-list. Mobile clients are unchanged (token in the body).
 */
export const WEB_CLIENT_HEADER = 'x-client';
export const REFRESH_COOKIE = 'pca_refresh';
const COOKIE_PATH = '/api/v1/auth';

export function isWebClient(req: Request): boolean {
  return req.get(WEB_CLIENT_HEADER) === 'web';
}

export function readRefreshCookie(req: Request): string | undefined {
  const header = req.headers.cookie;
  if (!header) return undefined;
  for (const part of header.split(';')) {
    const [name, ...rest] = part.trim().split('=');
    if (name !== REFRESH_COOKIE) continue;
    try {
      return decodeURIComponent(rest.join('='));
    } catch {
      // Malformed: treated as no session (401), not as a server error.
      return undefined;
    }
  }
  return undefined;
}

export function setRefreshCookie(
  res: Response,
  token: string,
  config: AppConfig,
): void {
  res.cookie(REFRESH_COOKIE, token, {
    httpOnly: true,
    secure: config.nodeEnv === 'production',
    sameSite: 'strict',
    path: COOKIE_PATH,
    maxAge: config.auth.refreshTokenTtlDays * 24 * 60 * 60 * 1000,
  });
}

export function clearRefreshCookie(res: Response, config: AppConfig): void {
  res.clearCookie(REFRESH_COOKIE, {
    httpOnly: true,
    secure: config.nodeEnv === 'production',
    sameSite: 'strict',
    path: COOKIE_PATH,
  });
}

/** The body a web client receives: everything except the refresh token. */
export function withoutRefreshToken<T extends { refreshToken: string }>(
  tokens: T,
): Omit<T, 'refreshToken'> {
  const { refreshToken: _omitted, ...rest } = tokens;
  void _omitted;
  return rest;
}
