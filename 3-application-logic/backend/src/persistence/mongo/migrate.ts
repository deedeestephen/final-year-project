import { createMongoClient } from './client';
import { ensureMongoCollections } from './collections';
import { loadRootEnv } from '../../config/repo-root';

/** CLI: `npm run db:mongo:migrate` applies collection validators and indexes. */
async function main(): Promise<void> {
  loadRootEnv();
  const url = process.env.MONGO_URL;
  if (!url) throw new Error('MONGO_URL is not set');
  const client = createMongoClient(url);
  try {
    await client.connect();
    await ensureMongoCollections(client.db());
    console.log('MongoDB collections, validators and indexes are up to date.');
  } finally {
    await client.close();
  }
}

void main().catch((err: unknown) => {
  console.error(err);
  process.exitCode = 1;
});
