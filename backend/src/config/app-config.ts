import { z } from 'zod';

/**
 * Typed, validated configuration. Validation runs once at startup and the
 * process refuses to start on any problem. Error messages name the variable
 * but never repeat its value, because values may be secrets.
 */
const bool = z
  .enum(['true', 'false', '1', '0'])
  .transform((v) => v === 'true' || v === '1');

const origin = z
  .string()
  .trim()
  .refine(
    (v) => /^https?:\/\/[^/\s*]+$/.test(v),
    'must be an http(s) origin without path or wildcard',
  );

const schema = z
  .object({
    NODE_ENV: z
      .enum(['development', 'test', 'production'])
      .default('development'),
    PORT: z.coerce.number().int().min(1).max(65535).default(3000),
    DATABASE_URL: z.url({ protocol: /^postgres(ql)?$/ }),
    MONGO_URL: z.url({ protocol: /^mongodb(\+srv)?$/ }),
    CORS_ORIGINS: z
      .string()
      .default('')
      .transform((v) =>
        v
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean),
      )
      .pipe(z.array(origin)),
    JSON_BODY_LIMIT: z
      .string()
      .regex(/^\d+(kb|mb)$/)
      .default('1mb'),
    RATE_LIMIT_TTL_MS: z.coerce.number().int().positive().default(60_000),
    RATE_LIMIT_MAX: z.coerce.number().int().positive().default(120),
    LOG_LEVEL: z
      .enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent'])
      .default('info'),
    TRUST_PROXY: bool.default(false),
    API_DOCS_ENABLED: bool.optional(),
  })
  .superRefine((env, ctx) => {
    if (env.NODE_ENV === 'production' && env.CORS_ORIGINS.length === 0) {
      ctx.addIssue({
        code: 'custom',
        path: ['CORS_ORIGINS'],
        message: 'an explicit allow-list is required in production',
      });
    }
  });

export interface AppConfig {
  nodeEnv: 'development' | 'test' | 'production';
  port: number;
  databaseUrl: string;
  mongoUrl: string;
  corsOrigins: string[];
  jsonBodyLimit: string;
  rateLimit: { ttlMs: number; limit: number };
  logLevel: string;
  trustProxy: boolean;
  apiDocsEnabled: boolean;
}

export const APP_CONFIG = Symbol('APP_CONFIG');

export function loadConfig(env: Record<string, string | undefined>): AppConfig {
  const result = schema.safeParse(env);
  if (!result.success) {
    const problems = result.error.issues
      .map(
        (i) =>
          `  - ${i.path.join('.') || '(root)'}: ${i.message.replace(/received .*/i, 'invalid value')}`,
      )
      .sort();
    throw new Error(`Invalid configuration:\n${problems.join('\n')}`);
  }
  const e = result.data;
  return {
    nodeEnv: e.NODE_ENV,
    port: e.PORT,
    databaseUrl: e.DATABASE_URL,
    mongoUrl: e.MONGO_URL,
    corsOrigins: e.CORS_ORIGINS,
    jsonBodyLimit: e.JSON_BODY_LIMIT,
    rateLimit: { ttlMs: e.RATE_LIMIT_TTL_MS, limit: e.RATE_LIMIT_MAX },
    logLevel: e.LOG_LEVEL,
    trustProxy: e.TRUST_PROXY,
    apiDocsEnabled: e.API_DOCS_ENABLED ?? e.NODE_ENV !== 'production',
  };
}
