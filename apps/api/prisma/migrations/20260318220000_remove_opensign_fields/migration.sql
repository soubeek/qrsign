-- Remove OpenSign fields from document_defs
ALTER TABLE "document_defs" DROP COLUMN IF EXISTS "opensign_template_id";
ALTER TABLE "document_defs" DROP COLUMN IF EXISTS "opensign_synced_at";

-- Remove OpenSign fields from participants
ALTER TABLE "participants" DROP COLUMN IF EXISTS "opensign_submission_id";
ALTER TABLE "participants" DROP COLUMN IF EXISTS "opensign_signed_pdf_url";
ALTER TABLE "participants" DROP COLUMN IF EXISTS "signing_backend";
