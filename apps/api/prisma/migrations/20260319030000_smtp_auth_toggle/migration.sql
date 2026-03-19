ALTER TABLE "email_configs" ADD COLUMN "smtp_auth" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "email_configs" ALTER COLUMN "smtp_user" SET DEFAULT '';
ALTER TABLE "email_configs" ALTER COLUMN "smtp_pass" SET DEFAULT '';
