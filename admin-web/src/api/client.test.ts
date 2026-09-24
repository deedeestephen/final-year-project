import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { apiError, fakeApi, json } from '../test/fake-api';
import {
  api,
  ApiError,
  onSessionExpired,
  resetClientForTests,
  setAccessToken,
} from './client';

beforeEach(() => resetClientForTests());
afterEach(() => vi.unstubAllGlobals());

describe('api client', () => {
  it('sends the web client header and bearer token, and no cookie to data routes', async () => {
    const { calls } = fakeApi({ 'GET /users': () => json(200, { items: [] }) });
    setAccessToken('token-1');
    await api.get('/users');
    expect(calls[0].headers['X-Client']).toBe('web');
    expect(calls[0].headers.Authorization).toBe('Bearer token-1');
    expect(calls[0].credentials).toBe('omit');
  });

  it('sends the refresh cookie only to auth routes', async () => {
    const { calls } = fakeApi({
      'POST /auth/logout': () => json(204, undefined),
    });
    await api.post('/auth/logout');
    expect(calls[0].credentials).toBe('include');
  });

  it('refreshes once on an expired token and retries the request', async () => {
    let token = 'old';
    const { calls } = fakeApi({
      'GET /users/me': (c) =>
        c.headers.Authorization === `Bearer ${token}` && token === 'new'
          ? json(200, { id: 'me' })
          : apiError(401, 'INVALID_TOKEN'),
      'POST /auth/refresh': () => {
        token = 'new';
        return json(200, { accessToken: 'new' });
      },
    });
    setAccessToken('old');
    await expect(api.get('/users/me')).resolves.toEqual({ id: 'me' });
    expect(calls.map((c) => `${c.method} ${c.path}`)).toEqual([
      'GET /users/me',
      'POST /auth/refresh',
      'GET /users/me',
    ]);
  });

  it('shares one refresh between concurrent requests', async () => {
    let refreshed = false;
    const { calls } = fakeApi({
      'GET /a': () =>
        refreshed ? json(200, 'a') : apiError(401, 'INVALID_TOKEN'),
      'GET /b': () =>
        refreshed ? json(200, 'b') : apiError(401, 'INVALID_TOKEN'),
      'POST /auth/refresh': async () => {
        await new Promise((r) => setTimeout(r, 10));
        refreshed = true;
        return json(200, { accessToken: 'new' });
      },
    });
    setAccessToken('old');
    await expect(Promise.all([api.get('/a'), api.get('/b')])).resolves.toEqual([
      'a',
      'b',
    ]);
    expect(calls.filter((c) => c.path === '/auth/refresh')).toHaveLength(1);
  });

  it('reports an ended session when the refresh is refused', async () => {
    fakeApi({
      'GET /users': () => apiError(401, 'INVALID_TOKEN'),
      'POST /auth/refresh': () => apiError(401, 'INVALID_TOKEN'),
    });
    const expired = vi.fn();
    onSessionExpired(expired);
    setAccessToken('old');
    await expect(api.get('/users')).rejects.toMatchObject({
      code: 'INVALID_TOKEN',
    });
    expect(expired).toHaveBeenCalledOnce();
  });

  it('parses error codes, field errors and Retry-After', async () => {
    fakeApi({
      'POST /users': () =>
        json(400, {
          error: {
            code: 'VALIDATION_FAILED',
            message: 'Invalid',
            details: [{ field: 'email', errors: ['must be an email'] }],
          },
        }),
      'GET /users': () =>
        apiError(429, 'RATE_LIMITED', 'Too many', { 'Retry-After': '42' }),
    });
    const validation = await api.post('/users', {}).catch((e: ApiError) => e);
    expect(validation).toBeInstanceOf(ApiError);
    expect((validation as ApiError).fieldErrors()).toEqual({
      email: ['must be an email'],
    });
    const limited = await api.get('/users').catch((e: ApiError) => e);
    expect(limited).toMatchObject({
      code: 'RATE_LIMITED',
      status: 429,
      retryAfter: 42,
    });
  });

  it('turns a failed connection into a network error', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockRejectedValue(new TypeError('Failed to fetch')),
    );
    const error = await api.get('/users').catch((e: ApiError) => e);
    expect((error as ApiError).isNetwork).toBe(true);
  });
});
