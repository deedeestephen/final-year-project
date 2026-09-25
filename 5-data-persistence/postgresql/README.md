# PostgreSQL: patient records, user accounts, consent, audit logs

- **`migrations/`** (here): the database's change history, applied in order. Raw SQL adds what Prisma cannot express:
  - CHECK constraints
  - the **append-only audit log** (a trigger rejects UPDATE and DELETE) with a SHA-256 hash chain
  - trigram search indexes
  **Never edit an applied migration.** Add a new one.
- **The data model** (every table, relation and index) is `3-application-logic/backend/prisma/schema.prisma`. It has to live inside the backend program, because Prisma generates the database client from it into that program. Details: [docs/database.md](../../docs/database.md).

The backend finds both through `3-application-logic/backend/prisma.config.ts`. Commands, from `3-application-logic/backend`:

| Command | What it does |
|---|---|
| `npx prisma migrate deploy` | apply migrations that have not run yet (safe; `dev-up.ps1` does this) |
| `npx prisma migrate status` | show whether the database is up to date |
| `npm run db:seed` | add the synthetic demo facility, patients and accounts |

Patient names, national IDs and phone numbers are stored **encrypted** (AES-256-GCM, column level), with an HMAC for exact-match lookups.
