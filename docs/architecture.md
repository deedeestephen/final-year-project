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
│ L1 PRESENTATION   mobile/  (Flutter)       admin-web/ (React + TS)       │
│   Patient · Clinician · Pathologist/         Administration (desktop,    │
│   Radiologist · Chatbot                      responsive; ADR-005)        │
│   Encrypted local DB (SQLCipher, AES-256) · Sync queue · Report viewer   │
└───────────────────────────────┬──────────────────────────────────────────┘
                                │ HTTPS (TLS 1.3 in prod) · REST /api/v1 · JWT
┌───────────────────────────────▼──────────────────────────────────────────┐
│ L2 API GATEWAY    backend/src/gateway                                    │
│   TLS termination (reverse proxy) · JWT verify · RBAC guard · validation │
│   Rate limits per address and per account (Redis-shared; scalability.md) │
│   sanitization · rate limit · CORS · security headers · versioning       │
│   OpenAPI 3.0 · central error filter · request IDs                       │
└───────────────────────────────┬──────────────────────────────────────────┘
┌───────────────────────────────▼──────────────────────────────────────────┐
│ L3 APPLICATION LOGIC   backend/src/modules/*                             │
│   auth · users · roles/permissions · facilities · patients · clinical    │
│   consent · imaging · histopathology · ai-broker · chatbot · notif.      │
│   audit (append-only) · sync · reports · fhir · admin                    │
└──────────────┬──────────────────────────────────┬────────────────────────┘
               │ HTTP contract (ai-contract.yaml) │ repositories
┌──────────────▼───────────────────────┐  ┌───────▼────────────────────────┐
│ L4 AI INTELLIGENCE  ai-services/     │  │ L5 DATA PERSISTENCE            │
│  FastAPI · Model Router              │  │  PostgreSQL  structured data   │
│  U-Net · ResNet-50 · ANN ·           │  │  MongoDB     AI reports, logs  │
│  Patch-CNN+MIL · XGBoost fusion      │  │  Object store (S3 API/MinIO)   │
│  Grad-CAM · SHAP · model registry    │  │     DICOM / WSI files          │
│  fairness metrics · RAG pipeline     │  │  Vector DB (Qdrant) RAG index  │
│  (mock providers labelled as mock)   │  │  Redis  rate limits, job queue │
└──────────────────────────────────────┘  └────────────────────────────────┘
┌──────────────────────────────────────────────────────────────────────────┐
│ L6 INFRASTRUCTURE  infrastructure/                                       │
│   Docker Compose (dev) · Dockerfiles · K8s manifests (later) · CI        │
│   Prometheus metrics endpoint · Grafana (later) · backups                │
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

**AI analysis (UC-05).** Clinician → `POST /ai/inference` → the backend creates an `ai_job` (Postgres) and returns `202 + jobId`.
The AI broker calls ai-services `/v1/infer` with object-storage references, never raw file bytes where avoidable. The Model
Router dispatches to providers, fusion runs, and explainability artifacts are produced. The result is stored in Mongo
`ai_reports` with model versions, and the client polls `GET /ai/inference/:id`. Every result carries `provenance` =
`MOCK | RESEARCH_MODEL` plus the model version. A mock result is always rendered with
"DEVELOPMENT MOCK DATA — NOT A CLINICAL RESULT."

**Chatbot (UC-07).** Query → language detection (en / bem / nya) → embedding → Qdrant top-k (k=5) → safety filter
(diagnosis requests, self-harm, prompt injection) → LLM provider (interface; a local/extractive fallback when no LLM is
configured) → answer + cited chunks + disclaimer. Content in Bemba and Nyanja **must come from human-verified translations**.
The system will not machine-translate medical content and present it as verified.

**Imaging (UC-03/04).** Streamed multipart upload → size/MIME/magic-byte check → DICOM header parse (dcmjs) or WSI
format check → stored under a server-generated key in object storage → metadata row. Original filenames are never used
as paths.

## 5. Security boundaries

- The mobile app holds no DB credentials or server secrets. Every authorization decision is made server-side (RBAC guard +
  per-resource ownership/facility checks).
- ai-services is reachable only from the backend (internal network plus a service token). It never receives direct
  identifiers: the backend sends de-identified inputs (Safe Harbour, NFR-10).
- The audit log is append-only. The DB role has INSERT/SELECT only, and a trigger blocks UPDATE/DELETE.

See [security.md](security.md).

## 6. Deliberately out of prototype scope

These are documented but not built, because they need resources the prototype doesn't have: real SmartCare Pro connectivity
(we implement FHIR R4 export/adapters and a mock endpoint), Kubernetes auto-scaling, a WAF/CDN, federated learning,
production model training on Zambian data (it needs NHRA approval and data agreements), and measured 99.5% uptime.
