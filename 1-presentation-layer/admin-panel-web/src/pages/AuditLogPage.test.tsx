import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import App from '../App';
import { resetClientForTests } from '../api/client';
import { SessionProvider } from '../auth/session';
import { adminUser, fakeApi, json } from '../test/fake-api';

type Routes = Parameters<typeof fakeApi>[0];

const entry = (over: Record<string, unknown> = {}) => ({
  seq: '42',
  occurredAt: '2026-09-28T10:00:00.000Z',
  actorUserId: 'u-c',
  actorEmail: 'clinician@example.test',
  actorRole: 'CLINICIAN',
  action: 'access.denied',
  entityType: 'route',
  entityId: 'GET /api/v1/admin/roles',
  outcome: 'DENIED',
  requestId: 'req-1',
  ip: '127.0.0.1',
  details: { missing: ['user:manage'] },
  ...over,
});

function renderAt(routes: Routes) {
  const api = fakeApi({
    'POST /auth/refresh': () => json(200, { accessToken: 'access' }),
    'GET /users/me': () => json(200, adminUser),
    ...routes,
  });
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  render(
    <QueryClientProvider client={client}>
      <SessionProvider>
        <MemoryRouter initialEntries={['/audit-log']}>
          <App />
        </MemoryRouter>
      </SessionProvider>
    </QueryClientProvider>,
  );
  return api;
}

beforeEach(() => resetClientForTests());
afterEach(() => vi.unstubAllGlobals());

describe('audit log page', () => {
  it('lists entries in plain words and shows details on request', async () => {
    renderAt({
      'GET /admin/audit-logs': () =>
        json(200, { items: [entry()], page: 1, pageSize: 50, total: 1 }),
    });
    const row = (await screen.findByText('access.denied')).closest('tr')!;
    expect(row).toHaveTextContent('clinician@example.test');
    expect(within(row).getByText('Refused')).toBeVisible();
    const user = userEvent.setup();
    await user.click(within(row).getByRole('button', { name: 'Details' }));
    expect(row).toHaveTextContent('"missing"');
    expect(
      within(row).getByRole('button', { name: 'Hide details' }),
    ).toHaveAttribute('aria-expanded', 'true');
  });

  it('sends the filters to the server', async () => {
    const { calls } = renderAt({
      'GET /admin/audit-logs': () =>
        json(200, { items: [], page: 1, pageSize: 50, total: 0 }),
    });
    const user = userEvent.setup();
    await screen.findByText('No entries match.');
    await user.type(screen.getByLabelText('Action starts with'), 'fhir.');
    await user.selectOptions(screen.getByLabelText('Outcome'), 'FAILURE');
    await user.click(screen.getByRole('button', { name: 'Filter' }));
    await vi.waitFor(() =>
      expect(
        calls.some((c) =>
          c.path.startsWith(
            '/admin/audit-logs?action=fhir.&outcome=FAILURE&page=1',
          ),
        ),
      ).toBe(true),
    );
  });

  it('checks the hash chain and says whether it is intact', async () => {
    let intact = true;
    renderAt({
      'GET /admin/audit-logs': () =>
        json(200, { items: [], page: 1, pageSize: 50, total: 0 }),
      'GET /admin/audit-logs/verify': () =>
        json(200, {
          intact,
          entries: 1200,
          brokenAt: intact ? null : '77',
          reason: intact ? null : 'row content does not match row_hash',
          checkedAt: '2026-09-28T10:00:00.000Z',
        }),
    });
    const user = userEvent.setup();
    await user.click(
      await screen.findByRole('button', { name: 'Check integrity' }),
    );
    expect(
      await screen.findByText(
        'Intact: all 1200 entries are linked and unchanged.',
      ),
    ).toBeVisible();
    intact = false;
    await user.click(screen.getByRole('button', { name: 'Check integrity' }));
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Broken at entry 77: row content does not match row_hash',
    );
  });
});
