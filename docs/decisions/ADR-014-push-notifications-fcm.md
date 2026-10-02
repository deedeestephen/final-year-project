# ADR-014: Push notifications through Firebase Cloud Messaging

- **Status:** Accepted (owner request, 1 October 2026: "doall3", the push item of the proposal review in [requirements-traceability.md](../requirements-traceability.md)).
  - **Built and tested with stand-ins** for Google and Firebase.
  - **Switched on when the owner creates a Firebase project.** That needs the owner's Google account; it is free. The steps are in the [operations manual](../operations-manual.md), section 18.
- **Context:**
  - **What the proposal asks for:** a push notification engine in the presentation layer (§3.3).
  - **What the prototype had:** in-app notifications only, a list with an unread count. Patients get four kinds: a new screening record, a consent given or withdrawn, and their account linked to their clinic record. They only see them when they open the app.
  - **Rules that apply:** no health data leaves the system without need; secrets stay out of Git; paid services need the owner's approval; the app must work without push.

## Options considered

| Option | Result |
|---|---|
| **Firebase Cloud Messaging (FCM), HTTP v1 API** | **Chosen.** Free, built into every Android phone with Google services, and it can reach iPhones later (through Apple's service) |
| A self-hosted push service (ntfy, UnifiedPush) | Rejected: it needs its own server, and an extra app on each phone |
| SMS | Rejected for now: every message costs money, which is the owner's decision (README, "owner decisions") |
| The app checking in the background | Rejected: it drains the battery, and Android's power saving stops it |
| Google's `firebase-admin` package on the server | Not needed: the HTTP v1 call and Google's sign-in take about 150 lines with Node's own crypto, tested against a stand-in. No new package to audit |

## Decision

1. **The server sends from an outbox.** Notifications are made inside database transactions, so the server does not push at that point:
   - A sender looks every 2 seconds (`PUSH_POLL_MS`) for notifications not yet pushed and at most 10 minutes old (`PUSH_MAX_AGE_MIN`). It claims them in one SQL statement (`FOR UPDATE SKIP LOCKED`), so two API instances never push the same one.
   - Only committed notifications are visible, so a change that is rolled back is never announced.
   - Each notification is pushed **at most once**. A failed push is logged and not repeated; the notification stays in the app's list.
   - Older notifications, for example the ones made while push was off, stay in the app only.
   - Disabled accounts get nothing.
   - A phone that Firebase reports as unknown (`UNREGISTERED`, `SENDER_ID_MISMATCH`) is forgotten. A plain "not found" is not enough, because it could mean a wrong project id.
2. **What a push says:**
   - Only the notification's own title and text. These never contain clinical values, names or identifiers (`NOTIFICATION_TEXT` in the backend).
   - With them go the notification's id and type, so a tap can open the messages.
   - Each push asks Android to hide its text on a locked phone (`visibility: PRIVATE`). The lock screen shows that a message came, not what it says.
3. **The phones** (`push_devices`, migration `20261001120000_push_devices`):
   - `POST /api/v1/notifications/devices` registers the phone's push address (`token`, `platform`) and returns an id.
   - `DELETE /api/v1/notifications/devices/{id}` stops the pushes to that phone. Only the owner can remove it.
   - Both need `notification:read`, the permission for one's own notifications.
   - A known address moves to the account that registers it, so a phone never gets two accounts' pushes.
   - An account keeps at most 10 phones. Its phones are deleted with the account.
4. **The app** (`lib/core/push/`):
   - **Patients only,** because they are the only ones who get notifications today.
   - **After signing in,** the app asks to show notifications (Android 13 and later ask the person once), then registers the phone. A renewed address is registered again.
   - **At sign-out,** the phone is removed while the session is still valid, then the app drops its push address. When a session expires, the address is dropped too.
   - **A push while the app is open** updates the messages and their badge. **A tapped push** opens the messages.
   - **Firebase is set up from build settings** (`--dart-define-from-file=firebase-app.json`), so no `google-services.json` is needed. Without them the app builds and runs as before, without push.
   - **Android:** a white status-bar bell, and a "Messages" channel that people can switch off in the phone's settings.
5. **The key:**
   - `FCM_SERVICE_ACCOUNT_FILE` names the service-account key file from the Firebase console. It is a secret: it stays outside the repository, and `.gitignore` and the secret scan guard against committing it.
   - A key file that cannot be used stops the backend at start-up, with the reason but never the contents.
   - The address Google's sign-in is sent to must use https.
   - With no key, push is off and nothing else changes. `GET /api/v1/health/ready` says which (`checks.push`).

## Privacy

- **Google (Firebase) receives** each phone's push address and the text of each push. It does not receive health data.
- Before real patients use the app, the data-protection review must include Google as a processor, as it must for the phone's speech service (ADR-012) and Claude (ADR-010).
- A notification still tells whoever holds the phone that the person has a record at a clinic. The lock screen hides the text, but the phone should be the patient's own.

## Consequences

- Patients hear about a new screening record or a consent change without opening the app.
- **Tests:**
  - `fcm.client.spec.ts` (14): Google sign-in with a JWT checked against the key, the message, token reuse and renewal, refusals and what each one means, the key file's checks, push on and off.
  - `push.int-spec.ts` (8, real database and the whole backend, with a stand-in for Google and Firebase): registration, moving and removing phones, the 10-phone limit, a screening record pushed once and to every phone, unknown phones forgotten, and nothing for old notifications, disabled accounts or rolled-back changes.
  - `push_test.dart` (9, the app with a stand-in push service): registration after sign-in and removal before sign-out, renewed addresses, a push while open, a tap, a push that started the app, permission refused, clinicians, a failed registration, an expired session, and no Firebase settings.
- **Not tested:** real Firebase. It needs the owner's project, then the check in [how-to-test.md](../how-to-test.md).
- **Limits:**
  - A push can arrive up to 2 seconds after the change.
  - A push that fails is not sent again.
  - A phone signed out while offline keeps its push address until it is online again, or until another account signs in on it. Until then it can receive the old account's pushes, whose text says nothing about health.
  - iPhones also need an Apple push key and a Mac to build.
