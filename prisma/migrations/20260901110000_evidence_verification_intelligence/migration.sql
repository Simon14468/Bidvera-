-- Evidence / Verification Intelligence — audit trail + evidence provenance fields

ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'EVIDENCE_FOUND';
ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'VERIFICATION_REQUESTED';
ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'VERIFIED';
ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'VERIFICATION_REJECTED';
ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'EVIDENCE_UPDATED';

ALTER TABLE "TenderEvidence" ADD COLUMN IF NOT EXISTS "documentId" TEXT;
ALTER TABLE "TenderEvidence" ADD COLUMN IF NOT EXISTS "verificationReason" TEXT;
ALTER TABLE "TenderEvidence" ADD COLUMN IF NOT EXISTS "verifiedById" TEXT;
ALTER TABLE "TenderEvidence" ADD COLUMN IF NOT EXISTS "verifiedAt" TIMESTAMP(3);

CREATE INDEX IF NOT EXISTS "TenderEvidence_documentId_idx" ON "TenderEvidence"("documentId");

CREATE TABLE IF NOT EXISTS "RequirementVerificationAudit" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "tenderId" TEXT NOT NULL,
    "requirementId" TEXT NOT NULL,
    "evidenceId" TEXT,
    "userId" TEXT,
    "action" TEXT NOT NULL,
    "snapshot" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RequirementVerificationAudit_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "RequirementVerificationAudit_companyId_tenderId_idx" ON "RequirementVerificationAudit"("companyId", "tenderId");
CREATE INDEX IF NOT EXISTS "RequirementVerificationAudit_requirementId_idx" ON "RequirementVerificationAudit"("requirementId");
CREATE INDEX IF NOT EXISTS "RequirementVerificationAudit_companyId_createdAt_idx" ON "RequirementVerificationAudit"("companyId", "createdAt");
