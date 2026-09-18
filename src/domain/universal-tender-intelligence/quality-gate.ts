/**
 * Quality / confidence gate before content enters canonical downstream layers.
 * Insufficient confidence → UNKNOWN / NEEDS_VERIFICATION — never guess.
 */

import { classifySemanticContent } from "./semantic-content";
import type { ClassifiedContentUnit, UtiFailureCode, UtiQualityIssue } from "./types";

export type GatedRequirementDraft = {
  requirement: string;
  category: string;
  mandatory: boolean;
  sourceDocument: string | null;
  pageNumber: number | null;
  section: string | null;
  evidence: string | null;
  /** When false, draft must not enter buildCanonicalRequirements. */
  admit: boolean;
  classification: ClassifiedContentUnit;
};

/** Hard rejects only — ambiguous UNATTRIBUTED obligations still flow to normalize(). */
const HARD_REJECT_TYPES = new Set([
  "AUTHORITY_OBLIGATION",
  "DOCUMENT_PROCEDURE",
  "SECTION_HEADING",
  "TABLE_HEADER",
  "DOCUMENT_DESCRIPTION",
  "Q_AND_A",
  "REVISION",
  "ADDENDUM",
  "EXAMPLE",
  "REVIEWER_INSTRUCTION",
  "TEST_QA_CONTENT",
]);

/**
 * Gate heuristic/AI requirement drafts through UTI semantic classification.
 * Hard-rejects authority/heading/Q&A/revision/fragments; leaves ambiguous drafts
 * for existing normalize() so detection is not weakened.
 */
export function gateRequirementDrafts(
  drafts: Array<{
    requirement?: string | null;
    description?: string | null;
    category?: string | null;
    mandatory?: boolean;
    sourceDocument?: string | null;
    pageNumber?: number | null;
    sourcePage?: number | null;
    section?: string | null;
    sourceSection?: string | null;
    evidence?: string | null;
    evidenceText?: string | null;
  }>,
): { admitted: GatedRequirementDraft[]; rejected: GatedRequirementDraft[]; issues: UtiQualityIssue[] } {
  const admitted: GatedRequirementDraft[] = [];
  const rejected: GatedRequirementDraft[] = [];
  const issues: UtiQualityIssue[] = [];

  for (const d of drafts) {
    const text = (d.requirement ?? d.description ?? "").replace(/\s+/g, " ").trim();
    const sourceDocument = d.sourceDocument ?? null;
    const pageNumber = d.pageNumber ?? d.sourcePage ?? null;
    const classification = classifySemanticContent({
      text,
      fileName: sourceDocument,
      page: pageNumber,
      categoryHint: d.category ?? null,
    });
    const hardReject =
      HARD_REJECT_TYPES.has(classification.contentType) ||
      classification.failureCodes.includes("INCOMPLETE_FRAGMENT");
    const admit = !hardReject;
    const gated: GatedRequirementDraft = {
      requirement: text,
      category: d.category ?? "CONTRACTUAL",
      mandatory: d.mandatory ?? true,
      sourceDocument,
      pageNumber,
      section: d.section ?? d.sourceSection ?? null,
      evidence: d.evidence ?? d.evidenceText ?? text,
      admit,
      classification,
    };
    if (gated.admit) {
      admitted.push(gated);
    } else {
      rejected.push(gated);
      const code: UtiFailureCode =
        classification.failureCodes[0] ?? "UNKNOWN_CLASSIFICATION";
      issues.push({
        code,
        message: `Rejected draft (${classification.contentType}): ${text.slice(0, 80)}`,
        fileId: null,
        fileName: sourceDocument,
      });
    }
  }

  return { admitted, rejected, issues };
}
