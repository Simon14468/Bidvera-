/**
 * AI Questionnaire Assistant — domain types (Feature 7A).
 * Draft answers are NEVER Decision Engine evidence or verified company facts.
 */

export type QuestionnaireQuestionType =
  | "TEXT"
  | "YES_NO"
  | "NUMERIC"
  | "DATE"
  | "SINGLE_CHOICE"
  | "MULTIPLE_CHOICE"
  | "ATTACHMENT"
  | "UNKNOWN";

export type QuestionnaireMandatoryStatus = "MANDATORY" | "OPTIONAL" | "UNKNOWN";

export type QuestionnaireDraftStatus =
  | "DRAFT_READY"
  | "VERIFY"
  | "APPROVED"
  | "EDITED"
  | "REJECTED";

export type QuestionProvenance = {
  sourceDocumentId: string | null;
  sourceDocumentName: string;
  sourcePage: number | null;
  sourceSection: string | null;
  sourceSheet: string | null;
  sourceSlide: number | null;
  sourceCell: string | null;
  structuralContext: string | null;
  originalText: string;
};

export type ExtractedQuestion = {
  questionKey: string;
  prompt: string;
  originalText: string;
  questionType: QuestionnaireQuestionType;
  mandatoryStatus: QuestionnaireMandatoryStatus;
  answerOptions: string[];
  sectionTitle: string | null;
  sortOrder: number;
  detectionConfidence: number;
  provenance: QuestionProvenance;
};

export type ExtractedSection = {
  title: string;
  sortOrder: number;
  questions: ExtractedQuestion[];
};

export type QuestionnaireExtractionResult = {
  title: string | null;
  contentHash: string;
  sourceDocumentIds: string[];
  sections: ExtractedSection[];
  questions: ExtractedQuestion[];
};

export type DraftEvidenceRef = {
  sourceDocument: string;
  page: number | "UNKNOWN" | null;
  section: string | null;
  excerpt: string | null;
  knowledgeKey?: string | null;
};

export type DraftAnswerCandidate = {
  questionKey: string;
  status: Extract<"DRAFT_READY" | "VERIFY", QuestionnaireDraftStatus>;
  draftText: string | null;
  evidenceRefs: DraftEvidenceRef[];
  confidence: number;
  rationale: string;
};

export type TenderDocumentTextInput = {
  id: string;
  fileName: string;
  mimeType: string;
  extractedText: string | null;
  pageCount: number | null;
  extractionMeta: unknown;
};
