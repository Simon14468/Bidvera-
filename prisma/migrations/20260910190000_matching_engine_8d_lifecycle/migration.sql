-- Feature 8D: Opportunity lifecycle + behavior events + source dedup

-- Lifecycle states
ALTER TYPE "MatchingOpportunityStatus" ADD VALUE IF NOT EXISTS 'PAUSED';
ALTER TYPE "MatchingOpportunityStatus" ADD VALUE IF NOT EXISTS 'EXPIRED';

-- Behavior event types
CREATE TYPE "MatchingBehaviorEventType" AS ENUM (
  'IMPRESSION',
  'VIEW',
  'CLICK',
  'INTEREST',
  'DISMISS'
);

-- Opportunity lifecycle + content hash columns
ALTER TABLE "MatchingOpportunity" ADD COLUMN IF NOT EXISTS "contentHash" TEXT;
ALTER TABLE "MatchingOpportunity" ADD COLUMN IF NOT EXISTS "publishedAt" TIMESTAMP(3);
ALTER TABLE "MatchingOpportunity" ADD COLUMN IF NOT EXISTS "pausedAt" TIMESTAMP(3);
ALTER TABLE "MatchingOpportunity" ADD COLUMN IF NOT EXISTS "expiredAt" TIMESTAMP(3);

CREATE INDEX IF NOT EXISTS "MatchingOpportunity_contentHash_idx" ON "MatchingOpportunity"("contentHash");

-- Dedup: unique (source, externalRef). Postgres allows multiple NULLs in unique columns.
-- Drop non-unique index first if it blocks rename; recreate as unique.
DROP INDEX IF EXISTS "MatchingOpportunity_source_externalRef_idx";
CREATE UNIQUE INDEX "MatchingOpportunity_source_externalRef_key" ON "MatchingOpportunity"("source", "externalRef");

CREATE TABLE "MatchingBehaviorEvent" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "opportunityId" TEXT NOT NULL,
    "recommendationId" TEXT,
    "eventType" "MatchingBehaviorEventType" NOT NULL,
    "recommendationType" "MatchRecommendationType",
    "actorUserId" TEXT,
    "idempotencyKey" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MatchingBehaviorEvent_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "MatchingBehaviorEvent_companyId_idempotencyKey_key" ON "MatchingBehaviorEvent"("companyId", "idempotencyKey");
CREATE INDEX "MatchingBehaviorEvent_companyId_createdAt_idx" ON "MatchingBehaviorEvent"("companyId", "createdAt");
CREATE INDEX "MatchingBehaviorEvent_opportunityId_eventType_createdAt_idx" ON "MatchingBehaviorEvent"("opportunityId", "eventType", "createdAt");
CREATE INDEX "MatchingBehaviorEvent_eventType_createdAt_idx" ON "MatchingBehaviorEvent"("eventType", "createdAt");
CREATE INDEX "MatchingBehaviorEvent_recommendationId_idx" ON "MatchingBehaviorEvent"("recommendationId");

ALTER TABLE "MatchingBehaviorEvent" ADD CONSTRAINT "MatchingBehaviorEvent_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "MatchingBehaviorEvent" ADD CONSTRAINT "MatchingBehaviorEvent_opportunityId_fkey" FOREIGN KEY ("opportunityId") REFERENCES "MatchingOpportunity"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "MatchingBehaviorEvent" ADD CONSTRAINT "MatchingBehaviorEvent_recommendationId_fkey" FOREIGN KEY ("recommendationId") REFERENCES "MatchRecommendation"("id") ON DELETE SET NULL ON UPDATE CASCADE;
