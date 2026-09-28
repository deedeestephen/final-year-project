# FHIR export (Phase 14)

The platform exports **de-identified** patient data as **HL7 FHIR R4** JSON, for research and for Zambia's national EHR, SmartCare Pro (FR-09, UC-08, NFR-06, NFR-10). Decisions are recorded in [ADR-007](decisions/ADR-007-fhir-export.md).

## Who can export, and whose data

- **Who:** administrators, using the admin website's **FHIR export** page. The permission is `fhir:export`, which only ADMIN holds by default.
- **Whose data:** only patients who gave the consent that matches the purpose (purpose limitation):

| Purpose | Consent needed | Label on the bundle (`meta.security`) |
|---|---|---|
| Research (download) | `RESEARCH_USE` | `HRESCH` (healthcare research) |
| National EHR, SmartCare Pro (download or send) | `EHR_SHARING` | `PUBHLTH` (public health) |

- A withdrawn consent means the patient is left out of the next export.
- **Scope:** one facility or all facilities. A single file holds at most `FHIR_EXPORT_MAX_PATIENTS` patients (default 5,000); above that the API answers `EXPORT_TOO_LARGE` and asks for one facility at a time.
- **Audit:** every download and every send is audited (`fhir.export`, `fhir.push`) with counts only, never identifiers.

## API

| Endpoint | What it does |
|---|---|
| `GET /api/v1/fhir/export/summary?purpose=&facilityId=` | What an export would contain (counts), whether SmartCare Pro is set up. Exports nothing. |
| `POST /api/v1/fhir/export` `{purpose, facilityId?}` | The Bundle itself, `application/fhir+json`, as a file download (`Cache-Control: no-store`). |
| `POST /api/v1/fhir/export/push` `{facilityId?}` | Sends the national-EHR export to SmartCare Pro (`POST {SMARTCARE_FHIR_URL}/Bundle`, Bearer token). 503 when no address is set; 502/504 when SmartCare Pro is unreachable, refuses or is too slow. |

The receiving server's error text is untrusted, so the API answer carries only an error code; the cleaned reason (at most 300 characters) is kept in the audit log. Redirects are refused, so the token is never sent to another server.

## What is in the file

A `Bundle` of type `collection`. Every entry has `fullUrl` `urn:uuid:<id>`, and every reference points inside the bundle.

| From the app | FHIR | Code |
|---|---|---|
| Patient | `Patient`: birth **year** only, country `ZM`, urban / peri-urban / rural (extension) | – |
| Patient aged 90 or over | no birth year; `Observation` Age `>= 90` years | LOINC 30525-0 |
| Screening visit | `Encounter` (finished, ambulatory), year only | v3-ActCode AMB |
| PSA (total) | `Observation` (laboratory), ng/mL (UCUM) | LOINC 2857-1 |
| PSA (free) | `Observation` (laboratory), ng/mL | LOINC 10886-0 |
| Rectal examination | `Observation` (exam); "not performed" as `dataAbsentReason` | local `dre-finding` |
| PI-RADS category | `Observation` (imaging), integer | local `pirads-category` |
| Prostate volume | `Observation` (imaging), mL | local `prostate-volume` |
| Family history, previous biopsy | `Observation` | local codes |
| Symptoms (yes/no) | one `Observation` with one component per answered symptom | local codes |
| Pathologist's slide review | `DiagnosticReport` (final, Surgical Pathology) with 4 results | LOINC 66117-3 |
| Gleason primary / secondary pattern | `Observation`, LOINC answer codes (Grade 3–5) | LOINC 44641-9 / 44642-7 |
| Gleason score | `Observation`, integer | LOINC 35266-6 |
| ISUP grade group | `Observation`, LOINC answer codes (grade group 1–5) | LOINC 94734-1 |
| AI report, **research model only** | `DiagnosticReport` **preliminary**, labelled `AIAST` (Artificial Intelligence asserted); probability in %, range as components; each model version as a `Device` | local codes |

**Code checks.** Every LOINC and HL7 code, and its display text, was checked on the HL7 terminology server (tx.fhir.org, 2026-09-28). No LOINC code could be verified for PI-RADS, the rectal examination, or prostate volume without a measurement method: LOINC's volume codes all state an ultrasound method, which the app does not record. So those use the project's own code systems instead of a guessed standard code.

**Local definitions.** The project's own code systems, value set and extension are published as FHIR definitions in [`2-api-gateway/fhir/definitions/`](../2-api-gateway/fhir/definitions/). They are generated from the code (`npm run fhir:definitions`), and the gate checks they are up to date. The namespace `https://fhir.pca-mhealth.example` is a placeholder (a reserved domain) until a namespace is agreed with the Ministry of Health.

## De-identification (Safe Harbor, NFR-10)

The export query never reads names, phone numbers, national ids, record numbers, districts, notes, stain text or file references from the database. The mapping code only receives fields that are safe after de-identification.

| # | Identifier class | In this system | In the export |
|---|---|---|---|
| 1 | Names | patient names (encrypted) | removed |
| 2 | Geographic units smaller than a state | district; facility name, code, district, province | removed; only the country and the urban/rural class |
| 3 | Dates (except year); ages over 89 | birth, screening, biopsy, review, AI dates | year only; from 90, the birth year is removed and the age is "90 or older" |
| 4 | Telephone numbers | patient phone (encrypted) | removed |
| 5 | Fax numbers | not collected | – |
| 6 | Email addresses | patient account and staff emails | removed |
| 7 | National id (NRC / passport) | encrypted | removed |
| 8 | Medical record numbers | facility MRN | removed |
| 9 | Health plan numbers | not collected | – |
| 10 | Account numbers | app account ids | removed |
| 11 | Certificate / licence numbers | not collected | – |
| 12 | Vehicle identifiers | not collected | – |
| 13 | Device identifiers | scanner details inside DICOM files | image files and headers are not exported |
| 14 | URLs | storage keys of files | removed |
| 15 | IP addresses | audit log only | not exported |
| 16 | Biometrics | not collected | – |
| 17 | Full-face photos and comparable images | not collected; medical images not exported | – |
| 18 | Any other unique id or characteristic | internal and client ids; notes; slide stain text | pseudonyms; free text removed |

**Pseudonyms.** Each resource id is an HMAC of the internal id with the server's key, shaped as a UUID. The internal id is itself random, so the pseudonym is not derived from anything about the person, and only the server can recompute it (Safe Harbor's "re-identification code"). The same person keeps the same pseudonym across exports while the key is unchanged, so research can follow people over time.

**Tests.** `test/db/fhir.int-spec.ts` plants a synthetic patient carrying every identifier the system can hold (names, NRC, phone, MRN, district, linked account email, notes, stain, storage keys, exact dates), exports it, and has one test per class above.

**Limits.**
- De-identified is not anonymous: a rare combination of values can still point to a person. The files are for approved research and the national EHR under a data-sharing agreement, not for publication.
- Dates reduced to the year lose the order of visits within a year. Keeping finer timing needs another method (expert determination with date shifting) and ethics approval; it is not built.

## Development mock AI results are never exported

Results from the labelled development mocks are left out of every export and only counted (the admin page says how many). Only results whose provenance is `RESEARCH_MODEL` can be exported. They are `preliminary`, labelled `AIAST`, and carry the model's disclaimer; an AI-predicted grade group uses a local "AI-predicted" code, never the pathology LOINC code.

## SmartCare Pro: the mock endpoint

Real SmartCare Pro access needs a data-sharing agreement, and its API is not public. Development therefore uses a mock:

```
cd 3-application-logic/backend && npm run smartcare:mock
```

Set `SMARTCARE_FHIR_URL=http://localhost:8090/fhir` in `.env` and restart the backend. The mock checks the Bearer token (`SMARTCARE_TOKEN`), accepts `POST /fhir/Bundle` and saves what it receives in `var/smartcare-mock/`. It also answers `GET /fhir/Bundle/{id}` and `GET /fhir/metadata`. In production the address must use https.

**Bidirectional exchange** (receiving results back from SmartCare Pro) needs identified data and patient matching (for example by NRC, using the existing HMAC lookup), and so a data-sharing agreement. It is future work. `readExport()` in `fhir-mappers.ts` already turns an exported bundle back into the app's values; the round-trip tests use it, and it is the starting point for an inbound adapter.

## Conformance: the official HL7 validator

```
6-infrastructure/scripts/fhir-validate.sh            # full check, with the HL7 terminology server
6-infrastructure/scripts/fhir-validate.sh --offline  # structure and local definitions only (used by the gate)
```

- **What it checks:** a sample export built from made-up values (`npm run fhir:sample`: two patients, two visits, a pathology review, a research-model AI report marked as a format-check sample, and a patient aged 90 or over).
- **How:** the HL7 FHIR validator 6.10.4 (`validator_cli.jar`, SHA-256 checked) is kept outside the repository in `D:\Final Year Project\tools\fhir-validator` and runs on the Java bundled with Android Studio.
- **Result (2026-09-28):** **0 errors**, with the terminology server and the local definitions (46 warnings). Offline: 0 errors, 55 warnings, the extra 9 being codes that cannot be checked without the terminology server. The remaining warnings are best-practice notes:
  - no narrative text: left out to keep the file minimal
  - no `performer` on observations: staff are deliberately not exported
