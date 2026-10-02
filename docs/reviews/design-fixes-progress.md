ALL DONE

## Summary for the owner

Branch `cloud/design-fixes` (from main). Three small fixes from review section 4:
- **UX-2:** patient screens now show dates like "20 August 2026" (home "Latest screening", results "Visit on", profile date of birth). New helper `readableDate` in `hero_header.dart` next to `longDate`; the existing `formatDate` helpers only give ISO text.
- **UX-3:** chat header subtitle is now "Reviewed answers" (clinicians: "Reviewed cards"), one line. Screen readers still hear the full sentence.
- **UX-5:** sources show by name as a tappable underlined link (48 dp), spoken as "Source: NAME, opens a web page"; the address is no longer printed. "Content status" and the disclaimer are unchanged; read-aloud still skips sources.
- **Needs your decision:** this adds the package `url_launcher` (^6.3.2) because the app could not open links before. Please run `flutter pub get` on Windows. Sources with no web address stay plain text.
- Tests: 296 passed, 1 skipped, analyze 0 issues, coverage 91.1% (minimum 80%). Not run on a real phone or emulator.
- Screenshots to retake on Windows: `docs/report/img/app-chat-*.jpg` (header and answer, incl. `app-chat-answer.jpg`), plus the patient home and results pictures if they show dates (`app-home-device.jpg` and any my-results picture). docs/report was not edited.
- Left undone: nothing in B-G. UX-4 and UX-6 not touched, as instructed. The source names come from the server (for example "NHS: PSA testing"); shorten them in the knowledge base if you want just "NHS".

# Design fixes progress (UX-2, UX-3, UX-5)

- [x] A. Baseline (Flutter 3.35.2, Dart 3.9.0, Linux): pub get ok; dart format 0 changed (108 files); flutter analyze 0 issues; flutter test 292 passed, 1 skipped (owner reported 290 on Windows).
- [x] B. UX-2: added `readableDate` (hero_header.dart, next to `longDate`; the existing `formatDate` helpers are ISO-only) and used it for latest screening (home), visit date (results) and date of birth (profile). Tests updated, one new unit test.
- [x] C. UX-3: chat header subtitle is now 'Reviewed answers' (clinician: 'Reviewed cards'), one line; screen reader says the full sentence ('Answers come from reviewed health information'). Tests updated/added; accessibility tests incl. 200% text pass.
- [x] D. UX-5: sources show by name as an underlined link (48 dp tap target; screen reader: 'Source: NAME, opens a web page'); URL is no longer printed; tap opens the browser. NEW DEPENDENCY: url_launcher ^6.3.2 (pubspec.yaml, pubspec.lock) — the app had no way to open links. Sources without an http(s) address stay plain text. 'Content status' line, disclaimer and read-aloud untouched. Tests added/updated.
- [x] E. Quality (Linux, Flutter 3.35.2): dart format 0 changed; flutter analyze 0 issues; flutter test --coverage 296 passed, 1 skipped (accessibility tests incl. 200% text pass); line coverage 91.1% (4746/5208, minimum 80%).
- [x] F. Docs: docs/mobile.md updated (results date, chat header, tappable sources).
- [x] G. Owner summary at top, `ALL DONE` first line.
