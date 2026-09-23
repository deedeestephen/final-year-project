import { createMongoClient } from '../../src/infrastructure/mongo/client';
import { PrismaClient } from '@prisma/client';
import { TEST_DB_PATTERN, testDatabaseName, withDatabase } from './test-env';

/**
 * Removes only the databases this run created (name checked against the
 * per-run pattern). Set KEEP_TEST_DB=1 to keep them for inspection.
 */
export default async function globalTeardown(): Promise<void> {
  const runId = process.env.TEST_RUN_ID;
  if (!runId || process.env.KEEP_TEST_DB === '1') return;
  const name = testDatabaseName(runId);
  if (!TEST_DB_PATTERN.test(name)) return;

  const admin = new PrismaClient({
    datasourceUrl: withDatabase(process.env.DATABASE_URL!, 'postgres'),
  });
  try {
    await admin.$executeRawUnsafe(
      `DROP DATABASE IF EXISTS "${name}" WITH (FORCE)`,
    );
  } finally {
    await admin.$disconnect();
  }

  const mongo = createMongoClient(process.env.MONGO_URL!);
  try {
    await mongo.connect();
    if (mongo.db().databaseName === name) await mongo.db().dropDatabase();
  } finally {
    await mongo.close();
  }
}
