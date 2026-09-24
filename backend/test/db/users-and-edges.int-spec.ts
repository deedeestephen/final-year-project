import { randomUUID } from 'node:crypto';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { PrismaClient } from '@prisma/client';
import request from 'supertest';
import {
  createDbTestApp,
  createFacility,
  createUser,
  ensureSeeded,
  loginAs,
} from './helpers';

interface ErrorBody {
  error: { code: string };
}
interface UserBody {
  id: string;
  status: string;
  roles: string[];
  facilityId: string | null;
  displayName: string;
  lockedUntil: string | null;
}

const prisma = new PrismaClient();

describe('user administration and edge cases (real database)', () => {
  let app: NestExpressApplication;
  let facilityA: string;
  let adminToken: string;
  let adminId: string;
  let clinicianA: string;
  const http = () => request(app.getHttpServer());
  const as = (token: string) => ({ Authorization: `Bearer ${token}` });

  beforeAll(async () => {
    await ensureSeeded(prisma);
    app = await createDbTestApp();
    facilityA = await createFacility(prisma, 'EDGE');
    const admin = await createUser(prisma, 'ADMIN', null);
    adminId = admin.id;
    adminToken = await loginAs(app, admin.email);
    clinicianA = await loginAs(
      app,
      (await createUser(prisma, 'CLINICIAN', facilityA)).email,
    );
  });

  afterAll(async () => {
    await app.close();
    await prisma.$disconnect();
  });

  describe('administrator user management', () => {
    it('shows a locked account as LOCKED and can unlock it', async () => {
      const user = await createUser(prisma, 'PATIENT', null);
      await prisma.user.update({
        where: { id: user.id },
        data: { lockedUntil: new Date(Date.now() + 60_000) },
      });
      const locked = await http()
        .get(`/api/v1/users/${user.id}`)
        .set(as(adminToken))
        .expect(200);
      expect((locked.body as UserBody).status).toBe('LOCKED');

      const unlocked = await http()
        .patch(`/api/v1/users/${user.id}`)
        .set(as(adminToken))
        .send({ unlock: true })
        .expect(200);
      expect(unlocked.body as UserBody).toMatchObject({
        status: 'ACTIVE',
        lockedUntil: null,
      });
      await loginAs(app, user.email);
    });

    it('changes roles, display name and facility, and ends existing sessions', async () => {
      const user = await createUser(prisma, 'PATIENT', null);
      const token = await loginAs(app, user.email);
      const res = await http()
        .patch(`/api/v1/users/${user.id}`)
        .set(as(adminToken))
        .send({
          roles: ['CLINICIAN'],
          displayName: 'SYNTHETIC Promoted',
          facilityId: facilityA,
        })
        .expect(200);
      expect(res.body as UserBody).toMatchObject({
        roles: ['CLINICIAN'],
        displayName: 'SYNTHETIC Promoted',
        facilityId: facilityA,
      });
      // Access changed, so the old session no longer works.
      await http().get('/api/v1/users/me').set(as(token)).expect(401);
    });

    it('creates an administrator without a facility and rejects duplicate emails', async () => {
      const email = `admin2-${randomUUID().slice(0, 8)}@example.test`;
      const created = await http()
        .post('/api/v1/users')
        .set(as(adminToken))
        .send({ email, displayName: 'SYNTHETIC Admin 2', roles: ['ADMIN'] })
        .expect(201);
      expect((created.body as { user: UserBody }).user.facilityId).toBeNull();
      const dup = await http()
        .post('/api/v1/users')
        .set(as(adminToken))
        .send({ email, displayName: 'x', roles: ['ADMIN'] })
        .expect(409);
      expect((dup.body as ErrorBody).error.code).toBe('CONFLICT');
    });

    it('refuses to remove the administrator role from oneself and 404s unknown users', async () => {
      const res = await http()
        .patch(`/api/v1/users/${adminId}`)
        .set(as(adminToken))
        .send({ roles: ['CLINICIAN'] })
        .expect(400);
      expect((res.body as ErrorBody).error.code).toBe('SELF_LOCKOUT');
      await http()
        .patch(`/api/v1/users/${randomUUID()}`)
        .set(as(adminToken))
        .send({ displayName: 'x' })
        .expect(404);
    });

    it('rejects an unknown role name', async () => {
      await http()
        .post('/api/v1/users')
        .set(as(adminToken))
        .send({
          email: `r-${randomUUID().slice(0, 6)}@example.test`,
          displayName: 'x',
          roles: ['SUPERUSER'],
        })
        .expect(400);
    });
  });

  describe('patient edge cases', () => {
    const base = () => ({
      givenName: 'SYNTHETIC',
      familyName: `Edge-${randomUUID().slice(0, 6)}`,
      dateOfBirth: '1960-05-05',
      regionClass: 'URBAN',
    });

    it('registers a patient without optional identifiers', async () => {
      const res = await http()
        .post('/api/v1/patients')
        .set(as(clinicianA))
        .send(base())
        .expect(201);
      expect(res.body).toMatchObject({
        nationalIdMasked: null,
        phone: null,
        district: null,
      });
    });

    it('searches by MRN and updates names and phone', async () => {
      const mrn = `EDGE-E-${randomUUID().slice(0, 6)}`;
      const created = (
        await http()
          .post('/api/v1/patients')
          .set(as(clinicianA))
          .send({ ...base(), mrn })
          .expect(201)
      ).body as { id: string };
      const found = await http()
        .get('/api/v1/patients')
        .query({ mrn })
        .set(as(clinicianA))
        .expect(200);
      expect(
        (found.body as { items: { id: string }[] }).items.map((p) => p.id),
      ).toEqual([created.id]);

      const updated = await http()
        .patch(`/api/v1/patients/${created.id}`)
        .set(as(clinicianA))
        .send({
          version: 1,
          givenName: 'Renamed',
          familyName: 'Person',
          phone: '+260 97 000 0000',
          regionClass: 'RURAL',
        })
        .expect(200);
      expect(updated.body).toMatchObject({
        givenName: 'Renamed',
        familyName: 'Person',
        phone: '+260 97 000 0000',
        regionClass: 'RURAL',
        version: 2,
      });
    });

    it('rejects a duplicate MRN within a facility', async () => {
      const mrn = `EDGE-D-${randomUUID().slice(0, 6)}`;
      await http()
        .post('/api/v1/patients')
        .set(as(clinicianA))
        .send({ ...base(), mrn })
        .expect(201);
      await http()
        .post('/api/v1/patients')
        .set(as(clinicianA))
        .send({ ...base(), mrn })
        .expect(409);
    });

    it('refuses clinical staff who are not assigned to a facility', async () => {
      const token = await loginAs(
        app,
        (await createUser(prisma, 'CLINICIAN', null)).email,
      );
      const res = await http()
        .post('/api/v1/patients')
        .set(as(token))
        .send(base())
        .expect(403);
      expect((res.body as ErrorBody).error.code).toBe('FORBIDDEN');
    });

    it('does not reveal an offline patient id created in another facility', async () => {
      const clientUuid = randomUUID();
      await http()
        .post('/api/v1/patients')
        .set(as(clinicianA))
        .send({ ...base(), clientUuid })
        .expect(201);
      const otherFacility = await createFacility(prisma, 'EDGE2');
      const other = await loginAs(
        app,
        (await createUser(prisma, 'CLINICIAN', otherFacility)).email,
      );
      await http()
        .post('/api/v1/patients')
        .set(as(other))
        .send({ ...base(), clientUuid })
        .expect(404);
    });

    it('refuses to link an account already linked to another patient', async () => {
      const account = await createUser(prisma, 'PATIENT', null);
      const p1 = (
        await http()
          .post('/api/v1/patients')
          .set(as(clinicianA))
          .send(base())
          .expect(201)
      ).body as {
        id: string;
      };
      const p2 = (
        await http()
          .post('/api/v1/patients')
          .set(as(clinicianA))
          .send(base())
          .expect(201)
      ).body as {
        id: string;
      };
      await http()
        .patch(`/api/v1/patients/${p1.id}`)
        .set(as(clinicianA))
        .send({ version: 1, accountUserId: account.id })
        .expect(200);
      await http()
        .patch(`/api/v1/patients/${p2.id}`)
        .set(as(clinicianA))
        .send({ version: 1, accountUserId: account.id })
        .expect(409);
    });

    it('tells an unlinked patient account that no record exists yet', async () => {
      const account = await createUser(prisma, 'PATIENT', null);
      const token = await loginAs(app, account.email);
      await http().get('/api/v1/patients/me').set(as(token)).expect(404);
      await http()
        .get('/api/v1/patients/me/consents')
        .set(as(token))
        .expect(404);
    });
  });

  describe('clinical edge cases', () => {
    async function patient(): Promise<string> {
      const res = await http()
        .post('/api/v1/patients')
        .set(as(clinicianA))
        .send({
          givenName: 'SYNTHETIC',
          familyName: 'Clin',
          dateOfBirth: '1955-01-01',
          regionClass: 'URBAN',
        })
        .expect(201);
      return (res.body as { id: string }).id;
    }

    it('accepts a minimal record and reports derived values as null', async () => {
      const id = await patient();
      const res = await http()
        .post(`/api/v1/patients/${id}/clinical-records`)
        .set(as(clinicianA))
        .send({ encounterDate: '2026-09-01', dreFinding: 'NOT_PERFORMED' })
        .expect(201);
      expect(res.body).toMatchObject({
        psaNgMl: null,
        freeToTotalPsaRatio: null,
        psaDensity: null,
        prostateVolumeMl: null,
        symptoms: null,
        notes: null,
        biopsyHistory: 'UNKNOWN',
      });
    });

    it('rejects reusing a client id for a different patient', async () => {
      const clientUuid = randomUUID();
      const first = await patient();
      const second = await patient();
      const body = {
        encounterDate: '2026-09-01',
        dreFinding: 'NORMAL',
        clientUuid,
      };
      await http()
        .post(`/api/v1/patients/${first}/clinical-records`)
        .set(as(clinicianA))
        .send(body)
        .expect(201);
      await http()
        .post(`/api/v1/patients/${second}/clinical-records`)
        .set(as(clinicianA))
        .send(body)
        .expect(409);
    });

    it('returns 404 for unknown clinical records and consents', async () => {
      await http()
        .get(`/api/v1/clinical-records/${randomUUID()}`)
        .set(as(clinicianA))
        .expect(404);
      const id = await patient();
      await http()
        .post(`/api/v1/patients/${id}/consents/${randomUUID()}/withdraw`)
        .set(as(clinicianA))
        .expect(404);
    });
  });
});
