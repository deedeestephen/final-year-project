import type {
  Bundle,
  BundleEntry,
  Coding,
  Device,
  DiagnosticReport,
  Encounter,
  FhirResource,
  Meta,
  Observation,
  ObservationComponent,
  Patient,
  Quantity,
  Reference,
} from 'fhir/r4';
import {
  AMBULATORY,
  BIOPSY_HISTORY,
  CATEGORY,
  DRE_FINDINGS,
  EXPORT_IDENTIFIER_SYSTEM,
  EXT_REGION_CLASS,
  GLEASON_PATTERN_ANSWERS,
  GRADE_GROUP_ANSWERS,
  LOCAL_BIOPSY_HISTORY,
  LOCAL_CODES,
  LOCAL_DRE_FINDING,
  LOCAL_REGION_CLASS,
  LOINC_CODES,
  NOT_PERFORMED,
  REGION_CLASSES,
  SECURITY,
  SYMPTOM_CODES,
  UCUM,
} from './fhir-codes';
import { birthDetails, yearOnly } from './deidentify';

/*
 * Pure mapping between the app's data and FHIR R4 (no database, no network),
 * so every rule is unit-tested. The inputs are already free of names, phone
 * numbers, national ids, record numbers, districts and free text: those are
 * never loaded for an export.
 */

export type ExportPurpose = 'RESEARCH' | 'NATIONAL_EHR';

export interface ExportPatient {
  id: string;
  dateOfBirth: Date;
  regionClass: string;
  isSynthetic: boolean;
}

export interface ExportSymptoms {
  nocturia?: boolean;
  frequency?: boolean;
  urgency?: boolean;
  weakStream?: boolean;
  haematuria?: boolean;
  bonePain?: boolean;
  weightLoss?: boolean;
}

export interface ExportRecord {
  id: string;
  encounterDate: Date;
  psaNgMl: number | null;
  freePsaNgMl: number | null;
  dreFinding: string;
  piradsScore: number | null;
  prostateVolumeMl: number | null;
  biopsyHistory: string;
  familyHistory: boolean | null;
  symptoms: ExportSymptoms | null;
}

/** A slide a pathologist has reviewed. */
export interface ExportSpecimen {
  id: string;
  biopsyDate: Date | null;
  reviewedAt: Date;
  gleasonPrimary: number;
  gleasonSecondary: number;
  isupGradeGroup: number;
}

export interface ExportAiReport {
  jobId: string;
  provenance: 'MOCK' | 'RESEARCH_MODEL';
  disclaimer: string;
  modelVersions: Record<string, string>;
  pcaProbability: number | null;
  probabilityInterval: [number, number] | null;
  gleasonGradeGroup: number | null;
  createdAt: Date;
}

export interface ExportCounts {
  patients: number;
  screeningVisits: number;
  observations: number;
  pathologyReports: number;
  aiReports: number;
  /** Development mock AI results are never exported; this says how many were left out. */
  aiReportsLeftOutMock: number;
}

/** Makes the pseudonymous id of one resource (see deidentify.exportId). */
export type IdMaker = (kind: string, internalId: string) => string;

const ref = (id: string): Reference => ({ reference: `urn:uuid:${id}` });

const coded = (coding: Coding, text?: string) => ({
  coding: [coding],
  text: text ?? coding.display,
});

const quantity = (value: number, code: string, unit = code): Quantity => ({
  value,
  unit,
  system: UCUM,
  code,
});

/** Rounds away binary noise from database decimals without changing the value. */
const clean = (n: number): number => Number(n.toFixed(6));

export class FhirBundleBuilder {
  private readonly entries: BundleEntry[] = [];
  private readonly devices = new Map<string, string>();
  readonly counts: ExportCounts = {
    patients: 0,
    screeningVisits: 0,
    observations: 0,
    pathologyReports: 0,
    aiReports: 0,
    aiReportsLeftOutMock: 0,
  };

  constructor(
    private readonly id: IdMaker,
    private readonly purpose: ExportPurpose,
    private readonly asOf: Date,
  ) {}

  /** Adds one patient and everything exported about them. */
  addPatient(
    patient: ExportPatient,
    records: ExportRecord[],
    specimens: ExportSpecimen[],
    aiReports: ExportAiReport[],
  ): void {
    const meta = this.metaFor(patient);
    const patientId = this.id('Patient', patient.id);
    this.add(this.patient(patientId, patient, meta));
    this.counts.patients += 1;

    const birth = birthDetails(patient.dateOfBirth, this.asOf);
    if (birth.kind === 'ninetyOrOver') {
      this.addObservation({
        resourceType: 'Observation',
        id: this.id('Observation:age', patient.id),
        meta,
        status: 'final',
        code: coded(LOINC_CODES.age),
        subject: ref(patientId),
        effectiveDateTime: yearOnly(this.asOf),
        valueQuantity: {
          ...quantity(90, 'a', 'years'),
          comparator: '>=',
        },
      });
    }

    for (const record of records) this.addVisit(patientId, record, meta);
    for (const specimen of specimens) {
      this.addPathology(patientId, specimen, meta);
    }
    for (const report of aiReports) this.addAiReport(patientId, report, meta);
  }

  build(exportId: string, timestamp: Date): Bundle {
    return {
      resourceType: 'Bundle',
      id: exportId,
      meta: {
        security: [
          this.purpose === 'RESEARCH'
            ? SECURITY.research
            : SECURITY.publicHealth,
          SECURITY.pseudonymized,
          SECURITY.redacted,
        ],
      },
      identifier: { system: EXPORT_IDENTIFIER_SYSTEM, value: exportId },
      type: 'collection',
      timestamp: timestamp.toISOString(),
      entry: this.entries,
    };
  }

  // -- resources -----------------------------------------------------------

  private patient(id: string, p: ExportPatient, meta: Meta): Patient {
    const birth = birthDetails(p.dateOfBirth, this.asOf);
    return {
      resourceType: 'Patient',
      id,
      meta,
      extension: [
        {
          url: EXT_REGION_CLASS,
          valueCoding: {
            system: LOCAL_REGION_CLASS,
            code: p.regionClass,
            display: REGION_CLASSES[p.regionClass] ?? p.regionClass,
          },
        },
      ],
      ...(birth.kind === 'birthYear' ? { birthDate: birth.birthYear } : {}),
      address: [{ country: 'ZM' }],
    };
  }

  private addVisit(patientId: string, r: ExportRecord, meta: Meta): void {
    const encounterId = this.id('Encounter', r.id);
    const year = yearOnly(r.encounterDate);
    const encounter: Encounter = {
      resourceType: 'Encounter',
      id: encounterId,
      meta,
      status: 'finished',
      class: AMBULATORY,
      type: [coded(LOCAL_CODES.screeningVisit)],
      subject: ref(patientId),
      period: { start: year },
    };
    this.add(encounter);
    this.counts.screeningVisits += 1;

    const base = (kind: string) => ({
      resourceType: 'Observation' as const,
      id: this.id(`Observation:${kind}`, r.id),
      meta,
      status: 'final' as const,
      subject: ref(patientId),
      encounter: ref(encounterId),
      effectiveDateTime: year,
    });

    if (r.psaNgMl !== null) {
      this.addObservation({
        ...base('psa'),
        category: [coded(CATEGORY.laboratory)],
        code: coded(LOINC_CODES.psaTotal, 'PSA (total)'),
        valueQuantity: quantity(clean(r.psaNgMl), 'ng/mL'),
      });
    }
    if (r.freePsaNgMl !== null) {
      this.addObservation({
        ...base('free-psa'),
        category: [coded(CATEGORY.laboratory)],
        code: coded(LOINC_CODES.psaFree, 'PSA (free)'),
        valueQuantity: quantity(clean(r.freePsaNgMl), 'ng/mL'),
      });
    }
    const dre: Observation = {
      ...base('dre'),
      category: [coded(CATEGORY.exam)],
      code: coded(LOCAL_CODES.dreFinding),
    };
    if (r.dreFinding === 'NOT_PERFORMED') {
      dre.dataAbsentReason = coded(NOT_PERFORMED);
    } else {
      dre.valueCodeableConcept = coded({
        system: LOCAL_DRE_FINDING,
        code: r.dreFinding,
        display: DRE_FINDINGS[r.dreFinding] ?? r.dreFinding,
      });
    }
    this.addObservation(dre);

    if (r.piradsScore !== null) {
      this.addObservation({
        ...base('pirads'),
        category: [coded(CATEGORY.imaging)],
        code: coded(LOCAL_CODES.pirads),
        valueInteger: r.piradsScore,
      });
    }
    if (r.prostateVolumeMl !== null) {
      this.addObservation({
        ...base('prostate-volume'),
        category: [coded(CATEGORY.imaging)],
        code: coded(LOCAL_CODES.prostateVolume),
        valueQuantity: quantity(clean(r.prostateVolumeMl), 'mL'),
      });
    }
    if (r.familyHistory !== null) {
      this.addObservation({
        ...base('family-history'),
        code: coded(LOCAL_CODES.familyHistory),
        valueBoolean: r.familyHistory,
      });
    }
    if (r.biopsyHistory in BIOPSY_HISTORY) {
      this.addObservation({
        ...base('biopsy-history'),
        code: coded(LOCAL_CODES.biopsyHistory),
        valueCodeableConcept: coded({
          system: LOCAL_BIOPSY_HISTORY,
          code: r.biopsyHistory,
          display: BIOPSY_HISTORY[r.biopsyHistory],
        }),
      });
    }
    const answered: ObservationComponent[] = Object.entries(SYMPTOM_CODES)
      .filter(
        ([key]) =>
          typeof r.symptoms?.[key as keyof ExportSymptoms] === 'boolean',
      )
      .map(([key, coding]) => ({
        code: coded(coding),
        valueBoolean: r.symptoms![key as keyof ExportSymptoms] as boolean,
      }));
    if (answered.length > 0) {
      this.addObservation({
        ...base('symptoms'),
        code: coded(LOCAL_CODES.symptoms),
        component: answered,
      });
    }
  }

  private addPathology(patientId: string, s: ExportSpecimen, meta: Meta): void {
    const year = yearOnly(s.biopsyDate ?? s.reviewedAt);
    const base = (kind: string) => ({
      resourceType: 'Observation' as const,
      id: this.id(`Observation:${kind}`, s.id),
      meta,
      status: 'final' as const,
      category: [coded(CATEGORY.laboratory)],
      subject: ref(patientId),
      effectiveDateTime: year,
    });
    const results: Observation[] = [
      {
        ...base('gleason-primary'),
        code: coded(LOINC_CODES.gleasonPrimary),
        valueCodeableConcept: coded(GLEASON_PATTERN_ANSWERS[s.gleasonPrimary]),
      },
      {
        ...base('gleason-secondary'),
        code: coded(LOINC_CODES.gleasonSecondary),
        valueCodeableConcept: coded(
          GLEASON_PATTERN_ANSWERS[s.gleasonSecondary],
        ),
      },
      {
        ...base('gleason-score'),
        code: coded(LOINC_CODES.gleasonScore),
        valueInteger: s.gleasonPrimary + s.gleasonSecondary,
      },
      {
        ...base('grade-group'),
        code: coded(LOINC_CODES.gradeGroup),
        valueCodeableConcept: coded(GRADE_GROUP_ANSWERS[s.isupGradeGroup]),
      },
    ];
    for (const o of results) this.addObservation(o);
    const report: DiagnosticReport = {
      resourceType: 'DiagnosticReport',
      id: this.id('DiagnosticReport:pathology', s.id),
      meta,
      status: 'final',
      category: [coded(CATEGORY.surgicalPathology)],
      code: coded(LOINC_CODES.pathologyReport),
      subject: ref(patientId),
      effectiveDateTime: year,
      result: results.map((o) => ref(o.id!)),
      conclusion:
        `Gleason ${s.gleasonPrimary} + ${s.gleasonSecondary} = ` +
        `${s.gleasonPrimary + s.gleasonSecondary}, ISUP grade group ` +
        `${s.isupGradeGroup} (pathologist review).`,
    };
    this.add(report);
    this.counts.pathologyReports += 1;
  }

  /**
   * Only results from a research model are exported, labelled as asserted by
   * AI and as preliminary (a clinician must review them). Development mock
   * results are never exported; they are only counted.
   */
  private addAiReport(patientId: string, r: ExportAiReport, meta: Meta): void {
    if (r.provenance !== 'RESEARCH_MODEL') {
      this.counts.aiReportsLeftOutMock += 1;
      return;
    }
    const aiMeta: Meta = {
      ...meta,
      security: [...(meta.security ?? []), SECURITY.aiAsserted],
    };
    // The fusion model produces the composite result, so it is listed first
    // (Observation.device holds one model; every model gets a Device).
    const devices = Object.entries(r.modelVersions)
      .sort(
        ([a], [b]) =>
          Number(b.includes('fusion')) - Number(a.includes('fusion')) ||
          a.localeCompare(b),
      )
      .map(([name, version]) => this.device(name, version));
    const year = yearOnly(r.createdAt);
    const base = (kind: string) => ({
      resourceType: 'Observation' as const,
      id: this.id(`Observation:${kind}`, r.jobId),
      meta: aiMeta,
      status: 'preliminary' as const,
      subject: ref(patientId),
      effectiveDateTime: year,
      ...(devices.length > 0 ? { device: ref(devices[0]) } : {}),
    });
    const results: Observation[] = [];
    if (r.pcaProbability !== null) {
      const percent = (p: number) => Number((p * 100).toFixed(1));
      results.push({
        ...base('ai-probability'),
        code: coded(LOCAL_CODES.aiProbability),
        valueQuantity: quantity(percent(r.pcaProbability), '%'),
        ...(r.probabilityInterval
          ? {
              component: [
                {
                  code: coded(LOCAL_CODES.aiProbabilityLow),
                  valueQuantity: quantity(
                    percent(r.probabilityInterval[0]),
                    '%',
                  ),
                },
                {
                  code: coded(LOCAL_CODES.aiProbabilityHigh),
                  valueQuantity: quantity(
                    percent(r.probabilityInterval[1]),
                    '%',
                  ),
                },
              ],
            }
          : {}),
      });
    }
    if (r.gleasonGradeGroup !== null) {
      results.push({
        ...base('ai-grade-group'),
        code: coded(LOCAL_CODES.aiGradeGroup),
        valueInteger: r.gleasonGradeGroup,
      });
    }
    for (const o of results) this.addObservation(o);
    this.add({
      resourceType: 'DiagnosticReport',
      id: this.id('DiagnosticReport:ai', r.jobId),
      meta: aiMeta,
      status: 'preliminary',
      code: coded(LOCAL_CODES.aiReport),
      subject: ref(patientId),
      effectiveDateTime: year,
      result: results.map((o) => ref(o.id!)),
      conclusion: r.disclaimer,
    } satisfies DiagnosticReport);
    this.counts.aiReports += 1;
  }

  /** One Device resource per AI model version, shared by all reports. */
  private device(name: string, version: string): string {
    const key = `${name}@${version}`;
    const existing = this.devices.get(key);
    if (existing) return existing;
    const id = this.id('Device', key);
    const device: Device = {
      resourceType: 'Device',
      id,
      deviceName: [{ name, type: 'model-name' }],
      version: [{ value: version }],
      type: { text: 'AI model (software)' },
    };
    this.add(device);
    this.devices.set(key, id);
    return id;
  }

  // -- helpers -------------------------------------------------------------

  private metaFor(p: ExportPatient): Meta {
    return {
      security: [
        SECURITY.pseudonymized,
        SECURITY.redacted,
        ...(p.isSynthetic ? [SECURITY.testData] : []),
      ],
    };
  }

  private addObservation(o: Observation): void {
    this.add(o);
    this.counts.observations += 1;
  }

  private add(resource: FhirResource & { id?: string }): void {
    this.entries.push({ fullUrl: `urn:uuid:${resource.id}`, resource });
  }
}

// ---------------------------------------------------------------------------
// Reading a bundle back (round-trip tests; the start of an inbound adapter)
// ---------------------------------------------------------------------------

export interface ReadVisit {
  year: string;
  psaNgMl: number | null;
  freePsaNgMl: number | null;
  dreFinding: string;
  piradsScore: number | null;
  prostateVolumeMl: number | null;
  familyHistory: boolean | null;
  biopsyHistory: string;
  symptoms: ExportSymptoms | null;
}

export interface ReadPathology {
  year: string;
  gleasonPrimary: number;
  gleasonSecondary: number;
  isupGradeGroup: number;
}

export interface ReadPatient {
  id: string;
  birthYear: string | null;
  ninetyOrOver: boolean;
  regionClass: string | null;
  visits: ReadVisit[];
  pathology: ReadPathology[];
}

const hasCode = (o: Observation | DiagnosticReport, c: Coding): boolean =>
  (o.code.coding ?? []).some((x) => x.system === c.system && x.code === c.code);

const answerOf = (
  answers: Record<number, Coding>,
  concept: Observation['valueCodeableConcept'],
): number | null => {
  const code = concept?.coding?.[0]?.code;
  const hit = Object.entries(answers).find(([, c]) => c.code === code);
  return hit ? Number(hit[0]) : null;
};

/** Reads the screening and pathology data of an export back into plain values. */
export function readExport(bundle: Bundle): ReadPatient[] {
  const resources = (bundle.entry ?? []).map((e) => e.resource as FhirResource);
  const byUrl = new Map(
    (bundle.entry ?? []).map((e) => [e.fullUrl!, e.resource as FhirResource]),
  );
  const observations = resources.filter(
    (r): r is Observation => r.resourceType === 'Observation',
  );
  const patients = resources.filter(
    (r): r is Patient => r.resourceType === 'Patient',
  );
  return patients.map((p) => {
    const self = `urn:uuid:${p.id}`;
    const encounters = resources.filter(
      (r): r is Encounter =>
        r.resourceType === 'Encounter' && r.subject?.reference === self,
    );
    const visits = encounters.map((e): ReadVisit => {
      const obs = observations.filter(
        (o) => o.encounter?.reference === `urn:uuid:${e.id}`,
      );
      const find = (c: Coding) => obs.find((o) => hasCode(o, c));
      const dre = find(LOCAL_CODES.dreFinding);
      const symptoms = find(LOCAL_CODES.symptoms);
      return {
        year: e.period?.start ?? '',
        psaNgMl: find(LOINC_CODES.psaTotal)?.valueQuantity?.value ?? null,
        freePsaNgMl: find(LOINC_CODES.psaFree)?.valueQuantity?.value ?? null,
        dreFinding: dre?.dataAbsentReason
          ? 'NOT_PERFORMED'
          : (dre?.valueCodeableConcept?.coding?.[0]?.code ?? ''),
        piradsScore: find(LOCAL_CODES.pirads)?.valueInteger ?? null,
        prostateVolumeMl:
          find(LOCAL_CODES.prostateVolume)?.valueQuantity?.value ?? null,
        familyHistory: find(LOCAL_CODES.familyHistory)?.valueBoolean ?? null,
        biopsyHistory:
          find(LOCAL_CODES.biopsyHistory)?.valueCodeableConcept?.coding?.[0]
            ?.code ?? 'UNKNOWN',
        symptoms: symptoms
          ? Object.fromEntries(
              Object.entries(SYMPTOM_CODES).flatMap(([key, coding]) => {
                const c = symptoms.component?.find((x) =>
                  (x.code.coding ?? []).some((y) => y.code === coding.code),
                );
                return c ? [[key, c.valueBoolean]] : [];
              }),
            )
          : null,
      };
    });
    const pathology = resources
      .filter(
        (r): r is DiagnosticReport =>
          r.resourceType === 'DiagnosticReport' &&
          r.subject?.reference === self &&
          hasCode(r, LOINC_CODES.pathologyReport),
      )
      .map((d): ReadPathology => {
        const results = (d.result ?? []).map(
          (x) => byUrl.get(x.reference!) as Observation,
        );
        const find = (c: Coding) => results.find((o) => hasCode(o, c));
        return {
          year: d.effectiveDateTime ?? '',
          gleasonPrimary:
            answerOf(
              GLEASON_PATTERN_ANSWERS,
              find(LOINC_CODES.gleasonPrimary)?.valueCodeableConcept,
            ) ?? 0,
          gleasonSecondary:
            answerOf(
              GLEASON_PATTERN_ANSWERS,
              find(LOINC_CODES.gleasonSecondary)?.valueCodeableConcept,
            ) ?? 0,
          isupGradeGroup:
            answerOf(
              GRADE_GROUP_ANSWERS,
              find(LOINC_CODES.gradeGroup)?.valueCodeableConcept,
            ) ?? 0,
        };
      });
    const region = p.extension?.find((x) => x.url === EXT_REGION_CLASS);
    return {
      id: p.id!,
      birthYear: p.birthDate ?? null,
      ninetyOrOver: observations.some(
        (o) =>
          o.subject?.reference === self &&
          hasCode(o, LOINC_CODES.age) &&
          o.valueQuantity?.comparator === '>=',
      ),
      regionClass: region?.valueCoding?.code ?? null,
      visits,
      pathology,
    };
  });
}
