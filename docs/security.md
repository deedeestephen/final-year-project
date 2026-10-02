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
  The FHIR export's rule for each class is in [fhir-export.md](fhir-export.md#de-identification-safe-harbor-nfr-10).
- Data minimisation: responses are shaped per role.

## Audit
- `audit_logs`: append-only (DB trigger rejects UPDATE/DELETE; the app DB role has no UPDATE/DELETE grant). Each row stores
  the previous row's hash (a hash chain) so tampering is detectable. Logins, reads of patient records, modifications,
  AI requests, exports and admin actions are all logged.
- Each entry notes which app sent the request (`details.client`: `mobile` or `web`, from the `X-Client` header).
  This is for statistics only: a caller can set any header, so it never takes part in access decisions.
- The admin **activity dashboard** (`GET /admin/activity`, `audit:read`) shows counts and staff emails only, never
  patient names, NRCs or clinical values. Each view is itself audited (`activity.read`).

## Files
- Streaming upload (busboy) straight to object storage, with a size cap per kind (`MAX_IMAGING_MB`, `MAX_SLIDE_MB`).
  The file type is decided **only by magic bytes**; the file name and declared Content-Type are ignored, and the name
  is never stored (it may contain identifiers). DICOM headers are parsed and the modality must match what was chosen.
- Storage keys are server-generated UUIDs (no user paths). A file is recorded only after every check passed; a file
  that fails is deleted and the rejection is audited (reason only). Downloads are `attachment`, `nosniff`, `no-store`.
- **De-identified copies for the AI (Phase 15):** the original upload is kept for clinicians; the AI only receives a
  copy. DICOM identifying values are overwritten in place at the same length (PS3.15 Annex E attributes relevant here;
  dates keep the year; UIDs get keyed replacements; private attributes blanked; pixels untouched); JPEG/PNG metadata is
  removed. Scans flagged "burned-in annotation", and all slides (label images, R-1), are not sent to the AI, and the
  clinician sees why. See [security-review.md](security-review.md).

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
- **How that is enforced (Phase 13, ADR-009):**
  - Answers are whole reviewed passages, quoted, so there is no generated text; a test checks this.
  - Emergency and self-harm wording gets the fixed urgent-care text. Doses (everyone) and a patient's own results or diagnosis (patients) are declined before anything is looked up.
  - An answer without a source, or with a dose in it, is never shown.
  - Patients never get clinician content.
- **The meaning search (ADR-013):**
  - The MedCPT models run inside the AI service, so questions do not leave it.
  - They are downloaded once, from fixed revisions, and every file is checked against a pinned SHA-256 sum. A file that differs is refused.
  - The model only ranks reviewed passages and can refuse an answer. It writes no text, so it cannot add content.
- **Claude (when `ANTHROPIC_API_KEY` is set, ADR-010):**
  - Claude only gets the reviewed passages found for the question, the last three turns and the question, after e-mail addresses, NRC numbers, phone numbers and long digit strings are removed.
  - It answers through a forced tool call. Safety rules run before it, and the output check runs after it.
  - Every such answer is labelled "Written by AI (Claude)".
  - The key is only in the git-ignored `.env`.
  - Real use needs a data-protection review, because questions are sent to Anthropic in the United States.
- **Chat privacy:**
  - Conversations belong to one account (others get 404) and can be deleted by the owner. MongoDB deletes them automatically after `CHAT_RETENTION_DAYS` (180).
  - The audit log records `chat.asked` with the safety result and the number of sources, never the text.
  - Without a Claude key, questions never leave the system. With one, they go to Anthropic as described above.
  - A limit of `CHAT_MAX_QUESTIONS_PER_HOUR` (30) applies per account, with `Retry-After`.
- **Voice messages and read-aloud (ADR-012):**
  - The microphone permission (`RECORD_AUDIO`) is asked for only when the microphone is first tapped; the app works without it.
  - The app never records, stores or sends sound. The phone's speech service turns speech into text and only the text reaches the app; it then goes through the same safety rules, limits and content-free audit as a typed question.
  - On most Android phones the speech service is Google's, which may process the voice on its servers. The chat's intro says so, and the data-protection review needed before real use (ADR-010) must cover it.
  - Reading aloud uses the phone's own text-to-speech; nothing is sent.
- **Push notifications (ADR-014):**
  - A push carries only the notification's title and text, which never contain clinical values, names or identifiers, plus its id and type. Android is asked to hide the text on a locked phone (`visibility: PRIVATE`).
  - Google (Firebase) receives each phone's push address and the text of each push. The data-protection review before real use must cover it.
  - The Firebase service-account key is a secret: it stays outside the repository (`FCM_SERVICE_ACCOUNT_FILE`), `.gitignore` and the secret scan guard against committing it, and errors about it never repeat its contents. Google's sign-in address must use https; redirects are refused.
  - A phone is registered only by the signed-in account for itself, removed at sign-out and with the account, and forgotten when Firebase no longer knows it. Disabled accounts get no pushes.
  - Push is off unless the key file is set. The app's Firebase settings are public identifiers, not secrets.

## Dependency hygiene
- `npm audit`, `pip-audit`, `flutter pub outdated`, Dependabot in CI.

## Implementation status (updated each phase; "Verified" = automated test passes)

| Control | Where | Status |
|---|---|---|
| Config validated at startup; secrets never echoed in errors | `3-application-logic/backend/src/config/app-config.ts` | Verified (Ph.3) |
| Security headers: HSTS 1y, CSP `default-src 'none'`, `frame-ancestors 'none'`, nosniff, no `X-Powered-By` | `configure-app.ts` (helmet) | Verified (Ph.3, e2e) |
| CORS closed by default, explicit allow-list (required in production). Credentials (the refresh cookie) only for allow-listed origins such as the admin portal | `configure-app.ts` | Verified (Ph.3, e2e; credentials: admin web) |
| Global rate limiting per address (default 600/min) with `429 RATE_LIMITED` + `Retry-After`; health exempt | `@nestjs/throttler` in `app.module.ts` | Verified (Ph.3, e2e) |
| **Per-account rate limit** (default 120/min per signed-in user, after authentication) with `Retry-After`, `X-RateLimit-Limit` and `X-RateLimit-Remaining`; one account cannot slow down others | `gateway/http/user-rate-limit.guard.ts` | Verified (`rate-limit.int-spec.ts`; load test in [scalability.md](scalability.md)) |
| Rate-limit counters shared between API instances in Redis (atomic Lua counter); if Redis is down the API **fails open** and logs a warning at most once a minute | `gateway/http/redis-throttler.storage.ts` | Verified (two instances + unreachable Redis in `rate-limit.int-spec.ts`) |
| Input validation: whitelist + reject unknown properties, typed DTOs, submitted values not echoed | `gateway/http/validation.ts` | Verified (Ph.3, e2e) |
| Input sanitisation: `@IsSafeText()` rejects markup/control characters in free text | `gateway/validation/safe-text.ts` | Verified (Ph.3, unit) |
| Body size limit (default 1 MB) and malformed-JSON handling | `configure-app.ts`, `http-middleware.ts` | Verified (Ph.3, e2e) |
| Central error envelope; no stack traces, SQL or values leaked; DB errors mapped (409/404/400) | `gateway/http/error-mapping.ts`, filter | Verified (Ph.3) |
| Request ids (validated incoming or generated) for tracing | `http-middleware.ts` | Verified (Ph.3) |
| Log redaction of auth headers, cookies, passwords, tokens, identifiers; no query strings logged | `gateway/logging/logger-options.ts` | Verified (Ph.3, unit) |
| AES-256-GCM column encryption + HMAC lookup | `persistence/crypto/field-crypto.ts` | Verified (Ph.2) |
| Append-only, hash-chained audit log | DB migration | Verified (Ph.2) |
| Traversal-proof object keys, write-once objects | `persistence/storage` | Verified (Ph.2) |
| Argon2id hashing (64 MiB, t=3), NIST-style length policy + common-password denylist | `services/auth/password.ts` | Verified (Ph.4) |
| EdDSA access JWT (15 min), algorithm pinned, iss/aud/exp/typ checked; `alg:none`, tampered, foreign-key and expired tokens rejected | `services/auth/token.service.ts` | Verified (Ph.4, unit + integration) |
| Account and session re-checked in the DB on every request (disable/logout effective immediately) | `AuthService.authenticate`, `JwtAuthGuard` | Verified (Ph.4) |
| Opaque refresh tokens (SHA-256 stored), rotated on every use; reuse revokes the whole family and is audited; race-safe conditional update | `AuthService.refresh` | Verified (Ph.4) |
| Lockout after 5 failures (15 min), counter reset on success, lockout audited; it stops new sign-ins only, so wrong passwords typed by someone else cannot end a person's open sessions (review 2026-10-02) | `AuthService.login`, `auth.service.spec.ts` | Verified (Ph.4; sessions: review 2026-10-02) |
| No account enumeration: identical login error for unknown/wrong/disabled accounts, dummy Argon2 verification for timing, forgot-password always 202 | `AuthService` | Verified (Ph.4) |
| Deny-by-default authentication (`@Public()` opt-out) and RBAC permissions guard; denials audited | `gateway/access/*` | Verified (Ph.4) |
| Self-registration creates PATIENT only; role self-assignment and mass assignment rejected | `RegisterDto`, validation pipe | Verified (Ph.4) |
| Temporary passwords must be changed before any other action | `JwtAuthGuard` (`PASSWORD_CHANGE_REQUIRED`) | Verified (Ph.4) |
| Password reset: single-use, 30-min, hashed token; newest link only; all sessions revoked on reset | `AuthService.resetPassword` | Verified (Ph.4) |
| Stricter rate limit on sign-in, registration and password routes (default 10/min). Session refresh is excluded: it presents a 256-bit random token, and the admin portal refreshes on each page load | `AppThrottlerGuard`, `auth.controller.ts` | Verified (Ph.4; refresh exclusion in `auth.int-spec.ts`) |
| **Admin web session:** access token in memory only; refresh token in an HttpOnly, SameSite=Strict, `Secure` (production) cookie scoped to `/api/v1/auth`, never in the response body; cookie only honoured with the `X-Client: web` header (CSRF defence); rotated on every refresh and cleared on sign-out | `services/auth/web-session.ts`, `1-presentation-layer/admin-panel-web/src/api/client.ts` | Verified (`rate-limit.int-spec.ts`; browser check: `document.cookie` cannot see it) |
| Admin portal admits ADMIN accounts only (others are signed out with an explanation); cached admin data is cleared at sign-out; the server still checks every permission (ADR-005) | `1-presentation-layer/admin-panel-web/src/auth/session.tsx`, `App.tsx` | Verified (Vitest) |
| Facility scoping of patient data; records elsewhere reported as 404 so their existence is not revealed | `PatientsService.requireInFacility` | Verified (Ph.5) |
| Patient identifiers encrypted at rest (AES-256-GCM) with HMAC exact-match lookup; national ID masked in API responses | `patients.service.ts`, `persistence/crypto` | Verified (Ph.5) |
| Every patient read, search and change audited without identifiers | patients / clinical services | Verified (Ph.5) |
| Optimistic concurrency: stale writes rejected (`VERSION_CONFLICT`), never silently overwritten | `PatientsService.update` | Verified (Ph.5) |
| Patients can view and withdraw their own consent (unconditional right, proposal §3.7.1) | `consent:withdraw_self` | Verified (Ph.5) |
| App: tokens only in Keystore/Keychain (`flutter_secure_storage`); never logged; cleared on sign-out and when a refresh is refused | `1-presentation-layer/mobile-app/lib/core/storage`, `core/network/api_client.dart` | Verified (Ph.7) |
| App: no secrets compiled in (only `API_BASE_URL`); cleartext HTTP allowed only in **debug** builds and only to 10.0.2.2/localhost | `android/app/src/debug/res/xml/network_security_config.xml` | Verified (Ph.7, build) |
| App: sign-in and forgot-password messages never reveal whether an account exists | `features/auth/presentation` | Verified (Ph.7, widget tests) |
| App: on-device database encrypted with SQLCipher (AES-256); random 256-bit key only in Keystore/Keychain; opening fails if SQLCipher is missing | `1-presentation-layer/mobile-app/lib/core/db/open_database.dart` | Verified (Ph.6, on-device test) |
| App: clinical data on the phone belongs to one user; another user's sign-in wipes it; sign-out wipes it after warning about unsent changes; Android cloud backup disabled | `LocalStore.prepareFor/wipe`, `AndroidManifest.xml` (`allowBackup=false`) | Verified (Ph.6) |
| Sync: every operation re-checked with the same permissions, facility scoping, validation and audit as the REST endpoints; idempotency keys cannot be reused across accounts | `3-application-logic/backend/src/services/sync/sync.service.ts` | Verified (Ph.6) |
| Notifications carry no clinical values, names or identifiers (they may later appear on a lock screen); each user sees and changes only their own (others' ids return 404) | `services/notifications` | Verified (Ph.8) |
| Patients read only their own records (`requireOwn`), audited with counts only | `ClinicalService.listOwnRecords` | Verified (Ph.8) |
| Patient app keeps its last good copy only in the encrypted database, and wipes it at sign-out; server errors are never masked by the copy | `PatientRepository` | Verified (Ph.8) |
| Self-registration: a taken email gets a neutral message in the app (the API's 409 is an accepted Phase 4 trade-off, rate-limited) | `register_account_screen.dart` | Verified (Ph.8) |
| Sign-up phone and NRC/passport stored encrypted (AES-256-GCM) with an HMAC for exact matching; one account per ID number; a duplicate gets the same neutral message as a duplicate email | `auth.service.ts`, `persistence/crypto/identity-document.ts`, migration `…_admin_and_registration_id` | Verified |
| Role permissions editable by administrators, audited with added/removed; locks: ADMIN keeps `user:manage` and `role:manage`, PATIENT may only hold `*_self` permissions; unknown codes rejected | `services/admin` | Verified |
| **Separation of duties (Ph.15):** administration-only permissions cannot be given to clinical or patient roles; clinical-data permissions cannot be given to the administrator role; nobody can add a role to their own account | `AdminService.setRolePermissions`, `UsersService.update` | Verified (`admin.int-spec.ts`) |
| **Access matrix (Ph.15):** every route and its rule, generated from the code; the gate fails on an unlisted public or permission-free route, an administration route open to others, clinical data open to administrators or patients, or a patient route that is not their own | `src/gateway/access/access-matrix.ts`, [access-matrix.md](access-matrix.md) | Verified (gate) |
| **Audit-log viewer (Ph.15):** administrators read the log with filters and check the hash chain from the admin website; reading and checking are themselves audited; a tampered entry is detected | `services/audit/audit-log.*`, admin website Audit log page | Verified (`audit-log.int-spec.ts`, `AuditLogPage.test.tsx`) |
| **De-identified AI inputs (Ph.15):** only de-identified copies of scans reach the AI; slides are held back until slide de-identification exists | `services/imaging/deidentify-files.ts`, `AiService.request` | Verified (unit, `imaging.int-spec.ts`, `ai.int-spec.ts`) |
| **Dependency audits (Ph.15):** npm (including development tools), pip-audit, and OSV for the Dart/Flutter packages | `quality-gate.sh`, `6-infrastructure/scripts/pub-audit.py` | Verified: 0 known vulnerabilities (2026-09-28) |
| Linking a patient account needs an exact NRC match; the admin sees only record number and facility (data minimisation); linking notifies the patient; unlinking ends their sessions; all audited | `AdminService.link/unlink` | Verified |
| Admin password reset issues a one-time password, forces a change and ends all sessions; admins cannot reset their own this way | `UsersService.resetPassword` | Verified |
| Account deletion (2026-09-29): administrators only, never their own account; refused for any account named in the clinical record (patients registered, screenings, consents, uploads, slide reviews, AI requests, synced phone changes), which can only be disabled; sessions, reset links, notifications and chats are removed with the account; a linked patient record is unlinked, not deleted; the audit log keeps its entries and records `user.deleted` without the email | `UsersService.delete` | Verified (`users-and-edges.int-spec.ts`) |
| No official emblems; every sign-in screen says the app is not an official government service (ADR-004, kept by ADR-011) | `lib/shared/app_notice.dart` (`notOfficialNotice`) | Verified |
| Microphone only for voice messages, asked at first use; no sound recorded, stored or sent by the app (ADR-012) | `AndroidManifest.xml`, `features/chat/application/voice_input.dart`, `chat_composer.dart` | Verified (`chat_test.dart`: permission refused, no speech service, cancel) |
| **Push notifications (ADR-014):** notification texts only (no clinical values), hidden on a locked phone; pushed at most once and never for a rolled-back change; phones registered only by their own account, removed at sign-out, with the account, when every session ends (password reset, account disabled or unlinked; review 2026-10-02) and when Firebase forgets them; disabled accounts get none; the service-account key outside Git, never echoed, https-only sign-in, no redirects | `services/notifications/push/*`, `lib/core/push/*` | Verified (`fcm.client.spec.ts`, `push.int-spec.ts`, `push_test.dart`); real Firebase not yet (needs the owner's project) |
| Uploads: streamed (never whole in memory), size cap (413), magic-byte type check (415), DICOM header and modality check (422), server-generated keys, original file name not stored, rejected files deleted and audited | `gateway/upload/*`, `services/imaging` | Verified (Ph.10, `imaging.int-spec.ts`) |
| Imaging and slide reads facility-scoped (other facilities get 404), every list and download audited without identifiers; downloads sent as attachments with `nosniff` | `ImagingService` | Verified (Ph.10) |
| Only technical DICOM fields (UIDs, modality, size) copied to MongoDB; patient name and ID tags never read | `dicom-header.ts` | Verified (Ph.10) |
| Pathologist review: one review per slide (conditional update, 409 on repeat), ISUP grade group computed by the server, Gleason values kept out of the audit details | `ImagingService.review` | Verified (Ph.10) |
| App upload queue: files copied into the app's private storage (never shared folders), deleted after the server accepts them, when removed and at sign-out; a retry reuses the `clientUuid` so nothing is stored twice; the server's checks are unchanged | `1-presentation-layer/mobile-app/lib/core/uploads/upload_queue.dart` | Verified (Ph.9, `upload_queue_test.dart`, widget test) |
| App AI screens: the disclaimer banner always first, mock output labelled; no good/bad colours; explanations shown only when the server has a real one, otherwise its reason; no accuracy figures without stored evaluations | `features/clinical_server/presentation/ai_screens.dart` | Verified (Ph.9, widget test) |
| App routes: consent capture for clinicians only, review for pathologists only (the server checks the same permissions again) | `app/routes.dart` | Verified (Ph.9, `routes_test.dart`) |
| App permissions (merged manifest, 1 October 2026): `INTERNET` and `ACCESS_NETWORK_STATE`; `RECORD_AUDIO` for voice messages, asked at first use (ADR-012); and, from the push plugin (ADR-014), `POST_NOTIFICATIONS` (asked after a patient signs in, Android 13 and later), `WAKE_LOCK` and Google's `c2dm.permission.RECEIVE`. No camera, location, contacts or storage permission; files come from the system file chooser, one file at a time; new permissions only with the feature that needs them | `android/app/src/main/AndroidManifest.xml`, [mobile.md](mobile.md#phone-permissions) | Verified (build) |
| App preferences (`shared_preferences`) hold only the light/dark choice: no personal or clinical data | `features/settings/appearance.dart` | Verified (review, `settings_test.dart`) |
| AI service reachable only with a service token (constant-time comparison); without a configured token it refuses to work (fail closed) | `4-ai-intelligence-layer/ai-services/app/auth.py` | Verified (Ph.11) |
| AI requests need the patient's active `AI_ANALYSIS` consent and a screening record; only a keyed pseudonym (`p_` + HMAC), clinical values and storage keys are sent, never names, IDs, phone numbers or record ids | `AiService.request` | Verified (Ph.11, `ai.int-spec.ts` inspects what is sent) |
| Every AI response is validated against the contract before it is stored or shown; a MOCK result without the exact disclaimer is rejected and the job marked FAILED | `ai-contract.ts`, `4-ai-intelligence-layer/ai-services/app/contract.py` | Verified (Ph.11) |
| Mock model outputs depend only on the job id, never on the patient's values, so they cannot be read as an assessment | `4-ai-intelligence-layer/ai-services/app/providers/mock.py` | Verified (Ph.11, test changes PSA and gets the same number) |
| AI jobs: one at a time per patient, timeout marked TIMED_OUT, requests, completions and report reads audited | `AiService` | Verified (Ph.11) |
| Explanation images from the AI service are checked (real PNG by magic bytes, at most 2 MB) before storage; invalid ones are discarded with a reason; storage references sent by the AI service are refused (they could point at another patient's file) | `AiService.prepareExplanations` | Verified (Ph.12) |
| Explanation images are facility-scoped, audited when viewed, and kept out of the report document (only references) | `AiService.explanationContent` | Verified (Ph.12) |
| Model performance and fairness figures only from a stored evaluation run, otherwise "Evaluation data not yet available." | `AiService.evaluation` | Verified (Ph.12) |
| **FHIR export de-identification (Safe Harbor):** no names, contact details, national ids, record numbers, sub-national places, free text or files; dates reduced to the year and ages from 90 grouped; the database query does not read identifying fields; keyed pseudonyms (HMAC, server key only) | `services/fhir/deidentify.ts`, `fhir-export.service.ts` | Verified (Ph.14, `fhir.int-spec.ts`: one test per identifier class against a patient carrying every identifier) |
| FHIR export only for patients with the consent that matches the purpose (research use / EHR sharing); withdrawn consent excludes the patient; admin-only (`fhir:export`); every export and send audited with counts only | `FhirExportService` | Verified (Ph.14) |
| Development mock AI results are never exported; research-model results are `preliminary` and labelled `AIAST` | `FhirBundleBuilder.addAiReport` | Verified (Ph.14, unit and integration) |
| SmartCare Pro send: Bearer token, timeout, redirects refused (the token cannot leak), https required in production, receiver error text kept out of API answers (audit log only, cleaned and shortened) | `services/fhir/smartcare.client.ts`, `config/app-config.ts` | Verified (Ph.14, `smartcare.client.spec.ts`) |
| FHIR conformance: official HL7 validator, 0 errors on the sample export (codes checked on the HL7 terminology server) | `6-infrastructure/scripts/fhir-validate.sh` | Verified (Ph.14; in the gate when the validator is installed) |
| Secret scan runs locally over the full git history (gitleaks 8.30.1 in the tools folder); reviewed false positives listed one by one in `.gitleaksignore` | `6-infrastructure/scripts/quality-gate.sh` | Verified |
| Reset delivery channel | dev outbox file only; **production needs an SMS/e-mail provider (a cost decision for the owner)** | Open |
| Admin activity dashboard: administrators only (`audit:read`), counts only, every view audited; the `X-Client` label is never used for access | `services/audit/activity.*`, `permissions.guard.ts` | Verified (`activity.int-spec.ts`, access matrix) |
| Log review: no passwords, tokens or patient details in the server or AI logs (production mode, debug level) | `test/workflows/system.workflow-spec.ts` (last test), gate target `workflows` | Verified (Ph.16) |
| Chatbot: quoted answers only, safety rules before look-up, source required, dose check, owner-only conversations with retention, text-free audit, chat limit | `services/chatbot`, `ai-services/app/chat` | Verified (Ph.13: `chat-safety.spec.ts`, `chatbot.int-spec.ts`, `test_chat.py`, workflow 7 incl. log review) |
| TLS 1.3 termination | reverse proxy config; `6-infrastructure/scripts/tls-check.sh` (real nginx in Docker: 1.3 accepted, 1.2 and 1.1 refused, HSTS, HTTP redirect) | Verified (Ph.15, gate) |
