# Design fixes progress (UX-2, UX-3, UX-5)

- [x] A. Baseline (Flutter 3.35.2, Dart 3.9.0, Linux): pub get ok; dart format 0 changed (108 files); flutter analyze 0 issues; flutter test 292 passed, 1 skipped (owner reported 290 on Windows).
- [x] B. UX-2: added `readableDate` (hero_header.dart, next to `longDate`; the existing `formatDate` helpers are ISO-only) and used it for latest screening (home), visit date (results) and date of birth (profile). Tests updated, one new unit test.
- [ ] C. UX-3: chat header subtitle fits
- [ ] D. UX-5: sources shown by name
- [ ] E. Quality: format, analyze, tests, coverage
- [ ] F. Docs: docs/mobile.md
- [ ] G. Owner summary at top, then `ALL DONE` as first line
