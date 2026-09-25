# MongoDB: AI reports, imaging metadata, chatbot interaction logs

Documents that vary in shape live here. Every collection has a JSON-Schema validator and indexes. They are defined in `3-application-logic/backend/src/persistence/mongo/collections.ts` and applied with `npm run db:mongo:migrate` (idempotent).

| Collection | Holds | Written by |
|---|---|---|
| `ai_reports` | one validated AI report per job: provenance, disclaimer (≥ 20 characters), model versions, outputs, explanations | AI broker (Phase 11) |
| `ai_inference_logs` | timeline of each AI job (started, succeeded or failed, duration) | AI broker |
| `imaging_metadata` | technical DICOM fields only (UIDs, modality, size), **never patient name or ID tags** | imaging service (Phase 10) |
| `chatbot_conversations` | chatbot messages with their sources (en, bem, nya) | chatbot (Phase 13) |

Reports refer to patients only by a pseudonym (`patientRef`), never by name or ID.
