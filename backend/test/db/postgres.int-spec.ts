import { randomBytes, randomUUID } from 'node:crypto';
import { Prisma, PrismaClient } from '@prisma/client';
import { FieldCrypto } from '../../src/common/crypto/field-crypto';
import { ROLE_PERMISSIONS, ROLES } from '../../src/modules/access/permissions';
import { seed, SYNTHETIC_FACILITY_CODE } from '../../prisma/seed';

const prisma = new PrismaClient();
const crypto = new FieldCrypto(randomBytes(32), randomBytes(32));

afterAll(async () => {
  await prisma.$disconnect();
});

function knownError(err: unknown): Prisma.PrismaClientKnownRequestError {
  expect(err).toBeInstanceOf(Prisma.PrismaClientKnownRequestError);
  return err as Prisma.PrismaClientKnownRequestError;
}

async function expectRejected(
  promise: Promise<unknown>,
  pattern: RegExp,
): Promise<void> {
  await expect(promise).rejects.toThrow(pattern);
}

describe('schema after migrating from a clean database', () => {
  it('has every expected table', async () => {
    const rows = await prisma.$queryRaw<{ table_name: string }[]>`
      SELECT table_name FROM information_schema.tables
      WHERE table_schema = 'public' AND table_type = 'BASE TABLE'`;
    const tables = rows.map((r) => r.table_name);
    for (const t of [
      'users',
      'roles',
      'permissions',
      'user_roles',
      'role_permissions',
      'refresh_tokens',
      'password_reset_tokens',
      'facilities',
      'patients',
      'clinical_records',
      'consents',
      'imaging_studies',
      'histopathology_specimens',
      'ai_models',
      'ai_jobs',
      'explainability_artifacts',
      'notifications',
      'sync_operations',
      'audit_logs',
    ]) {
      expect(tables).toContain(t);
    }
  });

  it('has the audit triggers and pgcrypto installed', async () => {
    const triggers = await prisma.$queryRaw<{ tgname: string }[]>`
      SELECT tgname FROM pg_trigger WHERE tgrelid = 'audit_logs'::regclass AND NOT tgisinternal`;
    expect(triggers.map((t) => t.tgname).sort()).toEqual([
      'audit_logs_chain',
      'audit_logs_no_truncate',
      'audit_logs_no_update_delete',
    ]);
    const ext = await prisma.$queryRaw<
      { extname: string }[]
    >`SELECT extname FROM pg_extension WHERE extname = 'pgcrypto'`;
    expect(ext).toHaveLength(1);
  });
});

describe('seed', () => {
  // Test files share one database per run, so these assertions only look at
  // the rows the seed owns (demo domain, SYN- record numbers), never whole tables.
  it('creates roles, the permission matrix and synthetic demo data, and is idempotent', async () => {
    await seed(prisma, crypto, 'Synthetic-Demo-Pass-1');
    const again = await seed(prisma, crypto, 'Synthetic-Demo-Pass-1');
    expect(again.createdUsers).toHaveLength(0);

    for (const role of ROLES) {
      const perms = await prisma.rolePermission.findMany({
        where: { role: { name: role } },
        include: { permission: true },
      });
      expect(perms.map((p) => p.permission.code).sort()).toEqual(
        [...ROLE_PERMISSIONS[role]].sort(),
      );
    }

    const demoUsers = await prisma.user.findMany({
      where: { email: { endsWith: '@demo.pca-mhealth.test' } },
    });
    expect(demoUsers).toHaveLength(4);
    expect(demoUsers.every((u) => u.isSynthetic)).toBe(true);

    const demoPatients = await prisma.patient.findMany({
      where: {
        mrn: { in: ['SYN-0001', 'SYN-0002', 'SYN-0003'] },
        facility: { code: SYNTHETIC_FACILITY_CODE },
      },
      include: { clinicalRecords: true },
    });
    expect(demoPatients).toHaveLength(3);
    expect(demoPatients.every((p) => p.isSynthetic)).toBe(true);
    expect(demoPatients.every((p) => p.clinicalRecords.length === 1)).toBe(
      true,
    );
  });

  it('stores patient names encrypted, never in clear text', async () => {
    const patient = await prisma.patient.findFirstOrThrow({
      where: { mrn: 'SYN-0001', facility: { code: SYNTHETIC_FACILITY_CODE } },
    });
    const stored = Buffer.from(patient.givenNameEnc);
    expect(stored.toString('utf8')).not.toContain('SYNTHETIC');
    expect(stored[0]).toBe(1); // FieldCrypto format version
    // version + 12-byte IV + 16-byte tag + ciphertext of "SYNTHETIC"
    expect(stored.length).toBe(1 + 12 + 16 + 'SYNTHETIC'.length);
  });

  it('hashes demo passwords with Argon2id', async () => {
    const user = await prisma.user.findUniqueOrThrow({
      where: { email: 'admin@demo.pca-mhealth.test' },
    });
    // PHC string: $argon2id$v=19$<params>$<salt>$<hash>; parameter order varies by library.
    const [, algorithm, version, params] = user.passwordHash.split('$');
    expect(algorithm).toBe('argon2id');
    expect(version).toBe('v=19');
    expect(
      Object.fromEntries(params.split(',').map((kv) => kv.split('='))),
    ).toEqual({
      m: '65536',
      t: '3',
      p: '1',
    });
  });
});

describe('constraints', () => {
  let facilityId: string;
  let clinicianId: string;
  let patientId: string;

  beforeAll(async () => {
    facilityId = (
      await prisma.facility.findUniqueOrThrow({
        where: { code: SYNTHETIC_FACILITY_CODE },
      })
    ).id;
    clinicianId = (
      await prisma.user.findFirstOrThrow({
        where: { roles: { some: { role: { name: 'CLINICIAN' } } } },
      })
    ).id;
    patientId = (await prisma.patient.findFirstOrThrow()).id;
  });

  const record = (
    overrides: Partial<Prisma.ClinicalRecordUncheckedCreateInput>,
  ) =>
    prisma.clinicalRecord.create({
      data: {
        patientId,
        facilityId,
        recordedById: clinicianId,
        encounterDate: new Date('2026-09-10'),
        dreFinding: 'NORMAL',
        ...overrides,
      },
    });

  it('rejects a duplicate email', async () => {
    const email = `dup-${randomUUID()}@demo.pca-mhealth.test`;
    await prisma.user.create({
      data: {
        email,
        passwordHash: 'x',
        displayName: 'SYNTHETIC',
        isSynthetic: true,
      },
    });
    try {
      await prisma.user.create({
        data: {
          email,
          passwordHash: 'x',
          displayName: 'SYNTHETIC',
          isSynthetic: true,
        },
      });
      fail('expected unique violation');
    } catch (err) {
      expect(knownError(err).code).toBe('P2002');
    }
  });

  it('rejects an email that is not lower-case', async () => {
    await expectRejected(
      prisma.user.create({
        data: {
          email: 'Upper@Demo.test',
          passwordHash: 'x',
          displayName: 'SYNTHETIC',
        },
      }),
      /users_email_lowercase/,
    );
  });

  it('rejects a patient for a facility that does not exist', async () => {
    try {
      await prisma.patient.create({
        data: {
          facilityId: randomUUID(),
          mrn: 'SYN-X',
          givenNameEnc: crypto.encrypt('a'),
          familyNameEnc: crypto.encrypt('b'),
          dateOfBirth: new Date('1960-01-01'),
          regionClass: 'URBAN',
          createdById: clinicianId,
          isSynthetic: true,
        },
      });
      fail('expected foreign key violation');
    } catch (err) {
      expect(knownError(err).code).toBe('P2003');
    }
  });

  it('accepts valid clinical values', async () => {
    const r = await record({
      psaNgMl: new Prisma.Decimal('4.5'),
      freePsaNgMl: new Prisma.Decimal('0.9'),
      piradsScore: 4,
    });
    expect(r.version).toBe(1);
  });

  it.each([
    [
      'negative PSA',
      { psaNgMl: new Prisma.Decimal('-1') },
      /clinical_psa_nonneg/,
    ],
    [
      'free PSA above total',
      {
        psaNgMl: new Prisma.Decimal('2'),
        freePsaNgMl: new Prisma.Decimal('3'),
      },
      /clinical_free_psa_le_total/,
    ],
    ['PI-RADS 6', { piradsScore: 6 }, /clinical_pirads_range/],
    ['PI-RADS 0', { piradsScore: 0 }, /clinical_pirads_range/],
    [
      'zero prostate volume',
      { prostateVolumeMl: new Prisma.Decimal('0') },
      /clinical_prostate_volume_positive/,
    ],
  ])('rejects %s', async (_label, overrides, pattern) => {
    await expectRejected(record(overrides), pattern);
  });

  it('rejects a withdrawn consent without a withdrawal date', async () => {
    await expectRejected(
      prisma.consent.create({
        data: {
          patientId,
          type: 'AI_ANALYSIS',
          status: 'WITHDRAWN',
          method: 'DIGITAL',
          consentTextVersion: 'v1',
          grantedAt: new Date(),
          capturedById: clinicianId,
        },
      }),
      /consents_withdrawal_consistent/,
    );
  });

  it('rejects an explanation with neither an artifact nor an unavailable reason', async () => {
    const job = await prisma.aiJob.create({
      data: {
        patientId,
        requestedById: clinicianId,
        inputs: { clinicalRecordIds: [] },
      },
    });
    await expectRejected(
      prisma.explainabilityArtifact.create({
        data: { jobId: job.id, kind: 'SHAP' },
      }),
      /explain_artifact_or_reason/,
    );
    const ok = await prisma.explainabilityArtifact.create({
      data: {
        jobId: job.id,
        kind: 'SHAP',
        unavailableReason: 'No trained model registered (development mock)',
      },
    });
    expect(ok.storageKey).toBeNull();
  });

  it('rejects an imaging row with a malformed checksum', async () => {
    await expectRejected(
      prisma.imagingStudy.create({
        data: {
          patientId,
          modality: 'TRUS',
          storageKey: `imaging/test/${randomUUID()}.dcm`,
          sha256: 'not-a-hash',
          sizeBytes: 10n,
          mimeType: 'application/dicom',
          uploadedById: clinicianId,
        },
      }),
      /imaging_sha256_format/,
    );
  });

  it('enforces idempotency keys on synchronisation operations', async () => {
    const data = {
      idempotencyKey: randomUUID(),
      userId: clinicianId,
      deviceId: 'device-1',
      entityType: 'clinical_record',
      operation: 'CREATE' as const,
      result: 'APPLIED' as const,
      clientTimestamp: new Date(),
    };
    await prisma.syncOperation.create({ data });
    try {
      await prisma.syncOperation.create({ data });
      fail('expected unique violation');
    } catch (err) {
      expect(knownError(err).code).toBe('P2002');
    }
  });
});

describe('audit log (FR-10)', () => {
  const entityId = randomUUID();

  const write = (action: string) =>
    prisma.auditLog.create({
      data: {
        action,
        entityType: 'patient',
        entityId,
        outcome: 'SUCCESS',
        details: { note: 'test' },
      },
    });

  it('links each row to the previous one with a SHA-256 hash', async () => {
    const a = await write('patient.read');
    const b = await write('patient.update');
    expect(a.rowHash).toMatch(/^[0-9a-f]{64}$/);
    expect(b.prevHash).toBe(a.rowHash);
    expect(b.seq).toBeGreaterThan(a.seq);
    const broken = await prisma.$queryRaw<
      unknown[]
    >`SELECT * FROM audit_logs_verify_chain()`;
    expect(broken).toEqual([]);
  });

  it('ignores client-supplied hashes', async () => {
    const row = await prisma.auditLog.create({
      data: {
        action: 'x',
        entityType: 'patient',
        outcome: 'SUCCESS',
        prevHash: 'forged',
        rowHash: 'forged',
      },
    });
    expect(row.prevHash).not.toBe('forged');
    expect(row.rowHash).not.toBe('forged');
  });

  it('blocks UPDATE', async () => {
    await expectRejected(
      prisma.auditLog.updateMany({
        where: { entityId },
        data: { action: 'tampered' },
      }),
      /append-only/,
    );
  });

  it('blocks DELETE', async () => {
    await expectRejected(
      prisma.auditLog.deleteMany({ where: { entityId } }),
      /append-only/,
    );
  });

  it('blocks TRUNCATE', async () => {
    await expectRejected(
      prisma.$executeRawUnsafe('TRUNCATE audit_logs'),
      /append-only/,
    );
  });

  it('detects tampering done by bypassing the triggers', async () => {
    // Simulate an attacker with superuser rights, inside a transaction that is rolled back.
    const result = await prisma
      .$transaction(async (tx) => {
        await tx.$executeRawUnsafe(
          'ALTER TABLE audit_logs DISABLE TRIGGER audit_logs_no_update_delete',
        );
        await tx.$executeRaw`UPDATE audit_logs SET action = 'tampered' WHERE entity_id = ${entityId}`;
        const broken = await tx.$queryRaw<
          { broken_seq: bigint; reason: string }[]
        >`
          SELECT * FROM audit_logs_verify_chain()`;
        throw Object.assign(new Error('rollback'), { broken });
      })
      .catch((err: { broken?: { reason: string }[] }) => err.broken);
    expect(result).toHaveLength(1);
    expect(result?.[0].reason).toMatch(/does not match row_hash/);

    const after = await prisma.$queryRaw<
      unknown[]
    >`SELECT * FROM audit_logs_verify_chain()`;
    expect(after).toEqual([]);
  });
});
