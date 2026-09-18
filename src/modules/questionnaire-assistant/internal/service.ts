import {
  extractQuestionsFromDocuments,
  generateDraftAnswers,
  type TenderDocumentTextInput,
} from "@/domain/questionnaire-assistant";
import { parseStoredKnowledge } from "@/services/company-knowledge/persist";
import { prisma } from "@/lib/db";
import { AppError, ErrorCode } from "@/lib/errors";
import type { Prisma } from "@prisma/client";
import type {
  QuestionnaireDraftDto,
  QuestionnairePackDto,
  QuestionnaireQuestionDto,
  QuestionnaireSectionDto,
} from "./types";

async function assertTenderOwned(companyId: string, tenderId: string) {
  const tender = await prisma.tender.findFirst({
    where: { id: tenderId, companyId },
    select: { id: true, title: true },
  });
  if (!tender) {
    throw new AppError(ErrorCode.NOT_FOUND, "Tender not found.", 404);
  }
  return tender;
}

async function loadDocumentTexts(
  companyId: string,
  tenderId: string,
): Promise<TenderDocumentTextInput[]> {
  const docs = await prisma.tenderDocument.findMany({
    where: { companyId, tenderId },
    select: {
      id: true,
      fileName: true,
      mimeType: true,
      extractedText: true,
      pageCount: true,
      extractionMeta: true,
    },
    orderBy: { createdAt: "asc" },
  });
  return docs;
}

function latestDraft(
  drafts: Array<{
    id: string;
    status: QuestionnaireDraftDto["status"];
    draftText: string | null;
    editedText: string | null;
    evidenceRefs: unknown;
    confidence: number | null;
    rationale: string | null;
    generatedAt: Date;
    reviewedAt: Date | null;
  }>,
): QuestionnaireDraftDto | null {
  const d = drafts[0];
  if (!d) return null;
  return {
    id: d.id,
    status: d.status,
    draftText: d.draftText,
    editedText: d.editedText,
    evidenceRefs: d.evidenceRefs,
    confidence: d.confidence,
    rationale: d.rationale,
    generatedAt: d.generatedAt.toISOString(),
    reviewedAt: d.reviewedAt?.toISOString() ?? null,
  };
}

function toQuestionDto(q: {
  id: string;
  questionKey: string;
  prompt: string;
  originalText: string;
  questionType: QuestionnaireQuestionDto["questionType"];
  mandatoryStatus: QuestionnaireQuestionDto["mandatoryStatus"];
  answerOptions: string[];
  structuralContext: string | null;
  sourceDocumentId: string | null;
  sourceDocumentName: string;
  sourcePage: number | null;
  sourceSection: string | null;
  sourceSheet: string | null;
  sourceSlide: number | null;
  sourceCell: string | null;
  sortOrder: number;
  detectionConfidence: number;
  drafts: Array<{
    id: string;
    status: QuestionnaireDraftDto["status"];
    draftText: string | null;
    editedText: string | null;
    evidenceRefs: unknown;
    confidence: number | null;
    rationale: string | null;
    generatedAt: Date;
    reviewedAt: Date | null;
  }>;
}): QuestionnaireQuestionDto {
  return {
    id: q.id,
    questionKey: q.questionKey,
    prompt: q.prompt,
    originalText: q.originalText,
    questionType: q.questionType,
    mandatoryStatus: q.mandatoryStatus,
    answerOptions: q.answerOptions,
    structuralContext: q.structuralContext,
    sourceDocumentId: q.sourceDocumentId,
    sourceDocumentName: q.sourceDocumentName,
    sourcePage: q.sourcePage,
    sourceSection: q.sourceSection,
    sourceSheet: q.sourceSheet,
    sourceSlide: q.sourceSlide,
    sourceCell: q.sourceCell,
    sortOrder: q.sortOrder,
    detectionConfidence: q.detectionConfidence,
    draft: latestDraft(q.drafts),
  };
}

async function loadPackDto(
  companyId: string,
  packId: string,
): Promise<QuestionnairePackDto> {
  const pack = await prisma.questionnairePack.findFirst({
    where: { id: packId, companyId },
    include: {
      sections: { orderBy: { sortOrder: "asc" } },
      questions: {
        orderBy: { sortOrder: "asc" },
        include: {
          drafts: { orderBy: { generatedAt: "desc" }, take: 1 },
        },
      },
    },
  });
  if (!pack) {
    throw new AppError(ErrorCode.NOT_FOUND, "Questionnaire pack not found.", 404);
  }

  const questions = pack.questions.map(toQuestionDto);
  const bySection = new Map<string, QuestionnaireQuestionDto[]>();
  for (const q of pack.questions) {
    if (!q.sectionId) continue;
    const dto = questions.find((x) => x.id === q.id)!;
    const list = bySection.get(q.sectionId) ?? [];
    list.push(dto);
    bySection.set(q.sectionId, list);
  }

  const sections: QuestionnaireSectionDto[] = pack.sections.map((s) => ({
    id: s.id,
    title: s.title,
    sortOrder: s.sortOrder,
    questions: bySection.get(s.id) ?? [],
  }));

  return {
    id: pack.id,
    tenderId: pack.tenderId,
    title: pack.title,
    status: pack.status,
    contentHash: pack.contentHash,
    sourceDocumentIds: pack.sourceDocumentIds,
    questionCount: pack.questionCount,
    mandatoryCount: pack.mandatoryCount,
    extractedAt: pack.extractedAt.toISOString(),
    lastDraftedAt: pack.lastDraftedAt?.toISOString() ?? null,
    sections,
    questions,
  };
}

export async function listQuestionnairePacks(
  companyId: string,
  tenderId: string,
): Promise<QuestionnairePackDto[]> {
  await assertTenderOwned(companyId, tenderId);
  const packs = await prisma.questionnairePack.findMany({
    where: { companyId, tenderId },
    orderBy: { extractedAt: "desc" },
    take: 20,
  });
  const out: QuestionnairePackDto[] = [];
  for (const p of packs) {
    out.push(await loadPackDto(companyId, p.id));
  }
  return out;
}

export async function getQuestionnairePack(
  companyId: string,
  packId: string,
): Promise<QuestionnairePackDto> {
  return loadPackDto(companyId, packId);
}

export async function getLatestQuestionnaireForTender(
  companyId: string,
  tenderId: string,
): Promise<QuestionnairePackDto | null> {
  await assertTenderOwned(companyId, tenderId);
  const pack = await prisma.questionnairePack.findFirst({
    where: { companyId, tenderId },
    orderBy: { extractedAt: "desc" },
    select: { id: true },
  });
  if (!pack) return null;
  return loadPackDto(companyId, pack.id);
}

/**
 * Idempotent extract from persisted TenderDocument.extractedText.
 * Does NOT re-run Tender Analysis.
 */
export async function extractQuestionnairesForTender(input: {
  companyId: string;
  tenderId: string;
  force?: boolean;
}): Promise<QuestionnairePackDto> {
  const tender = await assertTenderOwned(input.companyId, input.tenderId);
  const documents = await loadDocumentTexts(input.companyId, input.tenderId);
  if (documents.length === 0) {
    throw new AppError(
      ErrorCode.VALIDATION,
      "No tender documents available for questionnaire extraction.",
      400,
    );
  }

  const extraction = extractQuestionsFromDocuments(documents);

  if (!input.force) {
    const existing = await prisma.questionnairePack.findUnique({
      where: {
        companyId_tenderId_contentHash: {
          companyId: input.companyId,
          tenderId: input.tenderId,
          contentHash: extraction.contentHash,
        },
      },
      select: { id: true },
    });
    if (existing) {
      return loadPackDto(input.companyId, existing.id);
    }
  } else {
    await prisma.questionnairePack.deleteMany({
      where: {
        companyId: input.companyId,
        tenderId: input.tenderId,
        contentHash: extraction.contentHash,
      },
    });
  }

  const mandatoryCount = extraction.questions.filter(
    (q) => q.mandatoryStatus === "MANDATORY",
  ).length;

  const pack = await prisma.questionnairePack.create({
    data: {
      companyId: input.companyId,
      tenderId: input.tenderId,
      title: extraction.title ?? `${tender.title} — questionnaire`,
      status: "EXTRACTED",
      contentHash: extraction.contentHash,
      sourceDocumentIds: extraction.sourceDocumentIds,
      questionCount: extraction.questions.length,
      mandatoryCount,
    },
  });

  const sectionIdByTitle = new Map<string, string>();
  for (const section of extraction.sections) {
    const row = await prisma.questionnaireSection.create({
      data: {
        companyId: input.companyId,
        packId: pack.id,
        title: section.title,
        sortOrder: section.sortOrder,
      },
    });
    sectionIdByTitle.set(section.title, row.id);
  }

  if (extraction.questions.length > 0) {
    await prisma.questionnaireQuestion.createMany({
      data: extraction.questions.map((q) => ({
        companyId: input.companyId,
        packId: pack.id,
        sectionId: q.sectionTitle
          ? (sectionIdByTitle.get(q.sectionTitle) ?? null)
          : null,
        sortOrder: q.sortOrder,
        prompt: q.prompt,
        originalText: q.originalText,
        questionType: q.questionType,
        mandatoryStatus: q.mandatoryStatus,
        answerOptions: q.answerOptions,
        structuralContext: q.provenance.structuralContext,
        sourceDocumentId: q.provenance.sourceDocumentId,
        sourceDocumentName: q.provenance.sourceDocumentName,
        sourcePage: q.provenance.sourcePage,
        sourceSection: q.provenance.sourceSection,
        sourceSheet: q.provenance.sourceSheet,
        sourceSlide: q.provenance.sourceSlide,
        sourceCell: q.provenance.sourceCell,
        questionKey: q.questionKey,
        detectionConfidence: q.detectionConfidence,
      })),
    });
  }

  return loadPackDto(input.companyId, pack.id);
}

async function loadCompanyKnowledgeContext(companyId: string) {
  const company = await prisma.company.findUnique({
    where: { id: companyId },
    include: { profile: true },
  });
  const knowledge = parseStoredKnowledge(company?.profile?.knowledgeJson ?? null);
  return {
    knowledge,
    profile: {
      companyName: company?.name ?? null,
      country: company?.profile?.country ?? company?.country ?? null,
      industry: company?.profile?.industry ?? null,
      employeeRange: company?.profile?.employeeRange ?? null,
      certifications: company?.profile?.certifications ?? [],
      services: company?.profile?.services ?? [],
    },
  };
}

export async function generateDraftAnswersForPack(input: {
  companyId: string;
  packId: string;
  questionIds?: string[];
}): Promise<QuestionnairePackDto> {
  const pack = await prisma.questionnairePack.findFirst({
    where: { id: input.packId, companyId: input.companyId },
    include: {
      questions: {
        where: input.questionIds?.length
          ? { id: { in: input.questionIds } }
          : undefined,
        orderBy: { sortOrder: "asc" },
      },
    },
  });
  if (!pack) {
    throw new AppError(ErrorCode.NOT_FOUND, "Questionnaire pack not found.", 404);
  }

  const { knowledge, profile } = await loadCompanyKnowledgeContext(input.companyId);
  const candidates = generateDraftAnswers({
    questions: pack.questions.map((q) => ({
      questionKey: q.questionKey,
      prompt: q.prompt,
      questionType: q.questionType,
      mandatoryStatus: q.mandatoryStatus,
    })),
    knowledge,
    profile,
  });

  const byKey = new Map(candidates.map((c) => [c.questionKey, c]));

  for (const q of pack.questions) {
    const draft = byKey.get(q.questionKey);
    if (!draft) continue;
    await prisma.questionnaireDraftAnswer.create({
      data: {
        companyId: input.companyId,
        questionId: q.id,
        status: draft.status,
        draftText: draft.draftText,
        evidenceRefs: draft.evidenceRefs as Prisma.InputJsonValue,
        confidence: draft.confidence,
        rationale: draft.rationale,
      },
    });
  }

  await prisma.questionnairePack.update({
    where: { id: pack.id },
    data: {
      status: "READY",
      lastDraftedAt: new Date(),
    },
  });

  return loadPackDto(input.companyId, pack.id);
}

export async function reviewDraftAnswer(input: {
  companyId: string;
  questionId: string;
  action: "approve" | "reject" | "edit";
  editedText?: string | null;
  actorUserId?: string | null;
}): Promise<QuestionnaireQuestionDto> {
  const question = await prisma.questionnaireQuestion.findFirst({
    where: { id: input.questionId, companyId: input.companyId },
    include: {
      drafts: { orderBy: { generatedAt: "desc" }, take: 1 },
    },
  });
  if (!question) {
    throw new AppError(ErrorCode.NOT_FOUND, "Question not found.", 404);
  }
  const current = question.drafts[0];
  if (!current) {
    throw new AppError(ErrorCode.VALIDATION, "No draft answer to review.", 400);
  }

  let status = current.status;
  let editedText = current.editedText;
  if (input.action === "approve") {
    status = "APPROVED";
  } else if (input.action === "reject") {
    status = "REJECTED";
  } else if (input.action === "edit") {
    const text = (input.editedText ?? "").trim();
    if (!text) {
      throw new AppError(ErrorCode.VALIDATION, "editedText is required.", 400);
    }
    status = "EDITED";
    editedText = text;
  }

  await prisma.questionnaireDraftAnswer.update({
    where: { id: current.id },
    data: {
      status,
      editedText,
      reviewedAt: new Date(),
      reviewedByUserId: input.actorUserId ?? null,
    },
  });

  if (status === "APPROVED" || status === "EDITED") {
    const { scheduleMatchingProfileRebuild } = await import(
      "@/application/matching-rebuild"
    );
    scheduleMatchingProfileRebuild(input.companyId);
  }

  const refreshed = await prisma.questionnaireQuestion.findFirst({
    where: { id: input.questionId, companyId: input.companyId },
    include: { drafts: { orderBy: { generatedAt: "desc" }, take: 1 } },
  });
  if (!refreshed) {
    throw new AppError(ErrorCode.NOT_FOUND, "Question not found.", 404);
  }
  return toQuestionDto(refreshed);
}
