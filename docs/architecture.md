# System Architecture

**Project:** AI-Driven Mobile Health Platform for Enhanced Prostate Cancer Diagnosis and Detection within the Zambian Healthcare System
**Source specification:** ZCAS University research proposal (CCS4801, S. Mwiinga), text at [source/research-proposal.txt](source/research-proposal.txt), Section 3.3.
**Status:** Research prototype. No component is clinically validated.

## 1. Deviation from the proposal

The proposal specifies React Native for the Presentation Layer. This implementation uses **Flutter + Dart** instead
([ADR-001](decisions/ADR-001-flutter-mobile.md)). Only the implementation technology of Layer 1 changes. Every functional,
security, offline-first, AI, chatbot and interoperability requirement from the proposal still applies.

## 2. The six layers

```
┌──────────────────────────────────────────────────────────────────────────┐
│ L1 PRESENTATION        1-presentation-layer/                             │
│   mobile-app/ (Flutter): patient · clinician · pathologist · chatbot UI  │
│   admin-panel-web/ (React): administration (ADR-005, ADR-006)            │
│   Encrypted local DB (SQLCipher, AES-256) · sync queue · report viewer   │
└───────────────────────────────┬──────────────────────────────────────────┘
                                │ HTTPS (TLS 1.3 in prod) · REST /api/v1 · JWT
┌───────────────────────────────▼──────────────────────────────────────────┐
│ L2 API GATEWAY         2-api-gateway/ (contracts, reverse proxy)         │
│                        + backend/src/gateway/ (runs first on every call) │
│   TLS termination · JWT verify · RBAC guard · validation · sanitisation  │
│   rate limits per address and per account (Redis-shared) · CORS          │
│   security headers · versioning · OpenAPI 3.0 · errors · request IDs     │
└───────────────────────────────┬──────────────────────────────────────────┘
┌───────────────────────────────▼──────────────────────────────────────────┐
│ L3 APPLICATION LOGIC   3-application-logic/backend/src/services/         │
│   auth · users · roles/permissions · patients · clinical · consent       │
│   imaging · histopathology · AI broker · notifications · audit · sync    │
│   admin · FHIR export (Ph.14) · (chatbot Ph.13)                          │
└──────────────┬──────────────────────────────────┬────────────────────────┘
               │ HTTP contract (ai-contract.yaml) │ backend/src/persistence/
┌──────────────▼───────────────────────┐  ┌───────▼────────────────────────┐
│ L4 AI INTELLIGENCE                   │  │ L5 DATA PERSISTENCE            │
│ 4-ai-intelligence-layer/ai-services/ │  │ 5-data-persistence/            │
│  FastAPI · Model Router              │  │  PostgreSQL  structured data   │
│  U-Net · ResNet-50 · ANN ·           │  │  MongoDB     AI reports, logs  │
│  Patch-CNN+MIL · XGBoost fusion      │  │  Object store (S3 API/MinIO)   │
│  Grad-CAM · SHAP · model registry    │  │     DICOM / WSI files          │
│  fairness metrics · RAG pipeline     │  │  Vector DB (Qdrant) RAG index  │
│  (mock providers labelled as mock)   │  │  Redis  rate limits, job queue │
└──────────────────────────────────────┘  └────────────────────────────────┘
┌──────────────────────────────────────────────────────────────────────────┐
│ L6 INFRASTRUCTURE      6-infrastructure/                                 │
│   Docker Compose (dev) · scripts · CI · Kubernetes and monitoring plans  │
│   backups (5-data-persistence/backup-recovery/)                          │
└──────────────────────────────────────────────────────────────────────────┘
```

## 3. Technology choices

| Layer | Choice | Reason |
|---|---|---|
| L1 | Flutter 3 / Dart, Riverpod, go_router, Dio, Drift + SQLCipher, flutter_secure_storage, connectivity_plus | ADR-001. SQLCipher gives the AES-256 encrypted SQLite that the proposal calls for (FR-03). |
| L2+L3 | **NestJS (TypeScript, Node 20+)** | Its guards, pipes, interceptors and filters map directly onto gateway concerns, and its module system maps onto L3 services. `@nestjs/swagger` generates OpenAPI 3.0. See ADR-003. |
| L3 ORM | Prisma (PostgreSQL migrations), Mongoose (MongoDB) | Reproducible, versioned migrations. |
| L4 | **Python 3.12, FastAPI**, PyTorch / XGBoost / SHAP added once models exist | The ML ecosystem is Python. The service is isolated behind an HTTP contract. |
| L5 | PostgreSQL 16, MongoDB 7, MinIO (S3 API), Qdrant, Redis 7 | These match the persistence stores the proposal names. MinIO lets the same S3 code target AWS/Azure later. |
| L6 | Docker Compose for dev, GitHub Actions CI | Kubernetes, the WAF and CDN are production concerns and are documented, not built, in this prototype. |

## 4. Key data flows

**Offline capture → sync (UC-02, FR-03).** A form save writes to the encrypted local DB and adds a `sync_queue` row with a
client UUID, an idempotency key and a `base_version`. When connectivity is detected, `SyncService` posts batches to
`POST /api/v1/sync`. The server applies each operation idempotently. If the server version ≠ `base_version`, the server
returns a `conflict` result and does **not** overwrite. The client shows the conflict for manual resolution, and a
per-record sync log is kept.

**AI analysis (UC-05), built in Phase 11.** Clinician → `POST /api/v1/patients/{id}/ai-jobs`. The backend checks facility, `AI_ANALYSIS` consent and that a screening record exists, then creates an `ai_jobs` row (QUEUED) and answers `202`. A job queue (in-process now; Redis/BullMQ when there are several API instances) runs the job: the broker calls ai-services `POST /v1/infer` with the service token, a keyed pseudonym, clinical values and storage keys, and a timeout. The Model Router in ai-services runs every module the inputs allow and says why the others were skipped. Until trained models exist, every module is a **labelled MOCK** whose numbers depend only on the job id. The backend validates the answer against the contract, stores the report in MongoDB `ai_reports` and a timeline in `ai_inference_logs`, and marks the job SUCCEEDED, FAILED or TIMED_OUT. The client reads `GET /api/v1/ai-jobs/{id}`.

**Chatbot (UC-07), built in Phase 13 and extended by ADR-010 and ADR-013.** Question → backend safety rules (emergency and self-harm, doses, a patient's own results; always first) → small talk → AI service:
- BM25 keyword search of the reviewed knowledge base decides whether the question is covered;
- MedCPT (a PubMedBERT retriever, 768 numbers, run with numpy) orders the matching passages by meaning, and refuses an answer whose best passage is far from the question;
- the best passages are quoted, or Claude writes from them when a key is set.

Then the backend checks the answer (source, no dose), stores it and adds the disclaimer. The plan above (embedding → Qdrant top-k) was changed: with 32 passages, the vectors are kept in a file, and Qdrant stays for a larger knowledge base. Content in Bemba and Nyanja **must come from human-verified translations**. The system will not machine-translate medical content and present it as verified.

**Push notifications (ADR-014).** A change that concerns a patient (a new screening record, a consent given or withdrawn, the account linked) writes an in-app notification in the same database transaction. A push sender in the backend reads the notifications table every 2 s as an outbox:
- it claims the recent ones not yet pushed, in one statement;
- it sends each to the account's registered phones through Firebase Cloud Messaging (HTTP v1, signed in with a service account), with the notification's text only;
- it forgets phones that Firebase no longer knows.

The phone registers itself after a patient signs in (`POST /notifications/devices`) and removes itself at sign-out. Push is off until the owner's Firebase project is configured.

**Imaging (UC-03/04), built in Phase 10.** The client sends the form fields first, then one file, as multipart/form-data. The stream goes through a guard that counts bytes (size cap), hashes (SHA-256) and checks magic bytes, then straight into object storage (`StorageModule`: local files, or S3/MinIO with multipart upload). DICOM headers are read with `dicom-parser` (technical fields only) and checked against the chosen modality. Only then is the `imaging_studies` / `histopathology_specimens` row written, with an audit entry, plus a metadata copy in MongoDB `imaging_metadata`. A repeated `clientUuid` returns the existing record, so a lost connection can simply be retried (whole-file retry; byte-range resume is future work).

## 5. Security boundaries

- The mobile app holds no DB credentials or server secrets. Every authorization decision is made server-side (RBAC guard +
  per-resource ownership/facility checks).
- ai-services is reachable only from the backend (internal network plus a service token). It never receives direct
  identifiers: the backend sends de-identified inputs (Safe Harbour, NFR-10).
- The audit log is append-only. The DB role has INSERT/SELECT only, and a trigger blocks UPDATE/DELETE.

See [security.md](security.md).

**FHIR export (UC-08), built in Phase 14.**
- Administrators use the admin website's **FHIR export** page (`fhir:export`). `FhirExportService` selects only patients with the consent the purpose needs (research use, or EHR sharing for SmartCare Pro). It reads only fields that are safe after de-identification.
- The pure mapper `fhir-mappers.ts` builds a FHIR R4 `collection` Bundle: Patient (birth year), Encounter per screening visit, LOINC-coded Observations, pathology DiagnosticReports, and research-model AI reports labelled `AIAST`. Mock AI results are never exported.
- The bundle is downloaded, or sent to SmartCare Pro (`POST {base}/Bundle`, Bearer token, no redirects). Every export is audited with counts only.
- See [fhir-export.md](fhir-export.md) and ADR-007.

## 6. Deliberately out of prototype scope

These are documented but not built, because they need resources the prototype doesn't have: real SmartCare Pro connectivity
(the FHIR R4 export, adapters and a mock endpoint are built: Phase 14), Kubernetes auto-scaling, a WAF/CDN, federated learning,
production model training on Zambian data (it needs NHRA approval and data agreements), and measured 99.5% uptime.
