# PCa mHealth — AI-Driven Prostate Cancer Diagnosis Support (Zambia)

Final-year research prototype (ZCAS University, CCS4801). **Not a medical device. No output of this system is a clinical
diagnosis.** Any AI output labelled `MOCK` is development data.

- Architecture: [docs/architecture.md](docs/architecture.md)
- Plan and phases: [docs/development-plan.md](docs/development-plan.md)
- Requirements traceability: [docs/requirements-traceability.md](docs/requirements-traceability.md)
- Security: [docs/security.md](docs/security.md) · Testing: [docs/testing-strategy.md](docs/testing-strategy.md)
- Scalability and rate limits: [docs/scalability.md](docs/scalability.md)
- Decisions: [docs/decisions/](docs/decisions/) · Log: [docs/development-log.md](docs/development-log.md)

Layout (created in Phase 1): `mobile/` (Flutter) · `admin-web/` (React + TypeScript admin portal) · `backend/` (NestJS gateway + services) · `ai-services/` (FastAPI) ·
`database/` · `infrastructure/` · `scripts/` · `tests/` (end-to-end).
