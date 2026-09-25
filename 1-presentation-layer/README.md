# Layer 1: Presentation

What people see and touch.

| Folder | What it is | Parts of the architecture diagram |
|---|---|---|
| [`mobile-app/`](mobile-app/) | Flutter app for Android and iOS | Patient portal, clinician dashboard, pathologist interface, offline-first data capture (AES-256 SQLCipher database), notifications, responsive UI (WCAG 2.1), chatbot chat interface (Phase 13), report viewer |
| [`admin-panel-web/`](admin-panel-web/) | React + TypeScript website for administrators (ADR-005) | Admin panel: users, roles and permissions, patient-account linking |

Both talk only to the API gateway (Layer 2) over HTTPS. Neither holds any secret: the phone keeps its tokens in the Android Keystore / iOS Keychain, and the website keeps its long-lived session in an HttpOnly cookie.

How to run and test them: [docs/how-to-test.md](../docs/how-to-test.md).
