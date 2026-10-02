import { randomBytes, randomUUID } from 'node:crypto';
import os from 'node:os';
import path from 'node:path';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { Test } from '@nestjs/testing';
import type { PrismaClient } from '@prisma/client';
import request from 'supertest';
import { seed } from '../../src/persistence/seed';
import { AppModule } from '../../src/app.module';
import { FieldCrypto } from '../../src/persistence/crypto/field-crypto';
import { loadConfig } from '../../src/config/app-config';
import { configureApp } from '../../src/gateway/configure-app';
import type { RoleName } from '../../src/gateway/access/permissions';
import { PasswordHasher } from '../../src/services/auth/password';
import { TEST_JWT_ENV } from '../fixtures/test-keys';

export const TEST_PASSWORD = 'integration-test-passphrase-9';

/** Full application on the per-run test database, with generous rate limits. */
export async function createDbTestApp(
  env: Record<string, string> = {},
): Promise<NestExpressApplication> {
  Object.assign(process.env, {
    NODE_ENV: 'test',
    AUTH_RATE_LIMIT_MAX: '1000',
    RATE_LIMIT_MAX: '5000',
    USER_RATE_LIMIT_MAX: '5000',
    // In-memory counters: never share limits with the dev server or other runs.
    REDIS_URL: '',
    // Uploaded files go to a per-run temp folder unless a test asks for S3.
    STORAGE_DRIVER: 'local',
    LOCAL_STORAGE_ROOT: path.join(
      os.tmpdir(),
      `pca-mhealth-objects-${process.env.TEST_RUN_ID ?? 'local'}`,
    ),
    // AI analysis off unless a test points it at its own fake AI service.
    AI_SERVICE_URL: 'http://127.0.0.1:9',
    AI_SERVICE_TOKEN: '',
    AI_TIMEOUT_MS: '30000',
    // FHIR sending off unless a test points it at its own mock SmartCare.
    SMARTCARE_FHIR_URL: '',
    SMARTCARE_TOKEN: '',
    SMARTCARE_TIMEOUT_MS: '30000',
    FHIR_EXPORT_MAX_PATIENTS: '5000',
    // Push off unless a test points it at its own stand-in for Firebase.
    FCM_SERVICE_ACCOUNT_FILE: '',
    FCM_API_URL: 'https://fcm.googleapis.com',
    PUSH_POLL_MS: '2000',
    ...TEST_JWT_ENV,
    ...env,
  });
  const moduleRef = await Test.createTestingModule({
    imports: [AppModule],
  }).compile();
  const app = moduleRef.createNestApplication<NestExpressApplication>({
    bodyParser: false,
    logger: false,
  });
  configureApp(app, loadConfig(process.env));
  await app.init();
  return app;
}

/** Roles and permissions must exist; the seed is idempotent. */
export async function ensureSeeded(prisma: PrismaClient): Promise<void> {
  await seed(
    prisma,
    new FieldCrypto(randomBytes(32), randomBytes(32)),
    'Synthetic-Demo-Pass-1',
  );
}

export async function createFacility(
  prisma: PrismaClient,
  label: string,
): Promise<string> {
  const facility = await prisma.facility.create({
    data: {
      code: `SYN-${label}-${randomUUID().slice(0, 6)}`.toUpperCase(),
      name: `SYNTHETIC ${label} Facility`,
      type: 'DISTRICT_HOSPITAL',
      province: 'Lusaka',
      district: 'Lusaka',
      regionClass: 'URBAN',
      isSynthetic: true,
    },
  });
  return facility.id;
}

/** Creates an active user with a known password (no forced change) directly in the DB. */
export async function createUser(
  prisma: PrismaClient,
  role: RoleName,
  facilityId: string | null,
): Promise<{ id: string; email: string }> {
  const email = `${role.toLowerCase()}-${randomUUID().slice(0, 8)}@example.test`;
  const roleRow = await prisma.role.findUniqueOrThrow({
    where: { name: role },
  });
  const user = await prisma.user.create({
    data: {
      email,
      displayName: `SYNTHETIC ${role}`,
      passwordHash: await new PasswordHasher().hash(TEST_PASSWORD),
      facilityId,
      isSynthetic: true,
      roles: { create: { roleId: roleRow.id } },
    },
  });
  return { id: user.id, email };
}

export async function loginAs(
  app: NestExpressApplication,
  email: string,
): Promise<string> {
  const res = await request(app.getHttpServer())
    .post('/api/v1/auth/login')
    .send({ email, password: TEST_PASSWORD })
    .expect(200);
  return (res.body as { accessToken: string }).accessToken;
}
