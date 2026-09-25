import { existsSync } from 'node:fs';
import path from 'node:path';

/**
 * The repository root: the nearest folder above `from` that holds
 * `.env.example`. Works from `src/`, `dist/`, `test/` and `tools/`, and keeps
 * working if the backend folder moves again. In a deployment without the
 * repository it returns `from` unchanged.
 */
export function repoRoot(from: string = __dirname): string {
  let dir = path.resolve(from);
  for (;;) {
    if (existsSync(path.join(dir, '.env.example'))) return dir;
    const parent = path.dirname(dir);
    if (parent === dir) return path.resolve(from);
    dir = parent;
  }
}

/**
 * Local development keeps its secrets in the repository-root `.env` (shared
 * with docker compose). Deployments and CI supply variables directly, so a
 * missing file is not an error.
 */
export function loadRootEnv(): void {
  try {
    process.loadEnvFile(path.join(repoRoot(), '.env'));
  } catch {
    // no .env file: rely on the process environment
  }
}
