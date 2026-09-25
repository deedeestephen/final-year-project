-- CreateEnum
CREATE TYPE "UserStatus" AS ENUM ('ACTIVE', 'LOCKED', 'DISABLED');

-- CreateEnum
CREATE TYPE "FacilityType" AS ENUM ('REFERRAL_HOSPITAL', 'PROVINCIAL_HOSPITAL', 'DISTRICT_HOSPITAL', 'HEALTH_CENTRE', 'SCREENING_SITE');

-- CreateEnum
CREATE TYPE "RegionClass" AS ENUM ('URBAN', 'PERI_URBAN', 'RURAL');

-- CreateEnum
CREATE TYPE "DreFinding" AS ENUM ('NORMAL', 'ENLARGED_SMOOTH', 'NODULAR', 'INDURATED', 'NOT_PERFORMED');

-- CreateEnum
CREATE TYPE "BiopsyHistory" AS ENUM ('NONE', 'PRIOR_NEGATIVE', 'PRIOR_POSITIVE', 'UNKNOWN');

-- CreateEnum
CREATE TYPE "ConsentType" AS ENUM ('DATA_PROCESSING', 'AI_ANALYSIS', 'RESEARCH_USE', 'EHR_SHARING');

-- CreateEnum
CREATE TYPE "ConsentStatus" AS ENUM ('GRANTED', 'WITHDRAWN');

-- CreateEnum
CREATE TYPE "ConsentMethod" AS ENUM ('WRITTEN', 'VERBAL_WITNESSED', 'DIGITAL');

-- CreateEnum
CREATE TYPE "ImagingModality" AS ENUM ('MRI', 'TRUS', 'CT');

-- CreateEnum
CREATE TYPE "FileStatus" AS ENUM ('UPLOADING', 'QUARANTINED', 'VALIDATED', 'REJECTED', 'PROCESSING', 'PROCESSED', 'FAILED');

-- CreateEnum
CREATE TYPE "ModelArchitecture" AS ENUM ('UNET', 'RESNET50', 'ANN', 'PATCH_CNN_MIL', 'XGBOOST_FUSION');

-- CreateEnum
CREATE TYPE "ModelProvenance" AS ENUM ('MOCK', 'RESEARCH_MODEL');

-- CreateEnum
CREATE TYPE "ModelStatus" AS ENUM ('REGISTERED', 'ACTIVE', 'RETIRED');

-- CreateEnum
CREATE TYPE "AiJobStatus" AS ENUM ('QUEUED', 'RUNNING', 'SUCCEEDED', 'FAILED', 'TIMED_OUT');

-- CreateEnum
CREATE TYPE "ExplanationKind" AS ENUM ('GRADCAM', 'SHAP', 'MIL_ATTENTION');

-- CreateEnum
CREATE TYPE "SyncOperationType" AS ENUM ('CREATE', 'UPDATE');

-- CreateEnum
CREATE TYPE "SyncResult" AS ENUM ('APPLIED', 'CONFLICT', 'REJECTED');

-- CreateEnum
CREATE TYPE "AuditOutcome" AS ENUM ('SUCCESS', 'DENIED', 'FAILURE');

-- CreateTable
CREATE TABLE "users" (
    "id" UUID NOT NULL,
    "email" TEXT NOT NULL,
    "password_hash" TEXT NOT NULL,
    "display_name" TEXT NOT NULL,
    "status" "UserStatus" NOT NULL DEFAULT 'ACTIVE',
    "failed_login_count" INTEGER NOT NULL DEFAULT 0,
    "locked_until" TIMESTAMPTZ(3),
    "last_login_at" TIMESTAMPTZ(3),
    "must_change_password" BOOLEAN NOT NULL DEFAULT false,
    "facility_id" UUID,
    "is_synthetic" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "roles" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL,

    CONSTRAINT "roles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "permissions" (
    "id" UUID NOT NULL,
    "code" TEXT NOT NULL,
    "description" TEXT NOT NULL,

    CONSTRAINT "permissions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_roles" (
    "user_id" UUID NOT NULL,
    "role_id" UUID NOT NULL,
    "assigned_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "user_roles_pkey" PRIMARY KEY ("user_id","role_id")
);

-- CreateTable
CREATE TABLE "role_permissions" (
    "role_id" UUID NOT NULL,
    "permission_id" UUID NOT NULL,

    CONSTRAINT "role_permissions_pkey" PRIMARY KEY ("role_id","permission_id")
);

-- CreateTable
CREATE TABLE "refresh_tokens" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "token_hash" TEXT NOT NULL,
    "family_id" UUID NOT NULL,
    "expires_at" TIMESTAMPTZ(3) NOT NULL,
    "revoked_at" TIMESTAMPTZ(3),
    "replaced_by_id" UUID,
    "user_agent" TEXT,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "refresh_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "password_reset_tokens" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "token_hash" TEXT NOT NULL,
    "expires_at" TIMESTAMPTZ(3) NOT NULL,
    "used_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "password_reset_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "facilities" (
    "id" UUID NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" "FacilityType" NOT NULL,
    "province" TEXT NOT NULL,
    "district" TEXT NOT NULL,
    "region_class" "RegionClass" NOT NULL,
    "is_synthetic" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "facilities_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "patients" (
    "id" UUID NOT NULL,
    "facility_id" UUID NOT NULL,
    "user_id" UUID,
    "mrn" TEXT NOT NULL,
    "given_name_enc" BYTEA NOT NULL,
    "family_name_enc" BYTEA NOT NULL,
    "national_id_enc" BYTEA,
    "national_id_hmac" TEXT,
    "phone_enc" BYTEA,
    "date_of_birth" DATE NOT NULL,
    "region_class" "RegionClass" NOT NULL,
    "district" TEXT,
    "is_synthetic" BOOLEAN NOT NULL DEFAULT false,
    "version" INTEGER NOT NULL DEFAULT 1,
    "client_uuid" UUID,
    "created_by_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "patients_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "clinical_records" (
    "id" UUID NOT NULL,
    "patient_id" UUID NOT NULL,
    "facility_id" UUID NOT NULL,
    "recorded_by_id" UUID NOT NULL,
    "encounter_date" DATE NOT NULL,
    "psa_ng_ml" DECIMAL(8,3),
    "free_psa_ng_ml" DECIMAL(8,3),
    "dre_finding" "DreFinding" NOT NULL,
    "pirads_score" INTEGER,
    "prostate_volume_ml" DECIMAL(6,1),
    "biopsy_history" "BiopsyHistory" NOT NULL DEFAULT 'UNKNOWN',
    "family_history" BOOLEAN,
    "symptoms" JSONB,
    "notes" TEXT,
    "version" INTEGER NOT NULL DEFAULT 1,
    "client_uuid" UUID,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "clinical_records_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "consents" (
    "id" UUID NOT NULL,
    "patient_id" UUID NOT NULL,
    "type" "ConsentType" NOT NULL,
    "status" "ConsentStatus" NOT NULL,
    "method" "ConsentMethod" NOT NULL,
    "consent_text_version" TEXT NOT NULL,
    "granted_at" TIMESTAMPTZ(3) NOT NULL,
    "withdrawn_at" TIMESTAMPTZ(3),
    "captured_by_id" UUID NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "consents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "imaging_studies" (
    "id" UUID NOT NULL,
    "patient_id" UUID NOT NULL,
    "modality" "ImagingModality" NOT NULL,
    "storage_key" TEXT NOT NULL,
    "sha256" TEXT NOT NULL,
    "size_bytes" BIGINT NOT NULL,
    "mime_type" TEXT NOT NULL,
    "study_instance_uid" TEXT,
    "series_instance_uid" TEXT,
    "status" "FileStatus" NOT NULL DEFAULT 'UPLOADING',
    "rejection_reason" TEXT,
    "uploaded_by_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "imaging_studies_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "histopathology_specimens" (
    "id" UUID NOT NULL,
    "patient_id" UUID NOT NULL,
    "storage_key" TEXT NOT NULL,
    "sha256" TEXT NOT NULL,
    "size_bytes" BIGINT NOT NULL,
    "format" TEXT NOT NULL,
    "stain" TEXT,
    "biopsy_date" DATE,
    "status" "FileStatus" NOT NULL DEFAULT 'UPLOADING',
    "gleason_primary" INTEGER,
    "gleason_secondary" INTEGER,
    "isup_grade_group" INTEGER,
    "reviewed_by_id" UUID,
    "uploaded_by_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "histopathology_specimens_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ai_models" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "architecture" "ModelArchitecture" NOT NULL,
    "version" TEXT NOT NULL,
    "provenance" "ModelProvenance" NOT NULL,
    "status" "ModelStatus" NOT NULL DEFAULT 'REGISTERED',
    "artifact_uri" TEXT,
    "evaluation" JSONB,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ai_models_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ai_jobs" (
    "id" UUID NOT NULL,
    "patient_id" UUID NOT NULL,
    "requested_by_id" UUID NOT NULL,
    "status" "AiJobStatus" NOT NULL DEFAULT 'QUEUED',
    "inputs" JSONB NOT NULL,
    "model_versions" JSONB,
    "report_id" TEXT,
    "error" TEXT,
    "started_at" TIMESTAMPTZ(3),
    "finished_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "ai_jobs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "explainability_artifacts" (
    "id" UUID NOT NULL,
    "job_id" UUID NOT NULL,
    "model_id" UUID,
    "kind" "ExplanationKind" NOT NULL,
    "storage_key" TEXT,
    "unavailable_reason" TEXT,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "explainability_artifacts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notifications" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "type" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "read_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notifications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sync_operations" (
    "id" UUID NOT NULL,
    "idempotency_key" TEXT NOT NULL,
    "user_id" UUID NOT NULL,
    "device_id" TEXT NOT NULL,
    "entity_type" TEXT NOT NULL,
    "entity_id" UUID,
    "operation" "SyncOperationType" NOT NULL,
    "base_version" INTEGER,
    "resulting_version" INTEGER,
    "result" "SyncResult" NOT NULL,
    "conflict_detail" JSONB,
    "client_timestamp" TIMESTAMPTZ(3) NOT NULL,
    "received_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "sync_operations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_logs" (
    "seq" BIGSERIAL NOT NULL,
    "occurred_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actor_user_id" UUID,
    "actor_role" TEXT,
    "action" TEXT NOT NULL,
    "entity_type" TEXT NOT NULL,
    "entity_id" TEXT,
    "outcome" "AuditOutcome" NOT NULL,
    "request_id" TEXT,
    "ip" TEXT,
    "details" JSONB,
    "prev_hash" TEXT NOT NULL DEFAULT '',
    "row_hash" TEXT NOT NULL DEFAULT '',

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("seq")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE INDEX "users_facility_id_idx" ON "users"("facility_id");

-- CreateIndex
CREATE UNIQUE INDEX "roles_name_key" ON "roles"("name");

-- CreateIndex
CREATE UNIQUE INDEX "permissions_code_key" ON "permissions"("code");

-- CreateIndex
CREATE UNIQUE INDEX "refresh_tokens_token_hash_key" ON "refresh_tokens"("token_hash");

-- CreateIndex
CREATE INDEX "refresh_tokens_user_id_idx" ON "refresh_tokens"("user_id");

-- CreateIndex
CREATE INDEX "refresh_tokens_family_id_idx" ON "refresh_tokens"("family_id");

-- CreateIndex
CREATE UNIQUE INDEX "password_reset_tokens_token_hash_key" ON "password_reset_tokens"("token_hash");

-- CreateIndex
CREATE INDEX "password_reset_tokens_user_id_idx" ON "password_reset_tokens"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "facilities_code_key" ON "facilities"("code");

-- CreateIndex
CREATE UNIQUE INDEX "patients_user_id_key" ON "patients"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "patients_national_id_hmac_key" ON "patients"("national_id_hmac");

-- CreateIndex
CREATE UNIQUE INDEX "patients_client_uuid_key" ON "patients"("client_uuid");

-- CreateIndex
CREATE INDEX "patients_facility_id_idx" ON "patients"("facility_id");

-- CreateIndex
CREATE UNIQUE INDEX "patients_facility_id_mrn_key" ON "patients"("facility_id", "mrn");

-- CreateIndex
CREATE UNIQUE INDEX "clinical_records_client_uuid_key" ON "clinical_records"("client_uuid");

-- CreateIndex
CREATE INDEX "clinical_records_patient_id_encounter_date_idx" ON "clinical_records"("patient_id", "encounter_date");

-- CreateIndex
CREATE INDEX "consents_patient_id_type_idx" ON "consents"("patient_id", "type");

-- CreateIndex
CREATE UNIQUE INDEX "imaging_studies_storage_key_key" ON "imaging_studies"("storage_key");

-- CreateIndex
CREATE INDEX "imaging_studies_patient_id_idx" ON "imaging_studies"("patient_id");

-- CreateIndex
CREATE UNIQUE INDEX "histopathology_specimens_storage_key_key" ON "histopathology_specimens"("storage_key");

-- CreateIndex
CREATE INDEX "histopathology_specimens_patient_id_idx" ON "histopathology_specimens"("patient_id");

-- CreateIndex
CREATE UNIQUE INDEX "ai_models_name_version_key" ON "ai_models"("name", "version");

-- CreateIndex
CREATE INDEX "ai_jobs_patient_id_created_at_idx" ON "ai_jobs"("patient_id", "created_at");

-- CreateIndex
CREATE INDEX "ai_jobs_status_idx" ON "ai_jobs"("status");

-- CreateIndex
CREATE INDEX "explainability_artifacts_job_id_idx" ON "explainability_artifacts"("job_id");

-- CreateIndex
CREATE INDEX "notifications_user_id_read_at_idx" ON "notifications"("user_id", "read_at");

-- CreateIndex
CREATE UNIQUE INDEX "sync_operations_idempotency_key_key" ON "sync_operations"("idempotency_key");

-- CreateIndex
CREATE INDEX "sync_operations_user_id_received_at_idx" ON "sync_operations"("user_id", "received_at");

-- CreateIndex
CREATE INDEX "audit_logs_entity_type_entity_id_idx" ON "audit_logs"("entity_type", "entity_id");

-- CreateIndex
CREATE INDEX "audit_logs_actor_user_id_occurred_at_idx" ON "audit_logs"("actor_user_id", "occurred_at");

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_facility_id_fkey" FOREIGN KEY ("facility_id") REFERENCES "facilities"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_roles" ADD CONSTRAINT "user_roles_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_roles" ADD CONSTRAINT "user_roles_role_id_fkey" FOREIGN KEY ("role_id") REFERENCES "roles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "role_permissions" ADD CONSTRAINT "role_permissions_role_id_fkey" FOREIGN KEY ("role_id") REFERENCES "roles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "role_permissions" ADD CONSTRAINT "role_permissions_permission_id_fkey" FOREIGN KEY ("permission_id") REFERENCES "permissions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "refresh_tokens" ADD CONSTRAINT "refresh_tokens_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "password_reset_tokens" ADD CONSTRAINT "password_reset_tokens_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "patients" ADD CONSTRAINT "patients_facility_id_fkey" FOREIGN KEY ("facility_id") REFERENCES "facilities"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "patients" ADD CONSTRAINT "patients_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "clinical_records" ADD CONSTRAINT "clinical_records_patient_id_fkey" FOREIGN KEY ("patient_id") REFERENCES "patients"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "clinical_records" ADD CONSTRAINT "clinical_records_facility_id_fkey" FOREIGN KEY ("facility_id") REFERENCES "facilities"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "consents" ADD CONSTRAINT "consents_patient_id_fkey" FOREIGN KEY ("patient_id") REFERENCES "patients"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "imaging_studies" ADD CONSTRAINT "imaging_studies_patient_id_fkey" FOREIGN KEY ("patient_id") REFERENCES "patients"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "histopathology_specimens" ADD CONSTRAINT "histopathology_specimens_patient_id_fkey" FOREIGN KEY ("patient_id") REFERENCES "patients"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_jobs" ADD CONSTRAINT "ai_jobs_patient_id_fkey" FOREIGN KEY ("patient_id") REFERENCES "patients"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "explainability_artifacts" ADD CONSTRAINT "explainability_artifacts_job_id_fkey" FOREIGN KEY ("job_id") REFERENCES "ai_jobs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "explainability_artifacts" ADD CONSTRAINT "explainability_artifacts_model_id_fkey" FOREIGN KEY ("model_id") REFERENCES "ai_models"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
