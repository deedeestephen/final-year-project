import { randomInt, randomUUID } from 'node:crypto';
import {
  createServer,
  type IncomingMessage,
  type Server,
  type ServerResponse,
} from 'node:http';
import type { AddressInfo } from 'node:net';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { PrismaClient } from '@prisma/client';
import type { Bundle, FhirResource } from 'fhir/r4';
import request from 'supertest';
import { FieldCrypto } from '../../src/persistence/crypto/field-crypto';
import { createMongoClient } from '../../src/persistence/mongo/client';
import { SAFE_HARBOR, exportId } from '../../src/services/fhir/deidentify';
import { readExport } from '../../src/services/fhir/fhir-mappers';
import {
  createDbTestApp,
  createFacility,
  createUser,
  ensureSeeded,
  loginAs,
} from './helpers';

/*
 * De-identified FHIR export (FR-09, UC-08, NFR-10) against the real
 * databases. One synthetic patient carries every identifier this system can
 * hold; the export must contain none of them (one test per Safe Harbor class).
 */

const prisma = new PrismaClient();
const MOCK_DISCLAIMER = 'DEVELOPMENT MOCK DATA — NOT A CLINICAL RESULT.';
const SMARTCARE_TOKEN = 'integration-smartcare-token';

interface ErrorBody {
  error: { code: string; message: string };
}

/** Random letters only (names must be plain text). */
const letters = (n: number) =>
  Array.from({ length: n }, () => String.fromCharCode(97 + randomInt(26))).join(
    '',
  );

// -- mock SmartCare Pro ---------------------------------------------------------

type MockMode = 'accept' | 'reject' | 'fail';
interface Received {
  method: string;
  url: string;
  authorization?: string;
  contentType?: string;
  bundle: Bundle;
}

function startMockSmartCare(): Promise<{
  server: Server;
  url: string;
  received: Received[];
  setMode: (m: MockMode) => void;
}> {
  const received: Received[] = [];
  let mode: MockMode = 'accept';
  const server = createServer((req: IncomingMessage, res: ServerResponse) => {
    const chunks: Buffer[] = [];
    req.on('data', (c: Buffer) => chunks.push(c));
    req.on('end', () => {
      received.push({
        method: req.method ?? '',
        url: req.url ?? '',
        authorization: req.headers.authorization,
        contentType: req.headers['content-type'],
        bundle: JSON.parse(Buffer.concat(chunks).toString('utf8')) as Bundle,
      });
      res.setHeader('Content-Type', 'application/fhir+json');
      if (mode === 'accept') {
        res.statusCode = 201;
        res.setHeader('Location', '/fhir/Bundle/received-1/_history/1');
        res.end(JSON.stringify({ resourceType: 'Bundle', id: 'received-1' }));
      } else if (mode === 'reject') {
        res.statusCode = 422;
        res.end(
          JSON.stringify({
            resourceType: 'OperationOutcome',
            issue: [
              {
                severity: 'error',
                code: 'invalid',
                diagnostics: 'Bundle.entry[3]: unknown code system\u0007',
              },
            ],
          }),
        );
      } else {
        res.statusCode = 500;
        res.end('{}');
      }
    });
  });
  return new Promise((resolve) =>
    server.listen(0, '127.0.0.1', () => {
      const { port } = server.address() as AddressInfo;
      resolve({
        server,
        url: `http://127.0.0.1:${port}/fhir`,
        received,
        setMode: (m) => (mode = m),
      });
    }),
  );
}

// -- test data --------------------------------------------------------------------

describe('FHIR export (Phase 14)', () => {
  let app: NestExpressApplication;
  let mock: Awaited<ReturnType<typeof startMockSmartCare>>;
  let crypto: FieldCrypto;
  let adminToken: string;
  let clinicianToken: string;
  let facilityA: string;
  let facilityB: string;
  const ids: {
    admin: string;
    clinician: string;
    account: string;
    p1: string;
    p2: string;
    p3: string;
    p4: string;
    record: string;
    recordClientUuid: string;
    specimen: string;
    mockJob: string;
    researchJob: string;
  } = {} as never;

  // Everything planted on patient 1, by Safe Harbor class.
  const tag = letters(8);
  const planted = {
    givenName: `Given${tag}`,
    familyName: `Family${tag}`,
    district: `District${tag}`,
    nationalId: `${randomInt(100000, 999999)}/${randomInt(10, 99)}/1`,
    phone: `+26097${randomInt(1000000, 9999999)}`,
    mrn: `MRN-${tag}`,
    email: `account-${tag}@example.test`,
    notes: `Note ${tag}: lives near the market, call his brother.`,
    stain: `Stain${tag}`,
    storageKey: `imaging/${randomUUID()}.dcm`,
    slideKey: `histopathology/${randomUUID()}.tif`,
    dateOfBirth: '1958-03-02',
    encounterDate: '2026-09-20',
    biopsyDate: '2026-08-11',
    reviewedAt: '2026-09-24',
  };
  let facilityPlanted: string[] = [];

  const as = (token: string) => ({ Authorization: `Bearer ${token}` });
  const server = () => app.getHttpServer();

  async function createPatient(
    body: Record<string, unknown>,
    facilityToken: string,
  ): Promise<string> {
    const res = await request(server())
      .post('/api/v1/patients')
      .set(as(facilityToken))
      .send(body)
      .expect(201);
    return (res.body as { id: string }).id;
  }

  async function consent(
    patientId: string,
    type: string,
    token = clinicianToken,
  ): Promise<string> {
    const res = await request(server())
      .post(`/api/v1/patients/${patientId}/consents`)
      .set(as(token))
      .send({ type, method: 'WRITTEN', consentTextVersion: 'v1' })
      .expect(201);
    return (res.body as { id: string }).id;
  }

  beforeAll(async () => {
    await ensureSeeded(prisma);
    mock = await startMockSmartCare();
    app = await createDbTestApp({
      SMARTCARE_FHIR_URL: mock.url,
      SMARTCARE_TOKEN,
    });
    crypto = FieldCrypto.fromEnv(process.env);

    facilityA = await createFacility(prisma, `FHIRA${tag}`);
    facilityB = await createFacility(prisma, `FHIRB${tag}`);
    const facility = await prisma.facility.findUniqueOrThrow({
      where: { id: facilityA },
    });
    facilityPlanted = [facility.name, facility.code];

    const admin = await createUser(prisma, 'ADMIN', null);
    const clinician = await createUser(prisma, 'CLINICIAN', facilityA);
    const clinicianB = await createUser(prisma, 'CLINICIAN', facilityB);
    ids.admin = admin.id;
    ids.clinician = clinician.id;
    adminToken = await loginAs(app, admin.email);
    clinicianToken = await loginAs(app, clinician.email);
    const clinicianBToken = await loginAs(app, clinicianB.email);

    // Patient 1: every identifier; research and EHR-sharing consent.
    ids.p1 = await createPatient(
      {
        givenName: planted.givenName,
        familyName: planted.familyName,
        mrn: planted.mrn,
        nationalId: planted.nationalId,
        phone: planted.phone,
        dateOfBirth: planted.dateOfBirth,
        regionClass: 'RURAL',
        district: planted.district,
      },
      clinicianToken,
    );
    ids.recordClientUuid = randomUUID();
    const record = await request(server())
      .post(`/api/v1/patients/${ids.p1}/clinical-records`)
      .set(as(clinicianToken))
      .send({
        encounterDate: planted.encounterDate,
        psaNgMl: 6.4,
        freePsaNgMl: 1.1,
        dreFinding: 'NODULAR',
        piradsScore: 4,
        prostateVolumeMl: 42.5,
        biopsyHistory: 'PRIOR_NEGATIVE',
        familyHistory: true,
        symptoms: { nocturia: true, weakStream: false },
        notes: planted.notes,
        clientUuid: ids.recordClientUuid,
      })
      .expect(201);
    ids.record = (record.body as { id: string }).id;
    await consent(ids.p1, 'RESEARCH_USE');
    await consent(ids.p1, 'EHR_SHARING');
    await consent(ids.p1, 'AI_ANALYSIS');

    // A linked patient app account (email and account id must not leak).
    const account = await createUser(prisma, 'PATIENT', null);
    ids.account = account.id;
    await prisma.user.update({
      where: { id: account.id },
      data: { email: planted.email },
    });
    await prisma.patient.update({
      where: { id: ids.p1 },
      data: { userId: account.id },
    });

    // An uploaded image and a reviewed slide (files are never exported).
    await prisma.imagingStudy.create({
      data: {
        patientId: ids.p1,
        modality: 'MRI',
        storageKey: planted.storageKey,
        sha256: 'a'.repeat(64),
        sizeBytes: 746,
        mimeType: 'application/dicom',
        status: 'VALIDATED',
        uploadedById: clinician.id,
      },
    });
    const specimen = await prisma.histopathologySpecimen.create({
      data: {
        patientId: ids.p1,
        storageKey: planted.slideKey,
        sha256: 'b'.repeat(64),
        sizeBytes: 123,
        format: 'TIFF',
        stain: planted.stain,
        biopsyDate: new Date(`${planted.biopsyDate}T00:00:00Z`),
        status: 'VALIDATED',
        gleasonPrimary: 4,
        gleasonSecondary: 3,
        isupGradeGroup: 3,
        reviewedById: clinician.id,
        reviewedAt: new Date(`${planted.reviewedAt}T10:00:00Z`),
        uploadedById: clinician.id,
      },
    });
    ids.specimen = specimen.id;

    // Two finished AI analyses: a development mock and a research model.
    const job = (id: string) =>
      prisma.aiJob.create({
        data: {
          id,
          patientId: ids.p1,
          requestedById: clinician.id,
          status: 'SUCCEEDED',
          inputs: {},
          finishedAt: new Date(),
        },
      });
    ids.mockJob = randomUUID();
    ids.researchJob = randomUUID();
    await job(ids.mockJob);
    await job(ids.researchJob);
    const mongo = createMongoClient(process.env.MONGO_URL!);
    try {
      const reports = (await mongo.connect()).db().collection('ai_reports');
      const base = {
        patientRef: `p_${'c'.repeat(32)}`,
        modelVersions: { xgboost_fusion: '0.1.0' },
        outputs: {
          pcaProbability: 0.42,
          probabilityInterval: [0.3, 0.55],
          gleasonGradeGroup: null,
          modulesUsed: ['xgboost_fusion'],
          modulesSkipped: [],
        },
        explanations: [],
        createdAt: new Date('2026-09-24T09:00:00Z'),
      };
      await reports.insertMany([
        {
          ...base,
          jobId: ids.mockJob,
          provenance: 'MOCK',
          disclaimer: MOCK_DISCLAIMER,
        },
        {
          ...base,
          jobId: ids.researchJob,
          provenance: 'RESEARCH_MODEL',
          disclaimer:
            'AI-assisted decision support only. Not a diagnosis. (test fixture)',
        },
      ]);
    } finally {
      await mongo.close();
    }

    // Patient 2: EHR-sharing consent only (national export, not research).
    ids.p2 = await createPatient(
      {
        givenName: 'SYNTHETIC',
        familyName: `Second${tag}`,
        dateOfBirth: '1961-01-01',
        regionClass: 'URBAN',
      },
      clinicianToken,
    );
    await consent(ids.p2, 'EHR_SHARING');

    // Patient 3: research consent given, then withdrawn.
    ids.p3 = await createPatient(
      {
        givenName: 'SYNTHETIC',
        familyName: `Third${tag}`,
        dateOfBirth: '1962-01-01',
        regionClass: 'URBAN',
      },
      clinicianToken,
    );
    const withdrawn = await consent(ids.p3, 'RESEARCH_USE');
    await request(server())
      .post(`/api/v1/patients/${ids.p3}/consents/${withdrawn}/withdraw`)
      .set(as(clinicianToken))
      .expect(200);

    // Patient 4: another facility, research consent.
    ids.p4 = await createPatient(
      {
        givenName: 'SYNTHETIC',
        familyName: `Fourth${tag}`,
        dateOfBirth: '1945-06-06',
        regionClass: 'PERI_URBAN',
      },
      clinicianBToken,
    );
    await consent(ids.p4, 'RESEARCH_USE', clinicianBToken);
  }, 60_000);

  afterAll(async () => {
    await app?.close();
    await new Promise((r) => mock?.server.close(r));
    await prisma.$disconnect();
  });

  const pid = (internal: string) => exportId(crypto, 'Patient', internal);

  async function exportBundle(
    body: Record<string, unknown>,
    token = adminToken,
  ): Promise<{
    bundle: Bundle;
    text: string;
    headers: Record<string, string>;
  }> {
    const res = await request(server())
      .post('/api/v1/fhir/export')
      .set(as(token))
      .send(body)
      .buffer(true)
      .parse((r, cb) => {
        let data = '';
        r.setEncoding('utf8');
        r.on('data', (c: string) => (data += c));
        r.on('end', () => cb(null, data));
      })
      .expect(200);
    const text = res.body as string;
    return {
      bundle: JSON.parse(text) as Bundle,
      text,
      headers: res.headers,
    };
  }

  const resources = (b: Bundle) =>
    (b.entry ?? []).map((e) => e.resource as FhirResource);

  // -- access ------------------------------------------------------------------

  it('is for administrators only (fhir:export)', async () => {
    await request(server())
      .get('/api/v1/fhir/export/summary?purpose=RESEARCH')
      .set(as(clinicianToken))
      .expect(403);
    await request(server())
      .post('/api/v1/fhir/export')
      .set(as(clinicianToken))
      .send({ purpose: 'RESEARCH' })
      .expect(403);
    await request(server())
      .post('/api/v1/fhir/export/push')
      .set(as(clinicianToken))
      .send({})
      .expect(403);
  });

  it('rejects an unknown purpose and an unknown facility', async () => {
    await request(server())
      .post('/api/v1/fhir/export')
      .set(as(adminToken))
      .send({ purpose: 'EVERYTHING' })
      .expect(400);
    const res = await request(server())
      .get(
        `/api/v1/fhir/export/summary?purpose=RESEARCH&facilityId=${randomUUID()}`,
      )
      .set(as(adminToken))
      .expect(404);
    expect((res.body as ErrorBody).error.code).toBe('NOT_FOUND');
  });

  // -- consent and scope -----------------------------------------------------------

  it('summarises what would be exported, without exporting', async () => {
    const res = await request(server())
      .get(
        `/api/v1/fhir/export/summary?purpose=RESEARCH&facilityId=${facilityA}`,
      )
      .set(as(adminToken))
      .expect(200);
    expect(res.body).toMatchObject({
      purpose: 'RESEARCH',
      patientsInScope: 3,
      patientsWithConsent: 1,
      consentRequired: 'RESEARCH_USE',
      willExport: {
        patients: 1,
        screeningVisits: 1,
        observations: 8 + 4 + 1,
        pathologyReports: 1,
        aiReports: 1,
        aiReportsLeftOutMock: 1,
      },
      smartcareConfigured: true,
      smartcareHost: new URL(mock.url).host,
    });
    const audits = await prisma.auditLog.count({
      where: { action: 'fhir.export', actorUserId: ids.admin },
    });
    expect(audits).toBe(0);
  });

  it('includes only patients with research consent (withdrawn ones are left out)', async () => {
    const { bundle } = await exportBundle({
      purpose: 'RESEARCH',
      facilityId: facilityA,
    });
    const patients = resources(bundle).filter(
      (r) => r.resourceType === 'Patient',
    );
    expect(patients.map((p) => p.id)).toEqual([pid(ids.p1)]);
  });

  it('uses EHR-sharing consent for the national (SmartCare Pro) export', async () => {
    const { bundle } = await exportBundle({
      purpose: 'NATIONAL_EHR',
      facilityId: facilityA,
    });
    const patients = resources(bundle)
      .filter((r) => r.resourceType === 'Patient')
      .map((p) => p.id)
      .sort();
    expect(patients).toEqual([pid(ids.p1), pid(ids.p2)].sort());
    expect(bundle.meta?.security?.[0].code).toBe('PUBHLTH');
  });

  it('covers every facility unless one is chosen', async () => {
    const { bundle } = await exportBundle({ purpose: 'RESEARCH' });
    const patients = resources(bundle)
      .filter((r) => r.resourceType === 'Patient')
      .map((p) => p.id);
    expect(patients).toEqual(
      expect.arrayContaining([pid(ids.p1), pid(ids.p4)]),
    );
    expect(patients).not.toContain(pid(ids.p2));
    expect(patients).not.toContain(pid(ids.p3));
  });

  // -- content -------------------------------------------------------------------

  it('is a downloadable FHIR R4 collection with the clinical values', async () => {
    const { bundle, headers } = await exportBundle({
      purpose: 'RESEARCH',
      facilityId: facilityA,
    });
    expect(headers['content-type']).toMatch(/^application\/fhir\+json/);
    expect(headers['content-disposition']).toMatch(
      /^attachment; filename="pca-mhealth-fhir-research-\d{4}-\d{2}-\d{2}\.json"$/,
    );
    expect(headers['cache-control']).toBe('no-store');
    expect(bundle.resourceType).toBe('Bundle');
    expect(bundle.type).toBe('collection');
    const [p] = readExport(bundle);
    expect(p).toMatchObject({
      birthYear: '1958',
      regionClass: 'RURAL',
      visits: [
        {
          year: '2026',
          psaNgMl: 6.4,
          freePsaNgMl: 1.1,
          dreFinding: 'NODULAR',
          piradsScore: 4,
          prostateVolumeMl: 42.5,
          familyHistory: true,
          biopsyHistory: 'PRIOR_NEGATIVE',
          symptoms: { nocturia: true, weakStream: false },
        },
      ],
      pathology: [
        {
          year: '2026',
          gleasonPrimary: 4,
          gleasonSecondary: 3,
          isupGradeGroup: 3,
        },
      ],
    });
  });

  it('never exports the development mock AI result, only the research one', async () => {
    const { bundle, text } = await exportBundle({
      purpose: 'RESEARCH',
      facilityId: facilityA,
    });
    expect(text).not.toContain('DEVELOPMENT MOCK');
    const ai = resources(bundle).filter(
      (r) =>
        r.resourceType === 'DiagnosticReport' &&
        r.meta?.security?.some((s) => s.code === 'AIAST'),
    );
    expect(ai).toHaveLength(1);
    expect(ai[0]).toMatchObject({ status: 'preliminary' });
  });

  it('keeps the same pseudonyms between exports', async () => {
    const a = await exportBundle({
      purpose: 'RESEARCH',
      facilityId: facilityA,
    });
    const b = await exportBundle({
      purpose: 'RESEARCH',
      facilityId: facilityA,
    });
    const idsOf = (x: Bundle) =>
      (x.entry ?? []).map((e) => e.resource?.id).sort();
    expect(idsOf(a.bundle)).toEqual(idsOf(b.bundle));
    expect(a.bundle.id).not.toBe(b.bundle.id);
  });

  // -- Safe Harbor: one test per identifier class ------------------------------------------

  describe('contains none of the 18 Safe Harbor identifiers', () => {
    let text = '';
    let bundle: Bundle;
    let keys: Set<string>;
    const forbiddenTypes = [
      'Practitioner',
      'PractitionerRole',
      'Organization',
      'Location',
      'RelatedPerson',
      'Coverage',
      'ImagingStudy',
      'Media',
      'Binary',
      'DocumentReference',
    ];

    beforeAll(async () => {
      ({ bundle, text } = await exportBundle({
        purpose: 'RESEARCH',
        facilityId: facilityA,
      }));
      keys = new Set<string>();
      const walk = (v: unknown): void => {
        if (Array.isArray(v)) v.forEach(walk);
        else if (v && typeof v === 'object') {
          for (const [k, x] of Object.entries(v)) {
            keys.add(k);
            walk(x);
          }
        }
      };
      walk(resources(bundle));
    });

    const leaks = (values: string[]) => values.filter((v) => text.includes(v));

    const checks: Record<number, () => void> = {
      1: () => {
        expect(leaks([planted.givenName, planted.familyName])).toEqual([]);
        // (AI model Devices have a deviceName; no person resource has a name.)
        const people = resources(bundle).filter(
          (r) => r.resourceType === 'Patient',
        );
        expect(people.length).toBeGreaterThan(0);
        for (const p of people) expect('name' in p).toBe(false);
      },
      2: () => {
        expect(leaks([planted.district, ...facilityPlanted])).toEqual([]);
        for (const k of ['line', 'city', 'district', 'postalCode', 'state']) {
          expect(keys.has(k)).toBe(false);
        }
      },
      3: () => {
        expect(
          leaks([
            planted.dateOfBirth,
            planted.encounterDate,
            planted.biopsyDate,
            planted.reviewedAt,
          ]),
        ).toEqual([]);
        const dated = JSON.stringify(resources(bundle)).match(
          /"(birthDate|effectiveDateTime|start|issued)":"[^"]*"/g,
        );
        for (const d of dated ?? []) expect(d).toMatch(/":"\d{4}"$/);
      },
      4: () => {
        expect(leaks([planted.phone, planted.phone.slice(4)])).toEqual([]);
        expect(keys.has('telecom')).toBe(false);
      },
      5: () => expect(keys.has('telecom')).toBe(false),
      6: () => {
        expect(leaks([planted.email, '@example.test'])).toEqual([]);
      },
      7: () => {
        expect(leaks([planted.nationalId])).toEqual([]);
        expect(keys.has('identifier')).toBe(false);
      },
      8: () => {
        expect(leaks([planted.mrn])).toEqual([]);
        expect(keys.has('identifier')).toBe(false);
      },
      9: () => expect(keys.has('identifier')).toBe(false),
      10: () =>
        expect(leaks([ids.account, ids.admin, ids.clinician])).toEqual([]),
      11: () => expect(keys.has('qualification')).toBe(false),
      12: () => expect(keys.has('identifier')).toBe(false),
      13: () => {
        expect(keys.has('udiCarrier')).toBe(false);
        expect(keys.has('serialNumber')).toBe(false);
      },
      14: () => {
        expect(leaks([planted.storageKey, planted.slideKey])).toEqual([]);
        expect(keys.has('attachment')).toBe(false);
        expect(keys.has('presentedForm')).toBe(false);
      },
      15: () => expect(leaks(['127.0.0.1', '::1'])).toEqual([]),
      16: () => expect(keys.has('photo')).toBe(false),
      17: () => expect(keys.has('photo')).toBe(false),
      18: () =>
        expect(
          leaks([
            ids.p1,
            ids.record,
            ids.recordClientUuid,
            ids.specimen,
            ids.mockJob,
            ids.researchJob,
            planted.notes,
            tag,
            planted.stain,
          ]),
        ).toEqual([]),
    };

    it.each(SAFE_HARBOR.map((r) => [r.n, r.identifier]))('%i. %s', (n) => {
      checks[n]();
      for (const type of forbiddenTypes) {
        expect(resources(bundle).some((r) => r.resourceType === type)).toBe(
          false,
        );
      }
    });
  });

  // -- audit ------------------------------------------------------------------------

  it('audits every export with counts only', async () => {
    const { bundle } = await exportBundle({
      purpose: 'RESEARCH',
      facilityId: facilityA,
    });
    const row = await prisma.auditLog.findFirstOrThrow({
      where: { action: 'fhir.export', entityId: bundle.id },
    });
    expect(row).toMatchObject({
      outcome: 'SUCCESS',
      actorUserId: ids.admin,
      entityType: 'fhir_bundle',
    });
    expect(row.details).toMatchObject({
      purpose: 'RESEARCH',
      facilityId: facilityA,
      patients: 1,
      aiReportsLeftOutMock: 1,
    });
    const details = JSON.stringify(row.details);
    for (const v of [
      planted.familyName,
      planted.nationalId,
      planted.mrn,
      ids.p1,
    ]) {
      expect(details).not.toContain(v);
    }
  });

  // -- sending to SmartCare Pro ------------------------------------------------------------

  it('sends the national export to SmartCare Pro with the token', async () => {
    mock.setMode('accept');
    mock.received.length = 0;
    const res = await request(server())
      .post('/api/v1/fhir/export/push')
      .set(as(adminToken))
      .send({ facilityId: facilityA })
      .expect(200);
    expect(res.body).toMatchObject({
      status: 'SENT',
      httpStatus: 201,
      receiverId: 'received-1',
      target: new URL(mock.url).host,
      counts: { patients: 2 },
    });
    expect(mock.received).toHaveLength(1);
    const got = mock.received[0];
    expect(got.method).toBe('POST');
    expect(got.url).toBe('/fhir/Bundle');
    expect(got.authorization).toBe(`Bearer ${SMARTCARE_TOKEN}`);
    expect(got.contentType).toBe('application/fhir+json');
    expect(got.bundle.meta?.security?.[0].code).toBe('PUBHLTH');
    expect(JSON.stringify(got.bundle)).not.toContain(planted.familyName);

    const row = await prisma.auditLog.findFirstOrThrow({
      where: {
        action: 'fhir.push',
        entityId: (res.body as { bundleId: string }).bundleId,
      },
    });
    expect(row.outcome).toBe('SUCCESS');
    expect(JSON.stringify(row.details)).not.toContain(SMARTCARE_TOKEN);
  });

  it('reports a refusal by code and keeps the receiver reason in the audit log only', async () => {
    mock.setMode('reject');
    const res = await request(server())
      .post('/api/v1/fhir/export/push')
      .set(as(adminToken))
      .send({ facilityId: facilityA })
      .expect(502);
    const { error } = res.body as ErrorBody;
    expect(error.code).toBe('FHIR_TARGET_REJECTED');
    // Text from another system is untrusted: never echoed in the answer.
    expect(error.message).not.toContain('unknown code system');
    const failed = await prisma.auditLog.findFirst({
      where: { action: 'fhir.push', outcome: 'FAILURE' },
      orderBy: { seq: 'desc' },
    });
    expect(failed?.details).toMatchObject({
      reason: 'REJECTED',
      httpStatus: 422,
      // Cleaned: the control character is removed.
      remoteDetail: 'Bundle.entry[3]: unknown code system',
    });
  });

  it('reports a SmartCare Pro server error as unreachable', async () => {
    mock.setMode('fail');
    const res = await request(server())
      .post('/api/v1/fhir/export/push')
      .set(as(adminToken))
      .send({})
      .expect(502);
    expect((res.body as ErrorBody).error.code).toBe('FHIR_TARGET_UNREACHABLE');
    mock.setMode('accept');
  });

  describe('without a SmartCare Pro address, and with a small export limit', () => {
    let small: NestExpressApplication;

    beforeAll(async () => {
      small = await createDbTestApp({ FHIR_EXPORT_MAX_PATIENTS: '1' });
    });
    afterAll(async () => {
      await small?.close();
      // Back to the main app's settings for any later test in this file.
      process.env.SMARTCARE_FHIR_URL = mock.url;
      process.env.SMARTCARE_TOKEN = SMARTCARE_TOKEN;
      process.env.FHIR_EXPORT_MAX_PATIENTS = '5000';
    });

    it('says sending is not set up (503)', async () => {
      const res = await request(small.getHttpServer())
        .post('/api/v1/fhir/export/push')
        .set(as(adminToken))
        .send({})
        .expect(503);
      expect((res.body as ErrorBody).error.code).toBe(
        'FHIR_TARGET_NOT_CONFIGURED',
      );
      const summary = await request(small.getHttpServer())
        .get('/api/v1/fhir/export/summary?purpose=RESEARCH')
        .set(as(adminToken))
        .expect(200);
      expect(summary.body).toMatchObject({
        smartcareConfigured: false,
        smartcareHost: null,
        maxPatients: 1,
        willExport: { patients: 0 },
      });
    });

    it('refuses an export larger than the limit and asks for one facility at a time', async () => {
      const res = await request(small.getHttpServer())
        .post('/api/v1/fhir/export')
        .set(as(adminToken))
        .send({ purpose: 'RESEARCH' })
        .expect(422);
      expect((res.body as ErrorBody).error.code).toBe('EXPORT_TOO_LARGE');
      await request(small.getHttpServer())
        .post('/api/v1/fhir/export')
        .set(as(adminToken))
        .send({ purpose: 'RESEARCH', facilityId: facilityA })
        .expect(200);
    });
  });
});
