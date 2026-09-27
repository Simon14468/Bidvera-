-- In-flight checkout intent. Does not rewrite subscriptions.

ALTER TABLE "Company"
ADD COLUMN IF NOT EXISTS "pendingCheckout" JSONB;
