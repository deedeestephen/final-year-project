# Security and compliance review (Phase 15)

**Date:** 2026-09-28. **Scope:** the whole system at commit `dae7661` plus the fixes below: backend (API gateway and services), AI service boundary, mobile app, admin website, reverse-proxy template, data stores, dependencies and the repository history. **Reviewer:** development team (Claude), for the project owner. This is an internal review, not an independent penetration test (see R-7).

## Method

Automated checks were added where a rule could be checked every time, so the review keeps holding after this phase. The quality gate (`6-infrastructure/scripts/quality-gate.sh`) runs all of them.

| Area | How it was checked | Result |
|---|---|---|
| Who can call every endpoint | [Access matrix](access-matrix.md), generated from the code; review rules fail the gate: public routes come from a fixed list; routes with no permission come from a fixed list; administration routes are for administrators only; clinical data is never open to administrators or patients; patients reach only their own "me" routes | 66 routes, **0 rule breaks** |
| Transport | `tls-check.sh` runs the real nginx template in Docker | **TLS 1.3 only** (1.2 and 1.1 refused), HSTS 1 year, `nosniff`, no version disclosed, HTTP redirects to HTTPS, paths outside `/api/` refused |
| Secrets in the repository | gitleaks 8.30.1 over the **full git history**; separately, every real `.env` value searched for in every commit | 4 findings, all reviewed false positives (test passwords, a template placeholder), listed one by one in `.gitleaksignore`; no real secret in any commit |
| Dependencies | `npm audit` (backend and admin website, **including development tools**), `pip-audit` (AI service), OSV database for the 130 Dart/Flutter packages (`pub-audit.py`) | **0 known vulnerabilities** at any severity (after F-7) |
| De-identification | Tests with synthetic data that carry every identifier: FHIR export (one test per Safe Harbor class), DICOM copies for the AI, JPEG/PNG metadata | Pass (see F-1) |
| Audit log | Tamper test: an entry is changed inside a rolled-back transaction and the chain check must catch it | Caught; the real log is untouched |
| Logs | The end-to-end run (Phase 16) captures the real server's log and searches it for every password, token and patient value used | See [development log](development-log.md), Phase 16 |

## Findings

| ID | Severity | Finding | Status |
|---|---|---|---|
| F-1 | High | **Files sent to the AI were the original uploads.** DICOM headers carry the patient's name, ID, birth date and address, and the proposal requires Safe Harbor before AI processing (NFR-10). | **Fixed.** After a scan passes its checks, a de-identified copy is made and only that copy is sent. DICOM identifying values (PS3.15 Annex E, relevant attributes) are overwritten in place at the same length, dates keep the year, UIDs get keyed replacements, private attributes are blanked, and pixels are untouched. JPEG/PNG metadata is removed. Scans flagged "burned-in annotation" are not sent, with the reason shown to clinicians. Slides are held back (R-1). |
| F-2 | Medium | **Role editing could break separation of duties.** An administrator could give a clinical role administration powers (for example `audit:read`, `fhir:export`), or give the administrator role clinical-data permissions. | **Fixed.** Administration-only permissions are locked for clinical and patient roles; clinical-data permissions are locked for the administrator role. The admin website shows these boxes as locked. |
| F-3 | Medium | **An administrator could add a clinical role to their own account** and so read patient data. | **Fixed.** Nobody can add roles to their own account (`SELF_ROLE_CHANGE`); another administrator must do it, and that is audited. |
| F-4 | Low | **The secret scan was not running locally.** The gate skipped gitleaks ("runs in CI"), and earlier summaries called it clean. | **Fixed** and corrected in the development log. |
| F-5 | Low | **No way to read the audit log without database access** (UC-09), although error messages point administrators to it. | **Fixed.** Admin website **Audit log** page: filters, details, and a **Check integrity** button that walks the hash chain. Reading the log is itself audited. |
| F-6 | Low | **TLS 1.3 was configured but never tested.** | **Fixed:** `tls-check.sh`, in the gate. |
| F-7 | Low | **A vulnerable pip (26.1.1) came with the rebuilt Python environment.** | **Fixed:** upgraded to 26.2.1. |

## Residual risks and recommendations (before real patient data)

| ID | Risk | Recommendation |
|---|---|---|
| R-1 | Whole-slide images (SVS/NDPI/TIFF) can contain a photo of the slide label, and slide de-identification is not built, so slides are not sent to the AI. | Before the Patch-CNN model goes live, remove label and macro images and scrub TIFF text tags. Document it in the model integration guide. |
| R-2 | Password-reset links are written to a local outbox; there is no SMS or e-mail delivery. | Choose a provider (a cost decision for the owner). |
| R-3 | No second factor for administrators. | Add TOTP for the ADMIN role before production. |
| R-4 | Deployment hardening is documented, not provisioned: KMS-held encryption keys, object-storage encryption at rest, database TLS, backups to encrypted storage. | Part of the cloud deployment; see [architecture.md](architecture.md). |
| R-5 | DICOM: burned-in text is detected only from the scanner's own flag, not from the pixels; the "Patient Identity Removed" attribute is not added (the file is edited in place). | Pixel OCR or a de-identification service (for example a DICOM gateway) for production. |
| R-6 | De-identified is not anonymous; a rare combination of values can point to a person. | Share exports only under a data-sharing agreement and ethics approval. |
| R-7 | This is an internal review. | Independent penetration test (OWASP ASVS level 2) before real data. |
| R-8 | Demo accounts and synthetic data exist in development. | Never run `db:seed` against production; the seed marks everything `SYNTHETIC`. |

## Compliance notes

- **Consent and purpose limitation:** AI analysis needs AI consent, and each FHIR export purpose needs its own consent. Patients can withdraw in the app at any time (§3.7.1).
- **Minimum necessary:** the access matrix and separation-of-duties locks keep each role to what it needs; administrators have no routine access to clinical data.
- **Accountability:** every read of clinical data, every export and every refusal is in the hash-chained, append-only audit log, which administrators can read and check.
- **Zambian law:** the proposal names the Electronic Communications and Transactions Act and data-sovereignty requirements. Hosting in-country or in a compliant region, and a legal review, remain deployment decisions for the owner.
