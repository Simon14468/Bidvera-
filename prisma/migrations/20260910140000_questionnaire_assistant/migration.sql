-- CreateEnum
CREATE TYPE "QuestionnairePackStatus" AS ENUM ('EXTRACTED', 'DRAFTING', 'READY', 'FAILED');

-- CreateEnum
CREATE TYPE "QuestionnaireQuestionType" AS ENUM ('TEXT', 'YES_NO', 'NUMERIC', 'DATE', 'SINGLE_CHOICE', 'MULTIPLE_CHOICE', 'ATTACHMENT', 'UNKNOWN');

-- CreateEnum
CREATE TYPE "QuestionnaireMandatoryStatus" AS ENUM ('MANDATORY', 'OPTIONAL', 'UNKNOWN');

-- CreateEnum
CREATE TYPE "QuestionnaireDraftStatus" AS ENUM ('DRAFT_READY', 'VERIFY', 'APPROVED', 'EDITED', 'REJECTED');

-- CreateTable
CREATE TABLE "QuestionnairePack" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "tenderId" TEXT NOT NULL,
    "title" TEXT,
    "status" "QuestionnairePackStatus" NOT NULL DEFAULT 'EXTRACTED',
    "contentHash" TEXT NOT NULL,
    "sourceDocumentIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "questionCount" INTEGER NOT NULL DEFAULT 0,
    "mandatoryCount" INTEGER NOT NULL DEFAULT 0,
    "extractedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastDraftedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "QuestionnairePack_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "QuestionnaireSection" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "packId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "QuestionnaireSection_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "QuestionnaireQuestion" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "packId" TEXT NOT NULL,
    "sectionId" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "prompt" TEXT NOT NULL,
    "originalText" TEXT NOT NULL,
    "questionType" "QuestionnaireQuestionType" NOT NULL DEFAULT 'UNKNOWN',
    "mandatoryStatus" "QuestionnaireMandatoryStatus" NOT NULL DEFAULT 'UNKNOWN',
    "answerOptions" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "structuralContext" TEXT,
    "sourceDocumentId" TEXT,
    "sourceDocumentName" TEXT NOT NULL,
    "sourcePage" INTEGER,
    "sourceSection" TEXT,
    "sourceSheet" TEXT,
    "sourceSlide" INTEGER,
    "sourceCell" TEXT,
    "questionKey" TEXT NOT NULL,
    "detectionConfidence" DOUBLE PRECISION NOT NULL DEFAULT 0.5,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "QuestionnaireQuestion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "QuestionnaireDraftAnswer" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "questionId" TEXT NOT NULL,
    "status" "QuestionnaireDraftStatus" NOT NULL DEFAULT 'VERIFY',
    "draftText" TEXT,
    "editedText" TEXT,
    "evidenceRefs" JSONB,
    "confidence" DOUBLE PRECISION,
    "rationale" TEXT,
    "generatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reviewedAt" TIMESTAMP(3),
    "reviewedByUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "QuestionnaireDraftAnswer_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "QuestionnairePack_companyId_tenderId_idx" ON "QuestionnairePack"("companyId", "tenderId");

-- CreateIndex
CREATE INDEX "QuestionnairePack_companyId_updatedAt_idx" ON "QuestionnairePack"("companyId", "updatedAt");

-- CreateIndex
CREATE INDEX "QuestionnairePack_tenderId_status_idx" ON "QuestionnairePack"("tenderId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "QuestionnairePack_companyId_tenderId_contentHash_key" ON "QuestionnairePack"("companyId", "tenderId", "contentHash");

-- CreateIndex
CREATE INDEX "QuestionnaireSection_packId_sortOrder_idx" ON "QuestionnaireSection"("packId", "sortOrder");

-- CreateIndex
CREATE INDEX "QuestionnaireSection_companyId_idx" ON "QuestionnaireSection"("companyId");

-- CreateIndex
CREATE INDEX "QuestionnaireQuestion_companyId_packId_idx" ON "QuestionnaireQuestion"("companyId", "packId");

-- CreateIndex
CREATE INDEX "QuestionnaireQuestion_packId_sortOrder_idx" ON "QuestionnaireQuestion"("packId", "sortOrder");

-- CreateIndex
CREATE INDEX "QuestionnaireQuestion_companyId_mandatoryStatus_idx" ON "QuestionnaireQuestion"("companyId", "mandatoryStatus");

-- CreateIndex
CREATE UNIQUE INDEX "QuestionnaireQuestion_packId_questionKey_key" ON "QuestionnaireQuestion"("packId", "questionKey");

-- CreateIndex
CREATE INDEX "QuestionnaireDraftAnswer_companyId_questionId_idx" ON "QuestionnaireDraftAnswer"("companyId", "questionId");

-- CreateIndex
CREATE INDEX "QuestionnaireDraftAnswer_questionId_status_idx" ON "QuestionnaireDraftAnswer"("questionId", "status");

-- CreateIndex
CREATE INDEX "QuestionnaireDraftAnswer_companyId_status_idx" ON "QuestionnaireDraftAnswer"("companyId", "status");

-- AddForeignKey
ALTER TABLE "QuestionnairePack" ADD CONSTRAINT "QuestionnairePack_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QuestionnairePack" ADD CONSTRAINT "QuestionnairePack_tenderId_fkey" FOREIGN KEY ("tenderId") REFERENCES "Tender"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QuestionnaireSection" ADD CONSTRAINT "QuestionnaireSection_packId_fkey" FOREIGN KEY ("packId") REFERENCES "QuestionnairePack"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QuestionnaireQuestion" ADD CONSTRAINT "QuestionnaireQuestion_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QuestionnaireQuestion" ADD CONSTRAINT "QuestionnaireQuestion_packId_fkey" FOREIGN KEY ("packId") REFERENCES "QuestionnairePack"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QuestionnaireQuestion" ADD CONSTRAINT "QuestionnaireQuestion_sectionId_fkey" FOREIGN KEY ("sectionId") REFERENCES "QuestionnaireSection"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QuestionnaireDraftAnswer" ADD CONSTRAINT "QuestionnaireDraftAnswer_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QuestionnaireDraftAnswer" ADD CONSTRAINT "QuestionnaireDraftAnswer_questionId_fkey" FOREIGN KEY ("questionId") REFERENCES "QuestionnaireQuestion"("id") ON DELETE CASCADE ON UPDATE CASCADE;
