// Photographs the admin website: the dashboard, the Users list and the
// "Delete this account?" dialog. The browser answers the website's calls to
// the API itself, with the synthetic data below, so no real account, and no
// real number, appears in a picture. The website must be running
// (dev-up.ps1, or "npm run dev" in 1-presentation-layer/admin-panel-web).
//   node shoot-admin.mjs <output folder>
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { sleep, withBrowser } from './chrome.mjs';

const SITE = process.env.ADMIN_URL ?? 'http://localhost:5173';
const API = 'http://localhost:3000';
const out = process.argv[2];
mkdirSync(out, { recursive: true });

try {
  await fetch(SITE);
} catch {
  console.error(`The admin website is not running at ${SITE}. Start it with dev-up.ps1 first.`);
  process.exit(1);
}

// --- synthetic answers ------------------------------------------------------

const user = (n, name, email, roles, status = 'ACTIVE') => ({
  id: `u-${n}`,
  email,
  displayName: name,
  status,
  roles,
  facilityId: roles.includes('ADMIN') ? null : 'f-1',
  mustChangePassword: false,
  lockedUntil: null,
  lastLoginAt: '2026-09-29T08:00:00Z',
  createdAt: '2026-09-01T00:00:00Z',
});
const users = [
  user(1, 'SYNTHETIC Admin', 'admin@example.test', ['ADMIN']),
  user(2, 'SYNTHETIC Clinician', 'clinician@example.test', ['CLINICIAN']),
  user(3, 'SYNTHETIC Pathologist', 'pathologist@example.test', ['PATHOLOGIST']),
  user(4, 'SYNTHETIC Patient 001', 'patient001@example.test', ['PATIENT']),
  user(5, 'SYNTHETIC Patient 002', 'patient002@example.test', ['PATIENT'], 'LOCKED'),
  user(6, 'SYNTHETIC Test account', 'e2e-patient@example.test', ['PATIENT']),
  user(7, 'SYNTHETIC Former staff', 'former@example.test', ['CLINICIAN'], 'DISABLED'),
];

// Made-up numbers for the dashboard picture, not measurements.
const now = Date.now();
const days = [...Array(7)].map((_, i) => new Date(now - (6 - i) * 86_400_000).toISOString().slice(0, 10));
const activity = {
  days: 7,
  from: new Date(now - 7 * 86_400_000).toISOString(),
  to: new Date(now).toISOString(),
  totals: {
    activeUsers: 9, activePhoneUsers: 6, activePhones: 4, signIns: 31, failedSignIns: 2,
    patientsRegistered: 12, screeningRecords: 18, uploads: 5, aiRequested: 4, aiCompleted: 4,
    consentsGranted: 7, consentsWithdrawn: 1, accessDenied: 3,
  },
  daily: days.map((date, i) => ({
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
    ['clinical_record.created', 'SUCCESS', 'clinician@example.test', 2],
    ['access.denied', 'DENIED', 'patient001@example.test', 3],
    ['imaging.uploaded', 'SUCCESS', 'clinician@example.test', 20],
    ['auth.login', 'SUCCESS', 'pathologist@example.test', 95],
    ['consent.granted', 'SUCCESS', 'clinician@example.test', 300],
  ].map(([action, outcome, actorEmail, minutes], i) => ({
    seq: String(900 - i),
    occurredAt: new Date(now - minutes * 60_000).toISOString(),
    action,
    outcome,
    actorEmail,
    actorRole: 'CLINICIAN',
  })),
};

const answers = {
  'POST /api/v1/auth/refresh': { accessToken: 'synthetic' },
  'GET /api/v1/users/me': users[0],
  'GET /api/v1/users': { items: users, page: 1, pageSize: 25, total: users.length },
  'GET /api/v1/users/u-6': users[5],
  'GET /api/v1/admin/activity': activity,
  'GET /api/v1/admin/facilities': [
    { id: 'f-1', code: 'SYN-LSK', name: 'SYNTHETIC Lusaka Facility', province: 'Lusaka', district: 'Lusaka' },
  ],
};

// --- the pictures -----------------------------------------------------------

await withBrowser(async (browser) => {
  const headers = [
    { name: 'Access-Control-Allow-Origin', value: SITE },
    { name: 'Access-Control-Allow-Credentials', value: 'true' },
    { name: 'Access-Control-Allow-Headers', value: 'Authorization, Content-Type, X-Client' },
    { name: 'Access-Control-Allow-Methods', value: 'GET, POST, PATCH, DELETE' },
    { name: 'Content-Type', value: 'application/json' },
  ];
  browser.on(async (msg) => {
    if (msg.method !== 'Fetch.requestPaused') return;
    const { requestId, request } = msg.params;
    if (request.method === 'OPTIONS') {
      await browser.send('Fetch.fulfillRequest', { requestId, responseCode: 204, responseHeaders: headers });
      return;
    }
    const body = answers[`${request.method} ${new URL(request.url).pathname}`];
    await browser.send('Fetch.fulfillRequest', {
      requestId,
      responseCode: body ? 200 : 404,
      responseHeaders: headers,
      body: Buffer.from(JSON.stringify(body ?? { error: { code: 'NOT_FOUND', message: 'Not found' } })).toString('base64'),
    });
  });
  await browser.send('Fetch.enable', { patterns: [{ urlPattern: `${API}/*` }] });

  const size = (width, height) =>
    browser.send('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: 1, mobile: false });
  const shoot = async (name, fullPage = false) => {
    if (fullPage) {
      // A window as tall as the page, so parts sized to the window (the
      // sidebar) reach the bottom too.
      const width = await browser.evaluate('document.documentElement.clientWidth');
      const height = await browser.evaluate('document.documentElement.scrollHeight');
      await size(width, height);
      await sleep(800);
    }
    const shot = await browser.send('Page.captureScreenshot', { format: 'png' });
    writeFileSync(join(out, `${name}.png`), Buffer.from(shot.data, 'base64'));
    console.log(`  ${name}.png`);
  };

  await size(1366, 900);
  await browser.navigate(`${SITE}/`);
  await sleep(3000);
  await shoot('admin-dashboard', true);

  await size(1280, 820);
  await browser.navigate(`${SITE}/users`);
  await sleep(2500);
  await shoot('admin-users');

  await browser.navigate(`${SITE}/users/u-6`);
  await sleep(2500);
  const opened = await browser.evaluate(`(() => {
    const button = [...document.querySelectorAll('button')].find((b) => b.textContent.trim() === 'Delete account');
    button?.click();
    return Boolean(button);
  })()`);
  if (!opened) throw new Error('The "Delete account" button was not found on the account page.');
  await sleep(600);
  await shoot('admin-delete');
});
