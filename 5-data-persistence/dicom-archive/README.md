# DICOM archive: MRI, TRUS, CT scans and whole-slide images

Image files are kept in **object storage**, never in a database:
- development: `STORAGE_DRIVER=local`, files under `3-application-logic/backend/var/objects` (git-ignored), or `s3` with MinIO from docker compose
- deployment: any S3-compatible store with encryption at rest

| Rule | Why |
|---|---|
| Keys are made by the server: `imaging/YYYY/MM/<uuid>.dcm`, `slides/YYYY/MM/<uuid>.tif` | no user-supplied paths; the original file name (which may contain a name) is never stored |
| Write-once: an existing key can never be overwritten | the archive cannot be silently changed |
| A file is recorded only after its checks pass (size, magic bytes, DICOM header and modality) | nothing unchecked is ever used |
| The database row keeps the SHA-256 of the file | tampering can be detected |
| Downloads are audited and sent as attachments | who looked at which image is recorded |

Code: `3-application-logic/backend/src/persistence/storage/` (drivers) and `src/services/imaging/` (upload and checks). Synthetic test files: `npm run fixtures` in the backend folder.

**Known limit:** stored DICOM headers still contain their original tags. De-identifying the files before any AI use is planned for Phase 15.
