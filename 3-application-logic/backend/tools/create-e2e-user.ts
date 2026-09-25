/**
 * Creates a throwaway SYNTHETIC account in the demo facility for the
 * on-device end-to-end test (mobile/integration_test). It has no forced
 * password change, so the test never alters the demo accounts.
 *
 *   npm run e2e:user                   -> a clinician
 *   npm run e2e:user -- --role admin   -> an administrator
 *   npm run e2e:user -- --role pathologist -> a pathologist in the demo facility
 *   npm run e2e:user -- --role patient -> a patient app account linked to a
 *                                         synthetic patient with one screening
 *                                         record, one consent and one message
 *
 * Prints {"email": ..., "password": ...}. Everything is marked synthetic.
 */
import { randomBytes, randomUUID } from 'node:crypto';
import { PrismaClient } from '@prisma/client';
import * as argon2 from 'argon2';
import {
  DEMO_EMAIL_DOMAIN,
  SYNTHETIC_FACILITY_CODE,
} from '../src/persistence/seed';
import { FieldCrypto } from '../src/persistence/crypto/field-crypto';
import { ARGON2_OPTIONS } from '../src/services/auth/password';
import { NOTIFICATION_TEXT } from '../src/services/notifications/notifications.service';
import { loadRootEnv } from '../src/config/repo-root';

async function main(): Promise<void> {
  loadRootEnv();
  const roleArg = process.argv.includes('--role')
    ? process.argv[process.argv.indexOf('--role') + 1]
    : 'clinician';
  const asPatient = roleArg === 'patient';
  const asAdmin = roleArg === 'admin';
  const asPathologist = roleArg === 'pathologist';
  const prisma = new PrismaClient();
  try {
    const facility = await prisma.facility.findUnique({
      where: { code: SYNTHETIC_FACILITY_CODE },
    });
    if (!facility) throw new Error('Run "npm run db:seed" first');
    const role = await prisma.role.findUniqueOrThrow({
      where: {
        name: asPatient
          ? 'PATIENT'
          : asAdmin
            ? 'ADMIN'
            : asPathologist
              ? 'PATHOLOGIST'
              : 'CLINICIAN',
      },
    });
    const tag = randomUUID().slice(0, 8);
    const email = `e2e-${roleArg}-${tag}@${DEMO_EMAIL_DOMAIN}`;
    const password = `E2e-${randomBytes(12).toString('base64url')}`;
    const user = await prisma.user.create({
      data: {
        email,
        displayName: asPatient
          ? 'SYNTHETIC E2E Patient'
          : asAdmin
            ? 'SYNTHETIC E2E Admin'
            : asPathologist
              ? 'SYNTHETIC E2E Pathologist'
              : 'SYNTHETIC E2E Clinician',
        passwordHash: await argon2.hash(password, ARGON2_OPTIONS),
        facilityId: asPatient ? null : facility.id,
        isSynthetic: true,
        roles: { create: { roleId: role.id } },
      },
    });

    if (asPatient) {
      const crypto = FieldCrypto.fromEnv(process.env);
      const clinician = await prisma.user.findFirstOrThrow({
        where: { facilityId: facility.id, isSynthetic: true },
      });
      const patient = await prisma.patient.create({
        data: {
          facilityId: facility.id,
          userId: user.id,
          mrn: `E2E-${tag}`,
          givenNameEnc: crypto.encrypt('SYNTHETIC'),
          familyNameEnc: crypto.encrypt(`E2E ${tag}`),
          dateOfBirth: new Date('1957-04-09T00:00:00Z'),
          regionClass: 'RURAL',
          district: 'Mumbwa',
          isSynthetic: true,
          createdById: clinician.id,
        },
      });
      await prisma.clinicalRecord.create({
        data: {
          patientId: patient.id,
          facilityId: facility.id,
          recordedById: clinician.id,
          encounterDate: new Date('2026-08-20T00:00:00Z'),
          psaNgMl: '5.600',
          dreFinding: 'NORMAL',
          notes: 'SYNTHETIC E2E DATA: not a real patient.',
        },
      });
      await prisma.consent.create({
        data: {
          patientId: patient.id,
          type: 'AI_ANALYSIS',
          status: 'GRANTED',
          method: 'DIGITAL',
          consentTextVersion: 'e2e-v1',
          grantedAt: new Date(),
          capturedById: clinician.id,
        },
      });
      const text = NOTIFICATION_TEXT.recordAdded;
      await prisma.notification.create({
        data: {
          userId: user.id,
          type: text.type,
          title: text.title,
          body: text.body,
        },
      });
    }
    console.log(JSON.stringify({ email, password }));
  } finally {
    await prisma.$disconnect();
  }
}

void main().catch((err: unknown) => {
  console.error(err);
  process.exitCode = 1;
});
