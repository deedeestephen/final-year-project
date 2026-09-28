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

const counts = (over: Partial<Record<string, number>> = {}) => ({
  patients: 2,
  screeningVisits: 3,
  observations: 21,
  pathologyReports: 1,
  aiReports: 0,
  aiReportsLeftOutMock: 2,
  ...over,
});

const summary = (over: Record<string, unknown> = {}) => ({
  purpose: 'RESEARCH',
  patientsInScope: 5,
  patientsWithConsent: 2,
  consentRequired: 'RESEARCH_USE',
  willExport: counts(),
  maxPatients: 5000,
  smartcareConfigured: false,
  smartcareHost: null,
  ...over,
});

const bundle = { resourceType: 'Bundle', type: 'collection', entry: [] };

function renderAt(routes: Routes) {
  const api = fakeApi({
    'POST /auth/refresh': () => json(200, { accessToken: 'access' }),
    'GET /users/me': () => json(200, adminUser),
    'GET /admin/facilities': () =>
      json(200, [
        {
          id: 'f-1',
          code: 'SYN-1',
          name: 'Test Clinic',
          province: 'Lusaka',
          district: 'Lusaka',
        },
      ]),
    ...routes,
  });
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  render(
    <QueryClientProvider client={client}>
      <SessionProvider>
        <MemoryRouter initialEntries={['/fhir-export']}>
          <App />
        </MemoryRouter>
      </SessionProvider>
    </QueryClientProvider>,
  );
  return api;
}

let clicked: HTMLAnchorElement[] = [];
beforeEach(() => {
  resetClientForTests();
  clicked = [];
  // jsdom has no file downloads: add the two blob-URL functions (only) and
  // record what would be saved.
  for (const [name, fn] of [
    ['createObjectURL', () => 'blob:export'],
    ['revokeObjectURL', () => undefined],
  ] as const) {
    Object.defineProperty(URL, name, {
      value: vi.fn(fn),
      configurable: true,
      writable: true,
    });
  }
  vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (
    this: HTMLAnchorElement,
  ) {
    clicked.push(this);
  });
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('FHIR export page', () => {
  it('shows what will be exported, says practice AI results are left out, and saves the file', async () => {
    const { calls } = renderAt({
      'GET /fhir/export/summary': () => json(200, summary()),
      'POST /fhir/export': () => json(200, bundle),
    });
    const tiles = await screen.findByRole('list', { name: 'Will be exported' });
    expect(tiles).toHaveTextContent('2patients');
    expect(tiles).toHaveTextContent('21results and findings');
    expect(
      screen.getByText(/2 practice \(mock\) AI results are left out/),
    ).toBeVisible();
    expect(screen.getByText(/Names, phone numbers, emails/)).toBeVisible();

    const user = userEvent.setup();
    await user.click(
      screen.getByRole('button', { name: 'Download FHIR file (.json)' }),
    );
    expect(
      await screen.findByText(/Saved pca-mhealth-fhir-research-/),
    ).toBeVisible();
    expect(clicked).toHaveLength(1);
    expect(clicked[0].download).toMatch(
      /^pca-mhealth-fhir-research-\d{4}-\d{2}-\d{2}\.json$/,
    );
    expect(calls.find((c) => c.path === '/fhir/export')?.body).toEqual({
      purpose: 'RESEARCH',
    });
  });

  it('asks for the national-EHR consent and facility when chosen', async () => {
    const { calls } = renderAt({
      'GET /fhir/export/summary': () => json(200, summary()),
    });
    const user = userEvent.setup();
    await user.click(
      await screen.findByRole('button', {
        name: 'SmartCare Pro (national EHR)',
      }),
    );
    await user.selectOptions(screen.getByLabelText('Facility'), 'f-1');
    // In the introduction and in the counts.
    expect(
      await screen.findAllByText(
        /agreed to sharing with the national health record/,
      ),
    ).toHaveLength(2);
    expect(
      calls.some(
        (c) =>
          c.path === '/fhir/export/summary?purpose=NATIONAL_EHR&facilityId=f-1',
      ),
    ).toBe(true);
  });

  it('keeps sending off when no SmartCare Pro address is set', async () => {
    renderAt({
      'GET /fhir/export/summary': () =>
        json(200, summary({ purpose: 'NATIONAL_EHR' })),
    });
    const user = userEvent.setup();
    await user.click(
      await screen.findByRole('button', {
        name: 'SmartCare Pro (national EHR)',
      }),
    );
    expect(
      await screen.findByRole('button', { name: 'Send to SmartCare Pro' }),
    ).toBeDisabled();
    expect(screen.getByText(/Sending is off/)).toBeVisible();
  });

  it('sends to SmartCare Pro after confirming', async () => {
    const { calls } = renderAt({
      'GET /fhir/export/summary': () =>
        json(
          200,
          summary({
            purpose: 'NATIONAL_EHR',
            smartcareConfigured: true,
            smartcareHost: 'smartcare.example',
          }),
        ),
      'POST /fhir/export/push': () =>
        json(200, {
          status: 'SENT',
          bundleId: 'b-1',
          httpStatus: 201,
          receiverId: 'r-9',
          target: 'smartcare.example',
          counts: counts(),
        }),
    });
    const user = userEvent.setup();
    await user.click(
      await screen.findByRole('button', {
        name: 'SmartCare Pro (national EHR)',
      }),
    );
    await user.click(
      await screen.findByRole('button', { name: 'Send to SmartCare Pro' }),
    );
    const dialog = await screen.findByRole('dialog');
    expect(dialog).toHaveTextContent(
      '2 patients will be sent to smartcare.example',
    );
    expect(calls.some((c) => c.path === '/fhir/export/push')).toBe(false);
    await user.click(within(dialog).getByRole('button', { name: 'Send' }));
    expect(
      await screen.findByText(
        'Sent to smartcare.example: 2 patients. SmartCare Pro accepted it (reference r-9).',
      ),
    ).toBeVisible();
  });

  it('explains a refusal in plain words', async () => {
    renderAt({
      'GET /fhir/export/summary': () =>
        json(
          200,
          summary({
            purpose: 'NATIONAL_EHR',
            smartcareConfigured: true,
            smartcareHost: 'smartcare.example',
          }),
        ),
      'POST /fhir/export/push': () =>
        apiError(502, 'FHIR_TARGET_REJECTED', 'An unexpected error occurred'),
    });
    const user = userEvent.setup();
    await user.click(
      await screen.findByRole('button', {
        name: 'SmartCare Pro (national EHR)',
      }),
    );
    await user.click(
      await screen.findByRole('button', { name: 'Send to SmartCare Pro' }),
    );
    await user.click(
      within(await screen.findByRole('dialog')).getByRole('button', {
        name: 'Send',
      }),
    );
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'SmartCare Pro refused the file. Its reason is in the audit log.',
    );
  });

  it('cannot download when nobody consented or when there are too many patients', async () => {
    let s = summary({
      patientsWithConsent: 0,
      willExport: counts({ patients: 0, aiReportsLeftOutMock: 0 }),
    });
    renderAt({ 'GET /fhir/export/summary': () => json(200, s) });
    expect(
      await screen.findByText(/no patient here has given this consent/),
    ).toBeVisible();
    expect(
      screen.getByRole('button', { name: 'Download FHIR file (.json)' }),
    ).toBeDisabled();

    s = summary({
      patientsWithConsent: 6000,
      willExport: counts({ patients: 0 }),
    });
    const user = userEvent.setup();
    await user.selectOptions(screen.getByLabelText('Facility'), 'f-1');
    expect(await screen.findByText(/too many for one file/)).toBeVisible();
    expect(
      screen.getByRole('button', { name: 'Download FHIR file (.json)' }),
    ).toBeDisabled();
  });
});
