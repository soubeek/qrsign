-- Step 1: Create participant_signatures table
CREATE TABLE "participant_signatures" (
    "id" TEXT NOT NULL,
    "participant_id" TEXT NOT NULL,
    "document_def_id" TEXT NOT NULL,
    "signed_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "pdf_path" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "participant_signatures_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "participant_signatures_participant_id_document_def_id_key" ON "participant_signatures"("participant_id", "document_def_id");

ALTER TABLE "participant_signatures" ADD CONSTRAINT "participant_signatures_participant_id_fkey" FOREIGN KEY ("participant_id") REFERENCES "participants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "participant_signatures" ADD CONSTRAINT "participant_signatures_document_def_id_fkey" FOREIGN KEY ("document_def_id") REFERENCES "document_defs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Step 2: Add new fields to document_defs
ALTER TABLE "document_defs" ADD COLUMN IF NOT EXISTS "display_order" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "document_defs" ADD COLUMN IF NOT EXISTS "required" BOOLEAN NOT NULL DEFAULT true;

-- Step 3: Migrate existing signed participants to participant_signatures
INSERT INTO "participant_signatures" ("id", "participant_id", "document_def_id", "signed_at", "pdf_path")
SELECT
    gen_random_uuid()::text,
    p."id",
    d."id",
    COALESCE(p."signed_at", NOW()),
    p."pdf_path"
FROM "participants" p
JOIN "document_defs" d ON d."event_id" = p."event_id"
WHERE p."status" = 'SIGNED' AND p."signed_at" IS NOT NULL;

-- Step 4: Remove old columns from participants
ALTER TABLE "participants" DROP COLUMN IF EXISTS "signature_data";
ALTER TABLE "participants" DROP COLUMN IF EXISTS "signed_at";
ALTER TABLE "participants" DROP COLUMN IF EXISTS "pdf_path";

-- Step 5: Remove unique constraint on document_defs.event_id to allow multiple docs per event
DROP INDEX IF EXISTS "document_defs_event_id_key";
