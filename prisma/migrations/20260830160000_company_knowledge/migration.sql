-- Company knowledge provenance + document classification
ALTER TABLE "CompanyProfile" ADD COLUMN IF NOT EXISTS "knowledgeJson" JSONB;
ALTER TABLE "TenderDocument" ADD COLUMN IF NOT EXISTS "documentKind" TEXT;
CREATE INDEX IF NOT EXISTS "TenderDocument_documentKind_idx" ON "TenderDocument"("documentKind");
