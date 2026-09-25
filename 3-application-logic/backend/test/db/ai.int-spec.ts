import { randomUUID } from 'node:crypto';
import { crc32, deflateSync } from 'node:zlib';
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
import { createMongoClient } from '../../src/persistence/mongo/client';
import { AiService } from '../../src/services/ai/ai.service';
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
  | 'mock'
  | 'unlabelled'
  | 'insufficient'
  | 'explained'
  | { delayMs: number; then: 'mock' };

/** A valid 1x1 grey PNG, built here (stands in for a real model's heatmap). */
function tinyPng(): Buffer {
  const chunk = (kind: string, data: Buffer) => {
    const body = Buffer.concat([Buffer.from(kind, 'latin1'), data]);
    const length = Buffer.alloc(4);
    length.writeUInt32BE(data.length);
    const crc = Buffer.alloc(4);
    crc.writeUInt32BE(crc32(body));
    return Buffer.concat([length, body, crc]);
  };
  const header = Buffer.alloc(13);
  header.writeUInt32BE(1, 0);
  header.writeUInt32BE(1, 4);
  header.writeUInt8(8, 8); // bit depth; colour type, compression, filter, interlace stay 0
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', header),
    chunk('IDAT', deflateSync(Buffer.from([0x00, 0x80]))),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}
const HEATMAP = tinyPng();

/** One of each kind of explanation a real service might send. */
const explanations = () => [
  {
    kind: 'GRADCAM',
    module: 'resnet50_imaging',
    artifact: {
      contentType: 'image/png',
      dataBase64: HEATMAP.toString('base64'),
    },
  },
  {
    kind: 'SHAP',
    module: 'xgboost_fusion',
    artifact: {
      contentType: 'image/png',
      dataBase64: Buffer.from('<svg>not a png</svg>').toString('base64'),
    },
  },
  {
    kind: 'MIL_ATTENTION',
    module: 'patch_cnn_mil_histopathology',
    storageKey: 'imaging/2026/09/someone-else.dcm',
  },
  {
    kind: 'SHAP',
    module: 'ann_clinical',
    values: { psaNgMl: 0.12, ageYears: -0.03 },
  },
  {
    kind: 'GRADCAM',
    module: 'unet_segmentation',
    unavailableReason: 'Explanations need a trained research model.',
  },
];

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
        if (current === 'explained') {
          return send(200, {
            ...mockResult(body.jobId),
            explanations: explanations(),
          });
        }
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

  describe('explanations (Phase 12)', () => {
    interface ExplanationBody {
      id: string | null;
      kind: string;
      module: string;
      available: boolean;
      hasImage: boolean;
      unavailableReason: string | null;
      values: Record<string, number> | null;
    }

    it('stores real images, refuses bad ones and never follows references', async () => {
      const patientId = await newPatient({ consent: true, record: true });
      behaviour = 'explained';
      const job = (await requestJob(patientId).expect(202)).body as JobBody;
      await idle();
      expect((await getJob(job.id)).status).toBe('SUCCEEDED');

      const list = (
        await http()
          .get(`/api/v1/ai-jobs/${job.id}/explanations`)
          .set(as(clinician))
          .expect(200)
      ).body as ExplanationBody[];
      const by = Object.fromEntries(list.map((e) => [e.module, e]));

      // A real PNG: stored and served back byte for byte.
      expect(by.resnet50_imaging).toMatchObject({
        kind: 'GRADCAM',
        available: true,
        hasImage: true,
      });
      const image = await http()
        .get(`/api/v1/explanations/${by.resnet50_imaging.id}/content`)
        .set(as(clinician))
        .buffer(true)
        .parse((r, done) => {
          const chunks: Buffer[] = [];
          r.on('data', (c: Buffer) => chunks.push(c));
          r.on('end', () => done(null, Buffer.concat(chunks)));
        })
        .expect(200);
      expect(image.headers['content-type']).toBe('image/png');
      expect(Buffer.compare(image.body as Buffer, HEATMAP)).toBe(0);

      // Not a PNG: discarded, with a reason.
      expect(by.xgboost_fusion).toMatchObject({
        available: false,
        hasImage: false,
        unavailableReason:
          'The explanation image was not a valid PNG within 2 MB and was discarded.',
      });
      // A storage reference (could point at another patient's file): refused.
      expect(by.patch_cnn_mil_histopathology.available).toBe(false);
      expect(by.patch_cnn_mil_histopathology.unavailableReason).toMatch(
        /references are not accepted/,
      );
      // SHAP values from a model: kept as they are, no image.
      expect(by.ann_clinical).toMatchObject({
        available: true,
        hasImage: false,
        values: { psaNgMl: 0.12, ageYears: -0.03 },
      });
      // A stated reason is passed through.
      expect(by.unet_segmentation.unavailableReason).toBe(
        'Explanations need a trained research model.',
      );

      // One database row per image or reason (not for plain values).
      const rows = await prisma.explainabilityArtifact.findMany({
        where: { jobId: job.id },
      });
      expect(rows).toHaveLength(4);
      expect(rows.filter((r) => r.storageKey !== null)).toHaveLength(1);

      // The report keeps references, never the image data itself.
      const mongo = createMongoClient(process.env.MONGO_URL!);
      try {
        const report = await mongo
          .db()
          .collection('ai_reports')
          .findOne({ jobId: job.id });
        expect(JSON.stringify(report)).not.toContain('dataBase64');
        expect(JSON.stringify(report)).not.toContain('someone-else');
      } finally {
        await mongo.close();
      }

      // Viewing the image is audited; other facilities cannot see it.
      const audit = await prisma.auditLog.findFirst({
        where: { action: 'ai_explanation.content_read', entityId: job.id },
      });
      expect(audit).not.toBeNull();
      await http()
        .get(`/api/v1/explanations/${by.resnet50_imaging.id}/content`)
        .set(as(otherClinician))
        .expect(404);
      // A reason-only row has no image to fetch.
      const reasonRow = rows.find((r) => r.storageKey === null)!;
      await http()
        .get(`/api/v1/explanations/${reasonRow.id}/content`)
        .set(as(clinician))
        .expect(404);
    });

    it('reports evaluation figures only from a stored evaluation run', async () => {
      const models = (
        await http().get('/api/v1/ai/models').set(as(clinician)).expect(200)
      ).body as { id: string; name: string }[];
      const ann = models.find((m) => m.name === 'ann_clinical')!;
      const none = await http()
        .get(`/api/v1/ai/models/${ann.id}/evaluation`)
        .set(as(clinician))
        .expect(200);
      expect(none.body).toEqual({
        modelId: ann.id,
        available: false,
        message: 'Evaluation data not yet available.',
        evaluation: null,
      });

      // A stored run (test data, clearly not a real result) is returned as is.
      const stored = await prisma.aiModel.create({
        data: {
          name: `test_model_${randomUUID().slice(0, 6)}`,
          architecture: 'ANN',
          version: 'test-1',
          provenance: 'RESEARCH_MODEL',
          evaluation: { source: 'integration test fixture', auc: 0.5 },
        },
      });
      const some = await http()
        .get(`/api/v1/ai/models/${stored.id}/evaluation`)
        .set(as(clinician))
        .expect(200);
      expect(some.body).toMatchObject({
        available: true,
        message: null,
        evaluation: { source: 'integration test fixture' },
      });
      await http()
        .get(`/api/v1/ai/models/${randomUUID()}/evaluation`)
        .set(as(clinician))
        .expect(404);
    });
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
