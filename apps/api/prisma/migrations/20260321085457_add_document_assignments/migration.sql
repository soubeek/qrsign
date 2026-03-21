-- CreateTable
CREATE TABLE "document_assignments" (
    "id" TEXT NOT NULL,
    "document_def_id" TEXT NOT NULL,
    "participant_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "document_assignments_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "document_assignments_document_def_id_participant_id_key" ON "document_assignments"("document_def_id", "participant_id");

-- AddForeignKey
ALTER TABLE "document_assignments" ADD CONSTRAINT "document_assignments_document_def_id_fkey" FOREIGN KEY ("document_def_id") REFERENCES "document_defs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "document_assignments" ADD CONSTRAINT "document_assignments_participant_id_fkey" FOREIGN KEY ("participant_id") REFERENCES "participants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
