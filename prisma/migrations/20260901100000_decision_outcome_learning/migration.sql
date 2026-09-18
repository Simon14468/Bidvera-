-- Decision Outcome Learning: authoritative outcomes linked to TenderDecision + audit trail

DO $$ BEGIN
  CREATE TYPE "TenderOutcome" AS ENUM (
    'WON',
    'LOST',
    'WITHDRAWN',
    'BID_SUBMITTED',
    'NO_BID_CONFIRMED'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

ALTER TYPE "TenderOutcome" ADD VALUE IF NOT EXISTS 'CANCELLED';
ALTER TYPE "TenderOutcome" ADD VALUE IF NOT EXISTS 'NOT_SUBMITTED';
ALTER TYPE "TenderOutcome" ADD VALUE IF NOT EXISTS 'PENDING';

ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'DECISION_OUTCOME_RECORDED';
ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'DECISION_OUTCOME_UPDATED';

CREATE TABLE IF NOT EXISTS "TenderDecisionOutcome" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "tenderId" TEXT NOT NULL,
    "tenderDecisionId" TEXT NOT NULL,
    "outcome" "TenderOutcome" NOT NULL,
    "outcomeDate" TIMESTAMP(3),
    "reasonCode" TEXT,
    "reasonDetail" TEXT,
    "evidence" JSONB,
    "humanFinalDecision" "DecisionType",
    "recordedById" TEXT,
    "idempotencyKey" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TenderDecisionOutcome_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "TenderDecisionOutcomeAudit" (
    "id" TEXT NOT NULL,
    "outcomeId" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "userId" TEXT,
    "action" TEXT NOT NULL,
    "snapshot" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TenderDecisionOutcomeAudit_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "TenderDecisionOutcome_tenderId_key" ON "TenderDecisionOutcome"("tenderId");
CREATE UNIQUE INDEX IF NOT EXISTS "TenderDecisionOutcome_tenderDecisionId_key" ON "TenderDecisionOutcome"("tenderDecisionId");
CREATE UNIQUE INDEX IF NOT EXISTS "TenderDecisionOutcome_companyId_idempotencyKey_key" ON "TenderDecisionOutcome"("companyId", "idempotencyKey");
CREATE INDEX IF NOT EXISTS "TenderDecisionOutcome_companyId_outcome_idx" ON "TenderDecisionOutcome"("companyId", "outcome");
CREATE INDEX IF NOT EXISTS "TenderDecisionOutcome_companyId_createdAt_idx" ON "TenderDecisionOutcome"("companyId", "createdAt");

CREATE INDEX IF NOT EXISTS "TenderDecisionOutcomeAudit_outcomeId_idx" ON "TenderDecisionOutcomeAudit"("outcomeId");
CREATE INDEX IF NOT EXISTS "TenderDecisionOutcomeAudit_companyId_createdAt_idx" ON "TenderDecisionOutcomeAudit"("companyId", "createdAt");

DO $$ BEGIN
  ALTER TABLE "TenderDecisionOutcome" ADD CONSTRAINT "TenderDecisionOutcome_companyId_fkey"
    FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "TenderDecisionOutcome" ADD CONSTRAINT "TenderDecisionOutcome_tenderId_fkey"
    FOREIGN KEY ("tenderId") REFERENCES "Tender"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "TenderDecisionOutcome" ADD CONSTRAINT "TenderDecisionOutcome_tenderDecisionId_fkey"
    FOREIGN KEY ("tenderDecisionId") REFERENCES "TenderDecision"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "TenderDecisionOutcomeAudit" ADD CONSTRAINT "TenderDecisionOutcomeAudit_outcomeId_fkey"
    FOREIGN KEY ("outcomeId") REFERENCES "TenderDecisionOutcome"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
