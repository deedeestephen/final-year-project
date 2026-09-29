# Scalability and rate limits

This page describes how the system is built to cope with many users, what was measured on the development PC, and what a real deployment would still need. The numbers are measured, not estimated. The limits of the measurements are stated.

## 1. Design choices that let it grow

### API (NestJS)
- **Stateless instances.** An API process keeps no session state in memory:
  - access tokens are signed JWTs (Ed25519)
  - sessions live in PostgreSQL (`refresh_tokens`)
  - rate-limit counters live in Redis
  So any number of identical API instances can run behind a load balancer. Adding instances adds capacity.
- **Shared rate limits.** Counters are kept in **Redis** when `REDIS_URL` is set (`RedisThrottlerStorage`), so a client cannot get around a limit by landing on a different instance. `test/db/rate-limit.int-spec.ts` proves this with two API instances sharing one Redis.
- **Every list is paged on the server.**
  - Users: `pageSize` up to 100.
  - Patient accounts: 50 per page.
  - Patients, notifications and records are paged as well.
  Clients never download a whole table.
- **Indexes for large tables:**
  - Foreign keys and filters are indexed (`facility_id`, `user_id`, `family_id`, …).
  - The admin search ("any part of a name or email") uses **trigram GIN indexes** (`pg_trgm`, migration `20260924150000_user_search_trgm`). Without them it would scan every row as accounts grow.
- **Live permission checks stay cheap.** Each signed-in request reads the user (with roles and permissions) and the session **in parallel**. The reads are deliberately not cached, so disabling an account or changing a role takes effect on the very next request.

### Mobile app (Flutter)
- **Offline first.** Screens read from the encrypted local database, so an app that is offline or slow puts no load on the server.
- **Sync in batches, not per change.** Changes are queued and pushed together. Pulls use a cursor: "changes since X", not "everything".
- **Polite retries:**
  - after any failure, exponential backoff (2 s doubling, up to 15 minutes) with jitter, so thousands of phones don't retry at the same moment after an outage
  - the server's `Retry-After` is honoured (`SyncEngine` waits `max(backoff, Retry-After)`)
- **No polling loops.** Data refreshes when a screen opens or on pull-to-refresh.

### Admin web app (React)
- **Static files** (about 100 kB gzipped), servable from any CDN. The admin portal adds no server of its own.
- **Server-side search and paging**, with 30-second client caching (TanStack Query). No automatic retries on 4xx or 429.

### Data and future AI work
- PostgreSQL is the system of record. It can grow with:
  - a connection pooler (PgBouncer, or Prisma's `connection_limit` per instance)
  - read replicas for reporting
  - larger instances
- Imaging files go to object storage (MinIO/S3), not the database.
- AI inference (Phases 10–11) is planned as a **separate service behind a job queue**, so slow model runs never hold API requests open.

## 2. Rate limits (protection against overload)

| Limit | Default | Applies to | Why |
|---|---|---|---|
| Per address | 600 requests / minute (`RATE_LIMIT_MAX`) | every request, by IP | stops one machine flooding the API |
| Per account | 120 requests / minute (`USER_RATE_LIMIT_MAX`) | every signed-in request, by user id | stops one account (or a stolen token) using an unfair share, even from many addresses |
| Sign-in and password routes | 10 / minute (`AUTH_RATE_LIMIT_MAX`) | login, register, forgot/reset/change password | slows password guessing |

- Over a limit, the API answers **429** with a `Retry-After` header. It also sends `X-RateLimit-Limit` and `X-RateLimit-Remaining`, so clients can slow down on their own.
- The mobile app waits as asked.
- The admin portal tells the administrator how many seconds to wait.
- **Fail open:** if Redis is unreachable, requests are served and a warning is logged (at most once a minute). An outage of the limiter must not become an outage of the health service. The per-address limit then works per instance only.
- Refreshing a session is deliberately **not** in the strict sign-in bucket (see ADR-005).

## 3. Measured on the development PC (2026-09-24)

> These were the first, preliminary measurements. The Phase 17 measurements on the whole live system are in [performance.md](performance.md): 500 signed-in users with a realistic traffic mix, AI analyses under load, sync stress and start-up times.

**Set-up:** a single API instance (`node dist/main`, production build, Pino request logging on). PostgreSQL 16 in Docker Desktop (WSL2), on the same Windows laptop:
- 4 cores / 8 threads
- the Android emulator, Android Studio and Docker all running
- about 5 GB of memory free

Load was generated with `autocannon`: 50 concurrent connections, 10–15 seconds per test. The rate limits were raised for tests A–B only, so they measure raw capacity.

| Test | Requests / second (average) | Median latency | 97.5th percentile |
|---|---|---|---|
| A. `GET /health` (no database) | about 5,700 | 8 ms | 15 ms |
| B1. `GET /users/me` (token check, user + roles + permissions + session from PostgreSQL) | about 290–340 | 120–180 ms | 210–460 ms |
| B2. `GET /users?q=synth` (the same, plus a trigram search and count) | about 150–230 | 215–310 ms | 260–630 ms |

- **What limits it here.** A CPU profile taken during test B1 showed the Node process **about 60% idle**. The time goes to waiting for the database: Docker on WSL2, on a laptop busy with the emulator.
- **What made no difference** (measured, then left out):
  - a bigger Prisma connection pool: 9 and 40 connections gave the same throughput
  - loading roles with SQL joins instead of separate queries
- **What would help on real hardware:** a real database server and more API instances. See section 4.

**C. Per-account limit under attack.** One account sent requests as fast as possible (20 connections, 10 seconds, normal limits):
- Of about 15,000 requests, **exactly 120 succeeded**, which is the per-minute allowance.
- All the others got `429` with `Retry-After`, answered in a median of **9 ms**, so the flood could not tie up the server.
- Other accounts are unaffected, as tested in `rate-limit.int-spec.ts`.

**What these numbers mean.** Suppose a typical active user makes a few requests a minute: opening screens and syncing. Then one instance on this laptop serves on the order of **a few thousand people using the app at the same moment**. A national rollout would run several instances on server hardware. This is a rough planning figure, not a guarantee. Real capacity must be measured on the target servers with realistic traffic.

## 4. Honest limits of the prototype
- **Not tested:** multiple API instances under load, a production database, or a realistic mix of traffic.
- **No database connection pooler** (PgBouncer) is configured. With many instances, each instance's pool must be sized so the total stays under PostgreSQL's `max_connections` (100 in development).
- **Redis is a single node.** Production would use a managed or replicated Redis; the limiter fails open if Redis is lost.
- **No CDN or load balancer** is configured. Both are standard deployment infrastructure, outside this prototype.
- **Audit logging** writes one row per sensitive action in the same database. At national scale, it would move to a partitioned table or a log pipeline.

## 5. How to repeat the measurements
1. Start everything: `6-infrastructure\scripts\dev-up.ps1`.
2. Create a throwaway admin: `cd backend && npm run e2e:user -- --role admin`.
3. Start a second instance with the limits raised, for measuring only:
   `PORT=3100 RATE_LIMIT_MAX=10000000 USER_RATE_LIMIT_MAX=10000000 REDIS_URL= node dist/main`
4. Sign in to get a token, then run:
   `npx autocannon -c 50 -d 15 -H "Authorization=Bearer <token>" http://localhost:3100/api/v1/users/me`
5. For test C, send the same command to port 3000 (normal limits) and count the 2xx responses.
