import type { Request } from 'express';
import { readRefreshCookie } from './web-session';

const withCookie = (cookie?: string) =>
  ({ headers: cookie === undefined ? {} : { cookie } }) as Request;

describe('readRefreshCookie', () => {
  it('reads the refresh token among other cookies', () => {
    expect(
      readRefreshCookie(withCookie('theme=dark; pca_refresh=abc%2Bdef; x=1')),
    ).toBe('abc+def');
  });

  it('finds nothing when the cookie is absent', () => {
    expect(readRefreshCookie(withCookie())).toBeUndefined();
    expect(readRefreshCookie(withCookie('theme=dark'))).toBeUndefined();
  });

  // A broken cookie is a client error, not a server error: before the review
  // of 2026-10-02 it threw URIError, which the public refresh route answered
  // with 500 and an error-level log line.
  it('treats a malformed cookie as no cookie instead of throwing', () => {
    expect(() =>
      readRefreshCookie(withCookie('pca_refresh=%E0%A4%A')),
    ).not.toThrow();
    expect(readRefreshCookie(withCookie('pca_refresh=%'))).toBeUndefined();
  });
});
