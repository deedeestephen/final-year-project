import { randomUUID } from 'node:crypto';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { PrismaClient } from '@prisma/client';
import * as argon2 from 'argon2';
import request from 'supertest';
import { resetDemoPasswords } from '../../prisma/seed';
import {
  createDbTestApp,
  createFacility,
  createUser,
  ensureSeeded,
  loginAs,
} from './helpers';

interface OpResult {
  idempotencyKey: string;
  result: 'APPLIED' | 'CONFLICT' | 'REJECTED';
  entityId?: string;
  version?: number;
  replayed: boolean;
  error?: { code: string; details?: { field: string }[] };
  server?: { id: string; version: number; familyName: string };
}
interface ChangesBody {
  patients: { id: string; clientUuid: string | null; familyName: string }[];
  clinicalRecords: {
    id: string;
    clientUuid: string | null;
    patientId: string;
  }[];
  cursor: string;
  hasMore: boolean;
}

const prisma = new PrismaClient();
const DEVICE = 'test-device-0001';

describe('offline synchronisation (real database)', () => {
  let app: NestExpressApplication;
  let clinicianA: string;
  let clinicianA2: string;
  let clinicianB: string;
  let pathologistA: string;
  let patientToken: string;

  const http = () => request(app.getHttpServer());
  const as = (token: string) => ({ Authorization: `Bearer ${token}` });

  const patientPayload = (overrides: Record<string, unknown> = {}) => ({
    clientUuid: randomUUID(),
    givenName: 'SYNTHETIC',
    familyName: `Sync-${randomUUID().slice(0, 6)}`,
    dateOfBirth: '1960-05-01',
    regionClass: 'RURAL',
    ...overrides,
  });
  const recordPayload = (overrides: Record<string, unknown> = {}) => ({
    clientUuid: randomUUID(),
    encounterDate: '2026-09-01',
    psaNgMl: 5.2,
    dreFinding: 'NORMAL',
    ...overrides,
  });
  const op = (o: Record<string, unknown>) => ({
    idempotencyKey: randomUUID(),
    clientTimestamp: new Date().toISOString(),
    ...o,
  });
  const createPatientOp = (payload = patientPayload()) =>
    op({ entityType: 'patient', operation: 'CREATE', payload });
  const createRecordOp = (patientId: string, payload = recordPayload()) =>
    op({
      entityType: 'clinical_record',
      operation: 'CREATE',
      patientId,
      payload,
    });

  async function push(
    token: string,
    operations: Record<string, unknown>[],
    status = 200,
  ): Promise<OpResult[]> {
    const res = await http()
      .post('/api/v1/sync')
      .set(as(token))
      .send({ deviceId: DEVICE, operations })
      .expect(status);
    return (res.body as { results: OpResult[] }).results;
  }

  beforeAll(async () => {
    await ensureSeeded(prisma);
    app = await createDbTestApp();
    const facilityA = await createFacility(prisma, 'SA');
    const facilityB = await createFacility(prisma, 'SB');
    clinicianA = await loginAs(
      app,
      (await createUser(prisma, 'CLINICIAN', facilityA)).email,
    );
    clinicianA2 = await loginAs(
      app,
      (await createUser(prisma, 'CLINICIAN', facilityA)).email,
    );
    clinicianB = await loginAs(
      app,
      (await createUser(prisma, 'CLINICIAN', facilityB)).email,
    );
    pathologistA = await loginAs(
      app,
      (await createUser(prisma, 'PATHOLOGIST', facilityA)).email,
    );
    patientToken = await loginAs(
      app,
      (await createUser(prisma, 'PATIENT', null)).email,
    );
  });

  afterAll(async () => {
    await app.close();
    await prisma.$disconnect();
  });

  describe('push', () => {
    it('applies a patient and a record that refers to it by its clientUuid', async () => {
      const patient = patientPayload();
      const [p, r] = await push(clinicianA, [
        createPatientOp(patient),
        createRecordOp(patient.clientUuid),
      ]);
      expect(p).toMatchObject({
        result: 'APPLIED',
        version: 1,
        replayed: false,
      });
      expect(r).toMatchObject({ result: 'APPLIED', replayed: false });
      const record = await prisma.clinicalRecord.findUniqueOrThrow({
        where: { id: r.entityId },
      });
      expect(record.patientId).toBe(p.entityId);
      const logged = await prisma.syncOperation.findUniqueOrThrow({
        where: { idempotencyKey: p.idempotencyKey },
      });
      expect(logged).toMatchObject({ result: 'APPLIED', deviceId: DEVICE });
    });

    it('replaying a batch returns the stored results and creates nothing twice', async () => {
      const patient = patientPayload();
      const ops = [
        createPatientOp(patient),
        createRecordOp(patient.clientUuid),
      ];
      const first = await push(clinicianA, ops);
      const second = await push(clinicianA, ops);
      expect(second.map((r) => r.replayed)).toEqual([true, true]);
      expect(second.map((r) => r.entityId)).toEqual(
        first.map((r) => r.entityId),
      );
      expect(
        await prisma.patient.count({
          where: { clientUuid: patient.clientUuid },
        }),
      ).toBe(1);
    });

    it('updates with the current version and reports a conflict with the server copy for a stale one', async () => {
      const patient = patientPayload();
      const [created] = await push(clinicianA, [createPatientOp(patient)]);
      const update = (baseVersion: number, familyName: string) =>
        op({
          entityType: 'patient',
          operation: 'UPDATE',
          entityId: patient.clientUuid, // offline edit before the server id was known
          baseVersion,
          payload: { familyName },
        });
      const [ok] = await push(clinicianA2, [update(1, 'Phiri')]);
      expect(ok).toMatchObject({
        result: 'APPLIED',
        version: 2,
        entityId: created.entityId,
      });

      const staleOp = update(1, 'Mwale');
      const [stale] = await push(clinicianA, [staleOp]);
      expect(stale).toMatchObject({
        result: 'CONFLICT',
        version: 2,
        error: { code: 'VERSION_CONFLICT' },
        server: { familyName: 'Phiri', version: 2 },
      });
      const [again] = await push(clinicianA, [staleOp]);
      expect(again).toMatchObject({
        result: 'CONFLICT',
        replayed: true,
        server: { familyName: 'Phiri' },
      });
    });

    it('rejects an invalid operation without blocking the rest of the batch', async () => {
      const results = await push(clinicianA, [
        createPatientOp(
          patientPayload({ dateOfBirth: '2999-01-01', unknownField: 1 }),
        ),
        createPatientOp(),
      ]);
      expect(results[0]).toMatchObject({
        result: 'REJECTED',
        error: { code: 'VALIDATION_FAILED' },
      });
      const fields = results[0].error!.details!.map((d) => d.field);
      expect(fields).toEqual(
        expect.arrayContaining(['dateOfBirth', 'unknownField']),
      );
      expect(results[1].result).toBe('APPLIED');
    });

    it('explains records whose patient failed in the same batch', async () => {
      const bad = patientPayload({ regionClass: 'MOON' });
      const results = await push(clinicianA, [
        createPatientOp(bad),
        createRecordOp(bad.clientUuid),
      ]);
      expect(results.map((r) => r.result)).toEqual(['REJECTED', 'REJECTED']);
      expect(results[1].error!.code).toBe('DEPENDENCY_FAILED');
    });

    it('requires client ids, entity ids and base versions', async () => {
      const results = await push(clinicianA, [
        createPatientOp(patientPayload({ clientUuid: undefined })),
        op({
          entityType: 'patient',
          operation: 'UPDATE',
          baseVersion: 1,
          payload: {},
        }),
        op({
          entityType: 'patient',
          operation: 'UPDATE',
          entityId: randomUUID(),
          payload: {},
        }),
        op({
          entityType: 'clinical_record',
          operation: 'CREATE',
          payload: recordPayload(),
        }),
        op({
          entityType: 'clinical_record',
          operation: 'UPDATE',
          patientId: randomUUID(),
          payload: {},
        }),
      ]);
      expect(results.map((r) => r.error?.code)).toEqual([
        'VALIDATION_FAILED',
        'VALIDATION_FAILED',
        'VALIDATION_FAILED',
        'VALIDATION_FAILED',
        'UNSUPPORTED_OPERATION',
      ]);
    });

    it('rejects a record without a client id and records for unknown patients', async () => {
      const [created] = await push(clinicianA, [createPatientOp()]);
      const results = await push(clinicianA, [
        createRecordOp(
          created.entityId!,
          recordPayload({ clientUuid: undefined }),
        ),
        createRecordOp(randomUUID()),
        createRecordOp(
          created.entityId!,
          recordPayload({ psaNgMl: 2, freePsaNgMl: 3 }),
        ),
      ]);
      expect(results.map((r) => r.error?.code)).toEqual([
        'VALIDATION_FAILED',
        'NOT_FOUND',
        'VALIDATION_FAILED',
      ]);
    });

    it('keeps facilities apart', async () => {
      const [created] = await push(clinicianA, [createPatientOp()]);
      const [other] = await push(clinicianB, [
        createRecordOp(created.entityId!),
      ]);
      expect(other).toMatchObject({
        result: 'REJECTED',
        error: { code: 'NOT_FOUND' },
      });
    });

    it('checks the permission for each operation', async () => {
      const [denied] = await push(pathologistA, [createPatientOp()]);
      expect(denied).toMatchObject({
        result: 'REJECTED',
        error: { code: 'FORBIDDEN' },
      });
    });

    it("refuses another account's operation id", async () => {
      const shared = createPatientOp();
      await push(clinicianA, [shared]);
      const [reused] = await push(clinicianA2, [shared]);
      expect(reused).toMatchObject({
        result: 'REJECTED',
        replayed: false,
        error: { code: 'IDEMPOTENCY_KEY_REUSED' },
      });
    });

    it('validates the batch envelope and the role', async () => {
      await push(clinicianA, [], 400);
      await push(
        clinicianA,
        Array.from({ length: 101 }, () => createPatientOp()),
        400,
      );
      await http()
        .post('/api/v1/sync')
        .set(as(clinicianA))
        .send({ deviceId: 'x', operations: [createPatientOp()] })
        .expect(400);
      await push(patientToken, [createPatientOp()], 403);
      await http()
        .post('/api/v1/sync')
        .send({ deviceId: DEVICE, operations: [] })
        .expect(401);
    });
  });

  describe('pull', () => {
    it('pages through changes with a cursor and only returns the caller facility', async () => {
      const facility = await createFacility(prisma, 'SP');
      const token = await loginAs(
        app,
        (await createUser(prisma, 'CLINICIAN', facility)).email,
      );
      const first = patientPayload();
      await push(token, [
        createPatientOp(first),
        createRecordOp(first.clientUuid),
        createPatientOp(),
        createPatientOp(),
      ]);

      const page = async (cursor?: string) =>
        (
          await http()
            .get('/api/v1/sync/changes')
            .query({ limit: 2, ...(cursor ? { cursor } : {}) })
            .set(as(token))
            .expect(200)
        ).body as ChangesBody;

      const p1 = await page();
      expect(p1.patients).toHaveLength(2);
      expect(p1.clinicalRecords).toHaveLength(1);
      expect(p1.hasMore).toBe(true);
      expect(p1.patients[0].clientUuid).toBe(first.clientUuid);

      const p2 = await page(p1.cursor);
      expect(p2.patients).toHaveLength(1);
      expect(p2.clinicalRecords).toHaveLength(0);
      expect(p2.hasMore).toBe(false);

      const p3 = await page(p2.cursor);
      expect(p3.patients).toHaveLength(0);
      expect(p3.cursor).toBe(p2.cursor);

      // An update moves the patient past the cursor again.
      const [upd] = await push(token, [
        op({
          entityType: 'patient',
          operation: 'UPDATE',
          entityId: first.clientUuid,
          baseVersion: 1,
          payload: { district: 'Chongwe' },
        }),
      ]);
      expect(upd.result).toBe('APPLIED');
      const p4 = await page(p3.cursor);
      expect(p4.patients.map((p) => p.clientUuid)).toEqual([first.clientUuid]);

      const audit = await prisma.auditLog.count({
        where: { action: 'sync.pull' },
      });
      expect(audit).toBeGreaterThanOrEqual(4);
    });

    it('rejects a malformed cursor and roles without clinical read access', async () => {
      await http()
        .get('/api/v1/sync/changes')
        .query({ cursor: 'bm90LWpzb24' })
        .set(as(clinicianA))
        .expect(400);
      await http()
        .get('/api/v1/sync/changes')
        .query({
          cursor: Buffer.from('{"p":[1,2],"r":[]}').toString('base64url'),
        })
        .set(as(clinicianA))
        .expect(400);
      await http()
        .get('/api/v1/sync/changes')
        .set(as(patientToken))
        .expect(403);
    });
  });

  describe('demo password reset', () => {
    it('resets only the listed synthetic accounts, forces a change and ends their sessions', async () => {
      // Not the demo domain: the seed test counts the demo accounts.
      const email = `reset-${randomUUID().slice(0, 8)}@reset-check.example.test`;
      const user = await prisma.user.create({
        data: {
          email,
          displayName: 'SYNTHETIC reset check',
          passwordHash: 'x',
          isSynthetic: true,
          failedLoginCount: 4,
          lockedUntil: new Date(Date.now() + 60_000),
        },
      });
      await prisma.refreshToken.create({
        data: {
          userId: user.id,
          tokenHash: randomUUID(),
          familyId: randomUUID(),
          expiresAt: new Date(Date.now() + 60_000),
        },
      });
      const count = await resetDemoPasswords(prisma, 'Reset-Demo-Pass-42', [
        email,
      ]);
      expect(count).toBe(1);
      const after = await prisma.user.findUniqueOrThrow({
        where: { id: user.id },
      });
      expect(after).toMatchObject({
        mustChangePassword: true,
        failedLoginCount: 0,
        lockedUntil: null,
      });
      expect(
        await argon2.verify(after.passwordHash, 'Reset-Demo-Pass-42'),
      ).toBe(true);
      expect(
        await prisma.refreshToken.count({
          where: { userId: user.id, revokedAt: null },
        }),
      ).toBe(0);
    });
  });
});
