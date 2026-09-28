# Layer 2: API Gateway

The single door into the system. Every request passes these checks before any business logic runs.

| Part of the diagram | Where it is |
|---|---|
| OpenAPI 3.0 RESTful endpoints | [`openapi/openapi.json`](openapi/openapi.json) (generated from the code; `npm run openapi:export`), live at `/api/docs` in development |
| Contract with the AI layer | [`openapi/ai-contract.yaml`](openapi/ai-contract.yaml) |
| FHIR R4 definitions of the project's own codes and extension (for SmartCare Pro and the HL7 validator) | [`fhir/definitions/`](fhir/definitions/) (generated; `npm run fhir:definitions`), see [docs/fhir-export.md](../docs/fhir-export.md) |
| HTTPS / TLS 1.3, request routing and load balancing | [`reverse-proxy/nginx.conf`](reverse-proxy/nginx.conf), a template for deployment |
| JWT authentication middleware | `3-application-logic/backend/src/gateway/access/jwt-auth.guard.ts` |
| RBAC permission enforcement | `…/src/gateway/access/permissions.guard.ts`, `permissions.ts` |
| Rate limiting and throttling | `…/src/gateway/http/` (per address, per account, stricter on sign-in; shared through Redis) |
| Input payload validation and sanitisation | `…/src/gateway/http/validation.ts`, `…/src/gateway/validation/`, `…/src/gateway/upload/` (file type by magic bytes) |
| API versioning, CORS policy, security headers | `…/src/gateway/configure-app.ts` (`/api/v1`, CORS allow-list, helmet/HSTS) |
| Health and readiness | `…/src/gateway/health/` |

**Why the gateway code sits inside the backend program:** in this prototype, gateway and application logic run in one NestJS process (a "modular monolith"). The gateway code has its own folder (`src/gateway/`) and runs first on every request, before any service. It could be split into a separate process later without changing the services. The reverse proxy in front of it is the part that runs separately.
