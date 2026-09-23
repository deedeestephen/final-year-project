import { VersioningType } from '@nestjs/common';
import type { NestExpressApplication } from '@nestjs/platform-express';
import helmet from 'helmet';
import {
  bodyParserErrorMiddleware,
  requestIdMiddleware,
} from './common/http/http-middleware';
import type { AppConfig } from './config/app-config';

export const API_PREFIX = 'api';

/**
 * HTTP-level gateway configuration shared by `main.ts` and the e2e tests,
 * so tests exercise exactly what production serves. Routes live under /api/v{n}.
 * TLS 1.3 is terminated by the reverse proxy in front of this process
 * (see infrastructure/); HSTS is set here.
 */
export function configureApp(
  app: NestExpressApplication,
  config: AppConfig,
): void {
  app.use(requestIdMiddleware);
  app.setGlobalPrefix(API_PREFIX);
  app.enableVersioning({ type: VersioningType.URI, defaultVersion: '1' });

  app.use(
    helmet({
      hsts: { maxAge: 31_536_000, includeSubDomains: true },
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'none'"],
          frameAncestors: ["'none'"],
          // Swagger UI (non-production only) needs its own assets and inline styles.
          ...(config.apiDocsEnabled
            ? {
                defaultSrc: ["'self'"],
                styleSrc: ["'self'", "'unsafe-inline'"],
                imgSrc: ["'self'", 'data:'],
              }
            : {}),
        },
      },
    }),
  );

  app.enableCors({
    origin: config.corsOrigins.length > 0 ? config.corsOrigins : false,
    methods: ['GET', 'POST', 'PATCH', 'PUT', 'DELETE'],
    allowedHeaders: [
      'Authorization',
      'Content-Type',
      'X-Request-Id',
      'Idempotency-Key',
    ],
    exposedHeaders: ['X-Request-Id', 'Retry-After'],
    credentials: false,
    maxAge: 600,
  });

  app.useBodyParser('json', { limit: config.jsonBodyLimit });
  app.useBodyParser('urlencoded', {
    limit: config.jsonBodyLimit,
    extended: false,
  });
  app.use(bodyParserErrorMiddleware);

  if (config.trustProxy) app.set('trust proxy', 1);
  app.enableShutdownHooks();
}
