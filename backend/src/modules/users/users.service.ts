import { randomBytes } from 'node:crypto';
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import { PrismaService } from '../../infrastructure/database/prisma.service';
import type {
  AuthenticatedUser,
  RequestContext,
} from '../access/access.decorators';
import type { RoleName } from '../access/permissions';
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
  ) {}

  async me(user: AuthenticatedUser): Promise<UserView> {
    return this.get(user.id);
  }

  async list(page: number, pageSize: number): Promise<UserPage> {
    const [items, total] = await this.prisma.$transaction([
      this.prisma.user.findMany({
        include: WITH_ROLES,
        orderBy: { createdAt: 'asc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.user.count(),
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
    const existing = await this.prisma.user.findUnique({ where: { id } });
    if (!existing)
      throw new NotFoundException({
        code: 'NOT_FOUND',
        message: 'User not found',
      });

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
}
