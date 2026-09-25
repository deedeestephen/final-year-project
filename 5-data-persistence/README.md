# Layer 5: Data Persistence

Where data is kept. In development every store runs in Docker (`6-infrastructure/docker/docker-compose.yml`). The code that talks to them is in `3-application-logic/backend/src/persistence/`.

| Part of the diagram | Folder | What is stored |
|---|---|---|
| PostgreSQL: patient records, user accounts, consent, audit logs | [`postgresql/`](postgresql/) | migrations (tables, constraints, append-only audit trigger and hash chain); the data model file is in the backend |
| MongoDB: AI reports, imaging metadata, chatbot logs | [`mongodb/`](mongodb/) | collection list and validation rules |
| DICOM archive: MRI, TRUS, CT scans, whole-slide images | [`dicom-archive/`](dicom-archive/) | object storage (MinIO / S3), key layout and rules |
| Vector database: chatbot knowledge-base embeddings | [`vector-db/`](vector-db/) | Qdrant (Phase 13) |
| AES-256 encryption at rest, automated backup, point-in-time recovery | [`backup-recovery/`](backup-recovery/) and `backend/src/persistence/crypto/` | backup and restore scripts; what is encrypted and how |
