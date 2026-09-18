-- Decision Memory: company-private prior tender decision snapshots
ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'DECISION_MEMORY_RECORDED';
ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'DECISION_MEMORY_COMPARED';

CREATE TABLE IF NOT EXISTS "DecisionMemory" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "tenderId" TEXT NOT NULL,
    "decision" "DecisionType" NOT NULL,
    "title" TEXT NOT NULL,
    "client" TEXT,
    "country" TEXT,
    "industry" TEXT,
    "fitScore" INTEGER,
    "readinessScore" INTEGER,
    "bidScore" INTEGER,
    "confidence" "ConfidenceLevel" NOT NULL DEFAULT 'MEDIUM',
    "reasoning" TEXT NOT NULL,
    "requirementsSnapshot" JSONB NOT NULL,
    "risksSnapshot" JSONB NOT NULL,
    "scoresSnapshot" JSONB NOT NULL,
    "relevanceFeatures" JSONB NOT NULL,
    "featureKey" TEXT NOT NULL,
    "analyzedAt" TIMESTAMP(3) NOT NULL,
    "contentHash" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DecisionMemory_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "DecisionMemory_tenderId_key" ON "DecisionMemory"("tenderId");
CREATE UNIQUE INDEX IF NOT EXISTS "DecisionMemory_companyId_tenderId_key" ON "DecisionMemory"("companyId", "tenderId");
CREATE INDEX IF NOT EXISTS "DecisionMemory_companyId_analyzedAt_idx" ON "DecisionMemory"("companyId", "analyzedAt");
CREATE INDEX IF NOT EXISTS "DecisionMemory_companyId_decision_idx" ON "DecisionMemory"("companyId", "decision");
CREATE INDEX IF NOT EXISTS "DecisionMemory_companyId_featureKey_idx" ON "DecisionMemory"("companyId", "featureKey");

DO $$ BEGIN
  ALTER TABLE "DecisionMemory" ADD CONSTRAINT "DecisionMemory_companyId_fkey"
    FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "DecisionMemory" ADD CONSTRAINT "DecisionMemory_tenderId_fkey"
    FOREIGN KEY ("tenderId") REFERENCES "Tender"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
