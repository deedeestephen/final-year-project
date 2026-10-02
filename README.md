# PCa mHealth — AI-Driven Prostate Cancer Diagnosis Support (Zambia)

Final-year research prototype (ZCAS University, CCS4801). **Not a medical device. No output of this system is a clinical
diagnosis.** Any AI output labelled `MOCK` is development data. All data in this repository is **synthetic**.

- **Run it yourself:** [docs/operations-manual.md](docs/operations-manual.md) explains how every part was built and how to start, check, change and repair it, with screenshots of the code ([PDF](docs/report/PCa-mHealth-operations-manual.pdf)).
- **Try it:** [docs/how-to-test.md](docs/how-to-test.md) has plain step-by-step checks for every phase.
- **Design:** [architecture](docs/architecture.md) · [decisions (ADRs)](docs/decisions/) · [development plan](docs/development-plan.md) · [development log](docs/development-log.md)
- **Requirements:** [requirements traceability](docs/requirements-traceability.md) (every requirement, use case and ethics item, with its test and status)
- **Security:** [security](docs/security.md) · [security review](docs/security-review.md) · [access matrix](docs/access-matrix.md) (every API route and who may use it)
- **Quality:** [testing strategy](docs/testing-strategy.md) · [performance](docs/performance.md) (measured against the research targets) · [scalability and rate limits](docs/scalability.md)
- **Parts:** [mobile app](docs/mobile.md) · [database](docs/database.md) · [FHIR export](docs/fhir-export.md) · [AI model integration guide](docs/ai-model-integration-guide.md) · [chatbot plan](docs/chatbot-plan.md)

## How the project is organised

The folders follow the six layers of the architecture ([docs/architecture.md](docs/architecture.md)). Each layer folder has a README saying what is inside.

| Folder | Layer | What is inside |
|---|---|---|
| [`1-presentation-layer/`](1-presentation-layer/) | Presentation | `mobile-app/` (Flutter: patient, clinician and pathologist screens, offline capture, report viewer) and `admin-panel-web/` (React admin website with the activity dashboard) |
| [`2-api-gateway/`](2-api-gateway/) | API Gateway | `openapi/` (the REST contract and the AI contract), `reverse-proxy/` (TLS 1.3 and load balancing template), `fhir/definitions/` (the project's FHIR code systems and extension). The gateway code runs in the backend: `3-application-logic/backend/src/gateway/` |
| [`3-application-logic/`](3-application-logic/) | Application Logic | `backend/` (NestJS). `src/gateway/` (JWT, RBAC, rate limits, validation), `src/services/` (users, patients, consent, imaging, AI broker, FHIR, notifications, audit…), `src/persistence/` (database, storage and encryption code), `test/` (database, end-to-end workflow and performance tests) |
| [`4-ai-intelligence-layer/`](4-ai-intelligence-layer/) | AI Intelligence | `ai-services/` (FastAPI: Model Router, U-Net, ResNet-50, ANN, Patch-CNN+MIL, XGBoost; labelled **mock** models until real ones are trained; the chatbot's search of the reviewed knowledge base) |
| [`5-data-persistence/`](5-data-persistence/) | Data Persistence | `postgresql/` (database migrations), `mongodb/`, `dicom-archive/`, `vector-db/`, `backup-recovery/` (backup and restore scripts) |
| [`6-infrastructure/`](6-infrastructure/) | Infrastructure | `docker/` (development databases), `scripts/` (start, stop, quality gate, keys, TLS, FHIR and link checks), `kubernetes/` and `monitoring/` (plans) |
| [`docs/`](docs/) | all | architecture, decisions, security, testing, performance, how to test |

**Start everything:** `powershell -ExecutionPolicy Bypass -File 6-infrastructure\scripts\dev-up.ps1` (see [docs/how-to-test.md](docs/how-to-test.md)).

**Check everything:** `bash 6-infrastructure/scripts/quality-gate.sh all`. This runs format, lint, types, all tests (unit, database, end-to-end workflows), builds, dependency audits, the FHIR validator, the TLS check, the docs link check and the secret scan.

## Project status

| # | Phase | Status |
|---|---|---|
| 0–1 | Analysis, repository, CI and quality gate | Done (`bd5af4b`, `6520784`) |
| 2–5 | Database, API gateway, sign-in and roles, patients and consent | Done (`f70dafe`, `c32a729`, `af0dbbb`, `d3bf0be`) |
| 6–9 | Offline sync, phone app foundation, patient app, clinician and pathologist screens | Done (`5f77bd6`, `d726503`, `7c3aa00`, `e85f15a`) |
| 10–12 | Imaging and slides, AI service (mock models), explanations and evaluation | Done (`e1959f4`, `f379c26`, `0fd06c1`) |
| 13 | Chatbot: answers from a reviewed knowledge base, quoted ([ADR-009](docs/decisions/ADR-009-offline-extractive-chatbot.md)) or written by Claude from it ([ADR-010](docs/decisions/ADR-010-claude-for-chat-answers.md)) | Done for English (`21b9634`, `2841f7b`, `5f3624f`, and the docs commit); the knowledge base awaits clinician sign-off |
| 14 | FHIR R4 export and SmartCare Pro mock | Done (`dae7661`) |
| 15 | Security and compliance review | Done (`3bbb4ec`) |
| 16 | End-to-end workflows on the live system | Done (`763f1a8`) |
| 17 | Performance against the research targets | Done (`a70ecc8`) |
| 18 | Final quality audit | Done (see the [development log](docs/development-log.md)) |
| extra | Admin website, activity dashboard, dark mode, "modern health app" redesign | Done (`bfd9cfc`, `5bc85f3`, `967c988`, `0aebf4e`, `12c1d57`) |
| extra | Awareness-blue theme, modern icons and the assistant bot ([ADR-011](docs/decisions/ADR-011-awareness-blue-and-modern-icons.md)); voice messages and read-aloud ([ADR-012](docs/decisions/ADR-012-voice-input-and-read-aloud.md)) | Done (see the [development log](docs/development-log.md)) |
| extra | Proposal review: report diagrams ([report-figures.md](docs/report-figures.md)), a user-testing kit ([uat/](docs/uat/README.md)), a biomedical meaning search for the assistant ([ADR-013](docs/decisions/ADR-013-hybrid-retrieval-medcpt.md)), and push notifications ([ADR-014](docs/decisions/ADR-014-push-notifications-fcm.md)) | Done (`0fde88c`, `9104c32`, `b3dd3d4`, and the push commit); push is switched on with the owner's Firebase project |

**Still waiting for outside input:**
- **Trained AI models:** see the [integration guide](docs/ai-model-integration-guide.md). The mocks stay labelled until then.
- **Owner decisions** on paid services: SMS or e-mail delivery, and a chatbot language model.
- **A Firebase project** (free, with the owner's Google account) to switch push notifications on: [operations manual §18](docs/operations-manual.md#18-push-notifications-switching-them-on).
- **Clinical sign-off** of the chatbot's knowledge base, and **Bemba and Nyanja** translations checked by people.
- **Deployment hardening:** listed in the [security review](docs/security-review.md), R-1 to R-8.
