import type { Coding } from 'fhir/r4';

/*
 * Codes used by the FHIR R4 export (FR-09, UC-08).
 *
 * Every LOINC and HL7 code below was looked up on the HL7 terminology server
 * (tx.fhir.org, 2026-09-28): the code exists and the display is copied exactly
 * as published, including LOINC's own typo in grade group 5 ("Group Group").
 * Where no standard code could be verified (PI-RADS, the rectal examination,
 * prostate volume without a recorded method, AI outputs), the project's local
 * code system is used instead of a guessed standard code.
 */

export const LOINC = 'http://loinc.org';
export const UCUM = 'http://unitsofmeasure.org';

const THO = 'http://terminology.hl7.org/CodeSystem';
export const OBSERVATION_CATEGORY = `${THO}/observation-category`;
export const V2_0074 = `${THO}/v2-0074`;
export const V3_ACT_CODE = `${THO}/v3-ActCode`;
export const V3_ACT_REASON = `${THO}/v3-ActReason`;
export const V3_OBSERVATION_VALUE = `${THO}/v3-ObservationValue`;
export const DATA_ABSENT_REASON = `${THO}/data-absent-reason`;

/**
 * Placeholder namespace for this prototype's own code systems and extensions.
 * It uses the reserved ".example" domain because nothing is registered yet;
 * replace it with the namespace agreed with the Ministry of Health before any
 * real SmartCare Pro exchange.
 */
export const LOCAL_BASE = 'https://fhir.pca-mhealth.example';
export const LOCAL_OBSERVATIONS = `${LOCAL_BASE}/CodeSystem/observations`;
export const LOCAL_DRE_FINDING = `${LOCAL_BASE}/CodeSystem/dre-finding`;
export const LOCAL_BIOPSY_HISTORY = `${LOCAL_BASE}/CodeSystem/biopsy-history`;
export const LOCAL_REGION_CLASS = `${LOCAL_BASE}/CodeSystem/region-class`;
export const EXT_REGION_CLASS = `${LOCAL_BASE}/StructureDefinition/region-class`;
export const EXPORT_IDENTIFIER_SYSTEM = `${LOCAL_BASE}/sid/export`;

const loinc = (code: string, display: string): Coding => ({
  system: LOINC,
  code,
  display,
});

export const LOINC_CODES = {
  psaTotal: loinc(
    '2857-1',
    'Prostate specific Ag [Mass/volume] in Serum or Plasma',
  ),
  psaFree: loinc(
    '10886-0',
    'Prostate Specific Ag Free [Mass/volume] in Serum or Plasma',
  ),
  gleasonScore: loinc('35266-6', 'Gleason score in Specimen Qualitative'),
  gleasonPrimary: loinc('44641-9', 'Gleason pattern.primary in Prostate tumor'),
  gleasonSecondary: loinc(
    '44642-7',
    'Gleason pattern.secondary in Prostate tumor',
  ),
  gradeGroup: loinc(
    '94734-1',
    'Prostate cancer grade group [Score] in Prostate tumor Qualitative',
  ),
  pathologyReport: loinc('66117-3', 'Prostate Pathology biopsy report'),
  age: loinc('30525-0', 'Age'),
} as const;

/** LOINC answer list LL746-9 (Gleason pattern), patterns 3 to 5. */
export const GLEASON_PATTERN_ANSWERS: Record<number, Coding> = {
  3: loinc('LA9631-8', 'Grade 3'),
  4: loinc('LA11897-8', 'Grade 4'),
  5: loinc('LA11898-6', 'Grade 5'),
};

/** LOINC answer list LL5543-5 (ISUP grade group). */
export const GRADE_GROUP_ANSWERS: Record<number, Coding> = {
  1: loinc('LA30794-4', 'ISUP Grade (Grade Group) 1 (Gleason score <=6)'),
  2: loinc('LA30795-1', 'ISUP Grade (Grade Group) 2 (Gleason score 3+4=7)'),
  3: loinc('LA30796-9', 'ISUP Grade (Grade Group) 3 (Gleason score 4+3=7)'),
  4: loinc('LA30797-7', 'ISUP Grade (Grade Group) 4 (Gleason score 8)'),
  // Display exactly as LOINC publishes it.
  5: loinc('LA30798-5', 'ISUP Grade (Group Group) 5 (Gleason score 9-10)'),
};

export const CATEGORY = {
  laboratory: {
    system: OBSERVATION_CATEGORY,
    code: 'laboratory',
    display: 'Laboratory',
  },
  exam: { system: OBSERVATION_CATEGORY, code: 'exam', display: 'Exam' },
  imaging: {
    system: OBSERVATION_CATEGORY,
    code: 'imaging',
    display: 'Imaging',
  },
  surgicalPathology: {
    system: V2_0074,
    code: 'SP',
    display: 'Surgical Pathology',
  },
} satisfies Record<string, Coding>;

export const AMBULATORY: Coding = {
  system: V3_ACT_CODE,
  code: 'AMB',
  display: 'ambulatory',
};

export const NOT_PERFORMED: Coding = {
  system: DATA_ABSENT_REASON,
  code: 'not-performed',
  display: 'Not Performed',
};

/** Security labels (meta.security). */
export const SECURITY = {
  pseudonymized: {
    system: V3_OBSERVATION_VALUE,
    code: 'PSEUDED',
    display: 'pseudonymized',
  },
  redacted: {
    system: V3_OBSERVATION_VALUE,
    code: 'REDACTED',
    display: 'redacted',
  },
  aiAsserted: {
    system: V3_OBSERVATION_VALUE,
    code: 'AIAST',
    display: 'Artificial Intelligence asserted',
  },
  research: {
    system: V3_ACT_REASON,
    code: 'HRESCH',
    display: 'healthcare research',
  },
  publicHealth: {
    system: V3_ACT_REASON,
    code: 'PUBHLTH',
    display: 'public health',
  },
  testData: {
    system: V3_ACT_REASON,
    code: 'HTEST',
    display: 'test health data',
  },
} satisfies Record<string, Coding>;

const local = (code: string, display: string): Coding => ({
  system: LOCAL_OBSERVATIONS,
  code,
  display,
});

/** Local codes: no verified standard code exists for these (see file header). */
export const LOCAL_CODES = {
  dreFinding: local('dre-finding', 'Digital rectal examination finding'),
  pirads: local('pirads-category', 'PI-RADS assessment category'),
  prostateVolume: local(
    'prostate-volume',
    'Prostate volume (measurement method not recorded)',
  ),
  familyHistory: local(
    'family-history-prostate-cancer',
    'Family history of prostate cancer',
  ),
  biopsyHistory: local('biopsy-history', 'Previous prostate biopsy'),
  symptoms: local('luts-symptoms', 'Lower urinary tract and related symptoms'),
  screeningVisit: local('screening-visit', 'Prostate cancer screening visit'),
  aiReport: local(
    'ai-decision-support-report',
    'AI decision-support report (not a diagnosis)',
  ),
  aiProbability: local(
    'ai-pca-probability',
    'AI composite prostate cancer probability (decision support)',
  ),
  aiProbabilityLow: local(
    'ai-pca-probability-low',
    'Lower bound of the AI range',
  ),
  aiProbabilityHigh: local(
    'ai-pca-probability-high',
    'Upper bound of the AI range',
  ),
  aiGradeGroup: local(
    'ai-predicted-grade-group',
    'AI-predicted ISUP grade group (not a pathology result)',
  ),
} as const;

export const SYMPTOM_CODES: Record<string, Coding> = {
  nocturia: local('symptom-nocturia', 'Nocturia'),
  frequency: local('symptom-frequency', 'Urinary frequency'),
  urgency: local('symptom-urgency', 'Urinary urgency'),
  weakStream: local('symptom-weak-stream', 'Weak urinary stream'),
  haematuria: local('symptom-haematuria', 'Haematuria'),
  bonePain: local('symptom-bone-pain', 'Bone pain'),
  weightLoss: local('symptom-weight-loss', 'Unexplained weight loss'),
};

export const DRE_FINDINGS: Record<string, string> = {
  NORMAL: 'Normal',
  ENLARGED_SMOOTH: 'Enlarged, smooth',
  NODULAR: 'Nodular',
  INDURATED: 'Indurated (hard)',
};

export const BIOPSY_HISTORY: Record<string, string> = {
  NONE: 'No previous biopsy',
  PRIOR_NEGATIVE: 'Previous biopsy, negative',
  PRIOR_POSITIVE: 'Previous biopsy, positive',
};

export const REGION_CLASSES: Record<string, string> = {
  URBAN: 'Urban',
  PERI_URBAN: 'Peri-urban',
  RURAL: 'Rural',
};
