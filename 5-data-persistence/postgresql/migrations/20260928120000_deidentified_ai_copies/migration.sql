-- Phase 15: the AI only receives de-identified copies of image files.
ALTER TABLE "imaging_studies" ADD COLUMN "deid_storage_key" TEXT;
ALTER TABLE "imaging_studies" ADD COLUMN "ai_excluded_reason" TEXT;
CREATE UNIQUE INDEX "imaging_studies_deid_storage_key_key" ON "imaging_studies"("deid_storage_key");

ALTER TABLE "ai_jobs" ADD COLUMN "input_notes" JSONB;
