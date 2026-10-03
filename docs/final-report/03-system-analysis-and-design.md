# Chapter 3: System Analysis and Design

## 3.1 Research Design

The project followed Design Science Research (DSR) (Hevner et al., 2004), which suits research whose main output is a purposeful artefact. Its contribution is the artefact and the design knowledge about how and why it works. Here the artefact is the prototype platform; the design knowledge is recorded in fourteen architecture decision records (ADR-001 to ADR-014) and the development log. Table 3.1 shows how each DSR activity was carried out.

Table 3.1: The Design Science Research activities as carried out

| DSR activity | How it was carried out |
|---|---|
| Problem identification and motivation | The research proposal (Chapters 1 and 2) |
| Definition of objectives | Five objectives, twelve use cases, twelve functional and eleven non-functional requirements, kept in a traceability matrix |
| Design and development | Nineteen build phases, each closed by an automated quality gate |
| Demonstration | Live end-to-end workflows, device tests on an Android emulator, and a manual test guide |
| Evaluation | Automated tests, a security review, performance against the proposal's targets, a retrieval evaluation; user testing prepared but not run |
| Communication | This report, the operations manual and the decision records |

Of the proposal's quantitative methods, only system performance could be measured, because no trained model exists. The qualitative part, stakeholder and usability evidence, is prepared in the user acceptance testing kit but awaits ethics approval.

## 3.2 Requirements Analysis

### 3.2.1 Users and roles

Four roles decide what each user may do.

- **Patients** create an account, see their own results, read or listen to health information, receive messages, manage their consents and ask the assistant.
- **Clinicians** (urologists, general practitioners, nurses and radiographers) register patients, record screenings with or without internet, record consent, upload scans, request and read AI analyses, and ask the assistant.
- **Pathologists** upload slides and record their Gleason review.
- **Administrators** manage accounts, roles and permissions, link patients' sign-ins to clinic records, read the audit log and an activity dashboard, and run the FHIR export. They have no routine access to clinical data.

The research coordinator, AI engineer and IT staff of UC-10 to UC-12 were not given roles, because those use cases were built only in part or left for later.

### 3.2.2 Use cases

Table 3.2 lists the proposal's twelve use cases with their status (Figure 3.5 shows them as a diagram).

Table 3.2: The twelve use cases and their status

| ID | Use case | Primary actor(s) | Status |
|---|---|---|---|
| UC-01 | Registration and authentication | All users | Built and verified |
| UC-02 | Offline clinical data capture | Clinician | Built and verified |
| UC-03 | Medical imaging upload and validation | Clinician | Built and verified |
| UC-04 | Histopathological slide submission | Pathologist | Partly: upload and review verified; slide model is a mock |
| UC-05 | AI multi-modal diagnostic analysis | System, for a clinician | Built and verified with mock models |
| UC-06 | Diagnostic report delivery | Clinician, patient | Partly: clinicians only; release to patients awaits trained models and sign-off |
| UC-07 | Patient chatbot interaction | Patient, clinician | Built and verified in English |
| UC-08 | National EHR data export | Administrator | Built and verified against a SmartCare Pro stand-in |
| UC-09 | System administration and RBAC | Administrator | Built and verified |
| UC-10 | Infrastructure monitoring | Administrator | Partly: health checks and an activity dashboard |
| UC-11 | Population-level analytics | Research coordinator | Left for later |
| UC-12 | AI model retraining and deployment | AI engineer | Left for later; the model registry exists |

### 3.2.3 Functional and non-functional requirements

Tables 3.3 and 3.4 summarise the proposal's requirements; Appendix A gives their status, implementation and tests.

Table 3.3: Functional requirements (from the proposal)

| ID | Requirement (summary) | Priority |
|---|---|---|
| FR-01 | JWT authentication with RBAC for four roles; lockout after five failed sign-ins | Critical |
| FR-02 | Capture and transmit demographics, PSA, DRE and history, encrypted, over TLS 1.3 | Critical |
| FR-03 | Full offline entry with an AES-256 local database and conflict-resolving synchronisation | Critical |
| FR-04 | Accept and validate DICOM MRI, TRUS and CT files, archive and queue them | Critical |
| FR-05 | PCa probability with a Gleason grade group within 3 s at the 95th percentile | Critical |
| FR-06 | Grad-CAM for CNN outputs and SHAP values for ANN outputs | High |
| FR-07 | RAG chatbot answers within 2 s, in English, Bemba or Nyanja | High |
| FR-08 | AI reports with probability, Gleason prediction, heatmaps, confidence intervals and recommendations | High |
| FR-09 | De-identified HL7 FHIR R4 JSON export for SmartCare Pro | Medium |
| FR-10 | Immutable, time-stamped, actor-identified audit log | High |
| FR-11 | AI performance metrics by age, region and stage | High |
| FR-12 | Scheduled retraining, versioned model registry and A/B testing | Medium |

Table 3.4: Non-functional requirements (from the proposal)

| ID | Quality | Measurable target |
|---|---|---|
| NFR-01 | Security | AES-256 at rest, TLS 1.3 in transit, RBAC at the gateway |
| NFR-02 | Performance | AI inference within 3 s at the 95th percentile under load |
| NFR-03 | Availability | At least 99.5% monthly uptime |
| NFR-04 | Usability | SUS score of at least 75 in user testing |
| NFR-05 | Scalability | At least 500 concurrent users |
| NFR-06 | Interoperability | HL7 FHIR R4 |
| NFR-07 | Maintainability | At least 80% automated test coverage |
| NFR-08 | Offline capability | Complete data entry without connectivity |
| NFR-09 | Explainability | Explanations for 100% of AI outputs |
| NFR-10 | Privacy | Safe Harbor de-identification |
| NFR-11 | Accessibility | WCAG 2.1 Level AA |

### 3.2.4 Changes from the proposal

Analysis at the start of the build and later reviews led to deliberate changes, each recorded in a decision record (Table 3.5).

Table 3.5: Significant changes from the proposal

| Proposal | Prototype | Reason |
|---|---|---|
| React Native app | Flutter (Dart) app | The owner's choice; ahead-of-time native code with no JavaScript bridge helps on entry-level Android phones; every requirement unchanged (ADR-001) |
| Administration in the app | A separate React and TypeScript website | Administration is desk work; same API and permission checks (ADR-005) |
| Backend language not specified | NestJS backend and a separate Python FastAPI AI service | The language boundary enforces the isolation of the AI layer (ADR-003) |
| Embeddings, cosine similarity, top 5, a vector database, a fine-tuned generator | BM25 decides coverage, MedCPT orders by meaning; passages are quoted, or Claude writes from them when enabled; 32 passage vectors kept in a file | Answers come only from reviewed text, and the system can say it has no reviewed information (ADR-009, ADR-010, ADR-013) |
| Cloud hosting, Kubernetes, Prometheus and Grafana | One laptop with Docker Compose; production items documented as plans | Deployment needs resources outside the project |
| A DICOM archive | Object storage with server-generated keys (local folder or S3-compatible MinIO) | One storage interface for scans, slides and explanation images |
| A push notification engine | Firebase Cloud Messaging through a database outbox, off until the owner's Firebase project exists | Free, built into Android, no health data in messages (ADR-014) |
| Reports shown to patients | Patients see values with "Your clinician will explain what this means for you"; AI reports not released | The owner's decision: interpretation belongs to the clinician |
| (Not in the proposal) | Voice questions, and articles and answers read aloud | Many older men read little or no English (ADR-012) |

## 3.3 System Development Method

The proposal selected iterative prototyping, in which each iteration passes through design refinement, development, internal testing and stakeholder evaluation (Figure 3.1).

![Figure 3.1: The iterative prototyping cycle as followed](../report/figures/activity-prototyping-cycle.png)

- **Design refinement.** Each phase started from the development plan and the traceability matrix. Lasting decisions were recorded with the options considered and the reasons. When the owner changed the visual design, ADR-004 was superseded and the colours of ADR-006 and ADR-008 replaced; the earlier records were kept as history.
- **Development.** Code was written test-first where practical, with synthetic data only, in a repository organised by the six architectural layers.
- **Internal testing.** A quality gate (Section 4.3.2) checked each part, and the same script ran in continuous integration. A phase could not close while the gate failed, and failing tests were fixed, not skipped.
- **Evaluation.** The owner reviewed each phase on the emulator, in screen renders or through the manual test guide, and the owner's requests fed the next iteration: the separate administration website, the redesign, voice and read-aloud, and the closing of gaps found when the proposal was reread. Evaluation with clinicians and patients is prepared but was not held (Section 4.3.8).

Two departures from the proposal's method should be noted. The iterations were build phases of varying length, not four-week time-boxes. And, as the development log and the security review record, the code, tests and documentation were written with an AI coding assistant (Claude) under the student's direction, with design choices recorded as the owner's decisions. This changed the pace of development but not the method, since every phase passed the same gate.

## 3.4 Data and Process Modelling

### 3.4.1 Context and data flow

Figure 3.2 shows the platform as one process, with its users and the outside systems it exchanges data with: SmartCare Pro, the phone's speech services, and the Claude language model, which is optional and off by default.

![Figure 3.2: Context diagram (DFD level 0)](../report/figures/context-diagram.png)

Figure 3.3 decomposes the platform into eight processes (1.0 authentication, 2.0 account administration, 3.0 patients, screenings and consent, 4.0 scans and slides, 5.0 AI analysis, 6.0 education and questions, 7.0 export to SmartCare Pro, 8.0 audit and monitoring) and eight data stores (D1 to D8, including the hash-chained audit log and the phone's encrypted database and outbox). Two flows are central: process 3.0 writes to the phone first and reaches the server only through the outbox, and process 5.0 reads only consent, clinical values and de-identified copies of scans. Figure 3.4 details process 6.0.

![Figure 3.3: Data flow diagram, level 1](../report/figures/dfd-level-1.png)

![Figure 3.4: Data flow diagram, level 2: the assistant and education](../report/figures/dfd-level-2-chatbot.png)

### 3.4.2 Use case models

Figure 3.5 shows the use cases with their actors; partly built ones are yellow, and those left for later are grey and dashed. Figure 3.6 shows what each role can do in the app, and Figure 3.7 the assistant's use cases.

![Figure 3.5: Use case diagram: the whole system (UC-01 to UC-12)](../report/figures/usecase-system.png)

![Figure 3.6: Use case diagram: the phone app](../report/figures/usecase-mobile-app.png)

![Figure 3.7: Use case diagram: the assistant (UC-07)](../report/figures/usecase-chatbot.png)

### 3.4.3 Activity models

Figure 3.8 shows each decision in the assistant's answer (Section 3.5.7). Figure 3.9 shows the offline-first design of FR-03: saved on the phone, sent in batches with idempotency keys, and returned as applied, conflict or rejected. Figure 3.10 shows voice input and read-aloud, and Figure 3.11 the AI analysis request, ending in a labelled mock result.

![Figure 3.8: Activity diagram: how the assistant answers a message](../report/figures/activity-chat-answer.png)

![Figure 3.9: Activity diagram: saving patients and screenings with or without internet](../report/figures/activity-offline-capture.png)

![Figure 3.10: Activity diagram: asking by voice and listening to the answer](../report/figures/activity-voice-question.png)

![Figure 3.11: Activity diagram: requesting an AI analysis](../report/figures/activity-ai-analysis.png)

### 3.4.4 Sequence models

Figure 3.12 shows sign-in: lockout after five failures, a 15-minute access token, and a refresh token replaced on every use, so that reuse of an old one reveals theft and ends the whole session family (Table 3.7). Figure 3.13 follows a question through the gateway guards, the chatbot service and the AI service to MongoDB and the audit log. Figure 3.14 shows the outbox, the batch and the download of the facility's changes, and Figures 3.15 and 3.16 the AI analysis and the FHIR export with Safe Harbor de-identification. Figure 3.17 shows push notifications: the server's outbox sends each new notification through Firebase as text only, hidden on a locked phone, and sign-out removes the phone.

![Figure 3.12: Sequence diagram: signing in and renewing the session](../report/figures/sequence-sign-in.png)

![Figure 3.13: Sequence diagram: asking the assistant a question](../report/figures/sequence-chat.png)

![Figure 3.14: Sequence diagram: offline capture and synchronisation](../report/figures/sequence-offline-sync.png)

![Figure 3.15: Sequence diagram: requesting and reading an AI analysis](../report/figures/sequence-ai-analysis.png)

![Figure 3.16: Sequence diagram: exporting de-identified records to SmartCare Pro](../report/figures/sequence-fhir-export.png)

![Figure 3.17: Sequence diagram: push notifications](../report/figures/sequence-push.png)

### 3.4.5 State models

Figure 3.18 shows a change saved on the phone: pending until sent, then synced, or needing attention as a conflict or rejection. Figure 3.19 shows an AI job: queued, running, then succeeded, failed or timed out. Figure 3.20 shows the message box during voice input.

![Figure 3.18: State diagram: a change saved on the phone](../report/figures/state-offline-change.png)

![Figure 3.19: State diagram: an AI analysis job](../report/figures/state-ai-job.png)

![Figure 3.20: State diagram: the chat's message box with voice input](../report/figures/state-voice-input.png)

## 3.5 Program, Database and Interface Design

### 3.5.1 Architecture

The system keeps the proposal's six layers (Figure 3.21 and Table 3.6), and the repository follows them.

![Figure 3.21: The six-layer architecture as built](../report/figures/architecture-layers.png)

Table 3.6: Technology of each layer

| Layer | Technology in the prototype |
|---|---|
| 1. Presentation | Phone app: Flutter 3.35 (Dart), Riverpod, go_router, Dio, Drift over SQLCipher, secure storage. Admin website: React 19 and TypeScript, built with Vite |
| 2. API gateway | Guards, validation, Redis-shared rate limits, security headers and OpenAPI 3, running first in the backend; an nginx template accepting TLS 1.3 only |
| 3. Application logic | NestJS 11 (TypeScript) on Node.js, Prisma for PostgreSQL, one service module per feature |
| 4. AI intelligence | FastAPI (Python): model router, five model modules (labelled mocks), explanation pipeline, assistant retrieval with a numpy MedCPT encoder |
| 5. Data persistence | PostgreSQL, MongoDB, object storage (local folder or MinIO), Redis; Qdrant available for a larger knowledge base |
| 6. Infrastructure | Docker Compose, PowerShell start and stop scripts, the quality gate, GitHub Actions; Kubernetes and monitoring plans |

Contracts separate the layers. The app and the website never reach a database or the AI service directly, so every rule is enforced in one place, the backend. The backend reaches the AI service only through a versioned HTTP contract with a service token, so real models can replace the mocks without changing the backend, database or app. Figure 3.22 shows where each part runs. PostgreSQL 16 and MongoDB 7 ran in Docker until 29 September 2026, when the data was moved, at the owner's request, to the PostgreSQL 18 and MongoDB 8.3 servers installed on the laptop, with identical row counts and an intact audit chain.

![Figure 3.22: Deployment diagram](../report/figures/deployment.png)

### 3.5.2 Program design of the backend

The backend has three folders that mirror the architecture: `gateway` (which every request passes), `services` (one module per feature: authentication, users, patients, clinical records, imaging, AI, chatbot, synchronisation, notifications, FHIR, administration and audit) and `persistence` (database clients, file storage, field encryption, seed data). Each feature has a controller that declares its routes and permissions, data transfer objects that define what may be sent and returned, and a service that holds the rules and writes the audit entry (Figure 3.23).

![Figure 3.23: Component diagram: the backend modules](../report/figures/component-backend.png)

Four guards run on every route, in order, and a route is closed unless the code explicitly opens it: a per-address rate limit (600 requests a minute), authentication of the access token, a per-account rate limit (120 requests a minute), and the permission check, which audits every refusal. Services then check each resource's scope: a clinician sees only patients of their own facility, and a request for another facility's patient returns "not found", which hides its existence.

### 3.5.3 Class design

Figure 3.24 shows the app's assistant, voice input and read-aloud, whose speech services sit behind small interfaces that tests can replace. Figure 3.25 shows the app's offline storage and synchronisation, and Figure 3.26 the server-side assistant.

![Figure 3.24: Class diagram: the app's assistant, voice input and read-aloud](../report/figures/class-app-chat-audio.png)

![Figure 3.25: Class diagram: the app's offline storage and synchronisation](../report/figures/class-app-offline.png)

![Figure 3.26: Class diagram: the assistant on the server](../report/figures/class-chat-server.png)

### 3.5.4 API design

The API follows REST conventions under `/api/v1` and is described in OpenAPI 3. Every error uses one envelope with a stable code and a request identifier, and never contains stack traces or submitted values. Figure 3.27 maps all 75 routes with their permissions and default roles, and the AI service's internal API. The map is generated from the access matrix, itself generated from the code, and the quality gate fails if a route breaks a review rule, such as a clinical route open to administrators. Figure 3.28 shows the API explorer. The AI contract was frozen at version 0 in Phase 3, so that both sides could be built in parallel, and grew additively to version 0.4.

![Figure 3.27: API diagram: every route, its permission and its default roles](../report/figures/api-map.png)

![Figure 3.28: The API explorer (OpenAPI 3, Swagger UI)](../report/img/web-api-explorer.png)

### 3.5.5 Database design

**Stores.** PostgreSQL holds the structured records: accounts, roles, permissions, sessions, facilities, patients, screenings, consents, scan and slide records, AI jobs and explanation records, notifications and push phones, synchronisation results and the audit log. MongoDB holds documents whose shape varies: AI reports, inference logs, scan details and chat conversations. Large files never enter a database; a row keeps a server-generated storage key and the file's SHA-256 checksum, size and type.

**Relational design.** Figure 3.29 shows all twenty PostgreSQL tables and their keys, and Figures 3.30 to 3.32 three groups in detail. The diagrams are generated from the Prisma schema, so they cannot drift from the code.

![Figure 3.29: Entity-relationship diagram: all PostgreSQL tables and their keys](../report/figures/erd-overview.png)

![Figure 3.30: ERD: accounts, roles and sessions](../report/figures/erd-accounts.png)

![Figure 3.31: ERD: facilities, patients, screenings, consent, scans and slides](../report/figures/erd-patients.png)

![Figure 3.32: ERD: AI jobs, notifications, synchronisation and the audit log](../report/figures/erd-ai-sync-audit.png)

**Normalisation.** The schema follows third normal form, with exceptions.

- *Keys.* Every table has a primary key, mostly a UUID `id`. The link tables `user_roles` (`user_id`, `role_id`) and `role_permissions` (`role_id`, `permission_id`) have composite keys, and `audit_logs` is keyed by a sequence number, `seq`. Unique constraints enforce alternate keys such as `users.email` and `push_devices.token`, so one phone is registered only once.
- *First and second normal form.* Columns hold single values; repeating groups, such as a patient's screening records, are child tables, and the many-to-many relations are resolved by the two link tables. The only composite keys are those of the link tables, and `user_roles.assigned_at` depends on the whole key.
- *Third normal form.* Facility details and role names are stored once. PSA density and the free-to-total ratio are calculated when a record is read, not stored.
- *Exceptions.* Some columns hold JSON whose content varies and is read as a whole: `clinical_records.symptoms`, `ai_jobs.inputs`, `model_versions` and `input_notes`, `ai_models.evaluation`, `sync_operations.conflict_detail` and `audit_logs.details`. The ISUP grade group of a slide review is computed by the server and stored with the review, so that the review is a fixed record. AI reports, chats and scan details live in MongoDB, linked by identifier.

**Integrity rules.** The database itself enforces 19 foreign keys (18 from the first migration and one added with the push phones), unique keys, and CHECK constraints on clinical values (non-negative PSA, free PSA not above total PSA, PI-RADS, Gleason patterns and grade groups between 1 and 5, positive prostate volume). A withdrawn consent must have a withdrawal time; every explanation record has either a stored file or a stated reason (NFR-09); every synchronisation result has a unique idempotency key.

**Encryption and audit.** Names, national identity numbers and phone numbers are stored encrypted with AES-256-GCM, and the national identity number also as a keyed HMAC-SHA-256 hash, so that a patient can be found by exact match without the number being in clear. The audit log is append-only: triggers refuse updates, deletes and truncation, and a trigger before each insert takes an advisory lock, assigns the next sequence number and stores a SHA-256 hash that covers the previous row's hash. A database function walks the chain and reports the first broken row, so tampering is detected even if the triggers are disabled. The cost, measured in Section 4.3.5, is that audited writes take turns.

**MongoDB and the phone.** Each MongoDB collection has a server-side validator (Figure 3.33): every AI report must state its provenance, `MOCK` or `RESEARCH_MODEL`, and carry a disclaimer, and chats are deleted 180 days after the last message. The app keeps six tables on the phone for offline work: patients, screening records, the outbox, conflicts, files waiting to upload, and metadata such as the device identifier and synchronisation cursor (Figure 3.34). The database is encrypted with SQLCipher (AES-256), with a random 256-bit key held only in the Android Keystore, and is wiped when a different user signs in.

![Figure 3.33: MongoDB: the four document collections and their rules](../report/figures/database-mongodb.png)

![Figure 3.34: The phone's encrypted database](../report/figures/database-phone.png)

### 3.5.6 Design of the AI inference engine

A model router in the AI service runs every module that the available inputs allow, lists the modules it skipped with reasons, and fuses the results. The five modules of the proposal (U-Net, ResNet-50, the clinical ANN, the patch-CNN with MIL and the XGBoost fusion) sit behind one provider interface. In the prototype, each provider is a labelled mock whose numbers come from a hash of the job identifier, never from the patient's values; a test changes the PSA and checks that the number does not change. Each module maps to its kind of explanation (Grad-CAM for ResNet-50, SHAP for the ANN and fusion, MIL attention for slides); with mocks, every explanation is an explicit "unavailable" reason, and no heatmap or SHAP value is invented. Images from a future real model are accepted only as genuine PNG files of at most 2 MB.

The backend's broker sends only a keyed pseudonym, the clinical values and de-identified copies of scans, never names, identity numbers or record identifiers. A request needs the patient's active AI consent, a screening record, and no other analysis running for that patient. Performance and fairness figures come only from a stored evaluation; otherwise the system says "Evaluation data not yet available." The fairness check compares stored per-group AUC values by age (under 50, 50–64, 65 and over), region, stage and equipment, and flags a gap above 0.05; groups with fewer than 30 test cases are listed rather than compared.

### 3.5.7 Design of the patient-education assistant

The assistant follows one rule: it must never invent medical content. Every question passes through these steps:

1. **Limits:** up to 30 questions an hour per account.
2. **Safety rules, before anything is looked up:** emergency and self-harm wording receives fixed urgent-care text; questions about medicines and doses are declined; a patient's questions about their own results or a diagnosis are declined with a referral to their clinician.
3. **Small talk:** eighteen kinds of casual message, including Bemba and Nyanja greetings, receive fixed friendly replies, but only if the message is nothing else; "hello, is my PSA bad?" still meets the safety rules.
4. **Retrieval (ADR-013):** keywords decide, because BM25 must find a passage scoring at least 2.0; meaning chooses the article, because MedCPT scores those passages and the article with the closest passage comes first; inside an article the keywords choose the section, because MedCPT scores sections of one article too closely to tell them apart, and if the best scores below a floor of 52.0 the answer is "no reviewed information". A short follow-up is read with the previous question but must also reach the floor on its own, so a new topic is not answered from the old one.
5. **Writing:** by default, the best passages are quoted word for word. If Claude is enabled, which it is not in the prototype, it writes from the three best passages through a fixed tool form, and its answers are labelled "Written by AI (Claude) from the sources below".
6. **Output check and storage:** an answer without a source, or with a dose in it, is never shown; questions and answers are stored for their owner only, and the audit log records that a question was asked, never its words.

The knowledge base holds the six Learn articles, each citing public sources (NHS, the US National Cancer Institute and WHO), and five clinician cards (ISUP grade groups, PI-RADS v2.1, PSA density and the free-to-total ratio, DRE findings, and how to read the AI report): 32 passages in all. Everything is marked "Draft for review by a qualified clinician" until a clinician signs it off, and patients never receive clinician content. The MedCPT encoders run inside the AI service, written with numpy and matching the reference implementation to within 0.0001, so questions leave the system only if Claude is enabled. Under load, questions are encoded side by side, with a keyword-only fallback (Section 4.3.5).

### 3.5.8 Interface design

Figure 3.35 shows every screen and how each role moves between them. Administrators who sign in on a phone are told that administration is on the website.

![Figure 3.35: The app's screens and navigation](../report/figures/navigation-app.png)

The visual design went through three iterations at the owner's request: the "Clinical Trust" option with stronger legibility rules (ADR-002), a "modern health app" style (ADR-008), and finally awareness blue with modern rounded icons and a drawn assistant figure (ADR-011). Rules held throughout: body text of at least 15 px, touch targets of at least 48 dp and 52 px inputs; every text pair at a WCAG AA contrast of at least 4.5:1, tested in light and dark mode; states written in words, never by colour alone; clinical values in neutral colours with nothing that suggests good or bad; the AI provenance banner first on every AI screen; and a notice on every sign-in screen that the app is not an official government service. Figures 3.36 to 3.39 show the main screens with synthetic data.

![Sign-in](../report/img/app-signin.jpg) ![Patient home (emulator)](../report/img/app-home-device.jpg) ![Learn, dark mode](../report/img/app-learn.jpg) ![An article read aloud (emulator)](../report/img/app-article-device.jpg)

Figure 3.36: Interface design: patient screens (sign-in; patient home on the emulator; Learn in dark mode; an article read aloud on the emulator)

![Empty chat](../report/img/app-chat-empty.jpg) ![An answer with its sources](../report/img/app-chat-answer.jpg) ![Casual chat](../report/img/app-chat-casual.jpg) ![Past chats](../report/img/app-chat-history.jpg) ![Speaking a question](../report/img/app-chat-recording.jpg)

Figure 3.37: Interface design: the assistant (empty chat; an answer with its sources; casual chat; past chats; speaking a question)

The answer in Figure 3.37 is the AI service's real answer from the draft knowledge base; in the recording picture, a stand-in plays the phone's speech service.

![Figure 3.38: Interface design: clinician home](../report/img/app-clinician.jpg)

![Dashboard](../report/img/admin-dashboard.png) ![Users](../report/img/admin-users.png) ![Delete this account?](../report/img/admin-delete.png)

Figure 3.39: Interface design: the admin website (dashboard, accounts list and delete dialog; synthetic API answers, and the dashboard's numbers were made up for the picture)

Accessibility was designed in. An automated test (Section 4.3.7) found and fixed a real overflow in the sign-in header at 200% text size. Field and button outlines were later raised to at least 3:1 against their background, as WCAG 2.1 criterion 1.4.11 asks.

### 3.5.9 Security design

Table 3.7 summarises the main security controls; Section 4.3.4 describes their testing.

Table 3.7: Main security controls

| Concern | Control |
|---|---|
| Passwords | Argon2id hashes (64 MiB, three passes); at least 12 characters, with a common-password denylist |
| Sessions | EdDSA-signed 15-minute access tokens; hashed refresh tokens replaced on every use, reuse revoking the whole family; account and session re-checked on every request |
| Brute force and enumeration | Lockout for 15 minutes after five failures; stricter limits on sign-in routes; identical answers for unknown and wrong accounts |
| Authorisation | Deny by default; role permissions; facility scoping; separation of duties (no clinical-data permissions for administrators, no administration permissions for clinical roles, no adding roles to one's own account) |
| Transport and storage | TLS 1.3 only at the reverse proxy, with HSTS; AES-256-GCM identifiers on the server; SQLCipher on the phone |
| De-identification | Safe Harbor rules for the FHIR export; pseudonym and de-identified scan copies for the AI |
| Uploads | Streamed and size-capped; file type decided by content; DICOM headers checked; file names never stored |
| Accountability and secrets | Hash-chained audit log with an integrity check; secrets only in a git-ignored file, with a full-history secret scan |

## 3.6 Chapter Summary

The project followed Design Science Research and an iterative prototyping method, adapted to build phases closed by a quality gate. The requirements came from the proposal, and changes were recorded with their reasons. The models describe the system's context, processes, stores, use cases, activities, interactions and object life cycles. The design kept the proposal's six layers, separated by contracts, with security, safety and accessibility rules built in. Chapter 4 describes the implementation and testing.
