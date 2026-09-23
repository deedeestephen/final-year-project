# Security Design

Derived from the proposal: NFR-01, NFR-10, FR-01, FR-10, and §3.7.2. A control is listed as *implemented* only once a
test demonstrates it (tracked in [requirements-traceability.md](requirements-traceability.md)).

## Authentication
- Passwords: **Argon2id** (`argon2` npm; memory ≥ 64 MiB, t=3, p=1), with a minimum length and a breached/common-password denylist.
- Access JWT: 15 min, signed with EdDSA or RS256 (asymmetric, key id rotation), with `iss`/`aud`/`exp` checked and `alg` pinned.
- Refresh tokens: opaque random values. Only a SHA-256 hash is stored. They are **rotated on every use**, and reuse of an
  old token revokes the whole token family (theft detection).
- Lockout: 5 consecutive failures → a timed lock (UC-01). Unlocking is logged, and login responses don't reveal whether
  the account exists.
- Password reset: single-use hashed token, 30 min expiry, with the same response whether or not the email exists.

## Authorization
- Roles: `PATIENT`, `CLINICIAN`, `PATHOLOGIST` (also covers radiologist review), `ADMIN`. Fine-grained permissions
  (e.g. `patient:read`, `ai:request`) are assigned to roles in the DB.
- The gateway guard checks permissions, and services additionally check **resource scope** (patients belong to a facility;
  patients can only read themselves). Hiding things in the Flutter UI is a convenience, never a control.

## Transport & gateway
- TLS 1.3 only in production, terminated at the reverse proxy (config in `infrastructure/`). HSTS.
- helmet security headers, strict CORS allowlist, body size limits, a global validation pipe with `whitelist` +
  `forbidNonWhitelisted`, and rate limiting (stricter on `/auth/*`) backed by Redis.

## Data protection
- On device: SQLCipher (AES-256) database; its key is generated per install and stored in Android Keystore / iOS Keychain
  via flutter_secure_storage. Tokens are stored in secure storage too, never in shared preferences.
- Server: direct identifiers (name, national ID, phone) are encrypted at column level (AES-256-GCM, app-managed key from
  env/KMS); disks, object storage and backups are encrypted.
- De-identification (Safe Harbour, 18 identifier classes) is applied before data leaves L3 for L4 or for FHIR export.
- Data minimisation: responses are shaped per role.

## Audit
- `audit_logs`: append-only (DB trigger rejects UPDATE/DELETE; the app DB role has no UPDATE/DELETE grant). Each row stores
  the previous row's hash (a hash chain) so tampering is detectable. Logins, reads of patient records, modifications,
  AI requests, exports and admin actions are all logged.

## Files
- Streaming upload with a size cap per modality. MIME is checked by extension, declared type and **magic bytes**; DICOM
  headers are parsed. Storage keys are server-generated UUIDs (no user paths). Uploads are quarantined until validated.

## Secrets
- Secrets only come from environment variables / a secret manager. `.env` is git-ignored and `.env.example` holds
  placeholders only. gitleaks runs in the quality gate and CI.
- Logs: a redaction filter strips `password`, `token`, `authorization`, and patient identifiers.

## AI & chatbot safety
- Every AI output has `provenance` (`MOCK` or `RESEARCH_MODEL`), `modelVersion` and a disclaimer. Mock output is always shown
  with "DEVELOPMENT MOCK DATA — NOT A CLINICAL RESULT."
- Performance metrics are shown only from stored evaluation records; otherwise the UI says "Evaluation data not yet available."
- The chatbot never claims to diagnose, answers only from retrieved sources with citations, and treats retrieved text as
  data, not instructions.

## Dependency hygiene
- `npm audit`, `pip-audit`, `flutter pub outdated`, Dependabot in CI.
