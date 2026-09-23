/**
 * Development seed. ALL DATA IS SYNTHETIC: no real patient or staff information.
 * Idempotent: safe to run repeatedly; existing users keep their passwords.
 * Demo password: SEED_DEMO_PASSWORD, or randomly generated and printed once.
 */
import path from 'node:path';
import { randomBytes } from 'node:crypto';
import { PrismaClient, Prisma } from '@prisma/client';
import * as argon2 from 'argon2';
import { FieldCrypto } from '../src/common/crypto/field-crypto';
import { ARGON2_OPTIONS } from '../src/modules/auth/password';
import {
  PERMISSIONS,
  ROLES,
  ROLE_DESCRIPTIONS,
  ROLE_PERMISSIONS,
  type RoleName,
} from '../src/modules/access/permissions';

export const SYNTHETIC_FACILITY_CODE = 'SYN-LSK-001';
export const DEMO_EMAIL_DOMAIN = 'demo.pca-mhealth.test';

const DEMO_USERS: { role: RoleName; email: string; displayName: string }[] = [
  {
    role: 'ADMIN',
    email: `admin@${DEMO_EMAIL_DOMAIN}`,
    displayName: 'SYNTHETIC Admin',
  },
  {
    role: 'CLINICIAN',
    email: `clinician@${DEMO_EMAIL_DOMAIN}`,
    displayName: 'SYNTHETIC Clinician',
  },
  {
    role: 'PATHOLOGIST',
    email: `pathologist@${DEMO_EMAIL_DOMAIN}`,
    displayName: 'SYNTHETIC Pathologist',
  },
  {
    role: 'PATIENT',
    email: `patient@${DEMO_EMAIL_DOMAIN}`,
    displayName: 'SYNTHETIC Patient 001',
  },
];

const DEMO_PATIENTS = [
  {
    mrn: 'SYN-0001',
    dob: '1958-03-14',
    region: 'URBAN',
    psa: '2.100',
    dre: 'NORMAL',
    pirads: null,
  },
  {
    mrn: 'SYN-0002',
    dob: '1951-11-02',
    region: 'PERI_URBAN',
    psa: '6.800',
    dre: 'ENLARGED_SMOOTH',
    pirads: 3,
  },
  {
    mrn: 'SYN-0003',
    dob: '1947-07-21',
    region: 'RURAL',
    psa: '14.200',
    dre: 'NODULAR',
    pirads: null,
  },
] as const;

export interface SeedResult {
  createdUsers: string[];
  demoPassword?: string;
}

export async function seed(
  prisma: PrismaClient,
  crypto: FieldCrypto,
  demoPassword: string | undefined = process.env.SEED_DEMO_PASSWORD,
): Promise<SeedResult> {
  // Roles and permissions
  for (const [code, description] of Object.entries(PERMISSIONS)) {
    await prisma.permission.upsert({
      where: { code },
      update: { description },
      create: { code, description },
    });
  }
  for (const name of ROLES) {
    const role = await prisma.role.upsert({
      where: { name },
      update: { description: ROLE_DESCRIPTIONS[name] },
      create: { name, description: ROLE_DESCRIPTIONS[name] },
    });
    const permissions = await prisma.permission.findMany({
      where: { code: { in: [...ROLE_PERMISSIONS[name]] } },
    });
    // Replace the role's permissions so removals in the catalogue take effect.
    await prisma.$transaction([
      prisma.rolePermission.deleteMany({ where: { roleId: role.id } }),
      prisma.rolePermission.createMany({
        data: permissions.map((p) => ({ roleId: role.id, permissionId: p.id })),
      }),
    ]);
  }

  const facility = await prisma.facility.upsert({
    where: { code: SYNTHETIC_FACILITY_CODE },
    update: {},
    create: {
      code: SYNTHETIC_FACILITY_CODE,
      name: 'SYNTHETIC Demo Referral Hospital',
      type: 'REFERRAL_HOSPITAL',
      province: 'Lusaka',
      district: 'Lusaka',
      regionClass: 'URBAN',
      isSynthetic: true,
    },
  });

  // Demo users (password only set on creation)
  const result: SeedResult = { createdUsers: [] };
  const password = demoPassword ?? randomBytes(12).toString('base64url');
  let passwordHash: string | undefined;
  const userIds: Partial<Record<RoleName, string>> = {};
  for (const u of DEMO_USERS) {
    let user = await prisma.user.findUnique({ where: { email: u.email } });
    if (!user) {
      passwordHash ??= await argon2.hash(password, ARGON2_OPTIONS);
      const hash: string = passwordHash;
      user = await prisma.user.create({
        data: {
          email: u.email,
          displayName: u.displayName,
          passwordHash: hash,
          facilityId: u.role === 'PATIENT' ? null : facility.id,
          isSynthetic: true,
          mustChangePassword: true,
        },
      });
      result.createdUsers.push(u.email);
    }
    const role = await prisma.role.findUniqueOrThrow({
      where: { name: u.role },
    });
    await prisma.userRole.upsert({
      where: { userId_roleId: { userId: user.id, roleId: role.id } },
      update: {},
      create: { userId: user.id, roleId: role.id },
    });
    userIds[u.role] = user.id;
  }
  if (result.createdUsers.length > 0 && !demoPassword)
    result.demoPassword = password;

  // Demo patients with one clinical record each
  const clinicianId = userIds.CLINICIAN!;
  for (const [i, p] of DEMO_PATIENTS.entries()) {
    const number = String(i + 1).padStart(3, '0');
    const patient = await prisma.patient.upsert({
      where: { facilityId_mrn: { facilityId: facility.id, mrn: p.mrn } },
      update: {},
      create: {
        facilityId: facility.id,
        mrn: p.mrn,
        userId: i === 0 ? userIds.PATIENT : null,
        givenNameEnc: crypto.encrypt('SYNTHETIC'),
        familyNameEnc: crypto.encrypt(`Patient ${number}`),
        dateOfBirth: new Date(p.dob),
        regionClass: p.region,
        district: 'Lusaka',
        isSynthetic: true,
        createdById: clinicianId,
      },
    });
    const clientUuid = `00000000-0000-4000-8000-00000000${number.padStart(4, '0')}`;
    await prisma.clinicalRecord.upsert({
      where: { clientUuid },
      update: {},
      create: {
        clientUuid,
        patientId: patient.id,
        facilityId: facility.id,
        recordedById: clinicianId,
        encounterDate: new Date('2026-09-01'),
        psaNgMl: new Prisma.Decimal(p.psa),
        dreFinding: p.dre,
        piradsScore: p.pirads,
        biopsyHistory: 'NONE',
        notes: 'SYNTHETIC DEMO DATA: not a real patient.',
      },
    });
  }

  return result;
}

async function main(): Promise<void> {
  try {
    process.loadEnvFile(path.resolve(__dirname, '..', '..', '.env'));
  } catch {
    // variables supplied by the environment
  }
  const prisma = new PrismaClient();
  try {
    const result = await seed(prisma, FieldCrypto.fromEnv(process.env));
    console.log(
      `Seed complete (SYNTHETIC data). Users created: ${result.createdUsers.length}`,
    );
    if (result.demoPassword) {
      console.log(
        `Demo password for new users (shown once): ${result.demoPassword}`,
      );
    }
  } finally {
    await prisma.$disconnect();
  }
}

if (require.main === module) {
  void main().catch((err: unknown) => {
    console.error(err);
    process.exitCode = 1;
  });
}
