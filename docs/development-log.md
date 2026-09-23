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
