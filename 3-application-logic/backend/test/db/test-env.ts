import path from 'node:path';
import { repoRoot } from '../../src/config/repo-root';

/**
 * Integration tests run against the docker-compose services, but every run gets
 * its own freshly created databases named `pca_mhealth_<runId>_test`.
 * Nothing that existed before the run is modified or deleted.
 */
export const TEST_DB_PATTERN = /^pca_mhealth_[a-z0-9]{8,32}_test$/;

export function loadTestEnv(): void {
  try {
    process.loadEnvFile(path.join(repoRoot(), '.env'));
  } catch {
    // CI supplies variables directly
  }
  const runId = process.env.TEST_RUN_ID;
  const db = process.env.DATABASE_URL;
  const mongo = process.env.MONGO_URL;
  if (!runId)
    throw new Error('TEST_RUN_ID is not set (global setup did not run)');
  if (!db || !mongo)
    throw new Error('DATABASE_URL and MONGO_URL must be set for db tests');
  process.env.DATABASE_URL = withDatabase(db, testDatabaseName(runId));
  process.env.MONGO_URL = withDatabase(mongo, testDatabaseName(runId));
  process.env.S3_BUCKET = 'pca-mhealth-test';
}

export function testDatabaseName(runId: string): string {
  const name = `pca_mhealth_${runId}_test`;
  if (!TEST_DB_PATTERN.test(name))
    throw new Error(`Unexpected test database name: ${name}`);
  return name;
}

/** Replaces the database name in a postgres:// or mongodb:// URL. */
export function withDatabase(url: string, database: string): string {
  const u = new URL(url);
  u.pathname = `/${database}`;
  return u.toString();
}
