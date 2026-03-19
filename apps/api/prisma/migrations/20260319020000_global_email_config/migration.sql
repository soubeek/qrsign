-- Remove event_id foreign key and column from email_configs
ALTER TABLE "email_configs" DROP CONSTRAINT IF EXISTS "email_configs_event_id_fkey";
DROP INDEX IF EXISTS "email_configs_event_id_key";
ALTER TABLE "email_configs" DROP COLUMN IF EXISTS "event_id";
