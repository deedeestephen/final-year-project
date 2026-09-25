import { randomUUID } from 'node:crypto';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { PrismaClient } from '@prisma/client';
import request from 'supertest';
import {
  createDbTestApp,
  createFacility,
  createUser,
  ensureSeeded,
  loginAs,
} from './helpers';

interface NotificationBody {
  id: string;
  type: string;
  title: string;
  body: string;
  readAt: string | null;
}
interface NotificationPageBody {
  items: NotificationBody[];
  unreadCount: number;
  total: number;
}

const prisma = new PrismaClient();

describe('patient app: own records and notifications (real database)', () => {
  let app: NestExpressApplication;
  let clinician: string;
  let patientUserId: string;
  let patientToken: string;
  let otherPatientToken: string;
  let patientId: string;

  const http = () => request(app.getHttpServer());
  const as = (token: string) => ({ Authorization: `Bearer ${token}` });
  const familyName = `Notify-${randomUUID().slice(0, 6)}`;

  const addRecord = (psa: number) =>
    http()
      .post(`/api/v1/patients/${patientId}/clinical-records`)
      .set(as(clinician))
      .send({ encounterDate: '2026-09-01', psaNgMl: psa, dreFinding: 'NORMAL' })
      .expect(201);

  const inbox = async (token = patientToken, query = {}) =>
    (
      await http()
        .get('/api/v1/notifications')
        .query(query)
        .set(as(token))
        .expect(200)
    ).body as NotificationPageBody;

  beforeAll(async () => {
    await ensureSeeded(prisma);
    app = await createDbTestApp();
    const facility = await createFacility(prisma, 'NT');
    clinician = await loginAs(
      app,
      (await createUser(prisma, 'CLINICIAN', facility)).email,
    );
    const patientUser = await createUser(prisma, 'PATIENT', null);
    patientUserId = patientUser.id;
    patientToken = await loginAs(app, patientUser.email);
    otherPatientToken = await loginAs(
      app,
      (await createUser(prisma, 'PATIENT', null)).email,
    );
    const res = await http()
      .post('/api/v1/patients')
      .set(as(clinician))
      .send({
        givenName: 'SYNTHETIC',
        familyName,
        dateOfBirth: '1959-02-02',
        regionClass: 'URBAN',
      })
      .expect(201);
    patientId = (res.body as { id: string }).id;
  });

  afterAll(async () => {
    await app.close();
    await prisma.$disconnect();
  });

  it('an unlinked patient account has no records to read and gets no notifications', async () => {
    await http()
      .get('/api/v1/patients/me/clinical-records')
      .set(as(patientToken))
      .expect(404);
    await addRecord(3.1);
    expect((await inbox()).total).toBe(0);
  });

  it('once linked, the patient reads only their own screening history (audited)', async () => {
    await http()
      .patch(`/api/v1/patients/${patientId}`)
      .set(as(clinician))
      .send({ version: 1, accountUserId: patientUserId })
      .expect(200);
    await addRecord(5.4);

    const res = await http()
      .get('/api/v1/patients/me/clinical-records')
      .set(as(patientToken))
      .expect(200);
    const records = res.body as { psaNgMl: number; patientId: string }[];
    expect(records).toHaveLength(2);
    expect(records.every((r) => r.patientId === patientId)).toBe(true);

    const audit = await prisma.auditLog.findFirst({
      where: { action: 'clinical_record.read_self', entityId: patientId },
    });
    expect(audit?.actorUserId).toBe(patientUserId);

    await http()
      .get('/api/v1/patients/me/clinical-records')
      .set(as(otherPatientToken))
      .expect(404);
    await http()
      .get('/api/v1/patients/me/clinical-records')
      .set(as(clinician))
      .expect(403);
  });

  it('a new record (REST or offline sync) notifies the patient without revealing values or names', async () => {
    const before = (await inbox()).total;
    await http()
      .post('/api/v1/sync')
      .set(as(clinician))
      .send({
        deviceId: 'notify-device-01',
        operations: [
          {
            idempotencyKey: randomUUID(),
            entityType: 'clinical_record',
            operation: 'CREATE',
            patientId,
            clientTimestamp: new Date().toISOString(),
            payload: {
              clientUuid: randomUUID(),
              encounterDate: '2026-09-02',
              psaNgMl: 7.7,
              dreFinding: 'NODULAR',
            },
          },
        ],
      })
      .expect(200);

    const page = await inbox();
    expect(page.total).toBe(before + 1);
    const created = page.items.filter(
      (n) => n.type === 'clinical_record.created',
    );
    expect(created.length).toBeGreaterThanOrEqual(2);
    for (const n of page.items) {
      expect(`${n.title} ${n.body}`).not.toMatch(/7\.7|5\.4|NODULAR/);
      expect(`${n.title} ${n.body}`).not.toContain(familyName);
    }
  });

  it('consent granted and withdrawn are both confirmed to the patient', async () => {
    const granted = await http()
      .post(`/api/v1/patients/${patientId}/consents`)
      .set(as(clinician))
      .send({
        type: 'AI_ANALYSIS',
        method: 'DIGITAL',
        consentTextVersion: 'v1',
      })
      .expect(201);
    await http()
      .post(
        `/api/v1/patients/me/consents/${(granted.body as { id: string }).id}/withdraw`,
      )
      .set(as(patientToken))
      .expect(200);
    const types = (await inbox()).items.map((n) => n.type);
    expect(types).toEqual(
      expect.arrayContaining(['consent.granted', 'consent.withdrawn']),
    );
    expect(types[0]).toBe('consent.withdrawn');
  });

  it('lists newest first, counts unread, marks one and then all as read', async () => {
    const all = await inbox();
    expect(all.unreadCount).toBe(all.total);

    const first = all.items[0];
    const marked = await http()
      .post(`/api/v1/notifications/${first.id}/read`)
      .set(as(patientToken))
      .expect(200);
    expect((marked.body as NotificationBody).readAt).not.toBeNull();
    // Marking again is harmless and keeps the first read time.
    const again = await http()
      .post(`/api/v1/notifications/${first.id}/read`)
      .set(as(patientToken))
      .expect(200);
    expect((again.body as NotificationBody).readAt).toBe(
      (marked.body as NotificationBody).readAt,
    );

    const unread = await inbox(patientToken, { unreadOnly: 'true' });
    expect(unread.total).toBe(all.total - 1);
    expect(unread.unreadCount).toBe(all.total - 1);

    const paged = await inbox(patientToken, { page: 2, pageSize: 1 });
    expect(paged.items).toHaveLength(1);

    const res = await http()
      .post('/api/v1/notifications/read-all')
      .set(as(patientToken))
      .expect(200);
    expect((res.body as { updated: number }).updated).toBe(all.total - 1);
    expect((await inbox()).unreadCount).toBe(0);
  });

  it("keeps each user's notifications private", async () => {
    const mine = (await inbox()).items[0];
    await http()
      .post(`/api/v1/notifications/${mine.id}/read`)
      .set(as(otherPatientToken))
      .expect(404);
    await http()
      .post(`/api/v1/notifications/${randomUUID()}/read`)
      .set(as(patientToken))
      .expect(404);
    await http()
      .post('/api/v1/notifications/not-a-uuid/read')
      .set(as(patientToken))
      .expect(400);
    expect((await inbox(otherPatientToken)).total).toBe(0);
    await http()
      .get('/api/v1/notifications')
      .query({ pageSize: 500 })
      .set(as(patientToken))
      .expect(400);
    await http().get('/api/v1/notifications').expect(401);
  });
});
