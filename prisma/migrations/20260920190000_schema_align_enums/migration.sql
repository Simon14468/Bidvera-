-- Safe additive enum alignment (expand only; do not rebuild enums).
-- Split from value-using migrations so PostgreSQL can COMMIT ADD VALUE first.

-- ── New enums required by schema / platform tables ───────────────────────────
DO $$ BEGIN CREATE TYPE "LearningPatternLifecycle" AS ENUM ('CANDIDATE', 'VALIDATING', 'VERIFIED', 'ACTIVE', 'MONITORED', 'RETIRED'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE "OnboardingStep" AS ENUM ('VERIFY_EMAIL', 'COMPANY', 'PLAN', 'DONE'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE "CompanyStatus" AS ENUM ('ACTIVE', 'SUSPENDED'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE "FeatureScope" AS ENUM ('GLOBAL', 'PLAN', 'COMPANY'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE "AiTaskType" AS ENUM ('PDF_EXTRACTION', 'REQUIREMENT_EXTRACTION', 'CLASSIFICATION', 'COMPANY_MATCHING', 'RISK_ANALYSIS', 'FINAL_REASONING'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE "BillingProvider" AS ENUM ('STRIPE', 'PAYPAL', 'MANUAL'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE "BillingInterval" AS ENUM ('MONTH', 'YEAR'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE "BillingPaymentStatus" AS ENUM ('PENDING', 'SUCCEEDED', 'FAILED', 'REFUNDED', 'PARTIALLY_REFUNDED'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE "BillingInvoiceStatus" AS ENUM ('DRAFT', 'OPEN', 'PAID', 'VOID', 'UNCOLLECTIBLE'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE "WebhookProcessStatus" AS ENUM ('RECEIVED', 'PROCESSING', 'PROCESSED', 'FAILED', 'IGNORED'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE "AdminRole" AS ENUM ('SUPER_ADMIN', 'OPS', 'READ_ONLY'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ── AnalysisStatus: add schema labels; keep legacy labels (additive) ──────────
-- Mapping (applied in next migration):
--   PENDING_UPLOAD -> UPLOADING
--   QUEUED         -> PROCESSING
--   STRUCTURING|MATCHING|RULES|AI_REASONING|VERIFYING -> ANALYZING
--   EXTRACTING|COMPLETED|FAILED unchanged
DO $$ BEGIN ALTER TYPE "AnalysisStatus" ADD VALUE 'UPLOADING'; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TYPE "AnalysisStatus" ADD VALUE 'PROCESSING'; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TYPE "AnalysisStatus" ADD VALUE 'ANALYZING'; EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ── Expand existing enums (additive only) ────────────────────────────────────
DO $$ BEGIN ALTER TYPE "AuditAction" ADD VALUE 'PAYMENT_FAILURE'; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TYPE "AuditAction" ADD VALUE 'EMAIL_VERIFIED'; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TYPE "AuditAction" ADD VALUE 'EMAIL_VERIFICATION_SENT'; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TYPE "AuditAction" ADD VALUE 'PASSWORD_RESET_REQUESTED'; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TYPE "AuditAction" ADD VALUE 'PASSWORD_RESET_COMPLETED'; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TYPE "AuditAction" ADD VALUE 'ONBOARDING_COMPANY'; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TYPE "AuditAction" ADD VALUE 'ONBOARDING_PLAN'; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TYPE "AuditAction" ADD VALUE 'TENDER_OUTCOME_RECORDED'; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TYPE "AuditAction" ADD VALUE 'LEARNING_CONTRIBUTED'; EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN ALTER TYPE "JobType" ADD VALUE 'PROCESS_BILLING_WEBHOOK'; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TYPE "JobType" ADD VALUE 'SEND_EMAIL'; EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN ALTER TYPE "SubscriptionStatus" ADD VALUE 'EXPIRED'; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TYPE "SubscriptionStatus" ADD VALUE 'PAYMENT_FAILED'; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
