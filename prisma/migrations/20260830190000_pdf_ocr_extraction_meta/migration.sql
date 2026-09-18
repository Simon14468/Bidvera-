-- AlterTable
ALTER TABLE "Tender" ADD COLUMN IF NOT EXISTS "analysisPhase" TEXT;

-- AlterTable
ALTER TABLE "TenderDocument" ADD COLUMN IF NOT EXISTS "extractionMeta" JSONB;
