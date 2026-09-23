import path from 'node:path';
import { defineConfig } from 'prisma/config';

// Secrets live in the repository-root .env (shared with docker compose).
// In CI there is no .env file and the variables come from the environment.
try {
  process.loadEnvFile(path.resolve(__dirname, '..', '.env'));
} catch {
  // no .env file: rely on the process environment
}

export default defineConfig({
  schema: path.join('prisma', 'schema.prisma'),
  migrations: {
    path: path.join('prisma', 'migrations'),
    seed: 'ts-node --transpile-only prisma/seed.ts',
  },
});
