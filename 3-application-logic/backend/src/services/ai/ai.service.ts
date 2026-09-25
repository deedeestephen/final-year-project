import {
  ConflictException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
  OnModuleDestroy,
  OnModuleInit,
  ServiceUnavailableException,
} from '@nestjs/common';
import type { AiJob, AiModel, ExplanationKind, Prisma } from '@prisma/client';
import { createHash, randomUUID } from 'node:crypto';
import { Readable } from 'node:stream';
import { FieldCrypto } from '../../persistence/crypto/field-crypto';
import { ageInYears } from '../../gateway/validation/calendar-date';
import { APP_CONFIG, type AppConfig } from '../../config/app-config';
import { MongoService } from '../../persistence/database/mongo.service';
import { PrismaService } from '../../persistence/database/prisma.service';
import {
  generateObjectKey,
  type ObjectStorage,
} from '../../persistence/storage/object-storage';
import { OBJECT_STORAGE } from '../../persistence/storage/storage.module';
import { sniffFile } from '../../gateway/upload/file-signatures';
import type {
  AuthenticatedUser,
  RequestContext,
} from '../../gateway/access/access.decorators';
import { AuditService } from '../audit/audit.service';
import { ClinicalService } from '../clinical/clinical.service';
import { PatientsService } from '../patients/patients.service';
import {
  AiBrokerService,
  AiServiceError,
  type AiFailureKind,
} from './ai-broker.service';
import type {
  ContractExplanation,
  InferenceRequest,
  InferenceResult,
} from './ai-contract';
import type {
  AiJobView,
  AiModelView,
  AiReportView,
  EvaluationView,
  ExplanationView,
} from './ai.dto';
import { InProcessJobQueue, type JobQueue } from './job-queue';

/** The last few validated files of each kind are sent; enough for one analysis. */
const MAX_FILES_PER_KIND = 5;

/** An explanation as kept in the report: images are referenced, never inlined. */
interface StoredExplanation {
  kind: ExplanationKind;
  module: string;
  /** ExplainabilityArtifact id, when a row exists (image or stated reason). */
  artifactId: string | null;
  available: boolean;
  unavailableReason: string | null;
  values: Record<string, number> | null;
}

interface StoredReport extends Omit<InferenceResult, 'explanations'> {
  explanations: StoredExplanation[];
  patientRef: string;
  createdAt: Date;
}

/** Largest explanation image kept (bytes). */
const MAX_ARTIFACT_BYTES = 2 * 1024 * 1024;

const NOT_ACCEPTED_REFERENCE =
  'The AI service referred to a stored file instead of sending the image; such references are not accepted.';
const INVALID_IMAGE =
  'The explanation image was not a valid PNG within 2 MB and was discarded.';

const toNumber = (v: Prisma.Decimal | null): number | undefined =>
  v === null ? undefined : Number(v);

function toJobView(job: AiJob, report: AiReportView | null = null): AiJobView {
  return {
    id: job.id,
    patientId: job.patientId,
    status: job.status,
    requestedById: job.requestedById,
    error: job.error,
    createdAt: job.createdAt.toISOString(),
    startedAt: job.startedAt?.toISOString() ?? null,
    finishedAt: job.finishedAt?.toISOString() ?? null,
    report,
  };
}

function toModelView(m: AiModel): AiModelView {
  return {
    id: m.id,
    name: m.name,
    architecture: m.architecture,
    version: m.version,
    provenance: m.provenance,
    status: m.status,
    evaluationAvailable: m.evaluation !== null,
  };
}

function toExplanationView(e: StoredExplanation): ExplanationView {
  return {
    id: e.artifactId,
    kind: e.kind,
    module: e.module,
    available: e.available,
    hasImage: e.available && e.artifactId !== null,
    unavailableReason: e.unavailableReason,
    values: e.values,
  };
}

const randomId = (): string => randomUUID();

/**
 * AI analysis jobs (UC-05): a clinician asks, the job waits in a queue, the
 * broker calls ai-services, and the validated report is kept in MongoDB.
 * Consent (AI_ANALYSIS) is checked before anything leaves the backend, and
 * only de-identified values and storage references are sent.
 */
@Injectable()
export class AiService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(AiService.name);
  private readonly queue: JobQueue;

  constructor(
    private readonly prisma: PrismaService,
    private readonly mongo: MongoService,
    private readonly patients: PatientsService,
    private readonly clinical: ClinicalService,
    private readonly audit: AuditService,
    private readonly broker: AiBrokerService,
    private readonly crypto: FieldCrypto,
    @Inject(OBJECT_STORAGE) private readonly storage: ObjectStorage,
    @Inject(APP_CONFIG) private readonly config: AppConfig,
  ) {
    this.queue = new InProcessJobQueue(
      (id) => this.run(id),
      config.ai.maxConcurrentJobs,
    );
  }

  /**
   * After a restart: jobs left RUNNING long ago are marked FAILED, and jobs
   * that waited in the old process's queue are queued again. Recent jobs are
   * left alone, in case another instance is still working on them.
   */
  async onModuleInit(): Promise<void> {
    const staleBefore = new Date(Date.now() - 2 * this.config.ai.timeoutMs);
    try {
      await this.prisma.aiJob.updateMany({
        where: { status: 'RUNNING', startedAt: { lt: staleBefore } },
        data: {
          status: 'FAILED',
          error: 'Interrupted by a server restart. Please request it again.',
          finishedAt: new Date(),
        },
      });
      const waiting = await this.prisma.aiJob.findMany({
        where: {
          status: 'QUEUED',
          createdAt: { lt: new Date(Date.now() - 60_000) },
        },
        select: { id: true },
        take: 100,
      });
      waiting.forEach((j) => this.queue.enqueue(j.id));
    } catch (err) {
      this.logger.warn(`AI job recovery skipped: ${(err as Error).name}`);
    }
  }

  async onModuleDestroy(): Promise<void> {
    await this.queue.idle();
  }

  /** Test and shutdown helper: resolves when no job is waiting or running. */
  idle(): Promise<void> {
    return this.queue.idle();
  }

  // ---------------------------------------------------------------------------

  async request(
    patientId: string,
    user: AuthenticatedUser,
    ctx: RequestContext,
  ): Promise<AiJobView> {
    if (!this.broker.enabled) {
      throw new ServiceUnavailableException({
        code: 'AI_UNAVAILABLE',
        message: 'AI analysis is switched off on this server',
      });
    }
    const patient = await this.patients.requireInFacility(user, patientId);
    if (!(await this.clinical.hasActiveConsent(patient.id, 'AI_ANALYSIS'))) {
      throw new ConflictException({
        code: 'CONSENT_REQUIRED',
        message:
          'The patient has not consented to AI analysis. Record their consent first.',
      });
    }
    const inProgress = await this.prisma.aiJob.findFirst({
      where: { patientId: patient.id, status: { in: ['QUEUED', 'RUNNING'] } },
    });
    if (inProgress) {
      throw new ConflictException({
        code: 'AI_JOB_IN_PROGRESS',
        message: 'An analysis for this patient is already running',
        details: { jobId: inProgress.id },
      });
    }
    const record = await this.prisma.clinicalRecord.findFirst({
      where: { patientId: patient.id },
      orderBy: [{ encounterDate: 'desc' }, { createdAt: 'desc' }],
    });
    if (!record) {
      throw new ConflictException({
        code: 'CLINICAL_RECORD_REQUIRED',
        message: 'Add a screening record before requesting an analysis',
      });
    }
    const [imaging, slides] = await Promise.all([
      this.prisma.imagingStudy.findMany({
        where: { patientId: patient.id, status: 'VALIDATED' },
        orderBy: { createdAt: 'desc' },
        take: MAX_FILES_PER_KIND,
      }),
      this.prisma.histopathologySpecimen.findMany({
        where: { patientId: patient.id, status: 'VALIDATED' },
        orderBy: { createdAt: 'desc' },
        take: MAX_FILES_PER_KIND,
      }),
    ]);

    // Only values and storage keys: no names, national ID, phone or record ids.
    const payload: Omit<InferenceRequest, 'jobId'> = {
      patientRef: this.patientRef(patient.id),
      inputs: {
        clinical: {
          ageYears: ageInYears(patient.dateOfBirth),
          psaNgMl: toNumber(record.psaNgMl),
          freePsaNgMl: toNumber(record.freePsaNgMl),
          dreFinding: record.dreFinding,
          piradsScore: record.piradsScore ?? undefined,
          prostateVolumeMl: toNumber(record.prostateVolumeMl),
          biopsyHistory: record.biopsyHistory,
          familyHistory: record.familyHistory ?? undefined,
        },
        imaging: imaging.map((s) => ({
          storageKey: s.storageKey,
          modality: s.modality,
        })),
        histopathology: slides.map((s) => ({
          storageKey: s.storageKey,
          ...(s.stain ? { stain: s.stain } : {}),
        })),
      },
    };

    const job = await this.prisma.$transaction(async (tx) => {
      const created = await tx.aiJob.create({
        data: {
          patientId: patient.id,
          requestedById: user.id,
          status: 'QUEUED',
          inputs: JSON.parse(JSON.stringify(payload)) as Prisma.InputJsonObject,
        },
      });
      await this.audit.record(
        {
          action: 'ai_job.requested',
          entityType: 'ai_job',
          entityId: created.id,
          outcome: 'SUCCESS',
          actorUserId: user.id,
          actorRole: user.roles.join(','),
          details: {
            patientId: patient.id,
            imaging: imaging.length,
            slides: slides.length,
          },
          ...ctx,
        },
        tx,
      );
      return created;
    });
    this.queue.enqueue(job.id);
    return toJobView(job);
  }

  async list(patientId: string, user: AuthenticatedUser): Promise<AiJobView[]> {
    const patient = await this.patients.requireInFacility(user, patientId);
    const jobs = await this.prisma.aiJob.findMany({
      where: { patientId: patient.id },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
    return jobs.map((j) => toJobView(j));
  }

  async get(
    jobId: string,
    user: AuthenticatedUser,
    ctx: RequestContext,
  ): Promise<AiJobView> {
    const job = await this.requireJob(jobId, user);
    if (job.status !== 'SUCCEEDED') return toJobView(job);

    const stored = await (
      await this.mongo.db()
    )
      .collection<StoredReport>('ai_reports')
      .findOne({ jobId: job.id });
    if (!stored) return toJobView(job);
    await this.audit.record({
      action: 'ai_report.read',
      entityType: 'ai_job',
      entityId: job.id,
      outcome: 'SUCCESS',
      actorUserId: user.id,
      actorRole: user.roles.join(','),
      details: { patientId: job.patientId },
      ...ctx,
    });
    return toJobView(job, this.toReportView(stored));
  }

  /** The registry: refreshed from ai-services when it is reachable. */
  async models(): Promise<AiModelView[]> {
    try {
      for (const m of await this.broker.models()) {
        await this.prisma.aiModel.upsert({
          where: { name_version: { name: m.name, version: m.version } },
          create: {
            name: m.name,
            architecture: m.architecture,
            version: m.version,
            provenance: m.provenance,
            status: 'ACTIVE',
          },
          // Evaluation is never copied from the service; only stored runs count.
          update: { status: 'ACTIVE' },
        });
      }
    } catch (err) {
      if (!(err instanceof AiServiceError)) throw err;
    }
    const models = await this.prisma.aiModel.findMany({
      orderBy: [{ name: 'asc' }, { version: 'asc' }],
    });
    return models.map(toModelView);
  }

  // ---------------------------------------------------------------------------

  /** Runs one job; never throws (failures are recorded on the job). */
  async run(jobId: string): Promise<void> {
    // Claim it: only a QUEUED job can start, so it never runs twice.
    const claimed = await this.prisma.aiJob.updateMany({
      where: { id: jobId, status: 'QUEUED' },
      data: { status: 'RUNNING', startedAt: new Date() },
    });
    if (claimed.count === 0) return;
    const job = await this.prisma.aiJob.findUniqueOrThrow({
      where: { id: jobId },
    });
    const started = Date.now();
    await this.log(jobId, 'started');
    try {
      const request = {
        jobId,
        ...(job.inputs as unknown as Omit<InferenceRequest, 'jobId'>),
      };
      const result = await this.broker.infer(request);
      const prepared = await this.prepareExplanations(result);
      const db = await this.mongo.db();
      const inserted = await db.collection('ai_reports').insertOne({
        ...result,
        explanations: prepared.map((p) => p.stored),
        patientRef: request.patientRef,
        createdAt: new Date(),
      });
      await this.prisma.$transaction(async (tx) => {
        for (const p of prepared) {
          if (!p.row) continue;
          await tx.explainabilityArtifact.create({
            data: { id: p.stored.artifactId!, jobId, ...p.row },
          });
        }
        await tx.aiJob.update({
          where: { id: jobId },
          data: {
            status: 'SUCCEEDED',
            modelVersions: result.modelVersions,
            reportId: inserted.insertedId.toHexString(),
            finishedAt: new Date(),
          },
        });
        await this.audit.record(
          {
            action: 'ai_job.completed',
            entityType: 'ai_job',
            entityId: jobId,
            outcome: 'SUCCESS',
            actorUserId: job.requestedById,
            details: {
              patientId: job.patientId,
              provenance: result.provenance,
              durationMs: Date.now() - started,
            },
          },
          tx,
        );
      });
      await this.log(jobId, 'succeeded', Date.now() - started);
    } catch (err) {
      const kind: AiFailureKind | 'INTERNAL' =
        err instanceof AiServiceError ? err.kind : 'INTERNAL';
      if (kind === 'INTERNAL') {
        this.logger.error(`AI job ${jobId} failed: ${(err as Error).name}`);
      }
      await this.prisma.$transaction(async (tx) => {
        await tx.aiJob.update({
          where: { id: jobId },
          data: {
            status: kind === 'TIMED_OUT' ? 'TIMED_OUT' : 'FAILED',
            error:
              err instanceof AiServiceError
                ? err.message
                : 'The analysis failed unexpectedly. Please try again.',
            finishedAt: new Date(),
          },
        });
        await this.audit.record(
          {
            action: 'ai_job.completed',
            entityType: 'ai_job',
            entityId: jobId,
            outcome: 'FAILURE',
            actorUserId: job.requestedById,
            details: { patientId: job.patientId, reason: kind },
          },
          tx,
        );
      });
      await this.log(jobId, `failed:${kind}`, Date.now() - started);
    }
  }

  async explanations(
    jobId: string,
    user: AuthenticatedUser,
  ): Promise<ExplanationView[]> {
    const job = await this.requireJob(jobId, user);
    const stored = await (
      await this.mongo.db()
    )
      .collection<StoredReport>('ai_reports')
      .findOne({ jobId: job.id });
    return (stored?.explanations ?? []).map(toExplanationView);
  }

  /** The stored explanation image (for example a Grad-CAM heatmap). */
  async explanationContent(
    artifactId: string,
    user: AuthenticatedUser,
    ctx: RequestContext,
  ): Promise<{ body: Readable; fileName: string }> {
    const artifact = await this.prisma.explainabilityArtifact.findUnique({
      where: { id: artifactId },
      include: { job: true },
    });
    if (!artifact) throw this.explanationNotFound();
    try {
      await this.patients.requireInFacility(user, artifact.job.patientId);
    } catch (err) {
      if (err instanceof NotFoundException) throw this.explanationNotFound();
      throw err;
    }
    if (!artifact.storageKey) throw this.explanationNotFound();
    await this.audit.record({
      action: 'ai_explanation.content_read',
      entityType: 'ai_job',
      entityId: artifact.jobId,
      outcome: 'SUCCESS',
      actorUserId: user.id,
      actorRole: user.roles.join(','),
      details: { patientId: artifact.job.patientId, kind: artifact.kind },
      ...ctx,
    });
    return {
      body: await this.storage.get(artifact.storageKey),
      fileName: `${artifact.id}.png`,
    };
  }

  /**
   * Performance and fairness figures for one model: only from a stored
   * evaluation run, never estimated or invented.
   */
  async evaluation(modelId: string): Promise<EvaluationView> {
    const model = await this.prisma.aiModel.findUnique({
      where: { id: modelId },
    });
    if (!model) {
      throw new NotFoundException({
        code: 'NOT_FOUND',
        message: 'Model not found',
      });
    }
    if (model.evaluation === null) {
      return {
        modelId: model.id,
        available: false,
        message: 'Evaluation data not yet available.',
        evaluation: null,
      };
    }
    return {
      modelId: model.id,
      available: true,
      message: null,
      evaluation: model.evaluation as Record<string, unknown>,
    };
  }

  /**
   * Turns the AI service's explanations into stored ones. Images are checked
   * (real PNG, at most 2 MB) and written to object storage. A reason is
   * recorded when there is no image. Anything invalid becomes "unavailable"
   * with a reason; it never fails the whole analysis.
   */
  private async prepareExplanations(result: InferenceResult): Promise<
    {
      stored: StoredExplanation;
      row?: {
        kind: ExplanationKind;
        storageKey: string | null;
        unavailableReason: string | null;
        modelId: string | null;
      };
    }[]
  > {
    const prepared = [];
    for (const e of result.explanations) {
      const modelId = await this.modelIdFor(e.module, result);
      const unavailable = (reason: string) => ({
        stored: this.storedExplanation(e, randomId(), reason),
        row: {
          kind: e.kind,
          storageKey: null,
          unavailableReason: reason,
          modelId,
        },
      });
      if (e.artifact) {
        const bytes = Buffer.from(e.artifact.dataBase64, 'base64');
        if (
          bytes.length === 0 ||
          bytes.length > MAX_ARTIFACT_BYTES ||
          sniffFile(bytes)?.kind !== 'PNG'
        ) {
          prepared.push(unavailable(INVALID_IMAGE));
          continue;
        }
        const key = generateObjectKey('xai', '.png');
        await this.storage.put(key, Readable.from(bytes), {
          contentType: 'image/png',
          sha256: createHash('sha256').update(bytes).digest('hex'),
        });
        const id = randomId();
        prepared.push({
          stored: this.storedExplanation(e, id, null),
          row: {
            kind: e.kind,
            storageKey: key,
            unavailableReason: null,
            modelId,
          },
        });
      } else if (e.storageKey) {
        prepared.push(unavailable(NOT_ACCEPTED_REFERENCE));
      } else if (e.values) {
        // SHAP values from a real model: kept in the report, no image.
        prepared.push({ stored: this.storedExplanation(e, null, null) });
      } else {
        prepared.push(unavailable(e.unavailableReason ?? INVALID_IMAGE));
      }
    }
    return prepared;
  }

  private storedExplanation(
    e: ContractExplanation,
    artifactId: string | null,
    reason: string | null,
  ): StoredExplanation {
    return {
      kind: e.kind,
      module: e.module,
      artifactId,
      available: reason === null,
      unavailableReason: reason,
      values: reason === null ? (e.values ?? null) : null,
    };
  }

  private async modelIdFor(
    module: string,
    result: InferenceResult,
  ): Promise<string | null> {
    const version = result.modelVersions[module];
    if (!version) return null;
    const model = await this.prisma.aiModel.findUnique({
      where: { name_version: { name: module, version } },
      select: { id: true },
    });
    return model?.id ?? null;
  }

  private async requireJob(
    jobId: string,
    user: AuthenticatedUser,
  ): Promise<AiJob> {
    const job = await this.prisma.aiJob.findUnique({ where: { id: jobId } });
    if (!job) throw this.jobNotFound();
    try {
      await this.patients.requireInFacility(user, job.patientId);
    } catch (err) {
      if (err instanceof NotFoundException) throw this.jobNotFound();
      throw err;
    }
    return job;
  }

  private explanationNotFound(): NotFoundException {
    return new NotFoundException({
      code: 'NOT_FOUND',
      message: 'Explanation image not found',
    });
  }

  private toReportView(r: StoredReport): AiReportView {
    const explanations = r.explanations.map(toExplanationView);
    return {
      provenance: r.provenance,
      isMock: r.provenance === 'MOCK',
      disclaimer: r.disclaimer,
      modelVersions: r.modelVersions,
      outputs: {
        pcaProbability: r.outputs.pcaProbability ?? null,
        probabilityInterval: r.outputs.probabilityInterval ?? null,
        gleasonGradeGroup: r.outputs.gleasonGradeGroup ?? null,
        modulesUsed: r.outputs.modulesUsed,
        modulesSkipped: r.outputs.modulesSkipped,
      },
      explanations,
      createdAt: r.createdAt.toISOString(),
    };
  }

  /** Stable pseudonym for the AI service: not reversible without the HMAC key. */
  private patientRef(patientId: string): string {
    return `p_${this.crypto.hmac(`ai-patient-ref:${patientId}`).slice(0, 32)}`;
  }

  private async log(
    jobId: string,
    event: string,
    durationMs?: number,
  ): Promise<void> {
    try {
      const db = await this.mongo.db();
      await db.collection('ai_inference_logs').insertOne({
        jobId,
        event,
        at: new Date(),
        ...(durationMs === undefined ? {} : { durationMs }),
      });
    } catch (err) {
      this.logger.warn(`AI log write failed: ${(err as Error).name}`);
    }
  }

  private jobNotFound(): NotFoundException {
    return new NotFoundException({
      code: 'NOT_FOUND',
      message: 'Analysis not found',
    });
  }
}
