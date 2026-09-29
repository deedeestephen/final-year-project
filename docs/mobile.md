# Mobile app (Flutter): Layer 1

Flutter replaces React Native (ADR-001). The colours are awareness blue and the icons Material Symbols Rounded (ADR-011, which replaced the Zambian national colours of ADR-004), with the legibility rules of ADR-002. There is no national emblem, and every sign-in screen says the app is not an official government service.

## Structure

```
1-presentation-layer/mobile-app/lib/
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
    db/                        Drift + SQLCipher database (schema v2), LocalStore
    sync/                      outbox sync engine and scheduler
    uploads/upload_queue.dart  files waiting to upload (offline-safe, retried)
    providers.dart             dependency wiring (overridden in tests)
  shared/widgets/              AsyncStateView, SyncStatusBadge, AiDisclaimerBanner,
                               ClinicalCard, PrimaryButton, OfflineBanner
  features/
    auth/                      domain (CurrentUser, roles) · data (AuthRepository)
                               · application (SessionController) · presentation
                               (login, change password, forgot password)
    home/                      role home screens + drawer (sign out, role switch)
    patients/                  offline patient register and screening records
    patient/                   the patient app (Phase 8)
    clinical_server/           consent, images and slides, AI analysis and
                               report, pathologist review (Phase 9)
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

- `test/app/accessibility_test.dart` (Phase 18) runs Flutter's accessibility guidelines on twelve screens: sign-in, the clinician, pathologist and patient homes, the patient list, Settings, and (since ADR-011 and ADR-012) the chat empty, with an answer and while recording, the clinician chat, Learn, and an article being read aloud.
  - It checks tap targets of at least 48 dp, labels on everything tappable, and the text contrast of the rendered screen, in light and dark mode.
  - It also lays each screen out at 200% text size (the WCAG "resize text" rule), which found and fixed an overflow in the sign-in header.

- Every text/background pair in `tokens.dart` is tested at a WCAG AA contrast of 4.5:1 or more.
- Body text is 15 px or larger, touch targets are 48 dp or larger, and inputs are 52 px tall.
- Severity and sync states are always written in words, never shown by colour alone.
- Loading spinners and error messages have semantic labels or live regions.
- **For people who cannot read (ADR-012):** every Learn article and every assistant answer can be read aloud by the phone, and questions can be spoken instead of typed.

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
- **Create an account.** Patients can sign up from the Sign in page. A new account shows "Almost ready" until an administrator links it to a patient record on the admin website.
- **The chatbot stays in Phase 13** (owner decision), shown on Home under "Coming later".

## Clinician and pathologist workflow (Phase 9)

These screens talk to the server directly. They need the patient's **server id**, so before the first sync the patient page shows "available after this patient has synced" instead.

- **Patient page.** Three cards under the patient's details: **Consent** (clinicians only), **Images and slides**, **AI analysis**.
- **Consent.** List, record (type, method, consent text version) and withdraw (asks first). `POST /patients/{id}/consents`, `…/withdraw`.
- **Images and slides.** Pick a file (`file_picker`), choose what it is (MRI, TRUS or CT; pathologists can also choose a slide: TIFF, SVS or NDPI, with an optional stain) and save.
  - The file goes into the **upload queue** first (`core/uploads/upload_queue.dart`, Drift table `pending_uploads`, schema v2). The queue copies it into the app's private storage, so the upload survives no connection, closing the app and the user moving the original.
  - The queue runs after every sync and when the user taps **Try now**. It sends the form fields first, then the file (as the server requires), with a progress bar.
  - Retries use the sync engine's rules: 2 s doubling to 15 min with jitter, and never sooner than `Retry-After`. Network errors, 408, 429 and 5xx are retried. Any other refusal (for example 415 "not a medical image") is shown in plain words and not retried.
  - Each file has a `clientUuid`, so a retry after a lost answer never creates a second copy on the server.
  - The private copy is deleted once the server has the file, when the user removes it, and at sign-out.
- **AI analysis.**
  - **Request AI analysis** is disabled with a plain reason when the phone is offline, AI consent is missing, or there is no synced screening record. Server refusals (`CONSENT_REQUIRED`, `AI_JOB_IN_PROGRESS`, `AI_UNAVAILABLE`, `RATE_LIMITED`) are shown in plain words.
  - While the screen is open and a job is waiting or running, it checks every 3 s for at most 2 minutes. Nothing runs in the background.
  - **AI results to review** on the clinician home lists recent analyses in the facility (`GET /ai-jobs`).
- **AI report.** `AiDisclaimerBanner` comes first ("DEVELOPMENT MOCK DATA — NOT A CLINICAL RESULT." for mock output). Then the values in the clinical number font with no good/bad colours, the modules used (with model versions) and skipped (with reasons), and the explanations: the image from `/explanations/{id}/content` when one exists, otherwise the server's reason. Accuracy is always "Evaluation data not yet available." until stored evaluations exist.
- **Pathologist review.** **Review queue** (oldest first) → slide → Gleason primary and secondary (3–5) → **Save review**. The server works out the ISUP grade group and allows one review per slide.
- **Routes.** `/patients/:id/consents` is clinician-only. `/review` and `/review/:slideId` are pathologist-only. `/patients/:id/imaging`, `/patients/:id/ai`, `/ai-jobs` and `/ai-jobs/:jobId` are for both clinical roles. Patients and administrators are redirected home.
- **The model screens are ready for the real models.** When the trained models replace the mocks, only the AI service changes ([ai-model-integration-guide.md](ai-model-integration-guide.md)); the banner switches to the research-model wording from the report's `provenance`.

## The look: "modern health app" (ADR-008), in awareness blue (ADR-011)

- **Home screens** (clinician, pathologist, administrator, patient) open with a blue gradient header (`HeroHeader`): menu, title, sync badge, then today's date, a greeting and the person's initials. Two faint circles decorate it, and a thin line from blue to the awareness light blue (`AccentLine`) runs along its rounded lower edge.
- **Icons** are Material Symbols Rounded (`Symbols.<name>_rounded`, weight 400). The selected tab's icon is filled. `test/app/icon_style_test.dart` keeps it that way.
- **Sign-in and sign-up** use the same gradient header with the "PCa" app mark.
- **Tiles:** `ActionTile` has a coloured icon square (`TintedIcon`, one of the `AccentTone` colours), a title, a description and an arrow. Tiles that are not ready yet are grey, with a "Coming in build phase …" label.
- **Colour meaning:** tile colours only tell tiles apart. They never mean good or bad, and clinical values stay in neutral ink.
- **Cards** have rounded 20 px corners. Light mode uses a soft shadow plus a hairline border; dark mode uses a border only. Patients have initials avatars in the list, on the patient page and in Profile.
- **Where it lives:** the shared pieces are in `lib/shared/widgets/hero_header.dart`, the colours in `app/theme/tokens.dart` and the shapes in `app/theme/app_theme.dart`.

## The assistant (Phase 13)

- **Where:**
  - **Patients:** a floating **Ask the assistant** button with the bot, on Home and Learn, and the **Ask a question** tile on Home.
  - **Clinicians:** the same floating button, and the **Ask the assistant** tile on their home.
  - All of them open `/chat` (`features/chat/`). Pathologists and administrators are sent back to their home.
- **The PCa Assistant bot** (`shared/widgets/assistant_avatar.dart`, ADR-011) is a robot whose head is a speech bubble, drawn in code. It appears in the chat header, next to every answer, and large on the welcome screen, where it blinks unless the phone asks for less motion. Questions are blue bubbles on the right; answers are white cards next to the bot; "typing" dots show while an answer is on its way.
- **Voice messages (ADR-012):**
  - Tap the microphone in the question box and speak. The words appear as they are heard, with a pulsing red dot and a sound-level bar. ✕ throws them away; ✓ finishes; listening also stops after 3 s of silence or 60 s. Then check the words and send.
  - It uses the phone's own speech-to-text (`speech_to_text`), in English, behind the `SpeechService` interface (`features/chat/application/voice_input.dart`).
  - It explains what to do when the microphone is refused, hides the microphone when the phone has no speech service, and says so when nothing was heard.
- **Listen:** every answer has a **Listen** button that reads the safety label, the answer and the disclaimer aloud (not the sources).
- **How it works:**
  - The first question starts a conversation; follow-ups reuse it.
  - Answers show their sources, the knowledge base's review status and the disclaimer.
  - Urgent care, declined and "no reviewed information" answers carry an icon and a word label.
  - Nothing is stored on the phone. The chat is online only: it shows an offline notice, and the send button is off while offline.
- **New chat and past chats** (owner request, 2026-09-29):
  - **New chat** (✎ in the header) starts an empty chat. The old one is kept.
  - **Past chats** (🕘) opens a sheet, *Your chats*, with every earlier chat (the first question, the time or date, the number of questions). Tapping one opens it, and it can be continued. The sheet also has a **New chat** button.
  - The empty chat shows up to three chats under *Continue a chat*.
  - The list comes from `GET /chat/conversations`, and a chat opens with `GET /chat/conversations/{id}`. Nothing is kept on the phone. Offline, the sheet says the chats could not be loaded (no automatic retries).
- **Chatting casually:** greetings (also *Muli bwanji*, *Mwashibukeni*), "how are you", "I'm fine", feeling worried or scared, "what's your name", "who made you", "are you a robot?", thanks, compliments, "tell me a joke", yes/no/ok and goodbyes all get friendly fixed replies from the server (`chat-safety.ts`). No medical content and no language model are involved. Anything that is not only small talk goes through the safety rules and the knowledge base as before.
- **Menu (⋮):** "New conversation" and "Delete conversation" (asks first, then deletes it on the server).

## Appearance: light and dark mode

- **Settings** (staff: the ☰ menu; patients: Profile › Settings) offers **Same as the phone** (default), **Light** and **Dark**.
- The choice is a phone setting, saved with `shared_preferences` (it holds nothing else) and loaded before the first frame, so the app never flashes the wrong theme. It stays after sign-out because it belongs to the phone, not to an account.
- Colours live in `AppPalette` (`app/theme/tokens.dart`), a `ThemeExtension` with a light and a dark set. Widgets read `context.colors`, never fixed colours. The awareness light blue (`accent`) is decoration only and the same in both modes, as are the bot's colours.
- **Readable in both modes:** `theme_test.dart` checks every text/background pair against WCAG AA 4.5:1 for light **and** dark. There are 30 pairs per mode, including the warning banner, the error colour, the snackbar, the gradient header and every tile colour. The app bar stays blue with white text; clinical values keep the monospaced font; the AI disclaimer keeps its amber warning look.

## Learn: listening instead of reading (ADR-012)

- Every article card has a large **▶ Listen** button (announced as "Listen to <title>"). It opens the article with `?listen=1`, which starts reading at once.
- The article has a player pinned to the bottom: **Listen / Pause / Resume**, **Stop**, **Slower voice**, and "Part 2 of 5". It reads the title and summary, each section, then the closing advice; the part being read is tinted, marked "Being read aloud" for screen readers, and scrolled into view. Sources are not read.
- The phone's own voice is used (`flutter_tts`, English, works offline on most phones) behind the `ReadAloud` interface (`shared/audio/read_aloud.dart`). `readAloudControllerProvider` makes sure only one thing is read at a time; closing the article or the chat, or changing tab, stops it.

## Phone permissions

The app asks the phone for as little as possible (checked in the built APK's merged manifest):

| Permission | Why | Asked on screen? |
|---|---|---|
| `INTERNET` | talk to the PCa mHealth server | No (Android grants it) |
| `ACCESS_NETWORK_STATE` | know when the phone is offline, to save work locally and sync later | No (Android grants it) |
| `RECORD_AUDIO` | voice messages to the assistant (ADR-012): the phone's speech service turns speech into text; the app never records or stores sound | Yes, the first time the microphone is tapped; the app works without it (type instead) |

- **Also declared:** `<queries>` for the phone's speech-to-text (`android.speech.RecognitionService`) and text-to-speech (`android.intent.action.TTS_SERVICE`) services, so Android 11 and later let the app find them. These are not permissions.
- **Not used:** camera, location, contacts, phone storage, notifications.
- **Files** are chosen with Android's own file chooser (Storage Access Framework). The app receives only the one file the user picks, so no storage permission is needed. Picked files are copied into the app's private storage and deleted after upload and at sign-out.
- **iPhone:** `NSMicrophoneUsageDescription` and `NSSpeechRecognitionUsageDescription` explain the voice messages. Nothing else that needs a usage description is used.
- **Rule for later features:** a permission is added only with the feature that needs it, asked for at the moment it is needed (not at start-up), with a plain explanation, and the app keeps working if the user says no. Likely later: notifications (push messages), and the camera only if photographing documents is ever wanted.

## Administration (moved to the web)

- Administration is a **separate web app** in `1-presentation-layer/admin-panel-web/` (ADR-005). The Flutter admin screens were removed.
- An administrator who signs in on the phone sees one card, **"Administration is on the web"**, with the portal address. The address comes from the dart-define `ADMIN_PORTAL_URL` (default `http://localhost:5173`).
- Users with more than one role (e.g. admin + clinician) still get their clinical home screens in the app.

## Rate limits in the app

- A `429` answer carries `Retry-After`. `ApiException.retryAfter` reads it, and `SyncEngine` waits at least that long before trying again (`max(backoff, Retry-After)`), so phones back off together instead of hammering the server.

## Galaxy S9+ emulator and a real phone

- **Emulator.** An Android Virtual Device `Galaxy_S9_Plus_API_29` ("Samsung Galaxy S9+ (Android 10)") is created from a custom hardware profile in `%USERPROFILE%\.android\devices.xml`: 6.2", 1080x2220 (the S9+ default display setting), 420 dpi, Android 10 / API 29, x86_64 with WHPX acceleration. Widget tests use the same logical screen size.
- **Real phone (SM-G965U, Android 10).** Run `6-infrastructure\scripts\phone-usb.ps1` (`adb reverse tcp:3000 tcp:3000`), then use the Android Studio run configuration **App - USB phone** (`API_BASE_URL=http://localhost:3000`).
- **Run configurations.** `1-presentation-layer/mobile-app/.run/`: **App - S9+ emulator** and **App - USB phone**.
- **One command starts the backend and its services:** `6-infrastructure\scripts\dev-up.ps1`. `6-infrastructure\scripts\dev-down.ps1` stops them.
- **End-to-end test on a device.** It uses throwaway synthetic accounts, so the demo accounts are never touched: `npm run e2e:user` for a clinician; `-- --role patient`, `-- --role admin` and `-- --role pathologist` for the optional flows (pass them with `E2E_PATIENT_*`, `E2E_ADMIN_*` and `E2E_PATHOLOGIST_*` `EMAIL`/`PASSWORD`). The clinician flow also records consent, uploads the synthetic MRI and opens the mock AI report; the pathologist flow uploads the synthetic slide and reviews it. The synthetic files are built into the test and given to the app through a `filePickerProvider` override, because a test cannot drive the system file chooser. The backend and the AI service must be running.
  ```
  cd 3-application-logic/backend && npm run e2e:user && npm run e2e:user -- --role pathologist
  cd 1-presentation-layer/mobile-app && flutter test integration_test -d emulator-5554 --dart-define=API_BASE_URL=http://10.0.2.2:3000 --dart-define=E2E_EMAIL=... --dart-define=E2E_PASSWORD=... --dart-define=E2E_PATHOLOGIST_EMAIL=... --dart-define=E2E_PATHOLOGIST_PASSWORD=...
  ```

## Running against the local backend

1. Start the services and the API from `3-application-logic/backend/`:
   ```
   docker compose -f ../6-infrastructure/docker/docker-compose.yml --env-file ../.env up -d
   npm run build && npm run start:prod
   ```
2. Start an Android emulator from Android Studio (Device Manager), then run from `1-presentation-layer/mobile-app/`:
   ```
   flutter run --dart-define=API_BASE_URL=http://10.0.2.2:3000
   ```
   `10.0.2.2` is the emulator's alias for the host PC. A physical phone on the same Wi-Fi needs the PC's LAN address, and a firewall rule for port 3000.
3. Sign in as `clinician@demo.pca-mhealth.test`, `patient@…` or `pathologist@…` (the admin uses the website). The password is `SEED_DEMO_PASSWORD` in `.env`.
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
| `test/core/upload_queue_test.dart` | upload queue: private copy, fields and file sent, backoff and `Retry-After`, refusal not retried, missing file, discard, sign-out deletes copies |
| `test/core/migration_test.dart` | database v1 → v2 gives exactly the v2 schema and keeps saved patients |
| `test/features/clinical_server/clinical_server_test.dart` | consent record and withdraw, a file saved offline then uploaded once, AI disabled reasons, mock report (banner, skipped modules, unavailable explanations, no metrics), pathologist review |
| `test/features/settings/settings_test.dart` | switching to dark from the menu, kept after sign-out, "Same as the phone" follows the phone, the choice saved and read back |
| `test/live/` | **opt-in** check against a running backend: `LIVE_API_URL=http://localhost:3000 LIVE_API_PASSWORD=… flutter test test/live`. It never changes the demo password. |

Quality gate: `6-infrastructure/scripts/quality-gate.sh mobile` (format, analyze, tests with coverage, debug APK).

## iPhone

Native iOS builds need macOS with Xcode, or a cloud macOS CI runner. The code has no Android-only dependencies.
