import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import { FieldCrypto } from '../../persistence/crypto/field-crypto';
import { maskIdentifier } from '../../persistence/crypto/identity-document';
import { PrismaService } from '../../persistence/database/prisma.service';
import type {
  AuthenticatedUser,
  RequestContext,
} from '../../gateway/access/access.decorators';
import {
  PERMISSIONS,
  ROLE_PERMISSIONS,
  ROLES,
  type PermissionCode,
  type RoleName,
} from '../../gateway/access/permissions';
import { AuditService } from '../audit/audit.service';
import {
  NOTIFICATION_TEXT,
  NotificationsService,
} from '../notifications/notifications.service';
import type {
  FacilityView,
  ListPatientAccountsQuery,
  PatientAccountPage,
  PatientAccountView,
  PermissionInfo,
  RecordMatchView,
  RoleView,
} from './admin.dto';

/**
 * Safety locks on role editing. Administrators can change what each role may
 * do, but not in ways that lock everyone out, open other people's data to
 * patient accounts, or break separation of duties (Phase 15 review):
 * clinical roles never get administration powers, and the administrator role
 * never gets routine access to clinical data.
 */
const REQUIRED: Partial<Record<RoleName, PermissionCode[]>> = {
  ADMIN: ['user:manage', 'role:manage'],
};
const PATIENT_ALLOWED: ReadonlySet<PermissionCode> = new Set<PermissionCode>([
  'patient:read_self',
  'clinical:read_self',
  'consent:read_self',
  'consent:withdraw_self',
  'report:read_self',
  'chatbot:use',
  'notification:read',
]);
/** Administration powers: only the administrator role may hold them. */
export const ADMIN_ONLY: readonly PermissionCode[] = [
  'user:manage',
  'role:manage',
  'patient_account:link',
  'facility:manage',
  'audit:read',
  'fhir:export',
  'ai:models:manage',
];
/** Routine access to clinical data: never for the administrator role. */
export const CLINICAL_DATA: readonly PermissionCode[] = [
  'patient:create',
  'patient:read',
  'patient:update',
  'clinical:create',
  'clinical:read',
  'consent:manage',
  'imaging:upload',
  'imaging:read',
  'histopathology:submit',
  'histopathology:read',
  'histopathology:review',
  'ai:request',
  'ai:read',
  'sync:write',
];

export function notAllowedFor(role: RoleName): PermissionCode[] {
  const all = Object.keys(PERMISSIONS) as PermissionCode[];
  switch (role) {
    case 'PATIENT':
      return all.filter((p) => !PATIENT_ALLOWED.has(p));
    case 'ADMIN':
      return [...CLINICAL_DATA];
    default:
      return [...ADMIN_ONLY];
  }
}

/** Shown instead of a value that cannot be decrypted. */
export const UNREADABLE = '(cannot be read)';

const notFound = (message: string) =>
  new NotFoundException({ code: 'NOT_FOUND', message });

type PatientUser = Prisma.UserGetPayload<{
  include: { patientProfile: { include: { facility: true } } };
}>;

@Injectable()
export class AdminService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly crypto: FieldCrypto,
    private readonly audit: AuditService,
    private readonly notifications: NotificationsService,
  ) {}

  // ---------------------------------------------------------------------------
  // Roles and permissions
  // ---------------------------------------------------------------------------

  permissionCatalogue(): PermissionInfo[] {
    return Object.entries(PERMISSIONS).map(([code, description]) => ({
      code,
      description,
    }));
  }

  async roles(): Promise<RoleView[]> {
    const roles = await this.prisma.role.findMany({
      include: {
        permissions: { include: { permission: true } },
        _count: { select: { users: true } },
      },
    });
    const byName = new Map(roles.map((r) => [r.name, r]));
    return ROLES.filter((name) => byName.has(name)).map((name) => {
      const r = byName.get(name)!;
      return {
        name,
        description: r.description,
        permissions: r.permissions.map((p) => p.permission.code).sort(),
        customised: r.customised,
        userCount: r._count.users,
        notAllowed: notAllowedFor(name),
        required: REQUIRED[name] ?? [],
      };
    });
  }

  async setRolePermissions(
    name: string,
    requested: string[],
    actor: AuthenticatedUser,
    ctx: RequestContext,
  ): Promise<RoleView> {
    const role = this.roleName(name);
    const unknown = requested.filter((p) => !(p in PERMISSIONS));
    if (unknown.length > 0) {
      throw new BadRequestException({
        code: 'VALIDATION_FAILED',
        message: 'Request validation failed',
        details: [
          {
            field: 'permissions',
            errors: unknown.map((p) => `unknown permission ${p}`),
          },
        ],
      });
    }
    const codes = requested as PermissionCode[];
    const forbidden = codes.filter((p) => notAllowedFor(role).includes(p));
    if (forbidden.length > 0) {
      throw new BadRequestException({
        code: 'NOT_ALLOWED_FOR_ROLE',
        message: `These permissions cannot be given to ${role}: ${forbidden.join(', ')}`,
        details: { permissions: forbidden },
      });
    }
    const missing = (REQUIRED[role] ?? []).filter((p) => !codes.includes(p));
    if (missing.length > 0) {
      throw new BadRequestException({
        code: 'LOCKOUT_PROTECTION',
        message: `${role} must keep ${missing.join(', ')}, or nobody could manage accounts`,
        details: { permissions: missing },
      });
    }
    await this.applyPermissions(role, codes, true, actor, ctx);
    return (await this.roles()).find((r) => r.name === role)!;
  }

  async resetRole(
    name: string,
    actor: AuthenticatedUser,
    ctx: RequestContext,
  ): Promise<RoleView> {
    const role = this.roleName(name);
    await this.applyPermissions(
      role,
      [...ROLE_PERMISSIONS[role]],
      false,
      actor,
      ctx,
    );
    return (await this.roles()).find((r) => r.name === role)!;
  }

  private roleName(name: string): RoleName {
    const role = ROLES.find((r) => r === name.toUpperCase());
    if (!role) throw notFound('Role not found');
    return role;
  }

  private async applyPermissions(
    role: RoleName,
    codes: PermissionCode[],
    customised: boolean,
    actor: AuthenticatedUser,
    ctx: RequestContext,
  ): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      const row = await tx.role.findUniqueOrThrow({
        where: { name: role },
        include: { permissions: { include: { permission: true } } },
      });
      const before = new Set(row.permissions.map((p) => p.permission.code));
      const permissions = await tx.permission.findMany({
        where: { code: { in: codes } },
      });
      await tx.rolePermission.deleteMany({ where: { roleId: row.id } });
      await tx.rolePermission.createMany({
        data: permissions.map((p) => ({ roleId: row.id, permissionId: p.id })),
      });
      await tx.role.update({ where: { id: row.id }, data: { customised } });
      await this.audit.record(
        {
          action: customised
            ? 'role.permissions_changed'
            : 'role.permissions_reset',
          entityType: 'role',
          entityId: row.id,
          outcome: 'SUCCESS',
          actorUserId: actor.id,
          actorRole: actor.roles.join(','),
          details: {
            role,
            added: codes.filter((c) => !before.has(c)),
            removed: [...before].filter(
              (c) => !codes.includes(c as PermissionCode),
            ),
          },
          ...ctx,
        },
        tx,
      );
    });
  }

  // ---------------------------------------------------------------------------
  // Facilities (for assigning staff)
  // ---------------------------------------------------------------------------

  async facilities(): Promise<FacilityView[]> {
    const rows = await this.prisma.facility.findMany({
      orderBy: { name: 'asc' },
    });
    return rows.map((f) => ({
      id: f.id,
      code: f.code,
      name: f.name,
      province: f.province,
      district: f.district,
    }));
  }

  // ---------------------------------------------------------------------------
  // Patient app accounts: matching and linking to clinic records
  // ---------------------------------------------------------------------------

  async patientAccounts(
    query: ListPatientAccountsQuery,
  ): Promise<PatientAccountPage> {
    const where: Prisma.UserWhereInput = {
      roles: { some: { role: { name: 'PATIENT' } } },
      ...(query.status === 'linked'
        ? { patientProfile: { isNot: null } }
        : query.status === 'unlinked'
          ? { patientProfile: { is: null } }
          : {}),
    };
    const [rows, total] = await this.prisma.$transaction([
      this.prisma.user.findMany({
        where,
        include: { patientProfile: { include: { facility: true } } },
        orderBy: { createdAt: 'desc' },
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
      }),
      this.prisma.user.count({ where }),
    ]);
    return {
      items: rows.map((u) => this.accountView(u)),
      page: query.page,
      pageSize: query.pageSize,
      total,
    };
  }

  /** Finds the clinic record whose NRC matches the account's NRC. */
  async matchRecord(userId: string): Promise<RecordMatchView> {
    const user = await this.patientUser(userId);
    const patient = await this.findMatch(user);
    return {
      patientId: patient.id,
      mrn: patient.mrn,
      facilityName: patient.facility.name,
      linkedToAnotherAccount:
        patient.userId !== null && patient.userId !== user.id,
    };
  }

  async link(
    userId: string,
    actor: AuthenticatedUser,
    ctx: RequestContext,
  ): Promise<PatientAccountView> {
    const user = await this.patientUser(userId);
    if (user.patientProfile) {
      throw new ConflictException({
        code: 'CONFLICT',
        message: 'This account is already linked to a clinic record',
      });
    }
    const patient = await this.findMatch(user);
    if (patient.userId) {
      throw new ConflictException({
        code: 'CONFLICT',
        message: 'That clinic record is already linked to another account',
      });
    }
    await this.prisma.$transaction(async (tx) => {
      await tx.patient.update({
        where: { id: patient.id },
        data: { userId: user.id, version: { increment: 1 } },
      });
      await this.audit.record(
        {
          action: 'patient_account.linked',
          entityType: 'patient',
          entityId: patient.id,
          outcome: 'SUCCESS',
          actorUserId: actor.id,
          actorRole: actor.roles.join(','),
          details: { userId: user.id, matchedBy: 'NRC' },
          ...ctx,
        },
        tx,
      );
      await this.notifications.notifyUser(
        user.id,
        NOTIFICATION_TEXT.accountLinked,
        tx,
      );
    });
    return this.accountView(await this.patientUser(userId));
  }

  async unlink(
    userId: string,
    actor: AuthenticatedUser,
    ctx: RequestContext,
  ): Promise<PatientAccountView> {
    const user = await this.patientUser(userId);
    const patient = user.patientProfile;
    if (!patient) {
      throw new ConflictException({
        code: 'CONFLICT',
        message: 'This account is not linked to a clinic record',
      });
    }
    await this.prisma.$transaction(async (tx) => {
      await tx.patient.update({
        where: { id: patient.id },
        data: { userId: null, version: { increment: 1 } },
      });
      // The patient app loses access straight away, and its pushes stop.
      await tx.refreshToken.updateMany({
        where: { userId: user.id, revokedAt: null },
        data: { revokedAt: new Date() },
      });
      await tx.pushDevice.deleteMany({ where: { userId: user.id } });
      await this.audit.record(
        {
          action: 'patient_account.unlinked',
          entityType: 'patient',
          entityId: patient.id,
          outcome: 'SUCCESS',
          actorUserId: actor.id,
          actorRole: actor.roles.join(','),
          details: { userId: user.id },
          ...ctx,
        },
        tx,
      );
    });
    return this.accountView(await this.patientUser(userId));
  }

  private async patientUser(userId: string): Promise<PatientUser> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: {
        patientProfile: { include: { facility: true } },
        roles: { include: { role: true } },
      },
    });
    if (!user || !user.roles.some((r) => r.role.name === 'PATIENT')) {
      throw notFound('Patient account not found');
    }
    return user;
  }

  private async findMatch(user: PatientUser) {
    if (user.idDocumentType !== 'NRC' || !user.idNumberHmac) {
      throw new BadRequestException({
        code: 'NO_NRC',
        message:
          'This account has no NRC number. Passport holders are linked by their clinic.',
      });
    }
    const patient = await this.prisma.patient.findUnique({
      where: { nationalIdHmac: user.idNumberHmac },
      include: { facility: true },
    });
    if (!patient) {
      throw new NotFoundException({
        code: 'NO_MATCH',
        message: 'No clinic record has this NRC number yet',
      });
    }
    return patient;
  }

  /** One unreadable value (e.g. after a key change) must not break the list. */
  private masked(value: Uint8Array | null): string | null {
    if (!value) return null;
    try {
      return maskIdentifier(this.crypto.decrypt(value));
    } catch {
      return UNREADABLE;
    }
  }

  private accountView(u: PatientUser): PatientAccountView {
    return {
      userId: u.id,
      email: u.email,
      displayName: u.displayName,
      idDocumentType: u.idDocumentType,
      idNumberMasked: this.masked(u.idNumberEnc),
      phoneMasked: this.masked(u.phoneEnc),
      linked: u.patientProfile
        ? {
            patientId: u.patientProfile.id,
            mrn: u.patientProfile.mrn,
            facilityName: u.patientProfile.facility.name,
          }
        : null,
      createdAt: u.createdAt.toISOString(),
    };
  }
}
