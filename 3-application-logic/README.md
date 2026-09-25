# Layer 3: Application Logic

The backend program ([`backend/`](backend/), NestJS + TypeScript). It is one process with three clearly separated parts, one folder for each architecture layer it touches:

| Folder | Layer | What is inside |
|---|---|---|
| `backend/src/gateway/` | 2, API Gateway | JWT guard, RBAC guard, rate limiting, validation and sanitisation, upload checks, CORS, versioning, security headers, error envelope, health |
| `backend/src/services/` | **3, Application Logic** | see the table below |
| `backend/src/persistence/` | 5, Data Persistence (access code) | PostgreSQL (Prisma) and MongoDB clients, object storage (DICOM archive), vector store, AES-256 field encryption, seed |

`src/config/` validates the configuration, and `src/app.module.ts` puts the parts together.

## Services (Layer 3 of the architecture diagram)

| Part of the diagram | Folder in `backend/src/services/` |
|---|---|
| User & role management service | `auth/`, `users/`, `admin/` |
| Data orchestration service | `patients/`, `clinical/` (records, consent), `sync/` (offline sync), `imaging/` (imaging and slides) |
| AI inference broker (multi-module coordination and timeout handling) | `ai/` (broker, job queue, reports) |
| Notification & alert service | `notifications/` |
| Audit log service (immutable) | `audit/` (with the append-only, hash-chained table in Layer 5) |
| Chatbot NLP engine | Phase 13 (not built yet) |
| EHR integration service (HL7 FHIR R4) | Phase 14 (not built yet) |

Run, test and build: see [`backend/`](backend/) scripts, `6-infrastructure/scripts/quality-gate.sh backend`, and [docs/how-to-test.md](../docs/how-to-test.md).
