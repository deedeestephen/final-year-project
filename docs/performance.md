# Performance and reliability (Phase 17)

This page reports **what was measured**, next to the research targets in the proposal (§ non-functional requirements). The numbers come from one run on the development laptop, not on production servers, and they are quoted exactly from the results file. The limits of what they show are listed at the end.

## Measured against the targets

| Research target (proposal) | Measured (2026-09-28/29, development laptop) | Result |
|---|---|---|
| **NFR-02:** AI result within **3 s at the 95th percentile** under concurrent load | **545 ms** P95 end to end, with 500 users active and one analysis a second. **1,027 ms** P95 for 20 analyses at the same moment | **Met for the pipeline, with mock models.** Must be measured again once the trained models are in (see the limits below) |
| **NFR-05:** **at least 500 concurrent users** without response-time degradation | **500 users**, each acting every 2–8 s (about 98 requests a second): **0 errors**, P95 **156 ms**, P99 269 ms. With 25 users: P95 41 ms | **Met in practice.** Answers slowed from 41 to 156 ms at P95, but stayed far under a second, which users would not notice. One laptop instance saturates at about **133 requests a second** (see Stress) |
| **NFR-08:** offline changes are never lost or saved twice, also under load | 100 phones × 20 changes at the same moment: all **2,000 saved**, 0 errors, and all 2,000 recognised as already saved when sent again | **Met.** Bulk speed is limited by the audit chain (below) |
| **FR-07:** chatbot answer within **2 s** (UC-07) | 100 clinicians each asking every 2–8 s (about 18 questions a second): **0 errors**, P50 **260 ms**, P95 **514 ms** with the meaning search (ADR-013, 1 October 2026). Keywords only (Phase 13): P50 25 ms, P95 43 ms | **Met** for the offline assistant, with and without the meaning search |
| Start-up (no target in the proposal) | Backend ready in **3.8 s**, AI service in **1.4 s**. Phone app cold start **1.7 s** median (emulator, profile build) | Reported |

## How it was measured

`npm run perf` in `3-application-logic/backend` (`test/performance/system.perf-spec.ts`) starts the real system the same way as the Phase 16 end-to-end tests (`test/workflows/live-stack.ts`):

- **Backend:** the built backend as its own process in **production mode** (`node dist/main.js`, request logging on at `info` level). It connects to PostgreSQL 16 and MongoDB 7 in Docker, using a fresh database for the run.
- **AI service:** the Python AI service with its **mock models**, as its own process.

Everything is synthetic: 10 facilities, 500 clinician accounts and 300 patients. 100 of the patients have AI consent and a screening record.

- **Virtual users:** each signed-in user repeats: wait a random 2–8 s ("think time"), send one request, read the whole answer. Latency is timed on the client, from sending until the last byte arrives.
- **The mix:** what a clinician's app does during a working day:

  | Share | Request |
  |---|---|
  | 25% | `GET /users/me` (app opens, session check) |
  | 20% | `GET /sync/changes` with the phone's own cursor (background pull) |
  | 20% | `GET /patients` (first page of the facility's list) |
  | 15% | `GET /patients/:id` |
  | 10% | `GET /patients/:id/clinical-records` |
  | 10% | `POST /sync` with one new screening record (a write) |

- **Stages:**
  - **Baseline:** 25 users for 30 s.
  - **Main run:** 500 users for 60 s after a 15 s ramp-up. During the main run, **one AI analysis is requested every second** for a different patient, 60 in all. Each is timed from the request until the finished report is seen: the app's view, polling every 100 ms.
  - **Stress:** 500 users who act about once a second (think time 0.5–1.5 s), for 30 s.
  - **AI burst:** 20 analyses requested at the same moment.
  - **Sync stress:** 100 phones each send a batch of 20 changes (one new patient and 19 records) at the same moment, then send the same batches again. This proves nothing is saved twice.
- **Rate limits:** all virtual users come from one computer, so the **per-address** limit, meant for many phones on many addresses, is lifted for the run. The **per-account** limit (120 requests a minute) stays on, as in production. No virtual user comes near it.
- **What fails the run:** wrong answers only. The run fails on any server error (5xx), a network failure, a failed AI job, or a sync change that is lost or saved twice. The speed numbers are reported, not asserted.

## Results in detail

The main results come from one full run with 500 users. The tables are printed by `npm run perf:report`, word for word from the results file. The laptop has 4 cores / 8 threads.

Source: `var/perf/phase17-2026-09-28T21-06-30-176Z.json`

Machine: Windows_NT 10.0.26200; 8 x 11th Gen Intel(R) Core(TM) i5-1135G7 @ 2.40GHz; 32 GB memory (5.5 GB free at the end); Node v24.15.0.

**Baseline:** 25 users, about **4.9 requests per second**.

| Request | Count | Errors | P50 | P95 | P99 | Max |
|---|---|---|---|---|---|---|
| **All requests** | 147 | 0 | 20 ms | 41 ms | 44 ms | 51 ms |
| `GET /users/me` | 35 | 0 | 15 ms | 19 ms | 19 ms | 19 ms |
| `GET /patients/:id` | 19 | 0 | 19 ms | 23 ms | 23 ms | 23 ms |
| `GET /patients (page)` | 28 | 0 | 24 ms | 30 ms | 30 ms | 30 ms |
| `GET /sync/changes` | 26 | 0 | 20 ms | 27 ms | 30 ms | 30 ms |
| `GET /patients/:id/clinical-records` | 18 | 0 | 20 ms | 27 ms | 27 ms | 27 ms |
| `POST /sync (1 record)` | 21 | 0 | 38 ms | 44 ms | 51 ms | 51 ms |

Status codes: 200 × 147.

**Main run:** 500 users, about **98.1 requests per second**.

| Request | Count | Errors | P50 | P95 | P99 | Max |
|---|---|---|---|---|---|---|
| **All requests** | 5884 | 0 | 33 ms | 156 ms | 269 ms | 559 ms |
| `GET /patients/:id` | 861 | 0 | 29 ms | 160 ms | 237 ms | 322 ms |
| `GET /sync/changes` | 1224 | 0 | 32 ms | 156 ms | 241 ms | 341 ms |
| `GET /patients (page)` | 1147 | 0 | 38 ms | 156 ms | 245 ms | 375 ms |
| `POST /sync (1 record)` | 571 | 0 | 60 ms | 293 ms | 489 ms | 559 ms |
| `GET /users/me` | 1486 | 0 | 26 ms | 104 ms | 173 ms | 277 ms |
| `GET /patients/:id/clinical-records` | 595 | 0 | 31 ms | 149 ms | 301 ms | 393 ms |

Status codes: 200 × 5884.

**Stress:** 500 users, about **133 requests per second**.

| Request | Count | Errors | P50 | P95 | P99 | Max |
|---|---|---|---|---|---|---|
| **All requests** | 3990 | 0 | 2,232 ms | 5,146 ms | 5,478 ms | 5,750 ms |
| `GET /users/me` | 1007 | 0 | 1,540 ms | 1,784 ms | 1,817 ms | 1,872 ms |
| `GET /patients/:id` | 643 | 0 | 2,251 ms | 2,553 ms | 2,657 ms | 2,687 ms |
| `GET /sync/changes` | 824 | 0 | 2,268 ms | 2,570 ms | 2,686 ms | 2,738 ms |
| `GET /patients (page)` | 797 | 0 | 2,289 ms | 2,578 ms | 2,671 ms | 2,733 ms |
| `GET /patients/:id/clinical-records` | 380 | 0 | 2,995 ms | 3,293 ms | 3,389 ms | 3,420 ms |
| `POST /sync (1 record)` | 339 | 0 | 5,193 ms | 5,610 ms | 5,697 ms | 5,750 ms |

Status codes: 200 × 3990.

| AI analyses | Jobs | Failed | End to end P50 | End to end P95 | Max | Server P50 | Server P95 |
|---|---|---|---|---|---|---|---|
| One a second, during the main run | 60 | 0 | 204 ms | 545 ms | 777 ms | 62 ms | 182 ms |
| 20 at once (2 run at a time) | 20 | 0 | 812 ms | 1,027 ms | 1,029 ms | 485 ms | 734 ms |

**Sync:** 100 phones × 20 changes at once: P50 18,333 ms, P95 18,425 ms, max 18,448 ms, 0 errors; 2000 changes saved, 100 new patients. Sent again: P95 1,456 ms, 2000 of 2000 recognised as already saved.

**Sign-in:** 500 sign-ins, 25 at a time: P50 1,947 ms, P95 2,355 ms; all done in 39.5 s.

**Start-up:** backend ready in 3,799 ms (production build, databases checked, AI service reachable); AI service ready in 1,385 ms.

### The assistant (Phase 13)

`PERF_ONLY=chat PERF_USERS=100 npm run perf` (results file `var/perf/phase17-2026-09-29T07-48-49-320Z.json`):
- 100 synthetic clinicians started a conversation each, then asked one of six reference questions every 2–8 s for 30 s.
- The timing covers the whole path: the safety check, the call to the AI service (BM25 over the knowledge base), storing both messages in MongoDB, and the audit entry.

| Request | Count | Errors | P50 | P95 | P99 | Max |
|---|---|---|---|---|---|---|
| `POST /chat/conversations/:id/messages` | 590 | 0 | 25 ms | 43 ms | 52 ms | 56 ms |

The answer is quoted, not generated. A language-model provider, if the owner ever approves one, would add its own seconds, and would have to be measured against the same 2 s target.

### The assistant with the meaning search (ADR-013)

The same test (`PERF_ONLY=chat PERF_USERS=100 npm run perf`), after the MedCPT meaning search was added on 1 October 2026. The test now waits until the AI service's meaning search is ready, and records how passages were found and how many questions fell back to keywords.

| Run | Answers | Errors | P50 | P95 | P99 | Max | Keywords only (busy) |
|---|---|---|---|---|---|---|---|
| First version: one question at a time on all processor threads | 307 | 0 | 3,547 ms | **8,440 ms** | 10,336 ms | 10,798 ms | (not counted yet) |
| **As shipped:** 6 questions side by side, one thread each, 0.5 s wait | 552 | 0 | 260 ms | **514 ms** | 608 ms | 916 ms | 0 of 571 |
| One slot only (`CHAT_MEANING_SLOTS=1`, like a one-core server) | 514 | 0 | 541 ms | **676 ms** | 752 ms | 882 ms | 287 of 540 (53%) |

Results files: `var/perf/phase17-2026-10-01T11-27-52-714Z.json`, `…T11-45-45-102Z.json` and `…T11-47-05-801Z.json`. All three found passages with "keywords+meaning (MedCPT)".

**What the first run showed.** Each question costs about 2 billion multiplications in the 12-layer encoder (about 60 ms). The load is about 18 to 20 questions a second, which is more than one question at a time can keep up with, so the questions queued and P95 reached 8.4 s. A question's products are too small to share well between processor threads: on this laptop, one question on all threads ran at 14 a second, and six questions side by side, one thread each, at 34 a second (scratch measurements of the encoder alone).

**What was changed** (`app/chat/meaning.py`, `embeddings.one_thread_per_question`):
- Each question now runs on one thread.
- Up to `CHAT_MEANING_SLOTS` questions run at once: by default, three-quarters of the processor threads, so 6 here.
- A question that waits more than `CHAT_MEANING_WAIT_MS` (500 ms) for a free slot is answered with keywords only, as in Phase 13, and counted (`chat_meaning_busy` in `GET /v1/health`).

As shipped, no question needed that fallback at this load. The one-slot run shows what the fallback is for: on a machine that cannot keep up, half the questions get keyword answers, but every answer still comes within a second.

### Why bulk sync is slow: the audit chain

In every run, the 100 phones in the sync stress finished at almost the same moment. P50, P95 and the maximum are within a fraction of a second of each other, which points to one shared queue. A sampler read PostgreSQL's `pg_stat_activity` every 100 ms during a sync-only run (`PERF_ONLY=sync`). Of all samples of the run's busy database sessions:

| What the sessions were doing | Share |
|---|---|
| Waiting for `Lock/advisory`, the audit log's chain lock | **79%** (764 of 968) |
| Running | 10% |
| Writing the commit to disk (`WALSync`, `WALWrite`) | 7% |
| Other | 4% |

Every audit row stores the hash of the row before it (tamper evidence, NFR-01 and FR-10). The database therefore adds rows one at a time, under one advisory lock that is held until the transaction commits. Every change a phone saves writes an audit row, so all writes in the whole system take turns, including the commit's wait for the disk.

**Fix applied:** screening-record transactions now write the audit row **last**, after the patient notification. The lock is then held only for the final insert and the commit. In the sync-only stress run, the time per phone went from **14.4 s** to **11.3 s** and **12.2 s** (two runs), 15–22% faster. The full run's table above was measured before this fix (18.3 s, with the 500-user data already in the database).

**What it means for capacity:** about **160–180 audited changes a second** on this laptop. A clinic day is far below that: 500 clinicians each saving 40 records a day is 20,000 changes, under one a second on average even if all fall within eight hours. So the chain is not a limit for the proposal's scale.

**For a national rollout:**
- **Chain in batches:** write audit rows without the chain, and let one background worker link them in batches. That is one lock for many rows.
- **One chain per facility or per day:** each chain is then verified separately.

Both keep tamper evidence. It is recorded as future work, not changed now, because the current design is simpler to verify and meets the target.

## Honest limits of these numbers

- **One laptop does everything.** Load generator, API, AI service, both databases (Docker Desktop on WSL2), the Android emulator, Android Studio and the development servers all ran on the same machine at the same time. Production would put each on its own server. The numbers are therefore a **floor**, not a ceiling.
- **Mock AI models.** The AI times cover the whole pipeline: consent check, de-identified inputs, the queue, the call to the AI service, storing the report and explanation records. The "inference" itself is the mock's, which takes almost no time. **They say nothing about how fast the real trained models will be.** When the Kaggle models are added, run `npm run perf` again: the 3 s target then has to be met with real inference inside the same pipeline. `AI_MAX_CONCURRENT_JOBS` (2 by default) and more AI-service workers are the levers.
- **One API instance** and an in-memory rate limiter. Redis-shared limits across instances are tested for correctness in `rate-limit.int-spec.ts`, not for speed here.
- **"Concurrent users" means users signed in and active at the same time**, each acting every few seconds. It does not mean 500 requests in the same millisecond. The stress stage shows what happens when everyone acts about once a second.
- **Sign-in is deliberately slow.** Passwords use Argon2id, which is designed to be expensive so that stolen hashes cannot be guessed quickly. A crowd signing in all at once therefore waits. The app signs in rarely: tokens last 15 minutes and are refreshed without the password.
- **The phone's start time was measured on the emulator** (Galaxy S9+ profile, Android 10, x86_64 image on the same laptop), with a profile build (compiled ahead of time, like release). The measure is Android's own launch time (`am start -W`, TotalTime) after a force-stop. Five starts took 2,235, 1,891, 1,709, 1,651 and 1,682 ms; the first includes Android's first-run preparation of the new install. A real Galaxy S9+ has a different processor, so these numbers are indicative only.

## How to repeat

1. Start the databases: `6-infrastructure\scripts\dev-up.ps1` (or only `docker compose up -d` in `6-infrastructure/docker`).
2. `cd 3-application-logic/backend && npm run perf` takes about 6 minutes. For a quick look: `PERF_USERS=100 PERF_MEASURE_S=20 npm run perf`.
3. `npm run perf:report` prints the tables above from the newest results file in `var/perf/`. `PERF_ONLY=sync` (or `load`, `ai`) runs only some stages.
4. Free memory first. On this laptop, with the emulator, Android Studio and a Gradle build's daemons open, Node sometimes aborted at start-up (the shell showed code 127, and npm's log showed `0xC0000409`). Stopping the build daemons (`gradlew --stop` in `1-presentation-layer/mobile-app/android`) fixed it.
5. Phone start time: `flutter build apk --profile`, install it with `adb install -r`, then for each try `adb shell am force-stop zm.ac.zcas.pca_mhealth` and `adb shell am start -W -n zm.ac.zcas.pca_mhealth/.MainActivity`.
