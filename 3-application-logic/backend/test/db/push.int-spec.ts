import { generateKeyPairSync, randomUUID } from 'node:crypto';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import os from 'node:os';
import path from 'node:path';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { PrismaClient } from '@prisma/client';
import request from 'supertest';
import { NOTIFICATION_TEXT } from '../../src/services/notifications/notifications.service';
import { MAX_DEVICES_PER_USER } from '../../src/services/notifications/push/push-devices.service';
import {
  createDbTestApp,
  createFacility,
  createUser,
  ensureSeeded,
  loginAs,
} from './helpers';

/** What the stand-in for Firebase received. */
interface Push {
  token: string;
  notification: { title: string; body: string };
  data: { notificationId: string; type: string };
}

const prisma = new PrismaClient();

/** Waits until `check` is true (the push sender runs every 250 ms here). */
async function eventually(
  check: () => boolean | Promise<boolean>,
  ms = 8000,
): Promise<void> {
  const until = Date.now() + ms;
  while (!(await check())) {
    if (Date.now() > until) throw new Error('timed out waiting');
    await new Promise((r) => setTimeout(r, 50));
  }
}

describe('push notifications (ADR-014; real database, a stand-in for Firebase)', () => {
  let app: NestExpressApplication;
  let firebase: Server;
  let folder: string;
  const pushes: Push[] = [];
  let clinician: string;
  let patientUserId: string;
  let patientToken: string;
  let otherUserId: string;
  let otherToken: string;
  let patientId: string;

  const http = () => request(app.getHttpServer());
  const as = (token: string) => ({ Authorization: `Bearer ${token}` });
  const register = (token: string, phone: string, platform = 'android') =>
    http()
      .post('/api/v1/notifications/devices')
      .set(as(token))
      .send({ token: phone, platform });
  const pushedTo = (phone: string) => pushes.filter((p) => p.token === phone);

  beforeAll(async () => {
    // Google's sign-in and Firebase's send endpoint, on this computer. Phones
    // whose token starts with "gone-" are unknown to this Firebase.
    firebase = createServer((req, res) => {
      const chunks: Buffer[] = [];
      req.on('data', (c: Buffer) => chunks.push(c));
      req.on('end', () => {
        res.setHeader('Content-Type', 'application/json');
        if (req.url === '/token') {
          res.end('{"access_token":"test-access","expires_in":3600}');
          return;
        }
        const { message } = JSON.parse(
          Buffer.concat(chunks).toString('utf8'),
        ) as { message: Push };
        if (message.token.startsWith('gone-')) {
          res.statusCode = 404;
          res.end(
            JSON.stringify({
              error: {
                status: 'NOT_FOUND',
                details: [{ errorCode: 'UNREGISTERED' }],
              },
            }),
          );
          return;
        }
        pushes.push(message);
        res.end('{"name":"projects/test-project/messages/1"}');
      });
    });
    await new Promise<void>((r) => firebase.listen(0, '127.0.0.1', r));
    const base = `http://127.0.0.1:${(firebase.address() as AddressInfo).port}`;
    folder = mkdtempSync(path.join(os.tmpdir(), 'pca-push-'));
    const keyFile = path.join(folder, 'service-account.json');
    writeFileSync(
      keyFile,
      JSON.stringify({
        type: 'service_account',
        project_id: 'test-project',
        client_email: 'push@test-project.iam.gserviceaccount.com',
        private_key: generateKeyPairSync('rsa', {
          modulusLength: 2048,
          privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
          publicKeyEncoding: { type: 'spki', format: 'pem' },
        }).privateKey,
        token_uri: `${base}/token`,
      }),
    );

    await ensureSeeded(prisma);
    app = await createDbTestApp({
      FCM_SERVICE_ACCOUNT_FILE: keyFile,
      FCM_API_URL: base,
      PUSH_POLL_MS: '250',
    });
    const facility = await createFacility(prisma, 'PU');
    clinician = await loginAs(
      app,
      (await createUser(prisma, 'CLINICIAN', facility)).email,
    );
    const patientUser = await createUser(prisma, 'PATIENT', null);
    patientUserId = patientUser.id;
    patientToken = await loginAs(app, patientUser.email);
    const other = await createUser(prisma, 'PATIENT', null);
    otherUserId = other.id;
    otherToken = await loginAs(app, other.email);

    const created = await http()
      .post('/api/v1/patients')
      .set(as(clinician))
      .send({
        givenName: 'SYNTHETIC',
        familyName: `Push-${randomUUID().slice(0, 6)}`,
        dateOfBirth: '1958-03-03',
        regionClass: 'URBAN',
      })
      .expect(201);
    patientId = (created.body as { id: string }).id;
    await http()
      .patch(`/api/v1/patients/${patientId}`)
      .set(as(clinician))
      .send({ version: 1, accountUserId: patientUserId })
      .expect(200);
  });

  afterAll(async () => {
    await app.close();
    await prisma.$disconnect();
    await new Promise((r) => firebase.close(r));
    rmSync(folder, { recursive: true, force: true });
  });

  it('says that push is on', async () => {
    const res = await http().get('/api/v1/health/ready').expect(200);
    expect((res.body as { checks: { push: string } }).checks.push).toBe('on');
  });

  it('registers a phone, and moves a known phone to the account signed in on it', async () => {
    const first = await register(patientToken, 'phone-a').expect(201);
    const { id } = first.body as { id: string };
    // The same phone, now signed in to another account: only that account's
    // notifications reach it.
    const moved = await register(otherToken, 'phone-a', 'ios').expect(201);
    expect((moved.body as { id: string }).id).toBe(id);
    let row = await prisma.pushDevice.findUniqueOrThrow({ where: { id } });
    expect([row.userId, row.platform]).toEqual([otherUserId, 'ios']);
    await register(patientToken, 'phone-a').expect(201);
    row = await prisma.pushDevice.findUniqueOrThrow({ where: { id } });
    expect(row.userId).toBe(patientUserId);

    await register(patientToken, 'phone-a', 'windows').expect(400);
    await register(patientToken, 'has spaces in it').expect(400);
    await register(patientToken, '').expect(400);
    await http()
      .post('/api/v1/notifications/devices')
      .send({ token: 'phone-z', platform: 'android' })
      .expect(401);
  });

  it(`keeps at most ${MAX_DEVICES_PER_USER} phones per account, dropping the longest unseen`, async () => {
    const user = await createUser(prisma, 'PATIENT', null);
    const token = await loginAs(app, user.email);
    for (let i = 0; i <= MAX_DEVICES_PER_USER; i++) {
      await register(token, `many-${user.id}-${i}`).expect(201);
    }
    const kept = await prisma.pushDevice.findMany({
      where: { userId: user.id },
      select: { token: true },
    });
    expect(kept).toHaveLength(MAX_DEVICES_PER_USER);
    expect(kept.map((d) => d.token)).not.toContain(`many-${user.id}-0`);
  });

  it('lets only the owner remove a phone', async () => {
    const { id } = (await register(patientToken, 'phone-r').expect(201))
      .body as { id: string };
    await http()
      .delete(`/api/v1/notifications/devices/${id}`)
      .set(as(otherToken))
      .expect(404);
    await http()
      .delete(`/api/v1/notifications/devices/${id}`)
      .set(as(patientToken))
      .expect(204);
    await http()
      .delete(`/api/v1/notifications/devices/${id}`)
      .set(as(patientToken))
      .expect(404);
    await http()
      .delete('/api/v1/notifications/devices/not-a-uuid')
      .set(as(patientToken))
      .expect(400);
  });

  it("pushes a new screening record to the patient's phones, once, with the in-app texts only", async () => {
    await register(patientToken, 'phone-b').expect(201);
    await http()
      .post(`/api/v1/patients/${patientId}/clinical-records`)
      .set(as(clinician))
      .send({
        encounterDate: '2026-09-30',
        psaNgMl: 6.3,
        dreFinding: 'NODULAR',
      })
      .expect(201);
    // Both of the patient's phones get it (phone-a is theirs again).
    await eventually(
      () => pushedTo('phone-b').length > 0 && pushedTo('phone-a').length > 0,
    );

    const [push] = pushedTo('phone-b');
    expect(push.notification).toEqual({
      title: NOTIFICATION_TEXT.recordAdded.title,
      body: NOTIFICATION_TEXT.recordAdded.body,
    });
    expect(push.data.type).toBe('clinical_record.created');
    expect(JSON.stringify(push)).not.toMatch(/6\.3|NODULAR|SYNTHETIC/);
    const inbox = await http()
      .get('/api/v1/notifications')
      .set(as(patientToken))
      .expect(200);
    const newest = (inbox.body as { items: { id: string }[] }).items[0];
    expect(push.data.notificationId).toBe(newest.id);
    const stored = await prisma.notification.findUniqueOrThrow({
      where: { id: newest.id },
    });
    expect(stored.pushedAt).not.toBeNull();
    expect(
      pushedTo('phone-a')
        .filter((p) => p.data.type === 'clinical_record.created')
        .map((p) => p.data.notificationId),
    ).toEqual([newest.id]);

    // Later runs never push it again.
    await new Promise((r) => setTimeout(r, 1000));
    expect(
      pushedTo('phone-b').filter((p) => p.data.notificationId === newest.id),
    ).toHaveLength(1);
  });

  it('forgets a phone that Firebase no longer knows', async () => {
    const { id } = (await register(patientToken, 'gone-1').expect(201))
      .body as { id: string };
    await http()
      .post(`/api/v1/patients/${patientId}/consents`)
      .set(as(clinician))
      .send({
        type: 'AI_ANALYSIS',
        method: 'DIGITAL',
        consentTextVersion: 'v1',
      })
      .expect(201);
    await eventually(
      async () => (await prisma.pushDevice.count({ where: { id } })) === 0,
    );
    // The other phones still got the consent notification.
    const consent = (phone: string) =>
      pushedTo(phone).some((p) => p.data.type === 'consent.granted');
    await eventually(() => consent('phone-a') && consent('phone-b'));
  });

  it('pushes nothing for old notifications, disabled accounts or rolled-back changes', async () => {
    const before = pushes.length;
    const old = await prisma.notification.create({
      data: {
        userId: patientUserId,
        ...NOTIFICATION_TEXT.accountLinked,
        createdAt: new Date(Date.now() - 20 * 60_000),
      },
    });

    const disabled = await createUser(prisma, 'PATIENT', null);
    const disabledToken = await loginAs(app, disabled.email);
    await register(disabledToken, 'phone-disabled').expect(201);
    await prisma.user.update({
      where: { id: disabled.id },
      data: { status: 'DISABLED' },
    });
    const forDisabled = await prisma.notification.create({
      data: { userId: disabled.id, ...NOTIFICATION_TEXT.accountLinked },
    });

    await expect(
      prisma.$transaction(async (tx) => {
        await tx.notification.create({
          data: {
            userId: patientUserId,
            type: 'test.rolled_back',
            title: 'Never',
            body: 'This change is rolled back.',
          },
        });
        throw new Error('roll back');
      }),
    ).rejects.toThrow('roll back');

    // The disabled account's notification is taken, and nothing is sent.
    await eventually(
      async () =>
        (
          await prisma.notification.findUniqueOrThrow({
            where: { id: forDisabled.id },
          })
        ).pushedAt !== null,
    );
    await new Promise((r) => setTimeout(r, 600));
    expect(pushes.slice(before)).toEqual([]);
    expect(
      (await prisma.notification.findUniqueOrThrow({ where: { id: old.id } }))
        .pushedAt,
    ).toBeNull();
    expect(
      await prisma.notification.count({ where: { type: 'test.rolled_back' } }),
    ).toBe(0);
  });

  it('stops the pushes when every session of the account ends', async () => {
    // Review of 2 October 2026: a phone cut off by a password reset kept
    // receiving the account's pushes.
    const admin = await loginAs(
      app,
      (await createUser(prisma, 'ADMIN', null)).email,
    );
    const user = await createUser(prisma, 'PATIENT', null);
    await register(await loginAs(app, user.email), 'phone-reset').expect(201);
    await http()
      .post(`/api/v1/users/${user.id}/reset-password`)
      .set(as(admin))
      .expect(200);
    expect(await prisma.pushDevice.count({ where: { userId: user.id } })).toBe(
      0,
    );

    // Disabling the account (an administrator ends its sessions) does the same.
    const other = await createUser(prisma, 'PATIENT', null);
    await register(await loginAs(app, other.email), 'phone-disable').expect(
      201,
    );
    await http()
      .patch(`/api/v1/users/${other.id}`)
      .set(as(admin))
      .send({ status: 'DISABLED' })
      .expect(200);
    expect(await prisma.pushDevice.count({ where: { userId: other.id } })).toBe(
      0,
    );
  });

  it("removes an account's phones with the account", async () => {
    const user = await createUser(prisma, 'PATIENT', null);
    await register(await loginAs(app, user.email), 'phone-deleted').expect(201);
    await prisma.user.delete({ where: { id: user.id } });
    expect(
      await prisma.pushDevice.count({ where: { token: 'phone-deleted' } }),
    ).toBe(0);
  });
});
