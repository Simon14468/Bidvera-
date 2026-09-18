-- Team Decision Workflow
ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'TEAM_TASK_CREATED';
ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'TEAM_TASK_ASSIGNED';
ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'TEAM_TASK_STATUS_CHANGED';
ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'TEAM_TASK_RESPONDED';
ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'TEAM_TASK_COMPLETED';
ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'TEAM_TASK_REOPENED';

DO $$ BEGIN
  CREATE TYPE "TeamWorkflowTaskStatus" AS ENUM ('PENDING', 'IN_PROGRESS', 'COMPLETED', 'OVERDUE', 'CANCELLED');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "TeamWorkflowDepartment" AS ENUM ('FINANCE', 'LEGAL', 'TECHNICAL', 'MANAGEMENT', 'PROCUREMENT', 'COMMERCIAL', 'OPERATIONS', 'OTHER');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "TeamWorkflowTaskKind" AS ENUM ('REQUIREMENT_GAP', 'RISK_MITIGATION', 'MISSING_DOCUMENT', 'CLARIFICATION', 'EVIDENCE_REQUEST', 'CUSTOM');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "TeamWorkflowEventType" AS ENUM ('CREATED', 'ASSIGNED', 'STATUS_CHANGED', 'RESPONSE_ADDED', 'EVIDENCE_LINKED', 'COMPLETED', 'REOPENED', 'COMMENT');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS "TeamWorkflowTask" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "tenderId" TEXT NOT NULL,
    "kind" "TeamWorkflowTaskKind" NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "requiredResponse" TEXT,
    "department" "TeamWorkflowDepartment",
    "assigneeUserId" TEXT,
    "status" "TeamWorkflowTaskStatus" NOT NULL DEFAULT 'PENDING',
    "priority" "RiskSeverity" NOT NULL DEFAULT 'MEDIUM',
    "deadline" TIMESTAMP(3),
    "responseText" TEXT,
    "evidenceNote" TEXT,
    "requirementId" TEXT,
    "riskId" TEXT,
    "missingDocId" TEXT,
    "clarificationId" TEXT,
    "dedupeKey" TEXT NOT NULL,
    "createdById" TEXT,
    "completedAt" TIMESTAMP(3),
    "completedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TeamWorkflowTask_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "TeamWorkflowTask_dedupeKey_key" ON "TeamWorkflowTask"("dedupeKey");
CREATE INDEX IF NOT EXISTS "TeamWorkflowTask_companyId_status_idx" ON "TeamWorkflowTask"("companyId", "status");
CREATE INDEX IF NOT EXISTS "TeamWorkflowTask_companyId_assigneeUserId_status_idx" ON "TeamWorkflowTask"("companyId", "assigneeUserId", "status");
CREATE INDEX IF NOT EXISTS "TeamWorkflowTask_tenderId_status_idx" ON "TeamWorkflowTask"("tenderId", "status");
CREATE INDEX IF NOT EXISTS "TeamWorkflowTask_tenderId_priority_idx" ON "TeamWorkflowTask"("tenderId", "priority");
CREATE INDEX IF NOT EXISTS "TeamWorkflowTask_deadline_idx" ON "TeamWorkflowTask"("deadline");
CREATE INDEX IF NOT EXISTS "TeamWorkflowTask_requirementId_idx" ON "TeamWorkflowTask"("requirementId");
CREATE INDEX IF NOT EXISTS "TeamWorkflowTask_riskId_idx" ON "TeamWorkflowTask"("riskId");
CREATE INDEX IF NOT EXISTS "TeamWorkflowTask_missingDocId_idx" ON "TeamWorkflowTask"("missingDocId");

CREATE TABLE IF NOT EXISTS "TeamWorkflowEvent" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "taskId" TEXT NOT NULL,
    "actorUserId" TEXT,
    "eventType" "TeamWorkflowEventType" NOT NULL,
    "fromStatus" "TeamWorkflowTaskStatus",
    "toStatus" "TeamWorkflowTaskStatus",
    "message" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TeamWorkflowEvent_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "TeamWorkflowEvent_taskId_createdAt_idx" ON "TeamWorkflowEvent"("taskId", "createdAt");
CREATE INDEX IF NOT EXISTS "TeamWorkflowEvent_companyId_createdAt_idx" ON "TeamWorkflowEvent"("companyId", "createdAt");

CREATE TABLE IF NOT EXISTS "TeamWorkflowAttachment" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "taskId" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "storageKey" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "fileSize" INTEGER NOT NULL,
    "checksumSha256" TEXT,
    "uploadedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TeamWorkflowAttachment_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "TeamWorkflowAttachment_taskId_idx" ON "TeamWorkflowAttachment"("taskId");
CREATE INDEX IF NOT EXISTS "TeamWorkflowAttachment_companyId_idx" ON "TeamWorkflowAttachment"("companyId");
CREATE INDEX IF NOT EXISTS "TeamWorkflowAttachment_storageKey_idx" ON "TeamWorkflowAttachment"("storageKey");

DO $$ BEGIN
  ALTER TABLE "TeamWorkflowTask" ADD CONSTRAINT "TeamWorkflowTask_companyId_fkey"
    FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "TeamWorkflowTask" ADD CONSTRAINT "TeamWorkflowTask_tenderId_fkey"
    FOREIGN KEY ("tenderId") REFERENCES "Tender"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "TeamWorkflowTask" ADD CONSTRAINT "TeamWorkflowTask_assigneeUserId_fkey"
    FOREIGN KEY ("assigneeUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "TeamWorkflowTask" ADD CONSTRAINT "TeamWorkflowTask_requirementId_fkey"
    FOREIGN KEY ("requirementId") REFERENCES "TenderRequirement"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "TeamWorkflowTask" ADD CONSTRAINT "TeamWorkflowTask_riskId_fkey"
    FOREIGN KEY ("riskId") REFERENCES "TenderRisk"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "TeamWorkflowTask" ADD CONSTRAINT "TeamWorkflowTask_missingDocId_fkey"
    FOREIGN KEY ("missingDocId") REFERENCES "MissingDocument"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "TeamWorkflowTask" ADD CONSTRAINT "TeamWorkflowTask_createdById_fkey"
    FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "TeamWorkflowTask" ADD CONSTRAINT "TeamWorkflowTask_completedById_fkey"
    FOREIGN KEY ("completedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "TeamWorkflowEvent" ADD CONSTRAINT "TeamWorkflowEvent_companyId_fkey"
    FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "TeamWorkflowEvent" ADD CONSTRAINT "TeamWorkflowEvent_taskId_fkey"
    FOREIGN KEY ("taskId") REFERENCES "TeamWorkflowTask"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "TeamWorkflowEvent" ADD CONSTRAINT "TeamWorkflowEvent_actorUserId_fkey"
    FOREIGN KEY ("actorUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "TeamWorkflowAttachment" ADD CONSTRAINT "TeamWorkflowAttachment_taskId_fkey"
    FOREIGN KEY ("taskId") REFERENCES "TeamWorkflowTask"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
