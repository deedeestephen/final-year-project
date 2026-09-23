import { INestApplication, VersioningType } from '@nestjs/common';

export const API_PREFIX = 'api';

/**
 * Applies the global HTTP configuration shared by `main.ts` and the e2e
 * tests, so tests exercise exactly the routing that production serves.
 * All routes are served under /api/v{n}/...
 */
export function configureApp(app: INestApplication): void {
  app.setGlobalPrefix(API_PREFIX);
  app.enableVersioning({ type: VersioningType.URI, defaultVersion: '1' });
}
