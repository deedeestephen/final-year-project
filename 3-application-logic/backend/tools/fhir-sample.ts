/**
 * Writes a sample export built from made-up values (no database), so the
 * official HL7 FHIR validator can check the format:
 *
 *   npm run fhir:sample [-- out.json]
 *   (default: var/fhir-sample/sample-bundle.json, git-ignored)
 *
 * It exercises every kind of resource the export can contain, including an
 * AI report from a research model. That AI report is a format-check sample
 * only: no model produced it, and it is never shown to anyone.
 */
import { randomBytes, randomUUID } from 'node:crypto';
import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { repoRoot } from '../src/config/repo-root';
import { FieldCrypto } from '../src/persistence/crypto/field-crypto';
import { exportId } from '../src/services/fhir/deidentify';
import { FhirBundleBuilder } from '../src/services/fhir/fhir-mappers';

const out =
  process.argv[2] ??
  path.join(repoRoot(), 'var', 'fhir-sample', 'sample-bundle.json');
const crypto = new FieldCrypto(randomBytes(32), randomBytes(32));
const now = new Date();
const builder = new FhirBundleBuilder(
  (kind, id) => exportId(crypto, kind, id),
  'NATIONAL_EHR',
  now,
);

builder.addPatient(
  {
    id: 'sample-patient-1',
    dateOfBirth: new Date('1958-03-02T00:00:00Z'),
    regionClass: 'RURAL',
    isSynthetic: true,
  },
  [
    {
      id: 'sample-visit-1',
      encounterDate: new Date('2025-05-01T00:00:00Z'),
      psaNgMl: 4.2,
      freePsaNgMl: 0.9,
      dreFinding: 'NOT_PERFORMED',
      piradsScore: null,
      prostateVolumeMl: null,
      biopsyHistory: 'NONE',
      familyHistory: null,
      symptoms: null,
    },
    {
      id: 'sample-visit-2',
      encounterDate: new Date('2026-09-20T00:00:00Z'),
      psaNgMl: 6.4,
      freePsaNgMl: 1.1,
      dreFinding: 'NODULAR',
      piradsScore: 4,
      prostateVolumeMl: 42.5,
      biopsyHistory: 'PRIOR_NEGATIVE',
      familyHistory: true,
      symptoms: { nocturia: true, weakStream: false },
    },
  ],
  [
    {
      id: 'sample-slide-1',
      biopsyDate: new Date('2026-08-11T00:00:00Z'),
      reviewedAt: new Date('2026-09-24T10:00:00Z'),
      gleasonPrimary: 4,
      gleasonSecondary: 3,
      isupGradeGroup: 3,
    },
  ],
  [
    {
      jobId: 'sample-ai-1',
      provenance: 'RESEARCH_MODEL',
      disclaimer:
        'FORMAT-CHECK SAMPLE: not produced by any model. AI-assisted decision support only; not a diagnosis.',
      modelVersions: {
        ann_clinical: '0.0.0-sample',
        xgboost_fusion: '0.0.0-sample',
      },
      pcaProbability: 0.5,
      probabilityInterval: [0.4, 0.6],
      gleasonGradeGroup: 2,
      createdAt: new Date('2026-09-24T09:00:00Z'),
    },
    {
      jobId: 'sample-ai-mock',
      provenance: 'MOCK',
      disclaimer: 'DEVELOPMENT MOCK DATA — NOT A CLINICAL RESULT.',
      modelVersions: {},
      pcaProbability: 0.5,
      probabilityInterval: null,
      gleasonGradeGroup: null,
      createdAt: new Date('2026-09-24T09:00:00Z'),
    },
  ],
);
// A patient aged 90 or over: birth year removed, age given as ">= 90".
builder.addPatient(
  {
    id: 'sample-patient-2',
    dateOfBirth: new Date('1930-01-01T00:00:00Z'),
    regionClass: 'URBAN',
    isSynthetic: true,
  },
  [],
  [],
  [],
);

mkdirSync(path.dirname(out), { recursive: true });
writeFileSync(out, JSON.stringify(builder.build(randomUUID(), now), null, 2));
console.log(`Wrote ${out}`, builder.counts);
