import { execSync } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import path from 'node:path';
import { PrismaClient } from '@prisma/client';
import { loadTestEnv, testDatabaseName, withDatabase } from './test-env';

/**
 * Creates a brand-new PostgreSQL database for this run and applies every
 * migration with `migrate deploy` (additive only). This proves the schema
 * reproduces from a clean database without resetting any existing one.
 */
export default async function globalSetup(): Promise<void> {
  process.env.TEST_RUN_ID = `${Date.now().toString(36)}${randomBytes(4).toString('hex')}`;
  loadTestEnv();

  const name = testDatabaseName(process.env.TEST_RUN_ID);
  const admin = new PrismaClient({
    datasourceUrl: withDatabase(process.env.DATABASE_URL!, 'postgres'),
  });
  try {
    await admin.$executeRawUnsafe(`CREATE DATABASE "${name}"`);
  } finally {
    await admin.$disconnect();
  }

  execSync('npx prisma migrate deploy', {
    cwd: path.resolve(__dirname, '..', '..'),
    env: process.env,
    stdio: 'pipe',
  });
}
