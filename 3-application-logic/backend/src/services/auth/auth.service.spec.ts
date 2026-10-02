import { UnauthorizedException } from '@nestjs/common';
import { TEST_BASE_ENV } from '../../../test/fixtures/test-keys';
import { loadConfig } from '../../config/app-config';
import type { FieldCrypto } from '../../persistence/crypto/field-crypto';
import type { PrismaService } from '../../persistence/database/prisma.service';
import type { AuditService } from '../audit/audit.service';
import { AuthService } from './auth.service';
import type { PasswordHasher } from './password';
import type { ResetDelivery } from './reset-delivery';
import { TokenService } from './token.service';

/*
 * A lockout (too many wrong passwords) stops new sign-ins. It must not end
 * sessions that are already signed in: otherwise anyone who knows a person's
 * email address could sign them out, again and again, by typing wrong
 * passwords (review 2026-10-02). The database behaviour is covered in
 * test/db/auth.int-spec.ts; these tests need no database.
 */

const config = loadConfig(TEST_BASE_ENV);
const tokens = new TokenService(config);
const ctx = { requestId: null, ip: null };
const inFifteenMinutes = () => new Date(Date.now() + 15 * 60_000);
const inSevenDays = () => new Date(Date.now() + 7 * 86_400_000);

function account(overrides: { status?: string; lockedUntil?: Date | null }) {
  return {
    id: 'user-1',
    email: 'synthetic.clinician@example.test',
    displayName: 'SYNTHETIC Clinician',
    status: 'ACTIVE',
    lockedUntil: null,
    facilityId: 'facility-1',
    mustChangePassword: false,
    roles: [
      {
        role: {
          name: 'CLINICIAN',
          permissions: [{ permission: { code: 'patient:read' } }],
        },
      },
    ],
    ...overrides,
  };
}

function setup(user: ReturnType<typeof account>) {
  const revokeMany = jest.fn().mockResolvedValue({ count: 1 });
  const tx = {
    refreshToken: {
      updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      create: jest.fn().mockResolvedValue({ id: 'token-2' }),
      update: jest.fn().mockResolvedValue({}),
    },
  };
  const prisma = {
    user: { findUnique: jest.fn().mockResolvedValue(user) },
    refreshToken: {
      findFirst: jest.fn().mockResolvedValue({ id: 'token-1' }),
      findUnique: jest.fn().mockResolvedValue({
        id: 'token-1',
        userId: user.id,
        familyId: 'family-1',
        revokedAt: null,
        expiresAt: inSevenDays(),
        user,
      }),
      updateMany: revokeMany,
    },
    $transaction: jest.fn((work: (t: typeof tx) => Promise<unknown>) =>
      work(tx),
    ),
  };
  const audit = { record: jest.fn().mockResolvedValue(undefined) };
  const auth = new AuthService(
    prisma as unknown as PrismaService,
    tokens,
    {} as PasswordHasher,
    audit as unknown as AuditService,
    {} as ResetDelivery,
    config,
    {} as FieldCrypto,
  );
  return { auth, revokeMany };
}

describe('AuthService sessions during a lockout', () => {
  it('keeps a signed-in session working while the account is locked', async () => {
    const { auth } = setup(account({ lockedUntil: inFifteenMinutes() }));
    const accessToken = await tokens.signAccessToken({
      userId: 'user-1',
      familyId: 'family-1',
    });
    await expect(auth.authenticate(accessToken)).resolves.toMatchObject({
      id: 'user-1',
      familyId: 'family-1',
      permissions: ['patient:read'],
    });
  });

  it('rotates the refresh token of a locked account and keeps its session', async () => {
    const { auth, revokeMany } = setup(
      account({ lockedUntil: inFifteenMinutes() }),
    );
    const next = await auth.refresh('presented-refresh-token', ctx);
    expect(next.refreshToken).toEqual(expect.any(String));
    expect(revokeMany).not.toHaveBeenCalled();
  });

  it('still ends the sessions of a disabled account at once', async () => {
    const { auth, revokeMany } = setup(account({ status: 'DISABLED' }));
    const accessToken = await tokens.signAccessToken({
      userId: 'user-1',
      familyId: 'family-1',
    });
    await expect(auth.authenticate(accessToken)).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
    await expect(auth.refresh('presented-refresh-token', ctx)).rejects.toThrow(
      UnauthorizedException,
    );
    expect(revokeMany).toHaveBeenCalledWith({
      where: { familyId: 'family-1', revokedAt: null },
      data: { revokedAt: expect.any(Date) as Date },
    });
  });
});
