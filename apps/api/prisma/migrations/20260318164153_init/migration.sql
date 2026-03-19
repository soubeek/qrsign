-- CreateEnum
CREATE TYPE "GlobalRole" AS ENUM ('SUPER_ADMIN', 'ADMIN', 'OPERATOR', 'VIEWER');

-- CreateEnum
CREATE TYPE "FieldType" AS ENUM ('TEXT', 'EMAIL', 'TEL', 'DATE', 'SELECT', 'TEXTAREA', 'NUMBER');

-- CreateEnum
CREATE TYPE "Status" AS ENUM ('ABSENT', 'PRESENT', 'SIGNED');

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "password_hash" TEXT NOT NULL,
    "first_name" TEXT NOT NULL,
    "last_name" TEXT NOT NULL,
    "role" "GlobalRole" NOT NULL DEFAULT 'OPERATOR',
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "refresh_tokens" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "token_hash" TEXT NOT NULL,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "revoked_at" TIMESTAMP(3),

    CONSTRAINT "refresh_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_events" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "event_id" TEXT NOT NULL,
    "event_role" "GlobalRole",
    "assigned_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "user_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "events" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "subtitle" TEXT,
    "logo_emoji" TEXT NOT NULL DEFAULT '🏛️',
    "entity_singular" TEXT NOT NULL DEFAULT 'participant',
    "entity_plural" TEXT NOT NULL DEFAULT 'participants',
    "display_name_tpl" TEXT NOT NULL DEFAULT '{prenom} {nom}',
    "search_fields" TEXT[] DEFAULT ARRAY['nom', 'prenom']::TEXT[],
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "field_defs" (
    "id" TEXT NOT NULL,
    "event_id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "type" "FieldType" NOT NULL,
    "options" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "editable" BOOLEAN NOT NULL DEFAULT true,
    "required" BOOLEAN NOT NULL DEFAULT false,
    "display_in_list" BOOLEAN NOT NULL DEFAULT false,
    "display_order" INTEGER NOT NULL DEFAULT 0,
    "is_qr_field" BOOLEAN NOT NULL DEFAULT false,
    "is_email_field" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "field_defs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "document_defs" (
    "id" TEXT NOT NULL,
    "event_id" TEXT NOT NULL,
    "title" TEXT NOT NULL DEFAULT 'Consentement',
    "signing_label" TEXT NOT NULL DEFAULT 'Signer le document',
    "declaration_template" TEXT NOT NULL,
    "notice_sections" JSONB NOT NULL DEFAULT '[]',
    "pdf_footer_text" TEXT NOT NULL DEFAULT '',
    "signature_width_mm" INTEGER NOT NULL DEFAULT 75,
    "signature_height_mm" INTEGER NOT NULL DEFAULT 28,
    "opensign_template_id" TEXT,
    "opensign_synced_at" TIMESTAMP(3),

    CONSTRAINT "document_defs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "email_configs" (
    "id" TEXT NOT NULL,
    "event_id" TEXT NOT NULL,
    "smtp_host" TEXT NOT NULL,
    "smtp_port" INTEGER NOT NULL DEFAULT 587,
    "smtp_secure" BOOLEAN NOT NULL DEFAULT false,
    "smtp_user" TEXT NOT NULL,
    "smtp_pass" TEXT NOT NULL,
    "from_address" TEXT NOT NULL,
    "from_name" TEXT NOT NULL,
    "auto_send_on_sign" BOOLEAN NOT NULL DEFAULT false,
    "allow_manual_send" BOOLEAN NOT NULL DEFAULT true,
    "subject" TEXT NOT NULL DEFAULT 'Votre document signé',
    "body_template" TEXT NOT NULL,

    CONSTRAINT "email_configs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "participants" (
    "id" TEXT NOT NULL,
    "event_id" TEXT NOT NULL,
    "qr_code" TEXT NOT NULL,
    "status" "Status" NOT NULL DEFAULT 'ABSENT',
    "data" JSONB NOT NULL,
    "signature_data" TEXT,
    "signed_at" TIMESTAMP(3),
    "pdf_path" TEXT,
    "email_sent_at" TIMESTAMP(3),
    "opensign_submission_id" TEXT,
    "opensign_signed_pdf_url" TEXT,
    "signing_backend" TEXT NOT NULL DEFAULT 'opensign',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "participants_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "user_events_user_id_event_id_key" ON "user_events"("user_id", "event_id");

-- CreateIndex
CREATE UNIQUE INDEX "events_slug_key" ON "events"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "field_defs_event_id_key_key" ON "field_defs"("event_id", "key");

-- CreateIndex
CREATE UNIQUE INDEX "document_defs_event_id_key" ON "document_defs"("event_id");

-- CreateIndex
CREATE UNIQUE INDEX "email_configs_event_id_key" ON "email_configs"("event_id");

-- CreateIndex
CREATE UNIQUE INDEX "participants_event_id_qr_code_key" ON "participants"("event_id", "qr_code");

-- AddForeignKey
ALTER TABLE "refresh_tokens" ADD CONSTRAINT "refresh_tokens_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_events" ADD CONSTRAINT "user_events_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_events" ADD CONSTRAINT "user_events_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "events"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "field_defs" ADD CONSTRAINT "field_defs_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "events"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "document_defs" ADD CONSTRAINT "document_defs_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "events"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "email_configs" ADD CONSTRAINT "email_configs_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "events"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "participants" ADD CONSTRAINT "participants_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "events"("id") ON DELETE CASCADE ON UPDATE CASCADE;
