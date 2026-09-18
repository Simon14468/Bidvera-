-- Feature 8F: Matching sponsorship foundation

CREATE TYPE "MatchingSponsorshipStatus" AS ENUM (
  'DRAFT',
  'ACTIVE',
  'PAUSED',
  'ENDED',
  'EXPIRED'
);

CREATE TABLE IF NOT EXISTS "MatchingSponsorship" (
    "id" TEXT NOT NULL,
    "opportunityId" TEXT NOT NULL,
    "sponsorCompanyId" TEXT NOT NULL,
    "status" "MatchingSponsorshipStatus" NOT NULL DEFAULT 'DRAFT',
    "startsAt" TIMESTAMP(3),
    "endsAt" TIMESTAMP(3),
    "campaignMeta" JSONB,
    "billingRef" TEXT,
    "billingStatus" TEXT,
    "activatedAt" TIMESTAMP(3),
    "pausedAt" TIMESTAMP(3),
    "endedAt" TIMESTAMP(3),
    "createdByAdminId" TEXT,
    "updatedByAdminId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MatchingSponsorship_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "MatchingSponsorship_sponsorCompanyId_status_idx"
  ON "MatchingSponsorship"("sponsorCompanyId", "status");
CREATE INDEX IF NOT EXISTS "MatchingSponsorship_opportunityId_status_idx"
  ON "MatchingSponsorship"("opportunityId", "status");
CREATE INDEX IF NOT EXISTS "MatchingSponsorship_status_endsAt_idx"
  ON "MatchingSponsorship"("status", "endsAt");
CREATE INDEX IF NOT EXISTS "MatchingSponsorship_billingRef_idx"
  ON "MatchingSponsorship"("billingRef");

ALTER TABLE "MatchingSponsorship"
  DROP CONSTRAINT IF EXISTS "MatchingSponsorship_opportunityId_fkey";
ALTER TABLE "MatchingSponsorship"
  ADD CONSTRAINT "MatchingSponsorship_opportunityId_fkey"
  FOREIGN KEY ("opportunityId") REFERENCES "MatchingOpportunity"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "MatchingSponsorship"
  DROP CONSTRAINT IF EXISTS "MatchingSponsorship_sponsorCompanyId_fkey";
ALTER TABLE "MatchingSponsorship"
  ADD CONSTRAINT "MatchingSponsorship_sponsorCompanyId_fkey"
  FOREIGN KEY ("sponsorCompanyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;
