-- CreateEnum
CREATE TYPE "ClientRequestStatus" AS ENUM ('PENDING', 'IN_PROGRESS', 'COMPLETED', 'OVERDUE', 'CANCELLED');

-- CreateEnum
CREATE TYPE "ClientRequestItemType" AS ENUM ('INFORMATION', 'DOCUMENT');

-- CreateEnum
CREATE TYPE "ClientRequestItemStatus" AS ENUM ('PENDING', 'COMPLETED');

-- CreateEnum
CREATE TYPE "ClientRequestLinkSource" AS ENUM ('COMPLIANCE_DOCUMENT', 'SUPPLIER_EVIDENCE', 'COMPANY_PROFILE');

-- CreateEnum
CREATE TYPE "ClientRequestActivityType" AS ENUM ('CREATED', 'UPDATED', 'ITEM_ADDED', 'ITEM_COMPLETED', 'ITEM_REOPENED', 'DOCUMENT_ATTACHED', 'DOCUMENT_DETACHED', 'DEADLINE_CHANGED', 'SHARED', 'SHARE_REVOKED', 'COMPLETED', 'CANCELLED', 'STATUS_CHANGED');

-- CreateEnum
CREATE TYPE "ClientRequestReminderOffset" AS ENUM ('DAYS_14', 'DAYS_7', 'DAYS_3', 'DAYS_1', 'SAME_DAY');

-- CreateEnum
CREATE TYPE "ClientRequestReminderStatus" AS ENUM ('SCHEDULED', 'SENT', 'CANCELLED');

-- CreateTable
CREATE TABLE "ClientRequest" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "clientName" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "deadline" TIMESTAMP(3) NOT NULL,
    "deadlineDateOnly" BOOLEAN NOT NULL DEFAULT true,
    "status" "ClientRequestStatus" NOT NULL DEFAULT 'PENDING',
    "progressPercent" INTEGER NOT NULL DEFAULT 0,
    "completedAt" TIMESTAMP(3),
    "cancelledAt" TIMESTAMP(3),
    "createdByUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ClientRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ClientRequestItem" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "requestId" TEXT NOT NULL,
    "type" "ClientRequestItemType" NOT NULL,
    "label" TEXT NOT NULL,
    "description" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "status" "ClientRequestItemStatus" NOT NULL DEFAULT 'PENDING',
    "informationValue" TEXT,
    "linkSource" "ClientRequestLinkSource",
    "complianceDocumentId" TEXT,
    "supplierEvidenceId" TEXT,
    "completedAt" TIMESTAMP(3),
    "completedByUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ClientRequestItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ClientRequestActivity" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "requestId" TEXT NOT NULL,
    "actorUserId" TEXT,
    "eventType" "ClientRequestActivityType" NOT NULL,
    "message" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ClientRequestActivity_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ClientRequestShare" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "requestId" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "tokenPrefix" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3),
    "revokedAt" TIMESTAMP(3),
    "createdByUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ClientRequestShare_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ClientRequestShareItem" (
    "id" TEXT NOT NULL,
    "shareId" TEXT NOT NULL,
    "itemId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ClientRequestShareItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ClientRequestReminder" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "requestId" TEXT NOT NULL,
    "offset" "ClientRequestReminderOffset" NOT NULL,
    "fireAt" TIMESTAMP(3) NOT NULL,
    "status" "ClientRequestReminderStatus" NOT NULL DEFAULT 'SCHEDULED',
    "alertId" TEXT,
    "dedupeKey" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ClientRequestReminder_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ClientRequest_companyId_status_idx" ON "ClientRequest"("companyId", "status");

-- CreateIndex
CREATE INDEX "ClientRequest_companyId_deadline_idx" ON "ClientRequest"("companyId", "deadline");

-- CreateIndex
CREATE INDEX "ClientRequest_companyId_clientName_idx" ON "ClientRequest"("companyId", "clientName");

-- CreateIndex
CREATE INDEX "ClientRequest_companyId_updatedAt_idx" ON "ClientRequest"("companyId", "updatedAt");

-- CreateIndex
CREATE INDEX "ClientRequestItem_companyId_requestId_idx" ON "ClientRequestItem"("companyId", "requestId");

-- CreateIndex
CREATE INDEX "ClientRequestItem_requestId_status_idx" ON "ClientRequestItem"("requestId", "status");

-- CreateIndex
CREATE INDEX "ClientRequestItem_complianceDocumentId_idx" ON "ClientRequestItem"("complianceDocumentId");

-- CreateIndex
CREATE INDEX "ClientRequestItem_supplierEvidenceId_idx" ON "ClientRequestItem"("supplierEvidenceId");

-- CreateIndex
CREATE INDEX "ClientRequestActivity_requestId_createdAt_idx" ON "ClientRequestActivity"("requestId", "createdAt");

-- CreateIndex
CREATE INDEX "ClientRequestActivity_companyId_createdAt_idx" ON "ClientRequestActivity"("companyId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "ClientRequestShare_tokenHash_key" ON "ClientRequestShare"("tokenHash");

-- CreateIndex
CREATE INDEX "ClientRequestShare_companyId_requestId_idx" ON "ClientRequestShare"("companyId", "requestId");

-- CreateIndex
CREATE INDEX "ClientRequestShare_requestId_revokedAt_idx" ON "ClientRequestShare"("requestId", "revokedAt");

-- CreateIndex
CREATE INDEX "ClientRequestShareItem_itemId_idx" ON "ClientRequestShareItem"("itemId");

-- CreateIndex
CREATE UNIQUE INDEX "ClientRequestShareItem_shareId_itemId_key" ON "ClientRequestShareItem"("shareId", "itemId");

-- CreateIndex
CREATE UNIQUE INDEX "ClientRequestReminder_dedupeKey_key" ON "ClientRequestReminder"("dedupeKey");

-- CreateIndex
CREATE INDEX "ClientRequestReminder_companyId_status_idx" ON "ClientRequestReminder"("companyId", "status");

-- CreateIndex
CREATE INDEX "ClientRequestReminder_requestId_offset_idx" ON "ClientRequestReminder"("requestId", "offset");

-- CreateIndex
CREATE INDEX "ClientRequestReminder_fireAt_status_idx" ON "ClientRequestReminder"("fireAt", "status");

-- AddForeignKey
ALTER TABLE "ClientRequest" ADD CONSTRAINT "ClientRequest_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClientRequestItem" ADD CONSTRAINT "ClientRequestItem_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClientRequestItem" ADD CONSTRAINT "ClientRequestItem_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "ClientRequest"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClientRequestItem" ADD CONSTRAINT "ClientRequestItem_complianceDocumentId_fkey" FOREIGN KEY ("complianceDocumentId") REFERENCES "ComplianceDocument"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClientRequestItem" ADD CONSTRAINT "ClientRequestItem_supplierEvidenceId_fkey" FOREIGN KEY ("supplierEvidenceId") REFERENCES "SupplierQualificationEvidence"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClientRequestActivity" ADD CONSTRAINT "ClientRequestActivity_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClientRequestActivity" ADD CONSTRAINT "ClientRequestActivity_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "ClientRequest"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClientRequestShare" ADD CONSTRAINT "ClientRequestShare_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClientRequestShare" ADD CONSTRAINT "ClientRequestShare_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "ClientRequest"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClientRequestShareItem" ADD CONSTRAINT "ClientRequestShareItem_shareId_fkey" FOREIGN KEY ("shareId") REFERENCES "ClientRequestShare"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClientRequestShareItem" ADD CONSTRAINT "ClientRequestShareItem_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "ClientRequestItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClientRequestReminder" ADD CONSTRAINT "ClientRequestReminder_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClientRequestReminder" ADD CONSTRAINT "ClientRequestReminder_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "ClientRequest"("id") ON DELETE CASCADE ON UPDATE CASCADE;
