/**
 * Writes the FHIR definitions of this project's own codes and extension
 * (CodeSystem, ValueSet, StructureDefinition) to 2-api-gateway/fhir/definitions,
 * generated from src/services/fhir/fhir-codes.ts so they cannot drift apart.
 * The HL7 validator loads them (see 6-infrastructure/scripts/fhir-validate.sh),
 * and a receiving system such as SmartCare Pro can load them too.
 *
 *   npm run fhir:definitions          write the files
 *   npm run fhir:definitions:check    fail if the committed files are out of date
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import type {
  CodeSystem,
  CodeSystemConcept,
  Coding,
  StructureDefinition,
  ValueSet,
} from 'fhir/r4';
import { repoRoot } from '../src/config/repo-root';
import {
  BIOPSY_HISTORY,
  DRE_FINDINGS,
  EXT_REGION_CLASS,
  LOCAL_BASE,
  LOCAL_BIOPSY_HISTORY,
  LOCAL_CODES,
  LOCAL_DRE_FINDING,
  LOCAL_OBSERVATIONS,
  LOCAL_REGION_CLASS,
  REGION_CLASSES,
  SYMPTOM_CODES,
} from '../src/services/fhir/fhir-codes';

const DIR = path.join(repoRoot(), '2-api-gateway', 'fhir', 'definitions');
const VERSION = '0.1.0';
const PUBLISHER = 'PCa mHealth research prototype (ZCAS University)';
const DRAFT_NOTE =
  ' Draft for a research prototype, not an official Ministry of Health definition.';

function codeSystem(
  id: string,
  url: string,
  title: string,
  description: string,
  concepts: CodeSystemConcept[],
): CodeSystem {
  return {
    resourceType: 'CodeSystem',
    id,
    url,
    version: VERSION,
    name: title.replace(/[^A-Za-z0-9]/g, ''),
    title,
    status: 'draft',
    experimental: true,
    publisher: PUBLISHER,
    description: description + DRAFT_NOTE,
    caseSensitive: true,
    content: 'complete',
    count: concepts.length,
    concept: concepts,
  };
}

const fromCodings = (codings: Coding[]): CodeSystemConcept[] =>
  codings.map((c) => ({ code: c.code!, display: c.display! }));
const fromLabels = (labels: Record<string, string>): CodeSystemConcept[] =>
  Object.entries(labels).map(([code, display]) => ({ code, display }));

const observations = codeSystem(
  'observations',
  LOCAL_OBSERVATIONS,
  'PCa mHealth observation codes',
  'Observations exported by PCa mHealth for which no standard (LOINC) code was verified: the rectal examination, PI-RADS, prostate volume without a recorded method, history, symptoms and AI decision-support outputs.',
  fromCodings([...Object.values(LOCAL_CODES), ...Object.values(SYMPTOM_CODES)]),
);
const dre = codeSystem(
  'dre-finding',
  LOCAL_DRE_FINDING,
  'Digital rectal examination finding',
  'Findings of the digital rectal examination as recorded in PCa mHealth.',
  fromLabels(DRE_FINDINGS),
);
const biopsy = codeSystem(
  'biopsy-history',
  LOCAL_BIOPSY_HISTORY,
  'Previous prostate biopsy',
  'Whether the patient had a prostate biopsy before, and its result.',
  fromLabels(BIOPSY_HISTORY),
);
const region = codeSystem(
  'region-class',
  LOCAL_REGION_CLASS,
  'Region class',
  'Urban, peri-urban or rural setting, kept for fairness monitoring (proposal section 3.7.3). It is not a geographic subdivision.',
  fromLabels(REGION_CLASSES),
);

const regionValueSet: ValueSet = {
  resourceType: 'ValueSet',
  id: 'region-class',
  url: `${LOCAL_BASE}/ValueSet/region-class`,
  version: VERSION,
  name: 'RegionClass',
  title: 'Region class',
  status: 'draft',
  experimental: true,
  publisher: PUBLISHER,
  description: 'All region classes.' + DRAFT_NOTE,
  compose: { include: [{ system: LOCAL_REGION_CLASS }] },
};

const regionExtension: StructureDefinition = {
  resourceType: 'StructureDefinition',
  id: 'region-class',
  url: EXT_REGION_CLASS,
  version: VERSION,
  name: 'RegionClass',
  title: 'Region class (urban, peri-urban, rural)',
  status: 'draft',
  experimental: true,
  publisher: PUBLISHER,
  description:
    "The patient's setting: urban, peri-urban or rural. Used for fairness monitoring; it does not identify a place." +
    DRAFT_NOTE,
  fhirVersion: '4.0.1',
  kind: 'complex-type',
  abstract: false,
  context: [{ type: 'element', expression: 'Patient' }],
  type: 'Extension',
  baseDefinition: 'http://hl7.org/fhir/StructureDefinition/Extension',
  derivation: 'constraint',
  differential: {
    element: [
      {
        id: 'Extension',
        path: 'Extension',
        short: 'Urban, peri-urban or rural',
        definition: "The patient's setting: urban, peri-urban or rural.",
        max: '1',
      },
      { id: 'Extension.extension', path: 'Extension.extension', max: '0' },
      {
        id: 'Extension.url',
        path: 'Extension.url',
        fixedUri: EXT_REGION_CLASS,
      },
      {
        id: 'Extension.value[x]',
        path: 'Extension.value[x]',
        min: 1,
        type: [{ code: 'Coding' }],
        binding: { strength: 'required', valueSet: regionValueSet.url },
      },
    ],
  },
};

const files: Record<string, unknown> = {
  'CodeSystem-observations.json': observations,
  'CodeSystem-dre-finding.json': dre,
  'CodeSystem-biopsy-history.json': biopsy,
  'CodeSystem-region-class.json': region,
  'ValueSet-region-class.json': regionValueSet,
  'StructureDefinition-region-class.json': regionExtension,
};

const check = process.argv.includes('--check');
let stale = 0;
if (!check) mkdirSync(DIR, { recursive: true });
for (const [name, resource] of Object.entries(files)) {
  const file = path.join(DIR, name);
  const text = `${JSON.stringify(resource, null, 2)}\n`;
  if (check) {
    const current = existsSync(file)
      ? readFileSync(file, 'utf8').replace(/\r\n/g, '\n')
      : '';
    if (current !== text) {
      console.error(`Out of date: ${name} (run npm run fhir:definitions)`);
      stale += 1;
    }
  } else {
    writeFileSync(file, text);
  }
}
if (check && stale > 0) process.exit(1);
console.log(
  check
    ? 'FHIR definitions are up to date'
    : `Wrote ${Object.keys(files).length} definitions to ${DIR}`,
);
