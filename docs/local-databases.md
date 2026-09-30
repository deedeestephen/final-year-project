# The databases on this PC: PostgreSQL 18 and MongoDB 8.3

Since 2026-09-29 (owner request), the project keeps its data in the database servers **installed on the PC**, not in Docker. You can open them with **pgAdmin 4** and **MongoDB Compass**, which are already installed.

| What | Server | Port | Database | Login used by the app |
|---|---|---|---|---|
| Accounts, patients, screenings, consents, AI jobs, audit log (20 tables) | PostgreSQL 18 (Windows service `postgresql-x64-18`) | 5432 | `pca_mhealth` | `pca` |
| AI reports, AI logs, scan details, chats (4 collections) | MongoDB 8.3 (Windows service `MongoDB`) | 27017 | `pca_mhealth` | `pca` |
| Uploaded scan and slide files | A folder on this PC: `3-application-logic/backend/var/objects` (`STORAGE_DRIVER=local` in `.env`) | | | |
| The same files when `STORAGE_DRIVER=s3` (also used by the database tests) | MinIO in Docker | 9000 (console 9001) | bucket `pca-mhealth` | from `.env` |
| Rate limits shared between API copies | Redis in Docker | 6379 | 0 | from `.env` |
| Vector search (planned; not used while `VECTOR_STORE=memory`) | Qdrant in Docker | 6333 | | none |

All passwords are in the project's `.env` file, which is never committed:
- `POSTGRES_PASSWORD` and `MONGO_PASSWORD` are for the `pca` logins.
- `LOCAL_POSTGRES_ADMIN_PASSWORD` is for the PostgreSQL admin (`postgres`), chosen when PostgreSQL was installed.

`SEED_DEMO_PASSWORD` is the password of the four synthetic demo accounts (`admin@`, `clinician@`, `pathologist@` and `patient@demo.pca-mhealth.test`).

> Open `.env`, not `.env.example`. The example file is a template with empty values.

## Starting everything

1. Both database services start with Windows. `6-infrastructure\scripts\dev-up.ps1` checks that they are running and starts them if needed (that needs an administrator PowerShell).
2. It then starts Redis, MinIO and Qdrant in Docker, the backend, the admin website and the AI service.

To check the services by hand: open **Services** (press Win+R, type `services.msc`) and look for **postgresql-x64-18** and **MongoDB Server (MongoDB)**. Both should say *Running* and *Automatic*.

## Looking at the data

### PostgreSQL in pgAdmin 4

1. Start **pgAdmin 4** from the Start menu.
2. In the tree on the left, open **Servers › PostgreSQL 18**. It asks for the password of `postgres`: the `LOCAL_POSTGRES_ADMIN_PASSWORD` in `.env`.
3. Open **Databases › pca_mhealth › Schemas › public › Tables**.
4. Right-click a table (for example `users`), then **View/Edit Data › All Rows**.
5. **Query Tool** (Tools menu) runs SQL. For example:

```sql
-- Every account with its roles
SELECT u.email, u.display_name, u.status, string_agg(r.name, ', ') AS roles
FROM users u
LEFT JOIN user_roles ur ON ur.user_id = u.id
LEFT JOIN roles r ON r.id = ur.role_id
GROUP BY u.id ORDER BY u.created_at;
```

### MongoDB in Compass

1. Start **MongoDB Compass**.
2. **New connection**, URI `mongodb://localhost:27017`, then **Connect**.
3. Open the **pca_mhealth** database. You will see `ai_reports`, `ai_inference_logs`, `imaging_metadata` and `chatbot_conversations`.

### Add or delete accounts on the admin website, not in the database

Use the admin website (http://localhost:5173, **Users**) to add, change, disable or delete accounts. Editing the tables by hand goes wrong in three ways:
- Passwords are stored only as Argon2 hashes, and phone and NRC numbers are encrypted, so a row typed into pgAdmin cannot sign in.
- Deleting a row either fails on its links to other records or silently leaves records that point at nobody.
- Changes made by hand are missing from the audit log, and editing `audit_logs` breaks its hash chain. **Audit log › Check integrity** on the admin website would then report tampering.

Reading the data in pgAdmin or Compass is always safe.

## How the databases were set up (2026-09-29)

Before this, the project ran its own PostgreSQL 16 (port 5433) and MongoDB 7 (port 27018) in Docker. The move went as follows. The steps are repeatable on another PC.

**1. PostgreSQL: a login and a database.** Run in pgAdmin's Query Tool as `postgres`, or with `psql -U postgres`:

```sql
CREATE ROLE pca LOGIN CREATEDB PASSWORD '<POSTGRES_PASSWORD from .env>';
CREATE DATABASE pca_mhealth OWNER pca ENCODING 'UTF8' TEMPLATE template0;
```

`pca` is not a superuser. It owns its database and may create databases, because the database tests create and remove throwaway databases called `pca_mhealth_<run>_test`. The two extensions the schema needs, `pg_trgm` and `pgcrypto`, come with PostgreSQL 18. Database owners may create them.

**2. PostgreSQL: the data.** Use the PostgreSQL 18 tools, which can also read the older 16 server:

```powershell
cd "C:\Program Files\PostgreSQL\18\bin"
.\pg_dump.exe -h localhost -p 5433 -U pca -d pca_mhealth -Fc -f "$env:TEMP\pca_mhealth.dump"
.\pg_restore.exe -h localhost -p 5432 -U pca -d pca_mhealth --no-owner --no-privileges "$env:TEMP\pca_mhealth.dump"
```

**Check:** all 20 tables had the same row counts on both servers (788 rows). The audit log's hash chain still verified (347 entries, *intact*), and `npx prisma migrate status` said *Database schema is up to date*.

**3. MongoDB: a login.** Access control is not switched on in this MongoDB (see Security below), so the login can be created straight away. For example, in `mongosh` or Compass's shell:

```js
use admin
db.createUser({ user: 'pca', pwd: '<MONGO_PASSWORD from .env>',
  roles: [ { role: 'readWriteAnyDatabase', db: 'admin' }, { role: 'dbAdminAnyDatabase', db: 'admin' } ] })
```

The two roles let the app use `pca_mhealth` and let the tests create and drop their own databases.

**4. MongoDB: the data.** In `3-application-logic/backend`:

```powershell
npx ts-node --transpile-only tools/copy-mongo.ts "<old MONGO_URL, port 27018>" "<new MONGO_URL, port 27017>"
```

It copies every collection with its validation rules and indexes: 4 collections, 17 documents. A collection that already has documents in the target is skipped.

**5. `.env`:** `DATABASE_URL` and `MONGO_URL` now use ports **5432** and **27017**.

**6. Docker:** the PostgreSQL and MongoDB containers are now in the optional `docker-db` profile of `6-infrastructure/docker/docker-compose.yml`. They were stopped, and their data volumes are kept as a backup.

**Result:** all 227 database integration tests (16 suites) pass on the installed servers.

The same evening, the development passwords of the `pca` logins, Redis and MinIO were changed. They had been shown in a chat by mistake. The Docker copies were given the new passwords too.

## Backups

**PostgreSQL** (a single file):

```powershell
& "C:\Program Files\PostgreSQL\18\bin\pg_dump.exe" -h localhost -U pca -d pca_mhealth -Fc -f D:\backups\pca_mhealth_$(Get-Date -Format yyyyMMdd).dump
```

Restore it into an empty `pca_mhealth` with `pg_restore` as in step 2. pgAdmin can do the same: right-click the database, then **Backup…** or **Restore…**.

**MongoDB:**
- `mongodump` and `mongorestore` come with the free *MongoDB Database Tools*, a separate download from mongodb.com.
- Without them, `tools/copy-mongo.ts` can copy the database to another server or database name.
- Compass can also export a collection to JSON or CSV (**Export Data**).

**Files:** the uploaded scans and slides are in the folder `3-application-logic/backend/var/objects`. Copy that folder to back them up. (With `STORAGE_DRIVER=s3` they would be in MinIO's Docker volume `pca-mhealth_miniodata` instead.)

## Switching back to the Docker databases

1. In `.env`, set `DATABASE_URL` to port **5433** and `MONGO_URL` to port **27018**. The hosts, users and passwords stay the same.
2. Run `6-infrastructure\scripts\dev-up.ps1 -DockerDatabases`. It starts the `docker-db` profile as well.

The Docker volumes hold the data as it was on 29 September.

## Security

- **PostgreSQL:**
  - The server listens on all network interfaces (`listen_addresses = '*'`).
  - Its access rules (`pg_hba.conf`) only accept connections **from this PC** (127.0.0.1 and ::1), with a password (SCRAM-SHA-256). Other computers are refused.
- **MongoDB:**
  - It listens only on 127.0.0.1, so other computers cannot connect.
  - **Access control is off**: any program on this PC can read or change it without a password. That is MongoDB's default for a desktop install, and it is acceptable here only because the data is synthetic.
  - **Before any real data:** turn it on by adding the lines below to `C:\Program Files\MongoDB\Server\8.3\bin\mongod.cfg`, then restart the MongoDB service. The app already signs in as `pca`.
    ```yaml
    security:
      authorization: enabled
    ```
    First create an administrator user for yourself. Other programs on this PC that use MongoDB without a login would then need one too.
- **The `postgres` admin password:** only the set-up steps above use it; the app never does.

## Troubleshooting

| What you see | What to do |
|---|---|
| `dev-up.ps1`: *Database migration failed* | Check that the PostgreSQL service is running, and that `DATABASE_URL` in `.env` uses port 5432 |
| The backend log shows `Authentication failed` for MongoDB | `MONGO_URL` and the `pca` password in MongoDB differ; run the `db.updateUser('pca', { pwd: … })` command with the `.env` password |
| pgAdmin asks for a password and refuses it | It is the `postgres` password (`LOCAL_POSTGRES_ADMIN_PASSWORD`), not the `pca` one |
| The admin website says *Email or password is incorrect* | Use the value of `SEED_DEMO_PASSWORD` in `.env` (not `.env.example`), or run `dev-up.ps1 -ResetDemoPasswords` |
| *This account is temporarily locked* | 5 wrong tries lock it for 15 minutes; wait, or run `dev-up.ps1 -ResetDemoPasswords` |
