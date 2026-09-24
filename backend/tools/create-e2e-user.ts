/**
 * Creates a throwaway SYNTHETIC clinician in the demo facility for the
 * on-device end-to-end test (mobile/integration_test). It has no forced
 * password change, so the test never alters the demo accounts.
 *
 *   npm run e2e:user            -> prints {"email": ..., "password": ...}
 *
 * The account is marked is_synthetic and uses the demo e-mail domain.
 */
import { randomBytes, randomUUID } from 'node:crypto';
import path from 'node:path';
import { PrismaClient } from '@prisma/client';
import * as argon2 from 'argon2';
import { DEMO_EMAIL_DOMAIN, SYNTHETIC_FACILITY_CODE } from '../prisma/seed';
import { ARGON2_OPTIONS } from '../src/modules/auth/password';

async function main(): Promise<void> {
  try {
    process.loadEnvFile(path.resolve(__dirname, '..', '..', '.env'));
  } catch {
    // variables supplied by the environment
  }
  const prisma = new PrismaClient();
  try {
    const facility = await prisma.facility.findUnique({
      where: { code: SYNTHETIC_FACILITY_CODE },
    });
    if (!facility) throw new Error('Run "npm run db:seed" first');
    const role = await prisma.role.findUniqueOrThrow({
      where: { name: 'CLINICIAN' },
    });
    const email = `e2e-${randomUUID().slice(0, 8)}@${DEMO_EMAIL_DOMAIN}`;
    const password = `E2e-${randomBytes(12).toString('base64url')}`;
    await prisma.user.create({
      data: {
        email,
        displayName: 'SYNTHETIC E2E Clinician',
        passwordHash: await argon2.hash(password, ARGON2_OPTIONS),
        facilityId: facility.id,
        isSynthetic: true,
        roles: { create: { roleId: role.id } },
      },
    });
    console.log(JSON.stringify({ email, password }));
  } finally {
    await prisma.$disconnect();
  }
}

void main().catch((err: unknown) => {
  console.error(err);
  process.exitCode = 1;
});
