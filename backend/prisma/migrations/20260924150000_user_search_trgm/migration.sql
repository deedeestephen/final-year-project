-- Fast substring search for the admin user list (pg_trgm).
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- CreateIndex
CREATE INDEX "users_email_trgm_idx" ON "users" USING GIN ("email" gin_trgm_ops);

-- CreateIndex
CREATE INDEX "users_display_name_trgm_idx" ON "users" USING GIN ("display_name" gin_trgm_ops);

