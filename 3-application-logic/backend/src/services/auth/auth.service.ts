import { randomUUID } from 'node:crypto';
import {
  BadRequestException,
  ConflictException,
  HttpException,
  HttpStatus,
  Inject,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import { FieldCrypto } from '../../persistence/crypto/field-crypto';
import {
  idNumberHmac,
  idNumberProblem,
  normalizeIdNumber,
  type IdDocumentType,
} from '../../persistence/crypto/identity-document';
import { APP_CONFIG, type AppConfig } from '../../config/app-config';
import { PrismaService } from '../../persistence/database/prisma.service';
import type {
  AuthenticatedUser,
  RequestContext,
} from '../../gateway/access/access.decorators';
import type {
  PermissionCode,
  RoleName,
} from '../../gateway/access/permissions';
import { AuditService } from '../audit/audit.service';
import { checkPasswordPolicy, PasswordHasher } from './password';
import { ResetDelivery } from './reset-delivery';
import { TokenService } from './token.service';

export interface SessionTokens {
  accessToken: string;
  refreshToken: string;
  tokenType: 'Bearer';
  expiresIn: number;
}

export interface LoginResult extends SessionTokens {
  user: {
    id: string;
    email: string;
    displayName: string;
    roles: RoleName[];
    mustChangePassword: boolean;
  };
}

const USER_WITH_ACCESS = {
  roles: {
    include: {
      role: { include: { permissions: { include: { permission: true } } } },
    },
  },
} satisfies Prisma.UserInclude;

type UserWithAccess = Prisma.UserGetPayload<{
  include: typeof USER_WITH_ACCESS;
}>;

const invalidCredentials = () =>
  new UnauthorizedException({
    code: 'INVALID_CREDENTIALS',
    message: 'Email or password is incorrect',
  });

const invalidToken = () =>
  new UnauthorizedException({
    code: 'INVALID_TOKEN',
    message: 'The session is invalid or has expired. Please sign in again.',
  });

const accountLocked = () =>
  new HttpException(
    {
      code: 'ACCOUNT_LOCKED',
      message: 'Too many failed sign-in attempts. Try again later.',
    },
    HttpStatus.LOCKED,
  );

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

function policyError(problems: string[]): BadRequestException {
  return new BadRequestException({
    code: 'VALIDATION_FAILED',
    message: 'Request validation failed',
    details: [
      { field: 'password', errors: problems.map((p) => `password ${p}`) },
    ],
  });
}

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tokens: TokenService,
    private readonly passwords: PasswordHasher,
    private readonly audit: AuditService,
    private readonly resetDelivery: ResetDelivery,
    @Inject(APP_CONFIG) private readonly config: AppConfig,
    private readonly crypto: FieldCrypto,
  ) {}

  // ---------------------------------------------------------------------------
  // Registration and login
  // ---------------------------------------------------------------------------

  /** Public self-registration always creates a PATIENT account. Staff are created by administrators. */
  async register(
    input: {
      email: string;
      password: string;
      displayName: string;
      phone: string;
      idDocumentType: IdDocumentType;
      idNumber: string;
    },
    ctx: RequestContext,
  ): Promise<{ id: string; email: string; displayName: string }> {
    const email = normalizeEmail(input.email);
    const problems = checkPasswordPolicy(input.password, email);
    if (problems.length > 0) throw policyError(problems);
    const idProblem = idNumberProblem(input.idDocumentType, input.idNumber);
    if (idProblem) {
      throw new BadRequestException({
        code: 'VALIDATION_FAILED',
        message: 'Request validation failed',
        details: [{ field: 'idNumber', errors: [idProblem] }],
      });
    }
    const hmac = idNumberHmac(
      this.crypto,
      input.idDocumentType,
      input.idNumber,
    );

    // One neutral answer for a taken email or identity number.
    if (
      (await this.prisma.user.findUnique({ where: { email } })) ||
      (await this.prisma.user.findUnique({ where: { idNumberHmac: hmac } }))
    ) {
      throw new ConflictException({
        code: 'CONFLICT',
        message: 'An account with these details already exists',
      });
    }
    const passwordHash = await this.passwords.hash(input.password);
    const user = await this.prisma.$transaction(async (tx) => {
      const role = await tx.role.findUniqueOrThrow({
        where: { name: 'PATIENT' },
      });
      const created = await tx.user.create({
        data: {
          email,
          passwordHash,
          displayName: input.displayName.trim(),
          phoneEnc: this.crypto.encrypt(input.phone.trim()),
          idDocumentType: input.idDocumentType,
          idNumberEnc: this.crypto.encrypt(
            normalizeIdNumber(input.idDocumentType, input.idNumber),
          ),
          idNumberHmac: hmac,
          roles: { create: { roleId: role.id } },
        },
      });
      await this.audit.record(
        {
          action: 'auth.register',
          entityType: 'user',
          entityId: created.id,
          outcome: 'SUCCESS',
          actorUserId: created.id,
          actorRole: 'PATIENT',
          ...ctx,
        },
        tx,
      );
      return created;
    });
    return { id: user.id, email: user.email, displayName: user.displayName };
  }

  async login(
    emailInput: string,
    password: string,
    ctx: RequestContext,
  ): Promise<LoginResult> {
    const email = normalizeEmail(emailInput);
    const user = await this.prisma.user.findUnique({
      where: { email },
      include: USER_WITH_ACCESS,
    });

    if (!user) {
      await this.passwords.verifyDummy(password);
      await this.recordLogin(null, 'FAILURE', 'unknown_account', ctx);
      throw invalidCredentials();
    }
    if (user.status === 'DISABLED') {
      await this.passwords.verifyDummy(password);
      await this.recordLogin(user, 'FAILURE', 'disabled', ctx);
      throw invalidCredentials();
    }
    if (user.lockedUntil && user.lockedUntil > new Date()) {
      await this.recordLogin(user, 'DENIED', 'locked', ctx);
      throw accountLocked();
    }

    if (!(await this.passwords.verify(user.passwordHash, password))) {
      await this.registerFailedAttempt(user, ctx);
      throw invalidCredentials();
    }

    const familyId = randomUUID();
    const refresh = this.tokens.newRefreshToken();
    await this.prisma.$transaction(async (tx) => {
      await tx.user.update({
        where: { id: user.id },
        data: {
          failedLoginCount: 0,
          lockedUntil: null,
          lastLoginAt: new Date(),
        },
      });
      await tx.refreshToken.create({
        data: {
          userId: user.id,
          familyId,
          tokenHash: refresh.hash,
          expiresAt: this.tokens.refreshExpiry(),
        },
      });
      await this.recordLogin(user, 'SUCCESS', undefined, ctx, tx);
    });

    const roles = rolesOf(user);
    return {
      ...(await this.sessionTokens(user.id, familyId, refresh.token)),
      user: {
        id: user.id,
        email: user.email,
        displayName: user.displayName,
        roles,
        mustChangePassword: user.mustChangePassword,
      },
    };
  }

  private async registerFailedAttempt(
    user: UserWithAccess,
    ctx: RequestContext,
  ): Promise<void> {
    const updated = await this.prisma.user.update({
      where: { id: user.id },
      data: { failedLoginCount: { increment: 1 } },
    });
    await this.recordLogin(user, 'FAILURE', 'bad_password', ctx);
    if (updated.failedLoginCount >= this.config.auth.loginMaxAttempts) {
      const lockedUntil = new Date(
        Date.now() + this.config.auth.lockoutMinutes * 60_000,
      );
      await this.prisma.user.update({
        where: { id: user.id },
        data: { lockedUntil, failedLoginCount: 0 },
      });
      await this.audit.record({
        action: 'auth.lockout',
        entityType: 'user',
        entityId: user.id,
        outcome: 'DENIED',
        details: {
          lockedUntil: lockedUntil.toISOString(),
          attempts: updated.failedLoginCount,
        },
        ...ctx,
      });
    }
  }

  private recordLogin(
    user: UserWithAccess | null,
    outcome: 'SUCCESS' | 'FAILURE' | 'DENIED',
    reason: string | undefined,
    ctx: RequestContext,
    tx?: Prisma.TransactionClient,
  ): Promise<void> {
    return this.audit.record(
      {
        action: 'auth.login',
        entityType: 'user',
        entityId: user?.id ?? null,
        outcome,
        actorUserId: user?.id ?? null,
        actorRole: user ? rolesOf(user).join(',') : null,
        details: reason ? { reason } : undefined,
        ...ctx,
      },
      tx,
    );
  }

  // ---------------------------------------------------------------------------
  // Sessions: refresh rotation, logout, validation
  // ---------------------------------------------------------------------------

  /**
   * Rotates a refresh token. Presenting an already-rotated token is treated as
   * theft: the whole session family is revoked.
   */
  async refresh(
    refreshToken: string,
    ctx: RequestContext,
  ): Promise<SessionTokens> {
    const hash = this.tokens.hashOpaqueToken(refreshToken);
    const stored = await this.prisma.refreshToken.findUnique({
      where: { tokenHash: hash },
      include: { user: true },
    });
    if (!stored) throw invalidToken();

    if (stored.revokedAt) {
      await this.revokeFamily(stored.familyId);
      await this.audit.record({
        action: 'auth.refresh_reuse',
        entityType: 'session',
        entityId: stored.familyId,
        outcome: 'DENIED',
        actorUserId: stored.userId,
        ...ctx,
      });
      throw invalidToken();
    }
    const now = new Date();
    if (stored.expiresAt <= now || !isActive(stored.user)) {
      await this.revokeFamily(stored.familyId);
      throw invalidToken();
    }

    const next = this.tokens.newRefreshToken();
    const rotated = await this.prisma.$transaction(async (tx) => {
      // Conditional update: only one concurrent request can rotate a given token.
      const claimed = await tx.refreshToken.updateMany({
        where: { id: stored.id, revokedAt: null },
        data: { revokedAt: now },
      });
      if (claimed.count !== 1) return false;
      const created = await tx.refreshToken.create({
        data: {
          userId: stored.userId,
          familyId: stored.familyId,
          tokenHash: next.hash,
          expiresAt: this.tokens.refreshExpiry(now),
        },
      });
      await tx.refreshToken.update({
        where: { id: stored.id },
        data: { replacedById: created.id },
      });
      await this.audit.record(
        {
          action: 'auth.refresh',
          entityType: 'session',
          entityId: stored.familyId,
          outcome: 'SUCCESS',
          actorUserId: stored.userId,
          ...ctx,
        },
        tx,
      );
      return true;
    });
    if (!rotated) {
      await this.revokeFamily(stored.familyId);
      throw invalidToken();
    }
    return this.sessionTokens(stored.userId, stored.familyId, next.token);
  }

  async logout(user: AuthenticatedUser, ctx: RequestContext): Promise<void> {
    await this.revokeFamily(user.familyId);
    await this.audit.record({
      action: 'auth.logout',
      entityType: 'session',
      entityId: user.familyId,
      outcome: 'SUCCESS',
      actorUserId: user.id,
      actorRole: user.roles.join(','),
      ...ctx,
    });
  }

  /**
   * Resolves an access token into the current user, checking the account and
   * session in the database on every request, so disabling a user or logging
   * out takes effect immediately rather than at token expiry.
   */
  async authenticate(accessToken: string): Promise<AuthenticatedUser> {
    let claims;
    try {
      claims = await this.tokens.verifyAccessToken(accessToken);
    } catch {
      throw invalidToken();
    }
    const now = new Date();
    // Runs on every authenticated request: the user (with roles and
    // permissions) and the session are read in parallel. Both stay live reads
    // so disabling an account or changing a role applies to the next request.
    const [user, liveSession] = await Promise.all([
      this.prisma.user.findUnique({
        where: { id: claims.userId },
        include: USER_WITH_ACCESS,
      }),
      this.prisma.refreshToken.findFirst({
        where: {
          familyId: claims.familyId,
          userId: claims.userId,
          revokedAt: null,
          expiresAt: { gt: now },
        },
        select: { id: true },
      }),
    ]);
    if (!user || !isActive(user) || !liveSession) throw invalidToken();

    return {
      id: user.id,
      email: user.email,
      displayName: user.displayName,
      roles: rolesOf(user),
      permissions: permissionsOf(user),
      facilityId: user.facilityId,
      mustChangePassword: user.mustChangePassword,
      familyId: claims.familyId,
    };
  }

  // ---------------------------------------------------------------------------
  // Passwords
  // ---------------------------------------------------------------------------

  /** Always completes silently, so the response never reveals whether the email exists. */
  async forgotPassword(emailInput: string, ctx: RequestContext): Promise<void> {
    const email = normalizeEmail(emailInput);
    const user = await this.prisma.user.findUnique({ where: { email } });
    if (!user || user.status !== 'ACTIVE') return;

    const token = this.tokens.newRefreshToken();
    const expiresAt = new Date(
      Date.now() + this.config.auth.passwordResetTtlMin * 60_000,
    );
    await this.prisma.$transaction(async (tx) => {
      // Only the newest reset link works.
      await tx.passwordResetToken.updateMany({
        where: { userId: user.id, usedAt: null },
        data: { usedAt: new Date() },
      });
      await tx.passwordResetToken.create({
        data: { userId: user.id, tokenHash: token.hash, expiresAt },
      });
      await this.audit.record(
        {
          action: 'auth.password_reset_requested',
          entityType: 'user',
          entityId: user.id,
          outcome: 'SUCCESS',
          ...ctx,
        },
        tx,
      );
    });
    await this.resetDelivery.send(user.email, token.token, expiresAt);
  }

  async resetPassword(
    token: string,
    newPassword: string,
    ctx: RequestContext,
  ): Promise<void> {
    const invalid = () =>
      new BadRequestException({
        code: 'INVALID_OR_EXPIRED_TOKEN',
        message: 'This password reset link is invalid or has expired',
      });
    const stored = await this.prisma.passwordResetToken.findUnique({
      where: { tokenHash: this.tokens.hashOpaqueToken(token) },
      include: { user: true },
    });
    const now = new Date();
    if (!stored || stored.usedAt || stored.expiresAt <= now) throw invalid();
    if (stored.user.status !== 'ACTIVE') throw invalid();

    const problems = checkPasswordPolicy(newPassword, stored.user.email);
    if (problems.length > 0) throw policyError(problems);
    const passwordHash = await this.passwords.hash(newPassword);

    const done = await this.prisma.$transaction(async (tx) => {
      const claimed = await tx.passwordResetToken.updateMany({
        where: { id: stored.id, usedAt: null },
        data: { usedAt: now },
      });
      if (claimed.count !== 1) return false;
      await tx.user.update({
        where: { id: stored.userId },
        data: {
          passwordHash,
          failedLoginCount: 0,
          lockedUntil: null,
          mustChangePassword: false,
        },
      });
      await tx.refreshToken.updateMany({
        where: { userId: stored.userId, revokedAt: null },
        data: { revokedAt: now },
      });
      // Every session ends, so no phone keeps receiving pushes (ADR-014).
      await tx.pushDevice.deleteMany({ where: { userId: stored.userId } });
      await this.audit.record(
        {
          action: 'auth.password_reset_completed',
          entityType: 'user',
          entityId: stored.userId,
          outcome: 'SUCCESS',
          actorUserId: stored.userId,
          ...ctx,
        },
        tx,
      );
      return true;
    });
    if (!done) throw invalid();
  }

  async changePassword(
    user: AuthenticatedUser,
    currentPassword: string,
    newPassword: string,
    ctx: RequestContext,
  ): Promise<void> {
    const stored = await this.prisma.user.findUniqueOrThrow({
      where: { id: user.id },
    });
    if (!(await this.passwords.verify(stored.passwordHash, currentPassword))) {
      await this.audit.record({
        action: 'auth.password_change',
        entityType: 'user',
        entityId: user.id,
        outcome: 'FAILURE',
        actorUserId: user.id,
        details: { reason: 'wrong_current_password' },
        ...ctx,
      });
      throw new BadRequestException({
        code: 'INVALID_CURRENT_PASSWORD',
        message: 'The current password is incorrect',
      });
    }
    const problems = checkPasswordPolicy(newPassword, stored.email);
    if (newPassword === currentPassword)
      problems.push('must differ from the current password');
    if (problems.length > 0) throw policyError(problems);

    const passwordHash = await this.passwords.hash(newPassword);
    await this.prisma.$transaction(async (tx) => {
      await tx.user.update({
        where: { id: user.id },
        data: { passwordHash, mustChangePassword: false },
      });
      // Sign out every other session; the current one stays signed in.
      await tx.refreshToken.updateMany({
        where: {
          userId: user.id,
          revokedAt: null,
          familyId: { not: user.familyId },
        },
        data: { revokedAt: new Date() },
      });
      await this.audit.record(
        {
          action: 'auth.password_change',
          entityType: 'user',
          entityId: user.id,
          outcome: 'SUCCESS',
          actorUserId: user.id,
          actorRole: user.roles.join(','),
          ...ctx,
        },
        tx,
      );
    });
  }

  // ---------------------------------------------------------------------------

  async revokeFamily(familyId: string): Promise<void> {
    await this.prisma.refreshToken.updateMany({
      where: { familyId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  private async sessionTokens(
    userId: string,
    familyId: string,
    refreshToken: string,
  ): Promise<SessionTokens> {
    return {
      accessToken: await this.tokens.signAccessToken({ userId, familyId }),
      refreshToken,
      tokenType: 'Bearer',
      expiresIn: this.tokens.accessTokenTtlSec,
    };
  }
}

/**
 * Whether a signed-in session may go on. A lockout (too many wrong
 * passwords) only stops new sign-ins, in `login`: if it also ended open
 * sessions, anyone who knows an email address could sign that person out,
 * again and again, by typing wrong passwords.
 */
function isActive(user: { status: string }): boolean {
  return user.status === 'ACTIVE';
}

export function rolesOf(user: UserWithAccess): RoleName[] {
  return user.roles.map((r) => r.role.name as RoleName).sort();
}

function permissionsOf(user: UserWithAccess): PermissionCode[] {
  const codes = new Set<string>();
  for (const r of user.roles)
    for (const p of r.role.permissions) codes.add(p.permission.code);
  return [...codes].sort() as PermissionCode[];
}
