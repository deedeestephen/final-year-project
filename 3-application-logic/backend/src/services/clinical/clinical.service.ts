import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, type ClinicalRecord, type Consent } from '@prisma/client';
import { PrismaService } from '../../persistence/database/prisma.service';
import type {
  AuthenticatedUser,
  RequestContext,
} from '../../gateway/access/access.decorators';
import { AuditService } from '../audit/audit.service';
import {
  NOTIFICATION_TEXT,
  NotificationsService,
} from '../notifications/notifications.service';
import { PatientsService } from '../patients/patients.service';
import type {
  ClinicalRecordView,
  ConsentView,
  CreateClinicalRecordDto,
  GrantConsentDto,
  SymptomsDto,
} from './clinical.dto';

const round3 = (n: number) => Math.round(n * 1000) / 1000;
const num = (d: Prisma.Decimal | null) => (d === null ? null : d.toNumber());

export function toClinicalView(r: ClinicalRecord): ClinicalRecordView {
  const psa = num(r.psaNgMl);
  const free = num(r.freePsaNgMl);
  const volume = num(r.prostateVolumeMl);
  return {
    id: r.id,
    patientId: r.patientId,
    facilityId: r.facilityId,
    recordedById: r.recordedById,
    encounterDate: r.encounterDate.toISOString().slice(0, 10),
    psaNgMl: psa,
    freePsaNgMl: free,
    freeToTotalPsaRatio: psa && free !== null ? round3(free / psa) : null,
    dreFinding: r.dreFinding,
    piradsScore: r.piradsScore,
    prostateVolumeMl: volume,
    psaDensity: psa !== null && volume ? round3(psa / volume) : null,
    biopsyHistory: r.biopsyHistory,
    familyHistory: r.familyHistory,
    symptoms: (r.symptoms as SymptomsDto | null) ?? null,
    notes: r.notes,
    version: r.version,
    clientUuid: r.clientUuid,
    createdAt: r.createdAt.toISOString(),
  };
}

export function toConsentView(c: Consent): ConsentView {
  return {
    id: c.id,
    patientId: c.patientId,
    type: c.type,
    status: c.status,
    method: c.method,
    consentTextVersion: c.consentTextVersion,
    grantedAt: c.grantedAt.toISOString(),
    withdrawnAt: c.withdrawnAt?.toISOString() ?? null,
    version: c.version,
  };
}

@Injectable()
export class ClinicalService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly patients: PatientsService,
    private readonly audit: AuditService,
    private readonly notifications: NotificationsService,
  ) {}

  // ---------------------------------------------------------------------------
  // Clinical records (UC-02, FR-02)
  // ---------------------------------------------------------------------------

  /** Returns the record and whether it was newly created (idempotent on clientUuid). */
  async createRecord(
    patientId: string,
    dto: CreateClinicalRecordDto,
    user: AuthenticatedUser,
    ctx: RequestContext,
  ): Promise<{ record: ClinicalRecordView; created: boolean }> {
    const patient = await this.patients.requireInFacility(user, patientId);
    if (
      dto.psaNgMl !== undefined &&
      dto.freePsaNgMl !== undefined &&
      dto.freePsaNgMl > dto.psaNgMl
    ) {
      throw new BadRequestException({
        code: 'VALIDATION_FAILED',
        message: 'Request validation failed',
        details: [
          {
            field: 'freePsaNgMl',
            errors: ['freePsaNgMl must not exceed psaNgMl'],
          },
        ],
      });
    }
    if (dto.clientUuid) {
      const existing = await this.prisma.clinicalRecord.findUnique({
        where: { clientUuid: dto.clientUuid },
      });
      if (existing) {
        if (existing.patientId !== patient.id) {
          throw new ConflictException({
            code: 'CONFLICT',
            message: 'This client id is already used by another record',
          });
        }
        return { record: toClinicalView(existing), created: false };
      }
    }

    const record = await this.prisma.$transaction(async (tx) => {
      const created = await tx.clinicalRecord.create({
        data: {
          patientId: patient.id,
          facilityId: patient.facilityId,
          recordedById: user.id,
          encounterDate: new Date(`${dto.encounterDate}T00:00:00Z`),
          psaNgMl: dto.psaNgMl ?? null,
          freePsaNgMl: dto.freePsaNgMl ?? null,
          dreFinding: dto.dreFinding,
          piradsScore: dto.piradsScore ?? null,
          prostateVolumeMl: dto.prostateVolumeMl ?? null,
          biopsyHistory: dto.biopsyHistory ?? 'UNKNOWN',
          familyHistory: dto.familyHistory ?? null,
          symptoms: dto.symptoms
            ? (JSON.parse(
                JSON.stringify(dto.symptoms),
              ) as Prisma.InputJsonObject)
            : undefined,
          notes: dto.notes?.trim() ?? null,
          clientUuid: dto.clientUuid ?? null,
        },
      });
      await this.notifications.notifyPatient(
        patient.id,
        NOTIFICATION_TEXT.recordAdded,
        tx,
      );
      // Last: the audit row takes the chain lock until commit (Phase 17).
      await this.audit.record(
        {
          action: 'clinical_record.created',
          entityType: 'clinical_record',
          entityId: created.id,
          outcome: 'SUCCESS',
          actorUserId: user.id,
          actorRole: user.roles.join(','),
          details: { patientId: patient.id, offline: Boolean(dto.clientUuid) },
          ...ctx,
        },
        tx,
      );
      return created;
    });
    return { record: toClinicalView(record), created: true };
  }

  /** Patient history: newest encounter first. */
  async listRecords(
    patientId: string,
    user: AuthenticatedUser,
    ctx: RequestContext,
  ): Promise<ClinicalRecordView[]> {
    const patient = await this.patients.requireInFacility(user, patientId);
    const records = await this.prisma.clinicalRecord.findMany({
      where: { patientId: patient.id },
      orderBy: [{ encounterDate: 'desc' }, { createdAt: 'desc' }],
    });
    await this.audit.record({
      action: 'clinical_record.list',
      entityType: 'patient',
      entityId: patient.id,
      outcome: 'SUCCESS',
      actorUserId: user.id,
      actorRole: user.roles.join(','),
      details: { results: records.length },
      ...ctx,
    });
    return records.map(toClinicalView);
  }

  /** The caller's own screening history (patient app), newest first. */
  async listOwnRecords(
    user: AuthenticatedUser,
    ctx: RequestContext,
  ): Promise<ClinicalRecordView[]> {
    const patient = await this.patients.requireOwn(user);
    const records = await this.prisma.clinicalRecord.findMany({
      where: { patientId: patient.id },
      orderBy: [{ encounterDate: 'desc' }, { createdAt: 'desc' }],
    });
    await this.audit.record({
      action: 'clinical_record.read_self',
      entityType: 'patient',
      entityId: patient.id,
      outcome: 'SUCCESS',
      actorUserId: user.id,
      actorRole: user.roles.join(','),
      details: { results: records.length },
      ...ctx,
    });
    return records.map(toClinicalView);
  }

  async getRecord(
    recordId: string,
    user: AuthenticatedUser,
    ctx: RequestContext,
  ): Promise<ClinicalRecordView> {
    const record = await this.prisma.clinicalRecord.findUnique({
      where: { id: recordId },
    });
    const notFound = new NotFoundException({
      code: 'NOT_FOUND',
      message: 'Clinical record not found',
    });
    if (!record) throw notFound;
    try {
      await this.patients.requireInFacility(user, record.patientId);
    } catch {
      throw notFound;
    }
    await this.audit.record({
      action: 'clinical_record.read',
      entityType: 'clinical_record',
      entityId: record.id,
      outcome: 'SUCCESS',
      actorUserId: user.id,
      actorRole: user.roles.join(','),
      ...ctx,
    });
    return toClinicalView(record);
  }

  // ---------------------------------------------------------------------------
  // Consent (proposal §3.7.1)
  // ---------------------------------------------------------------------------

  async grantConsent(
    patientId: string,
    dto: GrantConsentDto,
    user: AuthenticatedUser,
    ctx: RequestContext,
  ): Promise<ConsentView> {
    const patient = await this.patients.requireInFacility(user, patientId);
    const consent = await this.prisma.$transaction(async (tx) => {
      const created = await tx.consent.create({
        data: {
          patientId: patient.id,
          type: dto.type,
          status: 'GRANTED',
          method: dto.method,
          consentTextVersion: dto.consentTextVersion,
          grantedAt: new Date(),
          capturedById: user.id,
        },
      });
      await this.audit.record(
        {
          action: 'consent.granted',
          entityType: 'consent',
          entityId: created.id,
          outcome: 'SUCCESS',
          actorUserId: user.id,
          actorRole: user.roles.join(','),
          details: {
            patientId: patient.id,
            type: dto.type,
            method: dto.method,
          },
          ...ctx,
        },
        tx,
      );
      await this.notifications.notifyPatient(
        patient.id,
        NOTIFICATION_TEXT.consentGranted,
        tx,
      );
      return created;
    });
    return toConsentView(consent);
  }

  async listConsents(
    patientId: string,
    user: AuthenticatedUser,
  ): Promise<ConsentView[]> {
    const patient = await this.patients.requireInFacility(user, patientId);
    return this.consentsOf(patient.id);
  }

  async listOwnConsents(user: AuthenticatedUser): Promise<ConsentView[]> {
    const patient = await this.patients.requireOwn(user);
    return this.consentsOf(patient.id);
  }

  async withdrawConsent(
    patientId: string,
    consentId: string,
    user: AuthenticatedUser,
    ctx: RequestContext,
  ): Promise<ConsentView> {
    const patient = await this.patients.requireInFacility(user, patientId);
    return this.withdraw(patient.id, consentId, user, ctx);
  }

  /** A patient may always withdraw their own consent. */
  async withdrawOwnConsent(
    consentId: string,
    user: AuthenticatedUser,
    ctx: RequestContext,
  ): Promise<ConsentView> {
    const patient = await this.patients.requireOwn(user);
    return this.withdraw(patient.id, consentId, user, ctx);
  }

  /** True when the patient currently has an active (granted, not withdrawn) consent of this type. */
  async hasActiveConsent(
    patientId: string,
    type: Consent['type'],
  ): Promise<boolean> {
    const count = await this.prisma.consent.count({
      where: { patientId, type, status: 'GRANTED' },
    });
    return count > 0;
  }

  private async consentsOf(patientId: string): Promise<ConsentView[]> {
    const consents = await this.prisma.consent.findMany({
      where: { patientId },
      orderBy: { grantedAt: 'desc' },
    });
    return consents.map(toConsentView);
  }

  private async withdraw(
    patientId: string,
    consentId: string,
    user: AuthenticatedUser,
    ctx: RequestContext,
  ): Promise<ConsentView> {
    const now = new Date();
    const updated = await this.prisma.$transaction(async (tx) => {
      const result = await tx.consent.updateMany({
        where: { id: consentId, patientId, status: 'GRANTED' },
        data: {
          status: 'WITHDRAWN',
          withdrawnAt: now,
          version: { increment: 1 },
        },
      });
      if (result.count !== 1) return null;
      await this.audit.record(
        {
          action: 'consent.withdrawn',
          entityType: 'consent',
          entityId: consentId,
          outcome: 'SUCCESS',
          actorUserId: user.id,
          actorRole: user.roles.join(','),
          details: { patientId, byPatient: user.roles.includes('PATIENT') },
          ...ctx,
        },
        tx,
      );
      await this.notifications.notifyPatient(
        patientId,
        NOTIFICATION_TEXT.consentWithdrawn,
        tx,
      );
      return tx.consent.findUniqueOrThrow({ where: { id: consentId } });
    });
    if (updated) return toConsentView(updated);

    const existing = await this.prisma.consent.findFirst({
      where: { id: consentId, patientId },
    });
    if (!existing) {
      throw new NotFoundException({
        code: 'NOT_FOUND',
        message: 'Consent not found',
      });
    }
    throw new ConflictException({
      code: 'ALREADY_WITHDRAWN',
      message: 'This consent has already been withdrawn',
    });
  }
}
