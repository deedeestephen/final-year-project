import {
  BadGatewayException,
  GatewayTimeoutException,
  Inject,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
  UnprocessableEntityException,
} from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import type { Bundle } from 'fhir/r4';
import { randomUUID } from 'node:crypto';
import { APP_CONFIG, type AppConfig } from '../../config/app-config';
import type {
  AuthenticatedUser,
  RequestContext,
} from '../../gateway/access/access.decorators';
import { FieldCrypto } from '../../persistence/crypto/field-crypto';
import { MongoService } from '../../persistence/database/mongo.service';
import { PrismaService } from '../../persistence/database/prisma.service';
import { AuditService } from '../audit/audit.service';
import { exportId } from './deidentify';
import type {
  FhirExportQuery,
  FhirExportSummaryView,
  FhirPushResultView,
} from './fhir.dto';
import {
  FhirBundleBuilder,
  type ExportAiReport,
  type ExportCounts,
  type ExportPurpose,
  type ExportSymptoms,
} from './fhir-mappers';
import { SmartCareClient, SmartCareError } from './smartcare.client';

/** The consent each purpose needs (purpose limitation). */
export const CONSENT_FOR = {
  RESEARCH: 'RESEARCH_USE',
  NATIONAL_EHR: 'EHR_SHARING',
} as const satisfies Record<ExportPurpose, string>;

const SYMPTOM_KEYS: (keyof ExportSymptoms)[] = [
  'nocturia',
  'frequency',
  'urgency',
  'weakStream',
  'haematuria',
  'bonePain',
  'weightLoss',
];

/** What is read from MongoDB `ai_reports` (never the patient reference). */
interface StoredAiReport {
  jobId: string;
  provenance: 'MOCK' | 'RESEARCH_MODEL';
  disclaimer: string;
  modelVersions: Record<string, string>;
  outputs: {
    pcaProbability?: number | null;
    probabilityInterval?: [number, number] | null;
    gleasonGradeGroup?: number | null;
  };
  createdAt: Date;
}

/**
 * De-identified FHIR R4 export (FR-09, UC-08, NFR-06, NFR-10). Only patients
 * with the consent the purpose needs are included, and only fields that are
 * safe after de-identification are ever read from the database: names, phone
 * numbers, national ids, record numbers, districts, notes and file references
 * are not selected at all.
 */
@Injectable()
export class FhirExportService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly mongo: MongoService,
    private readonly crypto: FieldCrypto,
    private readonly audit: AuditService,
    private readonly smartcare: SmartCareClient,
    @Inject(APP_CONFIG) private readonly config: AppConfig,
  ) {}

  async summary(query: FhirExportQuery): Promise<FhirExportSummaryView> {
    await this.requireFacility(query.facilityId);
    const scope = this.scope(query.facilityId);
    const [patientsInScope, patientsWithConsent] = await Promise.all([
      this.prisma.patient.count({ where: scope }),
      this.prisma.patient.count({
        where: this.consented(query.purpose, query.facilityId),
      }),
    ]);
    const max = this.config.fhir.maxPatients;
    const counts =
      patientsWithConsent <= max
        ? (await this.build(query.purpose, query.facilityId)).counts
        : emptyCounts();
    return {
      purpose: query.purpose,
      patientsInScope,
      patientsWithConsent,
      consentRequired: CONSENT_FOR[query.purpose],
      willExport: counts,
      maxPatients: max,
      smartcareConfigured: this.smartcare.enabled,
      smartcareHost: this.smartcare.targetHost,
    };
  }

  async export(
    query: FhirExportQuery,
    user: AuthenticatedUser,
    ctx: RequestContext,
  ): Promise<Bundle> {
    await this.requireFacility(query.facilityId);
    const { bundle, counts } = await this.build(
      query.purpose,
      query.facilityId,
    );
    await this.audit.record({
      action: 'fhir.export',
      entityType: 'fhir_bundle',
      entityId: bundle.id,
      outcome: 'SUCCESS',
      actorUserId: user.id,
      actorRole: user.roles.join(','),
      details: {
        purpose: query.purpose,
        facilityId: query.facilityId ?? null,
        ...counts,
      },
      ...ctx,
    });
    return bundle;
  }

  /** Sends the national-EHR export to SmartCare Pro. */
  async push(
    facilityId: string | undefined,
    user: AuthenticatedUser,
    ctx: RequestContext,
  ): Promise<FhirPushResultView> {
    if (!this.smartcare.enabled) {
      throw new ServiceUnavailableException({
        code: 'FHIR_TARGET_NOT_CONFIGURED',
        message: 'No SmartCare Pro address is set on this server',
      });
    }
    await this.requireFacility(facilityId);
    const { bundle, counts } = await this.build('NATIONAL_EHR', facilityId);
    const target = this.smartcare.targetHost ?? '';
    const auditBase = {
      action: 'fhir.push',
      entityType: 'fhir_bundle',
      entityId: bundle.id,
      actorUserId: user.id,
      actorRole: user.roles.join(','),
      ...ctx,
    };
    try {
      const receipt = await this.smartcare.send(bundle);
      await this.audit.record({
        ...auditBase,
        outcome: 'SUCCESS',
        details: {
          target,
          facilityId: facilityId ?? null,
          httpStatus: receipt.httpStatus,
          receiverId: receipt.receiverId,
          ...counts,
        },
      });
      return {
        status: 'SENT',
        bundleId: bundle.id!,
        httpStatus: receipt.httpStatus,
        receiverId: receipt.receiverId,
        target,
        counts,
      };
    } catch (err) {
      if (!(err instanceof SmartCareError)) throw err;
      await this.audit.record({
        ...auditBase,
        outcome: 'FAILURE',
        details: {
          target,
          facilityId: facilityId ?? null,
          reason: err.kind,
          httpStatus: err.httpStatus,
          remoteDetail: err.remoteDetail,
        },
      });
      const body = { code: `FHIR_TARGET_${err.kind}`, message: err.message };
      throw err.kind === 'TIMED_OUT'
        ? new GatewayTimeoutException(body)
        : new BadGatewayException(body);
    }
  }

  // -- building --------------------------------------------------------------

  private async build(
    purpose: ExportPurpose,
    facilityId: string | undefined,
  ): Promise<{ bundle: Bundle; counts: ExportCounts }> {
    const max = this.config.fhir.maxPatients;
    const patients = await this.prisma.patient.findMany({
      where: this.consented(purpose, facilityId),
      orderBy: { createdAt: 'asc' },
      take: max + 1,
      // Only de-identifiable fields: no names, phone, national id, MRN,
      // district, notes, stain text or storage keys.
      select: {
        id: true,
        dateOfBirth: true,
        regionClass: true,
        isSynthetic: true,
        clinicalRecords: {
          orderBy: { encounterDate: 'asc' },
          select: {
            id: true,
            encounterDate: true,
            psaNgMl: true,
            freePsaNgMl: true,
            dreFinding: true,
            piradsScore: true,
            prostateVolumeMl: true,
            biopsyHistory: true,
            familyHistory: true,
            symptoms: true,
          },
        },
        specimens: {
          where: {
            reviewedAt: { not: null },
            gleasonPrimary: { not: null },
            gleasonSecondary: { not: null },
            isupGradeGroup: { not: null },
          },
          orderBy: { createdAt: 'asc' },
          select: {
            id: true,
            biopsyDate: true,
            reviewedAt: true,
            gleasonPrimary: true,
            gleasonSecondary: true,
            isupGradeGroup: true,
          },
        },
        aiJobs: {
          where: { status: 'SUCCEEDED' },
          orderBy: { createdAt: 'asc' },
          select: { id: true },
        },
      },
    });
    if (patients.length > max) {
      throw new UnprocessableEntityException({
        code: 'EXPORT_TOO_LARGE',
        message: `More than ${max} patients would be exported. Export one facility at a time.`,
      });
    }

    const reports = await this.aiReports(
      patients.flatMap((p) => p.aiJobs.map((j) => j.id)),
    );
    const now = new Date();
    const builder = new FhirBundleBuilder(
      (kind, id) => exportId(this.crypto, kind, id),
      purpose,
      now,
    );
    for (const p of patients) {
      builder.addPatient(
        {
          id: p.id,
          dateOfBirth: p.dateOfBirth,
          regionClass: p.regionClass,
          isSynthetic: p.isSynthetic,
        },
        p.clinicalRecords.map((r) => ({
          id: r.id,
          encounterDate: r.encounterDate,
          psaNgMl: toNumber(r.psaNgMl),
          freePsaNgMl: toNumber(r.freePsaNgMl),
          dreFinding: r.dreFinding,
          piradsScore: r.piradsScore,
          prostateVolumeMl: toNumber(r.prostateVolumeMl),
          biopsyHistory: r.biopsyHistory,
          familyHistory: r.familyHistory,
          symptoms: toSymptoms(r.symptoms),
        })),
        p.specimens.map((s) => ({
          id: s.id,
          biopsyDate: s.biopsyDate,
          reviewedAt: s.reviewedAt!,
          gleasonPrimary: s.gleasonPrimary!,
          gleasonSecondary: s.gleasonSecondary!,
          isupGradeGroup: s.isupGradeGroup!,
        })),
        p.aiJobs.flatMap((j) => reports.get(j.id) ?? []),
      );
    }
    return {
      bundle: builder.build(randomUUID(), now),
      counts: builder.counts,
    };
  }

  private async aiReports(
    jobIds: string[],
  ): Promise<Map<string, ExportAiReport>> {
    const out = new Map<string, ExportAiReport>();
    if (jobIds.length === 0) return out;
    const rows = await (
      await this.mongo.db()
    )
      .collection<StoredAiReport>('ai_reports')
      .find(
        { jobId: { $in: jobIds } },
        {
          projection: {
            _id: 0,
            jobId: 1,
            provenance: 1,
            disclaimer: 1,
            modelVersions: 1,
            outputs: 1,
            createdAt: 1,
          },
        },
      )
      .toArray();
    for (const r of rows) {
      out.set(r.jobId, {
        jobId: r.jobId,
        provenance: r.provenance,
        disclaimer: r.disclaimer,
        modelVersions: r.modelVersions ?? {},
        pcaProbability: r.outputs?.pcaProbability ?? null,
        probabilityInterval: r.outputs?.probabilityInterval ?? null,
        gleasonGradeGroup: r.outputs?.gleasonGradeGroup ?? null,
        createdAt: r.createdAt,
      });
    }
    return out;
  }

  private scope(facilityId: string | undefined): Prisma.PatientWhereInput {
    return facilityId ? { facilityId } : {};
  }

  private consented(
    purpose: ExportPurpose,
    facilityId: string | undefined,
  ): Prisma.PatientWhereInput {
    return {
      ...this.scope(facilityId),
      consents: { some: { type: CONSENT_FOR[purpose], status: 'GRANTED' } },
    };
  }

  private async requireFacility(facilityId: string | undefined): Promise<void> {
    if (!facilityId) return;
    const found = await this.prisma.facility.count({
      where: { id: facilityId },
    });
    if (found === 0) {
      throw new NotFoundException({
        code: 'NOT_FOUND',
        message: 'Facility not found',
      });
    }
  }
}

function emptyCounts(): ExportCounts {
  return {
    patients: 0,
    screeningVisits: 0,
    observations: 0,
    pathologyReports: 0,
    aiReports: 0,
    aiReportsLeftOutMock: 0,
  };
}

function toNumber(v: Prisma.Decimal | null): number | null {
  return v === null ? null : Number(v);
}

/** Keeps only the known yes/no answers from the stored JSON. */
function toSymptoms(json: Prisma.JsonValue | null): ExportSymptoms | null {
  if (!json || typeof json !== 'object' || Array.isArray(json)) return null;
  const source = json as Record<string, unknown>;
  const out: ExportSymptoms = {};
  for (const key of SYMPTOM_KEYS) {
    if (typeof source[key] === 'boolean') out[key] = source[key];
  }
  return Object.keys(out).length > 0 ? out : null;
}
