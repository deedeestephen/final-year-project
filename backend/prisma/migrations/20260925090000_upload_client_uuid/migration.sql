-- Phase 10: retry-safe uploads and pathologist review time.
ALTER TABLE "imaging_studies" ADD COLUMN "client_uuid" UUID;
CREATE UNIQUE INDEX "imaging_studies_client_uuid_key" ON "imaging_studies"("client_uuid");

ALTER TABLE "histopathology_specimens" ADD COLUMN "client_uuid" UUID;
ALTER TABLE "histopathology_specimens" ADD COLUMN "reviewed_at" TIMESTAMPTZ(3);
CREATE UNIQUE INDEX "histopathology_specimens_client_uuid_key" ON "histopathology_specimens"("client_uuid");
