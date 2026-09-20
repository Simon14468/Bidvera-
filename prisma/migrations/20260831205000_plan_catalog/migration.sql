-- Plan catalog prerequisite for 20260831210000_plan_translations (and later Plan ALTERs).
-- Idempotent for databases that already received Plan / PlanStatus via db push.
-- Does NOT add columns owned by later migrations:
--   translations, analysesLimitYearly, seatsLimitYearly, preferEntitlementLabels, graceDays

DO $$ BEGIN
  CREATE TYPE "PlanStatus" AS ENUM ('ACTIVE', 'INACTIVE', 'ARCHIVED');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS "Plan" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "monthlyPriceCents" INTEGER NOT NULL DEFAULT 0,
    "annualPriceCents" INTEGER,
    "annualMonths" INTEGER NOT NULL DEFAULT 12,
    "monthlyEnabled" BOOLEAN NOT NULL DEFAULT true,
    "annualEnabled" BOOLEAN NOT NULL DEFAULT true,
    "currency" TEXT NOT NULL DEFAULT 'usd',
    "analysesLimit" INTEGER NOT NULL DEFAULT 3,
    "aiTokensLimit" INTEGER,
    "storageMbLimit" INTEGER,
    "seatsLimit" INTEGER NOT NULL DEFAULT 1,
    "trialEligible" BOOLEAN NOT NULL DEFAULT false,
    "trialDays" INTEGER,
    "isFree" BOOLEAN NOT NULL DEFAULT false,
    "visibleToPublic" BOOLEAN NOT NULL DEFAULT true,
    "status" "PlanStatus" NOT NULL DEFAULT 'ACTIVE',
    "legacyEnum" "SubscriptionPlan",
    "paypalPlanIdEnv" TEXT,
    "stripePriceEnv" TEXT,
    "stripeEnabled" BOOLEAN NOT NULL DEFAULT true,
    "paypalEnabled" BOOLEAN NOT NULL DEFAULT true,
    "stripePriceMonthly" TEXT,
    "stripePriceAnnual" TEXT,
    "paypalPlanMonthly" TEXT,
    "paypalPlanAnnual" TEXT,
    "highlighted" BOOLEAN NOT NULL DEFAULT false,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "featureList" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Plan_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "Plan_slug_key" ON "Plan"("slug");
CREATE INDEX IF NOT EXISTS "Plan_status_idx" ON "Plan"("status");
CREATE INDEX IF NOT EXISTS "Plan_slug_idx" ON "Plan"("slug");
CREATE INDEX IF NOT EXISTS "Plan_visibleToPublic_status_idx" ON "Plan"("visibleToPublic", "status");
