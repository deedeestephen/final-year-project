# Development Log

## 2026-09-23 — Phase 0: Project analysis

**Objective:** Understand the specification and environment, and produce the planning documents. No application code yet.

**Inputs analysed**
- Research proposal (docx → text in `docs/source/research-proposal.txt`): 12 use cases, FR-01–FR-12, NFR-01–NFR-11,
  six-layer architecture, AI modules, RAG chatbot, ethics framework, testing plan.
- Two candidate design systems (`docs/design/`).

**Environment discovered (Windows 11)**
| Tool | Version | Note |
|---|---|---|
| Flutter / Dart | 3.35.2 / 3.9.0 | `flutter --version` / `flutter doctor` hung for over 3 min; investigate in Phase 1 |
| Android SDK | present | |
| Java | Temurin JDK 25 | Android Gradle may need JDK 17/21; check in Phase 1 |
| Node | 24.15.0 | OK for NestJS |
| Python | 3.14.5 | Some ML wheels (PyTorch) may lag 3.14; plan a 3.12 venv/container for ai-services |
| Git | 2.51 | |
| Docker | **missing** | Blocks Phase 2 (Postgres, Mongo, Redis, MinIO, Qdrant) |
| gh CLI | missing | Optional |

**Files created:** architecture.md, development-plan.md, requirements-traceability.md, testing-strategy.md,
security.md, ADR-001/002/003, this log.

**Decisions:** Flutter (ADR-001, owner). Design Option 2 with Option 1 legibility rules (ADR-002, proposed).
NestJS + FastAPI (ADR-003, proposed).

**Tests:** none yet (documentation phase).

**Unresolved:** Docker install; confirmation of ADR-002/003; whether a paid LLM API may be used for the chatbot;
GitHub repository for cloud sessions.

**Next:** Phase 1, repository skeleton, docker-compose, CI, smoke tests.

## 2026-09-23 — Phase 1: Repository and development environment

**Objective:** Monorepo skeleton, dev environment config, CI, a quality gate, and a first automated test in each package.

**Context:** The project moved to `C:\Users\deede\OneDrive\Desktop\Final Year Project\pca-mhealth` (owner request). Parts of
this phase (ai-services `app/main.py`, `.env.example`, `infrastructure/docker-compose.yml`, `scripts/quality-gate.*`,
`.github/workflows/ci.yml`, the mobile placeholder app) were written by a parallel Claude session. They were reviewed by the lead
session and accepted with the fixes below. Going forward, one lead session owns this folder.

**Toolchain:** Flutter pointed at Android Studio Quail 2026.1.3 (`Android Studio3`) and its bundled JDK 25.0.2
(`flutter config --android-studio-dir/--jdk-dir`). JDK 25 needs Gradle ≥ 9.1, so `mobile/android` uses Gradle 9.1.0 (bin),
AGP 8.13.0 and Kotlin 2.2.20 instead of the Flutter 3.35 template defaults (Gradle 8.12 / AGP 8.9.1 / Kotlin 2.1.0).

**Files created:** `backend/` (NestJS 11: `configure-app.ts` with `/api` prefix + URI versioning, `modules/health`),
`ai-services/` (FastAPI, `/v1/health` reporting `development-mock`), `mobile/` (Flutter, org `zm.ac.zcas`), `.env.example`,
`infrastructure/docker-compose.yml` (Postgres 16, Mongo 7, Redis 7, MinIO, Qdrant; localhost-only ports),
`scripts/quality-gate.sh|.ps1`, `.github/workflows/ci.yml`.

**Tests:** backend 2 unit + 3 e2e; ai-services 2; mobile 1 widget test.

**Errors and fixes**
| Problem | Root cause | Fix |
|---|---|---|
| `flutter doctor` hung | Flutter's global lock was held by an Android Studio `flutter create` | Stopped only our own waiting process |
| Gradle wrapper download aborted | Network drop on the large `-all` zip | Switched to `gradle-9.1.0-bin` |
| Jest "Failed to write coverage reports" | Space in "Final Year Project" became `%20` in the HTML report's paths | Reporters set to text/json-summary/lcovonly |
| No coverage enforcement | Jest had no threshold | Added global 80% threshold (NFR-07). It exposed an untested `configure-app.ts`, now unit-tested (100%) |
| pip-audit: 4 CVEs | Outdated `pip` bundled in the venv | Upgraded pip; CI upgrades pip before install |
| Caches would be committed | `.gitignore` gaps | Ignored mypy/ruff/pytest caches, egg-info, `var/`, Gradle files |
| Floating image tags | `minio:latest`, `qdrant:latest` | Pinned versions |

**Quality gate:** backend PASS (format, lint, types, unit + e2e, build, npm audit 0 vulns). ai-services PASS (ruff, mypy
strict, pytest 100% coverage, pip-audit). mobile PASS (format, analyze, widget test, `flutter build apk --debug` in 318 s with JDK 25 + Gradle 9.1).

**Known non-blocking issues**
- Only Python 3.14 is installed. PyTorch and other ML wheels may need 3.12 (CI already uses 3.12); revisit in Phase 11.
- Starlette deprecation warning (httpx TestClient). Harmless for now; revisit when upgrading test tooling.
- gitleaks isn't installed locally (it runs in CI).
- The project lives under OneDrive, so exclude `node_modules`, `.venv`, `build`, `.dart_tool` from sync, or expect lock errors.
- Docker is not installed. **Blocks Phase 2.**

**Next:** Phase 2, database foundation (needs Docker Desktop).

## 2026-09-23/24 — Phase 2: Database foundation

**Objective:** PostgreSQL schema and migrations, MongoDB collections, object-storage and vector-store abstractions, and a reproducible, tested database setup.

**Environment:** Docker Desktop 4.92 (engine 29.8) with WSL 2.7.14. The first installer in Downloads was the ARM64 build, but this PC is an Intel i5-1135G7, so the AMD64 installer was downloaded (signature verified: Docker Inc) and installed by the owner. Docker Desktop had started before WSL was ready and was stuck on "wsl is not installed"; a clean restart fixed it. `minio/minio` is no longer published on Docker Hub, so MinIO is pinned by digest from quay.io. The owner has a MongoDB Windows service on 27017, so the project Mongo uses host port **27018** (`MONGO_PORT`). The repo now has a GitHub remote (`deedeestephen/final-year-project`).

**Files created:** `backend/prisma/schema.prisma` (19 tables), `prisma/migrations/*_init`, `*_constraints_and_audit` (CHECKs, append-only audit triggers, SHA-256 hash chain, verify function), `prisma/seed.ts`, `prisma.config.ts`, `src/common/crypto/field-crypto.ts`, `src/modules/access/permissions.ts`, `src/infrastructure/{mongo,storage,vector}/*`, `test/jest-db.json`, `test/db/*`, `scripts/gen-keys.mjs`, `docs/database.md`.
**Files modified:** `infrastructure/docker-compose.yml`, `.env.example`, `.gitignore`, `backend/package.json` (scripts, coverage split, `deepmerge-ts` override), `backend/eslint.config.mjs`, `scripts/quality-gate.sh` (`db` target), `.github/workflows/ci.yml` (`database` job).

**Tests:** unit 38 (crypto 9, RBAC 5, storage 16, vector 6, existing 2), coverage 94% lines / 83% branches. DB integration 35 against real Postgres/Mongo/MinIO/Qdrant, coverage of service drivers 96% lines / 82% branches. All pass.

**Errors and fixes**
| Problem | Root cause | Fix |
|---|---|---|
| `npm audit` high (deepmerge-ts) | Prisma's config loader pins deepmerge-ts 7.1.5 (even Prisma 7.10) | npm `overrides` → 8.0.2; Prisma CLI verified working; audit 0 |
| `extensions` in schema rejected | preview feature | pgcrypto enabled in SQL migration instead |
| `prisma migrate reset` refused | Prisma blocks destructive resets from AI agents without the owner's explicit consent | **Not bypassed.** Tests now create a fresh uniquely named DB per run and use additive `migrate deploy`; teardown removes only that run's DB |
| All Mongo tests: "Missing required sub-document 'driver'" | Driver 7 loads `os` via dynamic `import()`, which fails silently in Jest's CommonJS sandbox → empty handshake metadata | `createMongoClient()` injects `runtimeAdapters.os` (public option) |
| Argon2 format test failed | Test assumed `m,t,p` parameter order; library writes `m,p,t` | Test parses parameters order-independently |
| `Buffer` not assignable to Prisma `Bytes` | TS 5.9 `Buffer<ArrayBufferLike>` vs `Uint8Array<ArrayBuffer>` | `FieldCrypto.encrypt` returns a standalone `Uint8Array` |
| Weak "not in clear text" test | `Uint8Array.toString()` gives numbers, so it could never fail | Decode bytes before asserting |
| Unit coverage 57% | Service drivers only run against live services | Unit suite covers pure code; DB suite gates driver coverage at 80% |

**Security notes:** secrets only in the git-ignored `.env` (random, generated by the script); CI uses throwaway credentials for ephemeral containers; object keys server-generated and traversal-proof; audit log tamper-evident; all seed data synthetic.

**Known limitations:** a Postgres superuser can disable triggers (detected by the hash chain; a least-privilege app role is planned for Phase 15). S3 uploads are buffered in memory (multipart streaming arrives with Phase 10).

**Next:** Phase 3, backend foundation.

## 2026-09-24 — Phase 3: Backend foundation (API gateway, Layer 2)

**Objective:** Everything every endpoint needs before business features: validated config, security headers, CORS, rate limiting, validation/sanitisation, a central error envelope, request ids, redacted logging, health/readiness, OpenAPI, and the frozen AI contract.

**Files created:** `src/config/{app-config,config.module}.ts`, `src/common/http/{error-mapping,all-exceptions.filter,validation,http-middleware}.ts`, `src/common/logging/logger-options.ts`, `src/common/validation/safe-text.ts`, `src/infrastructure/database/{prisma.service,mongo.service,database.module}.ts`, `src/openapi.ts`, `tools/export-openapi.ts`, `test/{e2e-app,e2e-env}.ts`, `test/jest-coverage.json`, `test/db/services.int-spec.ts`, `docs/api/openapi.json`, `docs/api/ai-contract.yaml`.
**Files modified:** `src/{app.module,configure-app,main}.ts`, `modules/health/*`, `test/app.e2e-spec.ts`, `scripts/quality-gate.sh`, `package.json`, `docs/security.md`, traceability.

**Dependencies (pinned, Nest 11 compatible):** @nestjs/swagger 11.4.7, @nestjs/throttler 6.7.0, nestjs-pino 4.6.1 (pino 10, pino-http 11), helmet 8, class-validator 0.15, zod 4. `npm audit`: 0.

**Tests:** 110 unit + e2e (combined coverage 89% lines / 86% branches / 87% functions), 38 DB integration (real Postgres/Mongo/MinIO/Qdrant; services 100%). All pass.

**Errors and fixes**
| Problem | Root cause | Fix |
|---|---|---|
| `npm install` ERESOLVE | latest @nestjs/swagger (12) needs Nest 12 | pinned Nest-11-compatible majors (no `--force`) |
| Unversioned 404s had no request id | nestjs-pino middleware only runs under the `/api` prefix | `requestIdMiddleware` registered first in Express; logger reuses `req.id` |
| Malformed JSON reported as generic BAD_REQUEST | Nest's routes-resolver rewrites body-parser `SyntaxError` into `BadRequestException(message)` | `bodyParserErrorMiddleware` right after the parsers maps to `MALFORMED_JSON` / `PAYLOAD_TOO_LARGE` first |
| Body limit ignored by default parser | Nest registers its 100 kB parser first | `bodyParser: false` + `useBodyParser` with configured limit |
| Unit coverage below 80% | gateway code is exercised by e2e, DB services by integration | combined unit+e2e coverage run; DB services gated in the DB suite; extra edge-case tests (5xx masking, custom codes, partial-upload cleanup) raised branch coverage from 76.8% to 86% |
| Jest "coverageReporters not supported in project" | option lived in the unit project config | moved to the root coverage config |

**Security notes:** production refuses to start without an explicit CORS allow-list; API docs off in production by default; errors never contain stack traces, SQL, connection strings or submitted values; logs redact tokens and identifiers and drop query strings.

**Next:** Phase 4, authentication and authorization.

## 2026-09-24 — Phase 4: Authentication and authorisation

**Objective:** Registration, login, logout, refresh-token rotation, password reset/change, Argon2id, lockout, JWT, RBAC, session revocation and audit logging, with the security tests the master prompt requires.

**Design decisions**
- Access tokens: EdDSA (Ed25519) JWT, 15 min, algorithm pinned. Refresh tokens: opaque 256-bit, SHA-256 stored, rotated on each use; presenting a rotated token revokes the whole session family (theft detection).
- The account and session are checked in PostgreSQL on every request, so disabling a user, logging out and reuse revocation take effect immediately, not at token expiry.
- Deny by default: a global guard requires authentication unless a route is `@Public()`; a second global guard enforces `@RequirePermissions`. Denials are audited.
- Self-registration creates PATIENT accounts only; staff are created by administrators with a one-time temporary password that must be changed before anything else.
- No account enumeration: same error, dummy Argon2 timing, forgot-password always 202. Lockout returns 423 only after 5 failures, which the caller already knows about.
- Password policy per NIST SP 800-63B: 12–128 characters, a common-password denylist, no email name, no forced character classes.
- Reset delivery: no paid SMS/e-mail provider was connected (a cost decision for the owner). Development writes to a git-ignored outbox; tests capture in memory.

**Files created:** `src/modules/auth/{auth.service,auth.controller,auth.dto,auth.module,token.service,password,reset-delivery}.ts`, `src/modules/access/{access.decorators,jwt-auth.guard,permissions.guard}.ts`, `src/modules/audit/*`, `src/modules/users/*`, `src/common/http/app-throttler.guard.ts`, `test/fixtures/test-keys.ts`, `test/db/auth.int-spec.ts`, `test/jest-all.json`.
**Files modified:** `app.module.ts` (guards), `app-config.ts` (auth settings), `configure-app.ts` (`X-Frame-Options: DENY`), logger (status-only response logging), `prisma/seed.ts` (shared Argon2 options), `tsconfig.build.json` (output back at `dist/main.js`), quality gate, CI (throwaway keys per run), OpenAPI document.

**Tests:** 195 in total (unit, e2e and real-database integration), all passing. Coverage over all suites: 95% lines / 81% branches / 97% functions. Security tests: wrong password, unknown email (identical response), lockout and unlock, expired / `alg:none` / tampered / foreign-key / garbage tokens, missing token, patient-to-admin escalation (registration and RBAC), mass assignment, refresh rotation and reuse, logout, disabled user, forced password change, reset replay and expiry, auth rate limit (429).

**Smoke test (real server + development DB):** readiness up; the seeded clinician logs in and receives 15-min tokens; `/users/me` works; other routes return `PASSWORD_CHANGE_REQUIRED`; a request without a token gets 401 with a request id and HSTS; Swagger is served; the authorization header never appears in logs.

**Errors and fixes**
| Problem | Root cause | Fix |
|---|---|---|
| `jose` 6 cannot be loaded by CommonJS/Jest | ESM-only package | `jose` 5.10 (CommonJS build, maintained, 0 vulnerabilities) |
| Admin password change rejected in tests | test passphrase contained "admin" (the email name); the policy was right | test uses a different passphrase |
| Reuse-audit count was 2, not 1 | presenting the second (already revoked) token is also logged, which is correct | test asserts at least one |
| Seed tests failed only in the combined run | suites share one DB per run and the tests assumed they seeded first | assertions scoped to seed-owned rows |
| `start:prod` pointed at a missing file | `prisma/` and `tools/` were compiled, nesting output under `dist/src` | excluded from `tsconfig.build.json` |

**Open item for the owner:** choose an SMS or e-mail provider for password-reset delivery before any real deployment (it costs money).

**Next:** Phase 5, patients and clinical data.

## 2026-09-24 — Phase 5: Patients, clinical data and consent

**Objective:** Patient registration and profiles, clinical records (PSA, DRE, PI-RADS, demographics, history), consent, and patient history, with sensitive data protected.

**Design decisions**
- **Facility scoping:** clinical staff see only patients in their own facility; others return 404 (not 403) so their existence is not revealed. Administrators have no routine clinical access (data minimisation).
- **Identifiers:** given/family name, national ID and phone are stored with AES-256-GCM (`FieldCrypto`, keys from validated config). The national ID also gets an HMAC so duplicates and searches work without clear text, and formatting differences ("123456/78/1" vs "123456 / 78 / 1") still match. Responses show the national ID masked.
- **Optimistic concurrency:** updates carry `version`; a stale version returns `409 VERSION_CONFLICT` with the current version, never a silent overwrite. This is the basis for the offline conflict handling in Phase 6.
- **Idempotent offline creation:** a patient or clinical record with an existing `clientUuid` returns the same record (200) instead of a duplicate. The same id from another facility or another patient is refused.
- **Clinical values** are validated in the API (types, ranges, decimals, real past dates, free PSA ≤ total PSA) and again by DB CHECK constraints. Derived values: PSA density and free/total ratio.
- **Consent:** staff grant, list and withdraw. Patients can view and withdraw their own consent (new permission `consent:withdraw_self`); withdrawing twice returns 409. AI analysis will check `hasActiveConsent(AI_ANALYSIS)` in Phase 11.
- **Audit:** reads, searches, creations, updates and consent changes are audited with ids and counts only, never names or national IDs.

**Files created:** `src/modules/patients/*`, `src/modules/clinical/*`, `src/common/crypto/crypto.module.ts`, `src/common/validation/calendar-date.ts`, `test/db/{helpers,patients.int-spec,users-and-edges.int-spec}.ts`.
**Files modified:** `app.module.ts`, `app-config.ts` (field keys validated), `permissions.ts`, test fixtures, `tools/export-openapi.ts`, OpenAPI document, `postgres.int-spec.ts`.

**Tests:** 253 in total, all passing, stable across repeated runs. Combined coverage: 97% lines / 85% branches / 97% functions.

**Errors and fixes**
| Problem | Root cause | Fix |
|---|---|---|
| Audit-row assertion crashed | `JSON.stringify` cannot serialise the BigInt `seq` column | serialise with a BigInt replacer in the test |
| Branch coverage 79.9% (< 80%) | untested branches in the users, patients and clinical services | 15 edge-case integration tests (locked status, unlock, role change ending sessions, duplicate MRN, staff without facility, cross-facility clientUuid, account already linked, minimal record, reused client id, unknown ids) → 85% |
| Seed test failed intermittently in the combined run | new test MRNs `SYN-E-…`/`SYN-D-…` matched the seed test's `SYN-` prefix filter depending on suite order | test MRNs use `EDGE-`; seed assertions check the exact seed MRNs in the seed facility |
| `prisma migrate deploy`: authentication failed (next morning) | the owner's PostgreSQL 18 Windows service had started on 0.0.0.0:5432 and was answering instead of the Docker database | project Postgres moved to host port **5433** (`POSTGRES_PORT`); the owner's service left untouched; dev data verified intact |
| DB suites timed out in `beforeAll` only in the combined run | `testTimeout` is a global option, so the DB project's 60 s was ignored and Jest's 5 s default applied to Argon2-heavy setup | `testTimeout: 60000` in the root `jest-all.json` |

**Next:** Phase 7, Flutter app foundation (owner's choice: app before the sync API).

## 2026-09-24 — Phase 7: Flutter app foundation (Layer 1)

**Objective:** a runnable, themed, role-aware app that signs in against the real API. It is the base for every later screen. Built before the Phase 6 sync API at the owner's request.

**Design decisions**
- **Structure:** feature-first (`features/<name>/{domain,data,application,presentation}`), Riverpod 3 for state and dependency injection, go_router for navigation. Every dependency is a provider, so tests swap in a scripted backend without mocking internals.
- **Navigation rules** are a pure function, `resolveRedirect(session, location)`, unit-tested for every state:
  - signed out → login
  - a forced password change blocks everything else
  - users only reach their own roles' homes; the primary home follows clinician > pathologist > admin > patient
- **API client:**
  - a `QueuedInterceptor` refreshes once on `401 INVALID_TOKEN`, and concurrent failures share that refresh
  - the retry uses a second Dio instance without interceptors, which avoids a queue deadlock
  - only public auth routes are sent without a token, so change-password and logout can still refresh
  - a refused refresh clears the tokens and shows "Your session has ended"; an offline refresh keeps the session
- **Theme (ADR-002 accepted):**
  - Design Option 2 colours, with Option 1 legibility rules
  - fonts bundled as variable TTFs, with their OFL licences registered on the licence page
  - Option 2's teal and amber fail AA as text on white, so they are kept for icons; darker text variants are used instead
- **Shared widgets for later phases:** `AsyncStateView`, `SyncStatusBadge` (states in words), `AiDisclaimerBanner` (the mock label is exactly "DEVELOPMENT MOCK DATA — NOT A CLINICAL RESULT."), `ClinicalCard` with a 4 px severity accent, `PrimaryButton`, `OfflineBanner`.
- **Role homes** list what each role will get, each labelled with the phase that delivers it. Nothing looks finished before it is.

**Files created:** `mobile/lib/{app,core,shared,features}/**`, `mobile/test/{app,core,features,shared,live,support}/**`, `mobile/assets/fonts/*`, `mobile/dart_test.yaml`, `android/app/src/debug/res/xml/network_security_config.xml`, `docs/mobile.md`.
**Files modified:** `mobile/pubspec.yaml`, `mobile/lib/main.dart`, `mobile/test/widget_test.dart`, Android manifests, ADR-002, traceability, security.

**Tests:** 77 mobile tests pass: theme 20, API client 11, session/repository 14, routes 6, widgets 26. Also 1 opt-in live test, which passed against the local backend: sign-in, `/users/me`, refresh-token rotation, sign-out. `flutter analyze`: no issues. `flutter build apk --debug`: OK.

**Errors and fixes**
| Problem | Root cause | Fix |
|---|---|---|
| Google Fonts download returned HTML | the CSS API serves web fonts, not TTFs | variable TTFs from the google/fonts GitHub repository, with `FontVariation('wght')` |
| Possible deadlock on retry after refresh | retrying through the same `QueuedInterceptor` queues behind the error being handled | retry with an interceptor-free Dio instance |
| Refresh skipped for change-password and logout | the first rule excluded all of `/auth/*` | exclude only the public auth routes |
| Emulator could not reach `http://10.0.2.2:3000` | Android 9+ blocks cleartext HTTP by default | debug-only network security config for the local hosts; release stays HTTPS-only |
| Restore after a refused refresh lost the "session ended" message | `_restore` overwrote the state set by the expiry callback | keep an existing `SignedOut` state |

**Known limitation (resolved in Phase 6):** starting offline asked the user to connect before signing in.

**Next:** Phase 6, offline-first. Server `POST /sync`; on the device, Drift + SQLCipher, a sync queue and conflict resolution UI.

## 2026-09-24 — Phase 6: Offline-first sync (Layers 1 and 3)

**Objective:** clinicians can register patients and record PSA, DRE and PI-RADS with no connection (FR-03, UC-02, NFR-08). The data is kept encrypted on the phone and synced safely later. Also required: the app must be proven on the owner's target device, a Samsung Galaxy S9+ on Android 10.

**Design decisions**
- **Server `POST /api/v1/sync`:**
  - Takes an ordered batch of up to 100 operations and handles each one separately.
  - Each operation goes through the existing `PatientsService` / `ClinicalService`, so the permissions, facility scoping, validation, idempotency and audit are the same as REST.
  - Every result is stored by idempotency key in `sync_operations`, so a retried batch returns the stored results and applies nothing twice. A key already used by another account is refused.
- **Results for each operation:**
  - `APPLIED`
  - `CONFLICT` (a stale `baseVersion`, answered with the current server copy)
  - `REJECTED` (a permanent refusal with field errors)
  - `DEPENDENCY_FAILED` for a record whose new patient failed in the same batch. This result is not stored, so it can be retried.
- **Operations need their own permission**, not just `sync:write`. Pathologists have `sync:write` but cannot register patients.
- **Patient references:** a record for a patient registered offline refers to it by the device's `clientUuid`. The server accepts either the server id or the `clientUuid` within the caller's facility.
- **`GET /api/v1/sync/changes`:**
  - Pulls the facility's patients and records with an opaque base64url cursor over (`updatedAt`, `id`). `PatientView` now includes `clientUuid`.
  - The pull is audited with counts only.
- **App storage:**
  - Drift with SQLCipher. The random 256-bit key lives in the Keystore, and opening refuses to continue if SQLCipher is missing.
  - Tables: patients, records, an outbox, conflicts, and meta (device id, owner, cursor, cached profile).
  - Every change is written locally first, then queued.
- **`SyncEngine`:**
  - Runs one sync at a time: it pushes in batches of 50, then pulls.
  - After a failure it backs off: 2 s, doubling up to 15 min, with jitter. "Sync now" skips the wait.
  - A send cut off by the app closing is recovered on the next run.
  - It runs at sign-in, when the connection returns, when the app resumes, every 5 min, and after each save.
- **Conflicts:** they are never overwritten silently. The Sync screen shows "Your change" beside "On the server", and the user picks one. Several edits made before a sync are merged into one update, so they cannot conflict with each other.
- **Offline start:** saved tokens plus the cached profile mean `SignedIn` (this was the Phase 7 limitation).
- **One user per device:**
  - When another user signs in, the previous user's data is wiped.
  - Sign-out wipes the data after a warning if changes are unsent.
  - Android cloud backup is disabled.
- **Minimum clinician screens:** patients list and search, register, detail, add screening record, edit details, and the Sync screen. Each has a sync badge (Synced / Saved on device / Syncing N / Needs attention).
- **Forms use a non-lazy scroll view**, so every field is validated, including fields scrolled off-screen. A lazy `ListView` drops those fields from the `Form`.
- **Target device:**
  - Custom Galaxy S9+ hardware profile (6.2", 1080x2220, 420 dpi) and the AVD `Galaxy_S9_Plus_API_29` (Android 10, x86_64, WHPX).
  - Widget tests use the same logical screen size.
  - The owner's own SM-G965U (Android 10, arm64) was seen over USB. `scripts/phone-usb.ps1` sets up `adb reverse`, and there are two Android Studio run configurations.
- **Owner tooling:**
  - `scripts/dev-up.ps1` / `dev-down.ps1` start and stop everything in one step.
  - `npm run db:reset-demo` resets only the synthetic demo accounts.
  - `npm run e2e:user` creates a throwaway synthetic clinician for device tests.
  - `docs/how-to-test.md` is the step-by-step guide.

**Files created:**
- Backend: `src/modules/sync/*`, `test/db/sync.int-spec.ts`, `tools/create-e2e-user.ts`
- Mobile:
  - `lib/core/db/*`, `lib/core/sync/*`, `lib/features/patients/**`, `lib/features/sync/*`
  - tests: `test/core/sync_test.dart`, `test/features/patients/patients_flow_test.dart`, `test/support/test_db.dart`, `integration_test/app_flow_test.dart`
  - `.run/*.run.xml`
- Scripts and docs: `scripts/{dev-up,dev-down,phone-usb}.ps1`, `docs/how-to-test.md`, `docs/images/phase6-s9plus-patient-synced.png`

**Files modified:** the patient view (`clientUuid`), `app.module.ts`, `prisma/seed.ts` (demo reset), `package.json`, the OpenAPI document, the session controller (offline start, owner and wipe), routes and router, the home screen, the sync badge, `main.dart`, the Android manifest (label, no backup), `pubspec.yaml`, and the docs.

**Tests:**
- Backend: 14 new sync integration tests pass.
- Mobile: 113 tests pass (was 77): data layer 22, session 17, routes 9, patient and sync flows 8, plus the earlier suites. 1 opt-in live test is skipped.
- **On the Galaxy S9+ Android 10 emulator, against the live backend:** the integration test passed.
  - Covered: SQLCipher active, sign-in, offline-style local save, automatic sync, the server MRN arriving, a PSA record, and both confirmed through the API.

**Errors and fixes**
| Problem | Root cause | Fix |
|---|---|---|
| `drift_dev` would not resolve | newer drift_dev needs an analyzer or SDK newer than the one Flutter 3.35 pins with `test_api` | pinned the newest compatible pair, drift and drift_dev 2.28.x (see the comment in `pubspec.yaml`) |
| Host tests need a native SQLite | `sqlite3` 2.x loads a system library, and Windows has none by default | use Windows' built-in `winsqlite3.dll` in tests. Devices use SQLCipher, checked by the on-device test |
| Widget tests failed with "A Timer is still pending" | drift closes stream queries with a zero-length timer | tests use `DatabaseConnection(..., closeStreamsSynchronously: true)` |
| Form fields off-screen were not validated (a possible crash on save) | a lazy `ListView` disposes off-screen fields, which then leave the `Form` | forms use `SingleChildScrollView` + `Column`. Found through the widget tests at the S9+ screen size |
| Save tap missed in a widget test | the "saved" snackbar covered the button | the test waits for the snackbar to time out, as a user would |
| The emulator test reached an old backend | an earlier `node dist/main` was still holding port 3000 | stopped it. `dev-up.ps1` now stops a stale backend before starting |
| The AVD data partition was set to `<temp>` | an avdmanager default | removed, so app data persists between boots |

**Known limitations:**
- Clinical records are create-only. Correcting a record comes in a later phase.
- If the app is killed during a patient UPDATE after the server applied it but before the result was stored, a replay can report a false conflict. The user resolves it with "Keep server version".
- The real phone was disconnected before its run and was not tested in this session. The steps are in `docs/how-to-test.md`.

**Next:** Phase 8, the full clinical workflow (symptom scores, history, patient app screens).

