import { randomBytes } from 'node:crypto';
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import { MongoService } from '../../persistence/database/mongo.service';
import { PrismaService } from '../../persistence/database/prisma.service';
import type {
  AuthenticatedUser,
  RequestContext,
} from '../../gateway/access/access.decorators';
import type { RoleName } from '../../gateway/access/permissions';
import { AuditService } from '../audit/audit.service';
import { PasswordHasher } from '../auth/password';
import type {
  CreateUserDto,
  UpdateUserDto,
  UserPage,
  UserView,
} from './users.dto';

const WITH_ROLES = {
  roles: { include: { role: true } },
} satisfies Prisma.UserInclude;
type UserWithRoles = Prisma.UserGetPayload<{ include: typeof WITH_ROLES }>;

const STAFF_ROLES_NEEDING_FACILITY: RoleName[] = ['CLINICIAN', 'PATHOLOGIST'];

/** The assistant's conversations, owned by one account (chatbot.service.ts). */
const CHAT_COLLECTION = 'chatbot_conversations';

/**
 * Work an account has done that is part of the clinical record. These rows
 * name the account by id; an account that appears in any of them is disabled,
 * never deleted, so the history stays traceable.
 */
export interface ClinicalHistory {
  patientsRegistered: number;
  screeningRecords: number;
  consentsRecorded: number;
  scansUploaded: number;
  slidesUploadedOrReviewed: number;
  aiAnalysesRequested: number;
  phoneChangesSynced: number;
}

export function toUserView(u: UserWithRoles): UserView {
  return {
    id: u.id,
    email: u.email,
    displayName: u.displayName,
    status: u.lockedUntil && u.lockedUntil > new Date() ? 'LOCKED' : u.status,
    roles: u.roles.map((r) => r.role.name as RoleName).sort(),
    facilityId: u.facilityId,
    mustChangePassword: u.mustChangePassword,
    lockedUntil: u.lockedUntil?.toISOString() ?? null,
    lastLoginAt: u.lastLoginAt?.toISOString() ?? null,
    createdAt: u.createdAt.toISOString(),
  };
}

@Injectable()
export class UsersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly passwords: PasswordHasher,
    private readonly audit: AuditService,
    private readonly mongo: MongoService,
  ) {}

  async me(user: AuthenticatedUser): Promise<UserView> {
    return this.get(user.id);
  }

  async list(
    page: number,
    pageSize: number,
    q?: string,
    role?: RoleName,
  ): Promise<UserPage> {
    const term = q?.trim();
    const where: Prisma.UserWhereInput = {
      ...(term
        ? {
            OR: [
              { email: { contains: term, mode: 'insensitive' } },
              { displayName: { contains: term, mode: 'insensitive' } },
            ],
          }
        : {}),
      ...(role ? { roles: { some: { role: { name: role } } } } : {}),
    };
    const [items, total] = await this.prisma.$transaction([
      this.prisma.user.findMany({
        where,
        include: WITH_ROLES,
        orderBy: { createdAt: 'asc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.user.count({ where }),
    ]);
    return { items: items.map(toUserView), page, pageSize, total };
  }

  async get(id: string): Promise<UserView> {
    const user = await this.prisma.user.findUnique({
      where: { id },
      include: WITH_ROLES,
    });
    if (!user)
      throw new NotFoundException({
        code: 'NOT_FOUND',
        message: 'User not found',
      });
    return toUserView(user);
  }

  /** Staff accounts are created by administrators with a one-time temporary password. */
  async create(
    dto: CreateUserDto,
    actor: AuthenticatedUser,
    ctx: RequestContext,
  ): Promise<{ user: UserView; temporaryPassword: string }> {
    if (
      dto.roles.some((r) => STAFF_ROLES_NEEDING_FACILITY.includes(r)) &&
      !dto.facilityId
    ) {
      throw new BadRequestException({
        code: 'VALIDATION_FAILED',
        message: 'Request validation failed',
        details: [
          {
            field: 'facilityId',
            errors: ['facilityId is required for clinical staff'],
          },
        ],
      });
    }
    if (await this.prisma.user.findUnique({ where: { email: dto.email } })) {
      throw new ConflictException({
        code: 'CONFLICT',
        message: 'An account with this email already exists',
      });
    }
    const temporaryPassword = randomBytes(15).toString('base64url');
    const passwordHash = await this.passwords.hash(temporaryPassword);

    const created = await this.prisma.$transaction(async (tx) => {
      const roles = await tx.role.findMany({
        where: { name: { in: dto.roles } },
      });
      const user = await tx.user.create({
        data: {
          email: dto.email,
          displayName: dto.displayName.trim(),
          passwordHash,
          facilityId: dto.facilityId ?? null,
          mustChangePassword: true,
          roles: { create: roles.map((r) => ({ roleId: r.id })) },
        },
        include: WITH_ROLES,
      });
      await this.audit.record(
        {
          action: 'user.created',
          entityType: 'user',
          entityId: user.id,
          outcome: 'SUCCESS',
          actorUserId: actor.id,
          actorRole: actor.roles.join(','),
          details: { roles: dto.roles, facilityId: dto.facilityId ?? null },
          ...ctx,
        },
        tx,
      );
      return user;
    });
    return { user: toUserView(created), temporaryPassword };
  }

  /** Issues a new one-time password; all sessions end and the lockout clears. */
  async resetPassword(
    id: string,
    actor: AuthenticatedUser,
    ctx: RequestContext,
  ): Promise<{ temporaryPassword: string }> {
    if (id === actor.id) {
      throw new BadRequestException({
        code: 'SELF_RESET',
        message: 'Use Change password for your own account',
      });
    }
    const existing = await this.prisma.user.findUnique({ where: { id } });
    if (!existing)
      throw new NotFoundException({
        code: 'NOT_FOUND',
        message: 'User not found',
      });
    const temporaryPassword = randomBytes(15).toString('base64url');
    const passwordHash = await this.passwords.hash(temporaryPassword);
    await this.prisma.$transaction(async (tx) => {
      await tx.user.update({
        where: { id },
        data: {
          passwordHash,
          mustChangePassword: true,
          failedLoginCount: 0,
          lockedUntil: null,
        },
      });
      await tx.refreshToken.updateMany({
        where: { userId: id, revokedAt: null },
        data: { revokedAt: new Date() },
      });
      await this.audit.record(
        {
          action: 'user.password_reset_by_admin',
          entityType: 'user',
          entityId: id,
          outcome: 'SUCCESS',
          actorUserId: actor.id,
          actorRole: actor.roles.join(','),
          ...ctx,
        },
        tx,
      );
    });
    return { temporaryPassword };
  }

  async update(
    id: string,
    dto: UpdateUserDto,
    actor: AuthenticatedUser,
    ctx: RequestContext,
  ): Promise<UserView> {
    if (dto.roles && !actor.permissions.includes('role:manage')) {
      throw new ForbiddenException({
        code: 'FORBIDDEN',
        message: 'You do not have permission to change roles',
      });
    }
    if (
      actor.id === id &&
      (dto.status === 'DISABLED' || (dto.roles && !dto.roles.includes('ADMIN')))
    ) {
      throw new BadRequestException({
        code: 'SELF_LOCKOUT',
        message:
          'You cannot disable your own account or remove your own administrator role',
      });
    }
    const existing = await this.prisma.user.findUnique({
      where: { id },
      include: { roles: { include: { role: true } } },
    });
    if (!existing)
      throw new NotFoundException({
        code: 'NOT_FOUND',
        message: 'User not found',
      });
    // Separation of duties (Phase 15): an administrator cannot give their own
    // account a new role (for example Clinician, which reads patient data).
    if (actor.id === id && dto.roles) {
      const held = new Set<string>(existing.roles.map((r) => r.role.name));
      const added = dto.roles.filter((r) => !held.has(r));
      if (added.length > 0) {
        throw new BadRequestException({
          code: 'SELF_ROLE_CHANGE',
          message:
            'You cannot give your own account a new role. Another administrator must do it.',
          details: { roles: added },
        });
      }
    }

    const updated = await this.prisma.$transaction(async (tx) => {
      if (dto.roles) {
        const roles = await tx.role.findMany({
          where: { name: { in: dto.roles } },
        });
        await tx.userRole.deleteMany({ where: { userId: id } });
        await tx.userRole.createMany({
          data: roles.map((r) => ({ userId: id, roleId: r.id })),
        });
      }
      const user = await tx.user.update({
        where: { id },
        data: {
          displayName: dto.displayName?.trim(),
          status: dto.status,
          facilityId: dto.facilityId,
          ...(dto.unlock ? { failedLoginCount: 0, lockedUntil: null } : {}),
        },
        include: WITH_ROLES,
      });
      if (dto.status === 'DISABLED' || dto.roles) {
        // Existing sessions end immediately when access is reduced.
        await tx.refreshToken.updateMany({
          where: { userId: id, revokedAt: null },
          data: { revokedAt: new Date() },
        });
      }
      await this.audit.record(
        {
          action: 'user.updated',
          entityType: 'user',
          entityId: id,
          outcome: 'SUCCESS',
          actorUserId: actor.id,
          actorRole: actor.roles.join(','),
          details: {
            changed: Object.keys(dto).filter(
              (k) => dto[k as keyof UpdateUserDto] !== undefined,
            ),
            status: dto.status,
            roles: dto.roles,
          },
          ...ctx,
        },
        tx,
      );
      return user;
    });
    return toUserView(updated);
  }

  /** How much of the clinical record names this account (all zero: none). */
  async clinicalHistory(id: string): Promise<ClinicalHistory> {
    const [
      patientsRegistered,
      screeningRecords,
      consentsRecorded,
      scansUploaded,
      slidesUploadedOrReviewed,
      aiAnalysesRequested,
      phoneChangesSynced,
    ] = await this.prisma.$transaction([
      this.prisma.patient.count({ where: { createdById: id } }),
      this.prisma.clinicalRecord.count({ where: { recordedById: id } }),
      this.prisma.consent.count({ where: { capturedById: id } }),
      this.prisma.imagingStudy.count({ where: { uploadedById: id } }),
      this.prisma.histopathologySpecimen.count({
        where: { OR: [{ uploadedById: id }, { reviewedById: id }] },
      }),
      this.prisma.aiJob.count({ where: { requestedById: id } }),
      this.prisma.syncOperation.count({ where: { userId: id } }),
    ]);
    return {
      patientsRegistered,
      screeningRecords,
      consentsRecorded,
      scansUploaded,
      slidesUploadedOrReviewed,
      aiAnalysesRequested,
      phoneChangesSynced,
    };
  }

  /**
   * Deletes an account that has no clinical history (owner request,
   * 2026-09-29). Its roles, sessions, reset links and notifications go with
   * it, a linked patient record is only unlinked (the record stays), and its
   * assistant conversations are deleted. The audit log keeps its entries,
   * which name the account by id. An account with clinical history is
   * refused: it can be disabled, so the medical history stays traceable.
   */
  async delete(
    id: string,
    actor: AuthenticatedUser,
    ctx: RequestContext,
  ): Promise<void> {
    if (id === actor.id) {
      throw new BadRequestException({
        code: 'SELF_DELETE',
        message: 'You cannot delete your own account',
      });
    }
    const existing = await this.prisma.user.findUnique({
      where: { id },
      include: { ...WITH_ROLES, patientProfile: { select: { id: true } } },
    });
    if (!existing)
      throw new NotFoundException({
        code: 'NOT_FOUND',
        message: 'User not found',
      });
    const history = await this.clinicalHistory(id);
    if (Object.values(history).some((n) => n > 0)) {
      throw new ConflictException({
        code: 'HAS_CLINICAL_HISTORY',
        message:
          'This account has clinical history, so it cannot be deleted. Disable it instead: it can no longer sign in, and the history stays traceable.',
        details: history,
      });
    }
    await this.prisma.$transaction(async (tx) => {
      await tx.user.delete({ where: { id } });
      await this.audit.record(
        {
          action: 'user.deleted',
          entityType: 'user',
          entityId: id,
          outcome: 'SUCCESS',
          actorUserId: actor.id,
          actorRole: actor.roles.join(','),
          details: {
            roles: existing.roles.map((r) => r.role.name).sort(),
            wasLinkedToPatient: existing.patientProfile !== null,
            synthetic: existing.isSynthetic,
          },
          ...ctx,
        },
        tx,
      );
    });
    await (
      await this.mongo.db()
    )
      .collection(CHAT_COLLECTION)
      .deleteMany({ userId: id });
  }
}
