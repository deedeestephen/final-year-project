# Requirements Traceability Matrix

Source: research proposal §3.4 (use cases, FR, NFR), §3.3 (architecture), §3.7 (ethics). Status values:
`Planned` → `In progress` → `Implemented` (code exists) → `Verified` (tests pass). Nothing is marked Verified without a passing test.

## Functional requirements

| ID | Requirement (summary) | Component | Implementation | Test | Phase | Status |
|---|---|---|---|---|---|---|
| FR-01 | JWT auth + RBAC for 4 roles; lockout after 5 failed logins | L2/L3 auth | backend/src/modules/auth, gateway guards | auth e2e + security tests | 4 | Planned |
| FR-02 | Capture/transmit demographics, PSA, DRE, history encrypted over TLS 1.3 | L1 forms, L3 clinical | mobile/features/clinical, backend/modules/clinical | API + widget tests | 5, 9 | Planned |
| FR-03 | Full offline entry, AES-256 SQLite cache, conflict-resolving sync | L1 sync, L3 sync | mobile/core/sync, backend/modules/sync | offline/sync test suite | 6 | Planned |
| FR-04 | Accept & validate DICOM MRI/TRUS/CT, archive, queue for CNN | L3 imaging, L5 object store | backend/modules/imaging | upload validation tests | 10 | Planned |
| FR-05 | PCa probability + Gleason grade group ≤3 s P95 | L4 + broker | ai-services router, backend ai-broker | contract tests; latency measured in Ph.17 | 11, 17 | Planned (target, not claimed) |
| FR-06 | Grad-CAM for CNN outputs, SHAP for ANN outputs | L4 explainability | ai-services/explain | artifact tests | 12 | Planned |
| FR-07 | RAG chatbot, ≤2 s, English/Bemba/Nyanja | L4 RAG + L3 chatbot | ai-services/rag, backend/modules/chatbot | retrieval/safety/multilingual tests | 13 | Planned |
| FR-08 | Render AI report: probability, Gleason, heatmap, CI, recommendations | L1 report viewer | mobile/features/ai_report | widget tests | 9 | Planned |
| FR-09 | De-identified FHIR R4 JSON export (SmartCare Pro) | L3 fhir | backend/modules/fhir | serialization tests | 14 | Planned |
| FR-10 | Immutable timestamped audit log of access/modify/AI/export | L3 audit, L5 | DB layer: `prisma/migrations/*_constraints_and_audit` (append-only triggers + SHA-256 chain + `audit_logs_verify_chain()`); app-side audit writes: Phase 4 | `test/db/postgres.int-spec.ts` › audit log | 2, 4 | **DB layer Verified**; app writes Planned |
| FR-11 | Disaggregated AI metrics (age, region, stage) | L4 fairness | ai-services/fairness | unit tests; shows "Evaluation data not yet available" | 12 | Planned |
| FR-12 | Retraining support, model registry, A/B before promotion | L4 registry | ai-services/registry, ai_models table | registry tests | 11 | Planned (registry only; retraining pipeline documented) |

## Use cases

| UC | Name | Covered by | Status |
|---|---|---|---|
| UC-01 | Registration & authentication | FR-01 | Planned |
| UC-02 | Offline clinical data capture | FR-02, FR-03 | Planned |
| UC-03 | Imaging upload & validation | FR-04 | Planned |
| UC-04 | Histopathology slide submission | Phase 10 (WSI) + Phase 11 Patch-CNN provider | Planned |
| UC-05 | AI multi-modal analysis | FR-05 | Planned |
| UC-06 | Diagnostic report delivery | FR-08 | Planned |
| UC-07 | Chatbot interaction | FR-07 | Planned |
| UC-08 | National EHR export | FR-09 | Planned |
| UC-09 | Administration & RBAC | FR-01, FR-10, admin module | Planned |
| UC-10 | Infrastructure monitoring | Prometheus `/metrics` endpoint; Grafana documented | Planned (partial) |
| UC-11 | Population analytics | de-identified aggregate report endpoint | Planned (stretch) |
| UC-12 | Model retraining & deployment | FR-12 | Planned (partial) |

## Non-functional requirements

| ID | Target | How it is addressed / verified | Status |
|---|---|---|---|
| NFR-01 | AES-256 at rest, TLS 1.3, RBAC at gateway | **Partial (Ph.2):** AES-256-GCM column encryption `src/common/crypto/field-crypto.ts` (unit-tested; tamper/wrong-key rejected); RBAC catalogue `src/modules/access/permissions.ts` (tested). Remaining: SQLCipher on device; pgcrypto field encryption for identifiers + encrypted volumes/object storage SSE; TLS 1.3 at reverse proxy (config tested); RBAC guard | Planned |
| NFR-02 | ≤3 s P95 inference | Measured in Ph.17 with real/mock providers; reported honestly | Research target |
| NFR-03 | ≥99.5% uptime | Not measurable in prototype; health checks + restart policies only | Research target |
| NFR-04 | SUS ≥75 | Requires UAT with participants (out of dev scope) | Research target |
| NFR-05 | ≥500 concurrent users | Load test in Ph.17 | Research target |
| NFR-06 | HL7 FHIR R4 | FR-09 | Planned |
| NFR-07 | ≥80% test coverage | Coverage reports per package in CI | Planned |
| NFR-08 | Complete offline data entry | FR-03 | Planned |
| NFR-09 | 100% explainability coverage | Every AI report has a Grad-CAM/SHAP artifact or an explicit "unavailable" reason | Planned |
| NFR-10 | Safe Harbour de-identification | Ph.2: identifiers encrypted + HMAC lookup (tested). Remaining: de-identification service before AI + export; tests over all 18 identifier classes | Planned |
| NFR-11 | WCAG 2.1 AA | contrast-checked tokens, semantics labels, text scaling, 48dp targets; Flutter accessibility guideline tests | Planned |

## Ethics / compliance (§3.7)

| Requirement | Implementation | Status |
|---|---|---|
| Informed consent tracking, withdrawal | consents table, consent-gated processing | **Schema Verified (Ph.2)** (withdrawal consistency CHECK tested); gating in Ph.5 |
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
