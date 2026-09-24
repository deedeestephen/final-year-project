# Mobile app (Flutter): Layer 1

Flutter replaces React Native (ADR-001). The colours are the Zambian national colours (ADR-004), with the legibility rules of ADR-002. There is no national emblem, and every sign-in screen says the app is not an official government service.

## Structure

```
mobile/lib/
  main.dart                    ProviderScope + font licence registration
  app/
    app.dart                   MaterialApp.router
    router.dart                go_router; re-runs redirects on session change
    routes.dart                route paths + resolveRedirect() (pure, unit-tested)
    theme/tokens.dart          colours, fonts, sizes, radii (+ contrast pairs)
    theme/app_theme.dart       Material 3 theme from the tokens
  core/
    config/app_env.dart        API_BASE_URL (--dart-define)
    network/api_client.dart    Dio + bearer token + single-flight refresh
    network/api_exception.dart backend error envelope → typed exception
    storage/token_store.dart   tokens in Android Keystore / iOS Keychain
    connectivity/              online/offline stream
    providers.dart             dependency wiring (overridden in tests)
  shared/widgets/              AsyncStateView, SyncStatusBadge, AiDisclaimerBanner,
                               ClinicalCard, PrimaryButton, OfflineBanner
  features/
    auth/                      domain (CurrentUser, roles) · data (AuthRepository)
                               · application (SessionController) · presentation
                               (login, change password, forgot password)
    home/                      role home screens + drawer (sign out, role switch)
```

Features are organised feature-first, each with its own domain, data, application and presentation layers. State and dependency injection use Riverpod 3.

## Session and navigation

| Session state | Allowed routes | Otherwise redirected to |
|---|---|---|
| Restoring (start-up) | `/` (splash) | `/` |
| Signed out | `/login`, `/forgot-password` | `/login` |
| Signed in, `mustChangePassword` | `/change-password` | `/change-password` |
| Signed in | `/home/<role>` for the user's own roles | home of the primary role (clinician > pathologist > admin > patient) |

Role gating in the app is a convenience only. The API enforces every permission.

- **Token refresh.** On `401 INVALID_TOKEN`, the client refreshes once (refresh-token rotation) and retries the request once.
  - Concurrent failures share one refresh.
  - If the server refuses the refresh, the tokens are cleared and the user sees "Your session has ended".
  - Being offline never ends a session.
- **Sign-out** revokes the session on the server when it is reachable, and always clears the device.
- **Offline at start-up.** If the phone has saved tokens and a cached profile, the user continues signed in and can work offline (Phase 6). Otherwise the user is asked to connect to sign in.

## Offline-first data (Phase 6)

```
screen --> LocalStore (Drift + SQLCipher) --> outbox --> SyncEngine --> POST /sync
   ^                                                         |
   +------------ watch() streams <-- mergePulled <-- GET /sync/changes
```

- **Every change goes to the phone first.** A patient registration, a screening record or a details edit is written to the encrypted database, and at the same time an **outbox** operation is queued with a random idempotency key. The screen updates straight away, online or not.
- **`SyncEngine`.** Only one sync runs at a time.
  - **When it syncs:** at sign-in, when the connection returns, when the app comes back to the foreground, every 5 minutes, and after each local save. "Sync now" skips the waiting time.
  - **Sending:** it sends the outbox in batches of 50, oldest first, then pulls server changes with a cursor.
  - **After a failure:** it waits 2 s, then doubles the wait each time, up to 15 min, with jitter.
- **Results for each operation:**
  - **APPLIED** stores the server id and version.
  - **CONFLICT** keeps both versions. The user chooses "Use my change" or "Keep server version" on the Sync screen.
  - **REJECTED** is shown with the server's reason. The change is not resent, and the user can discard it.
  - **DEPENDENCY_FAILED** (a record whose new patient failed in the same batch) waits and is retried.
- **References to patients registered offline:** until the server id is known, a patient is referenced by its client UUID. The server accepts either form.
- **Editing a patient** is possible once the server has it. Several edits made before a sync are merged into one update, so they do not conflict with each other.
- **One user per device.** When a different user signs in, the previous user's data is wiped. Sign-out also wipes it, after warning about unsent changes.
- **Encryption.** The database is SQLCipher, with a random 256-bit key held only in the Android Keystore. If the key is lost, the file is replaced by an empty database. Tests on the PC use Windows' `winsqlite3.dll` with an in-memory database; the on-device test checks that SQLCipher is really in use.

## Security in the app

- No secrets are compiled into the app. The only build setting is the API URL.
- Tokens are held only in `flutter_secure_storage` (Keystore/Keychain). They are never logged or written to plain storage.
- Sign-in errors never reveal whether an account exists. The forgot-password screen shows the same message either way.
- Cleartext HTTP is allowed **only in debug builds** and **only** to `10.0.2.2`, `localhost` and `127.0.0.1`, through `android/app/src/debug/res/xml/network_security_config.xml`. Release builds are HTTPS-only (Android default).
- Mock AI output is always labelled "DEVELOPMENT MOCK DATA — NOT A CLINICAL RESULT." (`AiDisclaimerBanner`).

## Accessibility (NFR-11)

- Every text/background pair in `tokens.dart` is tested at a WCAG AA contrast of 4.5:1 or more.
- Body text is 15 px or larger, touch targets are 48 dp or larger, and inputs are 52 px tall.
- Severity and sync states are always written in words, never shown by colour alone.
- Loading spinners and error messages have semantic labels or live regions.

## Patient app (Phase 8)

- **Tabs.** A `StatefulShellRoute` with bottom tabs **Home · Results · Learn · Messages · Profile** under `/me/...`. Only PATIENT accounts can open it; staff homes are unchanged.
- **Data.** `PatientRepository` reads `/patients/me`, `/patients/me/clinical-records`, `/patients/me/consents` and `/notifications`.
  - The last good copy of each is stored in the encrypted database (`Meta`, key `patient.*`), so every tab opens offline with an "Offline · showing what was saved on …" line.
  - Server errors are never hidden behind the saved copy.
  - The saved copies are wiped at sign-out.
- **Results** show values only: date, PSA, free PSA, DRE, PI-RADS and prostate size. Every time they are shown with the fixed note "Your clinician will explain what this means for you." There are no risk labels, colours or advice (owner decision). A widget test checks that no interpreting words appear.
- **Learn.** Six plain-English articles bundled in `assets/education/en/articles.json`.
  - Each article cites public sources (NHS, US NCI, WHO). The links were checked, and a CDC link was dropped because it could not be verified.
  - Every article is marked "Draft for review by a qualified clinician".
  - **Bemba and Nyanja are shown but disabled** until human-verified translations exist.
- **Messages.** In-app notifications with unread markers, mark as read and mark all read. An unread badge sits on the tab.
- **Profile.**
  - The patient's details.
  - **My consents** (withdrawal asks first, and says what it means for each consent type).
  - **My reports**, empty until AI reports are released (Phases 10–11).
  - Change password, which is not forced here.
  - Sign out.
- **Create an account.** Patients can sign up from the Sign in page. A new account shows "Almost ready" until a clinic links it to a patient record. The linking screen for clinicians is Phase 9.
- **The chatbot stays in Phase 13** (owner decision), shown on Home under "Coming later".

## Administration

- **Admin home.** The home screen opens **Users**, **Roles & permissions** and **Patient accounts** (`/admin/...`, administrators only).
- **Users.**
  - Search and filter by role.
  - Set roles, facility and active/disabled.
  - Unlock an account, or reset its password (a one-time password is shown once).
  - Add staff users. Patients register themselves.
- **Roles & permissions.**
  - A checklist per role, grouped by area. Saving asks first, applies to everyone with the role on their next request, and is audited. "Reset to defaults" undoes all changes.
  - The server's safety locks are shown as locked boxes:
    - ADMIN always keeps user and role management.
    - PATIENT can only have permissions about themselves.
  - Customised roles are kept by the demo seed.
- **Patient accounts.**
  - Self-registered accounts show their ID type and the last 4 characters of the ID and phone.
  - "Find record and link" matches the account's NRC hash exactly against clinic records. The admin sees only the record number and facility, never clinical data.
  - Unlinking signs the patient out.
  - Passport holders are linked by the clinic (Phase 9).

## Galaxy S9+ emulator and a real phone

- **Emulator.** An Android Virtual Device `Galaxy_S9_Plus_API_29` ("Samsung Galaxy S9+ (Android 10)") is created from a custom hardware profile in `%USERPROFILE%\.android\devices.xml`: 6.2", 1080x2220 (the S9+ default display setting), 420 dpi, Android 10 / API 29, x86_64 with WHPX acceleration. Widget tests use the same logical screen size.
- **Real phone (SM-G965U, Android 10).** Run `scripts\phone-usb.ps1` (`adb reverse tcp:3000 tcp:3000`), then use the Android Studio run configuration **App - USB phone** (`API_BASE_URL=http://localhost:3000`).
- **Run configurations.** `mobile/.run/`: **App - S9+ emulator** and **App - USB phone**.
- **One command starts the backend and its services:** `scripts\dev-up.ps1`. `scripts\dev-down.ps1` stops them.
- **End-to-end test on a device.** It uses throwaway synthetic accounts (`npm run e2e:user` for a clinician, `npm run e2e:user -- --role patient` for a linked patient; pass the second with `E2E_PATIENT_EMAIL` / `E2E_PATIENT_PASSWORD`), so the demo accounts are never touched:
  ```
  cd backend && npm run e2e:user
  cd mobile && flutter test integration_test -d emulator-5554 --dart-define=API_BASE_URL=http://10.0.2.2:3000 --dart-define=E2E_EMAIL=... --dart-define=E2E_PASSWORD=...
  ```

## Running against the local backend

1. Start the services and the API from `backend/`:
   ```
   docker compose -f ../infrastructure/docker-compose.yml --env-file ../.env up -d
   npm run build && npm run start:prod
   ```
2. Start an Android emulator from Android Studio (Device Manager), then run from `mobile/`:
   ```
   flutter run --dart-define=API_BASE_URL=http://10.0.2.2:3000
   ```
   `10.0.2.2` is the emulator's alias for the host PC. A physical phone on the same Wi-Fi needs the PC's LAN address, and a firewall rule for port 3000.
3. Sign in as `clinician@demo.pca-mhealth.test`, `patient@…`, `pathologist@…` or `admin@…`. The password is `SEED_DEMO_PASSWORD` in `.env`.
   - Demo accounts must change their password on first sign-in.
   - Changing it on the dev database means the `.env` value no longer works for that account. Re-running `npm run db:seed` does not reset existing passwords.

## Tests

| Suite | What it covers |
|---|---|
| `test/app/theme_test.dart` | contrast, font sizes, touch targets |
| `test/core/api_client_test.dart` | bearer header, envelope parsing, offline, refresh + retry, single-flight refresh, refused refresh signs out |
| `test/features/auth/session_test.dart` | `CurrentUser`, `AuthRepository` requests, `SessionController` lifecycle |
| `test/app/routes_test.dart` | every redirect rule, including cross-role access |
| `test/widget_test.dart` | full app against a scripted backend: validation, each sign-in error, role homes, forced password change, forgot password, sign-out, offline banner |
| `test/shared/widgets_test.dart` | shared widgets (AI disclaimer and mock label, sync badge, async states) |
| `test/live/` | **opt-in** check against a running backend: `LIVE_API_URL=http://localhost:3000 LIVE_API_PASSWORD=… flutter test test/live`. It never changes the demo password. |

Quality gate: `scripts/quality-gate.sh mobile` (format, analyze, tests with coverage, debug APK).

## iPhone

Native iOS builds need macOS with Xcode, or a cloud macOS CI runner. The code has no Android-only dependencies.
