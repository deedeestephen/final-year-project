import { randomUUID } from 'node:crypto';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { PrismaClient } from '@prisma/client';
import request from 'supertest';
import { lusakaDate } from '../../src/services/audit/activity.service';
import {
  TEST_PASSWORD,
  createDbTestApp,
  createFacility,
  createUser,
  ensureSeeded,
} from './helpers';

/*
 * Admin dashboard of app activity: requests from the phone app carry
 * `X-Client: mobile`, the admin website `X-Client: web`; the dashboard counts
 * them apart, with sync health from the sync log. Counts only: no patient
 * names or clinical values.
 */

const prisma = new PrismaClient();

interface Activity {
  days: number;
  totals: Record<string, number>;
  daily: {
    date: string;
    signIns: number;
    syncedChanges: number;
    screeningRecords: number;
  }[];
  byClient: { name: string; count: number }[];
  signInsByRole: { name: string; count: number }[];
  sync: { applied: number; conflicts: number; rejected: number };
  recentPhone: { action: string; actorEmail: string | null }[];
}

describe('admin activity dashboard (real database)', () => {
  let app: NestExpressApplication;
  let adminToken: string;
  let phoneToken: string;
  let clinician: { id: string; email: string };
  const as = (t: string) => ({ Authorization: `Bearer ${t}` });
  const familyName = `Dash${randomUUID().slice(0, 6)}`;

  beforeAll(async () => {
    await ensureSeeded(prisma);
    app = await createDbTestApp();
    const facility = await createFacility(prisma, 'DASH');
    const admin = await createUser(prisma, 'ADMIN', null);
    clinician = await createUser(prisma, 'CLINICIAN', facility);
    const login = (email: string, client: string) =>
      request(app.getHttpServer())
        .post('/api/v1/auth/login')
        .set('X-Client', client)
        .send({ email, password: TEST_PASSWORD })
        .expect(200);
    adminToken = (
      (await login(admin.email, 'web')).body as { accessToken: string }
    ).accessToken;
    phoneToken = (
      (await login(clinician.email, 'mobile')).body as { accessToken: string }
    ).accessToken;

    // The phone syncs a patient and a screening record made offline.
    const patientUuid = randomUUID();
    const op = (o: Record<string, unknown>) => ({
      idempotencyKey: randomUUID(),
      clientTimestamp: new Date().toISOString(),
      ...o,
    });
    await request(app.getHttpServer())
      .post('/api/v1/sync')
      .set(as(phoneToken))
      .set('X-Client', 'mobile')
      .send({
        deviceId: `dash-phone-${randomUUID().slice(0, 8)}`,
        operations: [
          op({
            entityType: 'patient',
            operation: 'CREATE',
            payload: {
              clientUuid: patientUuid,
              givenName: 'SYNTHETIC',
              familyName,
              dateOfBirth: '1960-01-01',
              regionClass: 'RURAL',
            },
          }),
          op({
            entityType: 'clinical_record',
            operation: 'CREATE',
            patientId: patientUuid,
            payload: {
              clientUuid: randomUUID(),
              encounterDate: '2026-09-28',
              psaNgMl: 4.4,
              dreFinding: 'NORMAL',
            },
          }),
        ],
      })
      .expect(200);
  });

  afterAll(async () => {
    await app?.close();
    await prisma.$disconnect();
  });

  const get = (query: string, token = adminToken) =>
    request(app.getHttpServer())
      .get(`/api/v1/admin/activity${query}`)
      .set(as(token))
      .set('X-Client', 'web');

  it('is for administrators only, with fixed periods', async () => {
    await get('', phoneToken).expect(403);
    await get('?days=5').expect(400);
  });

  it('counts sign-ins, new patients, records, phones and sync health', async () => {
    const a = (await get('?days=7').expect(200)).body as Activity;
    expect(a.days).toBe(7);
    expect(a.totals.signIns).toBeGreaterThanOrEqual(2);
    expect(a.totals.patientsRegistered).toBeGreaterThanOrEqual(1);
    expect(a.totals.screeningRecords).toBeGreaterThanOrEqual(1);
    expect(a.totals.activePhones).toBeGreaterThanOrEqual(1);
    expect(a.totals.activePhoneUsers).toBeGreaterThanOrEqual(1);
    expect(a.sync.applied).toBeGreaterThanOrEqual(2);
    expect(a.signInsByRole.map((r) => r.name)).toEqual(
      expect.arrayContaining(['ADMIN', 'CLINICIAN']),
    );
  });

  it('tells phone activity from the admin website', async () => {
    const a = (await get('?days=1').expect(200)).body as Activity;
    const byClient = Object.fromEntries(
      a.byClient.map((c) => [c.name, c.count]),
    );
    expect(Object.keys(byClient)).toEqual(['mobile', 'web', 'other']);
    expect(byClient.mobile).toBeGreaterThanOrEqual(3); // login + patient + record
    expect(byClient.web).toBeGreaterThanOrEqual(1);
    const mine = a.recentPhone.filter((e) => e.actorEmail === clinician.email);
    expect(mine.map((e) => e.action)).toEqual(
      expect.arrayContaining([
        'auth.login',
        'patient.created',
        'clinical_record.created',
      ]),
    );
  });

  it('gives one entry per day in Zambian time, today included', async () => {
    const a = (await get('?days=7').expect(200)).body as Activity;
    expect(a.daily.length).toBeGreaterThanOrEqual(7);
    expect(a.daily.length).toBeLessThanOrEqual(8);
    const today = a.daily.at(-1)!;
    expect(today.date).toBe(lusakaDate(new Date()));
    expect(today.syncedChanges).toBeGreaterThanOrEqual(2);
    expect(today.signIns).toBeGreaterThanOrEqual(2);
  });

  it('shows no patient names or clinical values', async () => {
    const a = (await get('?days=7').expect(200)).body as Activity;
    const text = JSON.stringify(a);
    expect(text).not.toContain(familyName);
    expect(text).not.toContain('4.4');
  });
});
