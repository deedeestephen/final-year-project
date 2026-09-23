# Development Plan

Every phase finishes only when its **quality gate** passes (format, lint/analyze, tests, build, security check), the docs,
[requirements-traceability.md](requirements-traceability.md) and [development-log.md](development-log.md) are updated, and a commit exists.
Failing tests are fixed, never skipped.

Legend: 🔀 = the phase can be split across parallel agents (separate git worktrees), because its parts touch disjoint folders.

| # | Phase | Main outputs | Depends on | Parallel? |
|---|---|---|---|---|
| 0 | Project analysis | This doc set, ADRs | – | – |
| 1 | Repo & environment | Monorepo skeleton, `.gitignore`, `.env.example`, docker-compose (pg, mongo, redis, minio, qdrant), CI workflow, smoke tests per package | 0 | – |
| 2 | Database foundation | Prisma schema + migrations for all relational entities; Mongo collections + indexes; object-store and vector-store abstractions; append-only audit trigger; synthetic seed; migrate-from-clean + reset tests | 1 | – |
| 3 | Backend foundation | NestJS bootstrap, config validation, logging (with PII redaction), error filter, validation pipe, helmet/CORS/throttling, `/api/v1`, health endpoints, OpenAPI; **freeze `openapi.yaml` and `ai-contract.yaml` v0** | 2 | – |
| 4 | AuthN/AuthZ | register/login/refresh-rotation/logout/reset, Argon2id, lockout after 5 failures (UC-01), JWT, RBAC + permissions guard, audit events, security tests | 3 | – |
| 5 | Patients & clinical data | patients, clinical records (PSA, DRE, PI-RADS, history), consent, facility scoping, DTO validation | 4 | 🔀 with 7 and 11 |
| 6 | Offline-first sync | server `POST /sync` (idempotency keys, versioning, conflicts) + Flutter Drift/SQLCipher, queue, retry/backoff, conflict UI hooks | 5, 7 | – |
| 7 | Flutter foundation | theme from the chosen design system (ADR-002), routing, auth screens, role nav, Dio client + token refresh, secure storage, connectivity, state scaffolding | 3 (contract) | 🔀 |
| 8 | Flutter patient workflow | dashboard, profile, consent, education, chatbot UI, notifications, reports | 6, 7, 13 (API stub ok) | 🔀 with 9 |
| 9 | Flutter clinician workflow | search, assessment, PSA/DRE/PI-RADS entry, imaging and histopathology submission, AI request, report viewer, Grad-CAM/SHAP views, pathologist review | 6, 7 | 🔀 with 8 |
| 10 | Imaging & files | streamed upload, validation (size/MIME/magic bytes/DICOM parse), MinIO storage, status tracking, resumable retry | 5 | 🔀 with 11 |
| 11 | AI service foundation | FastAPI, Model Router, provider interfaces for U-Net/ResNet-50/ANN/Patch-CNN+MIL/XGBoost, **clearly labelled mock providers**, model registry, backend AI broker with timeouts | 3 (contract) | 🔀 |
| 12 | Explainable AI | Grad-CAM and SHAP artifact pipeline + storage; "unavailable" states when there is no real model; fairness-metrics endpoint that reports "Evaluation data not yet available" | 11 | – |
| 13 | Chatbot / RAG | curated KB ingestion, chunking, embeddings, Qdrant, top-k, safety filter, LLM provider interface, citations, en/bem/nya handling, history | 11 | 🔀 with 10/12 |
| 14 | FHIR R4 | Patient/Observation/DiagnosticReport adapters, de-identified bundle export (UC-08), serialization tests | 5 | 🔀 |
| 15 | Security & compliance review | full review, dependency audits, secret scan, log review | all above | – |
| 16 | End-to-end tests | the 6 workflows from the master prompt, including failure paths | 15 | – |
| 17 | Performance & reliability | k6/autocannon load tests, sync stress, startup timing. Results reported as **measured vs research target** | 16 | – |
| 18 | Final quality audit | checklist audit, README, final traceability | 17 | – |

## Parallelisation strategy

Phases 0–4 run sequentially, because everything else depends on the schema, the auth model and the frozen API contracts.
After Phase 4, three independent agent streams can run at once, each in its own git worktree/branch, merged by the lead
session after its quality gate:

- **Stream A, backend:** 5 → 10 → 14
- **Stream B, mobile:** 7 → (6 client part) → 8 → 9
- **Stream C, AI:** 11 → 12 → 13

Contract changes go through the lead session only (`docs/api/openapi.yaml`, `docs/api/ai-contract.yaml`).

## Environment blockers (from Phase 0 check)

- **Docker is not installed.** It's needed for PostgreSQL, MongoDB, Redis, MinIO and Qdrant, and for integration tests
  (Testcontainers). Install Docker Desktop (WSL2 backend) before Phase 2, or run the DB phases in a cloud session.
- `gh` CLI not installed (optional; needed only to create/push the GitHub repo from the terminal).
- An LLM API key for the chatbot is **optional and costs money**. Development uses an offline extractive fallback provider,
  and no paid API is called without the owner's approval.
