import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import App from './App';
import { resetClientForTests } from './api/client';
import { NOT_ADMIN } from './auth/session';
import { SessionProvider } from './auth/session';
import {
  adminUser,
  apiError,
  fakeApi,
  json,
  sampleActivity,
  type Call,
} from './test/fake-api';

type Routes = Parameters<typeof fakeApi>[0];

/** Signed in as an administrator (the refresh cookie restores the session). */
const signedIn = (extra: Routes = {}): Routes => ({
  'POST /auth/refresh': () => json(200, { accessToken: 'access' }),
  'GET /users/me': () => json(200, adminUser),
  'POST /auth/logout': () => json(204, undefined),
  ...extra,
});

function renderApp(path = '/') {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={client}>
      <SessionProvider>
        <MemoryRouter initialEntries={[path]}>
          <App />
        </MemoryRouter>
      </SessionProvider>
    </QueryClientProvider>,
  );
}

const page = <T,>(items: T[]) => ({
  items,
  page: 1,
  pageSize: 25,
  total: items.length,
});

beforeEach(() => resetClientForTests());
afterEach(() => vi.unstubAllGlobals());

describe('sign in', () => {
  it('shows the sign-in page when there is no session, then admits an administrator', async () => {
    let signedInYet = false;
    const { calls } = fakeApi({
      'POST /auth/refresh': () => apiError(401, 'INVALID_TOKEN'),
      'POST /auth/login': () => {
        signedInYet = true;
        return json(200, { accessToken: 'access', user: adminUser });
      },
      'GET /users/me': () =>
        signedInYet ? json(200, adminUser) : apiError(401, 'INVALID_TOKEN'),
      'GET /admin/activity': () => json(200, sampleActivity),
    });
    renderApp();
    const user = userEvent.setup();
    await user.type(
      await screen.findByLabelText('Email'),
      'admin@example.test',
    );
    await user.type(screen.getByLabelText('Password'), 'a-good-password');
    await user.click(screen.getByRole('button', { name: 'Sign in' }));

    // Administrators land on the dashboard.
    expect(
      await screen.findByRole('heading', { name: 'Dashboard' }),
    ).toBeInTheDocument();
    expect(await screen.findByText('Test Admin')).toBeInTheDocument();
    const login = calls.find((c) => c.path === '/auth/login')!;
    expect(login.body).toEqual({
      email: 'admin@example.test',
      password: 'a-good-password',
    });
    expect(login.credentials).toBe('include');
  });

  it('turns away users who are not administrators', async () => {
    let loggedIn = false;
    const { calls } = fakeApi({
      'POST /auth/refresh': () => apiError(401, 'INVALID_TOKEN'),
      'POST /auth/login': () => {
        loggedIn = true;
        return json(200, { accessToken: 'access' });
      },
      'GET /users/me': () =>
        loggedIn
          ? json(200, { ...adminUser, roles: ['CLINICIAN'] })
          : apiError(401, 'X'),
      'POST /auth/logout': () => json(204, undefined),
    });
    renderApp();
    const user = userEvent.setup();
    await user.type(await screen.findByLabelText('Email'), 'doc@example.test');
    await user.type(screen.getByLabelText('Password'), 'a-good-password');
    await user.click(screen.getByRole('button', { name: 'Sign in' }));

    expect(await screen.findByRole('alert')).toHaveTextContent(NOT_ADMIN);
    expect(calls.some((c: Call) => c.path === '/auth/logout')).toBe(true);
  });

  it('explains wrong passwords and rate limits', async () => {
    let attempts = 0;
    fakeApi({
      'POST /auth/refresh': () => apiError(401, 'INVALID_TOKEN'),
      'POST /auth/login': () =>
        ++attempts === 1
          ? apiError(401, 'INVALID_CREDENTIALS')
          : apiError(429, 'RATE_LIMITED', 'Too many', { 'Retry-After': '30' }),
    });
    renderApp();
    const user = userEvent.setup();
    await user.type(
      await screen.findByLabelText('Email'),
      'admin@example.test',
    );
    await user.type(screen.getByLabelText('Password'), 'wrong-password');
    await user.click(screen.getByRole('button', { name: 'Sign in' }));
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Email or password is incorrect.',
    );
    await user.click(screen.getByRole('button', { name: 'Sign in' }));
    await waitFor(() =>
      expect(screen.getByRole('alert')).toHaveTextContent(
        'Please wait 30 seconds',
      ),
    );
  });

  it('asks for a new password before anything else', async () => {
    fakeApi(
      signedIn({
        'GET /users/me': () =>
          json(200, { ...adminUser, mustChangePassword: true }),
        'POST /auth/change-password': () => json(204, undefined),
        'GET /users': () => json(200, page([])),
      }),
    );
    renderApp('/users');
    expect(
      await screen.findByRole('heading', { name: 'Choose a new password' }),
    ).toBeVisible();
    const user = userEvent.setup();
    await user.type(
      screen.getByLabelText('Current password'),
      'temporary-pass',
    );
    await user.type(screen.getByLabelText(/^New password/), 'short');
    await user.type(screen.getByLabelText('Confirm new password'), 'short');
    await user.click(screen.getByRole('button', { name: 'Save password' }));
    expect(screen.getByRole('alert')).toHaveTextContent(
      'at least 12 characters',
    );

    await user.clear(screen.getByLabelText(/^New password/));
    await user.clear(screen.getByLabelText('Confirm new password'));
    await user.type(
      screen.getByLabelText(/^New password/),
      'my-own-long-password',
    );
    await user.type(
      screen.getByLabelText('Confirm new password'),
      'my-own-long-password',
    );
    await user.click(screen.getByRole('button', { name: 'Save password' }));
    expect(await screen.findByRole('heading', { name: 'Users' })).toBeVisible();
  });
});

describe('portal', () => {
  it('opens and closes the menu on small screens', async () => {
    fakeApi(signedIn({ 'GET /users': () => json(200, page([])) }));
    renderApp('/users');
    const menu = await screen.findByRole('button', { name: 'Menu' });
    const user = userEvent.setup();
    expect(menu).toHaveAttribute('aria-expanded', 'false');
    await user.click(menu);
    expect(menu).toHaveAttribute('aria-expanded', 'true');
    expect(document.getElementById('sidebar')).toHaveClass('open');
    await user.click(screen.getByRole('link', { name: 'Roles & permissions' }));
    expect(menu).toHaveAttribute('aria-expanded', 'false');
  });

  it('searches users on the server', async () => {
    const { calls } = fakeApi(
      signedIn({ 'GET /users': () => json(200, page([adminUser])) }),
    );
    renderApp('/users');
    const user = userEvent.setup();
    await user.type(
      await screen.findByLabelText('Search by name or email'),
      'mwansa',
    );
    await user.selectOptions(
      screen.getByLabelText('Filter by role'),
      'CLINICIAN',
    );
    await user.click(screen.getByRole('button', { name: 'Search' }));
    await waitFor(() =>
      expect(calls.at(-1)!.path).toBe(
        '/users?q=mwansa&role=CLINICIAN&page=1&pageSize=25',
      ),
    );
  });

  it('requires a facility for clinicians', async () => {
    const { calls } = fakeApi(
      signedIn({
        'GET /users/u-2': () =>
          json(200, {
            ...adminUser,
            id: 'u-2',
            displayName: 'Staff',
            roles: ['PATHOLOGIST'],
          }),
        'GET /admin/facilities': () =>
          json(200, [
            {
              id: 'f-1',
              code: 'F1',
              name: 'Test Clinic',
              province: 'P',
              district: 'D',
            },
          ]),
        'PATCH /users/u-2': (c) =>
          json(200, {
            ...adminUser,
            id: 'u-2',
            displayName: 'Staff',
            ...(c.body as object),
          }),
      }),
    );
    renderApp('/users/u-2');
    const user = userEvent.setup();
    await user.click(await screen.findByLabelText('Clinician'));
    await user.click(screen.getByRole('button', { name: 'Save changes' }));
    expect(screen.getByRole('alert')).toHaveTextContent('need a facility');

    await user.selectOptions(screen.getByLabelText(/^Facility/), 'f-1');
    await user.click(screen.getByRole('button', { name: 'Save changes' }));
    await waitFor(() =>
      expect(calls.some((c) => c.method === 'PATCH')).toBe(true),
    );
    expect(calls.find((c) => c.method === 'PATCH')!.body).toEqual({
      roles: ['CLINICIAN', 'PATHOLOGIST'],
      facilityId: 'f-1',
    });
    expect(await screen.findByText(/Saved\./)).toBeVisible();
  });

  it('keeps locked permissions locked and saves after confirming', async () => {
    const admin = {
      name: 'ADMIN',
      description: 'Runs the system',
      permissions: ['user:manage', 'audit:read'],
      customised: false,
      userCount: 1,
      notAllowed: [],
      required: ['user:manage'],
    };
    const { calls } = fakeApi(
      signedIn({
        'GET /admin/roles': () => json(200, [admin]),
        'GET /admin/permissions': () =>
          json(200, [
            { code: 'user:manage', description: 'Manage accounts' },
            { code: 'audit:read', description: 'Read the audit log' },
          ]),
        'PUT /admin/roles/ADMIN/permissions': (c) =>
          json(200, { ...admin, ...(c.body as object), customised: true }),
      }),
    );
    renderApp('/roles/ADMIN');
    const user = userEvent.setup();
    expect(await screen.findByLabelText(/Manage accounts/)).toBeDisabled();
    await user.click(screen.getByLabelText(/Read the audit log/));
    await user.click(screen.getByRole('button', { name: 'Save permissions' }));
    const dialog = screen.getByRole('dialog');
    await user.click(within(dialog).getByRole('button', { name: 'Save' }));
    expect(await screen.findByText('Permissions saved.')).toBeVisible();
    expect(calls.find((c) => c.method === 'PUT')!.body).toEqual({
      permissions: ['user:manage'],
    });
  });

  it('links a patient account to the matching clinic record', async () => {
    let linked = false;
    const account = {
      userId: 'p-1',
      email: 'patient@example.test',
      displayName: 'Test Patient',
      idDocumentType: 'NRC',
      idNumberMasked: '******/**/1',
      phoneMasked: '+260*****67',
      linked: null,
      createdAt: '2026-01-01T00:00:00Z',
    };
    const { calls } = fakeApi(
      signedIn({
        'GET /admin/patient-accounts': () =>
          json(200, page(linked ? [] : [account])),
        'POST /admin/patient-accounts/p-1/match': () =>
          json(200, {
            patientId: 'pt-1',
            mrn: 'SYN-0009',
            facilityName: 'Test Clinic',
            linkedToAnotherAccount: false,
          }),
        'POST /admin/patient-accounts/p-1/link': () => {
          linked = true;
          return json(200, {
            ...account,
            linked: {
              patientId: 'pt-1',
              mrn: 'SYN-0009',
              facilityName: 'Test Clinic',
            },
          });
        },
      }),
    );
    renderApp('/patient-accounts');
    const user = userEvent.setup();
    await user.click(
      await screen.findByRole('button', { name: 'Find record and link' }),
    );
    const dialog = await screen.findByRole('dialog');
    expect(dialog).toHaveTextContent('SYN-0009 at Test Clinic');
    await user.click(within(dialog).getByRole('button', { name: 'Link' }));
    expect(await screen.findByText(/Account linked/)).toBeVisible();
    expect(
      calls.some((c) => c.path === '/admin/patient-accounts/p-1/link'),
    ).toBe(true);
    expect(await screen.findByText('No accounts here.')).toBeVisible();
  });

  it('explains when no clinic record has the NRC', async () => {
    fakeApi(
      signedIn({
        'GET /admin/patient-accounts': () =>
          json(
            200,
            page([
              {
                userId: 'p-1',
                email: 'x@example.test',
                displayName: 'X',
                idDocumentType: 'NRC',
                idNumberMasked: '*',
                phoneMasked: null,
                linked: null,
                createdAt: '',
              },
            ]),
          ),
        'POST /admin/patient-accounts/p-1/match': () =>
          apiError(404, 'NO_MATCH'),
      }),
    );
    renderApp('/patient-accounts');
    await userEvent
      .setup()
      .click(
        await screen.findByRole('button', { name: 'Find record and link' }),
      );
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'No clinic record has this NRC',
    );
  });
});
