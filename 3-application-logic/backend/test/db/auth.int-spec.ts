import { randomBytes, randomUUID } from 'node:crypto';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { Test } from '@nestjs/testing';
import { PrismaClient } from '@prisma/client';
import { importPKCS8, SignJWT } from 'jose';
import request from 'supertest';
import { seed, SYNTHETIC_FACILITY_CODE } from '../../src/persistence/seed';
import { AppModule } from '../../src/app.module';
import { FieldCrypto } from '../../src/persistence/crypto/field-crypto';
import { loadConfig } from '../../src/config/app-config';
import { configureApp } from '../../src/gateway/configure-app';
import { ResetDelivery } from '../../src/services/auth/reset-delivery';
import { TEST_JWT_ENV } from '../fixtures/test-keys';

const DEMO_PASSWORD = 'Synthetic-Demo-Pass-1';
const ADMIN = 'admin@demo.pca-mhealth.test';

class CapturedResetDelivery extends ResetDelivery {
  readonly sent: { email: string; token: string }[] = [];
  send(email: string, token: string): Promise<void> {
    this.sent.push({ email, token });
    return Promise.resolve();
  }
}

interface ErrorBody {
  error: { status: number; code: string; message: string; details?: unknown };
}
interface LoginBody {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
  user: { id: string; roles: string[]; mustChangePassword: boolean };
}

const prisma = new PrismaClient();
const uniqueEmail = (tag: string) =>
  `${tag}-${randomUUID().slice(0, 8)}@example.test`;
const STRONG = 'river-mango-lantern-42';

async function createApp(env: Record<string, string> = {}) {
  Object.assign(process.env, {
    NODE_ENV: 'test',
    AUTH_RATE_LIMIT_MAX: '1000',
    RATE_LIMIT_MAX: '5000',
    USER_RATE_LIMIT_MAX: '5000',
    // In-memory counters: never share limits with the dev server or other runs.
    REDIS_URL: '',
    ...TEST_JWT_ENV,
    ...env,
  });
  const delivery = new CapturedResetDelivery();
  const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
    .overrideProvider(ResetDelivery)
    .useValue(delivery)
    .compile();
  const app = moduleRef.createNestApplication<NestExpressApplication>({
    bodyParser: false,
    logger: false,
  });
  configureApp(app, loadConfig(process.env));
  await app.init();
  return { app, delivery };
}

/** Required identity fields for self-registration (unique synthetic passport). */
const identity = () => ({
  phone: '+260971234567',
  idDocumentType: 'PASSPORT',
  idNumber: `ZP${String(Math.floor(Math.random() * 1e9)).padStart(9, '0')}`,
});

describe('authentication and authorisation (real database)', () => {
  let app: NestExpressApplication;
  let delivery: CapturedResetDelivery;
  const http = () => request(app.getHttpServer());

  const login = (email: string, password: string) =>
    http().post('/api/v1/auth/login').send({ email, password });

  async function registerAndLogin(
    tag: string,
  ): Promise<{ email: string; session: LoginBody }> {
    const email = uniqueEmail(tag);
    await http()
      .post('/api/v1/auth/register')
      .send({
        email,
        password: STRONG,
        displayName: 'SYNTHETIC Test Patient',
        ...identity(),
      })
      .expect(201);
    const res = await login(email, STRONG).expect(200);
    return { email, session: res.body as LoginBody };
  }

  /** The seeded admin must change the temporary password once; returns a usable admin session. */
  let adminSession: LoginBody;
  async function admin(): Promise<LoginBody> {
    if (adminSession) return adminSession;
    const first = (await login(ADMIN, DEMO_PASSWORD).expect(200))
      .body as LoginBody;
    const newPassword = 'orchid-tundra-velvet-19';
    await http()
      .post('/api/v1/auth/change-password')
      .set('Authorization', `Bearer ${first.accessToken}`)
      .send({ currentPassword: DEMO_PASSWORD, newPassword })
      .expect(204);
    adminSession = (await login(ADMIN, newPassword).expect(200))
      .body as LoginBody;
    return adminSession;
  }

  beforeAll(async () => {
    await seed(
      prisma,
      new FieldCrypto(randomBytes(32), randomBytes(32)),
      DEMO_PASSWORD,
    );
    ({ app, delivery } = await createApp());
  });

  afterAll(async () => {
    await app.close();
    await prisma.$disconnect();
  });

  describe('registration', () => {
    it('creates a PATIENT account only', async () => {
      const email = uniqueEmail('reg');
      const res = await http()
        .post('/api/v1/auth/register')
        .send({
          email: email.toUpperCase(),
          password: STRONG,
          displayName: 'SYNTHETIC P',
          ...identity(),
        })
        .expect(201);
      expect(res.body).toMatchObject({ email });
      const roles = await prisma.userRole.findMany({
        where: { user: { email } },
        include: { role: true },
      });
      expect(roles.map((r) => r.role.name)).toEqual(['PATIENT']);
    });

    it('rejects an attempt to self-assign roles (privilege escalation)', async () => {
      const res = await http()
        .post('/api/v1/auth/register')
        .send({
          email: uniqueEmail('esc'),
          password: STRONG,
          displayName: 'x',
          roles: ['ADMIN'],
          ...identity(),
        })
        .expect(400);
      expect((res.body as ErrorBody).error.code).toBe('VALIDATION_FAILED');
    });

    it('rejects weak passwords and duplicates', async () => {
      const weak = await http()
        .post('/api/v1/auth/register')
        .send({
          email: uniqueEmail('weak'),
          password: 'password1234',
          displayName: 'x',
          ...identity(),
        })
        .expect(400);
      expect(JSON.stringify(weak.body)).toMatch(/too common/);

      const email = uniqueEmail('dup');
      await http()
        .post('/api/v1/auth/register')
        .send({ email, password: STRONG, displayName: 'x', ...identity() })
        .expect(201);
      await http()
        .post('/api/v1/auth/register')
        .send({ email, password: STRONG, displayName: 'x', ...identity() })
        .expect(409);
    });

    it('never stores the password in clear text', async () => {
      const { email } = await registerAndLogin('hash');
      const user = await prisma.user.findUniqueOrThrow({ where: { email } });
      expect(user.passwordHash.startsWith('$argon2id$')).toBe(true);
      expect(user.passwordHash).not.toContain(STRONG);
    });
  });

  describe('login', () => {
    it('returns tokens and records a successful login in the audit log', async () => {
      const { session } = await registerAndLogin('ok');
      expect(session.accessToken.split('.')).toHaveLength(3);
      expect(session.refreshToken).toMatch(/^[A-Za-z0-9_-]{43}$/);
      expect(session.expiresIn).toBe(900);
      expect(session.user.roles).toEqual(['PATIENT']);
      const audit = await prisma.auditLog.findFirst({
        where: {
          action: 'auth.login',
          actorUserId: session.user.id,
          outcome: 'SUCCESS',
        },
      });
      expect(audit).not.toBeNull();
    });

    it('gives the same answer for a wrong password and an unknown email (no enumeration)', async () => {
      const { email } = await registerAndLogin('enum');
      const wrong = await login(email, 'not-the-right-password').expect(401);
      const unknown = await login(
        uniqueEmail('nobody'),
        'not-the-right-password',
      ).expect(401);
      const strip = (b: ErrorBody) => ({ ...b.error, requestId: undefined });
      expect(strip(wrong.body as ErrorBody)).toEqual(
        strip(unknown.body as ErrorBody),
      );
      expect((wrong.body as ErrorBody).error.code).toBe('INVALID_CREDENTIALS');
    });

    it('locks the account after 5 consecutive failures, then unlocks after the lockout period', async () => {
      const { email } = await registerAndLogin('lock');
      for (let i = 0; i < 5; i++)
        await login(email, `wrong-password-${i}`).expect(401);
      const locked = await login(email, STRONG).expect(423);
      expect((locked.body as ErrorBody).error.code).toBe('ACCOUNT_LOCKED');

      const user = await prisma.user.findUniqueOrThrow({ where: { email } });
      expect(
        await prisma.auditLog.count({
          where: { action: 'auth.lockout', entityId: user.id },
        }),
      ).toBe(1);

      await prisma.user.update({
        where: { email },
        data: { lockedUntil: new Date(Date.now() - 1000) },
      });
      await login(email, STRONG).expect(200);
    });

    it('resets the failure counter after a successful login', async () => {
      const { email } = await registerAndLogin('reset-count');
      for (let i = 0; i < 4; i++)
        await login(email, 'wrong-password-x').expect(401);
      await login(email, STRONG).expect(200);
      for (let i = 0; i < 4; i++)
        await login(email, 'wrong-password-y').expect(401);
      await login(email, STRONG).expect(200);
    });
  });

  describe('access tokens', () => {
    const me = (token?: string) => {
      const r = http().get('/api/v1/users/me');
      return token === undefined
        ? r
        : r.set('Authorization', `Bearer ${token}`);
    };

    it('lets a valid token read the current user', async () => {
      const { email, session } = await registerAndLogin('me');
      const res = await me(session.accessToken).expect(200);
      expect(res.body).toMatchObject({ email, roles: ['PATIENT'] });
      expect(res.body).not.toHaveProperty('passwordHash');
    });

    it('rejects missing, malformed and garbage tokens', async () => {
      expect(((await me().expect(401)).body as ErrorBody).error.code).toBe(
        'UNAUTHENTICATED',
      );
      await http()
        .get('/api/v1/users/me')
        .set('Authorization', 'Basic abc')
        .expect(401);
      expect(
        ((await me('not.a.token').expect(401)).body as ErrorBody).error.code,
      ).toBe('INVALID_TOKEN');
    });

    it('rejects an expired token', async () => {
      const { session } = await registerAndLogin('exp');
      const claims = JSON.parse(
        Buffer.from(session.accessToken.split('.')[1], 'base64url').toString(),
      ) as {
        sub: string;
        fid: string;
      };
      const key = await importPKCS8(
        Buffer.from(TEST_JWT_ENV.JWT_PRIVATE_KEY_BASE64, 'base64').toString(),
        'EdDSA',
      );
      const expired = await new SignJWT({ fid: claims.fid })
        .setProtectedHeader({ alg: 'EdDSA', typ: 'JWT' })
        .setSubject(claims.sub)
        .setIssuer('pca-mhealth')
        .setAudience('pca-mhealth-app')
        .setIssuedAt(Math.floor(Date.now() / 1000) - 3600)
        .setExpirationTime(Math.floor(Date.now() / 1000) - 60)
        .sign(key);
      await me(expired).expect(401);
    });

    it('rejects an unsigned alg:none token claiming to be the admin', async () => {
      const adminUser = await prisma.user.findUniqueOrThrow({
        where: { email: ADMIN },
      });
      const part = (v: object) =>
        Buffer.from(JSON.stringify(v)).toString('base64url');
      const forged = `${part({ alg: 'none', typ: 'JWT' })}.${part({
        sub: adminUser.id,
        fid: randomUUID(),
        iss: 'pca-mhealth',
        aud: 'pca-mhealth-app',
        iat: Math.floor(Date.now() / 1000),
        exp: Math.floor(Date.now() / 1000) + 600,
      })}.`;
      await me(forged).expect(401);
      await http()
        .get('/api/v1/users')
        .set('Authorization', `Bearer ${forged}`)
        .expect(401);
    });
  });

  describe('role-based access control', () => {
    it('forbids a patient from administrative endpoints and audits the denial', async () => {
      const { session } = await registerAndLogin('rbac');
      const res = await http()
        .get('/api/v1/users')
        .set('Authorization', `Bearer ${session.accessToken}`)
        .expect(403);
      expect((res.body as ErrorBody).error.code).toBe('FORBIDDEN');
      const denied = await prisma.auditLog.findFirst({
        where: { action: 'access.denied', actorUserId: session.user.id },
      });
      expect(denied?.details).toMatchObject({ missing: ['user:manage'] });

      await http()
        .post('/api/v1/users')
        .set('Authorization', `Bearer ${session.accessToken}`)
        .send({ email: uniqueEmail('x'), displayName: 'x', roles: ['ADMIN'] })
        .expect(403);
    });

    it('requires a temporary password to be changed before anything else', async () => {
      const first = (
        await login('pathologist@demo.pca-mhealth.test', DEMO_PASSWORD).expect(
          200,
        )
      ).body as LoginBody;
      expect(first.user.mustChangePassword).toBe(true);
      const blocked = await http()
        .get('/api/v1/users')
        .set('Authorization', `Bearer ${first.accessToken}`)
        .expect(403);
      expect((blocked.body as ErrorBody).error.code).toBe(
        'PASSWORD_CHANGE_REQUIRED',
      );
      await http()
        .get('/api/v1/users/me')
        .set('Authorization', `Bearer ${first.accessToken}`)
        .expect(200);
    });

    it('lets an administrator list, create and manage users', async () => {
      const a = await admin();
      const auth = { Authorization: `Bearer ${a.accessToken}` };
      const page = await http()
        .get('/api/v1/users?page=1&pageSize=5')
        .set(auth)
        .expect(200);
      expect(page.body).toMatchObject({ page: 1, pageSize: 5 });

      const noFacility = await http()
        .post('/api/v1/users')
        .set(auth)
        .send({
          email: uniqueEmail('clin'),
          displayName: 'SYNTHETIC Clinician',
          roles: ['CLINICIAN'],
        })
        .expect(400);
      expect(JSON.stringify(noFacility.body)).toContain('facilityId');

      const facility = await prisma.facility.findUniqueOrThrow({
        where: { code: SYNTHETIC_FACILITY_CODE },
      });
      const email = uniqueEmail('clin');
      const created = await http()
        .post('/api/v1/users')
        .set(auth)
        .send({
          email,
          displayName: 'SYNTHETIC Clinician',
          roles: ['CLINICIAN'],
          facilityId: facility.id,
        })
        .expect(201);
      const body = created.body as {
        user: { id: string; mustChangePassword: boolean };
        temporaryPassword: string;
      };
      expect(body.user.mustChangePassword).toBe(true);
      const clinician = (await login(email, body.temporaryPassword).expect(200))
        .body as LoginBody;
      expect(clinician.user.roles).toEqual(['CLINICIAN']);

      // Unknown fields such as a password hash cannot be mass-assigned.
      await http()
        .patch(`/api/v1/users/${body.user.id}`)
        .set(auth)
        .send({ passwordHash: 'x' })
        .expect(400);
      await http().get(`/api/v1/users/${randomUUID()}`).set(auth).expect(404);
      await http().get('/api/v1/users/not-a-uuid').set(auth).expect(400);
    });

    it('stops administrators from disabling themselves', async () => {
      const a = await admin();
      const res = await http()
        .patch(`/api/v1/users/${a.user.id}`)
        .set('Authorization', `Bearer ${a.accessToken}`)
        .send({ status: 'DISABLED' })
        .expect(400);
      expect((res.body as ErrorBody).error.code).toBe('SELF_LOCKOUT');
    });

    it('ends a disabled user’s access immediately', async () => {
      const a = await admin();
      const { email, session } = await registerAndLogin('disable');
      await http()
        .patch(`/api/v1/users/${session.user.id}`)
        .set('Authorization', `Bearer ${a.accessToken}`)
        .send({ status: 'DISABLED' })
        .expect(200);
      await http()
        .get('/api/v1/users/me')
        .set('Authorization', `Bearer ${session.accessToken}`)
        .expect(401);
      expect(
        ((await login(email, STRONG).expect(401)).body as ErrorBody).error.code,
      ).toBe('INVALID_CREDENTIALS');
    });
  });

  describe('sessions', () => {
    const refresh = (refreshToken: string) =>
      http().post('/api/v1/auth/refresh').send({ refreshToken });

    it('rotates refresh tokens and detects reuse of an old one (token theft)', async () => {
      const { session } = await registerAndLogin('rotate');
      const second = (await refresh(session.refreshToken).expect(200))
        .body as LoginBody;
      expect(second.refreshToken).not.toBe(session.refreshToken);

      // The old token is presented again: treated as theft, whole session revoked.
      await refresh(session.refreshToken).expect(401);
      await refresh(second.refreshToken).expect(401);
      await http()
        .get('/api/v1/users/me')
        .set('Authorization', `Bearer ${second.accessToken}`)
        .expect(401);
      // Every presentation of a revoked token is recorded (here: the stolen one, then the rotated one).
      expect(
        await prisma.auditLog.count({
          where: { action: 'auth.refresh_reuse', actorUserId: session.user.id },
        }),
      ).toBeGreaterThanOrEqual(1);
    });

    it('rejects an unknown refresh token', async () => {
      await refresh(randomBytes(32).toString('base64url')).expect(401);
    });

    it('logout revokes the session and its access token', async () => {
      const { session } = await registerAndLogin('logout');
      await http()
        .post('/api/v1/auth/logout')
        .set('Authorization', `Bearer ${session.accessToken}`)
        .expect(204);
      await http()
        .get('/api/v1/users/me')
        .set('Authorization', `Bearer ${session.accessToken}`)
        .expect(401);
      await refresh(session.refreshToken).expect(401);
    });
  });

  describe('password reset', () => {
    it('answers identically whether or not the account exists', async () => {
      const { email } = await registerAndLogin('forgot-same');
      const before = delivery.sent.length;
      const known = await http()
        .post('/api/v1/auth/forgot-password')
        .send({ email })
        .expect(202);
      const unknown = await http()
        .post('/api/v1/auth/forgot-password')
        .send({ email: uniqueEmail('nobody') })
        .expect(202);
      expect(known.body).toEqual(unknown.body);
      expect(delivery.sent.length).toBe(before + 1);
    });

    it('resets the password once, signs out all sessions, and cannot be replayed', async () => {
      const { email, session } = await registerAndLogin('forgot');
      await http()
        .post('/api/v1/auth/forgot-password')
        .send({ email })
        .expect(202);
      const token = delivery.sent
        .filter((m) => m.email === email)
        .at(-1)!.token;
      const newPassword = 'harbour-violet-compass-77';

      await http()
        .post('/api/v1/auth/reset-password')
        .send({ token, newPassword })
        .expect(204);
      await http()
        .get('/api/v1/users/me')
        .set('Authorization', `Bearer ${session.accessToken}`)
        .expect(401);
      await login(email, STRONG).expect(401);
      await login(email, newPassword).expect(200);

      const replay = await http()
        .post('/api/v1/auth/reset-password')
        .send({ token, newPassword })
        .expect(400);
      expect((replay.body as ErrorBody).error.code).toBe(
        'INVALID_OR_EXPIRED_TOKEN',
      );
    });

    it('rejects an expired reset token', async () => {
      const { email } = await registerAndLogin('forgot-exp');
      await http()
        .post('/api/v1/auth/forgot-password')
        .send({ email })
        .expect(202);
      const token = delivery.sent
        .filter((m) => m.email === email)
        .at(-1)!.token;
      await prisma.passwordResetToken.updateMany({
        where: { user: { email } },
        data: { expiresAt: new Date(Date.now() - 1000) },
      });
      await http()
        .post('/api/v1/auth/reset-password')
        .send({ token, newPassword: 'harbour-violet-compass-78' })
        .expect(400);
    });

    it('rejects a wrong current password on change-password', async () => {
      const { session } = await registerAndLogin('change');
      const res = await http()
        .post('/api/v1/auth/change-password')
        .set('Authorization', `Bearer ${session.accessToken}`)
        .send({
          currentPassword: 'definitely-wrong-pw',
          newPassword: 'another-good-passphrase',
        })
        .expect(400);
      expect((res.body as ErrorBody).error.code).toBe(
        'INVALID_CURRENT_PASSWORD',
      );
    });
  });
});

describe('authentication rate limiting', () => {
  it('returns 429 after the configured number of login attempts', async () => {
    const { app } = await createApp({ AUTH_RATE_LIMIT_MAX: '3' });
    try {
      const attempt = () =>
        request(app.getHttpServer())
          .post('/api/v1/auth/login')
          .send({ email: uniqueEmail('rl'), password: 'whatever-password' });
      for (let i = 0; i < 3; i++) await attempt().expect(401);
      const limited = await attempt().expect(429);
      expect((limited.body as ErrorBody).error.code).toBe('RATE_LIMITED');
      // Non-auth routes are not affected by the auth limit.
      await request(app.getHttpServer()).get('/api/v1/health').expect(200);
      // Nor is refreshing (a random token; web pages refresh on every load).
      for (let i = 0; i < 5; i++) {
        await request(app.getHttpServer())
          .post('/api/v1/auth/refresh')
          .send({ refreshToken: 'x'.repeat(43) })
          .expect(401);
      }
    } finally {
      await app.close();
      await prisma.$disconnect();
    }
  });
});
