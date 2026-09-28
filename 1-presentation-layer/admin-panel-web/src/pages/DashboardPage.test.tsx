import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import App from '../App';
import { resetClientForTests } from '../api/client';
import { SessionProvider } from '../auth/session';
import { niceMax, shortDate } from '../components/chart-format';
import {
  adminUser,
  apiError,
  fakeApi,
  json,
  sampleActivity,
} from '../test/fake-api';

type Routes = Parameters<typeof fakeApi>[0];

function renderAt(routes: Routes, path = '/') {
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

describe('dashboard', () => {
  it('shows phone app activity as counts, never names', async () => {
    renderAt({ 'GET /admin/activity': () => json(200, sampleActivity) });
    const hero = await screen.findByRole('region', {
      name: 'Phone app at a glance',
    });
    expect(hero).toHaveTextContent('Active in the phone app');
    expect(hero).toHaveTextContent('6');
    expect(hero).toHaveTextContent('4 phones synced');

    const signIns = screen.getByText('Sign-ins', {
      selector: '.stat-label',
    }).parentElement!;
    expect(signIns).toHaveTextContent('31');
    expect(signIns).toHaveTextContent('2 failed');

    // Offline sync health carries an icon and words, not colour alone.
    expect(screen.getByText('Saved').parentElement).toHaveTextContent('50');
    expect(
      screen.getByText('Conflicts (kept for a person to choose)').parentElement,
    ).toHaveTextContent('2');

    // Where activity comes from: every part has a label and a number.
    expect(screen.getByText('Phone app').parentElement).toHaveTextContent(
      '6472%',
    );
    expect(screen.getByText('Admin website')).toBeVisible();

    // Roles in plain words.
    expect(screen.getByText('Clinicians').parentElement).toHaveTextContent(
      '20',
    );

    // The feed says what happened in plain words.
    const feed = screen
      .getByRole('heading', { name: 'Latest from the phone app' })
      .closest('section')!;
    expect(within(feed).getByText('Added a screening record')).toBeVisible();
    expect(
      within(feed).getByText(/patient@example\.test · refused/),
    ).toBeVisible();
  });

  it('changes the period and asks the server again', async () => {
    const { calls } = renderAt({
      'GET /admin/activity': () => json(200, sampleActivity),
    });
    await screen.findByText('Active in the phone app');
    expect(calls.some((c) => c.path === '/admin/activity?days=7')).toBe(true);
    const period = screen.getByRole('group', { name: 'Period' });
    expect(
      within(period).getByRole('button', { name: '7 days' }),
    ).toHaveAttribute('aria-pressed', 'true');

    const user = userEvent.setup();
    await user.click(within(period).getByRole('button', { name: '30 days' }));
    await vi.waitFor(() =>
      expect(calls.some((c) => c.path === '/admin/activity?days=30')).toBe(
        true,
      ),
    );
    expect(
      within(period).getByRole('button', { name: '30 days' }),
    ).toHaveAttribute('aria-pressed', 'true');
  });

  it('offers the daily chart as a table', async () => {
    renderAt({ 'GET /admin/activity': () => json(200, sampleActivity) });
    await screen.findByText('Active in the phone app');
    const chart = screen.getByRole('img', { name: /Activity per day/ });
    expect(chart).toHaveAttribute('tabindex', '0');

    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: 'Show as table' }));
    const table = screen.getByRole('table', { name: 'Activity per day' });
    const lastDay = within(table).getByRole('rowheader', {
      name: '28 Sep',
    }).parentElement!;
    // Sign-ins, changes synced, screening records on the last day.
    expect(lastDay).toHaveTextContent('28 Sep7135');
    await user.click(screen.getByRole('button', { name: 'Show as chart' }));
    expect(screen.getByRole('img', { name: /Activity per day/ })).toBeVisible();
  });

  it('reads each day with the arrow keys', async () => {
    renderAt({ 'GET /admin/activity': () => json(200, sampleActivity) });
    await screen.findByText('Active in the phone app');
    const chart = screen.getByRole('img', { name: /Activity per day/ });
    chart.focus();
    const user = userEvent.setup();
    await user.keyboard('{ArrowLeft}');
    const tip = screen.getByRole('status');
    expect(tip).toHaveTextContent('28 Sep');
    expect(tip).toHaveTextContent('7Sign-ins');
    expect(tip).toHaveTextContent('13Changes synced from phones');
    await user.keyboard('{ArrowLeft}');
    expect(screen.getByRole('status')).toHaveTextContent('27 Sep');
    await user.keyboard('{Escape}');
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });

  it('explains an empty period', async () => {
    renderAt({
      'GET /admin/activity': () =>
        json(200, {
          ...sampleActivity,
          signInsByRole: [],
          recentPhone: [],
          byClient: [
            { name: 'mobile', count: 0 },
            { name: 'web', count: 0 },
            { name: 'other', count: 0 },
          ],
        }),
    });
    expect(
      await screen.findByText('No sign-ins in this period.'),
    ).toBeVisible();
    expect(screen.getByText('Nothing from the phone app yet.')).toBeVisible();
  });

  it('shows a plain error when the server refuses', async () => {
    renderAt({
      'GET /admin/activity': () => apiError(403, 'FORBIDDEN', 'Not allowed'),
    });
    expect(await screen.findByRole('alert')).toBeVisible();
    expect(
      screen.queryByText('Active in the phone app'),
    ).not.toBeInTheDocument();
  });
});

describe('navigation', () => {
  it('marks the current page and groups the menu', async () => {
    renderAt({ 'GET /admin/activity': () => json(200, sampleActivity) });
    const nav = await screen.findByRole('navigation', { name: 'Main' });
    expect(
      within(nav).getByRole('link', { name: 'Dashboard' }),
    ).toHaveAttribute('aria-current', 'page');
    expect(
      within(nav).getByRole('link', { name: 'Users' }),
    ).not.toHaveAttribute('aria-current');
    expect(within(nav).getByText('Records & data')).toBeInTheDocument();
    expect(within(nav).getByText('Synthetic data only')).toBeVisible();
  });

  it('opens and closes the menu on small screens', async () => {
    renderAt({ 'GET /admin/activity': () => json(200, sampleActivity) });
    const button = await screen.findByRole('button', { name: 'Menu' });
    expect(button).toHaveAttribute('aria-expanded', 'false');
    const user = userEvent.setup();
    await user.click(button);
    expect(button).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByRole('navigation', { name: 'Main' })).toHaveClass(
      'open',
    );
  });

  it('shows the signed-in person with initials', async () => {
    renderAt({ 'GET /admin/activity': () => json(200, sampleActivity) });
    await screen.findByText(adminUser.email);
    const initials = adminUser.displayName
      .split(/\s+/)
      .slice(0, 2)
      .map((w) => w[0].toUpperCase())
      .join('');
    expect(document.querySelector('.avatar')).toHaveTextContent(initials);
  });
});

describe('chart helpers', () => {
  it('rounds axis maximums to clean numbers', () => {
    expect(niceMax(0)).toBe(4);
    expect(niceMax(7)).toBe(10);
    expect(niceMax(13)).toBe(20);
    expect(niceMax(41)).toBe(50);
    expect(niceMax(100)).toBe(100);
    expect(niceMax(101)).toBe(200);
  });

  it('writes short dates without shifting the day', () => {
    expect(shortDate('2026-09-28')).toBe('28 Sep');
    expect(shortDate('2026-01-01')).toBe('1 Jan');
  });
});
