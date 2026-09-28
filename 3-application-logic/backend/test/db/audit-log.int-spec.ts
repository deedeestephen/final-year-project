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

/*
 * Audit-log viewer (UC-09, FR-10, Phase 15): administrators read the log and
 * check its hash chain; nobody else can, and reading it is itself audited.
 */

const prisma = new PrismaClient();

interface Entry {
  seq: string;
  action: string;
  outcome: string;
  actorUserId: string | null;
  actorEmail: string | null;
  details: Record<string, unknown> | null;
}
interface Page {
  items: Entry[];
  total: number;
  page: number;
  pageSize: number;
}

describe('audit-log viewer (real database)', () => {
  let app: NestExpressApplication;
  let adminToken: string;
  let clinicianToken: string;
  let admin: { id: string; email: string };
  let clinician: { id: string; email: string };
  const as = (t: string) => ({ Authorization: `Bearer ${t}` });

  beforeAll(async () => {
    await ensureSeeded(prisma);
    app = await createDbTestApp();
    const facility = await createFacility(prisma, 'AUDIT');
    admin = await createUser(prisma, 'ADMIN', null);
    clinician = await createUser(prisma, 'CLINICIAN', facility);
    adminToken = await loginAs(app, admin.email);
    clinicianToken = await loginAs(app, clinician.email);
    // A denied request, so there is a DENIED entry to find.
    await request(app.getHttpServer())
      .get('/api/v1/admin/audit-logs')
      .set(as(clinicianToken))
      .expect(403);
  });

  afterAll(async () => {
    await app?.close();
    await prisma.$disconnect();
  });

  const list = (query: string, token = adminToken) =>
    request(app.getHttpServer())
      .get(`/api/v1/admin/audit-logs${query}`)
      .set(as(token));

  it('is for administrators only', async () => {
    await list('', clinicianToken).expect(403);
    await request(app.getHttpServer())
      .get('/api/v1/admin/audit-logs/verify')
      .set(as(clinicianToken))
      .expect(403);
  });

  it('lists entries newest first, with who did them', async () => {
    const res = await list('?pageSize=20').expect(200);
    const page = res.body as Page;
    expect(page.pageSize).toBe(20);
    expect(page.total).toBeGreaterThan(0);
    const seqs = page.items.map((e) => BigInt(e.seq));
    expect([...seqs].sort((a, b) => (b > a ? 1 : b < a ? -1 : 0))).toEqual(
      seqs,
    );
    const login = page.items.find(
      (e) => e.action === 'auth.login' && e.actorUserId === admin.id,
    );
    expect(login?.actorEmail).toBe(admin.email);
  });

  it('filters by action, outcome and person', async () => {
    const denied = (
      await list(`?outcome=DENIED&actorUserId=${clinician.id}`).expect(200)
    ).body as Page;
    expect(denied.items.length).toBeGreaterThan(0);
    expect(
      denied.items.every(
        (e) => e.outcome === 'DENIED' && e.actorUserId === clinician.id,
      ),
    ).toBe(true);
    expect(denied.items.map((e) => e.action)).toContain('access.denied');

    const logins = (await list('?action=auth.login').expect(200)).body as Page;
    expect(logins.items.every((e) => e.action.startsWith('auth.login'))).toBe(
      true,
    );
  });

  it('rejects filters that are not plain values', async () => {
    await list("?action=x' OR 1=1").expect(400);
    await list('?outcome=MAYBE').expect(400);
    await list('?pageSize=5000').expect(400);
  });

  it('records that the log was read, with the filters used', async () => {
    await list('?action=fhir.').expect(200);
    const entry = await prisma.auditLog.findFirstOrThrow({
      where: { action: 'audit.read', actorUserId: admin.id },
      orderBy: { seq: 'desc' },
    });
    expect(entry.details).toMatchObject({
      filters: { action: 'fhir.' },
    });
  });

  it('confirms the hash chain is intact', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/v1/admin/audit-logs/verify')
      .set(as(adminToken))
      .expect(200);
    expect(res.body).toMatchObject({
      intact: true,
      brokenAt: null,
      reason: null,
    });
    expect((res.body as { entries: number }).entries).toBeGreaterThan(0);
    const entry = await prisma.auditLog.findFirstOrThrow({
      where: { action: 'audit.verified', actorUserId: admin.id },
      orderBy: { seq: 'desc' },
    });
    expect(entry.details).toMatchObject({ intact: true });
  });

  it('would show a changed entry (checked inside a transaction that is rolled back)', async () => {
    const found = await prisma
      .$transaction(async (tx) => {
        const target = await tx.auditLog.findFirstOrThrow({
          orderBy: { seq: 'asc' },
        });
        // Only possible with the protection switched off, as the table owner.
        await tx.$executeRawUnsafe(
          'ALTER TABLE audit_logs DISABLE TRIGGER audit_logs_no_update_delete',
        );
        await tx.$executeRaw`UPDATE audit_logs SET action = 'tampered' WHERE seq = ${target.seq}`;
        const broken = await tx.$queryRaw<
          { broken_seq: bigint; reason: string }[]
        >`SELECT broken_seq, reason FROM audit_logs_verify_chain()`;
        throw Object.assign(new Error('rollback'), {
          result: { target: target.seq, broken },
        });
      })
      .catch(
        (e: {
          result?: {
            target: bigint;
            broken: { broken_seq: bigint; reason: string }[];
          };
        }) => e.result,
      );
    expect(found?.broken[0]?.broken_seq).toBe(found?.target);
    expect(found?.broken[0]?.reason).toBe(
      'row content does not match row_hash',
    );
    // Rolled back: the real log is untouched and still intact.
    const res = await request(app.getHttpServer())
      .get('/api/v1/admin/audit-logs/verify')
      .set(as(adminToken))
      .expect(200);
    expect((res.body as { intact: boolean }).intact).toBe(true);
  });
});
