import type {
  QuestionnaireDraftStatus,
  QuestionnaireMandatoryStatus,
  QuestionnairePackStatus,
  QuestionnaireQuestionType,
} from "@prisma/client";

export type QuestionnaireDraftDto = {
  id: string;
  status: QuestionnaireDraftStatus;
  draftText: string | null;
  editedText: string | null;
  evidenceRefs: unknown;
  confidence: number | null;
  rationale: string | null;
  generatedAt: string;
  reviewedAt: string | null;
};

export type QuestionnaireQuestionDto = {
  id: string;
  questionKey: string;
  prompt: string;
  originalText: string;
  questionType: QuestionnaireQuestionType;
  mandatoryStatus: QuestionnaireMandatoryStatus;
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
  draft: QuestionnaireDraftDto | null;
};

export type QuestionnaireSectionDto = {
  id: string;
  title: string;
  sortOrder: number;
  questions: QuestionnaireQuestionDto[];
};

export type QuestionnairePackDto = {
  id: string;
  tenderId: string;
  title: string | null;
  status: QuestionnairePackStatus;
  contentHash: string;
  sourceDocumentIds: string[];
  questionCount: number;
  mandatoryCount: number;
  extractedAt: string;
  lastDraftedAt: string | null;
  sections: QuestionnaireSectionDto[];
  questions: QuestionnaireQuestionDto[];
};
