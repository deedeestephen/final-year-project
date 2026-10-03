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

interface PatientBody {
  id: string;
  mrn: string;
  givenName: string;
  familyName: string;
  nationalIdMasked: string | null;
  phone: string | null;
  ageYears: number;
  version: number;
  accountUserId: string | null;
}
interface ErrorBody {
  error: { status: number; code: string; details?: unknown };
}
interface RecordBody {
  id: string;
  psaNgMl: number | null;
  psaDensity: number | null;
  freeToTotalPsaRatio: number | null;
  encounterDate: string;
}
interface ConsentBody {
  id: string;
  status: string;
  withdrawnAt: string | null;
}

const prisma = new PrismaClient();
const nrc = () =>
  `${String(Math.floor(Math.random() * 900000) + 100000)}/${String(Math.floor(Math.random() * 90) + 10)}/1`;

describe('patients, clinical records and consent (real database)', () => {
  let app: NestExpressApplication;
  let clinicianA: string;
  let clinicianB: string;
  let pathologistA: string;
  let admin: string;
  let patientUser: { id: string; token: string };

  const http = () => request(app.getHttpServer());
  const as = (token: string) => ({ Authorization: `Bearer ${token}` });

  const newPatient = (overrides: Record<string, unknown> = {}) => ({
    givenName: 'SYNTHETIC',
    familyName: `Patient-${randomUUID().slice(0, 6)}`,
    nationalId: nrc(),
    phone: '+260971234567',
    dateOfBirth: '1958-03-14',
    regionClass: 'RURAL',
    ...overrides,
  });

  async function createPatient(
    token: string,
    overrides = {},
  ): Promise<PatientBody> {
    const res = await http()
      .post('/api/v1/patients')
      .set(as(token))
      .send(newPatient(overrides))
      .expect(201);
    return res.body as PatientBody;
  }

  beforeAll(async () => {
    await ensureSeeded(prisma);
    app = await createDbTestApp();
    const facilityA = await createFacility(prisma, 'A');
    const facilityB = await createFacility(prisma, 'B');
    clinicianA = await loginAs(
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
    admin = await loginAs(app, (await createUser(prisma, 'ADMIN', null)).email);
    const p = await createUser(prisma, 'PATIENT', null);
    patientUser = { id: p.id, token: await loginAs(app, p.email) };
  });

  afterAll(async () => {
    await app.close();
    await prisma.$disconnect();
  });

  describe('registration and storage', () => {
    it('registers a patient and returns decrypted names with a masked national ID', async () => {
      const id = nrc();
      const res = await http()
        .post('/api/v1/patients')
        .set(as(clinicianA))
        .send(newPatient({ nationalId: id, familyName: 'Banda' }))
        .expect(201);
      const body = res.body as PatientBody;
      expect(body).toMatchObject({
        givenName: 'SYNTHETIC',
        familyName: 'Banda',
        version: 1,
      });
      expect(body.mrn).toMatch(/^PCA-\d{4}-\d{6}$/);
      expect(body.nationalIdMasked).toMatch(/^\*+\/\d\/1$|^\*+.{4}$/);
      expect(body.nationalIdMasked).not.toContain(id.slice(0, 6));
      expect(body.ageYears).toBeGreaterThanOrEqual(68);
    });

    it('stores identifiers encrypted and never in clear text', async () => {
      const id = nrc();
      const created = await createPatient(clinicianA, {
        nationalId: id,
        familyName: 'Mwale',
      });
      const row = await prisma.patient.findUniqueOrThrow({
        where: { id: created.id },
      });
      const stored = [
        row.givenNameEnc,
        row.familyNameEnc,
        row.nationalIdEnc!,
        row.phoneEnc!,
      ]
        .map((b) => Buffer.from(b).toString('latin1'))
        .join('|');
      for (const clear of ['Mwale', id, '+260971234567'])
        expect(stored).not.toContain(clear);
      expect(row.nationalIdHmac).toMatch(/^[0-9a-f]{64}$/);
    });

    it('rejects a second patient with the same national ID, however it is formatted', async () => {
      const id = nrc();
      await createPatient(clinicianA, { nationalId: id });
      const res = await http()
        .post('/api/v1/patients')
        .set(as(clinicianA))
        .send(newPatient({ nationalId: ` ${id.replace(/\//g, ' / ')} ` }))
        .expect(409);
      expect((res.body as ErrorBody).error.code).toBe('DUPLICATE_PATIENT');
    });

    it.each([
      ['a future date of birth', { dateOfBirth: '2999-01-01' }],
      ['an impossible date', { dateOfBirth: '1960-02-30' }],
      ['markup in a name', { familyName: '<script>x</script>' }],
      ['an unknown region', { regionClass: 'SUBURB' }],
      ['an unexpected field', { isSynthetic: true }],
    ])('rejects %s', async (_label, overrides) => {
      const res = await http()
        .post('/api/v1/patients')
        .set(as(clinicianA))
        .send(newPatient(overrides))
        .expect(400);
      expect((res.body as ErrorBody).error.code).toBe('VALIDATION_FAILED');
    });

    it('is idempotent for offline-created patients (same clientUuid)', async () => {
      const payload = newPatient({ clientUuid: randomUUID() });
      const first = await http()
        .post('/api/v1/patients')
        .set(as(clinicianA))
        .send(payload)
        .expect(201);
      const retry = await http()
        .post('/api/v1/patients')
        .set(as(clinicianA))
        .send(payload)
        .expect(200);
      expect((retry.body as PatientBody).id).toBe(
        (first.body as PatientBody).id,
      );
    });

    it('audits creation without recording identifiers', async () => {
      const id = nrc();
      const created = await createPatient(clinicianA, {
        nationalId: id,
        familyName: 'Phiri',
      });
      const audit = await prisma.auditLog.findFirstOrThrow({
        where: { action: 'patient.created', entityId: created.id },
      });
      const text = JSON.stringify(audit, (_k, v: unknown) =>
        typeof v === 'bigint' ? v.toString() : v,
      );
      expect(text).not.toContain('Phiri');
      expect(text).not.toContain(id);
    });
  });

  describe('access control and facility scoping', () => {
    it('finds a patient by national ID within the facility only', async () => {
      const id = nrc();
      const created = await createPatient(clinicianA, { nationalId: id });
      const found = await http()
        .get('/api/v1/patients')
        .query({ nationalId: id.replace(/\//g, ' / ') })
        .set(as(clinicianA))
        .expect(200);
      expect(
        (found.body as { items: PatientBody[] }).items.map((p) => p.id),
      ).toEqual([created.id]);

      const other = await http()
        .get('/api/v1/patients')
        .query({ nationalId: id })
        .set(as(clinicianB))
        .expect(200);
      expect((other.body as { total: number }).total).toBe(0);
    });

    it('hides patients of other facilities (404, not 403)', async () => {
      const created = await createPatient(clinicianA);
      await http()
        .get(`/api/v1/patients/${created.id}`)
        .set(as(clinicianB))
        .expect(404);
      await http()
        .get(`/api/v1/patients/${created.id}/clinical-records`)
        .set(as(clinicianB))
        .expect(404);
      await http()
        .post(`/api/v1/patients/${created.id}/clinical-records`)
        .set(as(clinicianB))
        .send({ encounterDate: '2026-09-01', dreFinding: 'NORMAL' })
        .expect(404);
    });

    it('lets a pathologist in the same facility read but not register patients', async () => {
      const created = await createPatient(clinicianA);
      await http()
        .get(`/api/v1/patients/${created.id}`)
        .set(as(pathologistA))
        .expect(200);
      await http()
        .post('/api/v1/patients')
        .set(as(pathologistA))
        .send(newPatient())
        .expect(403);
    });

    it('gives administrators and patients no access to other patient records', async () => {
      const created = await createPatient(clinicianA);
      await http().get('/api/v1/patients').set(as(admin)).expect(403);
      await http()
        .get(`/api/v1/patients/${created.id}`)
        .set(as(admin))
        .expect(403);
      await http()
        .get(`/api/v1/patients/${created.id}`)
        .set(as(patientUser.token))
        .expect(403);
      await http()
        .get('/api/v1/patients')
        .set(as(patientUser.token))
        .expect(403);
    });

    it('audits every patient read', async () => {
      const created = await createPatient(clinicianA);
      await http()
        .get(`/api/v1/patients/${created.id}`)
        .set(as(clinicianA))
        .expect(200);
      expect(
        await prisma.auditLog.count({
          where: { action: 'patient.read', entityId: created.id },
        }),
      ).toBe(1);
    });
  });

  describe('updates with optimistic concurrency', () => {
    it('applies an update with the current version and rejects a stale one', async () => {
      const created = await createPatient(clinicianA);
      const ok = await http()
        .patch(`/api/v1/patients/${created.id}`)
        .set(as(clinicianA))
        .send({ version: 1, district: 'Chongwe' })
        .expect(200);
      expect((ok.body as PatientBody).version).toBe(2);

      const stale = await http()
        .patch(`/api/v1/patients/${created.id}`)
        .set(as(clinicianA))
        .send({ version: 1, district: 'Kafue' })
        .expect(409);
      expect((stale.body as ErrorBody).error).toMatchObject({
        code: 'VERSION_CONFLICT',
        details: { currentVersion: 2 },
      });
    });

    it('links a patient app account, which can then read its own record', async () => {
      const created = await createPatient(clinicianA);
      await http()
        .patch(`/api/v1/patients/${created.id}`)
        .set(as(clinicianA))
        .send({ version: 1, accountUserId: patientUser.id })
        .expect(200);
      const me = await http()
        .get('/api/v1/patients/me')
        .set(as(patientUser.token))
        .expect(200);
      expect((me.body as PatientBody).id).toBe(created.id);

      // A clinician account cannot be linked as a patient account.
      const other = await createPatient(clinicianA);
      const clinicianUser = await prisma.user.findFirstOrThrow({
        where: { roles: { some: { role: { name: 'CLINICIAN' } } } },
      });
      await http()
        .patch(`/api/v1/patients/${other.id}`)
        .set(as(clinicianA))
        .send({ version: 1, accountUserId: clinicianUser.id })
        .expect(400);
    });

    it('links like the admin website: the same NRC, never over another link, and the patient is told', async () => {
      // Review 2026-10-02 (M-2): this route had none of these safeguards.
      const idNumber = nrc();
      const reg = await http()
        .post('/api/v1/auth/register')
        .send({
          email: `nrc-${randomUUID().slice(0, 8)}@example.test`,
          password: 'Synthetic-Register-Pass-42',
          displayName: 'SYNTHETIC NRC Patient',
          phone: '+260 97 7654321',
          idDocumentType: 'NRC',
          idNumber,
        })
        .expect(201);
      const accountId = (reg.body as { id: string }).id;
      const link = (patientId: string, version: number, userId: string) =>
        http()
          .patch(`/api/v1/patients/${patientId}`)
          .set(as(clinicianA))
          .send({ version, accountUserId: userId });

      // Another man's record: its NRC differs from the account's.
      const wrong = await createPatient(clinicianA);
      const refused = await link(wrong.id, 1, accountId).expect(400);
      expect((refused.body as ErrorBody).error.code).toBe('NRC_MISMATCH');

      // His own record: linked, audited on its own, and announced to him.
      const own = await createPatient(clinicianA, { nationalId: idNumber });
      await link(own.id, 1, accountId).expect(200);
      const audit = await prisma.auditLog.findFirst({
        where: { action: 'patient_account.linked', entityId: own.id },
      });
      expect(audit?.details).toMatchObject({
        userId: accountId,
        matchedBy: 'NRC',
      });
      const notices = () =>
        prisma.notification.count({
          where: { userId: accountId, type: 'account.linked' },
        });
      expect(await notices()).toBe(1);
      // Saving the same link again sends no second notice.
      await link(own.id, 2, accountId).expect(200);
      expect(await notices()).toBe(1);

      // The record keeps its account: another one cannot take it over.
      const other = await createUser(prisma, 'PATIENT', null);
      const taken = await link(own.id, 3, other.id).expect(409);
      expect((taken.body as ErrorBody).error.code).toBe('CONFLICT');
      const record = await prisma.patient.findUniqueOrThrow({
        where: { id: own.id },
      });
      expect(record.userId).toBe(accountId);
    });
  });

  describe('clinical records', () => {
    const record = (overrides: Record<string, unknown> = {}) => ({
      encounterDate: '2026-09-20',
      psaNgMl: 8.4,
      freePsaNgMl: 1.2,
      dreFinding: 'NODULAR',
      piradsScore: 4,
      prostateVolumeMl: 42,
      biopsyHistory: 'NONE',
      symptoms: { nocturia: true, weakStream: true },
      notes: 'SYNTHETIC: firm nodule on the left lobe.',
      ...overrides,
    });

    it('records PSA/DRE/PI-RADS and derives PSA density and free/total ratio', async () => {
      const patient = await createPatient(clinicianA);
      const res = await http()
        .post(`/api/v1/patients/${patient.id}/clinical-records`)
        .set(as(clinicianA))
        .send(record())
        .expect(201);
      const body = res.body as RecordBody;
      expect(body.psaNgMl).toBe(8.4);
      expect(body.psaDensity).toBe(0.2);
      expect(body.freeToTotalPsaRatio).toBe(0.143);
      await http()
        .get(`/api/v1/clinical-records/${body.id}`)
        .set(as(clinicianA))
        .expect(200);
      await http()
        .get(`/api/v1/clinical-records/${body.id}`)
        .set(as(clinicianB))
        .expect(404);
    });

    it.each([
      ['free PSA above total PSA', { psaNgMl: 2, freePsaNgMl: 3 }],
      ['a negative PSA', { psaNgMl: -1 }],
      ['PI-RADS 6', { piradsScore: 6 }],
      ['a non-integer PI-RADS', { piradsScore: 3.5 }],
      ['a future encounter', { encounterDate: '2999-01-01' }],
      ['an unknown DRE finding', { dreFinding: 'ODD' }],
      ['markup in notes', { notes: '<img src=x onerror=alert(1)>' }],
      ['an unknown symptom', { symptoms: { telepathy: true } }],
    ])('rejects %s', async (_label, overrides) => {
      const patient = await createPatient(clinicianA);
      const res = await http()
        .post(`/api/v1/patients/${patient.id}/clinical-records`)
        .set(as(clinicianA))
        .send(record(overrides))
        .expect(400);
      expect((res.body as ErrorBody).error.code).toBe('VALIDATION_FAILED');
    });

    it('is idempotent on clientUuid and lists history newest first', async () => {
      const patient = await createPatient(clinicianA);
      const clientUuid = randomUUID();
      const url = `/api/v1/patients/${patient.id}/clinical-records`;
      const first = await http()
        .post(url)
        .set(as(clinicianA))
        .send(record({ clientUuid, encounterDate: '2026-01-10' }))
        .expect(201);
      const retry = await http()
        .post(url)
        .set(as(clinicianA))
        .send(record({ clientUuid, encounterDate: '2026-01-10' }))
        .expect(200);
      expect((retry.body as RecordBody).id).toBe((first.body as RecordBody).id);
      await http()
        .post(url)
        .set(as(clinicianA))
        .send(record({ encounterDate: '2026-06-01' }))
        .expect(201);

      const history = await http().get(url).set(as(clinicianA)).expect(200);
      expect(
        (history.body as RecordBody[]).map((r) => r.encounterDate),
      ).toEqual(['2026-06-01', '2026-01-10']);
    });

    it('does not let a pathologist create clinical records', async () => {
      const patient = await createPatient(clinicianA);
      await http()
        .post(`/api/v1/patients/${patient.id}/clinical-records`)
        .set(as(pathologistA))
        .send(record())
        .expect(403);
    });
  });

  describe('consent', () => {
    const grant = {
      type: 'AI_ANALYSIS',
      method: 'WRITTEN',
      consentTextVersion: 'consent-v1.0-en',
    };

    it('grants, lists and withdraws consent, and a second withdrawal is refused', async () => {
      const patient = await createPatient(clinicianA);
      const granted = (
        await http()
          .post(`/api/v1/patients/${patient.id}/consents`)
          .set(as(clinicianA))
          .send(grant)
          .expect(201)
      ).body as ConsentBody;
      expect(granted.status).toBe('GRANTED');

      const list = await http()
        .get(`/api/v1/patients/${patient.id}/consents`)
        .set(as(clinicianA))
        .expect(200);
      expect((list.body as ConsentBody[]).map((c) => c.id)).toEqual([
        granted.id,
      ]);

      const url = `/api/v1/patients/${patient.id}/consents/${granted.id}/withdraw`;
      const withdrawn = (await http().post(url).set(as(clinicianA)).expect(200))
        .body as ConsentBody;
      expect(withdrawn.status).toBe('WITHDRAWN');
      expect(withdrawn.withdrawnAt).not.toBeNull();
      expect(
        (
          (await http().post(url).set(as(clinicianA)).expect(409))
            .body as ErrorBody
        ).error.code,
      ).toBe('ALREADY_WITHDRAWN');
      expect(
        await prisma.auditLog.count({
          where: { action: 'consent.withdrawn', entityId: granted.id },
        }),
      ).toBe(1);
    });

    it('lets a patient see and withdraw their own consent, but not anyone else’s', async () => {
      const own = await prisma.patient.findUniqueOrThrow({
        where: { userId: patientUser.id },
      });
      const granted = (
        await http()
          .post(`/api/v1/patients/${own.id}/consents`)
          .set(as(clinicianA))
          .send(grant)
          .expect(201)
      ).body as ConsentBody;

      const mine = await http()
        .get('/api/v1/patients/me/consents')
        .set(as(patientUser.token))
        .expect(200);
      expect(
        (mine.body as ConsentBody[]).some((c) => c.id === granted.id),
      ).toBe(true);
      await http()
        .post(`/api/v1/patients/me/consents/${granted.id}/withdraw`)
        .set(as(patientUser.token))
        .expect(200);

      const someoneElse = await createPatient(clinicianA);
      const theirs = (
        await http()
          .post(`/api/v1/patients/${someoneElse.id}/consents`)
          .set(as(clinicianA))
          .send(grant)
          .expect(201)
      ).body as ConsentBody;
      await http()
        .post(`/api/v1/patients/me/consents/${theirs.id}/withdraw`)
        .set(as(patientUser.token))
        .expect(404);
    });

    it('refuses consent management from other facilities and from patients', async () => {
      const patient = await createPatient(clinicianA);
      await http()
        .post(`/api/v1/patients/${patient.id}/consents`)
        .set(as(clinicianB))
        .send(grant)
        .expect(404);
      await http()
        .post(`/api/v1/patients/${patient.id}/consents`)
        .set(as(patientUser.token))
        .send(grant)
        .expect(403);
    });
  });
});
