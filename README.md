# PCa mHealth — AI-Driven Prostate Cancer Diagnosis Support (Zambia)

Final-year research prototype (ZCAS University, CCS4801). **Not a medical device. No output of this system is a clinical
diagnosis.** Any AI output labelled `MOCK` is development data.

- Architecture: [docs/architecture.md](docs/architecture.md)
- Plan and phases: [docs/development-plan.md](docs/development-plan.md)
- Requirements traceability: [docs/requirements-traceability.md](docs/requirements-traceability.md)
- Security: [docs/security.md](docs/security.md) · Testing: [docs/testing-strategy.md](docs/testing-strategy.md)
- Scalability and rate limits: [docs/scalability.md](docs/scalability.md)
- Decisions: [docs/decisions/](docs/decisions/) · Log: [docs/development-log.md](docs/development-log.md)

## How the project is organised

The folders follow the six layers of the architecture ([docs/architecture.md](docs/architecture.md)). Each layer folder has a README saying what is inside.

| Folder | Layer | What is inside |
|---|---|---|
| [`1-presentation-layer/`](1-presentation-layer/) | Presentation | `mobile-app/` (Flutter: patient, clinician and pathologist screens, offline capture, report viewer) and `admin-panel-web/` (React admin panel) |
| [`2-api-gateway/`](2-api-gateway/) | API Gateway | `openapi/` (the REST contract and the AI contract), `reverse-proxy/` (TLS 1.3 and load balancing template). The gateway code runs in the backend: `3-application-logic/backend/src/gateway/` |
| [`3-application-logic/`](3-application-logic/) | Application Logic | `backend/` (NestJS). `src/gateway/` (JWT, RBAC, rate limits, validation), `src/services/` (users, patients, consent, imaging, AI broker, notifications, audit…), `src/persistence/` (database, storage and encryption code) |
| [`4-ai-intelligence-layer/`](4-ai-intelligence-layer/) | AI Intelligence | `ai-services/` (FastAPI: Model Router, U-Net, ResNet-50, ANN, Patch-CNN+MIL, XGBoost; labelled **mock** models until real ones are trained) |
| [`5-data-persistence/`](5-data-persistence/) | Data Persistence | `postgresql/` (database migrations), `mongodb/`, `dicom-archive/`, `vector-db/`, `backup-recovery/` (backup and restore scripts) |
| [`6-infrastructure/`](6-infrastructure/) | Infrastructure | `docker/` (development databases), `scripts/` (start, stop, quality gate, keys), `kubernetes/` and `monitoring/` (plans) |
| [`docs/`](docs/) | all | architecture, decisions, security, testing, how to test |

**Start everything:** `powershell -ExecutionPolicy Bypass -File 6-infrastructure\scripts\dev-up.ps1` (see [docs/how-to-test.md](docs/how-to-test.md)).
