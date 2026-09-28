import type {
  Bundle,
  Device,
  DiagnosticReport,
  Encounter,
  FhirResource,
  Observation,
  Patient,
} from 'fhir/r4';
import { FieldCrypto } from '../../persistence/crypto/field-crypto';
import { exportId } from './deidentify';
import { LOCAL_CODES, LOINC, LOINC_CODES, UCUM } from './fhir-codes';
import {
  FhirBundleBuilder,
  readExport,
  type ExportAiReport,
  type ExportPatient,
  type ExportRecord,
  type ExportSpecimen,
} from './fhir-mappers';

const crypto = new FieldCrypto(Buffer.alloc(32, 7), Buffer.alloc(32, 9));
const ids = (kind: string, id: string) => exportId(crypto, kind, id);
const AS_OF = new Date('2026-09-28T10:00:00Z');
const MOCK_DISCLAIMER = 'DEVELOPMENT MOCK DATA — NOT A CLINICAL RESULT.';

const patient: ExportPatient = {
  id: '11111111-1111-4111-8111-111111111111',
  dateOfBirth: new Date('1958-03-02T00:00:00Z'),
  regionClass: 'RURAL',
  isSynthetic: true,
};

const record = (over: Partial<ExportRecord> = {}): ExportRecord => ({
  id: '22222222-2222-4222-8222-222222222222',
  encounterDate: new Date('2026-09-20T00:00:00Z'),
  psaNgMl: 6.4,
  freePsaNgMl: 1.1,
  dreFinding: 'NODULAR',
  piradsScore: 4,
  prostateVolumeMl: 42.5,
  biopsyHistory: 'PRIOR_NEGATIVE',
  familyHistory: true,
  symptoms: { nocturia: true, weakStream: false },
  ...over,
});

const specimen: ExportSpecimen = {
  id: '33333333-3333-4333-8333-333333333333',
  biopsyDate: new Date('2026-08-11T00:00:00Z'),
  reviewedAt: new Date('2026-09-24T10:00:00Z'),
  gleasonPrimary: 4,
  gleasonSecondary: 3,
  isupGradeGroup: 3,
};

const aiReport = (over: Partial<ExportAiReport> = {}): ExportAiReport => ({
  jobId: '44444444-4444-4444-8444-444444444444',
  provenance: 'RESEARCH_MODEL',
  disclaimer: 'AI-assisted decision support only. Not a diagnosis.',
  modelVersions: { ann_clinical: '1.0.0', xgboost_fusion: '1.2.0' },
  pcaProbability: 0.423,
  probabilityInterval: [0.31, 0.55],
  gleasonGradeGroup: 2,
  createdAt: new Date('2026-09-24T09:00:00Z'),
  ...over,
});

function build(
  build: (b: FhirBundleBuilder) => void,
  purpose: 'RESEARCH' | 'NATIONAL_EHR' = 'RESEARCH',
): { bundle: Bundle; builder: FhirBundleBuilder } {
  const builder = new FhirBundleBuilder(ids, purpose, AS_OF);
  build(builder);
  return {
    bundle: builder.build('55555555-5555-4555-8555-555555555555', AS_OF),
    builder,
  };
}

const resources = (b: Bundle): FhirResource[] =>
  (b.entry ?? []).map((e) => e.resource as FhirResource);
const ofType = <T extends FhirResource>(b: Bundle, type: T['resourceType']) =>
  resources(b).filter((r): r is T => r.resourceType === type);
const DATE_KEYS = new Set([
  'birthDate',
  'effectiveDateTime',
  'issued',
  'start',
  'end',
  'timestamp',
  'lastUpdated',
]);

/** Every [path, value] whose key is a FHIR date or date-time element. */
function dateFields(value: unknown, path = ''): [string, string][] {
  if (Array.isArray(value)) return value.flatMap((v) => dateFields(v, path));
  if (value === null || typeof value !== 'object') return [];
  return Object.entries(value).flatMap(([k, v]) => {
    const here = path ? `${path}.${k}` : k;
    if (typeof v === 'string' && DATE_KEYS.has(k)) return [[here, v]];
    return dateFields(v, here);
  });
}

const byCode = (b: Bundle, code: string) =>
  ofType<Observation>(b, 'Observation').find((o) =>
    o.code.coding?.some((c) => c.code === code),
  );

describe('Patient', () => {
  const { bundle } = build((b) => b.addPatient(patient, [], [], []));
  const p = ofType<Patient>(bundle, 'Patient')[0];

  it('has a pseudonymous id and no direct identifiers', () => {
    expect(p.id).toBe(ids('Patient', patient.id));
    expect(p.name).toBeUndefined();
    expect(p.identifier).toBeUndefined();
    expect(p.telecom).toBeUndefined();
    expect(p.photo).toBeUndefined();
    expect(p.address).toEqual([{ country: 'ZM' }]);
    expect(JSON.stringify(bundle)).not.toContain(patient.id);
  });

  it('keeps the birth year only and the urban/rural class', () => {
    expect(p.birthDate).toBe('1958');
    expect(p.extension?.[0].valueCoding?.code).toBe('RURAL');
  });

  it('labels the data as pseudonymised, redacted and (here) synthetic test data', () => {
    const codes = p.meta?.security?.map((s) => s.code);
    expect(codes).toEqual(['PSEUDED', 'REDACTED', 'HTEST']);
  });

  it('gives no test-data label to a real patient', () => {
    const real = build((b) =>
      b.addPatient({ ...patient, isSynthetic: false }, [], [], []),
    ).bundle;
    const codes = ofType<Patient>(real, 'Patient')[0].meta?.security?.map(
      (s) => s.code,
    );
    expect(codes).toEqual(['PSEUDED', 'REDACTED']);
  });

  it('removes the birth year from age 90 and says "90 or older" instead', () => {
    const old = build((b) =>
      b.addPatient(
        { ...patient, dateOfBirth: new Date('1930-01-01T00:00:00Z') },
        [],
        [],
        [],
      ),
    ).bundle;
    expect(ofType<Patient>(old, 'Patient')[0].birthDate).toBeUndefined();
    const age = byCode(old, LOINC_CODES.age.code!);
    expect(age?.valueQuantity).toEqual({
      value: 90,
      comparator: '>=',
      unit: 'years',
      system: UCUM,
      code: 'a',
    });
    expect(JSON.stringify(old)).not.toContain('1930');
  });
});

describe('screening visit', () => {
  const { bundle, builder } = build((b) =>
    b.addPatient(patient, [record()], [], []),
  );

  it('is an ambulatory encounter dated by year only', () => {
    const [e] = ofType<Encounter>(bundle, 'Encounter');
    expect(e.status).toBe('finished');
    expect(e.class.code).toBe('AMB');
    expect(e.period).toEqual({ start: '2026' });
    // Every date-like field holds a year only. (The bundle's own timestamp is
    // when the file was made, not a patient date.)
    expect(dateFields({ ...bundle, timestamp: undefined })).toEqual(
      expect.arrayContaining([
        ['entry.resource.birthDate', '1958'],
        ['entry.resource.period.start', '2026'],
        ['entry.resource.effectiveDateTime', '2026'],
      ]),
    );
    for (const [, value] of dateFields({ ...bundle, timestamp: undefined })) {
      expect(value).toMatch(/^\d{4}$/);
    }
  });

  it('codes PSA and free PSA with LOINC and UCUM', () => {
    const psa = byCode(bundle, '2857-1')!;
    expect(psa.code.coding?.[0].system).toBe(LOINC);
    expect(psa.valueQuantity).toEqual({
      value: 6.4,
      unit: 'ng/mL',
      system: UCUM,
      code: 'ng/mL',
    });
    expect(psa.effectiveDateTime).toBe('2026');
    expect(psa.category?.[0].coding?.[0].code).toBe('laboratory');
    expect(byCode(bundle, '10886-0')?.valueQuantity?.value).toBe(1.1);
  });

  it('uses local codes where no standard code was verified', () => {
    expect(
      byCode(bundle, LOCAL_CODES.dreFinding.code!)?.valueCodeableConcept
        ?.coding?.[0].code,
    ).toBe('NODULAR');
    expect(byCode(bundle, LOCAL_CODES.pirads.code!)?.valueInteger).toBe(4);
    expect(
      byCode(bundle, LOCAL_CODES.prostateVolume.code!)?.valueQuantity,
    ).toMatchObject({ value: 42.5, code: 'mL' });
    expect(byCode(bundle, LOCAL_CODES.familyHistory.code!)?.valueBoolean).toBe(
      true,
    );
  });

  it('exports only the symptoms that were answered', () => {
    const s = byCode(bundle, LOCAL_CODES.symptoms.code!)!;
    expect(
      s.component?.map((c) => [c.code.coding?.[0].code, c.valueBoolean]),
    ).toEqual([
      ['symptom-nocturia', true],
      ['symptom-weak-stream', false],
    ]);
  });

  it('records "not performed" for a rectal examination that was not done', () => {
    const b = build((x) =>
      x.addPatient(patient, [record({ dreFinding: 'NOT_PERFORMED' })], [], []),
    ).bundle;
    const dre = byCode(b, LOCAL_CODES.dreFinding.code!)!;
    expect(dre.valueCodeableConcept).toBeUndefined();
    expect(dre.dataAbsentReason?.coding?.[0].code).toBe('not-performed');
  });

  it('leaves out values that were not recorded', () => {
    const b = build((x) =>
      x.addPatient(
        patient,
        [
          record({
            psaNgMl: null,
            freePsaNgMl: null,
            piradsScore: null,
            prostateVolumeMl: null,
            familyHistory: null,
            biopsyHistory: 'UNKNOWN',
            symptoms: null,
          }),
        ],
        [],
        [],
      ),
    );
    expect(ofType<Observation>(b.bundle, 'Observation')).toHaveLength(1); // DRE
    expect(b.builder.counts.observations).toBe(1);
  });

  it('counts what it exported', () => {
    // PSA, free PSA, DRE, PI-RADS, volume, family history, biopsy, symptoms.
    expect(builder.counts).toMatchObject({
      patients: 1,
      screeningVisits: 1,
      observations: 8,
    });
  });
});

describe('pathology review', () => {
  const { bundle } = build((b) => b.addPatient(patient, [], [specimen], []));
  const [report] = ofType<DiagnosticReport>(bundle, 'DiagnosticReport');

  it('is a final surgical pathology report coded with LOINC', () => {
    expect(report.status).toBe('final');
    expect(report.code.coding?.[0].code).toBe('66117-3');
    expect(report.category?.[0].coding?.[0].code).toBe('SP');
    expect(report.effectiveDateTime).toBe('2026');
    expect(report.issued).toBeUndefined();
    expect(report.result).toHaveLength(4);
  });

  it('uses the LOINC answer codes for Gleason patterns and grade group', () => {
    expect(
      byCode(bundle, '44641-9')?.valueCodeableConcept?.coding?.[0].code,
    ).toBe('LA11897-8'); // pattern 4
    expect(
      byCode(bundle, '44642-7')?.valueCodeableConcept?.coding?.[0].code,
    ).toBe('LA9631-8'); // pattern 3
    expect(byCode(bundle, '35266-6')?.valueInteger).toBe(7);
    expect(
      byCode(bundle, '94734-1')?.valueCodeableConcept?.coding?.[0].code,
    ).toBe('LA30796-9'); // grade group 3
  });

  it('names no pathologist and exports no stain or file', () => {
    expect(report.performer).toBeUndefined();
    expect(report.presentedForm).toBeUndefined();
  });
});

describe('AI results', () => {
  it('never exports a development mock result, only counts it', () => {
    const { bundle, builder } = build((b) =>
      b.addPatient(
        patient,
        [],
        [],
        [aiReport({ provenance: 'MOCK', disclaimer: MOCK_DISCLAIMER })],
      ),
    );
    expect(ofType<DiagnosticReport>(bundle, 'DiagnosticReport')).toHaveLength(
      0,
    );
    expect(ofType<Device>(bundle, 'Device')).toHaveLength(0);
    expect(JSON.stringify(bundle)).not.toContain('MOCK');
    expect(builder.counts).toMatchObject({
      aiReports: 0,
      aiReportsLeftOutMock: 1,
    });
  });

  it('exports a research-model result as preliminary and asserted by AI', () => {
    const { bundle, builder } = build((b) =>
      b.addPatient(patient, [], [], [aiReport()]),
    );
    const [report] = ofType<DiagnosticReport>(bundle, 'DiagnosticReport');
    expect(report.status).toBe('preliminary');
    expect(report.conclusion).toContain('Not a diagnosis');
    expect(report.meta?.security?.map((s) => s.code)).toContain('AIAST');
    const probability = byCode(bundle, LOCAL_CODES.aiProbability.code!)!;
    expect(probability.valueQuantity).toMatchObject({ value: 42.3, code: '%' });
    expect(probability.component?.map((c) => c.valueQuantity?.value)).toEqual([
      31, 55,
    ]);
    expect(probability.meta?.security?.map((s) => s.code)).toContain('AIAST');
    // An AI-predicted grade group is never coded as a pathology result.
    expect(byCode(bundle, '94734-1')).toBeUndefined();
    expect(byCode(bundle, LOCAL_CODES.aiGradeGroup.code!)?.valueInteger).toBe(
      2,
    );
    expect(builder.counts.aiReports).toBe(1);
  });

  it('names each model version once, fusion model first', () => {
    const { bundle } = build((b) =>
      b.addPatient(
        patient,
        [],
        [],
        [
          aiReport(),
          aiReport({ jobId: '66666666-6666-4666-8666-666666666666' }),
        ],
      ),
    );
    const devices = ofType<Device>(bundle, 'Device');
    expect(devices.map((d) => d.deviceName?.[0].name).sort()).toEqual([
      'ann_clinical',
      'xgboost_fusion',
    ]);
    const probability = byCode(bundle, LOCAL_CODES.aiProbability.code!)!;
    const fusion = devices.find(
      (d) => d.deviceName?.[0].name === 'xgboost_fusion',
    )!;
    expect(probability.device?.reference).toBe(`urn:uuid:${fusion.id}`);
  });
});

describe('bundle', () => {
  const { bundle } = build((b) =>
    b.addPatient(
      patient,
      [
        record(),
        record({
          id: '77777777-7777-4777-8777-777777777777',
          encounterDate: new Date('2025-05-01T00:00:00Z'),
          psaNgMl: 4.2,
        }),
      ],
      [specimen],
      [aiReport()],
    ),
  );

  it('is an R4 collection labelled with its purpose and de-identification', () => {
    expect(bundle.resourceType).toBe('Bundle');
    expect(bundle.type).toBe('collection');
    expect(bundle.meta?.security?.map((s) => s.code)).toEqual([
      'HRESCH',
      'PSEUDED',
      'REDACTED',
    ]);
    const national = build(
      (b) => b.addPatient(patient, [], [], []),
      'NATIONAL_EHR',
    );
    expect(national.bundle.meta?.security?.[0].code).toBe('PUBHLTH');
  });

  it('has unique, valid ids and every reference points inside the bundle', () => {
    const urls = (bundle.entry ?? []).map((e) => e.fullUrl);
    expect(new Set(urls).size).toBe(urls.length);
    for (const e of bundle.entry ?? []) {
      expect(e.fullUrl).toBe(`urn:uuid:${e.resource?.id}`);
      expect(e.resource?.id).toMatch(/^[A-Za-z0-9\-.]{1,64}$/);
    }
    const refs = JSON.stringify(bundle).match(/"reference":"([^"]+)"/g) ?? [];
    expect(refs.length).toBeGreaterThan(10);
    for (const r of refs) {
      expect(urls).toContain(r.slice('"reference":"'.length, -1));
    }
  });

  it('gives the same pseudonyms in every export', () => {
    const again = build((b) =>
      b.addPatient(patient, [record()], [specimen], [aiReport()]),
    ).bundle;
    const idsOf = (b: Bundle) =>
      new Set((b.entry ?? []).map((e) => e.resource?.id));
    for (const id of idsOf(again)) expect(idsOf(bundle).has(id)).toBe(true);
  });

  it('reads back to the same values (round trip)', () => {
    const [back] = readExport(bundle);
    expect(back).toEqual({
      id: ids('Patient', patient.id),
      birthYear: '1958',
      ninetyOrOver: false,
      regionClass: 'RURAL',
      visits: [
        {
          year: '2026',
          psaNgMl: 6.4,
          freePsaNgMl: 1.1,
          dreFinding: 'NODULAR',
          piradsScore: 4,
          prostateVolumeMl: 42.5,
          familyHistory: true,
          biopsyHistory: 'PRIOR_NEGATIVE',
          symptoms: { nocturia: true, weakStream: false },
        },
        {
          year: '2025',
          psaNgMl: 4.2,
          freePsaNgMl: 1.1,
          dreFinding: 'NODULAR',
          piradsScore: 4,
          prostateVolumeMl: 42.5,
          familyHistory: true,
          biopsyHistory: 'PRIOR_NEGATIVE',
          symptoms: { nocturia: true, weakStream: false },
        },
      ],
      pathology: [
        {
          year: '2026',
          gleasonPrimary: 4,
          gleasonSecondary: 3,
          isupGradeGroup: 3,
        },
      ],
    });
  });

  it('reads back "90 or older" and "not performed"', () => {
    const b = build((x) =>
      x.addPatient(
        { ...patient, dateOfBirth: new Date('1930-01-01T00:00:00Z') },
        [record({ dreFinding: 'NOT_PERFORMED' })],
        [],
        [],
      ),
    ).bundle;
    const [back] = readExport(b);
    expect(back.birthYear).toBeNull();
    expect(back.ninetyOrOver).toBe(true);
    expect(back.visits[0].dreFinding).toBe('NOT_PERFORMED');
  });
});
