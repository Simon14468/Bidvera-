-- Separate PayPal Sandbox Plan IDs from the existing Live columns.
-- Existing paypalPlanMonthly / paypalPlanAnnual values are left untouched.
ALTER TABLE "Plan" ADD COLUMN "paypalSandboxPlanMonthly" TEXT;
ALTER TABLE "Plan" ADD COLUMN "paypalSandboxPlanAnnual" TEXT;
