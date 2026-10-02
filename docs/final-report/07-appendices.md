# Appendix A: Requirements Traceability Summary

This appendix summarises the project's requirements traceability matrix (`docs/requirements-traceability.md`), which records for every requirement the component, the implementation, the tests and the phase. In the matrix, "Verified" means that a passing automated test demonstrates the requirement; nothing is marked Verified without one.

Table A.1: Functional requirements

| ID | Requirement (summary) | Status | Notes |
|---|---|---|---|
| FR-01 | JWT authentication, RBAC for four roles, lockout after five failures | Verified | 25 integration tests for authentication, plus token and password unit tests |
| FR-02 | Capture and transmit clinical data, encrypted, over TLS 1.3 | Verified | Backend, app forms, TLS 1.3 at the reverse proxy, end to end |
| FR-03 | Offline entry, AES-256 local database, conflict-resolving synchronisation | Verified | Server, app and on-device tests |
| FR-04 | Accept and validate DICOM scans, archive and queue them | Verified | Upload, validation and archive; AI receives de-identified copies only |
| FR-05 | PCa probability and grade group within 3 s at P95 | Pipeline verified with mock models only | 545 ms P95 under load; no trained model, so no real probability or grade |
| FR-06 | Grad-CAM and SHAP explanations | Pipeline verified | With mock models every explanation is an honest "unavailable" reason |
| FR-07 | RAG chatbot within 2 s, English, Bemba and Nyanja | Verified for English | P95 514 ms; Bemba and Nyanja answer "not available"; knowledge base awaits clinician sign-off |
| FR-08 | Render AI reports | Verified with mock output | Banner first, values, modules used and skipped, explanations or reasons; heatmaps when a trained model supplies them |
| FR-09 | De-identified FHIR R4 export for SmartCare Pro | Verified | HL7 validator 0 errors; sent to a SmartCare Pro stand-in |
| FR-10 | Immutable, time-stamped audit log | Verified | Append-only triggers, hash chain, viewer with integrity check |
| FR-11 | Disaggregated AI metrics by age, region and stage | Verified on test figures | "Evaluation data not yet available" until a trained model is evaluated |
| FR-12 | Retraining, model registry, A/B testing | Partial | Registry and versions verified; retraining and A/B testing are future work |

Table A.2: Non-functional requirements

| ID | Target | Status | Notes |
|---|---|---|---|
| NFR-01 | AES-256 at rest, TLS 1.3, RBAC | Verified for the prototype | Deployment items (managed keys, encrypted object storage, database TLS) remain, risk R-4 |
| NFR-02 | AI ≤ 3 s at P95 | Met for the pipeline with mock models | 545 ms under load; 1,027 ms for a burst of 20; to be re-measured with trained models |
| NFR-03 | ≥ 99.5% uptime | Not measurable in the prototype | Health checks and restart policies only |
| NFR-04 | SUS ≥ 75 | Not done | Kit prepared; sessions need ethics approval |
| NFR-05 | ≥ 500 concurrent users | Met in practice | 500 users, 0 errors, P95 156 ms |
| NFR-06 | HL7 FHIR R4 | Verified | Official validator, 0 errors |
| NFR-07 | ≥ 80% test coverage | Verified | Every package has a minimum of 80% that fails the gate |
| NFR-08 | Complete offline data entry | Verified for registration and screening records | 100 phones × 20 changes, none lost or saved twice |
| NFR-09 | 100% explainability coverage | Verified | Every module that ran has an explanation or an explicit reason, enforced by the contract and a database constraint |
| NFR-10 | Safe Harbor de-identification | Verified | FHIR export, AI requests and scan copies; slides held back until slide de-identification exists (R-1) |
| NFR-11 | WCAG 2.1 AA | Partial | Contrast, target size, labels and 200% text tested on twelve screens; a test with screen-reader users remains |

Table A.3: Ethics and compliance items (proposal §3.7)

| Requirement | Status |
|---|---|
| Informed consent tracking and withdrawal | Verified; AI analysis requires active consent |
| Data minimisation and role-limited access | Verified |
| Fairness monitoring (AUC gap above 0.05 flagged) | Verified on test figures; needs real evaluations |
| Data residency | Documented as a deployment constraint |
| No fabricated results | Verified: provenance required by the database, mock label on every result and screen, no invented explanations or metrics |

Table A.4: Gaps against the proposal for the phone app and the assistant (review of 1 October 2026)

| Proposal | Prototype | What closing the gap needs |
|---|---|---|
| React Native app | Flutter app (ADR-001) | Nothing to build; explained in Section 3.2.4 |
| Android and iOS | Android only | A Mac with Xcode to build and test |
| Push notification engine | Built (ADR-014), tested with stand-ins | The owner's Firebase project |
| Patients see their AI report | "My reports" is empty | Trained models and a clinician's sign-off |
| Grad-CAM and SHAP on the report | The screen shows why each is unavailable | Trained models |
| UAT with SUS ≥ 75 and a screen-reader test | Not done; kit prepared | Ethics approval and participants |
| Speech to text with a real voice | Works with a stand-in; not confirmed with a real voice | A person speaking to the phone |
| Semantic retrieval with 768-dimension biomedical embeddings | Closed for retrieval with MedCPT (ADR-013) | A fine-tuned generator is not planned; quoting or Claude writes from reviewed passages |
| English, Bemba and Nyanja | English only | Human-verified translations |
| Clinician-validated, HBM-structured knowledge base | Draft content; some HBM themes; no practical barriers | Content written or reviewed by a clinician |
| Chatbot think-aloud test | Not done | Participants |

# Appendix B: Test Summary

Table B.1 lists the main test suites by area, with the counts recorded in the development log when each was last reported. The total counts on 1 October 2026 are in Table 4.5.

Table B.1: Main test suites

| Area | Suite (file) | What it checks |
|---|---|---|
| Authentication | `auth.int-spec.ts` (25) | Sign-in, lockout, tokens, rotation and reuse, password reset, RBAC, escalation attempts |
| Patients and consent | `patients.int-spec.ts` | Registration, encryption of identifiers, facility scoping, audit of access |
| Offline synchronisation | `sync.int-spec.ts` (14 when added); app `sync_test.dart` | Replay, conflicts, partial batches, per-operation permissions, pull with cursor, back-off and `Retry-After` |
| Imaging | `imaging.int-spec.ts` (11) | Streamed upload, size cap, file type by content, DICOM checks, MinIO path, de-identified copies |
| AI pipeline | `ai.int-spec.ts` (11), AI service tests | Consent gate, pseudonymised inputs, contract validation, mock labels, explanations, evaluation and fairness |
| Fairness | `fairness.spec.ts` (5) | AUC gaps above 0.05 flagged; small groups listed, not compared |
| FHIR export | `fhir.int-spec.ts` (33), `fhir-mappers.spec.ts`, `smartcare.client.spec.ts` | One test per Safe Harbor class, consent selection, mock exclusion, time-outs, refused redirects |
| Audit log | `audit-log.int-spec.ts` (7) | Viewer, integrity check, tamper detection inside a rolled-back transaction |
| Administration | `admin.int-spec.ts`, `users-and-edges.int-spec.ts`, `activity.int-spec.ts` (5) | Roles and locks, separation of duties, linking, deletion rules, dashboard counts without patient details |
| Rate limits | `rate-limit.int-spec.ts` | Per-account limit, Redis-shared counters across two instances, fail-open, web session cookie |
| Assistant | `chat-safety.spec.ts`, `chatbot.int-spec.ts` (11), AI service `test_chat.py`, `test_meaning.py`, `test_embeddings.py`, `test_chat_claude.py` | 34-prompt red-team set, 40 small-talk phrases, retrieval quality set (at least 90% right at the first passage), meaning search, quoted answers, Claude with a fake client |
| Push notifications | `fcm.client.spec.ts` (14), `push.int-spec.ts` (8), app `push_test.dart` | Google sign-in, message content, at-most-once outbox, phone registration and removal |
| Live workflows | `system.workflow-spec.ts` (13 in Phase 16) and workflow 7 | Six workflows and the assistant on the live system; log review |
| Phone app | `accessibility_test.dart` (18), `theme_test.dart`, `chat_test.dart`, `chat_history_test.dart` (6), `read_aloud_test.dart` (6), `patient_app_test.dart`, `icon_style_test.dart` | Accessibility guidelines, contrast in both modes, chat, voice, read-aloud, patient app, icon style |
| Device | `integration_test/app_flow_test.dart` | Clinician, patient, administrator and pathologist flows on the emulator, SQLCipher in use |
| Admin website | `App.test.tsx` (17), `DashboardPage.test.tsx` (11), `FhirExportPage.test.tsx` (6), `UsersPages.test.tsx`, `contrast.test.ts` | Session, permissions, dashboard, export, deletion, contrast of every token pair |
| Performance | `system.perf-spec.ts` (`npm run perf`) | Baseline, 500 users, stress, AI under load and in a burst, synchronisation stress, start-up |

Table B.2: Performance results in brief (development laptop, synthetic data)

| Stage | Result |
|---|---|
| Baseline, 25 users | About 4.9 requests a second; P95 41 ms; 0 errors |
| Main run, 500 users | About 98 requests a second; P95 156 ms; P99 269 ms; 0 errors |
| Stress, 500 users acting about once a second | About 133 requests a second (saturation of one instance); P95 5,146 ms; 0 errors |
| AI analyses, one a second during the main run | 60 jobs, 0 failed; P95 545 ms end to end |
| AI analyses, 20 at once | 20 jobs, 0 failed; P95 1,027 ms |
| Synchronisation, 100 phones × 20 changes | 2,000 changes saved, 0 errors; all 2,000 recognised when sent again |
| Assistant, 100 clinicians | P95 514 ms with the meaning search; P95 43 ms with keywords only; 0 errors |
| Sign-in, 500 accounts, 25 at a time | All done in 39.5 s (Argon2id) |
| Start-up | Backend 3.8 s; AI service 1.4 s; phone app 1.7 s median on the emulator |

# Appendix C: User Acceptance Testing Kit Summary

The kit is in `docs/uat/`, with a printable version in `docs/uat/PCa-mHealth-UAT-kit.pdf`. It may only be used after ethics approval.

Table C.1: Documents in the kit

| Document | Purpose |
|---|---|
| Plan (`README.md`) | Aims, ethics, participants, preparation, how a session runs, analysis, and what the test cannot show |
| Information sheet and consent form | Given to every participant before the session; a witness line for people who cannot read |
| Task sheets for patients, clinicians, pathologists and administrators | Tasks read aloud, success criteria, and columns for time, help level and notes; interview questions |
| SUS questionnaire | The ten statements, how to give them (including reading aloud), and how to score them |
| Results template | Tables for task success and time, SUS by group, problems by severity, themes, and read-aloud and voice results |

Table C.2: Participants and tasks

| Group in the proposal | Account used | Tasks |
|---|---|---|
| Patients (men aged 40 and over, including some with limited reading skills) | Patient | 14 (P-1 to P-14): create an account, sign in, find the last screening and PSA result, read and listen to an article, ask the assistant by typing and by voice, find an answer's source, listen to an answer, small talk, start and reopen a chat, read a message, find where to withdraw consent |
| Urologists, general practitioners, nursing staff, radiographers | Clinician | 11 (C-1 to C-11): sign in, register a patient and record a screening offline, a timed registration under pressure (target under 3 minutes), synchronise, record consent, add a scan offline, request and read an AI analysis and say how far they would rely on it, ask the assistant, find the facility's AI results |
| Pathologists | Pathologist | 6 (H-1 to H-6): sign in, add a slide, find the review queue, review a slide, read the grade group, read an AI report |
| Administrators (optional) | Admin website | 7 (A-1 to A-7): create an account, reset a password, link a patient account, delete an account, check the audit log's integrity, export FHIR data, read the dashboard |

**Session.** About 45 minutes for one participant: welcome and consent (5 minutes), background questions (3), a practice task (2), the tasks with think-aloud (20–25), the SUS (5), an interview (5–10) and the close (1). Help is recorded per task at four levels: none, a hint, shown by the facilitator, or gave up. A task succeeds when its criterion is met with no help or a hint.

**Analysis.** Task success rate per task and group; median time on task; the SUS score of each form (statements 1, 3, 5, 7 and 9 score the answer minus 1; statements 2, 4, 6, 8 and 10 score 5 minus the answer; the sum is multiplied by 2.5), reported as mean, standard deviation and range per group against the target of 75; the problems found, rated on Nielsen's severity scale from 0 (not a problem) to 4 (catastrophic); and a thematic analysis of the think-aloud notes and interviews.

**What the test cannot show.** The AI results are labelled mock output, so the test can show whether people understand and trust the report's layout and labels, not whether the AI is right. The knowledge base is a draft. The app is in English, so patients who prefer Bemba or Nyanja may need an interpreter, which the session notes should record.

[UAT RESULTS: to be added after the sessions, from the completed results template.]

# Appendix D: User Guide

The complete user guide, system guide and installation manual for the prototype are in the project repository. They are not reproduced here because of their length.

Table D.1: Where to find the user documentation

| Document | Location | Contents |
|---|---|---|
| Operations manual | `docs/operations-manual.md`; PDF in `docs/report/PCa-mHealth-operations-manual.pdf`; web page in `docs/report/operations-manual.html` | The system on one page; installed tools; starting and stopping; the settings file; the backend, databases, Docker and AI service; the chatbot end to end; the phone app; the admin website; tests and the quality gate; Git; troubleshooting; what is needed before real patients; updating the manual; switching on push notifications |
| Manual test guide | `docs/how-to-test.md` | Plain step-by-step checks of every phase and feature, on the computer, the emulator and a real Android phone |
| Report figures | `docs/report-figures.md`; PDF in `docs/report/PCa-mHealth-report-figures.pdf` | Every figure of this report, with its caption and its source files (PNG for Word, SVG for editing) |
| Architecture and decisions | `docs/architecture.md`; `docs/decisions/` | The six layers, the data flows, and the fourteen decision records |
| Requirements traceability | `docs/requirements-traceability.md` | Every requirement, use case and ethics item, with its implementation, tests and status |
| Security | `docs/security.md`, `docs/security-review.md`, `docs/access-matrix.md` | Security design, the Phase 15 review, and every API route with its rule |
| Performance | `docs/performance.md`, `docs/scalability.md` | Measurements against the research targets, and the rate limits |
| AI model integration | `docs/ai-model-integration-guide.md` | What each trained model must provide and how it replaces its mock |
| User acceptance testing | `docs/uat/` | The kit summarised in Appendix C |

# Appendix E: Architecture Decision Records

Table E.1: The fourteen architecture decision records

| Record | Decision | Status |
|---|---|---|
| ADR-001 | Flutter and Dart for the presentation layer, instead of React Native | Accepted |
| ADR-002 | Mobile design system: "Clinical Trust" with stronger legibility rules | Accepted; its legibility rules still apply |
| ADR-003 | NestJS (TypeScript) backend and a Python FastAPI AI service | Marked "Proposed" in the record; implemented as described |
| ADR-004 | Zambian national colours for the app theme | Superseded by ADR-011 |
| ADR-005 | Administration as a separate React and TypeScript website | Accepted |
| ADR-006 | "Clinical Field Health" design for the admin website | Accepted; its colours superseded by ADR-011 |
| ADR-007 | De-identified FHIR R4 export and the SmartCare Pro stand-in | Accepted |
| ADR-008 | "Modern health app" look for the phone app | Accepted; its colours superseded by ADR-011 |
| ADR-009 | An offline, extractive chatbot over a reviewed knowledge base | Accepted; retrieval extended by ADR-013 |
| ADR-010 | Claude may write chat answers from the reviewed passages | Accepted; off unless an API key is set |
| ADR-011 | Awareness blue, modern icons and a visible assistant | Accepted |
| ADR-012 | Voice questions to the assistant, and articles read aloud | Accepted |
| ADR-013 | Hybrid retrieval: keywords decide, MedCPT orders by meaning | Accepted |
| ADR-014 | Push notifications through Firebase Cloud Messaging | Accepted; switched on with the owner's Firebase project |
