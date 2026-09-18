-- CreateEnum
CREATE TYPE "CalendarTenderStatus" AS ENUM ('OPEN', 'WATCHING', 'SUBMITTED', 'CLOSED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "CalendarDeadlineType" AS ENUM ('SUBMISSION', 'CLARIFICATION', 'OPENING', 'SITE_VISIT', 'MEETING', 'OTHER');

-- CreateEnum
CREATE TYPE "CalendarMilestoneStatus" AS ENUM ('SCHEDULED', 'DUE_TODAY', 'PAST', 'CANCELLED');

-- CreateEnum
CREATE TYPE "CalendarReminderOffset" AS ENUM ('DAYS_30', 'DAYS_14', 'DAYS_7', 'DAYS_3', 'DAYS_1', 'SAME_DAY');

-- CreateEnum
CREATE TYPE "CalendarReminderStatus" AS ENUM ('SCHEDULED', 'SENT', 'CANCELLED');

-- CreateTable
CREATE TABLE "CalendarTender" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "referenceNumber" TEXT,
    "buyerAuthority" TEXT,
    "country" TEXT,
    "category" TEXT,
    "description" TEXT,
    "status" "CalendarTenderStatus" NOT NULL DEFAULT 'OPEN',
    "sourceUrl" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CalendarTender_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CalendarTenderDeadline" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "tenderId" TEXT NOT NULL,
    "type" "CalendarDeadlineType" NOT NULL DEFAULT 'SUBMISSION',
    "title" TEXT NOT NULL,
    "occursAt" TIMESTAMP(3) NOT NULL,
    "dateOnly" BOOLEAN NOT NULL DEFAULT false,
    "timezone" TEXT,
    "source" TEXT,
    "notes" TEXT,
    "status" "CalendarMilestoneStatus" NOT NULL DEFAULT 'SCHEDULED',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CalendarTenderDeadline_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CalendarTenderEvent" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "tenderId" TEXT NOT NULL,
    "type" "CalendarDeadlineType" NOT NULL DEFAULT 'OTHER',
    "title" TEXT NOT NULL,
    "occursAt" TIMESTAMP(3) NOT NULL,
    "dateOnly" BOOLEAN NOT NULL DEFAULT false,
    "timezone" TEXT,
    "source" TEXT,
    "notes" TEXT,
    "status" "CalendarMilestoneStatus" NOT NULL DEFAULT 'SCHEDULED',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CalendarTenderEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CalendarTenderReminder" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "tenderId" TEXT NOT NULL,
    "deadlineId" TEXT NOT NULL,
    "offset" "CalendarReminderOffset" NOT NULL,
    "fireAt" TIMESTAMP(3) NOT NULL,
    "status" "CalendarReminderStatus" NOT NULL DEFAULT 'SCHEDULED',
    "alertId" TEXT,
    "dedupeKey" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CalendarTenderReminder_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CalendarTenderReminderSettings" (
    "companyId" TEXT NOT NULL,
    "remind30d" BOOLEAN NOT NULL DEFAULT true,
    "remind14d" BOOLEAN NOT NULL DEFAULT true,
    "remind7d" BOOLEAN NOT NULL DEFAULT true,
    "remind3d" BOOLEAN NOT NULL DEFAULT true,
    "remind1d" BOOLEAN NOT NULL DEFAULT true,
    "remindSameDay" BOOLEAN NOT NULL DEFAULT true,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CalendarTenderReminderSettings_pkey" PRIMARY KEY ("companyId")
);

-- CreateIndex
CREATE INDEX "CalendarTender_companyId_status_idx" ON "CalendarTender"("companyId", "status");
CREATE INDEX "CalendarTender_companyId_country_idx" ON "CalendarTender"("companyId", "country");
CREATE INDEX "CalendarTender_companyId_category_idx" ON "CalendarTender"("companyId", "category");
CREATE INDEX "CalendarTender_companyId_updatedAt_idx" ON "CalendarTender"("companyId", "updatedAt");

CREATE INDEX "CalendarTenderDeadline_companyId_occursAt_idx" ON "CalendarTenderDeadline"("companyId", "occursAt");
CREATE INDEX "CalendarTenderDeadline_companyId_tenderId_idx" ON "CalendarTenderDeadline"("companyId", "tenderId");
CREATE INDEX "CalendarTenderDeadline_tenderId_type_occursAt_idx" ON "CalendarTenderDeadline"("tenderId", "type", "occursAt");

CREATE UNIQUE INDEX "CalendarTenderEvent_companyId_tenderId_type_title_occursAt_key" ON "CalendarTenderEvent"("companyId", "tenderId", "type", "title", "occursAt");
CREATE INDEX "CalendarTenderEvent_companyId_occursAt_idx" ON "CalendarTenderEvent"("companyId", "occursAt");
CREATE INDEX "CalendarTenderEvent_companyId_tenderId_idx" ON "CalendarTenderEvent"("companyId", "tenderId");

CREATE UNIQUE INDEX "CalendarTenderReminder_dedupeKey_key" ON "CalendarTenderReminder"("dedupeKey");
CREATE INDEX "CalendarTenderReminder_companyId_status_idx" ON "CalendarTenderReminder"("companyId", "status");
CREATE INDEX "CalendarTenderReminder_deadlineId_offset_idx" ON "CalendarTenderReminder"("deadlineId", "offset");
CREATE INDEX "CalendarTenderReminder_fireAt_status_idx" ON "CalendarTenderReminder"("fireAt", "status");

-- AddForeignKey
ALTER TABLE "CalendarTender" ADD CONSTRAINT "CalendarTender_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CalendarTenderDeadline" ADD CONSTRAINT "CalendarTenderDeadline_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CalendarTenderDeadline" ADD CONSTRAINT "CalendarTenderDeadline_tenderId_fkey" FOREIGN KEY ("tenderId") REFERENCES "CalendarTender"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CalendarTenderEvent" ADD CONSTRAINT "CalendarTenderEvent_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CalendarTenderEvent" ADD CONSTRAINT "CalendarTenderEvent_tenderId_fkey" FOREIGN KEY ("tenderId") REFERENCES "CalendarTender"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CalendarTenderReminder" ADD CONSTRAINT "CalendarTenderReminder_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CalendarTenderReminder" ADD CONSTRAINT "CalendarTenderReminder_tenderId_fkey" FOREIGN KEY ("tenderId") REFERENCES "CalendarTender"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CalendarTenderReminder" ADD CONSTRAINT "CalendarTenderReminder_deadlineId_fkey" FOREIGN KEY ("deadlineId") REFERENCES "CalendarTenderDeadline"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CalendarTenderReminderSettings" ADD CONSTRAINT "CalendarTenderReminderSettings_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;
