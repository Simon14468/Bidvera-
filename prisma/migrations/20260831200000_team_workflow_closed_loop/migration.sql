-- Closed-loop Tender Decision Workflow: verification, memory revisions, targeted alerts

ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'TEAM_TASK_VERIFIED';
ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'TEAM_TASK_REJECTED';
ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'TEAM_EVIDENCE_UPLOADED';
ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'TEAM_CLOSED_LOOP_RERUN';
ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'DECISION_MEMORY_REVISION';

DO $$ BEGIN
  CREATE TYPE "TeamEvidenceVerificationStatus" AS ENUM ('NONE', 'PENDING', 'VERIFIED', 'REJECTED');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

ALTER TYPE "TeamWorkflowEventType" ADD VALUE IF NOT EXISTS 'VERIFICATION_REQUESTED';
ALTER TYPE "TeamWorkflowEventType" ADD VALUE IF NOT EXISTS 'VERIFIED';
ALTER TYPE "TeamWorkflowEventType" ADD VALUE IF NOT EXISTS 'REJECTED';
ALTER TYPE "TeamWorkflowEventType" ADD VALUE IF NOT EXISTS 'REQUIREMENT_UPDATED';
ALTER TYPE "TeamWorkflowEventType" ADD VALUE IF NOT EXISTS 'DECISION_RERUN';

ALTER TABLE "TeamWorkflowTask"
  ADD COLUMN IF NOT EXISTS "responseSubmittedAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "responseSubmittedById" TEXT,
  ADD COLUMN IF NOT EXISTS "verificationStatus" "TeamEvidenceVerificationStatus" NOT NULL DEFAULT 'NONE',
  ADD COLUMN IF NOT EXISTS "verifiedAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "verifiedById" TEXT,
  ADD COLUMN IF NOT EXISTS "verificationNote" TEXT,
  ADD COLUMN IF NOT EXISTS "appliedRequirementStatus" "RequirementMatchStatus",
  ADD COLUMN IF NOT EXISTS "verifiedEvidenceId" TEXT,
  ADD COLUMN IF NOT EXISTS "closedLoopHash" TEXT;

CREATE INDEX IF NOT EXISTS "TeamWorkflowTask_companyId_verificationStatus_idx"
  ON "TeamWorkflowTask"("companyId", "verificationStatus");
CREATE INDEX IF NOT EXISTS "TeamWorkflowTask_closedLoopHash_idx"
  ON "TeamWorkflowTask"("closedLoopHash");

DO $$ BEGIN
  ALTER TABLE "TeamWorkflowTask"
    ADD CONSTRAINT "TeamWorkflowTask_responseSubmittedById_fkey"
    FOREIGN KEY ("responseSubmittedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "TeamWorkflowTask"
    ADD CONSTRAINT "TeamWorkflowTask_verifiedById_fkey"
    FOREIGN KEY ("verifiedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE "TenderEvidence"
  ADD COLUMN IF NOT EXISTS "teamTaskId" TEXT;
CREATE INDEX IF NOT EXISTS "TenderEvidence_teamTaskId_idx" ON "TenderEvidence"("teamTaskId");

ALTER TABLE "Alert"
  ADD COLUMN IF NOT EXISTS "targetUserId" TEXT;
CREATE INDEX IF NOT EXISTS "Alert_targetUserId_idx" ON "Alert"("targetUserId");

DO $$ BEGIN
  ALTER TABLE "Alert"
    ADD CONSTRAINT "Alert_targetUserId_fkey"
    FOREIGN KEY ("targetUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS "DecisionMemoryRevision" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "tenderId" TEXT NOT NULL,
    "memoryId" TEXT,
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
    "source" TEXT NOT NULL DEFAULT 'ANALYSIS',
    "triggerTaskId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DecisionMemoryRevision_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "DecisionMemoryRevision_companyId_tenderId_contentHash_key"
  ON "DecisionMemoryRevision"("companyId", "tenderId", "contentHash");
CREATE INDEX IF NOT EXISTS "DecisionMemoryRevision_companyId_tenderId_createdAt_idx"
  ON "DecisionMemoryRevision"("companyId", "tenderId", "createdAt");
CREATE INDEX IF NOT EXISTS "DecisionMemoryRevision_memoryId_idx" ON "DecisionMemoryRevision"("memoryId");
CREATE INDEX IF NOT EXISTS "DecisionMemoryRevision_triggerTaskId_idx" ON "DecisionMemoryRevision"("triggerTaskId");

DO $$ BEGIN
  ALTER TABLE "DecisionMemoryRevision"
    ADD CONSTRAINT "DecisionMemoryRevision_companyId_fkey"
    FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "DecisionMemoryRevision"
    ADD CONSTRAINT "DecisionMemoryRevision_tenderId_fkey"
    FOREIGN KEY ("tenderId") REFERENCES "Tender"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "DecisionMemoryRevision"
    ADD CONSTRAINT "DecisionMemoryRevision_memoryId_fkey"
    FOREIGN KEY ("memoryId") REFERENCES "DecisionMemory"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
