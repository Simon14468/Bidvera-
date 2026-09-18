-- Smart Alerts: additional alert types + preference toggles
ALTER TYPE "AlertType" ADD VALUE IF NOT EXISTS 'SCORE_CHANGED';
ALTER TYPE "AlertType" ADD VALUE IF NOT EXISTS 'REQUIREMENT_STATUS';
ALTER TYPE "AlertType" ADD VALUE IF NOT EXISTS 'DECISION_MEMORY';
ALTER TYPE "AlertType" ADD VALUE IF NOT EXISTS 'WORKFLOW_EVENT';

ALTER TABLE "CompanyNotificationPrefs"
  ADD COLUMN IF NOT EXISTS "scoreChangeAlerts" BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS "requirementAlerts" BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS "decisionMemoryAlerts" BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS "workflowAlerts" BOOLEAN NOT NULL DEFAULT true;

-- Track outbound email delivery separately from in-app SENT state
ALTER TABLE "Alert"
  ADD COLUMN IF NOT EXISTS "emailSentAt" TIMESTAMP(3);
