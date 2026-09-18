-- CreateEnum
CREATE TYPE "ComplianceStatus" AS ENUM ('VALID', 'EXPIRING_SOON', 'EXPIRED', 'NO_EXPIRY', 'UNKNOWN');

-- CreateEnum
CREATE TYPE "ComplianceReminderKind" AS ENUM ('DAYS_90', 'DAYS_30', 'DAYS_7', 'EXPIRED');

-- CreateEnum
CREATE TYPE "ComplianceReminderStatus" AS ENUM ('SCHEDULED', 'SENT', 'CANCELLED');

-- CreateTable
CREATE TABLE "ComplianceDocumentCategory" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ComplianceDocumentCategory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ComplianceDocument" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "categoryId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "issuingAuthority" TEXT,
    "documentNumber" TEXT,
    "issueDate" DATE,
    "expiryDate" DATE,
    "status" "ComplianceStatus" NOT NULL DEFAULT 'UNKNOWN',
    "extractionConfidence" DOUBLE PRECISION,
    "extractionProvenance" JSONB,
    "currentVersionId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ComplianceDocument_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ComplianceDocumentVersion" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "documentId" TEXT NOT NULL,
    "versionNumber" INTEGER NOT NULL,
    "storageKey" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "byteLength" INTEGER NOT NULL,
    "checksumSha256" TEXT,
    "extractedTextPreview" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ComplianceDocumentVersion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ComplianceExpiryReminder" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "documentId" TEXT NOT NULL,
    "kind" "ComplianceReminderKind" NOT NULL,
    "fireOnDate" DATE NOT NULL,
    "scheduledFor" TIMESTAMP(3) NOT NULL,
    "status" "ComplianceReminderStatus" NOT NULL DEFAULT 'SCHEDULED',
    "alertId" TEXT,
    "dedupeKey" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ComplianceExpiryReminder_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ComplianceReminderSettings" (
    "companyId" TEXT NOT NULL,
    "remind90d" BOOLEAN NOT NULL DEFAULT true,
    "remind30d" BOOLEAN NOT NULL DEFAULT true,
    "remind7d" BOOLEAN NOT NULL DEFAULT true,
    "remindExpired" BOOLEAN NOT NULL DEFAULT true,
    "expiringSoonDays" INTEGER NOT NULL DEFAULT 90,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ComplianceReminderSettings_pkey" PRIMARY KEY ("companyId")
);

-- CreateIndex
CREATE INDEX "ComplianceDocumentCategory_companyId_idx" ON "ComplianceDocumentCategory"("companyId");

-- CreateIndex
CREATE UNIQUE INDEX "ComplianceDocumentCategory_companyId_key_key" ON "ComplianceDocumentCategory"("companyId", "key");

-- CreateIndex
CREATE INDEX "ComplianceDocument_companyId_status_idx" ON "ComplianceDocument"("companyId", "status");

-- CreateIndex
CREATE INDEX "ComplianceDocument_companyId_categoryId_idx" ON "ComplianceDocument"("companyId", "categoryId");

-- CreateIndex
CREATE INDEX "ComplianceDocument_companyId_expiryDate_idx" ON "ComplianceDocument"("companyId", "expiryDate");

-- CreateIndex
CREATE INDEX "ComplianceDocument_companyId_updatedAt_idx" ON "ComplianceDocument"("companyId", "updatedAt");

-- CreateIndex
CREATE INDEX "ComplianceDocumentVersion_companyId_documentId_idx" ON "ComplianceDocumentVersion"("companyId", "documentId");

-- CreateIndex
CREATE INDEX "ComplianceDocumentVersion_companyId_checksumSha256_idx" ON "ComplianceDocumentVersion"("companyId", "checksumSha256");

-- CreateIndex
CREATE UNIQUE INDEX "ComplianceDocumentVersion_documentId_versionNumber_key" ON "ComplianceDocumentVersion"("documentId", "versionNumber");

-- CreateIndex
CREATE UNIQUE INDEX "ComplianceExpiryReminder_dedupeKey_key" ON "ComplianceExpiryReminder"("dedupeKey");

-- CreateIndex
CREATE INDEX "ComplianceExpiryReminder_companyId_status_idx" ON "ComplianceExpiryReminder"("companyId", "status");

-- CreateIndex
CREATE INDEX "ComplianceExpiryReminder_documentId_kind_idx" ON "ComplianceExpiryReminder"("documentId", "kind");

-- CreateIndex
CREATE INDEX "ComplianceExpiryReminder_scheduledFor_status_idx" ON "ComplianceExpiryReminder"("scheduledFor", "status");

-- AddForeignKey
ALTER TABLE "ComplianceDocumentCategory" ADD CONSTRAINT "ComplianceDocumentCategory_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ComplianceDocument" ADD CONSTRAINT "ComplianceDocument_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ComplianceDocument" ADD CONSTRAINT "ComplianceDocument_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "ComplianceDocumentCategory"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ComplianceDocumentVersion" ADD CONSTRAINT "ComplianceDocumentVersion_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ComplianceDocumentVersion" ADD CONSTRAINT "ComplianceDocumentVersion_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "ComplianceDocument"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ComplianceExpiryReminder" ADD CONSTRAINT "ComplianceExpiryReminder_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ComplianceExpiryReminder" ADD CONSTRAINT "ComplianceExpiryReminder_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "ComplianceDocument"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ComplianceReminderSettings" ADD CONSTRAINT "ComplianceReminderSettings_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;
