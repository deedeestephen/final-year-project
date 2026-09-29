import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import App from '../App';
import { resetClientForTests } from '../api/client';
import { SessionProvider } from '../auth/session';
import { adminUser, apiError, fakeApi, json } from '../test/fake-api';

type Routes = Parameters<typeof fakeApi>[0];

const facility = {
  id: 'f-1',
  code: 'SYN-LSK',
  name: 'SYNTHETIC Lusaka Facility',
  province: 'Lusaka',
  district: 'Lusaka',
};

const clinician = (over: Record<string, unknown> = {}) => ({
  id: 'u-c',
  email: 'clinician@example.test',
  displayName: 'SYNTHETIC Clinician',
  status: 'ACTIVE',
  roles: ['CLINICIAN'],
  facilityId: 'f-1',
  mustChangePassword: false,
  lastLoginAt: null,
  createdAt: '2026-09-01T00:00:00Z',
  ...over,
});

function renderAt(path: string, routes: Routes) {
  const api = fakeApi({
    'POST /auth/refresh': () => json(200, { accessToken: 'access' }),
    'GET /users/me': () => json(200, adminUser),
    'GET /admin/facilities': () => json(200, [facility]),
    ...routes,
  });
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  render(
    <QueryClientProvider client={client}>
      <SessionProvider>
        <MemoryRouter initialEntries={[path]}>
          <App />
        </MemoryRouter>
      </SessionProvider>
    </QueryClientProvider>,
  );
  return api;
}

beforeEach(() => resetClientForTests());
afterEach(() => vi.unstubAllGlobals());

describe('user detail', () => {
  it('saves changed roles, facility and status, and nothing else', async () => {
    const { calls } = renderAt('/users/u-c', {
      'GET /users/u-c': () => json(200, clinician()),
      'PATCH /users/u-c': () => json(200, clinician()),
    });
    expect(
      await screen.findByRole('heading', { name: 'SYNTHETIC Clinician' }),
    ).toBeVisible();
    expect(screen.getByText('Never signed in')).toBeVisible();

    const user = userEvent.setup();
    await user.click(screen.getByLabelText('Pathologist / Radiologist'));
    await user.click(screen.getByLabelText(/Account active/));
    await user.click(screen.getByRole('button', { name: 'Save changes' }));

    expect(
      await screen.findByText('Saved. Changes to access apply straight away.'),
    ).toBeVisible();
    const patch = calls.find((c) => c.method === 'PATCH')!;
    expect(patch.body).toEqual({
      roles: ['CLINICIAN', 'PATHOLOGIST'],
      status: 'DISABLED',
    });
  });

  it('checks roles and facility before saving', async () => {
    const { calls } = renderAt('/users/u-c', {
      'GET /users/u-c': () => json(200, clinician({ facilityId: null })),
    });
    await screen.findByRole('heading', { name: 'SYNTHETIC Clinician' });
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: 'Save changes' }));
    expect(
      screen.getByText('Clinicians and pathologists need a facility.'),
    ).toBeVisible();

    await user.click(screen.getByLabelText('Clinician'));
    await user.click(screen.getByRole('button', { name: 'Save changes' }));
    expect(screen.getByText('Choose at least one role.')).toBeVisible();
    expect(calls.some((c) => c.method === 'PATCH')).toBe(false);
  });

  it('shows the server reason when saving is refused', async () => {
    renderAt('/users/u-c', {
      'GET /users/u-c': () => json(200, clinician()),
      'PATCH /users/u-c': () =>
        apiError(409, 'ROLE_LOCKED', 'This change is locked for safety.'),
    });
    await screen.findByRole('heading', { name: 'SYNTHETIC Clinician' });
    const user = userEvent.setup();
    await user.selectOptions(screen.getByLabelText('Facility'), '');
    await user.selectOptions(
      screen.getByLabelText('Facility'),
      'SYNTHETIC Lusaka Facility',
    );
    await user.click(screen.getByRole('button', { name: 'Save changes' }));
    expect(await screen.findByRole('alert')).toBeVisible();
  });

  it('unlocks a locked account', async () => {
    const { calls } = renderAt('/users/u-c', {
      'GET /users/u-c': () =>
        json(
          200,
          clinician({
            status: 'LOCKED',
            lastLoginAt: '2026-09-20T08:00:00Z',
            mustChangePassword: true,
          }),
        ),
      'PATCH /users/u-c': () => json(200, clinician()),
    });
    await screen.findByRole('heading', { name: 'SYNTHETIC Clinician' });
    expect(
      screen.getByText(/must choose a new password at next sign-in/),
    ).toBeVisible();
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: 'Unlock account' }));
    expect(await screen.findByText('Account unlocked.')).toBeVisible();
    expect(calls.find((c) => c.method === 'PATCH')!.body).toEqual({
      unlock: true,
    });
  });

  it('resets a password and shows the one-time password once', async () => {
    renderAt('/users/u-c', {
      'GET /users/u-c': () => json(200, clinician()),
      'POST /users/u-c/reset-password': () =>
        json(200, { temporaryPassword: 'synthetic-temp-1234' }),
    });
    await screen.findByRole('heading', { name: 'SYNTHETIC Clinician' });
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: 'Reset password' }));
    const dialog = await screen.findByRole('dialog');
    expect(dialog).toHaveTextContent('synthetic-temp-1234');
    expect(dialog).toHaveTextContent('clinician@example.test');
    await user.click(within(dialog).getByRole('button', { name: 'Done' }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('does not let administrators switch off or reset themselves', async () => {
    renderAt(`/users/${adminUser.id}`, {
      [`GET /users/${adminUser.id}`]: () => json(200, adminUser),
    });
    await screen.findByRole('heading', { name: adminUser.displayName });
    expect(screen.getByLabelText(/Account active/)).toBeDisabled();
    expect(
      screen.getByText('You cannot switch off your own account.'),
    ).toBeVisible();
    expect(
      screen.queryByRole('button', { name: 'Reset password' }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: 'Delete account' }),
    ).not.toBeInTheDocument();
  });

  it('deletes an account after confirming, and says so on the Users list', async () => {
    const { calls } = renderAt('/users/u-c', {
      'GET /users/u-c': () => json(200, clinician()),
      'DELETE /users/u-c': () => new Response(null, { status: 204 }),
      'GET /users': () =>
        json(200, { items: [], page: 1, pageSize: 25, total: 0 }),
    });
    await screen.findByRole('heading', { name: 'SYNTHETIC Clinician' });
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: 'Delete account' }));
    const dialog = await screen.findByRole('dialog', {
      name: 'Delete this account?',
    });
    expect(dialog).toHaveTextContent('clinician@example.test');
    expect(dialog).toHaveTextContent('cannot be undone');
    // Cancel gets the focus, so Enter does not delete by accident.
    expect(
      within(dialog).getByRole('button', { name: 'Cancel' }),
    ).toHaveFocus();
    expect(calls.some((c) => c.method === 'DELETE')).toBe(false);

    await user.click(
      within(dialog).getByRole('button', { name: 'Delete account' }),
    );
    expect(
      await screen.findByText(
        'The account clinician@example.test was deleted.',
      ),
    ).toBeVisible();
    expect(screen.getByRole('heading', { name: 'Users' })).toBeVisible();
    expect(calls.filter((c) => c.method === 'DELETE')).toHaveLength(1);
  });

  it('can be cancelled', async () => {
    const { calls } = renderAt('/users/u-c', {
      'GET /users/u-c': () => json(200, clinician()),
    });
    await screen.findByRole('heading', { name: 'SYNTHETIC Clinician' });
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: 'Delete account' }));
    await user.click(
      within(await screen.findByRole('dialog')).getByRole('button', {
        name: 'Cancel',
      }),
    );
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(calls.some((c) => c.method === 'DELETE')).toBe(false);
  });

  it('explains why an account with clinical history cannot be deleted', async () => {
    renderAt('/users/u-c', {
      'GET /users/u-c': () => json(200, clinician()),
      'DELETE /users/u-c': () =>
        apiError(
          409,
          'HAS_CLINICAL_HISTORY',
          'This account has clinical history, so it cannot be deleted. Disable it instead.',
        ),
    });
    await screen.findByRole('heading', { name: 'SYNTHETIC Clinician' });
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: 'Delete account' }));
    await user.click(
      within(await screen.findByRole('dialog')).getByRole('button', {
        name: 'Delete account',
      }),
    );
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Disable it instead.',
    );
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(
      screen.getByRole('heading', { name: 'SYNTHETIC Clinician' }),
    ).toBeVisible();
  });
});

describe('add staff user', () => {
  it('checks the form, creates the account and shows its one-time password', async () => {
    const { calls } = renderAt('/users/new', {
      'POST /users': () =>
        json(201, {
          user: clinician({ email: 'new.clinician@example.test' }),
          temporaryPassword: 'synthetic-first-5678',
        }),
      'GET /users': () =>
        json(200, { items: [], page: 1, pageSize: 25, total: 0 }),
    });
    await screen.findByRole('heading', { name: 'Add staff user' });
    const user = userEvent.setup();
    const create = screen.getByRole('button', { name: 'Create account' });

    await user.type(screen.getByLabelText('Email'), 'not-an-email');
    await user.click(create);
    expect(screen.getByText('Enter a valid email address.')).toBeVisible();

    await user.clear(screen.getByLabelText('Email'));
    await user.type(
      screen.getByLabelText('Email'),
      'new.clinician@example.test',
    );
    await user.click(create);
    expect(screen.getByText('Enter the full name.')).toBeVisible();

    await user.type(
      screen.getByLabelText('Full name'),
      'SYNTHETIC New Clinician',
    );
    await user.click(create);
    expect(
      screen.getByText('Clinicians and pathologists need a facility.'),
    ).toBeVisible();

    await user.click(screen.getByLabelText('Clinician'));
    await user.click(create);
    expect(screen.getByText('Choose at least one role.')).toBeVisible();

    await user.click(screen.getByLabelText('Clinician'));
    await user.selectOptions(
      screen.getByLabelText('Facility'),
      'SYNTHETIC Lusaka Facility',
    );
    await user.click(create);
    const dialog = await screen.findByRole('dialog');
    expect(dialog).toHaveTextContent('synthetic-first-5678');
    expect(
      calls.find((c) => c.method === 'POST' && c.path === '/users')!.body,
    ).toEqual({
      email: 'new.clinician@example.test',
      displayName: 'SYNTHETIC New Clinician',
      roles: ['CLINICIAN'],
      facilityId: 'f-1',
    });

    await user.click(within(dialog).getByRole('button', { name: 'Done' }));
    expect(await screen.findByRole('heading', { name: 'Users' })).toBeVisible();
  });

  it('shows the server reason when the email is taken', async () => {
    renderAt('/users/new', {
      'POST /users': () =>
        apiError(409, 'EMAIL_TAKEN', 'An account with this email exists.'),
    });
    await screen.findByRole('heading', { name: 'Add staff user' });
    const user = userEvent.setup();
    await user.type(screen.getByLabelText('Email'), 'taken@example.test');
    await user.type(screen.getByLabelText('Full name'), 'SYNTHETIC Taken');
    await user.click(screen.getByLabelText('Administrator'));
    await user.click(screen.getByLabelText('Clinician'));
    await user.click(screen.getByRole('button', { name: 'Create account' }));
    expect(await screen.findByRole('alert')).toBeVisible();
  });
});
