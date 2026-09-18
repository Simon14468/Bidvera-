import { createHash } from "crypto";
import { detectMandatoryStatus } from "./mandatory";
import { extractAnswerOptions, inferQuestionType } from "./question-type";
import type {
  ExtractedQuestion,
  ExtractedSection,
  QuestionnaireExtractionResult,
  TenderDocumentTextInput,
} from "./types";

const QUESTIONNAIRE_FILENAME =
  /\b(?:questionnaire|schedule\s+of\s+questions|returnable\s+form|response\s+form|bidder\s+form|supplier\s+questionnaire|rfq\s+response|form\s+of\s+tender|self[- ]declaration|compliance\s+matrix|technical\s+questionnaire)\b/i;

const SECTION_HEADER =
  /^(?:section|part|schedule|annex|appendix|chapitre|partie)\s*[\dIVXLC.]+[:.\-\s].{2,80}$/i;

const NUMBERED_QUESTION =
  /^(?:Q(?:uestion)?\s*)?(\d{1,3})[.)]\s+(.{8,500})$/i;

const BULLET_QUESTION =
  /^(?:[-•*]|\([a-z]\))\s+(.{8,500}\?)\s*$/i;

const FREE_QUESTION = /^(.{12,500}\?)\s*$/;

function sha256(s: string): string {
  return createHash("sha256").update(s).digest("hex");
}

function questionKey(input: {
  documentId: string;
  sortOrder: number;
  prompt: string;
}): string {
  const base = `${input.documentId}|${input.sortOrder}|${input.prompt.slice(0, 160)}`;
  return sha256(base).slice(0, 24);
}

export function computeQuestionnaireContentHash(
  documents: TenderDocumentTextInput[],
): string {
  const parts = [...documents]
    .sort((a, b) => a.id.localeCompare(b.id))
    .map((d) => `${d.id}:${sha256(d.extractedText ?? "")}`);
  return sha256(parts.join("|"));
}

export function isQuestionnaireCandidateDocument(
  doc: TenderDocumentTextInput,
): boolean {
  if (QUESTIONNAIRE_FILENAME.test(doc.fileName)) return true;
  const text = doc.extractedText ?? "";
  if (text.length < 40) return false;
  const lines = text.split(/\r?\n/).filter((l) => l.trim().length > 0);
  if (lines.length === 0) return false;
  let qMarks = 0;
  let numbered = 0;
  for (const line of lines.slice(0, 400)) {
    if (/\?/.test(line)) qMarks += 1;
    if (NUMBERED_QUESTION.test(line.trim())) numbered += 1;
  }
  const density = (qMarks + numbered) / Math.min(lines.length, 400);
  return density >= 0.08 || numbered >= 5 || qMarks >= 8;
}

function pageHintFromMeta(
  meta: unknown,
  lineIndex: number,
  totalLines: number,
  pageCount: number | null,
): number | null {
  if (pageCount && pageCount > 0 && totalLines > 0) {
    return Math.min(
      pageCount,
      Math.max(1, Math.floor((lineIndex / totalLines) * pageCount) + 1),
    );
  }
  if (meta && typeof meta === "object" && meta !== null && "pages" in meta) {
    const pages = (meta as { pages?: unknown }).pages;
    if (Array.isArray(pages) && pages.length > 0) {
      const idx = Math.min(
        pages.length - 1,
        Math.floor((lineIndex / Math.max(totalLines, 1)) * pages.length),
      );
      const p = pages[idx] as { page?: number };
      return typeof p?.page === "number" ? p.page : null;
    }
  }
  return null;
}

function sheetHint(fileName: string, mimeType: string, line: string): string | null {
  if (
    /\.xlsx?$/i.test(fileName) ||
    /spreadsheet|excel/i.test(mimeType) ||
    /sheet:/i.test(line)
  ) {
    const m = line.match(/sheet\s*[:\-]\s*([^\n|]{1,60})/i);
    return m?.[1]?.trim() ?? null;
  }
  return null;
}

function slideHint(
  fileName: string,
  mimeType: string,
  lineIndex: number,
  totalLines: number,
): number | null {
  if (/\.pptx?$/i.test(fileName) || /presentation/i.test(mimeType)) {
    return Math.max(1, Math.floor(lineIndex / Math.max(8, totalLines / 20)) + 1);
  }
  return null;
}

/**
 * Extract structured questions from persisted tender document text.
 * Pure — does not call Tender Analysis or invent missing page numbers beyond coarse hints.
 */
export function extractQuestionsFromDocuments(
  documents: TenderDocumentTextInput[],
): QuestionnaireExtractionResult {
  const candidates = documents.filter(isQuestionnaireCandidateDocument);
  const sourceDocs = candidates.length > 0 ? candidates : documents.filter((d) => (d.extractedText ?? "").length > 80);
  const contentHash = computeQuestionnaireContentHash(documents);
  const questions: ExtractedQuestion[] = [];
  const sectionMap = new Map<string, ExtractedSection>();
  let sortOrder = 0;
  let currentSection: string | null = null;

  for (const doc of sourceDocs) {
    const text = doc.extractedText ?? "";
    if (!text.trim()) continue;
    const lines = text.split(/\r?\n/);
    const totalLines = lines.length;

    for (let i = 0; i < lines.length; i++) {
      const raw = lines[i] ?? "";
      const line = raw.trim();
      if (!line || line.length < 8) continue;

      if (SECTION_HEADER.test(line) && line.length < 120) {
        currentSection = line;
        if (!sectionMap.has(line)) {
          sectionMap.set(line, {
            title: line,
            sortOrder: sectionMap.size,
            questions: [],
          });
        }
        continue;
      }

      let prompt: string | null = null;
      let matched = NUMBERED_QUESTION.exec(line);
      if (matched) {
        prompt = matched[2]!.trim();
      } else {
        matched = BULLET_QUESTION.exec(line);
        if (matched) prompt = matched[1]!.trim();
        else if (FREE_QUESTION.test(line)) prompt = line;
      }

      if (!prompt) continue;
      // Skip obvious non-questions
      if (/^(?:table\s+of\s+contents|contents|index)\b/i.test(prompt)) continue;

      const lookAhead = lines
        .slice(i + 1, i + 6)
        .map((l) => l.trim())
        .filter(Boolean)
        .join("\n");
      const options = extractAnswerOptions(`${prompt}\n${lookAhead}`);
      const questionType = inferQuestionType(`${prompt}\n${lookAhead}`, options);
      const mandatoryStatus = detectMandatoryStatus(prompt, lookAhead);
      const page = pageHintFromMeta(doc.extractionMeta, i, totalLines, doc.pageCount);
      const sheet = sheetHint(doc.fileName, doc.mimeType, line);
      const slide = slideHint(doc.fileName, doc.mimeType, i, totalLines);

      const extracted: ExtractedQuestion = {
        questionKey: questionKey({
          documentId: doc.id,
          sortOrder,
          prompt,
        }),
        prompt,
        originalText: line,
        questionType,
        mandatoryStatus,
        answerOptions: options,
        sectionTitle: currentSection,
        sortOrder,
        detectionConfidence:
          NUMBERED_QUESTION.test(line) || /\?/.test(line) ? 0.75 : 0.45,
        provenance: {
          sourceDocumentId: doc.id,
          sourceDocumentName: doc.fileName,
          sourcePage: page,
          sourceSection: currentSection,
          sourceSheet: sheet,
          sourceSlide: slide,
          sourceCell: null,
          structuralContext: lookAhead.slice(0, 400) || null,
          originalText: line,
        },
      };
      questions.push(extracted);
      if (currentSection && sectionMap.has(currentSection)) {
        sectionMap.get(currentSection)!.questions.push(extracted);
      }
      sortOrder += 1;
    }
  }

  const title =
    sourceDocs.find((d) => QUESTIONNAIRE_FILENAME.test(d.fileName))?.fileName ??
    (questions.length > 0 ? "Tender questionnaire" : null);

  return {
    title,
    contentHash,
    sourceDocumentIds: sourceDocs.map((d) => d.id),
    sections: [...sectionMap.values()],
    questions,
  };
}
