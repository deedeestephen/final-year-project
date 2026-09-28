import { randomBytes, randomUUID } from 'node:crypto';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { PrismaClient } from '@prisma/client';
import request from 'supertest';
import { seed } from '../../src/persistence/seed';
import { FieldCrypto } from '../../src/persistence/crypto/field-crypto';
import {
  createDbTestApp,
  createFacility,
  createUser,
  ensureSeeded,
  loginAs,
} from './helpers';

interface RoleBody {
  name: string;
  permissions: string[];
  customised: boolean;
  required: string[];
  notAllowed: string[];
}
interface AccountBody {
  userId: string;
  email: string;
  idDocumentType: string | null;
  idNumberMasked: string | null;
  phoneMasked: string | null;
  linked: { patientId: string; mrn: string; facilityName: string } | null;
}
interface ErrorBody {
  error: { code: string; details?: unknown };
}

const prisma = new PrismaClient();
const STRONG = 'correct-horse-battery-staple-9';
const nrc = () =>
  `${String(Math.floor(Math.random() * 900000) + 100000)}/${String(Math.floor(Math.random() * 90) + 10)}/1`;
const passport = () =>
  `ZP${String(Math.floor(Math.random() * 1e9)).padStart(9, '0')}`;

describe('registration identity and administration (real database)', () => {
  let app: NestExpressApplication;
  let admin: string;
  let adminId: string;
  let clinician: string;
  let pathologist: string;
  let facilityId: string;

  const http = () => request(app.getHttpServer());
  const as = (token: string) => ({ Authorization: `Bearer ${token}` });

  const register = (fields: Record<string, unknown>) =>
    http()
      .post('/api/v1/auth/register')
      .send({
        email: `pt-${randomUUID().slice(0, 8)}@example.test`,
        password: STRONG,
        displayName: 'SYNTHETIC Registrant',
        phone: '+260 97 1234567',
        idDocumentType: 'NRC',
        idNumber: nrc(),
        ...fields,
      });

  const loginToken = async (email: string) =>
    (
      (
        await http()
          .post('/api/v1/auth/login')
          .send({ email, password: STRONG })
          .expect(200)
      ).body as { accessToken: string }
    ).accessToken;

  beforeAll(async () => {
    await ensureSeeded(prisma);
    app = await createDbTestApp();
    facilityId = await createFacility(prisma, 'AD');
    const adminUser = await createUser(prisma, 'ADMIN', null);
    adminId = adminUser.id;
    admin = await loginAs(app, adminUser.email);
    clinician = await loginAs(
      app,
      (await createUser(prisma, 'CLINICIAN', facilityId)).email,
    );
    pathologist = await loginAs(
      app,
      (await createUser(prisma, 'PATHOLOGIST', facilityId)).email,
    );
  });

  afterAll(async () => {
    // Leave shared roles exactly as the catalogue defines them.
    for (const role of ['PATHOLOGIST', 'PATIENT', 'CLINICIAN', 'ADMIN']) {
      await http().post(`/api/v1/admin/roles/${role}/reset`).set(as(admin));
    }
    await app.close();
    await prisma.$disconnect();
  });

  describe('self-registration identity', () => {
    it('requires a phone and an identity document', async () => {
      const res = await http()
        .post('/api/v1/auth/register')
        .send({
          email: `pt-${randomUUID().slice(0, 8)}@example.test`,
          password: STRONG,
          displayName: 'SYNTHETIC',
        })
        .expect(400);
      const fields = (
        (res.body as ErrorBody).error.details as { field: string }[]
      ).map((d) => d.field);
      expect(fields).toEqual(
        expect.arrayContaining(['phone', 'idDocumentType', 'idNumber']),
      );
    });

    it('checks the number against the document type', async () => {
      const bad = await register({ idNumber: '12345/7/1' }).expect(400);
      expect(JSON.stringify(bad.body)).toContain('123456/78/1');
      await register({ idDocumentType: 'PASSPORT', idNumber: 'ab' }).expect(
        400,
      );
      await register({ idDocumentType: 'DRIVING' }).expect(400);
      await register({ phone: 'call me' }).expect(400);
    });

    it('stores phone and number encrypted, and refuses a second account with the same number', async () => {
      const id = nrc();
      const res = await register({ idNumber: ` ${id} ` }).expect(201);
      const user = await prisma.user.findUniqueOrThrow({
        where: { id: (res.body as { id: string }).id },
      });
      expect(user.idDocumentType).toBe('NRC');
      expect(user.idNumberHmac).toMatch(/^[0-9a-f]{64}$/);
      expect(Buffer.from(user.idNumberEnc!).toString('utf8')).not.toContain(id);
      expect(Buffer.from(user.phoneEnc!).toString('utf8')).not.toContain(
        '1234567',
      );

      const again = await register({ idNumber: id }).expect(409);
      expect((again.body as ErrorBody).error.code).toBe('CONFLICT');
      await register({
        idDocumentType: 'PASSPORT',
        idNumber: passport(),
      }).expect(201);
    });
  });

  describe('roles and permissions', () => {
    const rolePerms = async (name: string) =>
      (
        (await http().get('/api/v1/admin/roles').set(as(admin)).expect(200))
          .body as RoleBody[]
      ).find((r) => r.name === name)!;

    it('lists the catalogue and every role with its safety rules', async () => {
      const catalogue = (
        await http().get('/api/v1/admin/permissions').set(as(admin)).expect(200)
      ).body as { code: string }[];
      expect(catalogue.map((p) => p.code)).toContain('patient_account:link');

      const adminRole = await rolePerms('ADMIN');
      expect(adminRole.required).toEqual(['user:manage', 'role:manage']);
      const patientRole = await rolePerms('PATIENT');
      expect(patientRole.notAllowed).toContain('patient:read');
      expect(patientRole.permissions).toContain('clinical:read_self');
    });

    it('a change applies to everyone with the role at once, is audited, and can be reset', async () => {
      const patient = await http()
        .post('/api/v1/patients')
        .set(as(clinician))
        .send({
          givenName: 'SYNTHETIC',
          familyName: 'Perm',
          dateOfBirth: '1955-05-05',
          regionClass: 'URBAN',
        })
        .expect(201);
      const records = `/api/v1/patients/${(patient.body as { id: string }).id}/clinical-records`;
      await http().get(records).set(as(pathologist)).expect(200);

      const current = await rolePerms('PATHOLOGIST');
      const updated = (
        await http()
          .put('/api/v1/admin/roles/pathologist/permissions')
          .set(as(admin))
          .send({
            permissions: current.permissions.filter(
              (p) => p !== 'clinical:read',
            ),
          })
          .expect(200)
      ).body as RoleBody;
      expect(updated.customised).toBe(true);
      await http().get(records).set(as(pathologist)).expect(403);

      const audit = await prisma.auditLog.findFirst({
        where: { action: 'role.permissions_changed', actorUserId: adminId },
        orderBy: { seq: 'desc' },
      });
      expect(audit?.details).toMatchObject({
        role: 'PATHOLOGIST',
        removed: ['clinical:read'],
      });

      // The demo seed keeps an administrator's changes.
      await seed(
        prisma,
        new FieldCrypto(randomBytes(32), randomBytes(32)),
        'Synthetic-Demo-Pass-1',
      );
      expect((await rolePerms('PATHOLOGIST')).permissions).not.toContain(
        'clinical:read',
      );

      const reset = (
        await http()
          .post('/api/v1/admin/roles/PATHOLOGIST/reset')
          .set(as(admin))
          .expect(200)
      ).body as RoleBody;
      expect(reset.customised).toBe(false);
      expect(reset.permissions).toContain('clinical:read');
      await http().get(records).set(as(pathologist)).expect(200);
    });

    it('safety locks: no lock-out, no staff data for patients, only known permissions', async () => {
      const adminRole = await rolePerms('ADMIN');
      const lockout = await http()
        .put('/api/v1/admin/roles/ADMIN/permissions')
        .set(as(admin))
        .send({
          permissions: adminRole.permissions.filter((p) => p !== 'role:manage'),
        })
        .expect(400);
      expect((lockout.body as ErrorBody).error.code).toBe('LOCKOUT_PROTECTION');

      const leak = await http()
        .put('/api/v1/admin/roles/PATIENT/permissions')
        .set(as(admin))
        .send({ permissions: ['patient:read_self', 'patient:read'] })
        .expect(400);
      expect((leak.body as ErrorBody).error.code).toBe('NOT_ALLOWED_FOR_ROLE');

      await http()
        .put('/api/v1/admin/roles/CLINICIAN/permissions')
        .set(as(admin))
        .send({ permissions: ['patient:read', 'make:coffee'] })
        .expect(400);
      await http()
        .put('/api/v1/admin/roles/ROOT/permissions')
        .set(as(admin))
        .send({ permissions: [] })
        .expect(404);
      await http()
        .put('/api/v1/admin/roles/CLINICIAN/permissions')
        .set(as(clinician))
        .send({ permissions: [] })
        .expect(403);
    });

    it('separation of duties: no admin powers for clinical roles, no clinical data for administrators', async () => {
      const clinicianRole = await rolePerms('CLINICIAN');
      const escalate = await http()
        .put('/api/v1/admin/roles/CLINICIAN/permissions')
        .set(as(admin))
        .send({ permissions: [...clinicianRole.permissions, 'audit:read'] })
        .expect(400);
      expect((escalate.body as ErrorBody).error.code).toBe(
        'NOT_ALLOWED_FOR_ROLE',
      );

      const adminRole = await rolePerms('ADMIN');
      const peek = await http()
        .put('/api/v1/admin/roles/ADMIN/permissions')
        .set(as(admin))
        .send({ permissions: [...adminRole.permissions, 'patient:read'] })
        .expect(400);
      expect((peek.body as ErrorBody).error.code).toBe('NOT_ALLOWED_FOR_ROLE');

      // The role list tells the admin website which boxes are locked.
      const roles = (
        await http().get('/api/v1/admin/roles').set(as(admin)).expect(200)
      ).body as { name: string; notAllowed: string[] }[];
      expect(roles.find((r) => r.name === 'ADMIN')?.notAllowed).toContain(
        'patient:read',
      );
      expect(roles.find((r) => r.name === 'PATHOLOGIST')?.notAllowed).toContain(
        'fhir:export',
      );

      // Nor can an administrator give their own account a clinical role.
      const self = await http()
        .patch(`/api/v1/users/${adminId}`)
        .set(as(admin))
        .send({ roles: ['ADMIN', 'CLINICIAN'] })
        .expect(400);
      expect((self.body as ErrorBody).error.code).toBe('SELF_ROLE_CHANGE');
    });
  });

  describe('users and facilities', () => {
    it('searches users by name/email and role', async () => {
      const page = (
        await http()
          .get('/api/v1/users')
          .query({ q: 'synthetic', role: 'PATHOLOGIST' })
          .set(as(admin))
          .expect(200)
      ).body as { items: { roles: string[] }[] };
      expect(page.items.length).toBeGreaterThan(0);
      expect(page.items.every((u) => u.roles.includes('PATHOLOGIST'))).toBe(
        true,
      );
    });

    it('lists facilities for assigning staff', async () => {
      const list = (
        await http().get('/api/v1/admin/facilities').set(as(admin)).expect(200)
      ).body as { id: string }[];
      expect(list.map((f) => f.id)).toContain(facilityId);
      await http()
        .get('/api/v1/admin/facilities')
        .set(as(clinician))
        .expect(403);
    });

    it('resets a password: temporary password, forced change, sessions ended', async () => {
      const user = await createUser(prisma, 'CLINICIAN', facilityId);
      await loginAs(app, user.email);
      const res = await http()
        .post(`/api/v1/users/${user.id}/reset-password`)
        .set(as(admin))
        .expect(200);
      const temporary = (res.body as { temporaryPassword: string })
        .temporaryPassword;
      expect(
        await prisma.refreshToken.count({
          where: { userId: user.id, revokedAt: null },
        }),
      ).toBe(0);
      const login = await http()
        .post('/api/v1/auth/login')
        .send({ email: user.email, password: temporary })
        .expect(200);
      expect(
        (login.body as { user: { mustChangePassword: boolean } }).user
          .mustChangePassword,
      ).toBe(true);
      await http()
        .post(`/api/v1/users/${adminId}/reset-password`)
        .set(as(admin))
        .expect(400);
      await http()
        .post(`/api/v1/users/${randomUUID()}/reset-password`)
        .set(as(admin))
        .expect(404);
    });
  });

  describe('linking patient accounts to clinic records', () => {
    it('matches by NRC, links, notifies, gives access, and can unlink', async () => {
      const id = nrc();
      const email = `link-${randomUUID().slice(0, 8)}@example.test`;
      const reg = await register({ email, idNumber: id }).expect(201);
      const userId = (reg.body as { id: string }).id;
      const patientToken = await loginToken(email);

      // Before a clinic record exists.
      const none = await http()
        .post(`/api/v1/admin/patient-accounts/${userId}/match`)
        .set(as(admin))
        .expect(404);
      expect((none.body as ErrorBody).error.code).toBe('NO_MATCH');

      const record = await http()
        .post('/api/v1/patients')
        .set(as(clinician))
        .send({
          givenName: 'SYNTHETIC',
          familyName: 'Linkable',
          nationalId: id,
          dateOfBirth: '1960-01-01',
          regionClass: 'RURAL',
        })
        .expect(201);
      const patientId = (record.body as { id: string }).id;

      const unlinked = (
        await http()
          .get('/api/v1/admin/patient-accounts')
          .query({ status: 'unlinked', pageSize: 100 })
          .set(as(admin))
          .expect(200)
      ).body as { items: AccountBody[] };
      const listed = unlinked.items.find((a) => a.userId === userId)!;
      expect(listed.idNumberMasked).toBe(`*******${id.slice(-4)}`);
      expect(listed.phoneMasked?.endsWith('4567')).toBe(true);
      expect(JSON.stringify(unlinked)).not.toContain(id);

      const match = (
        await http()
          .post(`/api/v1/admin/patient-accounts/${userId}/match`)
          .set(as(admin))
          .expect(200)
      ).body as {
        patientId: string;
        mrn: string;
        linkedToAnotherAccount: boolean;
      };
      expect(match.patientId).toBe(patientId);
      expect(match.linkedToAnotherAccount).toBe(false);
      expect(Object.keys(match).sort()).toEqual(
        ['facilityName', 'linkedToAnotherAccount', 'mrn', 'patientId'].sort(),
      );

      await http().get('/api/v1/patients/me').set(as(patientToken)).expect(404);
      const linked = (
        await http()
          .post(`/api/v1/admin/patient-accounts/${userId}/link`)
          .set(as(admin))
          .expect(200)
      ).body as AccountBody;
      expect(linked.linked?.patientId).toBe(patientId);
      await http().get('/api/v1/patients/me').set(as(patientToken)).expect(200);
      const inbox = (
        await http()
          .get('/api/v1/notifications')
          .set(as(patientToken))
          .expect(200)
      ).body as { items: { type: string }[] };
      expect(inbox.items[0].type).toBe('account.linked');
      expect(
        await prisma.auditLog.count({
          where: { action: 'patient_account.linked', entityId: patientId },
        }),
      ).toBe(1);

      await http()
        .post(`/api/v1/admin/patient-accounts/${userId}/link`)
        .set(as(admin))
        .expect(409);

      await http()
        .post(`/api/v1/admin/patient-accounts/${userId}/unlink`)
        .set(as(admin))
        .expect(200);
      expect(
        await prisma.refreshToken.count({ where: { userId, revokedAt: null } }),
      ).toBe(0);
      const after = await prisma.patient.findUniqueOrThrow({
        where: { id: patientId },
      });
      expect(after.userId).toBeNull();
      await http()
        .post(`/api/v1/admin/patient-accounts/${userId}/unlink`)
        .set(as(admin))
        .expect(409);
    });

    it('passport holders and non-patients are handled safely', async () => {
      const email = `pp-${randomUUID().slice(0, 8)}@example.test`;
      const reg = await register({
        email,
        idDocumentType: 'PASSPORT',
        idNumber: passport(),
      }).expect(201);
      const res = await http()
        .post(
          `/api/v1/admin/patient-accounts/${(reg.body as { id: string }).id}/match`,
        )
        .set(as(admin))
        .expect(400);
      expect((res.body as ErrorBody).error.code).toBe('NO_NRC');

      const staff = await createUser(prisma, 'CLINICIAN', facilityId);
      await http()
        .post(`/api/v1/admin/patient-accounts/${staff.id}/link`)
        .set(as(admin))
        .expect(404);
      await http()
        .get('/api/v1/admin/patient-accounts')
        .set(as(clinician))
        .expect(403);
    });

    it('will not link a record that already belongs to another account', async () => {
      const id = nrc();
      await http()
        .post('/api/v1/patients')
        .set(as(clinician))
        .send({
          givenName: 'SYNTHETIC',
          familyName: 'Taken',
          nationalId: id,
          dateOfBirth: '1950-01-01',
          regionClass: 'URBAN',
        })
        .expect(201);
      const first = (await register({ idNumber: id }).expect(201)).body as {
        id: string;
      };
      await http()
        .post(`/api/v1/admin/patient-accounts/${first.id}/link`)
        .set(as(admin))
        .expect(200);
      // Simulate a second account that holds the same NRC hash (e.g. re-issued card).
      const second = await createUser(prisma, 'PATIENT', null);
      const hmac = (
        await prisma.user.findUniqueOrThrow({ where: { id: first.id } })
      ).idNumberHmac;
      await prisma.user.update({
        where: { id: first.id },
        data: { idDocumentType: null, idNumberEnc: null, idNumberHmac: null },
      });
      await prisma.user.update({
        where: { id: second.id },
        data: {
          idDocumentType: 'NRC',
          idNumberEnc: Buffer.from('x'),
          idNumberHmac: hmac,
        },
      });
      // Its ID bytes cannot be decrypted: the list still works for everyone.
      const all = (
        await http()
          .get('/api/v1/admin/patient-accounts')
          .query({ pageSize: 100 })
          .set(as(admin))
          .expect(200)
      ).body as { items: AccountBody[] };
      expect(
        all.items.find((a) => a.userId === second.id)?.idNumberMasked,
      ).toBe('(cannot be read)');

      const match = (
        await http()
          .post(`/api/v1/admin/patient-accounts/${second.id}/match`)
          .set(as(admin))
          .expect(200)
      ).body as { linkedToAnotherAccount: boolean };
      expect(match.linkedToAnotherAccount).toBe(true);
      await http()
        .post(`/api/v1/admin/patient-accounts/${second.id}/link`)
        .set(as(admin))
        .expect(409);
    });
  });
});
