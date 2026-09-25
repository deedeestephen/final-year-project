import path from 'node:path';
import { defineConfig } from 'prisma/config';
import { loadRootEnv, repoRoot } from './src/config/repo-root';

// Secrets live in the repository-root .env (shared with docker compose).
// In CI there is no .env file and the variables come from the environment.
loadRootEnv();

export default defineConfig({
  // The schema must sit inside this package: Prisma generates the client from
  // it into this package's node_modules.
  schema: path.join('prisma', 'schema.prisma'),
  migrations: {
    // The database change history belongs to the data persistence layer.
    path: path.join(
      repoRoot(__dirname),
      '5-data-persistence',
      'postgresql',
      'migrations',
    ),
    seed: 'ts-node --transpile-only src/persistence/seed.ts',
  },
});
