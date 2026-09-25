-- Patient self-registration identity (encrypted) and admin-editable role permissions.
-- AlterTable
ALTER TABLE "users" ADD COLUMN     "id_document_type" TEXT,
ADD COLUMN     "id_number_enc" BYTEA,
ADD COLUMN     "id_number_hmac" TEXT,
ADD COLUMN     "phone_enc" BYTEA;

-- AlterTable
ALTER TABLE "roles" ADD COLUMN     "customised" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "updated_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- CreateIndex
CREATE UNIQUE INDEX "users_id_number_hmac_key" ON "users"("id_number_hmac");


-- A document type must come with its number, and only known types are allowed.
ALTER TABLE "users" ADD CONSTRAINT "users_id_document_ck" CHECK (
  ("id_document_type" IS NULL AND "id_number_enc" IS NULL AND "id_number_hmac" IS NULL)
  OR ("id_document_type" IN ('NRC', 'PASSPORT') AND "id_number_enc" IS NOT NULL AND "id_number_hmac" IS NOT NULL)
);
