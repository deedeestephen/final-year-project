import {
  BadRequestException,
  HttpException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, type SyncOperation } from '@prisma/client';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { flattenValidationErrors } from '../../gateway/http/validation';
import { PrismaService } from '../../persistence/database/prisma.service';
import type {
  AuthenticatedUser,
  RequestContext,
} from '../../gateway/access/access.decorators';
import type { PermissionCode } from '../../gateway/access/permissions';
import { AuditService } from '../audit/audit.service';
import { CreateClinicalRecordDto } from '../clinical/clinical.dto';
import { ClinicalService, toClinicalView } from '../clinical/clinical.service';
import { CreatePatientDto, UpdatePatientDto } from '../patients/patients.dto';
import { PatientsService } from '../patients/patients.service';
import type {
  SyncBatchDto,
  SyncBatchResponse,
  SyncChangesQuery,
  SyncChangesResponse,
  SyncErrorView,
  SyncOperationDto,
  SyncOperationResult,
} from './sync.dto';

/** A permanent, per-operation refusal (reported, not thrown to the client). */
class Rejected extends Error {
  constructor(readonly error: SyncErrorView) {
    super(error.message);
  }
}

const REQUIRED: Record<string, PermissionCode> = {
  'patient:CREATE': 'patient:create',
  'patient:UPDATE': 'patient:update',
  'clinical_record:CREATE': 'clinical:create',
};

interface Cursor {
  p: [string, string];
  r: [string, string];
}
const START: Cursor = {
  p: ['1970-01-01T00:00:00.000Z', ''],
  r: ['1970-01-01T00:00:00.000Z', ''],
};

function encodeCursor(c: Cursor): string {
  return Buffer.from(JSON.stringify(c)).toString('base64url');
}

function decodeCursor(value: string | undefined): Cursor {
  if (!value) return START;
  try {
    const c = JSON.parse(
      Buffer.from(value, 'base64url').toString('utf8'),
    ) as Cursor;
    const ok = (pair: unknown) =>
      Array.isArray(pair) &&
      pair.length === 2 &&
      typeof pair[0] === 'string' &&
      !Number.isNaN(Date.parse(pair[0])) &&
      typeof pair[1] === 'string';
    if (ok(c.p) && ok(c.r)) return c;
  } catch {
    // fall through
  }
  throw new BadRequestException({
    code: 'VALIDATION_FAILED',
    message: 'Request validation failed',
    details: [{ field: 'cursor', errors: ['cursor is not valid'] }],
  });
}

/**
 * Offline synchronisation (FR-03, UC-02). Each operation goes through the same
 * services, access checks and audit as the REST endpoints; results are stored
 * by idempotency key so a retried batch never applies anything twice.
 */
@Injectable()
export class SyncService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly patients: PatientsService,
    private readonly clinical: ClinicalService,
    private readonly audit: AuditService,
  ) {}

  async push(
    batch: SyncBatchDto,
    user: AuthenticatedUser,
    ctx: RequestContext,
  ): Promise<SyncBatchResponse> {
    // Patients whose CREATE failed earlier in this batch (by clientUuid).
    const failedPatients = new Set<string>();
    const results: SyncOperationResult[] = [];
    for (const op of batch.operations) {
      const result = await this.apply(
        op,
        batch.deviceId,
        failedPatients,
        user,
        ctx,
      );
      if (
        result.result !== 'APPLIED' &&
        op.entityType === 'patient' &&
        op.operation === 'CREATE' &&
        typeof op.payload.clientUuid === 'string'
      ) {
        failedPatients.add(op.payload.clientUuid);
      }
      results.push(result);
    }
    return { results, serverTime: new Date().toISOString() };
  }

  private async apply(
    op: SyncOperationDto,
    deviceId: string,
    failedPatients: ReadonlySet<string>,
    user: AuthenticatedUser,
    ctx: RequestContext,
  ): Promise<SyncOperationResult> {
    const stored = await this.prisma.syncOperation.findUnique({
      where: { idempotencyKey: op.idempotencyKey },
    });
    if (stored) return this.replay(stored, op, user, ctx);

    let outcome: Omit<SyncOperationResult, 'idempotencyKey' | 'replayed'>;
    try {
      if (op.patientId && failedPatients.has(op.patientId)) {
        // Not stored: once the patient is fixed and synced, this can apply.
        return {
          idempotencyKey: op.idempotencyKey,
          replayed: false,
          result: 'REJECTED',
          entityType: op.entityType,
          error: {
            code: 'DEPENDENCY_FAILED',
            message:
              'The patient for this record could not be saved on the server',
          },
        };
      }
      outcome = await this.execute(op, user, ctx);
    } catch (e) {
      if (!(e instanceof Rejected)) throw e;
      outcome = {
        result: 'REJECTED',
        entityType: op.entityType,
        error: e.error,
      };
    }

    try {
      await this.prisma.syncOperation.create({
        data: {
          idempotencyKey: op.idempotencyKey,
          userId: user.id,
          deviceId,
          entityType: op.entityType,
          entityId: outcome.entityId ?? null,
          operation: op.operation,
          baseVersion: op.baseVersion ?? null,
          resultingVersion: outcome.version ?? null,
          result: outcome.result,
          conflictDetail: outcome.error
            ? (JSON.parse(
                JSON.stringify(outcome.error),
              ) as Prisma.InputJsonObject)
            : Prisma.JsonNull,
          clientTimestamp: new Date(op.clientTimestamp),
        },
      });
    } catch (e) {
      // Two concurrent batches with the same key: the first one wins.
      if (
        e instanceof Prisma.PrismaClientKnownRequestError &&
        e.code === 'P2002'
      ) {
        const winner = await this.prisma.syncOperation.findUniqueOrThrow({
          where: { idempotencyKey: op.idempotencyKey },
        });
        return this.replay(winner, op, user, ctx);
      }
      throw e;
    }
    return { idempotencyKey: op.idempotencyKey, replayed: false, ...outcome };
  }

  private async replay(
    stored: SyncOperation,
    op: SyncOperationDto,
    user: AuthenticatedUser,
    ctx: RequestContext,
  ): Promise<SyncOperationResult> {
    if (stored.userId !== user.id) {
      return {
        idempotencyKey: op.idempotencyKey,
        replayed: false,
        result: 'REJECTED',
        entityType: op.entityType,
        error: {
          code: 'IDEMPOTENCY_KEY_REUSED',
          message: 'This operation id was already used by another account',
        },
      };
    }
    const result: SyncOperationResult = {
      idempotencyKey: stored.idempotencyKey,
      replayed: true,
      result: stored.result,
      entityType: stored.entityType as SyncOperationResult['entityType'],
      entityId: stored.entityId ?? undefined,
      version: stored.resultingVersion ?? undefined,
    };
    if (stored.result === 'REJECTED' && stored.conflictDetail) {
      result.error = stored.conflictDetail as unknown as SyncErrorView;
    }
    if (stored.result === 'CONFLICT' && stored.entityId) {
      result.server = await this.patients.get(stored.entityId, user, ctx);
      result.error = versionConflict();
    }
    return result;
  }

  private async execute(
    op: SyncOperationDto,
    user: AuthenticatedUser,
    ctx: RequestContext,
  ): Promise<Omit<SyncOperationResult, 'idempotencyKey' | 'replayed'>> {
    const permission = REQUIRED[`${op.entityType}:${op.operation}`];
    if (!permission) {
      throw new Rejected({
        code: 'UNSUPPORTED_OPERATION',
        message: `${op.operation} is not supported for ${op.entityType}`,
      });
    }
    if (!user.permissions.includes(permission)) {
      throw new Rejected({
        code: 'FORBIDDEN',
        message: 'You do not have permission for this operation',
      });
    }

    try {
      if (op.entityType === 'patient' && op.operation === 'CREATE') {
        const dto = await this.validated(CreatePatientDto, op.payload);
        if (!dto.clientUuid)
          throw fieldError(
            'clientUuid',
            'clientUuid is required for offline registration',
          );
        const { patient } = await this.patients.create(dto, user, ctx);
        return applied(op, patient.id, patient.version);
      }

      if (op.entityType === 'patient') {
        if (!op.entityId)
          throw fieldError('entityId', 'entityId is required for UPDATE');
        if (!op.baseVersion)
          throw fieldError('baseVersion', 'baseVersion is required for UPDATE');
        const dto = await this.validated(UpdatePatientDto, {
          ...op.payload,
          version: op.baseVersion,
        });
        const patientId = await this.resolvePatient(op.entityId, user);
        try {
          const patient = await this.patients.update(patientId, dto, user, ctx);
          return applied(op, patient.id, patient.version);
        } catch (e) {
          if (errorCode(e) !== 'VERSION_CONFLICT') throw e;
          const server = await this.patients.get(patientId, user, ctx);
          return {
            result: 'CONFLICT',
            entityType: op.entityType,
            entityId: patientId,
            version: server.version,
            error: versionConflict(),
            server,
          };
        }
      }

      // clinical_record CREATE
      if (!op.patientId)
        throw fieldError(
          'patientId',
          'patientId is required for clinical records',
        );
      const dto = await this.validated(CreateClinicalRecordDto, op.payload);
      if (!dto.clientUuid)
        throw fieldError(
          'clientUuid',
          'clientUuid is required for offline records',
        );
      const patientId = await this.resolvePatient(op.patientId, user);
      const { record } = await this.clinical.createRecord(
        patientId,
        dto,
        user,
        ctx,
      );
      return applied(op, record.id, record.version);
    } catch (e) {
      if (e instanceof Rejected) throw e;
      if (e instanceof HttpException && e.getStatus() < 500) {
        const body = e.getResponse() as Partial<SyncErrorView> | string;
        throw new Rejected(
          typeof body === 'object' && body.code
            ? {
                code: body.code,
                message: body.message ?? e.message,
                details: body.details,
              }
            : { code: 'REJECTED', message: e.message },
        );
      }
      throw e;
    }
  }

  /** A patient reference is the server id or the device's clientUuid, within the caller's facility. */
  private async resolvePatient(
    ref: string,
    user: AuthenticatedUser,
  ): Promise<string> {
    const facilityId = this.patients.staffFacility(user);
    const patient = await this.prisma.patient.findFirst({
      where: { facilityId, OR: [{ id: ref }, { clientUuid: ref }] },
      select: { id: true },
    });
    if (!patient) {
      throw new NotFoundException({
        code: 'NOT_FOUND',
        message: 'Patient not found',
      });
    }
    return patient.id;
  }

  private async validated<T extends object>(
    cls: new () => T,
    payload: Record<string, unknown>,
  ): Promise<T> {
    const instance = plainToInstance(cls, payload);
    const errors = await validate(instance, {
      whitelist: true,
      forbidNonWhitelisted: true,
      validationError: { target: false, value: false },
    });
    if (errors.length > 0) {
      throw new Rejected({
        code: 'VALIDATION_FAILED',
        message: 'Request validation failed',
        details: flattenValidationErrors(errors),
      });
    }
    return instance;
  }

  // ---------------------------------------------------------------------------
  // Pull
  // ---------------------------------------------------------------------------

  /** Patients and clinical records of the caller's facility changed after the cursor. */
  async changes(
    query: SyncChangesQuery,
    user: AuthenticatedUser,
    ctx: RequestContext,
  ): Promise<SyncChangesResponse> {
    const facilityId = this.patients.staffFacility(user);
    const cursor = decodeCursor(query.cursor);
    const after = ([t, id]: [string, string]) => ({
      OR: [
        { updatedAt: { gt: new Date(t) } },
        {
          updatedAt: new Date(t),
          id: { gt: id || '00000000-0000-0000-0000-000000000000' },
        },
      ],
    });
    const order = [{ updatedAt: 'asc' as const }, { id: 'asc' as const }];
    const take = query.limit + 1;

    const [patients, records] = await Promise.all([
      this.prisma.patient.findMany({
        where: { facilityId, ...after(cursor.p) },
        orderBy: order,
        take,
      }),
      this.prisma.clinicalRecord.findMany({
        where: { facilityId, ...after(cursor.r) },
        orderBy: order,
        take,
      }),
    ]);
    const hasMore =
      patients.length > query.limit || records.length > query.limit;
    const p = patients.slice(0, query.limit);
    const r = records.slice(0, query.limit);
    const next: Cursor = {
      p: p.length
        ? [p[p.length - 1].updatedAt.toISOString(), p[p.length - 1].id]
        : cursor.p,
      r: r.length
        ? [r[r.length - 1].updatedAt.toISOString(), r[r.length - 1].id]
        : cursor.r,
    };

    await this.audit.record({
      action: 'sync.pull',
      entityType: 'patient',
      outcome: 'SUCCESS',
      actorUserId: user.id,
      actorRole: user.roles.join(','),
      details: { patients: p.length, clinicalRecords: r.length },
      ...ctx,
    });
    return {
      patients: p.map((x) => this.patients.toView(x)),
      clinicalRecords: r.map(toClinicalView),
      cursor: encodeCursor(next),
      hasMore,
    };
  }
}

function applied(
  op: SyncOperationDto,
  entityId: string,
  version: number,
): Omit<SyncOperationResult, 'idempotencyKey' | 'replayed'> {
  return { result: 'APPLIED', entityType: op.entityType, entityId, version };
}

function versionConflict(): SyncErrorView {
  return {
    code: 'VERSION_CONFLICT',
    message: 'The patient record was changed by someone else.',
  };
}

function fieldError(field: string, message: string): Rejected {
  return new Rejected({
    code: 'VALIDATION_FAILED',
    message: 'Request validation failed',
    details: [{ field, errors: [message] }],
  });
}

function errorCode(e: unknown): string | undefined {
  if (!(e instanceof HttpException)) return undefined;
  const body = e.getResponse();
  return typeof body === 'object' && body !== null && 'code' in body
    ? String(body.code)
    : undefined;
}
