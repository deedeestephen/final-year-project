-- ADR-014: push notifications through Firebase Cloud Messaging.

-- When the push sender took a notification; null while push is off or not yet sent.
ALTER TABLE "notifications" ADD COLUMN "pushed_at" TIMESTAMPTZ(3);
CREATE INDEX "notifications_pushed_at_created_at_idx" ON "notifications"("pushed_at", "created_at");

-- The phones of each account that receive push notifications.
CREATE TABLE "push_devices" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "token" TEXT NOT NULL,
    "platform" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "last_seen_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "push_devices_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "push_devices_platform_ck" CHECK ("platform" IN ('android', 'ios')),
    CONSTRAINT "push_devices_token_ck" CHECK (char_length("token") BETWEEN 1 AND 4096)
);

CREATE UNIQUE INDEX "push_devices_token_key" ON "push_devices"("token");
CREATE INDEX "push_devices_user_id_last_seen_at_idx" ON "push_devices"("user_id", "last_seen_at");

ALTER TABLE "push_devices" ADD CONSTRAINT "push_devices_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
