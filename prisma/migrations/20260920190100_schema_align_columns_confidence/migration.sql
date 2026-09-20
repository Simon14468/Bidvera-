-- Safe column / type alignment after enum values are committed.
-- Additive + typed conversion only. Confidence converts INTEGER -> ConfidenceLevel
-- using scoreToConfidence thresholds (>=75 HIGH, >=45 MEDIUM, else LOW).

-- ── AnalysisStatus value remapping (preserves EXTRACTING/COMPLETED/FAILED) ───
UPDATE "Tender"
SET "analysisStatus" = 'UPLOADING'::"AnalysisStatus"
WHERE "analysisStatus"::text = 'PENDING_UPLOAD';

UPDATE "Tender"
SET "analysisStatus" = 'PROCESSING'::"AnalysisStatus"
WHERE "analysisStatus"::text = 'QUEUED';

UPDATE "Tender"
SET "analysisStatus" = 'ANALYZING'::"AnalysisStatus"
WHERE "analysisStatus"::text IN (
  'STRUCTURING',
  'MATCHING',
  'RULES',
  'AI_REASONING',
  'VERIFYING'
);

ALTER TABLE "Tender"
  ALTER COLUMN "analysisStatus" SET DEFAULT 'UPLOADING'::"AnalysisStatus";

-- ── TenderDecision.confidence: INTEGER -> ConfidenceLevel (data-preserving) ──
-- Uses scoreToConfidence thresholds. Skips if already ConfidenceLevel.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'TenderDecision'
      AND column_name = 'confidence'
      AND udt_name = 'int4'
  ) THEN
    EXECUTE 'ALTER TABLE "TenderDecision" ALTER COLUMN "confidence" DROP DEFAULT';
    EXECUTE $sql$
      ALTER TABLE "TenderDecision"
        ALTER COLUMN "confidence" TYPE "ConfidenceLevel"
        USING (
          CASE
            WHEN "confidence" >= 75 THEN 'HIGH'::"ConfidenceLevel"
            WHEN "confidence" >= 45 THEN 'MEDIUM'::"ConfidenceLevel"
            ELSE 'LOW'::"ConfidenceLevel"
          END
        )
    $sql$;
    EXECUTE 'ALTER TABLE "TenderDecision" ALTER COLUMN "confidence" SET DEFAULT ''MEDIUM''::"ConfidenceLevel"';
  ELSIF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'TenderDecision'
      AND column_name = 'confidence'
      AND udt_name = 'ConfidenceLevel'
  ) THEN
    EXECUTE 'ALTER TABLE "TenderDecision" ALTER COLUMN "confidence" SET DEFAULT ''MEDIUM''::"ConfidenceLevel"';
  END IF;
END $$;

-- ── Additive columns / nullability relaxations ───────────────────────────────
ALTER TABLE "Company"
  ADD COLUMN IF NOT EXISTS "companySize" TEXT,
  ADD COLUMN IF NOT EXISTS "country" TEXT,
  ADD COLUMN IF NOT EXISTS "globalLearningConsent" BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS "status" "CompanyStatus" NOT NULL DEFAULT 'ACTIVE',
  ADD COLUMN IF NOT EXISTS "suspendReason" TEXT,
  ADD COLUMN IF NOT EXISTS "suspendedAt" TIMESTAMP(3);

ALTER TABLE "CompanyProfile"
  ADD COLUMN IF NOT EXISTS "companySize" TEXT,
  ADD COLUMN IF NOT EXISTS "country" TEXT,
  ADD COLUMN IF NOT EXISTS "experienceLevel" TEXT;

ALTER TABLE "Job"
  ALTER COLUMN "companyId" DROP NOT NULL;

ALTER TABLE "Subscription"
  ADD COLUMN IF NOT EXISTS "billingInterval" "BillingInterval",
  ADD COLUMN IF NOT EXISTS "canceledAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "paymentMethodBrand" TEXT,
  ADD COLUMN IF NOT EXISTS "paymentMethodLast4" TEXT,
  ADD COLUMN IF NOT EXISTS "planId" TEXT;

ALTER TABLE "Subscription"
  ALTER COLUMN "provider" SET DEFAULT 'paypal';

ALTER TABLE "Tender"
  ADD COLUMN IF NOT EXISTS "learningFeatureKey" TEXT,
  ADD COLUMN IF NOT EXISTS "outcome" "TenderOutcome",
  ADD COLUMN IF NOT EXISTS "outcomeRecordedAt" TIMESTAMP(3);

ALTER TABLE "TenderDecision"
  ADD COLUMN IF NOT EXISTS "aiModel" TEXT,
  ADD COLUMN IF NOT EXISTS "aiProvider" TEXT,
  ADD COLUMN IF NOT EXISTS "aiTask" TEXT,
  ADD COLUMN IF NOT EXISTS "costCentsEst" INTEGER,
  ADD COLUMN IF NOT EXISTS "fitBreakdown" JSONB,
  ADD COLUMN IF NOT EXISTS "intelligenceBreakdown" JSONB,
  ADD COLUMN IF NOT EXISTS "readinessBreakdown" JSONB,
  ADD COLUMN IF NOT EXISTS "tokensIn" INTEGER,
  ADD COLUMN IF NOT EXISTS "tokensOut" INTEGER;

ALTER TABLE "User"
  ADD COLUMN IF NOT EXISTS "acceptedTermsAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "onboardingStep" "OnboardingStep" NOT NULL DEFAULT 'VERIFY_EMAIL';

ALTER TABLE "User"
  ALTER COLUMN "companyId" DROP NOT NULL;

CREATE INDEX IF NOT EXISTS "Company_status_idx" ON "Company"("status");
CREATE INDEX IF NOT EXISTS "Company_createdAt_idx" ON "Company"("createdAt");
CREATE INDEX IF NOT EXISTS "Subscription_planId_idx" ON "Subscription"("planId");
CREATE INDEX IF NOT EXISTS "Subscription_provider_status_idx" ON "Subscription"("provider", "status");
CREATE INDEX IF NOT EXISTS "Tender_learningFeatureKey_idx" ON "Tender"("learningFeatureKey");
CREATE INDEX IF NOT EXISTS "Tender_outcome_idx" ON "Tender"("outcome");
CREATE INDEX IF NOT EXISTS "User_onboardingStep_idx" ON "User"("onboardingStep");

DO $$ BEGIN
  ALTER TABLE "Subscription"
    ADD CONSTRAINT "Subscription_planId_fkey"
    FOREIGN KEY ("planId") REFERENCES "Plan"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
