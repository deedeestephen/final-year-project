import { randomInt } from 'node:crypto';
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { Patient, Prisma } from '@prisma/client';
import {
  FieldCrypto,
  normalizeNationalId,
} from '../../common/crypto/field-crypto';
import { ageInYears } from '../../common/validation/calendar-date';
import { PrismaService } from '../../infrastructure/database/prisma.service';
import type {
  AuthenticatedUser,
  RequestContext,
} from '../access/access.decorators';
import { AuditService } from '../audit/audit.service';
import type {
  CreatePatientDto,
  ListPatientsQuery,
  PatientPage,
  PatientSummary,
  PatientView,
  UpdatePatientDto,
} from './patients.dto';

const notFound = () =>
  new NotFoundException({ code: 'NOT_FOUND', message: 'Patient not found' });

/** Shows only the last 4 characters of a national ID (data minimisation). */
export function maskNationalId(value: string): string {
  const keep = value.slice(-4);
  return `${'*'.repeat(Math.max(0, value.length - 4))}${keep}`;
}

@Injectable()
export class PatientsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly crypto: FieldCrypto,
    private readonly audit: AuditService,
  ) {}

  // ---------------------------------------------------------------------------
  // Access helpers shared with clinical records and consents
  // ---------------------------------------------------------------------------

  /** Staff facility of the caller; clinical staff without a facility cannot access patients. */
  staffFacility(user: AuthenticatedUser): string {
    if (!user.facilityId) {
      throw new ForbiddenException({
        code: 'FORBIDDEN',
        message: 'Your account is not assigned to a facility',
      });
    }
    return user.facilityId;
  }

  /**
   * Loads a patient in the caller's facility. Patients elsewhere are reported
   * as "not found" so that their existence is not revealed.
   */
  async requireInFacility(
    user: AuthenticatedUser,
    patientId: string,
  ): Promise<Patient> {
    const patient = await this.prisma.patient.findUnique({
      where: { id: patientId },
    });
    if (!patient || patient.facilityId !== this.staffFacility(user))
      throw notFound();
    return patient;
  }

  /** The patient record linked to the caller's own app account. */
  async requireOwn(user: AuthenticatedUser): Promise<Patient> {
    const patient = await this.prisma.patient.findUnique({
      where: { userId: user.id },
    });
    if (!patient) {
      throw new NotFoundException({
        code: 'NOT_FOUND',
        message: 'No patient record is linked to this account yet',
      });
    }
    return patient;
  }

  // ---------------------------------------------------------------------------

  /** Returns the patient and whether it was newly created (idempotent on clientUuid). */
  async create(
    dto: CreatePatientDto,
    user: AuthenticatedUser,
    ctx: RequestContext,
  ): Promise<{ patient: PatientView; created: boolean }> {
    const facilityId = this.staffFacility(user);

    // Idempotent offline creation: the same client id returns the same record.
    if (dto.clientUuid) {
      const existing = await this.prisma.patient.findUnique({
        where: { clientUuid: dto.clientUuid },
      });
      if (existing) {
        if (existing.facilityId !== facilityId) throw notFound();
        return { patient: this.toView(existing), created: false };
      }
    }

    const nationalId = dto.nationalId
      ? normalizeNationalId(dto.nationalId)
      : undefined;
    const nationalIdHmac = nationalId ? this.crypto.hmac(nationalId) : null;
    if (
      nationalIdHmac &&
      (await this.prisma.patient.findUnique({ where: { nationalIdHmac } }))
    ) {
      throw new ConflictException({
        code: 'DUPLICATE_PATIENT',
        message: 'A patient with this national ID is already registered',
      });
    }

    const created = await this.prisma.$transaction(async (tx) => {
      const patient = await tx.patient.create({
        data: {
          facilityId,
          mrn: dto.mrn ?? this.generateMrn(),
          givenNameEnc: this.crypto.encrypt(dto.givenName.trim()),
          familyNameEnc: this.crypto.encrypt(dto.familyName.trim()),
          nationalIdEnc: nationalId ? this.crypto.encrypt(nationalId) : null,
          nationalIdHmac,
          phoneEnc: dto.phone ? this.crypto.encrypt(dto.phone.trim()) : null,
          dateOfBirth: new Date(`${dto.dateOfBirth}T00:00:00Z`),
          regionClass: dto.regionClass,
          district: dto.district?.trim() ?? null,
          clientUuid: dto.clientUuid ?? null,
          createdById: user.id,
        },
      });
      await this.audit.record(
        {
          action: 'patient.created',
          entityType: 'patient',
          entityId: patient.id,
          outcome: 'SUCCESS',
          actorUserId: user.id,
          actorRole: user.roles.join(','),
          details: { facilityId, offline: Boolean(dto.clientUuid) },
          ...ctx,
        },
        tx,
      );
      return patient;
    });
    return { patient: this.toView(created), created: true };
  }

  async list(
    query: ListPatientsQuery,
    user: AuthenticatedUser,
    ctx: RequestContext,
  ): Promise<PatientPage> {
    const where: Prisma.PatientWhereInput = {
      facilityId: this.staffFacility(user),
      ...(query.mrn ? { mrn: query.mrn } : {}),
      ...(query.nationalId
        ? {
            nationalIdHmac: this.crypto.hmac(
              normalizeNationalId(query.nationalId),
            ),
          }
        : {}),
    };
    const [rows, total] = await this.prisma.$transaction([
      this.prisma.patient.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
      }),
      this.prisma.patient.count({ where }),
    ]);
    await this.audit.record({
      action: 'patient.search',
      entityType: 'patient',
      outcome: 'SUCCESS',
      actorUserId: user.id,
      actorRole: user.roles.join(','),
      // Which criteria were used, never their values.
      details: {
        byNationalId: Boolean(query.nationalId),
        byMrn: Boolean(query.mrn),
        results: rows.length,
      },
      ...ctx,
    });
    return {
      items: rows.map((p) => this.toSummary(p)),
      page: query.page,
      pageSize: query.pageSize,
      total,
    };
  }

  async get(
    patientId: string,
    user: AuthenticatedUser,
    ctx: RequestContext,
  ): Promise<PatientView> {
    const patient = await this.requireInFacility(user, patientId);
    await this.recordRead(patient.id, user, ctx);
    return this.toView(patient);
  }

  async getOwn(
    user: AuthenticatedUser,
    ctx: RequestContext,
  ): Promise<PatientView> {
    const patient = await this.requireOwn(user);
    await this.recordRead(patient.id, user, ctx);
    return this.toView(patient);
  }

  /** Optimistic concurrency: a stale `version` is rejected, never silently overwritten. */
  async update(
    patientId: string,
    dto: UpdatePatientDto,
    user: AuthenticatedUser,
    ctx: RequestContext,
  ): Promise<PatientView> {
    const patient = await this.requireInFacility(user, patientId);
    if (dto.accountUserId)
      await this.assertLinkablePatientAccount(dto.accountUserId, patient.id);

    const updated = await this.prisma.$transaction(async (tx) => {
      const result = await tx.patient.updateMany({
        where: { id: patient.id, version: dto.version },
        data: {
          givenNameEnc: dto.givenName
            ? this.crypto.encrypt(dto.givenName.trim())
            : undefined,
          familyNameEnc: dto.familyName
            ? this.crypto.encrypt(dto.familyName.trim())
            : undefined,
          phoneEnc: dto.phone
            ? this.crypto.encrypt(dto.phone.trim())
            : undefined,
          regionClass: dto.regionClass,
          district: dto.district?.trim(),
          userId: dto.accountUserId,
          version: { increment: 1 },
        },
      });
      if (result.count !== 1) return null;
      await this.audit.record(
        {
          action: 'patient.updated',
          entityType: 'patient',
          entityId: patient.id,
          outcome: 'SUCCESS',
          actorUserId: user.id,
          actorRole: user.roles.join(','),
          details: {
            fields: Object.keys(dto).filter(
              (k) =>
                k !== 'version' &&
                dto[k as keyof UpdatePatientDto] !== undefined,
            ),
          },
          ...ctx,
        },
        tx,
      );
      return tx.patient.findUniqueOrThrow({ where: { id: patient.id } });
    });

    if (!updated) {
      const current = await this.prisma.patient.findUniqueOrThrow({
        where: { id: patient.id },
      });
      throw new ConflictException({
        code: 'VERSION_CONFLICT',
        message:
          'The patient record was changed by someone else. Reload and try again.',
        details: { currentVersion: current.version },
      });
    }
    return this.toView(updated);
  }

  // ---------------------------------------------------------------------------

  private async assertLinkablePatientAccount(
    userId: string,
    patientId: string,
  ): Promise<void> {
    const account = await this.prisma.user.findUnique({
      where: { id: userId },
      include: { roles: { include: { role: true } }, patientProfile: true },
    });
    const isPatient = account?.roles.some((r) => r.role.name === 'PATIENT');
    if (!account || !isPatient) {
      throw new BadRequestException({
        code: 'INVALID_REFERENCE',
        message: 'accountUserId must refer to a patient app account',
      });
    }
    if (account.patientProfile && account.patientProfile.id !== patientId) {
      throw new ConflictException({
        code: 'CONFLICT',
        message: 'This app account is already linked to another patient',
      });
    }
  }

  private recordRead(
    patientId: string,
    user: AuthenticatedUser,
    ctx: RequestContext,
  ): Promise<void> {
    return this.audit.record({
      action: 'patient.read',
      entityType: 'patient',
      entityId: patientId,
      outcome: 'SUCCESS',
      actorUserId: user.id,
      actorRole: user.roles.join(','),
      ...ctx,
    });
  }

  private generateMrn(): string {
    return `PCA-${new Date().getUTCFullYear()}-${String(randomInt(0, 1_000_000)).padStart(6, '0')}`;
  }

  toSummary(p: Patient): PatientSummary {
    return {
      id: p.id,
      mrn: p.mrn,
      givenName: this.crypto.decrypt(p.givenNameEnc),
      familyName: this.crypto.decrypt(p.familyNameEnc),
      ageYears: ageInYears(p.dateOfBirth),
      regionClass: p.regionClass,
      version: p.version,
    };
  }

  toView(p: Patient): PatientView {
    return {
      ...this.toSummary(p),
      facilityId: p.facilityId,
      nationalIdMasked: p.nationalIdEnc
        ? maskNationalId(this.crypto.decrypt(p.nationalIdEnc))
        : null,
      phone: p.phoneEnc ? this.crypto.decrypt(p.phoneEnc) : null,
      dateOfBirth: p.dateOfBirth.toISOString().slice(0, 10),
      district: p.district,
      accountUserId: p.userId,
      isSynthetic: p.isSynthetic,
      createdAt: p.createdAt.toISOString(),
      updatedAt: p.updatedAt.toISOString(),
    };
  }
}
