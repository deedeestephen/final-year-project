# ADR-003: NestJS (TypeScript) backend, Python FastAPI AI services

- **Status:** Proposed (awaiting owner confirmation)

## Context
The proposal fixes the architecture (6 layers, REST/OpenAPI 3.0, JWT, RBAC, PostgreSQL, MongoDB, a DICOM archive, a
vector DB) but not the backend language. The AI layer must be isolated behind an API contract (§3.3.1).

## Options considered
1. **NestJS + Prisma + Mongoose** for L2/L3; FastAPI for L4. Two languages. Guards, pipes, filters and interceptors map
   one-to-one onto the gateway duties, and modules map onto L3 services. Mature Swagger generation.
2. FastAPI for everything. One language, but the gateway/RBAC structure has to be hand-built, and it would be easier
   to blur the L3/L4 boundary.
3. Django REST. Heavy, and a weaker fit for async AI orchestration.

## Decision
Option 1. The language boundary between the backend and ai-services enforces the architectural isolation the proposal
wants: the backend can't import model code, only call the contract.

## Consequences
- Node ≥ 20 and Python ≥ 3.11 are both required (both are already installed).
- Shared contracts live in `2-api-gateway/openapi/*.yaml`. Contract tests run on both sides.
