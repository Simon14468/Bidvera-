/**
 * Permanent regression memory — semantic failure classes (not sentence patches).
 * Every Test 1 / Test 2 / Test 3 / production defect maps to a class here.
 */

import type { GuardianValidationCode } from "./codes";

export const REGRESSION_CATEGORIES = [
  "DOCUMENT",
  "EXTRACTION",
  "CLASSIFICATION",
  "DATA",
  "EVIDENCE",
  "RISK",
  "DECISION",
  "ACTION_PLAN",
  "REPORT",
  "SOURCE_EXTERNAL",
] as const;

export type RegressionCategory = (typeof REGRESSION_CATEGORIES)[number];

export type RegressionMemoryEntry = {
  id: string;
  category: RegressionCategory;
  /** Semantic failure class — never a tender-specific sentence. */
  failureClass: string;
  expectedCodes: GuardianValidationCode[];
  origin: "TEST_1" | "TEST_2" | "TEST_3" | "STRESS" | "PRODUCTION" | "ARCHITECTURE";
};

/**
 * Authoritative catalog of permanent regression cases.
 * Adding a production incident = add an entry + a builder in regression-memory.test.ts.
 */
export const REGRESSION_MEMORY: readonly RegressionMemoryEntry[] = [
  // DOCUMENT
  {
    id: "doc-unreadable",
    category: "DOCUMENT",
    failureClass: "unreadable_document",
    expectedCodes: ["DOCUMENT_UNREADABLE"],
    origin: "ARCHITECTURE",
  },
  {
    id: "doc-invalid-type",
    category: "DOCUMENT",
    failureClass: "wrong_document_type",
    expectedCodes: ["DOCUMENT_INVALID"],
    origin: "ARCHITECTURE",
  },
  {
    id: "doc-insufficient-text",
    category: "DOCUMENT",
    failureClass: "incomplete_or_ocr_insufficient_text",
    expectedCodes: ["DOCUMENT_INSUFFICIENT_TEXT"],
    origin: "ARCHITECTURE",
  },

  // EXTRACTION
  {
    id: "ext-truncated",
    category: "EXTRACTION",
    failureClass: "truncated_obligation",
    expectedCodes: ["REQUIREMENT_TRUNCATED"],
    origin: "TEST_2",
  },
  {
    id: "ext-duplicate",
    category: "EXTRACTION",
    failureClass: "duplicated_obligation",
    expectedCodes: ["DUPLICATE_SEMANTIC_IDENTITY"],
    origin: "TEST_1",
  },
  {
    id: "ext-false-obligation",
    category: "EXTRACTION",
    failureClass: "false_obligation_qa_meta",
    expectedCodes: ["CANONICAL_QA_META", "CANONICAL_NON_REQUIREMENT"],
    origin: "TEST_2",
  },

  // CLASSIFICATION
  {
    id: "cls-evaluation",
    category: "CLASSIFICATION",
    failureClass: "evaluation_criterion_as_requirement",
    expectedCodes: ["CANONICAL_EVALUATION_LEAK", "CANONICAL_NON_REQUIREMENT"],
    origin: "STRESS",
  },
  {
    id: "cls-deadline",
    category: "CLASSIFICATION",
    failureClass: "deadline_as_requirement",
    expectedCodes: ["CANONICAL_DEADLINE_AS_REQUIREMENT", "CANONICAL_NON_REQUIREMENT"],
    origin: "TEST_1",
  },
  {
    id: "cls-reviewer",
    category: "CLASSIFICATION",
    failureClass: "reviewer_instruction_as_requirement",
    expectedCodes: ["REVIEWER_SCENARIO_LEAK", "CANONICAL_QA_META", "CANONICAL_NON_REQUIREMENT"],
    origin: "STRESS",
  },
  {
    id: "cls-conditional-mandatory",
    category: "CLASSIFICATION",
    failureClass: "conditional_promoted_to_mandatory",
    expectedCodes: ["CONDITIONAL_PROMOTED_TO_MANDATORY"],
    origin: "TEST_2",
  },

  // DATA
  {
    id: "data-timezone",
    category: "DATA",
    failureClass: "wrong_timezone_or_wall_clock",
    expectedCodes: ["DEADLINE_TIME_MUTATED", "DERIVED_FIELD_CONTRADICTS_CANONICAL"],
    origin: "TEST_2",
  },
  {
    id: "data-lost-id",
    category: "DATA",
    failureClass: "lost_requirement_id",
    expectedCodes: ["REQUIREMENT_ID_LOST", "HIGH_RISK_FACT_MUTATED"],
    origin: "TEST_2",
  },
  {
    id: "data-lost-condition",
    category: "DATA",
    failureClass: "lost_conditional_clause",
    expectedCodes: ["REQUIREMENT_CONDITION_LOST"],
    origin: "TEST_2",
  },
  {
    id: "data-wrong-section",
    category: "DATA",
    failureClass: "wrong_source_section",
    expectedCodes: ["REQUIREMENT_PROVENANCE_WRONG"],
    origin: "TEST_2",
  },
  {
    id: "data-missing-commercial",
    category: "DATA",
    failureClass: "missing_commercial_obligation",
    expectedCodes: ["MISSING_COMMERCIAL_OBLIGATION"],
    origin: "STRESS",
  },

  // EVIDENCE
  {
    id: "ev-unsupported-fit",
    category: "EVIDENCE",
    failureClass: "unsupported_confirmed_fit",
    expectedCodes: ["EVIDENCE_MISSING_FOR_CONFIRMED_FIT"],
    origin: "ARCHITECTURE",
  },
  {
    id: "ev-unsupported-gap",
    category: "EVIDENCE",
    failureClass: "unsupported_confirmed_gap",
    expectedCodes: ["EVIDENCE_MISSING_FOR_CONFIRMED_GAP"],
    origin: "ARCHITECTURE",
  },

  // RISK
  {
    id: "risk-verify-as-failure",
    category: "RISK",
    failureClass: "verification_treated_as_high_critical_risk",
    expectedCodes: ["VERIFICATION_ESCALATED_TO_HIGH_RISK"],
    origin: "TEST_1",
  },

  // DECISION
  {
    id: "dec-invalid-nobid",
    category: "DECISION",
    failureClass: "invalid_no_bid_without_blocker",
    expectedCodes: ["DECISION_NO_BID_WITHOUT_BLOCKER"],
    origin: "ARCHITECTURE",
  },
  {
    id: "dec-invalid-bid",
    category: "DECISION",
    failureClass: "invalid_bid_with_confirmed_gap",
    expectedCodes: ["DECISION_BID_WITH_UNRESOLVED_MANDATORY"],
    origin: "ARCHITECTURE",
  },
  {
    id: "dec-ai-override",
    category: "DECISION",
    failureClass: "ai_overriding_canonical_rules",
    expectedCodes: ["DECISION_AI_OVERRIDE", "UNSUPPORTED_AI_CLAIM"],
    origin: "ARCHITECTURE",
  },

  // ACTION PLAN
  {
    id: "act-verify-blocking",
    category: "ACTION_PLAN",
    failureClass: "verification_action_marked_blocking",
    expectedCodes: ["VERIFICATION_MARKED_BLOCKING"],
    origin: "STRESS",
  },
  {
    id: "act-orphan",
    category: "ACTION_PLAN",
    failureClass: "action_referencing_nonexistent_requirement",
    expectedCodes: ["ACTION_CANONICAL_MISMATCH"],
    origin: "STRESS",
  },
  {
    id: "act-count-drift",
    category: "ACTION_PLAN",
    failureClass: "action_count_drift",
    expectedCodes: ["ACTION_CANONICAL_MISMATCH", "COUNT_DRIFT"],
    origin: "STRESS",
  },

  // REPORT
  {
    id: "rep-count-mismatch",
    category: "REPORT",
    failureClass: "web_pdf_count_mismatch",
    expectedCodes: ["COUNT_DRIFT", "REPORT_DATASET_MISMATCH"],
    origin: "TEST_2",
  },
  {
    id: "rep-fit-mismatch",
    category: "REPORT",
    failureClass: "fit_score_mismatch",
    expectedCodes: ["FIT_INCONSISTENCY"],
    origin: "TEST_1",
  },
  {
    id: "rep-stale",
    category: "REPORT",
    failureClass: "stale_report_data",
    expectedCodes: ["STALE_RESULT_MISMATCH"],
    origin: "ARCHITECTURE",
  },
  {
    id: "rep-deadline-mismatch",
    category: "REPORT",
    failureClass: "deadline_web_pdf_mismatch",
    expectedCodes: ["DERIVED_FIELD_CONTRADICTS_CANONICAL"],
    origin: "TEST_2",
  },

  // SOURCE / EXTERNAL
  {
    id: "src-external-overwrite",
    category: "SOURCE_EXTERNAL",
    failureClass: "external_overriding_tender_fact",
    expectedCodes: ["EXTERNAL_OVERWRITE_TENDER_FACT"],
    origin: "ARCHITECTURE",
  },
  {
    id: "src-unsupported-external",
    category: "SOURCE_EXTERNAL",
    failureClass: "unsupported_external_claim",
    expectedCodes: ["EXTERNAL_CLAIM_UNGROUNDED"],
    origin: "ARCHITECTURE",
  },
  {
    id: "src-contradiction",
    category: "SOURCE_EXTERNAL",
    failureClass: "contradictory_source_clauses",
    expectedCodes: ["SOURCE_CONTRADICTION"],
    origin: "ARCHITECTURE",
  },
] as const;

export function regressionMemoryByCategory(
  category: RegressionCategory,
): RegressionMemoryEntry[] {
  return REGRESSION_MEMORY.filter((e) => e.category === category);
}

export function assertRegressionMemoryCoverage(): void {
  for (const cat of REGRESSION_CATEGORIES) {
    const n = regressionMemoryByCategory(cat).length;
    if (n < 1) {
      throw new Error(`Regression memory missing category coverage: ${cat}`);
    }
  }
}
