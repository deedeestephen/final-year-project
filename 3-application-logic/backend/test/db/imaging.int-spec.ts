import { randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { PrismaClient } from '@prisma/client';
import request from 'supertest';
import { createMongoClient } from '../../src/persistence/mongo/client';
import {
  SYNTHETIC_DICOM_IDENTIFIERS,
  makeNotAnImage,
  makeSyntheticDicom,
  makeSyntheticTiff,
} from '../fixtures/synthetic-files';
import {
  createDbTestApp,
  createFacility,
  createUser,
  ensureSeeded,
  loginAs,
} from './helpers';

const prisma = new PrismaClient();

interface ErrorBody {
  error: { code: string; message: string; details?: unknown };
}
interface StudyBody {
  id: string;
  patientId: string;
  modality: string;
  mimeType: string;
  sizeBytes: number;
  sha256: string;
  status: string;
  studyInstanceUid: string | null;
}
interface SpecimenBody {
  id: string;
  format: string;
  stain: string | null;
  biopsyDate: string | null;
  gleasonPrimary: number | null;
  isupGradeGroup: number | null;
  reviewedAt: string | null;
}

const nrc = () =>
  `${String(Math.floor(Math.random() * 900000) + 100000)}/${String(Math.floor(Math.random() * 90) + 10)}/1`;

describe('imaging and histopathology files (real database)', () => {
  const apps: NestExpressApplication[] = [];
  let app: NestExpressApplication;
  let clinician: string;
  let pathologist: string;
  let otherClinician: string;
  let patientRole: string;
  let patientId: string;
  const as = (token: string) => ({ Authorization: `Bearer ${token}` });
  const http = () => request(app.getHttpServer());

  const uploadImaging = (
    token: string,
    file: Buffer,
    fields: Record<string, string>,
    target = patientId,
  ) => {
    let req = http().post(`/api/v1/patients/${target}/imaging`).set(as(token));
    for (const [k, v] of Object.entries(fields)) req = req.field(k, v);
    return req.attach('file', file, 'upload.bin');
  };

  const uploadSlide = (
    token: string,
    file: Buffer,
    fields: Record<string, string> = {},
  ) => {
    let req = http()
      .post(`/api/v1/patients/${patientId}/histopathology`)
      .set(as(token));
    for (const [k, v] of Object.entries(fields)) req = req.field(k, v);
    return req.attach('file', file, 'slide.bin');
  };

  beforeAll(async () => {
    await ensureSeeded(prisma);
    app = await createDbTestApp({ MAX_IMAGING_MB: '1' });
    apps.push(app);
    const facility = await createFacility(prisma, 'IMG');
    const elsewhere = await createFacility(prisma, 'IMG2');
    clinician = await loginAs(
      app,
      (await createUser(prisma, 'CLINICIAN', facility)).email,
    );
    pathologist = await loginAs(
      app,
      (await createUser(prisma, 'PATHOLOGIST', facility)).email,
    );
    otherClinician = await loginAs(
      app,
      (await createUser(prisma, 'CLINICIAN', elsewhere)).email,
    );
    patientRole = await loginAs(
      app,
      (await createUser(prisma, 'PATIENT', null)).email,
    );
    const created = await http()
      .post('/api/v1/patients')
      .set(as(clinician))
      .send({
        givenName: 'SYNTHETIC',
        familyName: `Imaging-${randomUUID().slice(0, 6)}`,
        nationalId: nrc(),
        phone: '+260971234567',
        dateOfBirth: '1958-03-14',
        regionClass: 'URBAN',
      })
      .expect(201);
    patientId = (created.body as { id: string }).id;
  });

  afterAll(async () => {
    for (const a of apps) await a.close();
    await prisma.$disconnect();
  });

  describe('imaging upload', () => {
    it('stores a valid DICOM study, records its hash and keeps no patient tags', async () => {
      const file = makeSyntheticDicom('MR');
      const res = await uploadImaging(clinician, file, {
        modality: 'MRI',
      }).expect(201);
      const study = res.body as StudyBody;
      expect(study).toMatchObject({
        patientId,
        modality: 'MRI',
        mimeType: 'application/dicom',
        sizeBytes: file.length,
        status: 'VALIDATED',
      });
      expect(study.sha256).toMatch(/^[0-9a-f]{64}$/);
      expect(study.studyInstanceUid).toMatch(/^2\.25\./);

      // The stored file comes back byte for byte, as a download.
      const content = await http()
        .get(`/api/v1/imaging/${study.id}/content`)
        .set(as(clinician))
        .buffer(true)
        .parse((r, done) => {
          const chunks: Buffer[] = [];
          r.on('data', (c: Buffer) => chunks.push(c));
          r.on('end', () => done(null, Buffer.concat(chunks)));
        })
        .expect(200);
      expect(Buffer.compare(content.body as Buffer, file)).toBe(0);
      expect(content.headers['content-disposition']).toMatch(/^attachment;/);
      expect(content.headers['x-content-type-options']).toBe('nosniff');

      // Metadata copy: technical fields only.
      const mongo = createMongoClient(process.env.MONGO_URL!);
      try {
        const meta = await mongo
          .db()
          .collection('imaging_metadata')
          .findOne({ imagingStudyId: study.id });
        expect(meta?.dicom).toMatchObject({ modality: 'MR', rows: 8 });
        expect(JSON.stringify(meta)).not.toContain('SYNTHETIC^TEST');
        expect(JSON.stringify(meta)).not.toContain('SYNTHETIC-0000');
      } finally {
        await mongo.close();
      }

      const audit = await prisma.auditLog.findMany({
        where: { entityId: study.id },
        select: { action: true, details: true },
      });
      expect(audit.map((a) => a.action)).toEqual(
        expect.arrayContaining(['imaging.uploaded', 'imaging.content_read']),
      );
      expect(JSON.stringify(audit)).not.toContain('SYNTHETIC^TEST');
    });

    it('keeps a de-identified copy for the AI and leaves the original untouched (NFR-10)', async () => {
      const file = makeSyntheticDicom('MR', { identifiers: true });
      const res = await uploadImaging(clinician, file, {
        modality: 'MRI',
      }).expect(201);
      const study = res.body as StudyBody & {
        aiReady: boolean;
        aiExcludedReason: string | null;
      };
      expect(study).toMatchObject({ aiReady: true, aiExcludedReason: null });

      const row = await prisma.imagingStudy.findUniqueOrThrow({
        where: { id: study.id },
      });
      const root = process.env.LOCAL_STORAGE_ROOT!;
      const original = readFileSync(path.join(root, row.storageKey));
      const copy = readFileSync(path.join(root, row.deidStorageKey!));
      expect(original.equals(file)).toBe(true);
      expect(copy.length).toBe(file.length);
      for (const value of Object.values(SYNTHETIC_DICOM_IDENTIFIERS)) {
        expect(original.toString('latin1')).toContain(value);
        expect(copy.toString('latin1')).not.toContain(value);
      }
      // The audit says which attributes were changed, never their values.
      const audit = await prisma.auditLog.findFirstOrThrow({
        where: { entityId: study.id, action: 'imaging.uploaded' },
      });
      expect(
        (audit.details as { deidentified: string[] }).deidentified,
      ).toEqual(expect.arrayContaining(['Patient Name', 'Institution Name']));
      expect(JSON.stringify(audit.details)).not.toContain('SYNTHETIC');
    });

    it('accepts an ultrasound photo only for TRUS', async () => {
      const png = Buffer.concat([
        Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
        Buffer.alloc(200),
      ]);
      await uploadImaging(clinician, png, { modality: 'TRUS' }).expect(201);
      const mri = await uploadImaging(clinician, png, {
        modality: 'MRI',
      }).expect(422);
      expect((mri.body as ErrorBody).error).toMatchObject({
        code: 'UPLOAD_REJECTED',
        message: 'MRI images must be DICOM files',
      });
    });

    it('rejects a DICOM file of the wrong modality and audits it', async () => {
      const res = await uploadImaging(clinician, makeSyntheticDicom('CT'), {
        modality: 'MRI',
      }).expect(422);
      expect((res.body as ErrorBody).error.message).toBe(
        'This DICOM file is modality CT, not MRI',
      );
      const rejected = await prisma.auditLog.findFirst({
        where: { action: 'imaging.rejected', entityId: patientId },
      });
      expect(rejected?.outcome).toBe('FAILURE');
    });

    it('rejects files by content, not by name', async () => {
      const res = await uploadImaging(clinician, makeNotAnImage(), {
        modality: 'MRI',
      }).expect(415);
      expect((res.body as ErrorBody).error.code).toBe('UNSUPPORTED_MEDIA_TYPE');
      await uploadImaging(clinician, Buffer.alloc(0), {
        modality: 'MRI',
      }).expect(415);
    });

    it('stops files over the size limit', async () => {
      const big = Buffer.concat([
        makeSyntheticDicom('MR'),
        Buffer.alloc(1024 * 1024 + 10),
      ]);
      const res = await uploadImaging(clinician, big, {
        modality: 'MRI',
      }).expect(413);
      expect((res.body as ErrorBody).error.code).toBe('PAYLOAD_TOO_LARGE');
    });

    it('validates the form fields and their order', async () => {
      await uploadImaging(clinician, makeSyntheticDicom('MR'), {
        modality: 'XRAY',
      }).expect(400);
      await uploadImaging(clinician, makeSyntheticDicom('MR'), {
        modality: 'MRI',
        clientUuid: 'not-a-uuid',
      }).expect(400);
      await uploadImaging(clinician, makeSyntheticDicom('MR'), {
        modality: 'MRI',
        extra: 'x',
      }).expect(400);
      // File before the fields.
      await http()
        .post(`/api/v1/patients/${patientId}/imaging`)
        .set(as(clinician))
        .attach('file', makeSyntheticDicom('MR'), 'a.dcm')
        .field('modality', 'MRI')
        .expect(400);
      // Not multipart at all.
      await http()
        .post(`/api/v1/patients/${patientId}/imaging`)
        .set(as(clinician))
        .send({ modality: 'MRI' })
        .expect(415);
    });

    it('treats a retry with the same clientUuid as the same upload', async () => {
      const clientUuid = randomUUID();
      const first = await uploadImaging(clinician, makeSyntheticDicom('MR'), {
        modality: 'MRI',
        clientUuid,
      }).expect(201);
      const again = await uploadImaging(clinician, makeSyntheticDicom('MR'), {
        modality: 'MRI',
        clientUuid,
      }).expect(200);
      expect((again.body as StudyBody).id).toBe((first.body as StudyBody).id);
      expect(await prisma.imagingStudy.count({ where: { clientUuid } })).toBe(
        1,
      );
    });

    it('keeps other facilities and other roles out', async () => {
      const list = await http()
        .get(`/api/v1/patients/${patientId}/imaging`)
        .set(as(clinician))
        .expect(200);
      const id = (list.body as StudyBody[])[0].id;
      expect((list.body as StudyBody[]).length).toBeGreaterThanOrEqual(3);

      await uploadImaging(otherClinician, makeSyntheticDicom('MR'), {
        modality: 'MRI',
      }).expect(404);
      await http()
        .get(`/api/v1/imaging/${id}`)
        .set(as(otherClinician))
        .expect(404);
      await http()
        .get(`/api/v1/imaging/${id}/content`)
        .set(as(otherClinician))
        .expect(404);
      await uploadImaging(patientRole, makeSyntheticDicom('MR'), {
        modality: 'MRI',
      }).expect(403);
      await http()
        .get(`/api/v1/imaging/${id}`)
        .set(as(pathologist))
        .expect(200);
    });
  });

  describe('histopathology', () => {
    it('lets a pathologist upload a slide and a clinician read it, but not upload', async () => {
      await uploadSlide(clinician, makeSyntheticTiff()).expect(403);
      const res = await uploadSlide(pathologist, makeSyntheticTiff(), {
        format: 'SVS',
        stain: 'H&E',
        biopsyDate: '2026-09-01',
      }).expect(201);
      expect(res.body as SpecimenBody).toMatchObject({
        format: 'SVS',
        stain: 'H&E',
        biopsyDate: '2026-09-01',
        gleasonPrimary: null,
        reviewedAt: null,
      });
      await http()
        .get(`/api/v1/histopathology/${(res.body as SpecimenBody).id}`)
        .set(as(clinician))
        .expect(200);
      // A DICOM file is not a slide.
      await uploadSlide(pathologist, makeSyntheticDicom('MR')).expect(415);
      // Stain text is checked like any other free text.
      await uploadSlide(pathologist, makeSyntheticTiff(), {
        stain: '<script>',
      }).expect(400);
      await uploadSlide(pathologist, makeSyntheticTiff(), {
        biopsyDate: '2999-01-01',
      }).expect(400);
    });

    it('queues unreviewed slides and computes the ISUP grade group on review', async () => {
      const slide = (
        await uploadSlide(pathologist, makeSyntheticTiff()).expect(201)
      ).body as SpecimenBody;
      const queue = await http()
        .get('/api/v1/histopathology/review-queue')
        .set(as(pathologist))
        .expect(200);
      expect((queue.body as SpecimenBody[]).map((s) => s.id)).toContain(
        slide.id,
      );
      await http()
        .get('/api/v1/histopathology/review-queue')
        .set(as(clinician))
        .expect(403);

      await http()
        .post(`/api/v1/histopathology/${slide.id}/review`)
        .set(as(pathologist))
        .send({ gleasonPrimary: 6, gleasonSecondary: 3 })
        .expect(400);
      const reviewed = await http()
        .post(`/api/v1/histopathology/${slide.id}/review`)
        .set(as(pathologist))
        .send({ gleasonPrimary: 4, gleasonSecondary: 3 })
        .expect(200);
      expect(reviewed.body as SpecimenBody).toMatchObject({
        gleasonPrimary: 4,
        isupGradeGroup: 3,
      });
      expect((reviewed.body as SpecimenBody).reviewedAt).not.toBeNull();

      const again = await http()
        .post(`/api/v1/histopathology/${slide.id}/review`)
        .set(as(pathologist))
        .send({ gleasonPrimary: 3, gleasonSecondary: 3 })
        .expect(409);
      expect((again.body as ErrorBody).error.code).toBe('ALREADY_REVIEWED');

      const afterQueue = await http()
        .get('/api/v1/histopathology/review-queue')
        .set(as(pathologist))
        .expect(200);
      expect(
        (afterQueue.body as SpecimenBody[]).map((s) => s.id),
      ).not.toContain(slide.id);
      const audit = await prisma.auditLog.findFirst({
        where: { action: 'histopathology.reviewed', entityId: slide.id },
      });
      expect(JSON.stringify(audit?.details)).not.toMatch(/gleason/i);
    });
  });

  it('streams uploads to S3-compatible storage (MinIO)', async () => {
    const s3App = await createDbTestApp({
      STORAGE_DRIVER: 's3',
      S3_BUCKET: process.env.S3_BUCKET ?? 'pca-mhealth-test',
    });
    apps.push(s3App);
    const token = await loginAs(
      s3App,
      (
        await createUser(
          prisma,
          'CLINICIAN',
          (await prisma.patient.findUniqueOrThrow({ where: { id: patientId } }))
            .facilityId,
        )
      ).email,
    );
    const file = makeSyntheticDicom('MR');
    const res = await request(s3App.getHttpServer())
      .post(`/api/v1/patients/${patientId}/imaging`)
      .set(as(token))
      .field('modality', 'MRI')
      .attach('file', file, 'a.dcm')
      .expect(201);
    const back = await request(s3App.getHttpServer())
      .get(`/api/v1/imaging/${(res.body as StudyBody).id}/content`)
      .set(as(token))
      .buffer(true)
      .parse((r, done) => {
        const chunks: Buffer[] = [];
        r.on('data', (c: Buffer) => chunks.push(c));
        r.on('end', () => done(null, Buffer.concat(chunks)));
      })
      .expect(200);
    expect(Buffer.compare(back.body as Buffer, file)).toBe(0);
  });
});
