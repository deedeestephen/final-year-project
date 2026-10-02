# Chapter 4: System Implementation and Testing

This chapter describes the implemented system and its testing. Sections 4.1 and 4.2 are a condensed system guide and installation manual; the full versions are the project's operations manual (also available as a PDF) and a step-by-step manual test guide (Appendix D). Section 4.3 presents the testing plan and its output, and Section 4.4 the main function code for each objective.

## 4.1 System Guide

### 4.1.1 The parts of the system

Table 4.1: The parts of the system on the development computer

| Part | What it does | Built with | Address |
|---|---|---|---|
| Phone app | Screens for patients, clinicians and pathologists; works offline | Flutter 3.35 (Dart) | Android emulator or phone |
| Admin website | Accounts, roles, patient links, audit log, dashboard, FHIR export | React 19 and Vite (TypeScript) | http://localhost:5173 |
| Backend (API) | Every rule: sign-in, permissions, patients, consent, uploads, synchronisation, chat, audit | NestJS 11 on Node.js 24 | http://localhost:3000 |
| AI service | The AI modules (labelled mocks) and the assistant's search | FastAPI (Python 3.14) | http://127.0.0.1:8000 |
| PostgreSQL | Accounts, patients, screenings, consents, audit log | PostgreSQL 18 | localhost:5432 |
| MongoDB | AI reports, chats, scan details | MongoDB 8.3 | localhost:27017 |
| Redis, MinIO, Qdrant | Shared rate limits; S3-style file storage; vector search (for later) | Docker containers | ports 6379; 9000–9001; 6333 |

Every request from the app or the website passes through the backend in a fixed order: the per-address rate limit, the access token check, the per-account rate limit, the permission check, validation of the request, and the service, which does the work and writes an audit entry. Only the backend talks to the databases and the AI service.

### 4.1.2 Using the system

**Clinicians** sign in on the phone and can register patients and add screening records (PSA, free PSA, DRE finding, PI-RADS, prostate volume, biopsy and family history, symptoms) with or without a connection. Each item shows its state in words ("Saved on device", "Synced" or "Needs attention"), and the Sync screen shows any conflict side by side for the clinician to resolve. A synchronised patient's page offers **Consent**, **Images and slides** (files wait in an upload queue until they can be sent) and **AI analysis**. The analysis button is disabled, with the reason, when the phone is offline, AI consent is missing or no screening has been synchronised. The report begins with the banner "DEVELOPMENT MOCK DATA — NOT A CLINICAL RESULT." and then shows the values, the modules used and skipped, and each explanation or the reason there is none.

**Pathologists** open the review queue, enter the primary and secondary Gleason patterns (3 to 5) for a slide and save; the server computes the ISUP grade group and allows one review per slide.

**Patients** create an account with their name, e-mail, phone, NRC or passport number and a password; it shows "Almost ready" until an administrator links it to their clinic record. The patient app has five tabs: **Home**; **Results**, which shows values only, always with "Your clinician will explain what this means for you"; **Learn**, six short articles that can be read aloud; **Messages**; and **Profile**, with consents that can be withdrawn at any time, the reports area (empty until reports are released), settings and sign-out. The assistant accepts typed or spoken questions and can read its answers aloud.

**Administrators** use six website pages: the **Dashboard** (app activity as counts only); **Users** (create staff with a one-time password, change roles and facility, disable, unlock, reset a password, or delete an account that has no clinical history); **Roles and permissions** (within safety locks); **Patient accounts** (match by exact NRC and link); **FHIR export**; and the **Audit log**, with a "Check integrity" button that recomputes the hash chain.

## 4.2 Installation Manual

### 4.2.1 Requirements

The system was developed on a Windows 11 laptop with an 11th-generation Intel Core i5 processor (4 cores, 8 threads) and 32 GB of memory. Table 4.2 lists the software, with the versions in use on 30 September 2026.

Table 4.2: Software required

| Tool | Version | Used for |
|---|---|---|
| Node.js and npm | 24.15.0 and 11.12.1 | Backend, admin website, scripts |
| Python | 3.14.5 | AI service |
| Flutter and Dart SDK | 3.35.2 and 3.9 | Phone app |
| Android Studio and SDK | Emulator `Galaxy_S9_Plus_API_29` (Android 10) | Running the app |
| PostgreSQL | 18.6, with pgAdmin 4 | Main database |
| MongoDB | 8.3.2, with Compass | Document database |
| Docker Desktop | 29.8.0 | Redis, MinIO, Qdrant |
| Git | 2.51 | Version control |

### 4.2.2 Installation steps

1. Install the tools in Table 4.2.
2. Clone the private repository: `git clone https://github.com/deedeestephen/final-year-project.git`.
3. Create the settings file with random secrets: `node 6-infrastructure\scripts\gen-keys.mjs --init-env`. The file, `.env`, is never committed, and must be backed up safely: without its keys, the encrypted fields cannot be read again.
4. Create the database login and database on PostgreSQL and MongoDB as described in `docs/local-databases.md`, and put the passwords in `.env`.
5. Install the AI service in `4-ai-intelligence-layer\ai-services`: `py -3 -m venv .venv`, then `.venv\Scripts\python -m pip install -e ".[dev]"`.
6. Optionally download the MedCPT models for the meaning search (about 880 MB, checked against pinned SHA-256 sums): `.venv\Scripts\python -m app.chat.embeddings download`. Without them, the assistant uses keyword search only.
7. Start everything with one command from the project folder:

```
powershell -ExecutionPolicy Bypass -File 6-infrastructure\scripts\dev-up.ps1
```

The script checks the settings, starts the database services and Docker containers, applies new migrations, adds the synthetic demonstration data, builds and starts the backend, and starts the website and the AI service in their own windows. It ends with READY. `dev-down.ps1` stops everything without losing data.

### 4.2.3 Checking, signing in and running the app

Table 4.3: Checks after starting

| Open this | Expected result |
|---|---|
| http://localhost:3000/api/v1/health | `"status":"ok"` |
| http://127.0.0.1:8000/v1/health | `"status":"ok"`, models reported as development mocks, and `chat_retrieval` showing `keywords+meaning (MedCPT)` when the models are installed |
| http://localhost:5173 | The admin sign-in page |
| http://localhost:3000/api/docs | The API explorer |

The seed creates four synthetic accounts, `admin@`, `clinician@`, `pathologist@` and `patient@demo.pca-mhealth.test`, with the password set in `SEED_DEMO_PASSWORD`; five wrong passwords lock an account for 15 minutes, and `dev-up.ps1 -ResetDemoPasswords` resets them. The app is started on the emulator from `1-presentation-layer\mobile-app`:

```
flutter emulators --launch Galaxy_S9_Plus_API_29
flutter run -d emulator-5554 --dart-define=API_BASE_URL=http://10.0.2.2:3000
```

On a USB-connected phone, `phone-usb.ps1` lets it reach the computer, and the app uses `API_BASE_URL=http://localhost:3000`. Debug builds allow plain HTTP only to these local addresses; release builds allow HTTPS only.

### 4.2.4 Switching on push notifications

Push notifications are built but off, because they need a Firebase project in the owner's Google account. The owner creates a free project, adds an Android app (`zm.ac.zcas.pca_mhealth`), and generates a service-account key, which is a secret kept outside the project folder; its path goes in `FCM_SERVICE_ACCOUNT_FILE`. Four public identifiers go into a git-ignored `firebase-app.json` that the app reads at build time. After a restart, http://localhost:3000/api/v1/health/ready reports `"push":"on"`. Until then, the same messages remain in the app's Messages tab. The operations manual also has a troubleshooting table that maps symptoms to causes and fixes.

## 4.3 Testing Plan and Test Output

### 4.3.1 Testing plan

Testing ran in every phase. The proposal required at least 80% coverage (NFR-07), integration testing of the gateway, AI broker, chatbot and synchronisation, and automated regression testing. Table 4.4 shows the levels used.

Table 4.4: Levels of testing

| Level | What it covers | Tools |
|---|---|---|
| Unit | Encryption, permissions, safety rules, mappers, the sync engine with a fake clock | Jest, pytest, `flutter test`, Vitest |
| Integration | Services against real PostgreSQL, MongoDB, MinIO and Qdrant, in a fresh database for each run | Jest and Supertest |
| API end-to-end | Routing, validation, errors, rate limits, headers, OpenAPI | Jest and Supertest |
| Live workflows | The built backend in production mode, the real AI service and an HTTPS SmartCare Pro stand-in | `npm run test:workflows` |
| Device | The app on the Galaxy S9+ emulator against the running system | Flutter integration tests |
| Performance | Load, stress, AI and synchronisation stages | `npm run perf` |
| Security | Route rules, TLS, secrets, dependencies, de-identification, audit tampering, log contents | Gate scripts and tests |
| Interoperability and accessibility | HL7 FHIR validator; accessibility guidelines and contrast | Validator, `flutter test`, Vitest |
| Retrieval quality | The assistant's answers on fixed question sets | `python -m app.chat.evaluate` |
| User acceptance | Task success, time, SUS and interviews | UAT kit (not yet run) |

The testing strategy named mandatory categories: invalid, unauthenticated, forbidden, malformed and oversized API requests; tampered, expired and `alg:none` tokens, refresh-token reuse, privilege escalation, injection and path traversal; repeated submissions, version conflicts, partial batches and an app killed mid-sync; provenance on every AI response and a label on every mock; and refusals, referrals and citations for the chatbot. All test data was synthetic.

### 4.3.2 The quality gate and test output

The quality gate (Figure 4.1) runs formatting, static analysis, type checking, tests with at least 80% coverage, the build and the security audits for each part, plus the live workflows, a documentation link check, the HL7 validator, the access-matrix rules, the TLS check and a full-history secret scan. It ran in continuous integration on every push, and no commit was made unless the gate for the changed part passed.

![Figure 4.1: The quality gate](../report/figures/activity-quality-gate.png)

Table 4.5 gives the test counts recorded on 1 October 2026, after the meaning search and push notifications were added. All tests passed.

Table 4.5: Automated tests and coverage on 1 October 2026

| Part | Tests | Coverage |
|---|---|---|
| Backend unit tests | 323 | All backend tests together: 94.7% of statements, 81.4% of branches |
| Backend end-to-end tests (in process) | 20 | (included above) |
| Backend database integration tests | 238 | (included above) |
| AI service | 96 passed; 1 skipped (it would call the real Claude API); 3 more skipped when the MedCPT models are absent, as in CI | 98% |
| Phone app | 290 | 91.1% of lines |
| Admin website | 81 | 87.8% |

At the final quality audit (Phase 18), every package was given an 80% minimum that fails the gate. The admin website was below it (78.6% of statements, 73.4% of branches) until eleven tests were added. Figure 4.2 shows the real output of the backend gate.

![Figure 4.2: Test output: the backend gate](../report/img/term-gate.png)

### 4.3.3 End-to-end workflows and device tests

The live workflow suite starts the real system for each run, with its own database and temporary folder. In Phase 16 it ran 13 tests in six workflows, each with failure paths (Table 4.6); a seventh, for the assistant, was added in Phase 13.

Table 4.6: End-to-end workflows on the live system

| Workflow | What it proves |
|---|---|
| 1. Sign-up and linking | A patient signs up, the clinic registers the same NRC, the administrator links them, and the patient sees only their own record; a taken e-mail and other areas are refused; five wrong passwords lock the account |
| 2. Offline synchronisation | A repeated batch changes nothing; a stale edit returns a conflict; the valid part of a partly invalid batch is kept; changes stay within the facility |
| 3. Imaging and AI | Consent is required; wrong files and modalities are refused; the de-identified copy has no DICOM identifiers; the report is labelled mock, with no invented explanations or metrics; other facilities cannot see it |
| 4. Slide review | Clinicians cannot review; the server computes the grade group; a second review is refused; the slide is held back from the AI |
| 5. Consent withdrawal | After withdrawal in the app, AI requests are refused and the research export excludes the patient |
| 6. SmartCare Pro export | Only consented, de-identified data is sent over HTTPS; no name, NRC or record identifier reaches the receiver; the audit chain is intact |
| 7. The assistant | Questions are answered from the real knowledge base through the whole system |

The last test stops the system and searches both logs for every value used in the run: passwords, tokens, names, NRC numbers, phone numbers, clinical notes and chat questions. None appeared. On the Galaxy S9+ emulator (Android 10), the device test passed four flows against the running system (clinician, patient, administrator and pathologist), and it confirms that the phone's database is encrypted by SQLCipher.

### 4.3.4 Security testing

Phase 15 was an internal security and compliance review whose checks were automated into the gate. The access matrix then listed 66 routes with no rule breaks (75 today). The TLS check against the real nginx configuration showed TLS 1.3 accepted and TLS 1.2 and 1.1 refused. The full-history secret scan found four matches, all confirmed as false positives, and no real settings value appeared in any commit. Dependency audits of every package, including 130 Dart and Flutter packages, found no known vulnerabilities. A tamper test changed an audit entry inside a rolled-back transaction, and the chain check caught it. Table 4.7 lists the review's findings, all of which were fixed.

Table 4.7: Findings of the security review (Phase 15)

| ID | Severity | Finding | Resolution |
|---|---|---|---|
| F-1 | High | Files sent to the AI were the original uploads, with identifying DICOM headers | Only a de-identified copy is sent; slides held back until slide de-identification exists |
| F-2 | Medium | Role editing could break separation of duties | Administration and clinical-data permissions locked to their roles |
| F-3 | Medium | An administrator could add a clinical role to their own account | Nobody can add roles to their own account |
| F-4 | Low | The secret scan was not running locally | Now runs locally; earlier summaries corrected |
| F-5 | Low | The audit log could not be read without database access | Audit-log page with an integrity check |
| F-6 | Low | TLS 1.3 was configured but never tested | TLS check added to the gate |
| F-7 | Low | A vulnerable pip came with a rebuilt Python environment | Upgraded |

Eight residual risks (R-1 to R-8) must be closed before real data is used; they are listed with the recommendations in Section 5.7.

### 4.3.5 Performance testing

Phase 17 measured the whole system against the proposal's targets. A load generator written for the project starts the real system, creates 10 synthetic facilities, 500 clinician accounts and 300 patients, and runs a sequence of stages. Each virtual user waits 2–8 seconds between requests and follows a clinician's traffic mix: opening the app, background synchronisation, patient lists and records, and new screenings. Latency is measured on the client to the last byte. The run fails only on wrong answers (server errors, failed AI jobs, or a change lost or saved twice); speed is reported, not asserted.

Table 4.8: Measured performance against the targets (development laptop, synthetic data)

| Target | Measured | Result |
|---|---|---|
| NFR-02: AI result within 3 s at P95 under load | 545 ms P95 end to end with 500 users active and one analysis a second; 1,027 ms P95 for 20 at once | Met for the pipeline with mock models |
| NFR-05: at least 500 concurrent users | 500 users at about 98 requests a second: 0 errors, P95 156 ms, P99 269 ms (25 users: P95 41 ms) | Met in practice |
| NFR-08: offline changes never lost or saved twice | 100 phones × 20 changes at once: all 2,000 saved, 0 errors; resent, all 2,000 recognised as already saved | Met |
| FR-07: assistant within 2 s | 100 clinicians (about 18 questions a second): 0 errors, P50 260 ms, P95 514 ms with the meaning search; P95 43 ms with keywords only | Met |
| Start-up (no target) | Backend 3.8 s, AI service 1.4 s; app cold start 1.7 s median on the emulator | Reported |

A stress stage found the saturation point of one API instance on the laptop at about 133 requests a second, with no errors but a P95 of 5,146 ms. Sign-in is deliberately slow because of Argon2id: 500 sign-ins, 25 at a time, took 39.5 seconds.

The measurements exposed two problems, which were fixed. Bulk synchronisation was slow, with each phone taking 14–18 seconds and all finishing together; sampling showed that 79% of the busy database time was spent waiting for the audit chain's lock, held until commit. Writing the audit row last in screening transactions shortened the lock and cut the time per phone from 14.4 seconds to 11.3 and 12.2 seconds in two runs; the remaining capacity, about 160–180 audited changes a second, is far above a clinic's load. And the first version of the meaning search failed the 2-second target with a P95 of 8,440 ms, because questions were encoded one at a time on all threads; encoding each on one thread, six side by side with a keyword fallback after half a second, brought the P95 to 514 ms with no fallbacks.

These numbers have limits. One laptop ran everything at once, including the load generator, both databases in Docker, the emulator and the development tools, so the numbers are a floor rather than a ceiling. The mock models' inference takes almost no time, so the AI timings say nothing about real models. "Concurrent users" means users active at the same time, each acting every few seconds. The main runs were made on 28–29 September 2026 with PostgreSQL 16 and MongoDB 7 in Docker, before the move to the installed servers, and were not repeated afterwards.

### 4.3.6 Evaluation of the assistant's retrieval

The assistant was measured on fixed question sets written by the developer: an 18-question quality set, 24 everyday-word questions, 12 off-topic questions, and 11 follow-ups and new topics. An answer is right when its first quoted passage comes from a correct article, and an off-topic question is right when it is refused (Table 4.9).

Table 4.9: Retrieval evaluation of the assistant (1 October 2026)

| Retrieval | Quality set (18) | Everyday words (24) | Off-topic refused (12) | Follow-ups right (7) | New topic refused (4) |
|---|---|---|---|---|---|
| Keywords only | 18 | 18 | 9 | 6 | 0 |
| Keywords and meaning (MedCPT) | 18 | 20 | 11 | 7 | 3 |

For example, "Are African men more likely to get it?" now receives the article on who is at higher risk, and "What is the treatment for malaria?" is refused. Known failures remain: "Tell me about breast cancer screening" still receives the prostate screening passage, and "Will it rain tomorrow?" after a PSA question is still answered. A general sentence-embedding model was tried first and dropped, because it did worse than keywords alone. The sets are small and developer-written, so they guard against regressions rather than prove quality. Separately, the safety rules passed a 34-prompt red-team set in full, small talk was tested with 40 phrases, and a test checks that every quoted answer equals the reviewed passages word for word.

### 4.3.7 Interoperability and accessibility testing

The FHIR export was checked with the official HL7 validator (version 6.10.4). After the project's local definitions were published, the sample export passed with 0 errors and 46 best-practice warnings (no narrative text, and no performer, because staff are deliberately not exported). Every LOINC and HL7 code was checked on the HL7 terminology server; for PI-RADS, the rectal examination and prostate volume, where no standard code could be verified, project code systems are used instead of a guessed code. A test for each of the eighteen Safe Harbor identifier classes runs against a synthetic patient carrying every identifier the system can hold.

For accessibility, the theme test checks 30 text pairs per mode against the WCAG AA ratio of 4.5:1; the accessibility suite applies Flutter's guidelines to twelve screens in both modes and at 200% text; and the website's contrast test fails the build if any text pair falls below 4.5:1. A test with screen-reader users remains for the user acceptance test.

### 4.3.8 User acceptance testing

The proposal's user acceptance test has not been carried out. It requires written approval from the ZCAS University Ethics Review Board and the National Health Research Authority, which has not been obtained. No participant has used the system, and no SUS score exists.

A complete kit was prepared: a plan; an information sheet and consent form with a witness line for participants who cannot read; task sheets with success criteria for patients (14 tasks), clinicians (11), pathologists (6) and administrators (7, optional); the SUS questionnaire with reading-aloud instructions and a scoring example; and a results template designed for this section. The plan asks for at least five participants per group from CDH, UTH and a rural or peri-urban facility, using synthetic data only, in 45-minute sessions combining think-aloud, timed tasks with recorded help levels, the SUS and an interview. The analysis covers success rates, time on task, SUS statistics per group, problems rated on Nielsen's severity scale and a thematic analysis. Appendix C summarises the kit.

[UAT RESULTS: to be added after the sessions, from the results template in docs/uat/results-template.md: task success and time per task, the SUS score per group against the target of 75, the problems found with their severity, the themes from think-aloud and interviews, and the read-aloud and voice results for participants with limited reading skills. Report failed tasks as they happened.]

Table 4.10: System Usability Scale results (to be completed after the sessions)

| Group | Participants | Mean SUS | Standard deviation | Range | Target (≥ 75) met? |
|---|---|---|---|---|---|
| Patients | [UAT RESULTS] | [UAT RESULTS] | [UAT RESULTS] | [UAT RESULTS] | [UAT RESULTS] |
| Clinicians | [UAT RESULTS] | [UAT RESULTS] | [UAT RESULTS] | [UAT RESULTS] | [UAT RESULTS] |
| Pathologists | [UAT RESULTS] | [UAT RESULTS] | [UAT RESULTS] | [UAT RESULTS] | [UAT RESULTS] |
| All | [UAT RESULTS] | [UAT RESULTS] | [UAT RESULTS] | [UAT RESULTS] | [UAT RESULTS] |

## 4.4 Main Function Codes

Each picture shows the real file, with its name and line numbers, as it stood when the pictures were taken.

### 4.4.1 Objective 1: a secure, offline-first mobile application

The phone's database is opened with SQLCipher and a key held in the Android Keystore, and opening refuses to continue without SQLCipher (Figure 4.3). The sync engine runs one sync at a time, sends the outbox in batches and pulls the facility's changes (Figure 4.4), and the server applies each change once, returning the stored result for a repeated idempotency key (Figure 4.5).

![Figure 4.3: The phone's encrypted database (SQLCipher key in the Keystore)](../report/img/code-app-open-database.png)

![Figure 4.4: The phone's sync engine](../report/img/code-app-sync-engine.png)

![Figure 4.5: The server applies each synced change once (idempotency)](../report/img/code-backend-sync-apply.png)

Identifiers are encrypted with AES-256-GCM, with HMAC look-ups (Figure 4.6). Sign-in applies the lockout and issues the tokens (Figure 4.7), and the permissions guard enforces RBAC and audits refusals (Figure 4.8). The reverse proxy accepts TLS 1.3 only (Figure 4.9), the FHIR export applies the Safe Harbor rules (Figure 4.10), and the push outbox sends each new notification once (Figure 4.11).

![Figure 4.6: AES-256-GCM encryption of identifiers, and HMAC look-ups](../report/img/code-backend-field-crypto.png)

![Figure 4.7: Sign-in with lockout and session tokens](../report/img/code-backend-login.png)

![Figure 4.8: Role-based access control: the permissions guard](../report/img/code-backend-permissions-guard.png)

![Figure 4.9: TLS 1.3 only at the reverse proxy](../report/img/code-tls-nginx.png)

![Figure 4.10: Safe Harbor de-identification rules for the FHIR export](../report/img/code-fhir-safe-harbor.png)

![Figure 4.11: Push notifications: the outbox sends each new notification once (ADR-014)](../report/img/code-backend-push-outbox.png)

### 4.4.2 Objective 2: the multi-modal AI inference engine

The pipeline is built but the trained models are not, so the modules are labelled mocks. A request checks consent first (Figure 4.12); the model router runs the modules the inputs allow and fuses their results (Figure 4.13); and the fairness check flags an AUC gap above 0.05 between groups (Figure 4.14), so far tested on test figures only.

![Figure 4.12: Requesting an analysis: consent first](../report/img/code-backend-ai-request.png)

![Figure 4.13: The model router and the fusion step](../report/img/code-ai-router.png)

![Figure 4.14: Fairness check across groups (AUC gap above 0.05 flagged)](../report/img/code-backend-fairness.png)

### 4.4.3 Objective 3: the patient-education chatbot

The safety rules are checked before every answer (Figure 4.15), and the chatbot service applies safety, then small talk, then the knowledge base (Figure 4.16). Retrieval uses BM25 keyword search (Figure 4.17) and then MedCPT, where the keywords decide and the meaning orders (Figure 4.18). The MedCPT encoder, a 12-layer PubMedBERT model, is written with numpy (Figure 4.19), and the answer is written from the passages (Figure 4.20). In the app, the chat controller holds the conversation (Figure 4.21); voice input uses the phone's speech service, so the app receives only text (Figure 4.22); and read-aloud reads articles part by part for people who cannot read (Figure 4.23).

![Figure 4.15: Safety rules, checked before every answer](../report/img/code-chat-safety-rules.png)

![Figure 4.16: The chatbot service: safety, small talk, then the knowledge base](../report/img/code-chat-answer-flow.png)

![Figure 4.17: Retrieval, step 1: BM25 keyword search of the reviewed knowledge base](../report/img/code-ai-retrieve.png)

![Figure 4.18: Retrieval, step 2: the keywords decide, MedCPT orders by meaning (ADR-013)](../report/img/code-ai-rank.png)

![Figure 4.19: The MedCPT encoder (PubMedBERT, 12 layers) written with numpy](../report/img/code-ai-encoder.png)

![Figure 4.20: Writing the answer from the passages](../report/img/code-ai-answer.png)

![Figure 4.21: The app's chat controller](../report/img/code-app-chat-controller.png)

![Figure 4.22: Voice input with the phone's speech service](../report/img/code-app-voice.png)

![Figure 4.23: Reading aloud for people who cannot read](../report/img/code-app-read-aloud.png)

### 4.4.4 Objective 5: ethics, privacy and compliance

The audit log's hash chain is enforced by a database trigger, independent of the application code (Figure 4.24); Figures 4.6, 4.10 and 4.14 also serve this objective.

![Figure 4.24: The audit log's hash chain (database trigger)](../report/img/code-db-audit-chain.png)

Objective 4, data collection and model training, has no code in the prototype, because no training data or trained model exists. Its preparation is an integration guide that specifies what each trained model must provide: portable weights, a model card, the exact input and output specification, and an evaluation file with held-out results and per-group figures for the fairness check.

## 4.5 Chapter Summary

The system was implemented as six layers of working software that can be installed with a settings script and started with one command. It was tested at every level, from unit tests to live workflows, device, performance and security tests, and every package passed its 80% coverage minimum. The targets for AI response time, concurrent users, offline synchronisation and assistant response time were met on a development laptop, within the stated limits. The user acceptance test is prepared but awaits ethics approval. Chapter 5 evaluates these results.
