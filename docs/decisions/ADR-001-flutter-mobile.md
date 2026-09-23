# ADR-001: Flutter + Dart for the Presentation Layer

- **Status:** Accepted (project owner decision, 2026-09-23)
- **Supersedes:** proposal §3.3.2 "React Native"

## Context
The proposal specifies a cross-platform React Native app. The project owner has chosen Flutter instead. Android is the
primary target, with iOS where practical.

## Decision
Build Layer 1 in Flutter/Dart with a feature-first clean architecture (presentation / domain / data per feature):
Riverpod (state + DI), go_router (role-aware routing), Dio (HTTP + interceptors for auth refresh), Drift over
SQLCipher (AES-256 encrypted local DB), flutter_secure_storage (keys, tokens), connectivity_plus (network detection).

## Consequences
- Every requirement stays unchanged: offline-first AES-256 storage (FR-03), TLS/JWT API use, RBAC (enforced server-side),
  FHIR via the backend, WCAG 2.1 AA (NFR-11).
- Flutter compiles ahead-of-time to native code, with no JS bridge. That helps on the entry-level Android devices named in
  the design brief.
- SQLCipher adds about 3–4 MB of native libraries per ABI. This is acceptable.
- The dissertation text should note this deviation and cite this ADR.
