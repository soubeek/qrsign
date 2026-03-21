-- DropIndex
DROP INDEX "participants_data_gin_idx";

-- AlterTable
ALTER TABLE "document_defs" ADD COLUMN     "signature_position" TEXT NOT NULL DEFAULT 'left';

-- AlterTable
ALTER TABLE "email_configs" ALTER COLUMN "subject" SET DEFAULT 'Votre document signe';
