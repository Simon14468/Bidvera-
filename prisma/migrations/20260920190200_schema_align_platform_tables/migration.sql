-- Curated additive platform / bootstrap tables required by seed + Super Admin +
-- billing + AI + rate limiting. CREATE IF NOT EXISTS; no DROP.

CREATE TABLE IF NOT EXISTS "SubscriptionEvent" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "subscriptionId" TEXT,
    "eventType" TEXT NOT NULL,
    "fromStatus" TEXT,
    "toStatus" TEXT,
    "fromPlan" TEXT,
    "toPlan" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "SubscriptionEvent_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "LearningContribution" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "tenderId" TEXT NOT NULL,
    "featureKey" TEXT NOT NULL,
    "outcome" "TenderOutcome" NOT NULL,
    "features" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "LearningContribution_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "AggregatedLearningPattern" (
    "id" TEXT NOT NULL,
    "featureKey" TEXT NOT NULL,
    "industryBucket" TEXT NOT NULL,
    "countryBucket" TEXT NOT NULL,
    "sizeBand" TEXT NOT NULL,
    "fitBand" TEXT NOT NULL,
    "readinessBand" TEXT NOT NULL,
    "decisionAtAnalysis" "DecisionType" NOT NULL,
    "mandatoryGapBand" TEXT NOT NULL,
    "valueBand" TEXT NOT NULL,
    "sampleCount" INTEGER NOT NULL DEFAULT 0,
    "wonCount" INTEGER NOT NULL DEFAULT 0,
    "lostCount" INTEGER NOT NULL DEFAULT 0,
    "bidSubmittedCount" INTEGER NOT NULL DEFAULT 0,
    "noBidCount" INTEGER NOT NULL DEFAULT 0,
    "withdrawnCount" INTEGER NOT NULL DEFAULT 0,
    "independentOrgCount" INTEGER NOT NULL DEFAULT 0,
    "decisiveOutcomeCount" INTEGER NOT NULL DEFAULT 0,
    "dataQualityScore" INTEGER NOT NULL DEFAULT 0,
    "consistencyScore" INTEGER NOT NULL DEFAULT 0,
    "maxOrgShareBps" INTEGER NOT NULL DEFAULT 10000,
    "lifecycle" "LearningPatternLifecycle" NOT NULL DEFAULT 'CANDIDATE',
    "validated" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "AggregatedLearningPattern_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "AdminUser" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "role" "AdminRole" NOT NULL DEFAULT 'SUPER_ADMIN',
    "active" BOOLEAN NOT NULL DEFAULT true,
    "lastLoginAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "AdminUser_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "AdminSession" (
    "id" TEXT NOT NULL,
    "adminUserId" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "ipHash" TEXT,
    "userAgentHash" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "revokedAt" TIMESTAMP(3),
    CONSTRAINT "AdminSession_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "AdminAuditLog" (
    "id" TEXT NOT NULL,
    "adminUserId" TEXT,
    "action" TEXT NOT NULL,
    "targetType" TEXT,
    "targetId" TEXT,
    "previousValue" JSONB,
    "newValue" JSONB,
    "ipHash" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AdminAuditLog_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "Feature" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "enabledGlobal" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Feature_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "PlanFeature" (
    "id" TEXT NOT NULL,
    "planId" TEXT NOT NULL,
    "featureId" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    CONSTRAINT "PlanFeature_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "CompanyPlanOverride" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "planId" TEXT,
    "customName" TEXT,
    "monthlyPriceCents" INTEGER,
    "analysesLimit" INTEGER,
    "aiTokensLimit" INTEGER,
    "storageMbLimit" INTEGER,
    "seatsLimit" INTEGER,
    "features" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "expiresAt" TIMESTAMP(3),
    "notes" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "CompanyPlanOverride_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "CompanyFeatureOverride" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "featureId" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "CompanyFeatureOverride_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "AiProvider" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "baseUrl" TEXT,
    "apiKeyEnvVar" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "AiProvider_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "AiModel" (
    "id" TEXT NOT NULL,
    "providerId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "version" TEXT,
    "latestVersion" TEXT,
    "previousVersion" TEXT,
    "displayName" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "maxTokens" INTEGER,
    "temperature" DOUBLE PRECISION,
    "inputCostPer1k" DOUBLE PRECISION,
    "outputCostPer1k" DOUBLE PRECISION,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "AiModel_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "AiModelVersionHistory" (
    "id" TEXT NOT NULL,
    "modelId" TEXT NOT NULL,
    "version" TEXT NOT NULL,
    "note" TEXT,
    "changedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AiModelVersionHistory_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "AiModelAssignment" (
    "id" TEXT NOT NULL,
    "task" "AiTaskType" NOT NULL,
    "modelId" TEXT NOT NULL,
    "fallbackModelId" TEXT,
    "priority" INTEGER NOT NULL DEFAULT 100,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AiModelAssignment_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "AiUsageLog" (
    "id" TEXT NOT NULL,
    "companyId" TEXT,
    "tenderId" TEXT,
    "modelId" TEXT,
    "task" "AiTaskType" NOT NULL,
    "providerKey" TEXT NOT NULL,
    "modelName" TEXT NOT NULL,
    "success" BOOLEAN NOT NULL DEFAULT true,
    "tokensIn" INTEGER NOT NULL DEFAULT 0,
    "tokensOut" INTEGER NOT NULL DEFAULT 0,
    "costCentsEst" INTEGER NOT NULL DEFAULT 0,
    "latencyMs" INTEGER,
    "errorMessage" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AiUsageLog_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "SystemSetting" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "value" JSONB NOT NULL,
    "description" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "SystemSetting_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "BillingInvoice" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "subscriptionId" TEXT,
    "number" TEXT,
    "provider" "BillingProvider" NOT NULL,
    "providerInvoiceId" TEXT,
    "amountCents" INTEGER NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'usd',
    "status" "BillingInvoiceStatus" NOT NULL DEFAULT 'OPEN',
    "hostedInvoiceUrl" TEXT,
    "pdfUrl" TEXT,
    "periodStart" TIMESTAMP(3),
    "periodEnd" TIMESTAMP(3),
    "paidAt" TIMESTAMP(3),
    "rawMeta" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "BillingInvoice_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "BillingPayment" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "subscriptionId" TEXT,
    "invoiceId" TEXT,
    "provider" "BillingProvider" NOT NULL,
    "providerPaymentId" TEXT NOT NULL,
    "amountCents" INTEGER NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'usd',
    "status" "BillingPaymentStatus" NOT NULL DEFAULT 'PENDING',
    "billingInterval" "BillingInterval",
    "planSlug" TEXT,
    "failureCode" TEXT,
    "failureMessage" TEXT,
    "rawMeta" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "BillingPayment_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "WebhookEvent" (
    "id" TEXT NOT NULL,
    "provider" "BillingProvider" NOT NULL,
    "eventId" TEXT NOT NULL,
    "eventType" TEXT NOT NULL,
    "status" "WebhookProcessStatus" NOT NULL DEFAULT 'RECEIVED',
    "payloadHash" TEXT,
    "companyId" TEXT,
    "errorMessage" TEXT,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "processedAt" TIMESTAMP(3),
    "rawPayload" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "WebhookEvent_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "LandingVideo" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL DEFAULT 'en',
    "enabled" BOOLEAN NOT NULL DEFAULT false,
    "title" TEXT NOT NULL DEFAULT 'See Bidvera in Action',
    "description" TEXT,
    "youtubeUrl" TEXT,
    "videoUrl" TEXT,
    "posterUrl" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "LandingVideo_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "Testimonial" (
    "id" TEXT NOT NULL,
    "customerName" TEXT NOT NULL,
    "companyName" TEXT NOT NULL,
    "jobTitle" TEXT,
    "quote" TEXT NOT NULL,
    "rating" INTEGER NOT NULL DEFAULT 5,
    "avatarUrl" TEXT,
    "verified" BOOLEAN NOT NULL DEFAULT false,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Testimonial_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "RateLimitBucket" (
    "key" TEXT NOT NULL,
    "count" INTEGER NOT NULL DEFAULT 0,
    "resetAt" TIMESTAMP(3) NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "RateLimitBucket_pkey" PRIMARY KEY ("key")
);

CREATE INDEX IF NOT EXISTS "SubscriptionEvent_companyId_createdAt_idx" ON "SubscriptionEvent"("companyId", "createdAt");
CREATE INDEX IF NOT EXISTS "SubscriptionEvent_subscriptionId_idx" ON "SubscriptionEvent"("subscriptionId");
CREATE UNIQUE INDEX IF NOT EXISTS "LearningContribution_tenderId_key" ON "LearningContribution"("tenderId");
CREATE INDEX IF NOT EXISTS "LearningContribution_companyId_idx" ON "LearningContribution"("companyId");
CREATE INDEX IF NOT EXISTS "LearningContribution_featureKey_idx" ON "LearningContribution"("featureKey");
CREATE INDEX IF NOT EXISTS "LearningContribution_outcome_idx" ON "LearningContribution"("outcome");
CREATE UNIQUE INDEX IF NOT EXISTS "AggregatedLearningPattern_featureKey_key" ON "AggregatedLearningPattern"("featureKey");
CREATE INDEX IF NOT EXISTS "AggregatedLearningPattern_lifecycle_validated_idx" ON "AggregatedLearningPattern"("lifecycle", "validated");
CREATE INDEX IF NOT EXISTS "AggregatedLearningPattern_validated_sampleCount_idx" ON "AggregatedLearningPattern"("validated", "sampleCount");
CREATE INDEX IF NOT EXISTS "AggregatedLearningPattern_industryBucket_countryBucket_idx" ON "AggregatedLearningPattern"("industryBucket", "countryBucket");
CREATE UNIQUE INDEX IF NOT EXISTS "AdminUser_email_key" ON "AdminUser"("email");
CREATE INDEX IF NOT EXISTS "AdminUser_email_idx" ON "AdminUser"("email");
CREATE INDEX IF NOT EXISTS "AdminUser_active_idx" ON "AdminUser"("active");
CREATE UNIQUE INDEX IF NOT EXISTS "AdminSession_tokenHash_key" ON "AdminSession"("tokenHash");
CREATE INDEX IF NOT EXISTS "AdminSession_adminUserId_idx" ON "AdminSession"("adminUserId");
CREATE INDEX IF NOT EXISTS "AdminSession_expiresAt_idx" ON "AdminSession"("expiresAt");
CREATE INDEX IF NOT EXISTS "AdminAuditLog_adminUserId_createdAt_idx" ON "AdminAuditLog"("adminUserId", "createdAt");
CREATE INDEX IF NOT EXISTS "AdminAuditLog_action_createdAt_idx" ON "AdminAuditLog"("action", "createdAt");
CREATE INDEX IF NOT EXISTS "AdminAuditLog_targetType_targetId_idx" ON "AdminAuditLog"("targetType", "targetId");
CREATE UNIQUE INDEX IF NOT EXISTS "Feature_key_key" ON "Feature"("key");
CREATE INDEX IF NOT EXISTS "Feature_key_idx" ON "Feature"("key");
CREATE INDEX IF NOT EXISTS "PlanFeature_featureId_idx" ON "PlanFeature"("featureId");
CREATE UNIQUE INDEX IF NOT EXISTS "PlanFeature_planId_featureId_key" ON "PlanFeature"("planId", "featureId");
CREATE UNIQUE INDEX IF NOT EXISTS "CompanyPlanOverride_companyId_key" ON "CompanyPlanOverride"("companyId");
CREATE INDEX IF NOT EXISTS "CompanyPlanOverride_active_idx" ON "CompanyPlanOverride"("active");
CREATE INDEX IF NOT EXISTS "CompanyPlanOverride_expiresAt_idx" ON "CompanyPlanOverride"("expiresAt");
CREATE INDEX IF NOT EXISTS "CompanyFeatureOverride_featureId_idx" ON "CompanyFeatureOverride"("featureId");
CREATE UNIQUE INDEX IF NOT EXISTS "CompanyFeatureOverride_companyId_featureId_key" ON "CompanyFeatureOverride"("companyId", "featureId");
CREATE UNIQUE INDEX IF NOT EXISTS "AiProvider_key_key" ON "AiProvider"("key");
CREATE INDEX IF NOT EXISTS "AiProvider_active_idx" ON "AiProvider"("active");
CREATE INDEX IF NOT EXISTS "AiModel_active_idx" ON "AiModel"("active");
CREATE INDEX IF NOT EXISTS "AiModel_isDefault_idx" ON "AiModel"("isDefault");
CREATE UNIQUE INDEX IF NOT EXISTS "AiModel_providerId_name_version_key" ON "AiModel"("providerId", "name", "version");
CREATE INDEX IF NOT EXISTS "AiModelVersionHistory_modelId_createdAt_idx" ON "AiModelVersionHistory"("modelId", "createdAt");
CREATE UNIQUE INDEX IF NOT EXISTS "AiModelAssignment_task_key" ON "AiModelAssignment"("task");
CREATE INDEX IF NOT EXISTS "AiModelAssignment_modelId_idx" ON "AiModelAssignment"("modelId");
CREATE INDEX IF NOT EXISTS "AiModelAssignment_fallbackModelId_idx" ON "AiModelAssignment"("fallbackModelId");
CREATE INDEX IF NOT EXISTS "AiUsageLog_companyId_createdAt_idx" ON "AiUsageLog"("companyId", "createdAt");
CREATE INDEX IF NOT EXISTS "AiUsageLog_modelId_createdAt_idx" ON "AiUsageLog"("modelId", "createdAt");
CREATE INDEX IF NOT EXISTS "AiUsageLog_task_createdAt_idx" ON "AiUsageLog"("task", "createdAt");
CREATE INDEX IF NOT EXISTS "AiUsageLog_success_createdAt_idx" ON "AiUsageLog"("success", "createdAt");
CREATE UNIQUE INDEX IF NOT EXISTS "SystemSetting_key_key" ON "SystemSetting"("key");
CREATE INDEX IF NOT EXISTS "SystemSetting_key_idx" ON "SystemSetting"("key");
CREATE INDEX IF NOT EXISTS "BillingPayment_companyId_createdAt_idx" ON "BillingPayment"("companyId", "createdAt");
CREATE INDEX IF NOT EXISTS "BillingPayment_subscriptionId_idx" ON "BillingPayment"("subscriptionId");
CREATE INDEX IF NOT EXISTS "BillingPayment_status_createdAt_idx" ON "BillingPayment"("status", "createdAt");
CREATE INDEX IF NOT EXISTS "BillingPayment_invoiceId_idx" ON "BillingPayment"("invoiceId");
CREATE UNIQUE INDEX IF NOT EXISTS "BillingPayment_provider_providerPaymentId_key" ON "BillingPayment"("provider", "providerPaymentId");
CREATE INDEX IF NOT EXISTS "BillingInvoice_companyId_createdAt_idx" ON "BillingInvoice"("companyId", "createdAt");
CREATE INDEX IF NOT EXISTS "BillingInvoice_subscriptionId_idx" ON "BillingInvoice"("subscriptionId");
CREATE INDEX IF NOT EXISTS "BillingInvoice_status_createdAt_idx" ON "BillingInvoice"("status", "createdAt");
CREATE UNIQUE INDEX IF NOT EXISTS "BillingInvoice_provider_providerInvoiceId_key" ON "BillingInvoice"("provider", "providerInvoiceId");
CREATE INDEX IF NOT EXISTS "WebhookEvent_status_createdAt_idx" ON "WebhookEvent"("status", "createdAt");
CREATE INDEX IF NOT EXISTS "WebhookEvent_eventType_createdAt_idx" ON "WebhookEvent"("eventType", "createdAt");
CREATE INDEX IF NOT EXISTS "WebhookEvent_companyId_idx" ON "WebhookEvent"("companyId");
CREATE UNIQUE INDEX IF NOT EXISTS "WebhookEvent_provider_eventId_key" ON "WebhookEvent"("provider", "eventId");
CREATE UNIQUE INDEX IF NOT EXISTS "LandingVideo_key_key" ON "LandingVideo"("key");
CREATE INDEX IF NOT EXISTS "Testimonial_enabled_sortOrder_idx" ON "Testimonial"("enabled", "sortOrder");
CREATE INDEX IF NOT EXISTS "RateLimitBucket_resetAt_idx" ON "RateLimitBucket"("resetAt");

DO $$ BEGIN ALTER TABLE "SubscriptionEvent" ADD CONSTRAINT "SubscriptionEvent_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "SubscriptionEvent" ADD CONSTRAINT "SubscriptionEvent_subscriptionId_fkey" FOREIGN KEY ("subscriptionId") REFERENCES "Subscription"("id") ON DELETE SET NULL ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "LearningContribution" ADD CONSTRAINT "LearningContribution_tenderId_fkey" FOREIGN KEY ("tenderId") REFERENCES "Tender"("id") ON DELETE CASCADE ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "AdminSession" ADD CONSTRAINT "AdminSession_adminUserId_fkey" FOREIGN KEY ("adminUserId") REFERENCES "AdminUser"("id") ON DELETE CASCADE ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "AdminAuditLog" ADD CONSTRAINT "AdminAuditLog_adminUserId_fkey" FOREIGN KEY ("adminUserId") REFERENCES "AdminUser"("id") ON DELETE SET NULL ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "PlanFeature" ADD CONSTRAINT "PlanFeature_planId_fkey" FOREIGN KEY ("planId") REFERENCES "Plan"("id") ON DELETE CASCADE ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "PlanFeature" ADD CONSTRAINT "PlanFeature_featureId_fkey" FOREIGN KEY ("featureId") REFERENCES "Feature"("id") ON DELETE CASCADE ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "CompanyPlanOverride" ADD CONSTRAINT "CompanyPlanOverride_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "CompanyPlanOverride" ADD CONSTRAINT "CompanyPlanOverride_planId_fkey" FOREIGN KEY ("planId") REFERENCES "Plan"("id") ON DELETE SET NULL ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "CompanyFeatureOverride" ADD CONSTRAINT "CompanyFeatureOverride_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "CompanyFeatureOverride" ADD CONSTRAINT "CompanyFeatureOverride_featureId_fkey" FOREIGN KEY ("featureId") REFERENCES "Feature"("id") ON DELETE CASCADE ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "AiModel" ADD CONSTRAINT "AiModel_providerId_fkey" FOREIGN KEY ("providerId") REFERENCES "AiProvider"("id") ON DELETE CASCADE ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "AiModelVersionHistory" ADD CONSTRAINT "AiModelVersionHistory_modelId_fkey" FOREIGN KEY ("modelId") REFERENCES "AiModel"("id") ON DELETE CASCADE ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "AiModelAssignment" ADD CONSTRAINT "AiModelAssignment_modelId_fkey" FOREIGN KEY ("modelId") REFERENCES "AiModel"("id") ON DELETE CASCADE ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "AiModelAssignment" ADD CONSTRAINT "AiModelAssignment_fallbackModelId_fkey" FOREIGN KEY ("fallbackModelId") REFERENCES "AiModel"("id") ON DELETE SET NULL ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "AiUsageLog" ADD CONSTRAINT "AiUsageLog_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE SET NULL ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "AiUsageLog" ADD CONSTRAINT "AiUsageLog_modelId_fkey" FOREIGN KEY ("modelId") REFERENCES "AiModel"("id") ON DELETE SET NULL ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "BillingPayment" ADD CONSTRAINT "BillingPayment_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "BillingPayment" ADD CONSTRAINT "BillingPayment_subscriptionId_fkey" FOREIGN KEY ("subscriptionId") REFERENCES "Subscription"("id") ON DELETE SET NULL ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "BillingPayment" ADD CONSTRAINT "BillingPayment_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "BillingInvoice"("id") ON DELETE SET NULL ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "BillingInvoice" ADD CONSTRAINT "BillingInvoice_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "BillingInvoice" ADD CONSTRAINT "BillingInvoice_subscriptionId_fkey" FOREIGN KEY ("subscriptionId") REFERENCES "Subscription"("id") ON DELETE SET NULL ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
