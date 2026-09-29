import { randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { PrismaClient } from '@prisma/client';
import request from 'supertest';
import { FieldCrypto } from '../../src/persistence/crypto/field-crypto';
import { exportId } from '../../src/services/fhir/deidentify';
import {
  SYNTHETIC_DICOM_IDENTIFIERS,
  makeNotAnImage,
  makeSyntheticDicom,
  makeSyntheticTiff,
} from '../fixtures/synthetic-files';
import {
  TEST_PASSWORD,
  createFacility,
  createUser,
  ensureSeeded,
} from '../db/helpers';
import { removeRunFolder, startLiveStack, type LiveStack } from './live-stack';

/*
 * Phase 16: the six main workflows of the proposal's use cases, end to end,
 * against the real system: the built backend as its own process in
 * production mode, the Python AI service, PostgreSQL, MongoDB and a SmartCare
 * Pro stand-in over HTTPS. Each workflow includes its failure paths. The
 * last block reviews the logs of the whole run for secrets and patient data.
 * All data is SYNTHETIC.
 */

const prisma = new PrismaClient();
const MOCK_DISCLAIMER = 'DEVELOPMENT MOCK DATA — NOT A CLINICAL RESULT.';
const REGISTER_PASSWORD = 'e2e-patient-passphrase-7';

interface ErrorBody {
  error: { code: string; message: string };
}

let stack: LiveStack;
/** Every secret and identifier used in the run, for the log review. */
const sensitive = new Set<string>();
const note = (...values: string[]) => values.forEach((v) => sensitive.add(v));

const api = () => request(stack.baseUrl);
const as = (token: string) => ({ Authorization: `Bearer ${token}` });
const letters = (n: number) =>
  Array.from({ length: n }, () =>
    String.fromCharCode(97 + Math.floor(Math.random() * 26)),
  ).join('');
const nrc = () =>
  `${100000 + Math.floor(Math.random() * 899999)}/${10 + Math.floor(Math.random() * 89)}/1`;

async function login(email: string, password = TEST_PASSWORD): Promise<string> {
  const res = await api()
    .post('/api/v1/auth/login')
    .send({ email, password })
    .expect(200);
  const body = res.body as { accessToken: string; refreshToken?: string };
  note(body.accessToken, ...(body.refreshToken ? [body.refreshToken] : []));
  return body.accessToken;
}

async function waitForJob(
  token: string,
  jobId: string,
): Promise<Record<string, unknown>> {
  for (let i = 0; i < 150; i++) {
    const res = await api()
      .get(`/api/v1/ai-jobs/${jobId}`)
      .set(as(token))
      .expect(200);
    const job = res.body as { status: string };
    if (!['QUEUED', 'RUNNING'].includes(job.status)) {
      return res.body as Record<string, unknown>;
    }
    await new Promise((r) => setTimeout(r, 200));
  }
  throw new Error('The AI job did not finish in 30 seconds');
}

describe('the whole system, end to end (Phase 16)', () => {
  let facility: string;
  let otherFacility: string;
  let admin: { id: string; email: string };
  let adminToken: string;
  let clinicianToken: string;
  let otherClinicianToken: string;
  let pathologistToken: string;
  const tag = letters(7);

  beforeAll(async () => {
    await ensureSeeded(prisma);
    stack = await startLiveStack();
    note(
      stack.secrets.aiToken,
      stack.secrets.smartcareToken,
      TEST_PASSWORD,
      REGISTER_PASSWORD,
    );
    facility = await createFacility(prisma, `E2E${tag}`);
    otherFacility = await createFacility(prisma, `E2EB${tag}`);
    admin = await createUser(prisma, 'ADMIN', null);
    const clinician = await createUser(prisma, 'CLINICIAN', facility);
    const other = await createUser(prisma, 'CLINICIAN', otherFacility);
    const pathologist = await createUser(prisma, 'PATHOLOGIST', facility);
    adminToken = await login(admin.email);
    clinicianToken = await login(clinician.email);
    otherClinicianToken = await login(other.email);
    pathologistToken = await login(pathologist.email);
  }, 240_000);

  afterAll(async () => {
    await stack?.stop();
    if (stack) removeRunFolder(stack.backendLog);
    await prisma.$disconnect();
  });

  // Shared between workflows 1 and 5: a patient with an app account.
  const w1 = {
    email: `e2e-patient-${tag}@example.test`,
    nationalId: nrc(),
    phone: '+260 97 7654321',
    familyName: `Walker${tag}`,
    userId: '',
    patientId: '',
    token: '',
  };
  // Shared between workflows 3, 4 and 6: a patient with scans and a slide.
  const w3 = {
    familyName: `Scanner${tag}`,
    nationalId: nrc(),
    patientId: '',
    jobId: '',
  };

  describe('1. A patient signs up and is given access to their own record (UC-01, UC-09)', () => {
    it('signs up, is linked by NRC, and then sees only their own data', async () => {
      note(w1.email, w1.nationalId, w1.phone, w1.familyName);
      const reg = await api()
        .post('/api/v1/auth/register')
        .send({
          email: w1.email,
          password: REGISTER_PASSWORD,
          displayName: 'SYNTHETIC E2E Patient',
          phone: w1.phone,
          idDocumentType: 'NRC',
          idNumber: w1.nationalId,
        })
        .expect(201);
      w1.userId = (reg.body as { id: string }).id;
      w1.token = await login(w1.email, REGISTER_PASSWORD);
      // Not linked yet.
      await api().get('/api/v1/patients/me').set(as(w1.token)).expect(404);

      const created = await api()
        .post('/api/v1/patients')
        .set(as(clinicianToken))
        .send({
          givenName: 'SYNTHETIC',
          familyName: w1.familyName,
          nationalId: w1.nationalId,
          phone: w1.phone,
          dateOfBirth: '1957-04-09',
          regionClass: 'RURAL',
        })
        .expect(201);
      // Record ids are random and appear in request paths by design (they
      // are needed to trace a request and reveal nothing on their own), so
      // they are not on the log review's list; names, NRCs, phones, notes,
      // passwords and tokens are.
      w1.patientId = (created.body as { id: string }).id;
      await api()
        .post(`/api/v1/patients/${w1.patientId}/clinical-records`)
        .set(as(clinicianToken))
        .send({
          encounterDate: '2026-09-20',
          psaNgMl: 5.6,
          dreFinding: 'NORMAL',
          notes: `SYNTHETIC note ${tag}: lives near the clinic.`,
        })
        .expect(201);
      note(`SYNTHETIC note ${tag}`);

      const match = await api()
        .post(`/api/v1/admin/patient-accounts/${w1.userId}/match`)
        .set(as(adminToken))
        .expect(200);
      expect((match.body as { patientId: string }).patientId).toBe(
        w1.patientId,
      );
      await api()
        .post(`/api/v1/admin/patient-accounts/${w1.userId}/link`)
        .set(as(adminToken))
        .expect(200);

      const me = await api()
        .get('/api/v1/patients/me')
        .set(as(w1.token))
        .expect(200);
      expect((me.body as { familyName: string }).familyName).toBe(
        w1.familyName,
      );
      const records = await api()
        .get('/api/v1/patients/me/clinical-records')
        .set(as(w1.token))
        .expect(200);
      expect((records.body as { psaNgMl: number }[])[0].psaNgMl).toBe(5.6);
      const inbox = await api()
        .get('/api/v1/notifications')
        .set(as(w1.token))
        .expect(200);
      expect((inbox.body as { items: unknown[] }).items.length).toBeGreaterThan(
        0,
      );
    });

    it('refuses a taken email, clinical and admin areas, and locks after 5 wrong passwords', async () => {
      await api()
        .post('/api/v1/auth/register')
        .send({
          email: w1.email,
          password: REGISTER_PASSWORD,
          displayName: 'SYNTHETIC Duplicate',
          phone: '+260 97 1112223',
          idDocumentType: 'NRC',
          idNumber: nrc(),
        })
        .expect(409);
      await api().get('/api/v1/patients').set(as(w1.token)).expect(403);
      await api().get('/api/v1/admin/audit-logs').set(as(w1.token)).expect(403);

      const victim = await createUser(prisma, 'CLINICIAN', facility);
      for (let i = 0; i < 5; i++) {
        await api()
          .post('/api/v1/auth/login')
          .send({ email: victim.email, password: 'wrong-password-123456' })
          .expect(401);
      }
      const locked = await api()
        .post('/api/v1/auth/login')
        .send({ email: victim.email, password: TEST_PASSWORD })
        .expect(423);
      expect((locked.body as ErrorBody).error.code).toBe('ACCOUNT_LOCKED');
    });
  });

  describe('2. Screening data captured offline syncs exactly once (UC-02, NFR-08)', () => {
    const clientUuid = randomUUID();
    const familyName = `Offline${tag}`;
    const op = (o: Record<string, unknown>) => ({
      idempotencyKey: randomUUID(),
      clientTimestamp: new Date().toISOString(),
      ...o,
    });
    const push = async (
      token: string,
      deviceId: string,
      operations: unknown[],
    ) =>
      (
        (
          await api()
            .post('/api/v1/sync')
            .set(as(token))
            .send({ deviceId, operations })
            .expect(200)
        ).body as {
          results: {
            result: string;
            entityId?: string;
            version?: number;
            replayed: boolean;
            server?: { familyName: string };
          }[];
        }
      ).results;
    let batch: unknown[];

    it('applies a batch, and a repeated batch changes nothing', async () => {
      note(familyName);
      batch = [
        op({
          entityType: 'patient',
          operation: 'CREATE',
          payload: {
            clientUuid,
            givenName: 'SYNTHETIC',
            familyName,
            dateOfBirth: '1962-02-02',
            regionClass: 'URBAN',
          },
        }),
        op({
          entityType: 'clinical_record',
          operation: 'CREATE',
          patientId: clientUuid,
          payload: {
            clientUuid: randomUUID(),
            encounterDate: '2026-09-21',
            psaNgMl: 7.1,
            dreFinding: 'ENLARGED_SMOOTH',
          },
        }),
      ];
      const first = await push(clinicianToken, 'e2e-device-a', batch);
      expect(first.map((r) => r.result)).toEqual(['APPLIED', 'APPLIED']);
      const again = await push(clinicianToken, 'e2e-device-a', batch);
      expect(again.map((r) => [r.result, r.replayed])).toEqual([
        ['APPLIED', true],
        ['APPLIED', true],
      ]);
      expect(again[0].entityId).toBe(first[0].entityId);
      // Exactly one patient and one record exist for the phone's ids (the
      // API has no name search on purpose, so the database is asked).
      expect(await prisma.patient.count({ where: { clientUuid } })).toBe(1);
      expect(
        await prisma.clinicalRecord.count({
          where: { patient: { clientUuid } },
        }),
      ).toBe(1);
    });

    it('never silently overwrites: a stale edit comes back as a conflict', async () => {
      const edit = (name: string) =>
        op({
          entityType: 'patient',
          operation: 'UPDATE',
          entityId: clientUuid,
          baseVersion: 1,
          payload: { familyName: name },
        });
      const [ok] = await push(clinicianToken, 'e2e-device-b', [
        edit(`${familyName}B`),
      ]);
      expect(ok).toMatchObject({ result: 'APPLIED', version: 2 });
      const [late] = await push(clinicianToken, 'e2e-device-a', [
        edit(`${familyName}A`),
      ]);
      expect(late.result).toBe('CONFLICT');
      expect(late.server?.familyName).toBe(`${familyName}B`);
    });

    it('keeps the good part of a partly invalid batch, and shows changes only in the own facility', async () => {
      const results = await push(clinicianToken, 'e2e-device-a', [
        op({
          entityType: 'patient',
          operation: 'CREATE',
          payload: {
            clientUuid: randomUUID(),
            givenName: 'SYNTHETIC',
            familyName: `Partial${tag}`,
            dateOfBirth: '1963-03-03',
            regionClass: 'RURAL',
          },
        }),
        op({
          entityType: 'patient',
          operation: 'CREATE',
          payload: { clientUuid: randomUUID(), givenName: 'SYNTHETIC' },
        }),
      ]);
      expect(results.map((r) => r.result)).toEqual(['APPLIED', 'REJECTED']);

      const changes = await api()
        .get('/api/v1/sync/changes')
        .set(as(clinicianToken))
        .expect(200);
      const names = (
        changes.body as { patients: { familyName: string }[] }
      ).patients.map((p) => p.familyName);
      expect(names).toContain(`${familyName}B`);
      const elsewhere = await api()
        .get('/api/v1/sync/changes')
        .set(as(otherClinicianToken))
        .expect(200);
      expect(JSON.stringify(elsewhere.body)).not.toContain(familyName);
    });
  });

  describe('3. Imaging and AI analysis, with consent and de-identification (UC-03, UC-05, UC-06)', () => {
    it('needs consent, checks every file, and gives the AI only a de-identified copy', async () => {
      note(w3.familyName, w3.nationalId);
      const created = await api()
        .post('/api/v1/patients')
        .set(as(clinicianToken))
        .send({
          givenName: 'SYNTHETIC',
          familyName: w3.familyName,
          nationalId: w3.nationalId,
          dateOfBirth: '1955-06-06',
          regionClass: 'PERI_URBAN',
        })
        .expect(201);
      w3.patientId = (created.body as { id: string }).id;
      await api()
        .post(`/api/v1/patients/${w3.patientId}/clinical-records`)
        .set(as(clinicianToken))
        .send({
          encounterDate: '2026-09-22',
          psaNgMl: 9.8,
          dreFinding: 'NODULAR',
          piradsScore: 4,
        })
        .expect(201);

      const noConsent = await api()
        .post(`/api/v1/patients/${w3.patientId}/ai-jobs`)
        .set(as(clinicianToken))
        .expect(409);
      expect((noConsent.body as ErrorBody).error.code).toBe('CONSENT_REQUIRED');
      await api()
        .post(`/api/v1/patients/${w3.patientId}/consents`)
        .set(as(clinicianToken))
        .send({
          type: 'AI_ANALYSIS',
          method: 'WRITTEN',
          consentTextVersion: 'v1',
        })
        .expect(201);

      const upload = (file: Buffer, name: string, modality: string) =>
        api()
          .post(`/api/v1/patients/${w3.patientId}/imaging`)
          .set(as(clinicianToken))
          .field('modality', modality)
          .attach('file', file, name);
      await upload(makeNotAnImage(), 'x.dcm', 'MRI').expect(415);
      await upload(makeSyntheticDicom('CT'), 'ct.dcm', 'MRI').expect(422);
      const mri = await upload(
        makeSyntheticDicom('MR', { identifiers: true }),
        'mri.dcm',
        'MRI',
      ).expect(201);
      expect(mri.body).toMatchObject({ aiReady: true });

      const row = await prisma.imagingStudy.findUniqueOrThrow({
        where: { id: (mri.body as { id: string }).id },
      });
      const copy = readFileSync(
        path.join(stack.storageRoot, row.deidStorageKey!),
      );
      for (const value of Object.values(SYNTHETIC_DICOM_IDENTIFIERS)) {
        expect(copy.toString('latin1')).not.toContain(value);
      }
    });

    it('runs the analysis through the real AI service and labels the result as mock', async () => {
      const queued = await api()
        .post(`/api/v1/patients/${w3.patientId}/ai-jobs`)
        .set(as(clinicianToken))
        .expect(202);
      w3.jobId = (queued.body as { id: string }).id;
      const job = await waitForJob(clinicianToken, w3.jobId);
      expect(job.status).toBe('SUCCEEDED');
      const report = job.report as {
        isMock: boolean;
        disclaimer: string;
        explanations: {
          available: boolean;
          unavailableReason: string | null;
        }[];
        inputNotes: string[];
        outputs: { modulesUsed: string[] };
      };
      expect(report.isMock).toBe(true);
      expect(report.disclaimer).toBe(MOCK_DISCLAIMER);
      expect(report.outputs.modulesUsed.length).toBeGreaterThan(0);
      expect(report.inputNotes).toEqual([]);
      for (const e of report.explanations) {
        expect(e.available).toBe(false);
        expect(e.unavailableReason).toBeTruthy();
      }
      const models = await api()
        .get('/api/v1/ai/models')
        .set(as(clinicianToken))
        .expect(200);
      const list = models.body as {
        id: string;
        evaluationAvailable: boolean;
      }[];
      expect(list.every((m) => !m.evaluationAvailable)).toBe(true);
      const evaluation = await api()
        .get(`/api/v1/ai/models/${list[0].id}/evaluation`)
        .set(as(clinicianToken))
        .expect(200);
      expect(JSON.stringify(evaluation.body)).toContain(
        'Evaluation data not yet available',
      );
    });

    it('keeps another facility out', async () => {
      await api()
        .get(`/api/v1/ai-jobs/${w3.jobId}`)
        .set(as(otherClinicianToken))
        .expect(404);
      await api()
        .get(`/api/v1/patients/${w3.patientId}`)
        .set(as(otherClinicianToken))
        .expect(404);
    });
  });

  describe('4. A pathologist reviews a slide (UC-04)', () => {
    it('uploads, reviews once, and the grade group comes from the server', async () => {
      const upload = await api()
        .post(`/api/v1/patients/${w3.patientId}/histopathology`)
        .set(as(pathologistToken))
        .field('format', 'TIFF')
        .attach('file', makeSyntheticTiff(), 'slide.tif')
        .expect(201);
      const slideId = (upload.body as { id: string }).id;
      const queue = await api()
        .get('/api/v1/histopathology/review-queue')
        .set(as(pathologistToken))
        .expect(200);
      expect((queue.body as { id: string }[]).map((s) => s.id)).toContain(
        slideId,
      );

      await api()
        .post(`/api/v1/histopathology/${slideId}/review`)
        .set(as(clinicianToken))
        .send({ gleasonPrimary: 4, gleasonSecondary: 3 })
        .expect(403);
      const reviewed = await api()
        .post(`/api/v1/histopathology/${slideId}/review`)
        .set(as(pathologistToken))
        .send({ gleasonPrimary: 4, gleasonSecondary: 3 })
        .expect(200);
      expect(reviewed.body).toMatchObject({ isupGradeGroup: 3 });
      const twice = await api()
        .post(`/api/v1/histopathology/${slideId}/review`)
        .set(as(pathologistToken))
        .send({ gleasonPrimary: 3, gleasonSecondary: 3 })
        .expect(409);
      expect((twice.body as ErrorBody).error.code).toBe('ALREADY_REVIEWED');
    });

    it('holds the slide back from the AI and says why', async () => {
      const queued = await api()
        .post(`/api/v1/patients/${w3.patientId}/ai-jobs`)
        .set(as(clinicianToken))
        .expect(202);
      const job = await waitForJob(
        clinicianToken,
        (queued.body as { id: string }).id,
      );
      expect((job.report as { inputNotes: string[] }).inputNotes).toEqual([
        expect.stringContaining('1 slide was not sent') as string,
      ]);
    });
  });

  describe('5. A patient withdraws consent and the system respects it (proposal §3.7.1)', () => {
    it('withdrawing AI consent stops AI requests; withdrawing research consent stops exports', async () => {
      for (const type of ['AI_ANALYSIS', 'RESEARCH_USE']) {
        await api()
          .post(`/api/v1/patients/${w1.patientId}/consents`)
          .set(as(clinicianToken))
          .send({ type, method: 'DIGITAL', consentTextVersion: 'v1' })
          .expect(201);
      }
      const crypto = FieldCrypto.fromEnv(process.env);
      const pseudonym = exportId(crypto, 'Patient', w1.patientId);
      const exported = async () =>
        JSON.stringify(
          (
            await api()
              .post('/api/v1/fhir/export')
              .set(as(adminToken))
              .send({ purpose: 'RESEARCH', facilityId: facility })
              .buffer(true)
              .parse((res, cb) => {
                let data = '';
                res.setEncoding('utf8');
                res.on('data', (c: string) => (data += c));
                res.on('end', () => cb(null, data));
              })
              .expect(200)
          ).body,
        );
      expect(await exported()).toContain(pseudonym);

      const mine = await api()
        .get('/api/v1/patients/me/consents')
        .set(as(w1.token))
        .expect(200);
      const consents = mine.body as {
        id: string;
        type: string;
        status: string;
      }[];
      for (const type of ['AI_ANALYSIS', 'RESEARCH_USE']) {
        const c = consents.find(
          (x) => x.type === type && x.status === 'GRANTED',
        )!;
        await api()
          .post(`/api/v1/patients/me/consents/${c.id}/withdraw`)
          .set(as(w1.token))
          .expect(200);
      }
      const refused = await api()
        .post(`/api/v1/patients/${w1.patientId}/ai-jobs`)
        .set(as(clinicianToken))
        .expect(409);
      expect((refused.body as ErrorBody).error.code).toBe('CONSENT_REQUIRED');
      expect(await exported()).not.toContain(pseudonym);
    });
  });

  describe('6. National EHR export to SmartCare Pro (UC-08)', () => {
    it('sends only consented, de-identified data over HTTPS with the token, and it is all in the audit log', async () => {
      await api()
        .post(`/api/v1/patients/${w3.patientId}/consents`)
        .set(as(clinicianToken))
        .send({
          type: 'EHR_SHARING',
          method: 'WRITTEN',
          consentTextVersion: 'v1',
        })
        .expect(201);
      await api()
        .get('/api/v1/fhir/export/summary?purpose=NATIONAL_EHR')
        .set(as(clinicianToken))
        .expect(403);
      const summary = await api()
        .get(
          `/api/v1/fhir/export/summary?purpose=NATIONAL_EHR&facilityId=${facility}`,
        )
        .set(as(adminToken))
        .expect(200);
      expect(summary.body).toMatchObject({
        smartcareConfigured: true,
        willExport: { patients: 1 },
      });

      const pushed = await api()
        .post('/api/v1/fhir/export/push')
        .set(as(adminToken))
        .send({ facilityId: facility })
        .expect(200);
      expect(pushed.body).toMatchObject({
        status: 'SENT',
        receiverId: 'e2e-received',
      });
      const got = stack.smartcare.received.at(-1)!;
      expect(got.authorization).toBe(`Bearer ${stack.secrets.smartcareToken}`);
      for (const value of [w3.familyName, w3.nationalId, w3.patientId]) {
        expect(got.body).not.toContain(value);
      }
      expect(got.body).toContain('"PUBHLTH"');

      const logs = await api()
        .get('/api/v1/admin/audit-logs?action=fhir.')
        .set(as(adminToken))
        .expect(200);
      const actions = (logs.body as { items: { action: string }[] }).items.map(
        (e) => e.action,
      );
      expect(actions).toEqual(
        expect.arrayContaining(['fhir.export', 'fhir.push']),
      );
      const chain = await api()
        .get('/api/v1/admin/audit-logs/verify')
        .set(as(adminToken))
        .expect(200);
      expect(chain.body).toMatchObject({ intact: true });
    });
  });

  describe('7. Patients and clinicians ask the assistant (UC-07, Phase 13)', () => {
    interface Asked {
      answer: {
        text: string;
        safety: string;
        mode: string;
        sources: { name: string }[];
        reviewStatus?: string;
      };
    }
    const start = async (token: string) =>
      (
        (
          await api()
            .post('/api/v1/chat/conversations')
            .set(as(token))
            .send({ language: 'en' })
            .expect(201)
        ).body as { id: string }
      ).id;
    const askIt = async (token: string, id: string, text: string) => {
      note(text);
      return (
        (
          await api()
            .post(`/api/v1/chat/conversations/${id}/messages`)
            .set(as(token))
            .send({ text })
            .expect(200)
        ).body as Asked
      ).answer;
    };

    it('answers from the reviewed knowledge base through the real AI service, and keeps its safety rules', async () => {
      const mine = await start(w1.token);
      const psa = await askIt(
        w1.token,
        mine,
        `What does a PSA test measure? (SYNTHETIC ${tag})`,
      );
      expect(psa).toMatchObject({ safety: 'OK', mode: 'EXTRACTIVE' });
      expect(psa.text).toContain('PSA');
      expect(psa.sources.map((x) => x.name).join()).toContain('NHS');
      expect(psa.reviewStatus).toContain('Draft for review');
      // Clinician content is not for patients.
      expect(
        (await askIt(w1.token, mine, `What is grade group 3? ${tag}`)).safety,
      ).toBe('NO_SOURCE');
      expect(
        (await askIt(w1.token, mine, `Is my PSA bad? ${tag}`)).safety,
      ).toBe('DECLINED');
      expect(
        (await askIt(w1.token, mine, `I cannot pass urine at all ${tag}`))
          .safety,
      ).toBe('URGENT_CARE');

      const theirs = await start(clinicianToken);
      const pirads = await askIt(
        clinicianToken,
        theirs,
        `What does PI-RADS 4 mean? ${tag}`,
      );
      expect(pirads.text).toContain('PI-RADS 4: high');
      expect(pirads.sources[0].name).toContain('Turkbey');
      // A pathologist has no assistant.
      await api()
        .post('/api/v1/chat/conversations')
        .set(as(pathologistToken))
        .send({})
        .expect(403);
    });
  });

  describe('Log review (Phase 15): the logs of the whole run', () => {
    it('hold no password, token or patient detail', async () => {
      await stack.stop();
      const backend = readFileSync(stack.backendLog, 'utf8');
      const ai = readFileSync(stack.aiLog, 'utf8');
      // The logs are real: the backend logged every request as JSON.
      expect(backend).toMatch(/"statusCode":20[0-9]/);
      expect(backend).toContain('/api/v1/fhir/export/push');
      const leaks = [...sensitive].filter(
        (v) => v.length >= 6 && (backend.includes(v) || ai.includes(v)),
      );
      expect(leaks).toEqual([]);
    });
  });
});
