# Requirements Traceability Matrix

Source: research proposal §3.4 (use cases, FR, NFR), §3.3 (architecture), §3.7 (ethics). Status values:
`Planned` → `In progress` → `Implemented` (code exists) → `Verified` (tests pass). Nothing is marked Verified without a passing test.

## Functional requirements

| ID | Requirement (summary) | Component | Implementation | Test | Phase | Status |
|---|---|---|---|---|---|---|
| FR-01 | JWT auth + RBAC for 4 roles; lockout after 5 failed logins | L2/L3 auth | `modules/auth`, `modules/access` (JwtAuthGuard, PermissionsGuard), `modules/users` | `test/db/auth.int-spec.ts` (25 tests), `token.service.spec.ts`, `password.spec.ts` | 4 | **Verified** |
| FR-02 | Capture/transmit demographics, PSA, DRE, history encrypted over TLS 1.3 | L1 forms, L3 clinical | `backend/src/modules/{patients,clinical}`; app forms Ph.9 | `test/db/patients.int-spec.ts`, `users-and-edges.int-spec.ts` | 5, 9 | **Backend Verified**; app Ph.9; TLS Ph.15 |
| FR-03 | Full offline entry, AES-256 SQLite cache, conflict-resolving sync | L1 sync, L3 sync | `mobile/lib/core/{db,sync}`, `backend/src/modules/sync` | `backend/test/db/sync.int-spec.ts`, `mobile/test/core/sync_test.dart`, `mobile/test/features/patients/patients_flow_test.dart`, on-device `mobile/integration_test/app_flow_test.dart` | 6 | **Verified** |
| FR-04 | Accept & validate DICOM MRI/TRUS/CT, archive, queue for CNN | L3 imaging, L5 object store | backend/modules/imaging | upload validation tests | 10 | Planned |
| FR-05 | PCa probability + Gleason grade group ≤3 s P95 | L4 + broker | ai-services router, backend ai-broker | contract tests; latency measured in Ph.17 | 11, 17 | Planned (target, not claimed) |
| FR-06 | Grad-CAM for CNN outputs, SHAP for ANN outputs | L4 explainability | ai-services/explain | artifact tests | 12 | Planned |
| FR-07 | RAG chatbot, ≤2 s, English/Bemba/Nyanja | L4 RAG + L3 chatbot | ai-services/rag, backend/modules/chatbot | retrieval/safety/multilingual tests | 13 | Planned |
| FR-08 | Render AI report: probability, Gleason, heatmap, CI, recommendations | L1 report viewer | mobile/features/ai_report | widget tests | 9 | Planned |
| FR-09 | De-identified FHIR R4 JSON export (SmartCare Pro) | L3 fhir | backend/modules/fhir | serialization tests | 14 | Planned |
| FR-10 | Immutable timestamped audit log of access/modify/AI/export | L3 audit, L5 | DB layer: `prisma/migrations/*_constraints_and_audit` (append-only triggers + SHA-256 chain + `audit_logs_verify_chain()`); `modules/audit/audit.service.ts` writes auth, access-denied and user-admin events (fail-closed) | `postgres.int-spec.ts` › audit log; `auth.int-spec.ts` | 2, 4 | **Verified** for auth/admin events; clinical, AI and export events as those modules land |
| FR-11 | Disaggregated AI metrics (age, region, stage) | L4 fairness | ai-services/fairness | unit tests; shows "Evaluation data not yet available" | 12 | Planned |
| FR-12 | Retraining support, model registry, A/B before promotion | L4 registry | ai-services/registry, ai_models table | registry tests | 11 | Planned (registry only; retraining pipeline documented) |

## Use cases

| UC | Name | Covered by | Status |
|---|---|---|---|
| UC-01 | Registration & authentication | FR-01 | **Verified:** backend (Ph.4); app sign-in, forced password change, forgot password, sign-out and session expiry (Ph.7, `mobile/test/widget_test.dart`, live check `test/live`). Self-registration screen with patient onboarding in Ph.8 |
| UC-02 | Offline clinical data capture | FR-02, FR-03 | **Verified (Ph.6):** register patients and add PSA/DRE/PI-RADS records offline; queued, synced idempotently, conflicts shown for the user to resolve; checked on the Galaxy S9+ (Android 10) emulator against the live backend. Richer clinical forms (symptoms, history) Ph.8 |
| UC-03 | Imaging upload & validation | FR-04 | Planned |
| UC-04 | Histopathology slide submission | Phase 10 (WSI) + Phase 11 Patch-CNN provider | Planned |
| UC-05 | AI multi-modal analysis | FR-05 | Planned |
| UC-06 | Diagnostic report delivery | FR-08 | Planned |
| UC-07 | Chatbot interaction | FR-07 | Planned |
| UC-08 | National EHR export | FR-09 | Planned |
| UC-09 | Administration & RBAC | FR-01, FR-10, `modules/users` | **Partial:** user lifecycle, role assignment, unlock and audit Verified; audit-log viewer Ph.15 |
| UC-10 | Infrastructure monitoring | Prometheus `/metrics` endpoint; Grafana documented | Planned (partial) |
| UC-11 | Population analytics | de-identified aggregate report endpoint | Planned (stretch) |
| UC-12 | Model retraining & deployment | FR-12 | Planned (partial) |

## Non-functional requirements

| ID | Target | How it is addressed / verified | Status |
|---|---|---|---|
| NFR-01 | AES-256 at rest, TLS 1.3, RBAC at gateway | **Partial (Ph.2):** AES-256-GCM column encryption `src/common/crypto/field-crypto.ts` (unit-tested; tamper/wrong-key rejected); RBAC catalogue `src/modules/access/permissions.ts` (tested). Ph.6: SQLCipher (AES-256) database on the device, key in Android Keystore (on-device test checks `cipher_version`). Remaining: pgcrypto field encryption for identifiers + encrypted volumes/object storage SSE; TLS 1.3 at reverse proxy (config tested); RBAC guard | Planned |
| NFR-02 | ≤3 s P95 inference | Measured in Ph.17 with real/mock providers; reported honestly | Research target |
| NFR-03 | ≥99.5% uptime | Not measurable in prototype; health checks + restart policies only | Research target |
| NFR-04 | SUS ≥75 | Requires UAT with participants (out of dev scope) | Research target |
| NFR-05 | ≥500 concurrent users | Stateless API instances, Redis-shared rate limits (per address and per account), server-side paging, trigram search indexes, app backoff honouring `Retry-After`. Preliminary load test on the development laptop in [scalability.md](scalability.md) (single instance, about 300 signed-in requests/s); formal test with realistic traffic in Ph.17 | **Partial** (design + preliminary measurement) |
| NFR-06 | HL7 FHIR R4 | FR-09 | Planned |
| NFR-07 | ≥80% test coverage | Coverage reports per package in CI | Planned |
| NFR-08 | Complete offline data entry | FR-03 | **Verified for patient registration and screening records (Ph.6)**; offline start with the cached profile; later clinical features reuse the same outbox |
| NFR-09 | 100% explainability coverage | Every AI report has a Grad-CAM/SHAP artifact or an explicit "unavailable" reason | Planned |
| NFR-10 | Safe Harbour de-identification | Ph.2: identifiers encrypted + HMAC lookup (tested). Remaining: de-identification service before AI + export; tests over all 18 identifier classes | Planned |
| NFR-11 | WCAG 2.1 AA | contrast-checked tokens, semantics labels, text scaling, 48dp targets; Flutter accessibility guideline tests | **Partial (Ph.7):** every token text pair ≥ 4.5:1, body ≥ 15 px, 48 dp targets, 52 px inputs (`theme_test.dart`); states in words, not colour alone; live regions for errors. Remaining: guideline tests per screen, text-scaling checks |

## Ethics / compliance (§3.7)

| Requirement | Implementation | Status |
|---|---|---|
| Informed consent tracking, withdrawal | `/patients/:id/consents` (grant/list/withdraw), `/patients/me/consents` (patient self-view and withdrawal) | **Verified (Ph.5)**; `hasActiveConsent` gates AI analysis in Ph.11 |
| Data minimisation, role-limited access | DTO field selection per role, facility scoping | Planned |
| Fairness monitoring (AUC gap > 0.05 flag) | ai-services/fairness | Planned |
| Data residency | Documented deployment constraint | Documented |
| No fabricated results | Provenance field + mock banner everywhere | **Partial (Ph.2):** Mongo `ai_reports` validator requires `provenance ∈ {MOCK, RESEARCH_MODEL}` + disclaimer (tested); `ai_models.evaluation` only from stored runs |

## Phase 2 additions (database foundation)

| Requirement | Implementation | Test | Status |
|---|---|---|---|
| Relational store for users, patients, clinical, consent, audit (§3.3 L5) | `backend/prisma/schema.prisma`, 2 migrations | `postgres.int-spec.ts` (tables, triggers, migrate-from-clean) | Verified |
| Clinical value integrity (PSA, PI-RADS, Gleason, ISUP) | CHECK constraints | `postgres.int-spec.ts` › constraints | Verified |
| Large files outside the RDBMS (DICOM/WSI) | `ObjectStorage` (local + S3/MinIO), server-generated keys | `object-storage.spec.ts`, `document-and-object-stores.int-spec.ts` | Verified |
| Document store for AI reports, chatbot logs | `src/infrastructure/mongo/collections.ts` + validators | `document-and-object-stores.int-spec.ts` | Verified |
| Vector DB for RAG (§3.3.5) | `VectorStore` (memory + Qdrant) | `memory-vector-store.spec.ts`, Qdrant int test | Verified |
| Idempotent sync storage (UC-02) | `sync_operations.idempotency_key` unique | `postgres.int-spec.ts` | Verified |
| Synthetic-only seed data | `prisma/seed.ts` (`is_synthetic`) | `postgres.int-spec.ts` › seed | Verified |
| Password hashing Argon2id | seed uses argon2id m=64MiB t=3 p=1 | `postgres.int-spec.ts` › seed | Verified (auth flow: Ph.4) |

## Phase 3 additions (API gateway foundation, Layer 2)

| Requirement (proposal §3.3 L2) | Implementation | Test | Status |
|---|---|---|---|
| OpenAPI 3.0 RESTful endpoints, API versioning | `/api/v1` URI versioning; `src/openapi.ts`; committed `docs/api/openapi.json` (CI checks it is current) | `app.e2e-spec.ts` › OpenAPI, routing | Verified |
| Input payload validation & sanitisation | global ValidationPipe; `@IsSafeText` | `app.e2e-spec.ts` › validation; `safe-text.spec.ts` | Verified |
| Rate limiting & throttling | ThrottlerGuard (global) | `app.e2e-spec.ts` › rate limiting | Verified |
| CORS policy | allow-list, closed by default | `app.e2e-spec.ts` › CORS | Verified |
| Centralised error handling | `AllExceptionsFilter` + `toErrorBody` | `error-mapping.spec.ts`, e2e | Verified |
| Security headers | helmet (HSTS, CSP) | e2e › security headers | Verified |
| Health / readiness (UC-10 basis) | `/api/v1/health`, `/api/v1/health/ready` | unit, e2e, real-DB integration | Verified |
| AI layer isolated behind a contract (§3.3.1) | `docs/api/ai-contract.yaml` v0 (frozen) | contract tests in Ph.11 | Specified |
| JWT authentication middleware, RBAC enforcement | — | — | Planned (Ph.4) |
| TLS 1.3 | reverse proxy | — | Planned (Ph.15) |

## Phase 4 additions (authentication & authorisation)

| Requirement | Implementation | Test | Status |
|---|---|---|---|
| JWT authentication middleware (L2) | global `JwtAuthGuard`, deny by default | `auth.int-spec.ts` › access tokens | Verified |
| RBAC enforcement at the gateway (L2, NFR-01) | global `PermissionsGuard` + permission catalogue | `auth.int-spec.ts` › role-based access control | Verified |
| Lockout after 5 failures (UC-01) | `AuthService.login` | `auth.int-spec.ts` › login | Verified |
| Session tokens expire and can be revoked (UC-01) | 15-min access JWT, refresh rotation, logout, family revocation | `auth.int-spec.ts` › sessions | Verified |
| Password reset architecture | hashed single-use tokens + `ResetDelivery` interface | `auth.int-spec.ts` › password reset | Verified (delivery channel: development only) |
| Admin user lifecycle (UC-09) | `/api/v1/users` (list/get/create/update, unlock, disable) | `auth.int-spec.ts` › administrator tests | Verified |

## Phase 5 additions (patients, clinical data, consent)

| Requirement | Implementation | Test | Status |
|---|---|---|---|
| Patient registration & profiles (UC-02) | `/api/v1/patients` (create, search by national ID/MRN, get, update), `/patients/me` | `patients.int-spec.ts` | Verified |
| PSA, free PSA, DRE, PI-RADS, volume, biopsy history, symptoms, notes (§3.3.3 module 3 inputs) | `/patients/:id/clinical-records`, derived PSA density and free/total ratio | `patients.int-spec.ts` › clinical records | Verified |
| Patient history | clinical records newest first; `/clinical-records/:id` | same | Verified |
| Identifier encryption + exact lookup (NFR-01, NFR-10) | `FieldCrypto` (AES-256-GCM) + HMAC national-ID lookup; national ID masked in responses | `patients.int-spec.ts` › registration and storage | Verified |
| Facility scoping / data minimisation | `PatientsService.requireInFacility` (other facilities → 404); admins have no clinical access | `patients.int-spec.ts` › access control | Verified |
| Audit of data access (FR-10) | `patient.read`, `patient.search`, `clinical_record.*`, `consent.*` events without identifiers | `patients.int-spec.ts` | Verified |

## Phase 7 additions (Flutter app foundation)

| Requirement | Implementation | Test | Status |
|---|---|---|---|
| Role-based app shells for the four roles (§3.3.2 L1) | `app/routes.dart` `resolveRedirect`, `features/home/role_home_screen.dart` | `routes_test.dart`, `widget_test.dart` | Verified (destinations filled in later phases) |
| Tokens only in secure storage; cleared on sign-out and refused refresh (NFR-01) | `SecureTokenStore`, `AuthRepository.logout`, `ApiClient.refreshSession` | `api_client_test.dart`, `session_test.dart` | Verified |
| Token rotation handled by the client | `_AuthInterceptor` (single-flight refresh, one retry) | `api_client_test.dart`, live test | Verified |
| AI output always carries a disclaimer; mock output labelled (§3.7) | `AiDisclaimerBanner` | `widgets_test.dart` | Verified (widget); used on AI screens from Ph.10 |
| Offline awareness in the UI (NFR-08 groundwork) | `ConnectivityService`, `OfflineBanner`, `SyncStatusBadge` | `widget_test.dart`, `widgets_test.dart` | Verified (queue and sync added in Ph.6) |

## Phase 6 additions (offline-first sync)

| Requirement | Implementation | Test | Status |
|---|---|---|---|
| Batch sync with idempotency keys (FR-03) | `POST /api/v1/sync`; results stored in `sync_operations`; retries return the stored result | `sync.int-spec.ts` › replay | Verified |
| Conflict detection, never silent overwrite (FR-03) | `baseVersion` → `CONFLICT` with the server copy; app keeps both and asks the user | `sync.int-spec.ts`, `sync_test.dart` › conflicts, `patients_flow_test.dart` | Verified |
| Per-operation access control | each operation needs its own permission (e.g. pathologists cannot register); facility scoping as in REST | `sync.int-spec.ts` | Verified |
| Pull changes for offline reading | `GET /api/v1/sync/changes` with an opaque cursor (patients + records of the caller's facility) | `sync.int-spec.ts` › pull, `sync_test.dart` › pull | Verified |
| Encrypted on-device storage (NFR-01) | Drift + SQLCipher, random 256-bit key in Keystore/Keychain | on-device `integration_test/app_flow_test.dart` (asserts `cipher_version`) | Verified on emulator |
| Retry with exponential backoff | 2 s doubling, max 15 min, jitter; "Sync now" overrides | `sync_test.dart` | Verified |
| Device data belongs to one user | another user signing in wipes the previous user's data; sign-out wipes after warning about unsent changes | `sync_test.dart`, `session_test.dart`, `patients_flow_test.dart` | Verified |
| Runs on the target phone class | Galaxy S9+ hardware profile, Android 10 (API 29) emulator; the owner's SM-G965U connects by USB (`scripts/phone-usb.ps1`) | on-device integration test | Verified on emulator |

## Phase 8 additions (patient workflow)

| Requirement | Implementation | Test | Status |
|---|---|---|---|
| Patient portal (§3.3.2 L1): home, results, education, messages, profile | `mobile/lib/features/patient/**` (tab shell `/me/...`) | `test/features/patient/patient_app_test.dart`; on-device `integration_test/app_flow_test.dart` (patient flow) | Verified on the S9+ emulator |
| Patients read their own screening history | `GET /api/v1/patients/me/clinical-records` (`clinical:read_self`), audited `clinical_record.read_self` | `backend/test/db/notifications.int-spec.ts` | Verified |
| In-app notifications (push engine groundwork) | `modules/notifications`: list, unread count, mark read, mark all; created on new record (REST and sync) and on consent grant/withdrawal; no values or names in the text | `notifications.int-spec.ts` | Verified (push delivery: later, needs a provider decision) |
| Consent self-withdrawal in the app (§3.7.1) | Profile › My consents, confirmation that explains the effect | `patient_app_test.dart`, on-device test | Verified |
| Patient self-registration (UC-01) | Create account screen → `POST /auth/register` | `patient_app_test.dart` | Verified; clinic-side linking Ph.9 |
| Patient education (FR-07 groundwork) | bundled, sourced English library; Bemba/Nyanja disabled until human-verified | `patient_app_test.dart` | English Verified; chatbot Ph.13; translations pending the owner |
| Report viewer (FR-08) | Profile › My reports: empty state until reports are released | `patient_app_test.dart` | Shell only; content Ph.10–11 |

## Administration, identity at sign-up and national theme

| Requirement | Implementation | Test | Status |
|---|---|---|---|
| UC-09: administrators manage accounts and roles | Admin **web app** (`admin-web/`, ADR-005): search, roles, facility, disable, unlock, one-time password reset; `POST /users/:id/reset-password`, `GET /users?q=&role=` | `backend/test/db/admin.int-spec.ts`, `admin-web/src/App.test.tsx`, browser check at desktop, tablet and phone widths | Verified |
| Editable role permissions with safety locks | `GET /admin/roles`, `PUT /admin/roles/:name/permissions`, `POST /admin/roles/:name/reset`; `roles.customised` kept by the seed | `admin.int-spec.ts` (immediate effect, audit, seed keeps edits, lock-out and patient locks) | Verified |
| Giving patients access to their own data | `POST /admin/patient-accounts/:id/match|link|unlink` (NRC HMAC match; `patient_account:link`) + notification | `admin.int-spec.ts`, `admin-web/src/App.test.tsx` (match → confirm → link; no-match message) | Verified |
| Patient sign-up with phone and NRC or passport | `RegisterDto` + `users.phone_enc`, `id_number_enc`, `id_number_hmac` (unique) | `admin.int-spec.ts`, `patient_app_test.dart` | Verified |
| Zambian national colours (owner request) | ADR-004; tokens + `NationalStripe`; not-an-official-service notice | `theme_test.dart` (AA contrast), `widgets_test.dart` | Verified |

## Admin web app, rate limits and scalability

| Requirement | Implementation | Test | Status |
|---|---|---|---|
| Administration separate from the mobile app, on the desktop, responsive (owner request) | `admin-web/` (React 19 + TypeScript, ADR-005); sidebar ≥ 900 px, Menu button below, tables become cards below 700 px; the app shows "Administration is on the web" | `admin-web/src/App.test.tsx` (17 Vitest tests incl. client); Edge at 1440, 820 and 375 px: no horizontal scrolling, all pages | Verified |
| Secure browser session (NFR-01) | HttpOnly SameSite=Strict refresh cookie for `X-Client: web`; access token in memory; single-flight refresh | `rate-limit.int-spec.ts` (cookie login, rotation, reuse, logout; mobile body token unchanged), `client.test.ts` | Verified |
| Per-user rate limit so no user can overload the system (owner request) | `UserRateLimitGuard` (120/min per account) after authentication; per-address limit 600/min; `Retry-After` + `X-RateLimit-*` headers | `rate-limit.int-spec.ts`; load test C in [scalability.md](scalability.md) (exactly 120 of about 15,000 requests passed) | Verified |
| Limits shared across API instances (horizontal scaling) | `RedisThrottlerStorage` (atomic Lua counter), fail-open if Redis is down | `rate-limit.int-spec.ts` (two instances, one Redis; unreachable Redis) | Verified |
| Clients back off under load | App `SyncEngine` waits `max(backoff, Retry-After)`; portal shows the wait time and never auto-retries 4xx | `sync_test.dart` (Retry-After), `App.test.tsx` (rate-limit message) | Verified |
| Fast search with many accounts | `pg_trgm` GIN indexes on user email and name (migration `20260924150000_user_search_trgm`) | migration applied in the DB test run | Verified |

