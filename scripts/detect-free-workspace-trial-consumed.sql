-- Read-only detection for historical Free Workspace first-signup trials.
-- Do NOT run as a backfill. Review counts before any production UPDATE.

-- Workspaces already stamped with the durable marker.
SELECT COUNT(*) AS consumed_by_marker
FROM "Company"
WHERE "freeWorkspaceTrialConsumedAt" IS NOT NULL;

-- Successful first-signup trial rows (TRIALING or EXPIRED + TRIAL).
SELECT COUNT(DISTINCT s."companyId") AS consumed_by_successful_trial_row
FROM "Subscription" s
WHERE s.plan = 'TRIAL'
  AND s.status IN ('TRIALING', 'EXPIRED');

-- Historical rows that would be classified as consumed but have no marker yet.
SELECT COUNT(DISTINCT s."companyId") AS would_backfill_marker
FROM "Subscription" s
JOIN "Company" c ON c.id = s."companyId"
WHERE s.plan = 'TRIAL'
  AND s.status IN ('TRIALING', 'EXPIRED')
  AND c."freeWorkspaceTrialConsumedAt" IS NULL;

-- Extra plans that claim a Free Workspace identity besides slug=free + isFree.
SELECT COUNT(*) AS extra_free_workspace_identities
FROM "Plan"
WHERE ("isFree" = true OR slug = 'free')
  AND NOT (slug = 'free' AND "isFree" = true);

-- Designated system plan present?
SELECT COUNT(*) AS designated_free_workspace_plans
FROM "Plan"
WHERE slug = 'free' AND "isFree" = true;
