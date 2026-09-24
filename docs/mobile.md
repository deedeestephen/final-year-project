# Mobile app (Flutter): Layer 1

Flutter replaces React Native (ADR-001). The design system is Option 2 "Clinical Trust" with Option 1 legibility rules (ADR-002).

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
- **Offline at start-up.** The saved tokens are kept, but the user is asked to connect to sign in.
  - Phase 6 adds an encrypted local profile cache so offline work can continue.

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
