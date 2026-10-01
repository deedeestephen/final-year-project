# Requirements Traceability Matrix

Source: research proposal §3.4 (use cases, FR, NFR), §3.3 (architecture), §3.7 (ethics). Status values:
`Planned` → `In progress` → `Implemented` (code exists) → `Verified` (tests pass). Nothing is marked Verified without a passing test.

## Gaps against the proposal: the phone app and the assistant (review of 1 October 2026)

The proposal was read again against what is built, for the mobile application (objective 1, §3.3.2) and the chatbot (objective 3, §3.3.5). What it promises and the prototype does not do:

| Proposal | Prototype | What closing it needs |
|---|---|---|
| React Native app (§3.3.2) | Flutter app (ADR-001) | Nothing to build; the report must explain the change of framework |
| Android **and iOS** from one code base | Android only is built and tested; the iOS settings exist (microphone and speech usage texts) | A Mac with Xcode to build and test |
| Push notification engine (§3.3 layer 1) | In-app notifications only (list, unread count) | A push provider (Firebase Cloud Messaging) and an account for it: the owner's decision |
| Patients see their AI report (UC-06) | "My reports" is an empty shell | Trained models and a clinician's sign-off, by design |
| Grad-CAM heatmaps and SHAP values on the report screen (FR-06, FR-08) | The screen shows the reason each is unavailable | Trained models |
| UAT: at least five people per user group, SUS ≥ 75 (NFR-04, §3.8.2); a screen-reader test (NFR-11) | Not done; the kit to run it is in [uat/](uat/README.md) | Ethics approval and participants |
| Speech to text, checked with a real voice | Works with a stand-in in tests; on the emulator the recogniser opened but heard no speech from the laptop's speakers | A person speaking to the phone |
| RAG retrieval with **semantic embeddings** (BioBERT/PubMedBERT, 768 dimensions, cosine similarity, k = 5) in a vector database, and a fine-tuned generative model (§3.3.5) | **Closed for retrieval (1 October 2026, ADR-013):** BM25 decides whether a question is covered, then MedCPT (PubMedBERT trained for search, 768 dimensions) orders the passages by meaning and refuses answers far from the question. Measured: everyday-word questions 18 → 20 of 24, off-topic refused 9 → 11 of 12. It differs from the proposal in three ways: MedCPT's dot product instead of cosine, every keyword match ranked instead of the top 5, and a vector file instead of Qdrant (32 passages). Claude can write from the passages when a key is set (ADR-010; off) | A fine-tuned generative model is not planned: Claude (or quoting) writes from the reviewed passages instead |
| Answers in English, **Bemba and Nyanja** (FR-07) | English only; the other two answer "not available yet" | Human-verified translations of the knowledge base |
| Knowledge base of clinical guidelines and patient material **validated by clinicians**, structured around the Health Belief Model (§2.7) | Six patient articles and a clinician reference, all marked "draft for review"; some HBM themes (who is at higher risk, benefits and downsides of screening), none on practical barriers (cost, distance, fear of biopsy) | Content written or reviewed by a clinician, with the HBM constructs in mind |
| Chatbot usability test with think-aloud (§3.8.2) | Not done | Participants |

Met and not gaps: the 2-second answer time (P95 514 ms with the meaning search under 100 users; 43 ms with keywords only), offline-first capture, AES-256 on the phone, TLS 1.3, RBAC, FHIR R4. Objective 4 (data collection and model training) and the trained models of objective 2 are outside what the prototype could do without data and ethics approval.

## Functional requirements

| ID | Requirement (summary) | Component | Implementation | Test | Phase | Status |
|---|---|---|---|---|---|---|
| FR-01 | JWT auth + RBAC for 4 roles; lockout after 5 failed logins | L2/L3 auth | `services/auth`, `gateway/access` (JwtAuthGuard, PermissionsGuard), `services/users` | `test/db/auth.int-spec.ts` (25 tests), `token.service.spec.ts`, `password.spec.ts` | 4 | **Verified** |
| FR-02 | Capture/transmit demographics, PSA, DRE, history encrypted over TLS 1.3 | L1 forms, L3 clinical | `3-application-logic/backend/src/services/{patients,clinical}`; app forms Ph.9 | `test/db/patients.int-spec.ts`, `users-and-edges.int-spec.ts` | 5, 7–9, 15 | **Verified:** backend (Ph.5), app forms (Ph.7–9), TLS 1.3 at the reverse proxy (Ph.15), end to end (Ph.16) |
| FR-03 | Full offline entry, AES-256 SQLite cache, conflict-resolving sync | L1 sync, L3 sync | `1-presentation-layer/mobile-app/lib/core/{db,sync}`, `3-application-logic/backend/src/services/sync` | `3-application-logic/backend/test/db/sync.int-spec.ts`, `1-presentation-layer/mobile-app/test/core/sync_test.dart`, `1-presentation-layer/mobile-app/test/features/patients/patients_flow_test.dart`, on-device `1-presentation-layer/mobile-app/integration_test/app_flow_test.dart` | 6 | **Verified** |
| FR-04 | Accept & validate DICOM MRI/TRUS/CT, archive, queue for CNN | L3 imaging, L5 object store | `3-application-logic/backend/src/services/imaging` (streamed multipart upload, magic-byte check, DICOM header parse, size caps, retry-safe `clientUuid`), `gateway/upload/*`, `StorageModule` (local or S3/MinIO, streamed) | `test/db/imaging.int-spec.ts` (11 tests incl. MinIO), `file-signatures.spec.ts`, `imaging.spec.ts` | 10, 11, 15 | **Verified** for upload, validation and archive (Ph.10); AI jobs use the scans (Ph.11), as de-identified copies only (Ph.15) |
| FR-05 | PCa probability + Gleason grade group ≤3 s P95 | L4 + broker | `4-ai-intelligence-layer/ai-services/app/{router,contract}.py` (Model Router, provider interface, **labelled MOCK providers**), backend `services/ai` (broker with service token, timeout and contract validation; job queue; reports in MongoDB) | `4-ai-intelligence-layer/ai-services/tests/*` (24 tests, 98.7%), `3-application-logic/backend/test/db/ai.int-spec.ts` (9), `ai.spec.ts` | 11, 17 | **Pipeline Verified with mock models only.** No trained model exists, so no real probability or grade is produced. Latency measured in Ph.17: 545 ms P95 end to end under load ([performance.md](performance.md)) |
| FR-06 | Grad-CAM for CNN outputs, SHAP for ANN outputs | L4 explainability | ai-services `app/explain/` (explainer per module: Grad-CAM for ResNet-50, SHAP for ANN and fusion, MIL attention for histopathology); backend stores images as `explainability_artifacts` + object storage | `test_explain.py`, `ai.int-spec.ts` (explanations) | 12 | **Pipeline Verified.** With mock models every explanation is an honest "unavailable" reason; no heatmap or SHAP value is ever invented |
| FR-07 | RAG chatbot, ≤2 s, English/Bemba/Nyanja | L4 RAG + L3 chatbot + L1 app | `4-ai-intelligence-layer/knowledge-base/` (reviewed documents, draft status); ai-services `app/chat/` (BM25 retrieval, whole passages quoted; ADR-009; MedCPT meaning order and floor, ADR-013); backend `services/chatbot` (safety rules, conversations, audit, chat limit); app `features/chat/` | `test_chat.py` (16, retrieval quality set ≥ 90%), `test_meaning.py` and `test_embeddings.py` (meaning search; evaluation sets in `eval_sets.py`, `python -m app.chat.evaluate`), `chat-safety.spec.ts` (34-prompt red-team set), `chatbot.int-spec.ts` (9), Phase 16 workflow 7 (real AI service), `chat_test.dart` (7); performance: P95 514 ms with the meaning search, 43 ms keywords only | 13 | **Verified for English:** answers quoted with sources, P95 514 ms under 100 users (target 2 s). Meaning search (ADR-013): everyday-word questions 20 of 24 right at the first passage (keywords alone: 18), off-topic refused 11 of 12 (9). Claude-written answers from the same passages when a key is set (ADR-010; tested with a fake client, `test_chat_claude.py`); small talk and follow-ups (Ph.13+). Bemba and Nyanja answer "not available" until human-verified content exists; the knowledge base awaits clinician sign-off |
| FR-08 | Render AI report: probability, Gleason, heatmap, CI, recommendations | L1 report viewer | 1-presentation-layer/mobile-app/lib/features/clinical_server/presentation/ai_screens.dart | `clinical_server_test.dart`; device test | 9 | **Verified with mock output (Ph.9):** disclaimer banner first, probability and range, grade group, modules used/skipped, explanations or the reason there are none, no metrics without stored evaluations. Heatmaps appear once a trained model supplies them. |
| FR-09 | De-identified FHIR R4 JSON export (SmartCare Pro) | L3 fhir | 3-application-logic/backend/src/services/fhir; admin website FHIR export page | `fhir-mappers.spec.ts` (mapping, round trip), `fhir.int-spec.ts`, `smartcare.client.spec.ts`, `FhirExportPage.test.tsx`; HL7 validator 0 errors | 14 | **Verified (Ph.14):** download and send to a SmartCare Pro mock; real SmartCare Pro needs a data-sharing agreement |
| FR-10 | Immutable timestamped audit log of access/modify/AI/export | L3 audit, L5 | DB layer: `5-data-persistence/postgresql/migrations/*_constraints_and_audit` (append-only triggers + SHA-256 chain + `audit_logs_verify_chain()`); `services/audit/audit.service.ts` writes auth, access-denied and user-admin events (fail-closed) | `postgres.int-spec.ts` › audit log; `auth.int-spec.ts` | 2, 4, 5, 10–15 | **Verified:** sign-in and admin events (Ph.4), patient, record and consent events (Ph.5), uploads, AI jobs and reports (Ph.10–12), FHIR export and send (Ph.14); the viewer and chain check (Ph.15, `audit-log.int-spec.ts`); end to end in Phase 16 workflow 6 |
| FR-11 | Disaggregated AI metrics (age, region, stage) | L4 fairness | `GET /api/v1/ai/models/{id}/evaluation` returns only a stored evaluation run. Ph.18: `fairness.ts` compares the stored per-group AUCs per dimension and flags a gap above 0.05 (groups under 30 cases listed, not compared) | `ai.int-spec.ts`, `fairness.spec.ts` (5) | 12, 18 | **Verified** as "Evaluation data not yet available." and the fairness calculation on test figures; real figures need a trained, evaluated model |
| FR-12 | Retraining support, model registry, A/B before promotion | L4 registry | `GET /v1/models` (ai-services) synced into `ai_models` by `GET /api/v1/ai/models`; evaluation only from stored runs | `test_infer.py`, `ai.int-spec.ts` | 11 | **Partial:** registry and versions Verified; retraining and A/B documented as future work |

## Use cases

| UC | Name | Covered by | Status |
|---|---|---|---|
| UC-01 | Registration & authentication | FR-01 | **Verified:** end to end on the live system (Ph.16, workflow 1: sign-up, NRC link, lockout; phone: linked patient signs in); backend (Ph.4); app sign-in, forced password change, forgot password, sign-out and session expiry (Ph.7, `1-presentation-layer/mobile-app/test/widget_test.dart`, live check `test/live`). Self-registration screen with patient onboarding in Ph.8 |
| UC-02 | Offline clinical data capture | FR-02, FR-03 | **Verified (Ph.6; end to end Ph.16, workflow 2: exactly once, conflict, partial batch, facility scope):** register patients and add PSA/DRE/PI-RADS records offline; queued, synced idempotently, conflicts shown for the user to resolve; checked on the Galaxy S9+ (Android 10) emulator against the live backend. Richer clinical forms (symptoms, history) Ph.8 |
| UC-03 | Imaging upload & validation | FR-04 | **Verified (Ph.10, API; Ph.9, app; Ph.16 end to end, workflow 3: refusals, de-identified copy):** pick, queue (works offline), upload once, server refusals in plain words |
| UC-04 | Histopathology slide submission | Ph.10: slide upload (TIFF/SVS/NDPI), review queue, Gleason review with server-computed ISUP grade group; Ph.11: Patch-CNN provider | **Partial:** upload and review Verified (API, and app in Ph.9); the Patch-CNN provider is a labelled mock until the trained model is added |
| UC-05 | AI multi-modal analysis | FR-05 | **Verified (Ph.11, API; Ph.9, app; Ph.16 end to end through the real AI service; mock models):** consent-gated request with disabled reasons, polling while open, labelled report |
| UC-06 | Diagnostic report delivery | FR-08 | **Partial (Ph.9):** clinicians read the report in the app and see recent facility results; release to the patient app waits for trained models and clinician sign-off |
| UC-07 | Chatbot interaction | FR-07 | **Verified (Ph.13):** patients ("Ask a question") and clinicians ("Ask the assistant") ask, see quoted answers with sources, urgent-care guidance, refusals and "no reviewed information"; conversations private and deletable. On-device check pending a restart of the development servers |
| UC-08 | National EHR export | FR-09 | **Verified (Ph.14; Ph.16 end to end over HTTPS with the audit chain checked)** for export and send (mock endpoint); receiving data back needs identified data and an agreement (future work) |
| UC-09 | Administration & RBAC | FR-01, FR-10, `services/users`, `services/audit` | **Verified (Ph.15):** user lifecycle, role assignment with separation-of-duties locks, unlock, audit, and the audit-log viewer with hash-chain check |
| UC-10 | Infrastructure monitoring | Prometheus `/metrics` endpoint; Grafana documented; admin **activity dashboard** (`GET /admin/activity`, admin website Dashboard) | **Partial:** app activity dashboard verified (`activity.int-spec.ts`, `DashboardPage.test.tsx`); Prometheus/Grafana planned |
| UC-11 | Population analytics | de-identified aggregate report endpoint | Planned (stretch) |
| UC-12 | Model retraining & deployment | FR-12 | Planned (partial) |

## Non-functional requirements

| ID | Target | How it is addressed / verified | Status |
|---|---|---|---|
| NFR-01 | AES-256 at rest, TLS 1.3, RBAC at gateway | **Partial (Ph.2):** AES-256-GCM column encryption `src/persistence/crypto/field-crypto.ts` (unit-tested; tamper/wrong-key rejected); RBAC catalogue `src/gateway/access/permissions.ts` (tested). Ph.6: SQLCipher (AES-256) database on the device, key in Android Keystore (on-device test checks `cipher_version`). Ph.4: RBAC guard. Ph.15: TLS 1.3 only at the reverse proxy, proven with the real nginx configuration (`tls-check.sh`); access matrix checks every route. Remaining (deployment): KMS-held keys, object-storage encryption at rest, database TLS | **Verified for the prototype (Ph.15)**; deployment items in security-review.md R-4 |
| NFR-02 | ≤3 s P95 inference | `npm run perf` (Ph.17): AI analyses timed end to end on the live system, one a second while 500 users are active, and a burst of 20 at once; [performance.md](performance.md) | **Met for the pipeline with mock models (Ph.17):** 545 ms P95 under load, 1,027 ms P95 for a burst of 20. Must be re-measured with the trained models |
| NFR-03 | ≥99.5% uptime | Not measurable in prototype; health checks + restart policies only | Research target |
| NFR-04 | SUS ≥75 | Requires UAT with participants. The kit is ready: [uat/](uat/README.md) (plan, consent, task sheets per role, SUS with scoring, results template) | Research target; kit prepared (1 Oct 2026), sessions need ethics approval |
| NFR-05 | ≥500 concurrent users | Stateless API instances, Redis-shared rate limits (per address and per account), server-side paging, trigram search indexes, app backoff honouring `Retry-After`. Ph.17: 500 signed-in synthetic users with a clinician's traffic mix on the live system ([performance.md](performance.md)) | **Met in practice (Ph.17):** 500 users (~98 requests/s), 0 errors, P95 156 ms (25 users: 41 ms); one laptop instance saturates at ~133 requests/s |
| NFR-06 | HL7 FHIR R4 | FR-09 | **Verified (Ph.14):** official HL7 validator, 0 errors; LOINC and HL7 codes checked on the terminology server |
| NFR-07 | ≥80% test coverage | Every package has an 80% minimum that fails the gate: backend (Jest, all tests including database), AI service (pytest-cov), phone app (`lcov-check.py`, generated code excluded), admin website (Vitest thresholds) | **Verified (Ph.18):** backend 94.4% statements / 80.6% branches / 94.5% functions / 95.3% lines (454 tests); AI service 99%; phone app 91.3% of lines; admin website 87.7% / 80.4% / 83.0% / 89.3% |
| NFR-08 | Complete offline data entry | FR-03 | **Verified for patient registration and screening records (Ph.6)**; exactly once under load: 100 phones × 20 changes at once, all saved, none twice (Ph.17); offline start with the cached profile; later clinical features reuse the same outbox |
| NFR-09 | 100% explainability coverage | Every module that ran gets an explanation or an explicit reason; enforced by the contract on both sides and a database CHECK | **Verified (Ph.12)** |
| NFR-10 | Safe Harbour de-identification | Ph.2: identifiers encrypted + HMAC lookup. Ph.11: AI gets a keyed pseudonym and clinical values only. Ph.14: FHIR export de-identified, one test per identifier class (18) | **Verified (Ph.14–15):** FHIR export; AI requests; de-identified DICOM/JPEG/PNG copies for the AI (Ph.15). Slides held back until slide de-identification exists (security-review.md R-1) |
| NFR-11 | WCAG 2.1 AA | contrast-checked tokens, semantics labels, text scaling, 48dp targets; Flutter accessibility guideline tests | **Partial (Ph.7; dark mode and redesign added):** every token text pair ≥ 4.5:1 in light and dark mode (30 pairs each, including the gradient header and tile colours), body ≥ 15 px, 48 dp targets, 52 px inputs (`theme_test.dart`); states in words, not colour alone; live regions for errors. Ph.18: `accessibility_test.dart` runs Flutter's tap-target (48 dp), label and text-contrast guidelines on six main screens in light and dark mode, and lays them out at 200% text (a real overflow in the sign-in header was found and fixed); admin website `contrast.test.ts`. ADR-011/012: twelve screens now (chat, recording, Learn, an article being read aloud), and Learn articles and chat answers can be listened to, for people who cannot read. Remaining: a test with screen-reader users (UAT) |

## Ethics / compliance (§3.7)

| Requirement | Implementation | Status |
|---|---|---|
| Informed consent tracking, withdrawal | `/patients/:id/consents` (grant/list/withdraw), `/patients/me/consents` (patient self-view and withdrawal) | **Verified (Ph.5)**; `hasActiveConsent` gates AI analysis in Ph.11 |
| Data minimisation, role-limited access | Facility scoping for staff (other facilities → 404); administrators have no clinical access (role locks); patients see only their own record; the AI gets a pseudonym, clinical values and de-identified files only; the FHIR export is de-identified; the admin dashboard shows counts only; national IDs are masked in answers | **Verified:** `patients.int-spec.ts`, `admin.int-spec.ts`, `ai.int-spec.ts`, `fhir.int-spec.ts`, `activity.int-spec.ts`, Phase 16 workflows 1, 3 and 6 |
| Fairness monitoring (AUC gap > 0.05 flag) | `3-application-logic/backend/src/services/ai/fairness.ts`: computed from the stored evaluation's per-group figures (age, region, stage, equipment) | **Verified (Ph.18)** on test figures (`fairness.spec.ts`, `ai.int-spec.ts`); needs real evaluations from the trained models |
| Data residency | Documented deployment constraint | Documented |
| No fabricated results | Provenance field + mock banner everywhere | **Verified:** the Mongo `ai_reports` validator requires `provenance ∈ {MOCK, RESEARCH_MODEL}` and a disclaimer (Ph.2); every mock result carries "DEVELOPMENT MOCK DATA — NOT A CLINICAL RESULT." in the API and first on every app AI screen (Ph.9, 11); explanations are unavailable with a reason, never invented (Ph.12); evaluations and fairness only from stored runs (Ph.12, 18). Checked end to end in Phase 16 workflow 3 |

## Phase 2 additions (database foundation)

| Requirement | Implementation | Test | Status |
|---|---|---|---|
| Relational store for users, patients, clinical, consent, audit (§3.3 L5) | `3-application-logic/backend/prisma/schema.prisma`, 2 migrations | `postgres.int-spec.ts` (tables, triggers, migrate-from-clean) | Verified |
| Clinical value integrity (PSA, PI-RADS, Gleason, ISUP) | CHECK constraints | `postgres.int-spec.ts` › constraints | Verified |
| Large files outside the RDBMS (DICOM/WSI) | `ObjectStorage` (local + S3/MinIO), server-generated keys | `object-storage.spec.ts`, `document-and-object-stores.int-spec.ts` | Verified |
| Document store for AI reports, chatbot logs | `src/persistence/mongo/collections.ts` + validators | `document-and-object-stores.int-spec.ts` | Verified |
| Vector DB for RAG (§3.3.5) | `VectorStore` (memory + Qdrant) | `memory-vector-store.spec.ts`, Qdrant int test | Verified |
| Idempotent sync storage (UC-02) | `sync_operations.idempotency_key` unique | `postgres.int-spec.ts` | Verified |
| Synthetic-only seed data | `src/persistence/seed.ts` (`is_synthetic`) | `postgres.int-spec.ts` › seed | Verified |
| Password hashing Argon2id | seed uses argon2id m=64MiB t=3 p=1 | `postgres.int-spec.ts` › seed | Verified (auth flow: Ph.4) |

## Phase 3 additions (API gateway foundation, Layer 2)

| Requirement (proposal §3.3 L2) | Implementation | Test | Status |
|---|---|---|---|
| OpenAPI 3.0 RESTful endpoints, API versioning | `/api/v1` URI versioning; `src/gateway/openapi.ts`; committed `2-api-gateway/openapi/openapi.json` (CI checks it is current) | `app.e2e-spec.ts` › OpenAPI, routing | Verified |
| Input payload validation & sanitisation | global ValidationPipe; `@IsSafeText` | `app.e2e-spec.ts` › validation; `safe-text.spec.ts` | Verified |
| Rate limiting & throttling | ThrottlerGuard (global) | `app.e2e-spec.ts` › rate limiting | Verified |
| CORS policy | allow-list, closed by default | `app.e2e-spec.ts` › CORS | Verified |
| Centralised error handling | `AllExceptionsFilter` + `toErrorBody` | `error-mapping.spec.ts`, e2e | Verified |
| Security headers | helmet (HSTS, CSP) | e2e › security headers | Verified |
| Health / readiness (UC-10 basis) | `/api/v1/health`, `/api/v1/health/ready` | unit, e2e, real-DB integration | Verified |
| AI layer isolated behind a contract (§3.3.1) | `2-api-gateway/openapi/ai-contract.yaml` v0 (frozen) | contract tests in Ph.11 | Specified |
| JWT authentication middleware, RBAC enforcement | global `JwtAuthGuard` + `PermissionsGuard`; every route listed in [access-matrix.md](access-matrix.md) | `auth.int-spec.ts`, `access-matrix.spec.ts`, access matrix check in the gate | Verified (Ph.4, 15) |
| TLS 1.3 | reverse proxy (`2-api-gateway/reverse-proxy/`) | `6-infrastructure/scripts/tls-check.sh` (real nginx: 1.3 accepted, 1.2 and 1.1 refused) | Verified (Ph.15) |

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
| Runs on the target phone class | Galaxy S9+ hardware profile, Android 10 (API 29) emulator; the owner's SM-G965U connects by USB (`6-infrastructure/scripts/phone-usb.ps1`) | on-device integration test | Verified on emulator |

## Phase 8 additions (patient workflow)

| Requirement | Implementation | Test | Status |
|---|---|---|---|
| Patient portal (§3.3.2 L1): home, results, education, messages, profile | `1-presentation-layer/mobile-app/lib/features/patient/**` (tab shell `/me/...`) | `test/features/patient/patient_app_test.dart`; on-device `integration_test/app_flow_test.dart` (patient flow) | Verified on the S9+ emulator |
| Patients read their own screening history | `GET /api/v1/patients/me/clinical-records` (`clinical:read_self`), audited `clinical_record.read_self` | `3-application-logic/backend/test/db/notifications.int-spec.ts` | Verified |
| In-app notifications (push engine groundwork) | `services/notifications`: list, unread count, mark read, mark all; created on new record (REST and sync) and on consent grant/withdrawal; no values or names in the text | `notifications.int-spec.ts` | Verified (push delivery: later, needs a provider decision) |
| Consent self-withdrawal in the app (§3.7.1) | Profile › My consents, confirmation that explains the effect | `patient_app_test.dart`, on-device test | Verified |
| Patient self-registration (UC-01) | Create account screen → `POST /auth/register` | `patient_app_test.dart` | Verified; linking is done by an administrator on the admin website |
| Patient education (FR-07 groundwork) | bundled, sourced English library; Bemba/Nyanja disabled until human-verified | `patient_app_test.dart` | English Verified; chatbot Ph.13; translations pending the owner |
| Report viewer (FR-08) | Profile › My reports: empty state until reports are released | `patient_app_test.dart` | Shell only; staff report viewer done in Ph.9; release to patients after trained models and clinician sign-off |

## Administration, identity at sign-up and national theme

| Requirement | Implementation | Test | Status |
|---|---|---|---|
| UC-09: administrators manage accounts and roles | Admin **web app** (`1-presentation-layer/admin-panel-web/`, ADR-005): search, roles, facility, disable, unlock, one-time password reset; `POST /users/:id/reset-password`, `GET /users?q=&role=` | `3-application-logic/backend/test/db/admin.int-spec.ts`, `1-presentation-layer/admin-panel-web/src/App.test.tsx`, browser check at desktop, tablet and phone widths | Verified |
| Delete accounts from the admin website (owner request, 2026-09-29) | `DELETE /api/v1/users/:id` (`user:manage`): refuses self (`SELF_DELETE`) and accounts with clinical history (`HAS_CLINICAL_HISTORY`, counts in `details`: patients registered, screenings, consents, scans, slides, AI requests, phone changes → disable instead); roles, sessions, reset links and notifications go with the account, a linked patient record is only unlinked, its chats are deleted; audited `user.deleted` (roles only, no email). Admin website: **Delete account** with a confirm dialog | `users-and-edges.int-spec.ts` (3), `UsersPages.test.tsx` (3 + the self case) | Verified |
| Editable role permissions with safety locks | `GET /admin/roles`, `PUT /admin/roles/:name/permissions`, `POST /admin/roles/:name/reset`; `roles.customised` kept by the seed | `admin.int-spec.ts` (immediate effect, audit, seed keeps edits, lock-out and patient locks) | Verified |
| Giving patients access to their own data | `POST /admin/patient-accounts/:id/match|link|unlink` (NRC HMAC match; `patient_account:link`) + notification | `admin.int-spec.ts`, `1-presentation-layer/admin-panel-web/src/App.test.tsx` (match → confirm → link; no-match message) | Verified |
| Patient sign-up with phone and NRC or passport | `RegisterDto` + `users.phone_enc`, `id_number_enc`, `id_number_hmac` (unique) | `admin.int-spec.ts`, `patient_app_test.dart` | Verified |
| Zambian national colours (owner request) | ADR-004; tokens + `NationalStripe`; not-an-official-service notice | `theme_test.dart` (AA contrast), `widgets_test.dart` | **Superseded (2026-09-29) by ADR-011**; the notice stays |
| Awareness-blue theme in the app and the admin website, no flag stripe (owner request) | ADR-011; `AppPalette` + `AccentTone` (`tokens.dart`), `AccentLine`, `HeroDecorPainter`; admin `index.css` tokens and `AccentLine` | `theme_test.dart` (30 pairs per mode at 4.5:1), `widgets_test.dart` (no flag colours), admin `contrast.test.ts` (no flag tokens) | Verified |
| Modern icons on buttons (owner request) | ADR-011; Material Symbols Rounded everywhere in the app, filled when selected; `actionIconTheme` | `icon_style_test.dart` (no `Icons.`, rounded only) | Verified |
| A bot icon that shows people they can chat (owner request) | ADR-011; `AssistantAvatar` (drawn in code), `AssistantFab` on patient Home and Learn and clinician home; bot in the chat header, answers and welcome screen | `chat_test.dart` (bot button opens chat, labelled "PCa Assistant"), `widget_test.dart`, accessibility suite | Verified |
| Voice messages to the chatbot, like ChatGPT (owner request) | ADR-012; `SpeechService` + `PhoneSpeechService` (`speech_to_text`), `ChatComposer` (mic, live words, ✓/✕, auto-stop); `RECORD_AUDIO` asked at first use | `chat_test.dart` (8 voice tests with a fake recognizer) | Verified with fakes; on a device: how-to-test.md (needs a microphone) |
| Audio read-aloud in Learn for people who cannot read (owner request) | ADR-012; `ReadAloud` + `PhoneReadAloud` (`flutter_tts`), `readAloudControllerProvider`; Listen buttons on the Learn cards, a pinned player on the article, Listen on chat answers | `read_aloud_test.dart` (6), `chat_test.dart` (2), accessibility suite | Verified with fakes; on a device: how-to-test.md |
| The chatbot can start new chats and reopen earlier ones (owner request, 2026-09-29) | App: **New chat** and **Past chats** in the chat header, *Your chats* sheet, *Continue a chat* on the empty chat (`chat_screen.dart`, `ChatController.open`, `chatHistoryProvider`); server: `GET /chat/conversations`, `GET /chat/conversations/{id}` (Phase 13) | `chat_history_test.dart` (6) | Verified |
| Semantic search for the chatbot, as in the proposal (owner request, 2026-10-01: "doall3") | ADR-013; `app/chat/embeddings.py` (MedCPT query and article encoders in numpy, pinned download), `meaning.py` (index file, background loading, slots and wait), `answer.py` (keywords decide, meaning orders, floor 52.0, follow-up check, keyword fallback when busy); `CHAT_RETRIEVAL` | `test_meaning.py`, `test_embeddings.py`; `python -m app.chat.evaluate`; chat load test with the meaning search (P95 514 ms) | Verified; the thresholds come from small hand-written question sets (UAT questions to be added) |
| Users can greet the chatbot and chat casually (owner request, 2026-09-29) | 18 small-talk intents with fixed replies for patients and clinicians (`chat-safety.ts`: greetings incl. Bemba and Nyanja, how are you, feelings, name, creator, robot or doctor, thanks, compliments, complaints, jokes, yes/no/ok, emoji, goodbyes, off-topic); only whole messages count, and the safety rules always run first; friendlier "no reviewed information" text | `chat-safety.spec.ts` (40 phrases + real questions left to the knowledge base + safety first + varied jokes), `chatbot.int-spec.ts` | Verified |

## Admin web app, rate limits and scalability

| Requirement | Implementation | Test | Status |
|---|---|---|---|
| Administration separate from the mobile app, on the desktop, responsive (owner request) | `1-presentation-layer/admin-panel-web/` (React 19 + TypeScript, ADR-005); sidebar ≥ 900 px, Menu button below, tables become cards below 700 px; the app shows "Administration is on the web" | `1-presentation-layer/admin-panel-web/src/App.test.tsx` (17 Vitest tests incl. client); Edge at 1440, 820 and 375 px: no horizontal scrolling, all pages | Verified |
| Secure browser session (NFR-01) | HttpOnly SameSite=Strict refresh cookie for `X-Client: web`; access token in memory; single-flight refresh | `rate-limit.int-spec.ts` (cookie login, rotation, reuse, logout; mobile body token unchanged), `client.test.ts` | Verified |
| Per-user rate limit so no user can overload the system (owner request) | `UserRateLimitGuard` (120/min per account) after authentication; per-address limit 600/min; `Retry-After` + `X-RateLimit-*` headers | `rate-limit.int-spec.ts`; load test C in [scalability.md](scalability.md) (exactly 120 of about 15,000 requests passed) | Verified |
| Limits shared across API instances (horizontal scaling) | `RedisThrottlerStorage` (atomic Lua counter), fail-open if Redis is down | `rate-limit.int-spec.ts` (two instances, one Redis; unreachable Redis) | Verified |
| Clients back off under load | App `SyncEngine` waits `max(backoff, Retry-After)`; portal shows the wait time and never auto-retries 4xx | `sync_test.dart` (Retry-After), `App.test.tsx` (rate-limit message) | Verified |
| Fast search with many accounts | `pg_trgm` GIN indexes on user email and name (migration `20260924150000_user_search_trgm`) | migration applied in the DB test run | Verified |
| Admin website follows the owner's "Clinical Field Health" design (owner request) | ADR-006; tokens in `1-presentation-layer/admin-panel-web/src/index.css`; connection banner | `contrast.test.ts` (24 text pairs at least 4.5:1, chart lines at least 3:1), `online.test.tsx`; Edge screenshots at 1440, 820 and 375 px | Verified |
| Phone app redesign, "modern health app", all screens, light and dark (owner request) | ADR-008; `AccentTone` + gradient tokens (`tokens.dart`), theme shapes and shadows (`app_theme.dart`), `shared/widgets/hero_header.dart` (`HeroHeader`, `ActionTile`, `InitialsAvatar`, `TintedIcon`) | `theme_test.dart` (30 pairs per mode at 4.5:1), `widgets_test.dart` (6 new), all 208 mobile tests; renders checked by eye at S9+ size in both modes | Verified |
| Dashboard of phone app activity and a clearer navigation bar (owner request) | `X-Client: mobile` header from the app; `details.client` in audit entries; `GET /admin/activity` (counts from `audit_logs` and `sync_operations`, days in Africa/Lusaka time); `DashboardPage.tsx`, `charts.tsx`, grouped dark sidebar in `Layout.tsx` | `activity.int-spec.ts` (5), `api_client_test.dart`, `DashboardPage.test.tsx` (11); headless Chrome screenshots at 1440 and 390 px | Verified |
