-- Durable one-time Free Workspace first-signup trial marker.
-- Does not rewrite subscriptions or delete duplicate plans.

ALTER TABLE "Company"
ADD COLUMN IF NOT EXISTS "freeWorkspaceTrialConsumedAt" TIMESTAMP(3);
