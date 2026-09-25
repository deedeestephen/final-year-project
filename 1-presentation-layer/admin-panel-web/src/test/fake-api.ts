import { vi } from 'vitest';

export interface Call {
  method: string;
  path: string;
  body: unknown;
  headers: Record<string, string>;
  credentials: RequestCredentials | undefined;
}

type Handler = (call: Call) => Response | Promise<Response>;

export const json = (
  status: number,
  body: unknown,
  headers: Record<string, string> = {},
) =>
  new Response(body === undefined ? null : JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', ...headers },
  });

export const apiError = (
  status: number,
  code: string,
  message = code,
  headers: Record<string, string> = {},
) => json(status, { error: { code, message } }, headers);

/**
 * Stubs `fetch` with routes keyed "METHOD /path" (path without /api/v1 and
 * query). Unmatched requests fail the test loudly with 599.
 */
export function fakeApi(routes: Record<string, Handler>) {
  const calls: Call[] = [];
  const fetchMock = vi.fn(
    async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = new URL(String(input));
      const path = url.pathname.replace(/^\/api\/v1/, '');
      const call: Call = {
        method: init?.method ?? 'GET',
        path: path + url.search,
        body: init?.body ? JSON.parse(String(init.body)) : undefined,
        headers: (init?.headers ?? {}) as Record<string, string>,
        credentials: init?.credentials,
      };
      calls.push(call);
      const handler = routes[`${call.method} ${path}`];
      if (!handler) return apiError(599, 'UNROUTED', `${call.method} ${path}`);
      return handler(call);
    },
  );
  vi.stubGlobal('fetch', fetchMock);
  return { calls, fetchMock };
}

export const adminUser = {
  id: 'u-admin',
  email: 'admin@example.test',
  displayName: 'Test Admin',
  status: 'ACTIVE',
  roles: ['ADMIN'],
  facilityId: null,
  mustChangePassword: false,
  lastLoginAt: null,
  createdAt: '2026-01-01T00:00:00Z',
};
