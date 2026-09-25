import { randomUUID } from 'node:crypto';
import {
  createServer,
  type IncomingMessage,
  type Server,
  type ServerResponse,
} from 'node:http';
import type { AddressInfo } from 'node:net';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { PrismaClient } from '@prisma/client';
import request from 'supertest';
import { createMongoClient } from '../../src/infrastructure/mongo/client';
import { AiService } from '../../src/modules/ai/ai.service';
import { makeSyntheticDicom } from '../fixtures/synthetic-files';
import {
  createDbTestApp,
  createFacility,
  createUser,
  ensureSeeded,
  loginAs,
} from './helpers';

const prisma = new PrismaClient();
const TOKEN = 'integration-ai-service-token';
const MOCK_DISCLAIMER = 'DEVELOPMENT MOCK DATA — NOT A CLINICAL RESULT.';

interface ErrorBody {
  error: { code: string; message: string };
}
interface JobBody {
  id: string;
  status: string;
  error: string | null;
  report: null | {
    provenance: string;
    isMock: boolean;
    disclaimer: string;
    modelVersions: Record<string, string>;
    outputs: {
      pcaProbability: number | null;
      gleasonGradeGroup: number | null;
      modulesUsed: string[];
      modulesSkipped: { module: string; reason: string }[];
    };
    explanations: unknown[];
  };
}
interface Received {
  authorization?: string;
  body: {
    jobId: string;
    patientRef: string;
    inputs: {
      clinical: Record<string, unknown>;
      imaging: { storageKey: string; modality: string }[];
    };
  };
}

/** Stands in for ai-services; each test decides how it answers. */
type Behaviour =
  'mock' | 'unlabelled' | 'insufficient' | { delayMs: number; then: 'mock' };

const mockResult = (jobId: string) => ({
  jobId,
  provenance: 'MOCK',
  disclaimer: MOCK_DISCLAIMER,
  modelVersions: { ann_clinical: 'mock-0.1', xgboost_fusion: 'mock-0.1' },
  outputs: {
    pcaProbability: 0.42,
    probabilityInterval: [0.32, 0.52],
    gleasonGradeGroup: null,
    segmentationMaskKey: null,
    modulesUsed: ['ann_clinical', 'xgboost_fusion'],
    modulesSkipped: [
      { module: 'patch_cnn_mil_histopathology', reason: 'No slide' },
    ],
  },
  explanations: [],
});

const nrc = () =>
  `${String(Math.floor(Math.random() * 900000) + 100000)}/${String(Math.floor(Math.random() * 90) + 10)}/1`;

describe('AI analysis jobs through the broker (real database, fake AI service)', () => {
  let fakeAi: Server;
  let behaviour: Behaviour = 'mock';
  const received: Received[] = [];
  const apps: NestExpressApplication[] = [];
  let app: NestExpressApplication;
  let clinician: string;
  let otherClinician: string;
  let patientRole: string;
  let facility: string;
  const as = (token: string) => ({ Authorization: `Bearer ${token}` });
  const http = () => request(app.getHttpServer());
  const idle = () => app.get(AiService).idle();

  async function newPatient(opts: { consent: boolean; record: boolean }) {
    const res = await http()
      .post('/api/v1/patients')
      .set(as(clinician))
      .send({
        givenName: 'SYNTHETIC',
        familyName: `Ai-${randomUUID().slice(0, 6)}`,
        nationalId: nrc(),
        phone: '+260971234567',
        dateOfBirth: '1960-01-15',
        regionClass: 'RURAL',
      })
      .expect(201);
    const id = (res.body as { id: string }).id;
    if (opts.record) {
      await http()
        .post(`/api/v1/patients/${id}/clinical-records`)
        .set(as(clinician))
        .send({
          encounterDate: '2026-09-01',
          psaNgMl: 6.4,
          dreFinding: 'NORMAL',
          piradsScore: 3,
        })
        .expect(201);
    }
    if (opts.consent) {
      await http()
        .post(`/api/v1/patients/${id}/consents`)
        .set(as(clinician))
        .send({
          type: 'AI_ANALYSIS',
          method: 'WRITTEN',
          consentTextVersion: 'v1',
        })
        .expect(201);
    }
    return id;
  }

  const requestJob = (patientId: string, token = clinician) =>
    http().post(`/api/v1/patients/${patientId}/ai-jobs`).set(as(token));

  const getJob = async (jobId: string) =>
    (
      await http()
        .get(`/api/v1/ai-jobs/${jobId}`)
        .set(as(clinician))
        .expect(200)
    ).body as JobBody;

  beforeAll(async () => {
    fakeAi = createServer((req: IncomingMessage, res: ServerResponse) => {
      const chunks: Buffer[] = [];
      req.on('data', (c: Buffer) => chunks.push(c));
      req.on('end', () => {
        const send = (status: number, body: unknown) => {
          res.writeHead(status, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify(body));
        };
        if (req.url === '/v1/health') return send(200, { status: 'ok' });
        if (req.headers.authorization !== `Bearer ${TOKEN}`) {
          return send(401, { detail: 'Invalid service token' });
        }
        if (req.url === '/v1/models') {
          return send(200, [
            {
              name: 'ann_clinical',
              architecture: 'ANN',
              version: 'mock-0.1',
              provenance: 'MOCK',
              evaluation: null,
            },
          ]);
        }
        const body = JSON.parse(
          Buffer.concat(chunks).toString(),
        ) as Received['body'];
        received.push({ authorization: req.headers.authorization, body });
        const current = behaviour;
        if (current === 'insufficient') {
          return send(422, { detail: { message: 'No module could run' } });
        }
        if (current === 'unlabelled') {
          return send(200, {
            ...mockResult(body.jobId),
            disclaimer: 'Everything looks fine, no need to worry.',
          });
        }
        if (typeof current === 'object') {
          setTimeout(() => send(200, mockResult(body.jobId)), current.delayMs);
          return;
        }
        return send(200, mockResult(body.jobId));
      });
    });
    await new Promise<void>((resolve) =>
      fakeAi.listen(0, '127.0.0.1', resolve),
    );
    const { port } = fakeAi.address() as AddressInfo;

    await ensureSeeded(prisma);
    app = await createDbTestApp({
      AI_SERVICE_URL: `http://127.0.0.1:${port}`,
      AI_SERVICE_TOKEN: TOKEN,
      AI_TIMEOUT_MS: '1000',
    });
    apps.push(app);
    facility = await createFacility(prisma, 'AI');
    clinician = await loginAs(
      app,
      (await createUser(prisma, 'CLINICIAN', facility)).email,
    );
    otherClinician = await loginAs(
      app,
      (
        await createUser(
          prisma,
          'CLINICIAN',
          await createFacility(prisma, 'AI2'),
        )
      ).email,
    );
    patientRole = await loginAs(
      app,
      (await createUser(prisma, 'PATIENT', null)).email,
    );
  });

  afterAll(async () => {
    for (const a of apps) await a.close();
    await new Promise((resolve) => fakeAi.close(resolve));
    await prisma.$disconnect();
  });

  beforeEach(() => {
    behaviour = 'mock';
  });

  it('needs AI consent and a screening record before anything is sent', async () => {
    const noConsent = await newPatient({ consent: false, record: true });
    const r1 = await requestJob(noConsent).expect(409);
    expect((r1.body as ErrorBody).error.code).toBe('CONSENT_REQUIRED');

    const noRecord = await newPatient({ consent: true, record: false });
    const r2 = await requestJob(noRecord).expect(409);
    expect((r2.body as ErrorBody).error.code).toBe('CLINICAL_RECORD_REQUIRED');
    expect(received).toHaveLength(0);
  });

  it('queues a job, sends only de-identified data, and stores the labelled report', async () => {
    const patientId = await newPatient({ consent: true, record: true });
    await http()
      .post(`/api/v1/patients/${patientId}/imaging`)
      .set(as(clinician))
      .field('modality', 'MRI')
      .attach('file', makeSyntheticDicom('MR'), 'scan.dcm')
      .expect(201);

    const queued = await requestJob(patientId).expect(202);
    expect((queued.body as JobBody).status).toBe('QUEUED');
    await idle();

    const sent = received.at(-1)!;
    expect(sent.authorization).toBe(`Bearer ${TOKEN}`);
    expect(sent.body.patientRef).toMatch(/^p_[0-9a-f]{32}$/);
    expect(sent.body.inputs.clinical).toMatchObject({
      ageYears: expect.any(Number) as number,
      psaNgMl: 6.4,
      dreFinding: 'NORMAL',
      piradsScore: 3,
    });
    expect(sent.body.inputs.imaging).toEqual([
      {
        storageKey: expect.stringMatching(/^imaging\//) as string,
        modality: 'MRI',
      },
    ]);
    const raw = JSON.stringify(sent.body);
    expect(raw).not.toContain(patientId);
    expect(raw).not.toContain('SYNTHETIC');
    expect(raw).not.toContain('+260');
    expect(raw).not.toMatch(/\d{6}\/\d{2}\/1/);

    const job = await getJob((queued.body as JobBody).id);
    expect(job.status).toBe('SUCCEEDED');
    expect(job.report).toMatchObject({
      provenance: 'MOCK',
      isMock: true,
      disclaimer: MOCK_DISCLAIMER,
      outputs: {
        pcaProbability: 0.42,
        modulesUsed: ['ann_clinical', 'xgboost_fusion'],
      },
    });

    const mongo = createMongoClient(process.env.MONGO_URL!);
    try {
      const stored = await mongo
        .db()
        .collection('ai_reports')
        .findOne({ jobId: job.id });
      expect(stored?.disclaimer).toBe(MOCK_DISCLAIMER);
      const log = await mongo
        .db()
        .collection('ai_inference_logs')
        .find({ jobId: job.id })
        .toArray();
      expect(log.map((l) => l.event as string)).toEqual([
        'started',
        'succeeded',
      ]);
    } finally {
      await mongo.close();
    }
    const actions = (
      await prisma.auditLog.findMany({ where: { entityId: job.id } })
    ).map((a) => `${a.action}:${a.outcome}`);
    expect(actions).toEqual(
      expect.arrayContaining([
        'ai_job.requested:SUCCESS',
        'ai_job.completed:SUCCESS',
        'ai_report.read:SUCCESS',
      ]),
    );
  });

  it('refuses a second request while one is running', async () => {
    const patientId = await newPatient({ consent: true, record: true });
    const user = await prisma.user.findFirstOrThrow({
      where: { roles: { some: { role: { name: 'CLINICIAN' } } } },
    });
    // A job another request already started (deterministic, no timing).
    const running = await prisma.aiJob.create({
      data: {
        patientId,
        requestedById: user.id,
        status: 'RUNNING',
        startedAt: new Date(),
        inputs: {},
      },
    });
    const again = await requestJob(patientId).expect(409);
    expect((again.body as ErrorBody).error.code).toBe('AI_JOB_IN_PROGRESS');
    await prisma.aiJob.update({
      where: { id: running.id },
      data: { status: 'SUCCEEDED', finishedAt: new Date() },
    });
    // Once finished, a new analysis may be requested.
    await requestJob(patientId).expect(202);
    await idle();
  });

  it('marks a slow AI service as TIMED_OUT', async () => {
    const patientId = await newPatient({ consent: true, record: true });
    behaviour = { delayMs: 1500, then: 'mock' };
    const job = (await requestJob(patientId).expect(202)).body as JobBody;
    await idle();
    const done = await getJob(job.id);
    expect(done.status).toBe('TIMED_OUT');
    expect(done.error).toBe('The AI service did not answer within 1 seconds');
    expect(done.report).toBeNull();
  });

  it('never stores a mock result that is not labelled as mock', async () => {
    const patientId = await newPatient({ consent: true, record: true });
    behaviour = 'unlabelled';
    const job = (await requestJob(patientId).expect(202)).body as JobBody;
    await idle();
    const done = await getJob(job.id);
    expect(done.status).toBe('FAILED');
    expect(done.error).toBe(
      'The AI service returned an invalid or unlabelled result',
    );
    const mongo = createMongoClient(process.env.MONGO_URL!);
    try {
      expect(
        await mongo
          .db()
          .collection('ai_reports')
          .countDocuments({ jobId: job.id }),
      ).toBe(0);
    } finally {
      await mongo.close();
    }
  });

  it('explains when no AI module could use the data', async () => {
    const patientId = await newPatient({ consent: true, record: true });
    behaviour = 'insufficient';
    const job = (await requestJob(patientId).expect(202)).body as JobBody;
    await idle();
    const done = await getJob(job.id);
    expect(done.status).toBe('FAILED');
    expect(done.error).toBe(
      'No AI module could use the data available for this patient',
    );
  });

  it('keeps other facilities and patients out, and lists jobs newest first', async () => {
    const patientId = await newPatient({ consent: true, record: true });
    const job = (await requestJob(patientId).expect(202)).body as JobBody;
    await idle();
    await requestJob(patientId, otherClinician).expect(404);
    await http()
      .get(`/api/v1/ai-jobs/${job.id}`)
      .set(as(otherClinician))
      .expect(404);
    await requestJob(patientId, patientRole).expect(403);
    const list = await http()
      .get(`/api/v1/patients/${patientId}/ai-jobs`)
      .set(as(clinician))
      .expect(200);
    expect((list.body as JobBody[])[0]).toMatchObject({
      id: job.id,
      report: null,
    });
  });

  it('syncs the model registry from the AI service, without metrics', async () => {
    const res = await http()
      .get('/api/v1/ai/models')
      .set(as(clinician))
      .expect(200);
    expect(res.body).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          name: 'ann_clinical',
          provenance: 'MOCK',
          status: 'ACTIVE',
          evaluationAvailable: false,
        }),
      ]),
    );
  });

  it('answers 503 when AI analysis is switched off', async () => {
    const off = await createDbTestApp({ AI_SERVICE_TOKEN: '' });
    apps.push(off);
    const token = await loginAs(
      off,
      (await createUser(prisma, 'CLINICIAN', facility)).email,
    );
    const patientId = await newPatient({ consent: true, record: true });
    const res = await request(off.getHttpServer())
      .post(`/api/v1/patients/${patientId}/ai-jobs`)
      .set(as(token))
      .expect(503);
    expect((res.body as ErrorBody).error.code).toBe('AI_UNAVAILABLE');
  });
});
