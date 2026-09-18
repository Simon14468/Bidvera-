-- Feature 8B: Matching Engine (isolated corpus + company matching profile)

CREATE TYPE "MatchingOpportunityStatus" AS ENUM ('DRAFT', 'ACTIVE', 'ARCHIVED');
CREATE TYPE "MatchRecommendationType" AS ENUM ('ORGANIC', 'SPONSORED');
CREATE TYPE "MatchRecommendationStatus" AS ENUM ('ACTIVE', 'READ', 'DISMISSED');

CREATE TABLE "CompanyMatchingProfile" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "snapshotJson" JSONB NOT NULL,
    "eligible" BOOLEAN NOT NULL DEFAULT false,
    "completeness" INTEGER NOT NULL DEFAULT 0,
    "contentHash" TEXT NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "trustSummary" JSONB,
    "builtAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CompanyMatchingProfile_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "MatchingOpportunity" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "summary" TEXT,
    "category" TEXT,
    "industry" TEXT,
    "services" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "industries" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "geographies" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "certifications" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "sizeBand" TEXT,
    "experienceHint" TEXT,
    "deadline" TIMESTAMP(3),
    "source" TEXT NOT NULL DEFAULT 'INTERNAL',
    "externalRef" TEXT,
    "status" "MatchingOpportunityStatus" NOT NULL DEFAULT 'DRAFT',
    "sponsored" BOOLEAN NOT NULL DEFAULT false,
    "sponsorshipMeta" JSONB,
    "signalsJson" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MatchingOpportunity_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "MatchRecommendation" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "opportunityId" TEXT NOT NULL,
    "type" "MatchRecommendationType" NOT NULL DEFAULT 'ORGANIC',
    "score" DOUBLE PRECISION NOT NULL,
    "confidence" DOUBLE PRECISION NOT NULL,
    "matchedDimensions" JSONB NOT NULL,
    "reasons" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "explanation" TEXT,
    "status" "MatchRecommendationStatus" NOT NULL DEFAULT 'ACTIVE',
    "rankedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MatchRecommendation_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "CompanyMatchingProfile_companyId_key" ON "CompanyMatchingProfile"("companyId");
CREATE INDEX "CompanyMatchingProfile_eligible_updatedAt_idx" ON "CompanyMatchingProfile"("eligible", "updatedAt");
CREATE INDEX "CompanyMatchingProfile_contentHash_idx" ON "CompanyMatchingProfile"("contentHash");

CREATE INDEX "MatchingOpportunity_status_deadline_idx" ON "MatchingOpportunity"("status", "deadline");
CREATE INDEX "MatchingOpportunity_status_sponsored_idx" ON "MatchingOpportunity"("status", "sponsored");
CREATE INDEX "MatchingOpportunity_source_externalRef_idx" ON "MatchingOpportunity"("source", "externalRef");
CREATE INDEX "MatchingOpportunity_updatedAt_idx" ON "MatchingOpportunity"("updatedAt");

CREATE UNIQUE INDEX "MatchRecommendation_companyId_opportunityId_key" ON "MatchRecommendation"("companyId", "opportunityId");
CREATE INDEX "MatchRecommendation_companyId_status_score_idx" ON "MatchRecommendation"("companyId", "status", "score");
CREATE INDEX "MatchRecommendation_companyId_rankedAt_idx" ON "MatchRecommendation"("companyId", "rankedAt");
CREATE INDEX "MatchRecommendation_opportunityId_idx" ON "MatchRecommendation"("opportunityId");

ALTER TABLE "CompanyMatchingProfile" ADD CONSTRAINT "CompanyMatchingProfile_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "MatchRecommendation" ADD CONSTRAINT "MatchRecommendation_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "MatchRecommendation" ADD CONSTRAINT "MatchRecommendation_opportunityId_fkey" FOREIGN KEY ("opportunityId") REFERENCES "MatchingOpportunity"("id") ON DELETE CASCADE ON UPDATE CASCADE;
