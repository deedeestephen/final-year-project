import { randomUUID } from 'node:crypto';
import type { IncomingMessage, ServerResponse } from 'node:http';
import type { Params } from 'nestjs-pino';
import type { AppConfig } from '../../config/app-config';

/** Paths removed from every log line (security.md: never log passwords, tokens or identifiers). */
export const REDACT_PATHS = [
  'req.headers.authorization',
  'req.headers.cookie',
  'req.headers["x-api-key"]',
  'res.headers["set-cookie"]',
  '*.password',
  '*.newPassword',
  '*.currentPassword',
  '*.token',
  '*.accessToken',
  '*.refreshToken',
  '*.resetToken',
  '*.nationalId',
  '*.phone',
  '*.givenName',
  '*.familyName',
  '*.email',
  'err.meta',
];

const REQUEST_ID = /^[A-Za-z0-9._-]{8,64}$/;

/** Accepts a well-formed incoming X-Request-Id (for tracing across services) or generates one. */
export function resolveRequestId(
  req: IncomingMessage,
  res: ServerResponse,
): string {
  const incoming = req.headers['x-request-id'];
  const id =
    typeof incoming === 'string' && REQUEST_ID.test(incoming)
      ? incoming
      : randomUUID();
  res.setHeader('x-request-id', id);
  return id;
}

export function loggerOptions(config: AppConfig): Params {
  return {
    pinoHttp: {
      level: config.nodeEnv === 'test' ? 'silent' : config.logLevel,
      // Reuse the id assigned by requestIdMiddleware (first middleware).
      genReqId: (req, res) =>
        (req as IncomingMessage & { id?: string }).id ??
        resolveRequestId(req, res),
      redact: { paths: REDACT_PATHS, censor: '[REDACTED]' },
      // Log only method, path (no query string, which could carry tokens) and id.
      serializers: {
        req: (req: { id: string; method: string; url: string }) => ({
          id: req.id,
          method: req.method,
          path: req.url.split('?')[0],
        }),
      },
      autoLogging: {
        ignore: (req) => (req.url ?? '').includes('/health'),
      },
      transport:
        config.nodeEnv === 'development'
          ? { target: 'pino-pretty', options: { singleLine: true } }
          : undefined,
    },
  };
}
