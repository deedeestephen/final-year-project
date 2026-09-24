# ADR-005: Administration is a separate web app (React + TypeScript)

- **Status:** Accepted (owner request, 2026-09-24). Replaces the admin screens that were in the Flutter app (commit `c03e70d`).
- **Context:** The owner asked for administration to be separate from the mobile app. It should be a web app used on a desktop, and it should still work on smaller screens.

## Decision
- **The admin portal lives in `admin-web/`.** It is a single-page app built with Vite, React 19 and TypeScript (strict), plus:
  - React Router for pages
  - TanStack Query for server data (caching and retry for network errors only)
  - Vitest with Testing Library for tests
- **The mobile app no longer has admin screens.** An administrator who signs in on a phone sees one card, "Administration is on the web", with the portal address (`ADMIN_PORTAL_URL`).
- **The portal uses the same API and the same permission checks as the app.** The backend does not trust the portal: every admin action is still checked against `user:manage` / `role:manage` and audited. Only accounts with the ADMIN role may use the portal; other accounts are signed out with an explanation.
- **Responsive layout:**
  - over 900 px: a fixed sidebar
  - under 900 px: a Menu button opens the sidebar
  - under 700 px: tables become stacked cards, each value labelled
  - buttons at least 48 px tall; inputs 52 px (ADR-006)
- **Design:** the "Clinical Field Health" design system (ADR-006), with the Zambian flag stripe, the "not an official government service" notice and no emblem, as in ADR-004.

## How the portal signs in (web session)
The mobile app keeps its refresh token in encrypted storage. A browser has no equivalent place that page scripts cannot reach, so:
- **Access token:** kept in memory only (never in `localStorage`), and lasts 15 minutes.
- **Refresh token:** the portal sends `X-Client: web`. For those requests the server puts the refresh token in an **HttpOnly, SameSite=Strict cookie**, scoped to `/api/v1/auth` and `Secure` in production, and leaves it out of the JSON body. Page scripts cannot read it, so a cross-site-scripting bug cannot steal a long-lived session.
- **CSRF:** a cookie is only accepted together with the custom `X-Client: web` header. Another site can't send that header across origins unless CORS allows it, and CORS only allows the origins in `CORS_ORIGINS`. SameSite=Strict is a second barrier.
- **Refreshing:**
  - Refresh-token rotation and reuse detection work exactly as for the app.
  - Concurrent requests share one refresh (single flight), so the portal never presents an already-rotated token.
  - Refresh is **not** in the strict login rate-limit bucket: the portal refreshes on every page load, and a refresh token is a 256-bit random value with nothing to guess. The per-IP limit still applies.
- **Mobile clients** (no `X-Client: web`) are unchanged: the refresh token is still returned in the body.

## Alternatives considered
- **Flutter web build of the existing admin screens.** This reuses code, but has a heavy first load, weaker browser accessibility (canvas rendering), and still needs a browser session design. The owner chose React + TypeScript.
- **Server-rendered pages inside the NestJS backend.** This would mix the UI into the API process and scale them together. A static SPA can be served from any CDN.

## Consequences
- Two front-end code bases (Flutter and React) share only the API contract. `docs/api/openapi.json` is the source of truth; the portal's types in `admin-web/src/api/admin.ts` mirror it.
- The portal is static files (`npm run build` produces `admin-web/dist/`, about 100 kB gzipped). It can be hosted on any static host or CDN and scales separately from the API.
- For the SameSite=Strict cookie, in production the portal and the API must be **same-site** (for example `admin.example.org` and `api.example.org`). This holds in development: `localhost:5173` and `localhost:3000` are the same site.
- The quality gate has an `admin-web` target: format, lint (warnings fail), typecheck, tests, build, npm audit.
