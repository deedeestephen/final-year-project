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
    // Per network address: high enough for many users behind one clinic NAT.
    RATE_LIMIT_MAX: z.coerce.number().int().positive().default(600),
    // Per signed-in account, shared by all API instances when REDIS_URL is set.
    USER_RATE_LIMIT_MAX: z.coerce.number().int().positive().default(120),
    REDIS_URL: z
      .string()
      .optional()
      .transform((v) => (v && v.trim() ? v.trim() : undefined))
      .pipe(z.url({ protocol: /^rediss?$/ }).optional()),
    LOG_LEVEL: z
      .enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent'])
      .default('info'),
    TRUST_PROXY: bool.default(false),
    API_DOCS_ENABLED: bool.optional(),
    // Authentication (Phase 4). Keys: base64 of PEM (scripts/gen-keys.mjs).
    JWT_PRIVATE_KEY_BASE64: z.string().min(1),
    JWT_PUBLIC_KEY_BASE64: z.string().min(1),
    JWT_ISSUER: z.string().min(1).default('pca-mhealth'),
    JWT_AUDIENCE: z.string().min(1).default('pca-mhealth-app'),
    ACCESS_TOKEN_TTL_SEC: z.coerce
      .number()
      .int()
      .min(60)
      .max(3600)
      .default(900),
    REFRESH_TOKEN_TTL_DAYS: z.coerce.number().int().min(1).max(90).default(14),
    LOGIN_MAX_ATTEMPTS: z.coerce.number().int().min(3).max(20).default(5),
    LOCKOUT_MINUTES: z.coerce.number().int().min(1).max(1440).default(15),
    AUTH_RATE_LIMIT_MAX: z.coerce.number().int().positive().default(10),
    PASSWORD_RESET_TTL_MIN: z.coerce.number().int().min(5).max(240).default(30),
    // Column encryption of patient identifiers (32-byte keys, base64).
    FIELD_ENCRYPTION_KEY_BASE64: z
      .string()
      .refine(
        (v) => Buffer.from(v, 'base64').length === 32,
        'must be 32 bytes, base64',
      ),
    FIELD_HMAC_KEY_BASE64: z
      .string()
      .refine(
        (v) => Buffer.from(v, 'base64').length === 32,
        'must be 32 bytes, base64',
      ),
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
  rateLimit: { ttlMs: number; limit: number; userLimit: number };
  /** Shared rate-limit store; in-memory (single instance) when unset. */
  redisUrl?: string;
  logLevel: string;
  trustProxy: boolean;
  apiDocsEnabled: boolean;
  auth: {
    jwtPrivateKeyPem: string;
    jwtPublicKeyPem: string;
    issuer: string;
    audience: string;
    accessTokenTtlSec: number;
    refreshTokenTtlDays: number;
    loginMaxAttempts: number;
    lockoutMinutes: number;
    rateLimitMax: number;
    passwordResetTtlMin: number;
  };
  fieldEncryptionKey: Buffer;
  fieldHmacKey: Buffer;
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
    rateLimit: {
      ttlMs: e.RATE_LIMIT_TTL_MS,
      limit: e.RATE_LIMIT_MAX,
      userLimit: e.USER_RATE_LIMIT_MAX,
    },
    redisUrl: e.REDIS_URL,
    logLevel: e.LOG_LEVEL,
    trustProxy: e.TRUST_PROXY,
    apiDocsEnabled: e.API_DOCS_ENABLED ?? e.NODE_ENV !== 'production',
    auth: {
      jwtPrivateKeyPem: Buffer.from(
        e.JWT_PRIVATE_KEY_BASE64,
        'base64',
      ).toString('utf8'),
      jwtPublicKeyPem: Buffer.from(e.JWT_PUBLIC_KEY_BASE64, 'base64').toString(
        'utf8',
      ),
      issuer: e.JWT_ISSUER,
      audience: e.JWT_AUDIENCE,
      accessTokenTtlSec: e.ACCESS_TOKEN_TTL_SEC,
      refreshTokenTtlDays: e.REFRESH_TOKEN_TTL_DAYS,
      loginMaxAttempts: e.LOGIN_MAX_ATTEMPTS,
      lockoutMinutes: e.LOCKOUT_MINUTES,
      rateLimitMax: e.AUTH_RATE_LIMIT_MAX,
      passwordResetTtlMin: e.PASSWORD_RESET_TTL_MIN,
    },
    fieldEncryptionKey: Buffer.from(e.FIELD_ENCRYPTION_KEY_BASE64, 'base64'),
    fieldHmacKey: Buffer.from(e.FIELD_HMAC_KEY_BASE64, 'base64'),
  };
}
