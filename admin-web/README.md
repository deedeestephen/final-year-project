# PCa mHealth · Admin web app

The administration portal: users, roles & permissions, and linking patient accounts. It is a React 19 + TypeScript single-page app built with Vite. See [ADR-005](../docs/decisions/ADR-005-admin-web-app.md).

Only ADMIN accounts can sign in. Clinicians and patients use the mobile app.

## Run it
```
npm ci
npm run dev        # http://localhost:5173 (the backend must be running on :3000)
```
`scripts\dev-up.ps1` does both for you. Set `VITE_API_BASE_URL` to use another API address. The backend's `CORS_ORIGINS` must include this site's address.

## Checks
```
npm run format:check && npm run lint && npm run typecheck && npm test && npm run build
```
The same checks run in `scripts/quality-gate.sh admin-web`.

## How it is organised
- `src/api/client.ts`: the HTTP client
  - access token in memory only
  - refresh token in an HttpOnly cookie (`X-Client: web`)
  - single-flight refresh
  - `Retry-After` parsing
- `src/api/admin.ts`: typed admin endpoints (these mirror `docs/api/openapi.json`)
- `src/auth/`: the session (restore, sign in, forced password change, sign out)
- `src/pages/`: Users, Roles & permissions, Patient accounts
- `src/index.css`: Zambian flag design tokens (ADR-004) and the responsive layout
