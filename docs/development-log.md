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
