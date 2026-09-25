# Backup, recovery and encryption at rest

## Development (this PC)
- **Back up** (safe; it only reads the databases):
  `powershell -ExecutionPolicy Bypass -File 5-data-persistence\backup-recovery\backup.ps1`
  → `var\backups\<date-time>\postgres.dump` and `mongo.archive.gz` (git-ignored).
- **Restore** (replaces the current data and asks you to type `RESTORE` first):
  `powershell -ExecutionPolicy Bypass -File 5-data-persistence\backup-recovery\restore.ps1 -Backup <date-time>`
- Uploaded files (`backend\var\objects`) are plain files. Copy that folder along with the backup.

Backups contain patient data (synthetic in development). Treat them like the database: never commit them, never email them.

## Encryption at rest
| What | How |
|---|---|
| Patient names, national IDs, phone numbers | AES-256-GCM per column in the app (`backend/src/persistence/crypto/field-crypto.ts`), HMAC for lookups |
| Data on the phone | SQLCipher (AES-256) database, key in the Android Keystore / iOS Keychain |
| Disks, object storage, backups | the cloud provider's encryption at rest (a deployment setting) |

## Deployment (not built in this prototype)
- **Automated backup:** managed PostgreSQL and MongoDB services with daily snapshots, kept at least 30 days, stored encrypted in the same country (data residency).
- **Point-in-time recovery:** PostgreSQL WAL archiving (continuous), which is a setting of the managed database, plus MongoDB oplog-based backups.
- **Test restores regularly.** An untested backup does not count.
