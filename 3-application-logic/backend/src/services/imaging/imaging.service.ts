import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import type {
  HistopathologySpecimen,
  ImagingStudy,
  Patient,
} from '@prisma/client';
import { Prisma } from '@prisma/client';
import type { Request } from 'express';
import { Readable } from 'node:stream';
import { receiveUpload } from '../../gateway/upload/streamed-upload';
import { isPastCalendarDate } from '../../gateway/validation/calendar-date';
import { isSafeText } from '../../gateway/validation/safe-text';
import { APP_CONFIG, type AppConfig } from '../../config/app-config';
import { FieldCrypto } from '../../persistence/crypto/field-crypto';
import { MongoService } from '../../persistence/database/mongo.service';
import { PrismaService } from '../../persistence/database/prisma.service';
import {
  generateObjectKey,
  type ObjectStorage,
} from '../../persistence/storage/object-storage';
import { OBJECT_STORAGE } from '../../persistence/storage/storage.module';
import type {
  AuthenticatedUser,
  RequestContext,
} from '../../gateway/access/access.decorators';
import { AuditService } from '../audit/audit.service';
import { PatientsService } from '../patients/patients.service';
import {
  DeidentificationError,
  deidentifyDicomHead,
  replaceHead,
  stripImageMetadata,
  uidFromHash,
} from './deidentify-files';
import { DICOM_MODALITY_CODES, readDicomHeader } from './dicom-header';
import {
  IMAGING_MODALITIES,
  SLIDE_FORMATS,
  type ImagingModalityName,
  type ImagingStudyView,
  type ReviewSpecimenDto,
  type SlideFormat,
  type SpecimenView,
} from './imaging.dto';

/** First bytes kept in memory for reading a DICOM header (pixel data comes after it). */
const DICOM_HEAD_BYTES = 2 * 1024 * 1024;

/** Largest JPEG or PNG whose metadata is removed in memory for the AI copy. */
const MAX_IN_MEMORY_IMAGE_BYTES = 64 * 1024 * 1024;

/** Result of preparing the de-identified copy the AI may receive. */
interface AiCopy {
  key: string | null;
  excludedReason: string | null;
  changed: string[];
}

const UUID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/** ISUP grade group from the two Gleason patterns (ISUP 2014 consensus). */
export function isupGradeGroup(primary: number, secondary: number): number {
  const sum = primary + secondary;
  if (sum <= 6) return 1;
  if (sum === 7) return primary === 3 ? 2 : 3;
  if (sum === 8) return 4;
  return 5;
}

function badField(field: string, message: string): BadRequestException {
  return new BadRequestException({
    code: 'VALIDATION_FAILED',
    message: 'Request validation failed',
    details: [{ field, errors: [message] }],
  });
}

function optionalUuid(fields: Record<string, string>): string | undefined {
  const value = fields.clientUuid?.trim();
  if (!value) return undefined;
  if (!UUID.test(value))
    throw badField('clientUuid', 'clientUuid must be a UUID');
  return value.toLowerCase();
}

const notFound = () =>
  new NotFoundException({ code: 'NOT_FOUND', message: 'File not found' });

const rejected = (message: string) =>
  new UnprocessableEntityException({ code: 'UPLOAD_REJECTED', message });

export function toStudyView(s: ImagingStudy): ImagingStudyView {
  return {
    id: s.id,
    patientId: s.patientId,
    modality: s.modality,
    mimeType: s.mimeType,
    sizeBytes: Number(s.sizeBytes),
    sha256: s.sha256,
    status: s.status,
    studyInstanceUid: s.studyInstanceUid,
    seriesInstanceUid: s.seriesInstanceUid,
    uploadedById: s.uploadedById,
    aiReady: s.deidStorageKey !== null,
    aiExcludedReason:
      s.deidStorageKey !== null
        ? null
        : (s.aiExcludedReason ?? NOT_DEIDENTIFIED_YET),
    createdAt: s.createdAt.toISOString(),
  };
}

/** Files uploaded before Phase 15 have no de-identified copy yet. */
export const NOT_DEIDENTIFIED_YET =
  'Not sent to the AI: uploaded before files were de-identified; upload it again to use it in an analysis.';

export function toSpecimenView(s: HistopathologySpecimen): SpecimenView {
  return {
    id: s.id,
    patientId: s.patientId,
    format: s.format,
    stain: s.stain,
    biopsyDate: s.biopsyDate?.toISOString().slice(0, 10) ?? null,
    sizeBytes: Number(s.sizeBytes),
    sha256: s.sha256,
    status: s.status,
    gleasonPrimary: s.gleasonPrimary,
    gleasonSecondary: s.gleasonSecondary,
    isupGradeGroup: s.isupGradeGroup,
    reviewedAt: s.reviewedAt?.toISOString() ?? null,
    uploadedById: s.uploadedById,
    createdAt: s.createdAt.toISOString(),
  };
}

export interface FileContent {
  body: Readable;
  mimeType: string;
  fileName: string;
}

/**
 * Imaging studies and histopathology slides: streamed upload with size, type
 * and header checks, facility-scoped reads, and the pathologist review.
 * A file is only recorded after it passed every check; rejected files are
 * deleted and the rejection is audited.
 */
@Injectable()
export class ImagingService {
  private readonly logger = new Logger(ImagingService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly mongo: MongoService,
    private readonly patients: PatientsService,
    private readonly audit: AuditService,
    @Inject(OBJECT_STORAGE) private readonly storage: ObjectStorage,
    @Inject(APP_CONFIG) private readonly config: AppConfig,
    private readonly crypto: FieldCrypto,
  ) {}

  // ---------------------------------------------------------------------------
  // Imaging studies
  // ---------------------------------------------------------------------------

  async uploadImaging(
    patientId: string,
    req: Request,
    user: AuthenticatedUser,
    ctx: RequestContext,
  ): Promise<{ study: ImagingStudyView; created: boolean }> {
    const patient = await this.patients.requireInFacility(user, patientId);
    // Filled in by the upload callbacks (a holder, so types are not narrowed).
    const form: {
      modality: ImagingModalityName;
      clientUuid?: string;
      existing: ImagingStudy | null;
      key?: string;
    } = { modality: 'MRI', existing: null };

    const upload = await receiveUpload(req, {
      maxBytes: this.config.uploads.maxImagingBytes,
      fields: ['modality', 'clientUuid'],
      keepHeadBytes: DICOM_HEAD_BYTES,
      accept: (f) => ['DICOM', 'JPEG', 'PNG'].includes(f.kind),
      shouldStore: async (fields) => {
        const m = fields.modality?.trim().toUpperCase();
        if (!IMAGING_MODALITIES.includes(m as ImagingModalityName)) {
          throw badField('modality', 'modality must be MRI, TRUS or CT');
        }
        form.modality = m as ImagingModalityName;
        form.clientUuid = optionalUuid(fields);
        form.existing = form.clientUuid
          ? await this.prisma.imagingStudy.findUnique({
              where: { clientUuid: form.clientUuid },
            })
          : null;
        if (form.existing) this.assertSameUpload(form.existing, patient, user);
        return !form.existing;
      },
      store: async (file, body) => {
        form.key = generateObjectKey('imaging', file.extension);
        await this.storage.put(form.key, body, { contentType: file.mimeType });
      },
    });
    if (!upload.stored || !form.key) {
      return { study: toStudyView(form.existing!), created: false };
    }
    const { modality, clientUuid, key } = form;

    let dicom: ReturnType<typeof readDicomHeader> | undefined;
    const problem = (() => {
      if (upload.file.kind !== 'DICOM') {
        return modality === 'TRUS'
          ? null
          : `${modality} images must be DICOM files`;
      }
      try {
        dicom = readDicomHeader(upload.head);
      } catch {
        return 'The DICOM header could not be read';
      }
      if (!dicom.modality) return 'The DICOM file does not say its modality';
      const accepted: readonly string[] = DICOM_MODALITY_CODES[modality];
      if (!accepted.includes(dicom.modality)) {
        return `This DICOM file is modality ${dicom.modality}, not ${modality}`;
      }
      return null;
    })();
    if (problem) {
      await this.discard(key, 'imaging', patient.id, problem, user, ctx);
      throw rejected(problem);
    }

    let aiCopy: AiCopy | undefined;
    try {
      aiCopy = await this.makeAiCopy(
        key,
        upload.file.kind,
        upload.file.mimeType,
        upload.head,
        upload.sizeBytes,
      );
      const copy = aiCopy;
      const study = await this.prisma.$transaction(async (tx) => {
        const created = await tx.imagingStudy.create({
          data: {
            patientId: patient.id,
            modality,
            storageKey: key,
            deidStorageKey: copy.key,
            aiExcludedReason: copy.excludedReason,
            sha256: upload.sha256,
            sizeBytes: BigInt(upload.sizeBytes),
            mimeType: upload.file.mimeType,
            studyInstanceUid: dicom?.studyInstanceUid ?? null,
            seriesInstanceUid: dicom?.seriesInstanceUid ?? null,
            status: 'VALIDATED',
            uploadedById: user.id,
            clientUuid: clientUuid ?? null,
          },
        });
        await this.audit.record(
          {
            action: 'imaging.uploaded',
            entityType: 'imaging_study',
            entityId: created.id,
            outcome: 'SUCCESS',
            actorUserId: user.id,
            actorRole: user.roles.join(','),
            details: {
              patientId: patient.id,
              modality,
              kind: upload.file.kind,
              sizeBytes: upload.sizeBytes,
              // Which attributes were de-identified (names, never values).
              deidentified: copy.changed,
              aiExcludedReason: copy.excludedReason,
            },
            ...ctx,
          },
          tx,
        );
        return created;
      });
      await this.saveMetadata(study, dicom);
      return { study: toStudyView(study), created: true };
    } catch (err) {
      // Two retries raced with the same clientUuid: keep the first one.
      await this.storage.delete(key).catch(() => undefined);
      if (aiCopy?.key) {
        await this.storage.delete(aiCopy.key).catch(() => undefined);
      }
      if (clientUuid && isUniqueViolation(err)) {
        const first = await this.prisma.imagingStudy.findUnique({
          where: { clientUuid },
        });
        if (first) return { study: toStudyView(first), created: false };
      }
      throw err;
    }
  }

  /**
   * Makes the copy of an accepted image that the AI may receive (NFR-10):
   * DICOM header values that identify a person are overwritten in place;
   * JPEG and PNG metadata is removed. When that is not possible the file is
   * kept for clinicians but never sent to the AI, with the reason recorded.
   */
  private async makeAiCopy(
    key: string,
    kind: string,
    mimeType: string,
    head: Buffer,
    sizeBytes: number,
  ): Promise<AiCopy> {
    try {
      if (kind === 'DICOM') {
        const { head: clean, changed } = deidentifyDicomHead(head, (uid) =>
          uidFromHash(this.crypto.hmac(`dicom-uid:${uid}`)),
        );
        const copyKey = generateObjectKey('imaging-deid', '.dcm');
        const original = await this.storage.get(key);
        await this.storage.put(copyKey, original.pipe(replaceHead(clean)), {
          contentType: mimeType,
        });
        return { key: copyKey, excludedReason: null, changed };
      }
      if (kind === 'JPEG' || kind === 'PNG') {
        if (sizeBytes > MAX_IN_MEMORY_IMAGE_BYTES) {
          throw new DeidentificationError(
            'The image is too large to remove its hidden details',
          );
        }
        const original = await readAll(await this.storage.get(key));
        const { file, removed } = stripImageMetadata(original, kind);
        const copyKey = generateObjectKey(
          'imaging-deid',
          kind === 'JPEG' ? '.jpg' : '.png',
        );
        await this.storage.put(copyKey, bufferStream(file), {
          contentType: mimeType,
        });
        return {
          key: copyKey,
          excludedReason: null,
          changed: removed > 0 ? ['Image metadata'] : [],
        };
      }
      throw new DeidentificationError(
        'This kind of file cannot be de-identified',
      );
    } catch (err) {
      if (!(err instanceof DeidentificationError)) throw err;
      return {
        key: null,
        excludedReason: `Not sent to the AI: ${err.reason.charAt(0).toLowerCase()}${err.reason.slice(1)}.`,
        changed: [],
      };
    }
  }

  async listImaging(
    patientId: string,
    user: AuthenticatedUser,
    ctx: RequestContext,
  ): Promise<ImagingStudyView[]> {
    const patient = await this.patients.requireInFacility(user, patientId);
    const studies = await this.prisma.imagingStudy.findMany({
      where: { patientId: patient.id },
      orderBy: { createdAt: 'desc' },
    });
    await this.recordRead('imaging.listed', 'patient', patient.id, user, ctx, {
      count: studies.length,
    });
    return studies.map(toStudyView);
  }

  async getImaging(
    id: string,
    user: AuthenticatedUser,
  ): Promise<ImagingStudyView> {
    return toStudyView(await this.requireStudy(id, user));
  }

  async imagingContent(
    id: string,
    user: AuthenticatedUser,
    ctx: RequestContext,
  ): Promise<FileContent> {
    const study = await this.requireStudy(id, user);
    await this.recordRead(
      'imaging.content_read',
      'imaging_study',
      study.id,
      user,
      ctx,
      {
        patientId: study.patientId,
      },
    );
    const extension = study.storageKey.slice(study.storageKey.lastIndexOf('.'));
    return {
      body: await this.storage.get(study.storageKey),
      mimeType: study.mimeType,
      fileName: `${study.id}${extension}`,
    };
  }

  // ---------------------------------------------------------------------------
  // Histopathology slides
  // ---------------------------------------------------------------------------

  async uploadSlide(
    patientId: string,
    req: Request,
    user: AuthenticatedUser,
    ctx: RequestContext,
  ): Promise<{ specimen: SpecimenView; created: boolean }> {
    const patient = await this.patients.requireInFacility(user, patientId);
    const form: {
      format: SlideFormat;
      stain: string | null;
      biopsyDate: string | null;
      clientUuid?: string;
      existing: HistopathologySpecimen | null;
      key?: string;
    } = { format: 'TIFF', stain: null, biopsyDate: null, existing: null };

    const upload = await receiveUpload(req, {
      maxBytes: this.config.uploads.maxSlideBytes,
      fields: ['format', 'stain', 'biopsyDate', 'clientUuid'],
      accept: (f) => f.kind === 'TIFF' || f.kind === 'BIGTIFF',
      shouldStore: async (fields) => {
        const f = (fields.format?.trim() || 'TIFF').toUpperCase();
        if (!SLIDE_FORMATS.includes(f as SlideFormat)) {
          throw badField('format', 'format must be SVS, TIFF or NDPI');
        }
        form.format = f as SlideFormat;
        const s = fields.stain?.trim();
        if (s) {
          if (s.length > 40 || !isSafeText(s)) {
            throw badField(
              'stain',
              'stain must be plain text, 40 characters at most',
            );
          }
          form.stain = s;
        }
        const d = fields.biopsyDate?.trim();
        if (d) {
          if (!isPastCalendarDate(d)) {
            throw badField(
              'biopsyDate',
              'biopsyDate must be a real date, not in the future',
            );
          }
          form.biopsyDate = d;
        }
        form.clientUuid = optionalUuid(fields);
        form.existing = form.clientUuid
          ? await this.prisma.histopathologySpecimen.findUnique({
              where: { clientUuid: form.clientUuid },
            })
          : null;
        if (form.existing) this.assertSameUpload(form.existing, patient, user);
        return !form.existing;
      },
      store: async (file, body) => {
        form.key = generateObjectKey('slides', file.extension);
        await this.storage.put(form.key, body, { contentType: file.mimeType });
      },
    });
    if (!upload.stored || !form.key) {
      return { specimen: toSpecimenView(form.existing!), created: false };
    }
    const { format, stain, biopsyDate, clientUuid, key } = form;

    try {
      const specimen = await this.prisma.$transaction(async (tx) => {
        const created = await tx.histopathologySpecimen.create({
          data: {
            patientId: patient.id,
            storageKey: key,
            sha256: upload.sha256,
            sizeBytes: BigInt(upload.sizeBytes),
            format,
            stain,
            biopsyDate: biopsyDate ? new Date(`${biopsyDate}T00:00:00Z`) : null,
            status: 'VALIDATED',
            uploadedById: user.id,
            clientUuid: clientUuid ?? null,
          },
        });
        await this.audit.record(
          {
            action: 'histopathology.uploaded',
            entityType: 'histopathology_specimen',
            entityId: created.id,
            outcome: 'SUCCESS',
            actorUserId: user.id,
            actorRole: user.roles.join(','),
            details: {
              patientId: patient.id,
              format,
              sizeBytes: upload.sizeBytes,
            },
            ...ctx,
          },
          tx,
        );
        return created;
      });
      return { specimen: toSpecimenView(specimen), created: true };
    } catch (err) {
      await this.storage.delete(key).catch(() => undefined);
      if (clientUuid && isUniqueViolation(err)) {
        const first = await this.prisma.histopathologySpecimen.findUnique({
          where: { clientUuid },
        });
        if (first) return { specimen: toSpecimenView(first), created: false };
      }
      throw err;
    }
  }

  async listSlides(
    patientId: string,
    user: AuthenticatedUser,
    ctx: RequestContext,
  ): Promise<SpecimenView[]> {
    const patient = await this.patients.requireInFacility(user, patientId);
    const specimens = await this.prisma.histopathologySpecimen.findMany({
      where: { patientId: patient.id },
      orderBy: { createdAt: 'desc' },
    });
    await this.recordRead(
      'histopathology.listed',
      'patient',
      patient.id,
      user,
      ctx,
      {
        count: specimens.length,
      },
    );
    return specimens.map(toSpecimenView);
  }

  async getSlide(id: string, user: AuthenticatedUser): Promise<SpecimenView> {
    return toSpecimenView(await this.requireSpecimen(id, user));
  }

  async slideContent(
    id: string,
    user: AuthenticatedUser,
    ctx: RequestContext,
  ): Promise<FileContent> {
    const specimen = await this.requireSpecimen(id, user);
    await this.recordRead(
      'histopathology.content_read',
      'histopathology_specimen',
      specimen.id,
      user,
      ctx,
      { patientId: specimen.patientId },
    );
    return {
      body: await this.storage.get(specimen.storageKey),
      mimeType: 'image/tiff',
      fileName: `${specimen.id}.${specimen.format.toLowerCase()}`,
    };
  }

  /** Slides in the pathologist's facility that are waiting for a review, oldest first. */
  async reviewQueue(user: AuthenticatedUser): Promise<SpecimenView[]> {
    const facilityId = this.patients.staffFacility(user);
    const specimens = await this.prisma.histopathologySpecimen.findMany({
      where: {
        status: 'VALIDATED',
        reviewedById: null,
        patient: { facilityId },
      },
      orderBy: { createdAt: 'asc' },
      take: 100,
    });
    return specimens.map(toSpecimenView);
  }

  async review(
    id: string,
    dto: ReviewSpecimenDto,
    user: AuthenticatedUser,
    ctx: RequestContext,
  ): Promise<SpecimenView> {
    const specimen = await this.requireSpecimen(id, user);
    const grade = isupGradeGroup(dto.gleasonPrimary, dto.gleasonSecondary);
    const updated = await this.prisma.$transaction(async (tx) => {
      // Conditional update: a slide is reviewed once; corrections are a later feature.
      const result = await tx.histopathologySpecimen.updateMany({
        where: { id: specimen.id, reviewedById: null },
        data: {
          gleasonPrimary: dto.gleasonPrimary,
          gleasonSecondary: dto.gleasonSecondary,
          isupGradeGroup: grade,
          reviewedById: user.id,
          reviewedAt: new Date(),
        },
      });
      if (result.count === 0) {
        throw new ConflictException({
          code: 'ALREADY_REVIEWED',
          message: 'This slide has already been reviewed',
        });
      }
      await this.audit.record(
        {
          action: 'histopathology.reviewed',
          entityType: 'histopathology_specimen',
          entityId: specimen.id,
          outcome: 'SUCCESS',
          actorUserId: user.id,
          actorRole: user.roles.join(','),
          details: { patientId: specimen.patientId },
          ...ctx,
        },
        tx,
      );
      return tx.histopathologySpecimen.findUniqueOrThrow({
        where: { id: specimen.id },
      });
    });
    return toSpecimenView(updated);
  }

  // ---------------------------------------------------------------------------

  /** A clientUuid may only be replayed by the same person for the same patient. */
  private assertSameUpload(
    existing: { patientId: string; uploadedById: string },
    patient: Patient,
    user: AuthenticatedUser,
  ): void {
    if (
      existing.patientId !== patient.id ||
      existing.uploadedById !== user.id
    ) {
      throw new ConflictException({
        code: 'CONFLICT',
        message: 'This client id is already used by another upload',
      });
    }
  }

  private async requireStudy(
    id: string,
    user: AuthenticatedUser,
  ): Promise<ImagingStudy> {
    const study = await this.prisma.imagingStudy.findUnique({ where: { id } });
    if (!study) throw notFound();
    try {
      await this.patients.requireInFacility(user, study.patientId);
    } catch (err) {
      if (err instanceof NotFoundException) throw notFound();
      throw err;
    }
    return study;
  }

  private async requireSpecimen(
    id: string,
    user: AuthenticatedUser,
  ): Promise<HistopathologySpecimen> {
    const specimen = await this.prisma.histopathologySpecimen.findUnique({
      where: { id },
    });
    if (!specimen) throw notFound();
    try {
      await this.patients.requireInFacility(user, specimen.patientId);
    } catch (err) {
      if (err instanceof NotFoundException) throw notFound();
      throw err;
    }
    return specimen;
  }

  /** Deletes a file that failed a check and records why (no identifiers). */
  private async discard(
    key: string,
    kind: 'imaging' | 'histopathology',
    patientId: string,
    reason: string,
    user: AuthenticatedUser,
    ctx: RequestContext,
  ): Promise<void> {
    await this.storage.delete(key).catch(() => undefined);
    await this.audit.record({
      action: `${kind}.rejected`,
      entityType: 'patient',
      entityId: patientId,
      outcome: 'FAILURE',
      actorUserId: user.id,
      actorRole: user.roles.join(','),
      details: { reason },
      ...ctx,
    });
  }

  private async recordRead(
    action: string,
    entityType: string,
    entityId: string,
    user: AuthenticatedUser,
    ctx: RequestContext,
    details: Record<string, unknown>,
  ): Promise<void> {
    await this.audit.record({
      action,
      entityType,
      entityId,
      outcome: 'SUCCESS',
      actorUserId: user.id,
      actorRole: user.roles.join(','),
      details,
      ...ctx,
    });
  }

  /** Technical DICOM fields only (never patient tags), kept in MongoDB. */
  private async saveMetadata(
    study: ImagingStudy,
    dicom: ReturnType<typeof readDicomHeader> | undefined,
  ): Promise<void> {
    try {
      const db = await this.mongo.db();
      await db.collection('imaging_metadata').insertOne({
        imagingStudyId: study.id,
        modality: study.modality,
        dicom: dicom
          ? Object.fromEntries(
              Object.entries(dicom).filter(([, v]) => v !== undefined),
            )
          : {},
        createdAt: new Date(),
      });
    } catch (err) {
      // The study itself is recorded; the metadata copy is secondary.
      this.logger.warn(
        `Could not store imaging metadata: ${(err as Error).name}`,
      );
    }
  }
}

function isUniqueViolation(err: unknown): boolean {
  return (
    err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002'
  );
}

async function readAll(stream: Readable): Promise<Buffer> {
  const chunks: Buffer[] = [];
  for await (const chunk of stream) chunks.push(chunk as Buffer);
  return Buffer.concat(chunks);
}

function bufferStream(buffer: Buffer): Readable {
  return Readable.from([buffer]);
}
