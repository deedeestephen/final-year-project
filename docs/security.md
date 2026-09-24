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
  `forbidNonWhitelisted`, and rate limiting per address, per signed-in account, and stricter on sign-in and password
  routes, with counters shared in Redis. See [scalability.md](scalability.md).

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

## Implementation status (updated each phase; "Verified" = automated test passes)

| Control | Where | Status |
|---|---|---|
| Config validated at startup; secrets never echoed in errors | `backend/src/config/app-config.ts` | Verified (Ph.3) |
| Security headers: HSTS 1y, CSP `default-src 'none'`, `frame-ancestors 'none'`, nosniff, no `X-Powered-By` | `configure-app.ts` (helmet) | Verified (Ph.3, e2e) |
| CORS closed by default, explicit allow-list (required in production). Credentials (the refresh cookie) only for allow-listed origins such as the admin portal | `configure-app.ts` | Verified (Ph.3, e2e; credentials: admin web) |
| Global rate limiting per address (default 600/min) with `429 RATE_LIMITED` + `Retry-After`; health exempt | `@nestjs/throttler` in `app.module.ts` | Verified (Ph.3, e2e) |
| **Per-account rate limit** (default 120/min per signed-in user, after authentication) with `Retry-After`, `X-RateLimit-Limit` and `X-RateLimit-Remaining`; one account cannot slow down others | `common/http/user-rate-limit.guard.ts` | Verified (`rate-limit.int-spec.ts`; load test in [scalability.md](scalability.md)) |
| Rate-limit counters shared between API instances in Redis (atomic Lua counter); if Redis is down the API **fails open** and logs a warning at most once a minute | `common/http/redis-throttler.storage.ts` | Verified (two instances + unreachable Redis in `rate-limit.int-spec.ts`) |
| Input validation: whitelist + reject unknown properties, typed DTOs, submitted values not echoed | `common/http/validation.ts` | Verified (Ph.3, e2e) |
| Input sanitisation: `@IsSafeText()` rejects markup/control characters in free text | `common/validation/safe-text.ts` | Verified (Ph.3, unit) |
| Body size limit (default 1 MB) and malformed-JSON handling | `configure-app.ts`, `http-middleware.ts` | Verified (Ph.3, e2e) |
| Central error envelope; no stack traces, SQL or values leaked; DB errors mapped (409/404/400) | `common/http/error-mapping.ts`, filter | Verified (Ph.3) |
| Request ids (validated incoming or generated) for tracing | `http-middleware.ts` | Verified (Ph.3) |
| Log redaction of auth headers, cookies, passwords, tokens, identifiers; no query strings logged | `common/logging/logger-options.ts` | Verified (Ph.3, unit) |
| AES-256-GCM column encryption + HMAC lookup | `common/crypto/field-crypto.ts` | Verified (Ph.2) |
| Append-only, hash-chained audit log | DB migration | Verified (Ph.2) |
| Traversal-proof object keys, write-once objects | `infrastructure/storage` | Verified (Ph.2) |
| Argon2id hashing (64 MiB, t=3), NIST-style length policy + common-password denylist | `modules/auth/password.ts` | Verified (Ph.4) |
| EdDSA access JWT (15 min), algorithm pinned, iss/aud/exp/typ checked; `alg:none`, tampered, foreign-key and expired tokens rejected | `modules/auth/token.service.ts` | Verified (Ph.4, unit + integration) |
| Account and session re-checked in the DB on every request (disable/logout effective immediately) | `AuthService.authenticate`, `JwtAuthGuard` | Verified (Ph.4) |
| Opaque refresh tokens (SHA-256 stored), rotated on every use; reuse revokes the whole family and is audited; race-safe conditional update | `AuthService.refresh` | Verified (Ph.4) |
| Lockout after 5 failures (15 min), counter reset on success, lockout audited | `AuthService.login` | Verified (Ph.4) |
| No account enumeration: identical login error for unknown/wrong/disabled accounts, dummy Argon2 verification for timing, forgot-password always 202 | `AuthService` | Verified (Ph.4) |
| Deny-by-default authentication (`@Public()` opt-out) and RBAC permissions guard; denials audited | `modules/access/*` | Verified (Ph.4) |
| Self-registration creates PATIENT only; role self-assignment and mass assignment rejected | `RegisterDto`, validation pipe | Verified (Ph.4) |
| Temporary passwords must be changed before any other action | `JwtAuthGuard` (`PASSWORD_CHANGE_REQUIRED`) | Verified (Ph.4) |
| Password reset: single-use, 30-min, hashed token; newest link only; all sessions revoked on reset | `AuthService.resetPassword` | Verified (Ph.4) |
| Stricter rate limit on sign-in, registration and password routes (default 10/min). Session refresh is excluded: it presents a 256-bit random token, and the admin portal refreshes on each page load | `AppThrottlerGuard`, `auth.controller.ts` | Verified (Ph.4; refresh exclusion in `auth.int-spec.ts`) |
| **Admin web session:** access token in memory only; refresh token in an HttpOnly, SameSite=Strict, `Secure` (production) cookie scoped to `/api/v1/auth`, never in the response body; cookie only honoured with the `X-Client: web` header (CSRF defence); rotated on every refresh and cleared on sign-out | `modules/auth/web-session.ts`, `admin-web/src/api/client.ts` | Verified (`rate-limit.int-spec.ts`; browser check: `document.cookie` cannot see it) |
| Admin portal admits ADMIN accounts only (others are signed out with an explanation); cached admin data is cleared at sign-out; the server still checks every permission (ADR-005) | `admin-web/src/auth/session.tsx`, `App.tsx` | Verified (Vitest) |
| Facility scoping of patient data; records elsewhere reported as 404 so their existence is not revealed | `PatientsService.requireInFacility` | Verified (Ph.5) |
| Patient identifiers encrypted at rest (AES-256-GCM) with HMAC exact-match lookup; national ID masked in API responses | `patients.service.ts`, `common/crypto` | Verified (Ph.5) |
| Every patient read, search and change audited without identifiers | patients / clinical services | Verified (Ph.5) |
| Optimistic concurrency: stale writes rejected (`VERSION_CONFLICT`), never silently overwritten | `PatientsService.update` | Verified (Ph.5) |
| Patients can view and withdraw their own consent (unconditional right, proposal §3.7.1) | `consent:withdraw_self` | Verified (Ph.5) |
| App: tokens only in Keystore/Keychain (`flutter_secure_storage`); never logged; cleared on sign-out and when a refresh is refused | `mobile/lib/core/storage`, `core/network/api_client.dart` | Verified (Ph.7) |
| App: no secrets compiled in (only `API_BASE_URL`); cleartext HTTP allowed only in **debug** builds and only to 10.0.2.2/localhost | `android/app/src/debug/res/xml/network_security_config.xml` | Verified (Ph.7, build) |
| App: sign-in and forgot-password messages never reveal whether an account exists | `features/auth/presentation` | Verified (Ph.7, widget tests) |
| App: on-device database encrypted with SQLCipher (AES-256); random 256-bit key only in Keystore/Keychain; opening fails if SQLCipher is missing | `mobile/lib/core/db/open_database.dart` | Verified (Ph.6, on-device test) |
| App: clinical data on the phone belongs to one user; another user's sign-in wipes it; sign-out wipes it after warning about unsent changes; Android cloud backup disabled | `LocalStore.prepareFor/wipe`, `AndroidManifest.xml` (`allowBackup=false`) | Verified (Ph.6) |
| Sync: every operation re-checked with the same permissions, facility scoping, validation and audit as the REST endpoints; idempotency keys cannot be reused across accounts | `backend/src/modules/sync/sync.service.ts` | Verified (Ph.6) |
| Notifications carry no clinical values, names or identifiers (they may later appear on a lock screen); each user sees and changes only their own (others' ids return 404) | `modules/notifications` | Verified (Ph.8) |
| Patients read only their own records (`requireOwn`), audited with counts only | `ClinicalService.listOwnRecords` | Verified (Ph.8) |
| Patient app keeps its last good copy only in the encrypted database, and wipes it at sign-out; server errors are never masked by the copy | `PatientRepository` | Verified (Ph.8) |
| Self-registration: a taken email gets a neutral message in the app (the API's 409 is an accepted Phase 4 trade-off, rate-limited) | `register_account_screen.dart` | Verified (Ph.8) |
| Sign-up phone and NRC/passport stored encrypted (AES-256-GCM) with an HMAC for exact matching; one account per ID number; a duplicate gets the same neutral message as a duplicate email | `auth.service.ts`, `common/crypto/identity-document.ts`, migration `…_admin_and_registration_id` | Verified |
| Role permissions editable by administrators, audited with added/removed; locks: ADMIN keeps `user:manage` and `role:manage`, PATIENT may only hold `*_self` permissions; unknown codes rejected | `modules/admin` | Verified |
| Linking a patient account needs an exact NRC match; the admin sees only record number and facility (data minimisation); linking notifies the patient; unlinking ends their sessions; all audited | `AdminService.link/unlink` | Verified |
| Admin password reset issues a one-time password, forces a change and ends all sessions; admins cannot reset their own this way | `UsersService.resetPassword` | Verified |
| No official emblems; every sign-in screen says the app is not an official government service (ADR-004) | `NationalStripe.notOfficial` | Verified |
| Reset delivery channel | dev outbox file only; **production needs an SMS/e-mail provider (a cost decision for the owner)** | Open |
| TLS 1.3 termination | reverse proxy config | Planned (Ph.15) |
