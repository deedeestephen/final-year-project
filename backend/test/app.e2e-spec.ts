import type { NestExpressApplication } from '@nestjs/platform-express';
import request from 'supertest';
import type { HealthStatus } from '../src/modules/health/health.controller';
import { buildOpenApiDocument } from '../src/openapi';
import { createTestApp } from './e2e-app';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

interface ErrorResponse {
  error: {
    status: number;
    code: string;
    message: string;
    details?: { field: string; errors?: string[] }[];
    requestId: string;
  };
}

describe('API gateway (e2e)', () => {
  let app: NestExpressApplication;

  beforeEach(async () => {
    app = await createTestApp();
  });

  afterEach(async () => {
    await app.close();
  });

  const http = () => request(app.getHttpServer());

  describe('routing and versioning', () => {
    it('GET /api/v1/health reports the service as up', async () => {
      const res = await http().get('/api/v1/health').expect(200);
      const body = res.body as HealthStatus;
      expect(body).toMatchObject({
        status: 'ok',
        service: 'pca-mhealth-backend',
      });
      expect(typeof body.timestamp).toBe('string');
    });

    it('does not serve unversioned routes, and 404s use the error envelope', async () => {
      const res = await http().get('/health').expect(404);
      const body = res.body as ErrorResponse;
      expect(body.error).toMatchObject({ status: 404, code: 'NOT_FOUND' });
      expect(body.error.requestId).toMatch(UUID);
    });
  });

  describe('request ids', () => {
    it('generates an id and returns it in X-Request-Id', async () => {
      const res = await http().get('/api/v1/health');
      expect(res.headers['x-request-id']).toMatch(UUID);
    });

    it('propagates a well-formed incoming id and replaces a malformed one', async () => {
      const ok = await http()
        .get('/api/v1/health')
        .set('X-Request-Id', 'mobile-abc123');
      expect(ok.headers['x-request-id']).toBe('mobile-abc123');
      const bad = await http()
        .get('/api/v1/health')
        .set('X-Request-Id', '<script>');
      expect(bad.headers['x-request-id']).toMatch(UUID);
    });
  });

  describe('security headers', () => {
    it('sets hardening headers and hides the framework', async () => {
      const res = await http().get('/api/v1/health');
      expect(res.headers['x-content-type-options']).toBe('nosniff');
      expect(res.headers['strict-transport-security']).toContain(
        'max-age=31536000',
      );
      expect(res.headers['content-security-policy']).toContain(
        "frame-ancestors 'none'",
      );
      expect(res.headers['x-frame-options']).toBeDefined();
      expect(res.headers['x-powered-by']).toBeUndefined();
    });
  });

  describe('CORS', () => {
    it('allows the configured origin', async () => {
      const res = await http()
        .options('/api/v1/health')
        .set('Origin', 'https://app.example.test')
        .set('Access-Control-Request-Method', 'GET');
      expect(res.headers['access-control-allow-origin']).toBe(
        'https://app.example.test',
      );
    });

    it('does not grant access to other origins', async () => {
      const res = await http()
        .options('/api/v1/health')
        .set('Origin', 'https://evil.example')
        .set('Access-Control-Request-Method', 'GET');
      expect(res.headers['access-control-allow-origin']).toBeUndefined();
    });
  });

  describe('validation', () => {
    it('rejects invalid fields with VALIDATION_FAILED and per-field details', async () => {
      const res = await http()
        .post('/api/v1/test/echo')
        .send({ name: '', psaNgMl: -2 })
        .expect(400);
      const body = res.body as ErrorResponse;
      expect(body.error.code).toBe('VALIDATION_FAILED');
      expect(body.error.details?.map((d) => d.field).sort()).toEqual([
        'name',
        'psaNgMl',
      ]);
    });

    it('rejects unknown properties instead of silently dropping them', async () => {
      const res = await http()
        .post('/api/v1/test/echo')
        .send({ name: 'ok', psaNgMl: 1, isAdmin: true })
        .expect(400);
      expect((res.body as ErrorResponse).error.details).toEqual([
        { field: 'isAdmin', errors: ['property isAdmin should not exist'] },
      ]);
    });

    it('does not echo submitted values back in validation errors', async () => {
      const res = await http()
        .post('/api/v1/test/echo')
        .send({ name: 'x', psaNgMl: 'secret-value-123' })
        .expect(400);
      expect(JSON.stringify(res.body)).not.toContain('secret-value-123');
    });

    it('accepts a valid body', async () => {
      await http()
        .post('/api/v1/test/echo')
        .send({ name: 'SYNTHETIC', psaNgMl: 4.2 })
        .expect(201, { name: 'SYNTHETIC', psaNgMl: 4.2 });
    });

    it('rejects malformed JSON with MALFORMED_JSON', async () => {
      const res = await http()
        .post('/api/v1/test/echo')
        .set('Content-Type', 'application/json')
        .send('{"name": ')
        .expect(400);
      expect((res.body as ErrorResponse).error.code).toBe('MALFORMED_JSON');
    });

    it('rejects bodies over the configured size limit with 413', async () => {
      const res = await http()
        .post('/api/v1/test/echo')
        .send({ name: 'x'.repeat(2_000), psaNgMl: 1 })
        .expect(413);
      expect((res.body as ErrorResponse).error.code).toBe('PAYLOAD_TOO_LARGE');
    });
  });

  describe('error handling', () => {
    it('hides internal error details behind a generic 500', async () => {
      const res = await http().get('/api/v1/test/boom').expect(500);
      expect((res.body as ErrorResponse).error).toMatchObject({
        code: 'INTERNAL_ERROR',
        message: 'An unexpected error occurred',
      });
      expect(JSON.stringify(res.body)).not.toMatch(
        /secret-password|postgres:\/\/|at .*\.ts/,
      );
    });

    it('maps a database unique violation to 409 CONFLICT', async () => {
      const res = await http().get('/api/v1/test/duplicate').expect(409);
      expect((res.body as ErrorResponse).error).toMatchObject({
        code: 'CONFLICT',
        details: [{ field: 'email' }],
      });
    });
  });

  describe('rate limiting', () => {
    it('returns 429 RATE_LIMITED with Retry-After once the limit is exceeded', async () => {
      for (let i = 0; i < 20; i++)
        await http().get('/api/v1/test/ping').expect(200);
      const res = await http().get('/api/v1/test/ping').expect(429);
      expect((res.body as ErrorResponse).error.code).toBe('RATE_LIMITED');
      expect(res.headers['retry-after']).toBeDefined();
    });

    it('does not rate-limit health checks', async () => {
      for (let i = 0; i < 25; i++)
        await http().get('/api/v1/health').expect(200);
    });
  });

  describe('OpenAPI', () => {
    it('describes the API as an OpenAPI 3 document', () => {
      const doc = buildOpenApiDocument(app);
      expect(doc.openapi).toMatch(/^3\./);
      expect(Object.keys(doc.paths)).toEqual(
        expect.arrayContaining(['/api/v1/health', '/api/v1/health/ready']),
      );
    });
  });
});

describe('readiness (e2e)', () => {
  it('is 200 when the databases are reachable', async () => {
    const app = await createTestApp({ postgresUp: true, mongoUp: true });
    await request(app.getHttpServer())
      .get('/api/v1/health/ready')
      .expect(200, { status: 'ok', checks: { postgres: 'up', mongodb: 'up' } });
    await app.close();
  });

  it('is 503 and names the dependency that is down', async () => {
    const app = await createTestApp({ postgresUp: false, mongoUp: true });
    await request(app.getHttpServer())
      .get('/api/v1/health/ready')
      .expect(503, {
        status: 'unavailable',
        checks: { postgres: 'down', mongodb: 'up' },
      });
    await app.close();
  });
});
