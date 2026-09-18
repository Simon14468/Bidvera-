-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('OWNER', 'ADMIN', 'MEMBER', 'VIEWER');

-- CreateEnum
CREATE TYPE "DecisionType" AS ENUM ('BID', 'REVIEW', 'NO_BID');

-- CreateEnum
CREATE TYPE "RiskSeverity" AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL');

-- CreateEnum
CREATE TYPE "RequirementMatchStatus" AS ENUM ('MATCHED', 'FAILED', 'UNCERTAIN', 'MISSING');

-- CreateEnum
CREATE TYPE "TenderStatus" AS ENUM ('DRAFT', 'ACTIVE', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "AnalysisStatus" AS ENUM ('PENDING_UPLOAD', 'QUEUED', 'EXTRACTING', 'STRUCTURING', 'MATCHING', 'RULES', 'AI_REASONING', 'VERIFYING', 'COMPLETED', 'FAILED');

-- CreateEnum
CREATE TYPE "DocumentProcessingStatus" AS ENUM ('PENDING', 'STORED', 'QUEUED', 'PROCESSING', 'COMPLETED', 'FAILED');

-- CreateEnum
CREATE TYPE "EvidenceVerificationStatus" AS ENUM ('VERIFIED', 'INFERRED', 'UNKNOWN');

-- CreateEnum
CREATE TYPE "MissingDocumentStatus" AS ENUM ('OPEN', 'RESOLVED', 'IGNORED');

-- CreateEnum
CREATE TYPE "RiskStatus" AS ENUM ('OPEN', 'MITIGATED', 'ACCEPTED');

-- CreateEnum
CREATE TYPE "AlertType" AS ENUM ('DEADLINE_APPROACHING', 'MISSING_DOCUMENT', 'HIGH_RISK', 'DECISION_GENERATED', 'TRIAL_LIMIT', 'SYSTEM');

-- CreateEnum
CREATE TYPE "AlertStatus" AS ENUM ('SCHEDULED', 'SENT', 'READ', 'DISMISSED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "SubscriptionPlan" AS ENUM ('TRIAL', 'STARTER', 'PRO', 'BUSINESS');

-- CreateEnum
CREATE TYPE "SubscriptionStatus" AS ENUM ('TRIALING', 'ACTIVE', 'PAST_DUE', 'CANCELED', 'INCOMPLETE', 'UNPAID');

-- CreateEnum
CREATE TYPE "UsageAction" AS ENUM ('TENDER_ANALYSIS', 'DOCUMENT_UPLOAD', 'AI_EXTRACTION', 'AI_REASONING', 'CHECKOUT_STARTED', 'UPGRADE_VIEWED');

-- CreateEnum
CREATE TYPE "JobStatus" AS ENUM ('PENDING', 'RUNNING', 'COMPLETED', 'FAILED', 'DEAD');

-- CreateEnum
CREATE TYPE "JobType" AS ENUM ('PROCESS_TENDER_DOCUMENT', 'RUN_TENDER_ANALYSIS', 'SEND_ALERT', 'SCHEDULE_DEADLINE_ALERTS');

-- CreateEnum
CREATE TYPE "AuditAction" AS ENUM ('SIGNUP', 'COMPANY_CREATED', 'PROFILE_UPDATED', 'TENDER_UPLOADED', 'ANALYSIS_STARTED', 'ANALYSIS_COMPLETED', 'FIRST_DECISION', 'DECISION_GENERATED', 'TRIAL_USAGE', 'UPGRADE_VIEWED', 'CHECKOUT_STARTED', 'SUBSCRIPTION_CREATED', 'SUBSCRIPTION_CANCELED', 'LOGIN', 'LOGOUT');

-- CreateEnum
CREATE TYPE "TrialRiskVerdict" AS ENUM ('ALLOW', 'STEP_UP', 'REVIEW', 'BLOCK');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "emailVerified" BOOLEAN NOT NULL DEFAULT false,
    "passwordHash" TEXT NOT NULL,
    "role" "UserRole" NOT NULL DEFAULT 'OWNER',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Session" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "ipHash" TEXT,
    "userAgentHash" TEXT,
    "deviceFingerprint" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Session_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Company" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "domain" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Company_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CompanyProfile" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "industry" TEXT,
    "services" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "certifications" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "experienceYears" INTEGER,
    "revenueRange" TEXT,
    "employeeRange" TEXT,
    "geographicCoverage" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "contractSizeMin" INTEGER,
    "contractSizeMax" INTEGER,
    "customQualificationRules" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "completeness" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CompanyProfile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CompanyUsage" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "analysesUsed" INTEGER NOT NULL DEFAULT 0,
    "analysesLimit" INTEGER NOT NULL DEFAULT 3,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CompanyUsage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Tender" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "client" TEXT,
    "country" TEXT,
    "region" TEXT,
    "industry" TEXT,
    "deadline" TIMESTAMP(3),
    "deadlineTimezone" TEXT,
    "estimatedValue" INTEGER,
    "guarantee" TEXT,
    "status" "TenderStatus" NOT NULL DEFAULT 'DRAFT',
    "analysisStatus" "AnalysisStatus" NOT NULL DEFAULT 'PENDING_UPLOAD',
    "analysisError" TEXT,
    "idempotencyKey" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "analyzedAt" TIMESTAMP(3),

    CONSTRAINT "Tender_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TenderDocument" (
    "id" TEXT NOT NULL,
    "tenderId" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "storageKey" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "fileSize" INTEGER NOT NULL,
    "checksumSha256" TEXT,
    "processingStatus" "DocumentProcessingStatus" NOT NULL DEFAULT 'PENDING',
    "extractedText" TEXT,
    "pageCount" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TenderDocument_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TenderRequirement" (
    "id" TEXT NOT NULL,
    "tenderId" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "mandatory" BOOLEAN NOT NULL DEFAULT true,
    "value" TEXT,
    "status" "RequirementMatchStatus" NOT NULL DEFAULT 'UNCERTAIN',
    "sourcePage" INTEGER,
    "sourceSection" TEXT,
    "evidence" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TenderRequirement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TenderRisk" (
    "id" TEXT NOT NULL,
    "tenderId" TEXT NOT NULL,
    "severity" "RiskSeverity" NOT NULL,
    "category" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "sourcePage" INTEGER,
    "status" "RiskStatus" NOT NULL DEFAULT 'OPEN',
    "mitigation" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TenderRisk_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TenderEvidence" (
    "id" TEXT NOT NULL,
    "tenderId" TEXT NOT NULL,
    "requirementId" TEXT,
    "sourcePage" INTEGER,
    "sourceSection" TEXT,
    "evidenceText" TEXT NOT NULL,
    "verificationStatus" "EvidenceVerificationStatus" NOT NULL DEFAULT 'UNKNOWN',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TenderEvidence_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TenderDecision" (
    "id" TEXT NOT NULL,
    "tenderId" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "decision" "DecisionType" NOT NULL,
    "fitScore" INTEGER NOT NULL,
    "confidence" INTEGER NOT NULL,
    "reasoning" TEXT NOT NULL,
    "decidedById" TEXT,
    "isAiSuggested" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TenderDecision_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MissingDocument" (
    "id" TEXT NOT NULL,
    "tenderId" TEXT NOT NULL,
    "documentName" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "severity" "RiskSeverity" NOT NULL DEFAULT 'MEDIUM',
    "status" "MissingDocumentStatus" NOT NULL DEFAULT 'OPEN',
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MissingDocument_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "NextAction" (
    "id" TEXT NOT NULL,
    "tenderId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "priority" INTEGER NOT NULL DEFAULT 0,
    "completed" BOOLEAN NOT NULL DEFAULT false,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "NextAction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Alert" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "tenderId" TEXT,
    "type" "AlertType" NOT NULL,
    "title" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "href" TEXT,
    "scheduledFor" TIMESTAMP(3),
    "status" "AlertStatus" NOT NULL DEFAULT 'SCHEDULED',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "sentAt" TIMESTAMP(3),
    "readAt" TIMESTAMP(3),

    CONSTRAINT "Alert_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UsageRecord" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "action" "UsageAction" NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UsageRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Subscription" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "provider" TEXT NOT NULL DEFAULT 'stripe',
    "providerCustomerId" TEXT,
    "providerSubscriptionId" TEXT,
    "plan" "SubscriptionPlan" NOT NULL DEFAULT 'TRIAL',
    "status" "SubscriptionStatus" NOT NULL DEFAULT 'TRIALING',
    "currentPeriodStart" TIMESTAMP(3),
    "currentPeriodEnd" TIMESTAMP(3),
    "cancelAtPeriodEnd" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Subscription_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Job" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "tenderId" TEXT,
    "type" "JobType" NOT NULL,
    "status" "JobStatus" NOT NULL DEFAULT 'PENDING',
    "payload" JSONB NOT NULL,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "maxAttempts" INTEGER NOT NULL DEFAULT 5,
    "availableAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lockedAt" TIMESTAMP(3),
    "lockedBy" TEXT,
    "lastError" TEXT,
    "idempotencyKey" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "completedAt" TIMESTAMP(3),

    CONSTRAINT "Job_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL,
    "companyId" TEXT,
    "userId" TEXT,
    "action" "AuditAction" NOT NULL,
    "metadata" JSONB,
    "ipHash" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TrialRiskSignal" (
    "id" TEXT NOT NULL,
    "companyId" TEXT,
    "emailHash" TEXT,
    "domain" TEXT,
    "ipHash" TEXT,
    "deviceHash" TEXT,
    "score" INTEGER NOT NULL DEFAULT 0,
    "verdict" "TrialRiskVerdict" NOT NULL DEFAULT 'ALLOW',
    "signals" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TrialRiskSignal_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE INDEX "User_companyId_idx" ON "User"("companyId");

-- CreateIndex
CREATE INDEX "User_email_idx" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Session_tokenHash_key" ON "Session"("tokenHash");

-- CreateIndex
CREATE INDEX "Session_userId_idx" ON "Session"("userId");

-- CreateIndex
CREATE INDEX "Session_expiresAt_idx" ON "Session"("expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "Company_slug_key" ON "Company"("slug");

-- CreateIndex
CREATE INDEX "Company_slug_idx" ON "Company"("slug");

-- CreateIndex
CREATE INDEX "Company_domain_idx" ON "Company"("domain");

-- CreateIndex
CREATE UNIQUE INDEX "CompanyProfile_companyId_key" ON "CompanyProfile"("companyId");

-- CreateIndex
CREATE UNIQUE INDEX "CompanyUsage_companyId_key" ON "CompanyUsage"("companyId");

-- CreateIndex
CREATE INDEX "Tender_companyId_idx" ON "Tender"("companyId");

-- CreateIndex
CREATE INDEX "Tender_companyId_analysisStatus_idx" ON "Tender"("companyId", "analysisStatus");

-- CreateIndex
CREATE INDEX "Tender_companyId_deadline_idx" ON "Tender"("companyId", "deadline");

-- CreateIndex
CREATE INDEX "Tender_companyId_status_idx" ON "Tender"("companyId", "status");

-- CreateIndex
CREATE INDEX "Tender_companyId_createdAt_idx" ON "Tender"("companyId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "Tender_companyId_idempotencyKey_key" ON "Tender"("companyId", "idempotencyKey");

-- CreateIndex
CREATE INDEX "TenderDocument_tenderId_idx" ON "TenderDocument"("tenderId");

-- CreateIndex
CREATE INDEX "TenderDocument_companyId_idx" ON "TenderDocument"("companyId");

-- CreateIndex
CREATE INDEX "TenderDocument_storageKey_idx" ON "TenderDocument"("storageKey");

-- CreateIndex
CREATE INDEX "TenderRequirement_tenderId_idx" ON "TenderRequirement"("tenderId");

-- CreateIndex
CREATE INDEX "TenderRequirement_tenderId_status_idx" ON "TenderRequirement"("tenderId", "status");

-- CreateIndex
CREATE INDEX "TenderRisk_tenderId_idx" ON "TenderRisk"("tenderId");

-- CreateIndex
CREATE INDEX "TenderRisk_tenderId_severity_idx" ON "TenderRisk"("tenderId", "severity");

-- CreateIndex
CREATE INDEX "TenderEvidence_tenderId_idx" ON "TenderEvidence"("tenderId");

-- CreateIndex
CREATE INDEX "TenderEvidence_requirementId_idx" ON "TenderEvidence"("requirementId");

-- CreateIndex
CREATE UNIQUE INDEX "TenderDecision_tenderId_key" ON "TenderDecision"("tenderId");

-- CreateIndex
CREATE INDEX "TenderDecision_companyId_idx" ON "TenderDecision"("companyId");

-- CreateIndex
CREATE INDEX "TenderDecision_companyId_decision_idx" ON "TenderDecision"("companyId", "decision");

-- CreateIndex
CREATE INDEX "MissingDocument_tenderId_idx" ON "MissingDocument"("tenderId");

-- CreateIndex
CREATE INDEX "NextAction_tenderId_idx" ON "NextAction"("tenderId");

-- CreateIndex
CREATE INDEX "Alert_companyId_status_idx" ON "Alert"("companyId", "status");

-- CreateIndex
CREATE INDEX "Alert_companyId_createdAt_idx" ON "Alert"("companyId", "createdAt");

-- CreateIndex
CREATE INDEX "Alert_scheduledFor_status_idx" ON "Alert"("scheduledFor", "status");

-- CreateIndex
CREATE INDEX "Alert_tenderId_idx" ON "Alert"("tenderId");

-- CreateIndex
CREATE INDEX "UsageRecord_companyId_action_idx" ON "UsageRecord"("companyId", "action");

-- CreateIndex
CREATE INDEX "UsageRecord_companyId_createdAt_idx" ON "UsageRecord"("companyId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "Subscription_companyId_key" ON "Subscription"("companyId");

-- CreateIndex
CREATE INDEX "Subscription_providerCustomerId_idx" ON "Subscription"("providerCustomerId");

-- CreateIndex
CREATE INDEX "Subscription_providerSubscriptionId_idx" ON "Subscription"("providerSubscriptionId");

-- CreateIndex
CREATE INDEX "Subscription_status_idx" ON "Subscription"("status");

-- CreateIndex
CREATE INDEX "Job_status_availableAt_idx" ON "Job"("status", "availableAt");

-- CreateIndex
CREATE INDEX "Job_companyId_idx" ON "Job"("companyId");

-- CreateIndex
CREATE INDEX "Job_tenderId_idx" ON "Job"("tenderId");

-- CreateIndex
CREATE UNIQUE INDEX "Job_type_idempotencyKey_key" ON "Job"("type", "idempotencyKey");

-- CreateIndex
CREATE INDEX "AuditLog_companyId_createdAt_idx" ON "AuditLog"("companyId", "createdAt");

-- CreateIndex
CREATE INDEX "AuditLog_action_createdAt_idx" ON "AuditLog"("action", "createdAt");

-- CreateIndex
CREATE INDEX "TrialRiskSignal_emailHash_idx" ON "TrialRiskSignal"("emailHash");

-- CreateIndex
CREATE INDEX "TrialRiskSignal_ipHash_idx" ON "TrialRiskSignal"("ipHash");

-- CreateIndex
CREATE INDEX "TrialRiskSignal_deviceHash_idx" ON "TrialRiskSignal"("deviceHash");

-- CreateIndex
CREATE INDEX "TrialRiskSignal_domain_idx" ON "TrialRiskSignal"("domain");

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Session" ADD CONSTRAINT "Session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CompanyProfile" ADD CONSTRAINT "CompanyProfile_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CompanyUsage" ADD CONSTRAINT "CompanyUsage_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Tender" ADD CONSTRAINT "Tender_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TenderDocument" ADD CONSTRAINT "TenderDocument_tenderId_fkey" FOREIGN KEY ("tenderId") REFERENCES "Tender"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TenderRequirement" ADD CONSTRAINT "TenderRequirement_tenderId_fkey" FOREIGN KEY ("tenderId") REFERENCES "Tender"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TenderRisk" ADD CONSTRAINT "TenderRisk_tenderId_fkey" FOREIGN KEY ("tenderId") REFERENCES "Tender"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TenderEvidence" ADD CONSTRAINT "TenderEvidence_tenderId_fkey" FOREIGN KEY ("tenderId") REFERENCES "Tender"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TenderEvidence" ADD CONSTRAINT "TenderEvidence_requirementId_fkey" FOREIGN KEY ("requirementId") REFERENCES "TenderRequirement"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TenderDecision" ADD CONSTRAINT "TenderDecision_tenderId_fkey" FOREIGN KEY ("tenderId") REFERENCES "Tender"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TenderDecision" ADD CONSTRAINT "TenderDecision_decidedById_fkey" FOREIGN KEY ("decidedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MissingDocument" ADD CONSTRAINT "MissingDocument_tenderId_fkey" FOREIGN KEY ("tenderId") REFERENCES "Tender"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NextAction" ADD CONSTRAINT "NextAction_tenderId_fkey" FOREIGN KEY ("tenderId") REFERENCES "Tender"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Alert" ADD CONSTRAINT "Alert_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Alert" ADD CONSTRAINT "Alert_tenderId_fkey" FOREIGN KEY ("tenderId") REFERENCES "Tender"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UsageRecord" ADD CONSTRAINT "UsageRecord_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Subscription" ADD CONSTRAINT "Subscription_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Job" ADD CONSTRAINT "Job_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Job" ADD CONSTRAINT "Job_tenderId_fkey" FOREIGN KEY ("tenderId") REFERENCES "Tender"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TrialRiskSignal" ADD CONSTRAINT "TrialRiskSignal_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE SET NULL ON UPDATE CASCADE;
