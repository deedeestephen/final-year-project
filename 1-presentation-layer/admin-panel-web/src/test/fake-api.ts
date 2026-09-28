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

/** A synthetic week of app activity for the dashboard. */
export const sampleActivity = {
  days: 7,
  from: '2026-09-21T10:00:00.000Z',
  to: '2026-09-28T10:00:00.000Z',
  totals: {
    activeUsers: 9,
    activePhoneUsers: 6,
    activePhones: 4,
    signIns: 31,
    failedSignIns: 2,
    patientsRegistered: 12,
    screeningRecords: 18,
    uploads: 5,
    aiRequested: 4,
    aiCompleted: 4,
    consentsGranted: 7,
    consentsWithdrawn: 1,
    accessDenied: 3,
  },
  daily: [
    '2026-09-22',
    '2026-09-23',
    '2026-09-24',
    '2026-09-25',
    '2026-09-26',
    '2026-09-27',
    '2026-09-28',
  ].map((date, i) => ({
    date,
    signIns: [3, 5, 4, 6, 2, 4, 7][i],
    screeningRecords: [1, 3, 2, 4, 1, 2, 5][i],
    syncedChanges: [4, 9, 6, 11, 2, 5, 13][i],
    aiRequested: [0, 1, 0, 1, 0, 1, 1][i],
  })),
  byClient: [
    { name: 'mobile', count: 64 },
    { name: 'web', count: 22 },
    { name: 'other', count: 3 },
  ],
  signInsByRole: [
    { name: 'CLINICIAN', count: 20 },
    { name: 'ADMIN', count: 7 },
    { name: 'PATHOLOGIST', count: 4 },
  ],
  sync: { applied: 50, conflicts: 2, rejected: 1 },
  recentPhone: [
    {
      seq: '901',
      occurredAt: '2026-09-28T09:58:00.000Z',
      action: 'clinical_record.created',
      outcome: 'SUCCESS',
      actorEmail: 'clinician@example.test',
      actorRole: 'CLINICIAN',
    },
    {
      seq: '900',
      occurredAt: '2026-09-28T09:57:00.000Z',
      action: 'access.denied',
      outcome: 'DENIED',
      actorEmail: 'patient@example.test',
      actorRole: 'PATIENT',
    },
  ],
};
