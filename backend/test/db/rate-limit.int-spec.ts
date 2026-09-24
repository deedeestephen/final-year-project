import type { NestExpressApplication } from '@nestjs/platform-express';
import { PrismaClient } from '@prisma/client';
import request from 'supertest';
import {
  createDbTestApp,
  createFacility,
  createUser,
  ensureSeeded,
  loginAs,
  TEST_PASSWORD,
} from './helpers';

const prisma = new PrismaClient();

/** The docker-compose Redis (password from .env), database 1 for tests. */
const redisUrl = () =>
  `redis://:${encodeURIComponent(process.env.REDIS_PASSWORD ?? '')}@localhost:6379/1`;

describe('per-account rate limits and the web session cookie (real database)', () => {
  const apps: NestExpressApplication[] = [];
  const as = (token: string) => ({ Authorization: `Bearer ${token}` });

  async function app(env: Record<string, string>) {
    const created = await createDbTestApp({
      RATE_LIMIT_MAX: '5000',
      USER_RATE_LIMIT_MAX: '5',
      REDIS_URL: '',
      ...env,
    });
    apps.push(created);
    return created;
  }

  beforeAll(async () => {
    await ensureSeeded(prisma);
  });

  afterAll(async () => {
    for (const a of apps) await a.close();
    await prisma.$disconnect();
  });

  it('limits each account separately, with Retry-After and remaining-count headers', async () => {
    const a = await app({});
    const facility = await createFacility(prisma, 'RL');
    const first = await loginAs(
      a,
      (await createUser(prisma, 'CLINICIAN', facility)).email,
    );
    const second = await loginAs(
      a,
      (await createUser(prisma, 'CLINICIAN', facility)).email,
    );
    const http = () => request(a.getHttpServer());

    for (let i = 0; i < 5; i++) {
      const ok = await http()
        .get('/api/v1/users/me')
        .set(as(first))
        .expect(200);
      expect(ok.headers['x-ratelimit-remaining']).toBe(String(4 - i));
    }
    const limited = await http()
      .get('/api/v1/users/me')
      .set(as(first))
      .expect(429);
    expect((limited.body as { error: { code: string } }).error.code).toBe(
      'RATE_LIMITED',
    );
    expect(Number(limited.headers['retry-after'])).toBeGreaterThan(0);

    // Another person in the same clinic (same network address) is not affected.
    await http().get('/api/v1/users/me').set(as(second)).expect(200);
    // Public endpoints are covered by the per-address limit only.
    await http().get('/api/v1/health').expect(200);
  });

  it('two API instances share one limit through Redis', async () => {
    const shared = { REDIS_URL: redisUrl() };
    const one = await app(shared);
    const two = await app(shared);
    const facility = await createFacility(prisma, 'RS');
    const user = await createUser(prisma, 'CLINICIAN', facility);
    const token = await loginAs(one, user.email);

    // 5 requests spread over both instances use up the one shared allowance.
    for (let i = 0; i < 5; i++) {
      const target = i % 2 === 0 ? one : two;
      await request(target.getHttpServer())
        .get('/api/v1/users/me')
        .set(as(token))
        .expect(200);
    }
    await request(two.getHttpServer())
      .get('/api/v1/users/me')
      .set(as(token))
      .expect(429);
    await request(one.getHttpServer())
      .get('/api/v1/users/me')
      .set(as(token))
      .expect(429);
  });

  it('keeps serving when the rate-limit store is unreachable (fails open)', async () => {
    const broken = await app({ REDIS_URL: 'redis://localhost:6399/0' });
    const facility = await createFacility(prisma, 'RF');
    const token = await loginAs(
      broken,
      (await createUser(prisma, 'CLINICIAN', facility)).email,
    );
    await request(broken.getHttpServer())
      .get('/api/v1/users/me')
      .set(as(token))
      .expect(200);
  });

  describe('web session (admin web app)', () => {
    it('keeps the refresh token in an HttpOnly cookie, rotates it, and clears it on sign-out', async () => {
      const a = await app({ USER_RATE_LIMIT_MAX: '1000' });
      const user = await createUser(prisma, 'ADMIN', null);
      const http = () => request(a.getHttpServer());

      const login = await http()
        .post('/api/v1/auth/login')
        .set('X-Client', 'web')
        .send({ email: user.email, password: TEST_PASSWORD })
        .expect(200);
      const body = login.body as { accessToken: string; refreshToken?: string };
      expect(body.accessToken).toBeTruthy();
      expect(body.refreshToken).toBeUndefined();
      const cookie = ([] as string[]).concat(
        login.headers['set-cookie'] ?? [],
      )[0];
      expect(cookie).toMatch(/^pca_refresh=/);
      expect(cookie).toMatch(/HttpOnly/i);
      expect(cookie).toMatch(/SameSite=Strict/i);
      expect(cookie).toMatch(/Path=\/api\/v1\/auth/);
      const jar = cookie.split(';')[0];

      // Without the web header the cookie alone is not accepted (CSRF defence).
      await http()
        .post('/api/v1/auth/refresh')
        .set('Cookie', jar)
        .send({})
        .expect(401);

      const refreshed = await http()
        .post('/api/v1/auth/refresh')
        .set('X-Client', 'web')
        .set('Cookie', jar)
        .send({})
        .expect(200);
      expect(
        (refreshed.body as { refreshToken?: string }).refreshToken,
      ).toBeUndefined();
      const rotated = ([] as string[]).concat(
        refreshed.headers['set-cookie'] ?? [],
      )[0];
      expect(rotated.split(';')[0]).not.toBe(jar);

      // The old cookie was rotated away; reusing it ends the session family.
      await http()
        .post('/api/v1/auth/refresh')
        .set('X-Client', 'web')
        .set('Cookie', jar)
        .send({})
        .expect(401);

      const again = await http()
        .post('/api/v1/auth/login')
        .set('X-Client', 'web')
        .send({ email: user.email, password: TEST_PASSWORD })
        .expect(200);
      const out = await http()
        .post('/api/v1/auth/logout')
        .set(as((again.body as { accessToken: string }).accessToken))
        .expect(204);
      const cleared = ([] as string[]).concat(
        out.headers['set-cookie'] ?? [],
      )[0];
      expect(cleared).toMatch(/pca_refresh=;/);
    });

    it('mobile clients still receive the refresh token in the body', async () => {
      const a = await app({ USER_RATE_LIMIT_MAX: '1000' });
      const user = await createUser(
        prisma,
        'CLINICIAN',
        await createFacility(prisma, 'MB'),
      );
      const res = await request(a.getHttpServer())
        .post('/api/v1/auth/login')
        .send({ email: user.email, password: TEST_PASSWORD })
        .expect(200);
      expect((res.body as { refreshToken: string }).refreshToken).toBeTruthy();
      expect(res.headers['set-cookie']).toBeUndefined();
    });
  });
});
