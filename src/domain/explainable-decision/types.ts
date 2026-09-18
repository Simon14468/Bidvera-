/**
 * Explainable Decision — structured types derived from canonical decision inputs.
 * Read-only projection; never a second Decision Engine.
 */

import type { TenderDecisionLabel } from "@/domain/decision/labels";
import type { ConfidenceLevel, DecisionType } from "@prisma/client";

export type ExplanationCategory =
  | "POSITIVE_FACTOR"
  | "NEGATIVE_FACTOR"
  | "BLOCKER"
  | "REQUIREMENT"
  | "MISSING_EVIDENCE"
  | "UNVERIFIED_EVIDENCE"
  | "RISK"
  | "COMPANY_FIT"
  | "READINESS"
  | "DEADLINE"
  | "HISTORICAL_SIGNAL"
  | "UNKNOWN"
  | "RECOMMENDED_ACTION"
  | "REVIEW_ITEM"
  | "DECISION_DRIVER";

export type ExplanationImpactRole =
  | "DIRECT_DECISION_DRIVER"
  | "CONTRIBUTING_FACTOR"
  | "CONTEXT_ONLY";

export type ExplanationConfidence = "HIGH" | "MEDIUM" | "LOW" | "UNKNOWN";

export type ExplanationSourceKind =
  | "TENDER_DOCUMENT"
  | "COMPANY_EVIDENCE"
  | "DECISION_ENGINE"
  | "RULE"
  | "READINESS"
  | "RISK"
  | "DECISION_MEMORY"
  | "UNKNOWN";

export type ExplanationSourceRef = {
  kind: ExplanationSourceKind;
  label: string;
  documentName: string | null;
  page: number | null;
  section: string | null;
  excerpt: string | null;
  located: boolean;
};

export type ExplainableDecisionItem = {
  id: string;
  category: ExplanationCategory;
  impactRole: ExplanationImpactRole;
  what: string;
  why: string;
  reasonCode: string | null;
  status: string | null;
  impact: string;
  source: ExplanationSourceRef;
  requirementId: string | null;
  evidenceId: string | null;
  riskId: string | null;
  confidence: ExplanationConfidence;
  referenceOnly: boolean;
};

export type ExplainableDecisionExecutiveSummary = {
  decision: DecisionType;
  displayLabel: TenderDecisionLabel;
  confidence: ConfidenceLevel;
  whyHeadline: string;
  /** Confirmed hard blockers only */
  blockerCount: number;
  hardBlockerCount: number;
  /**
   * Count of highlighted decision-driver / review-item rows in the explanation.
   * Never substitute this for the canonical requirement total.
   */
  reviewItemCount: number;
  /** Authoritative canonical requirement set size. */
  canonicalTotalRequirements: number;
  /** Canonical VERIFY + UNKNOWN partition — global verification metric. */
  canonicalNeedsVerification: number;
  topBlockers: string[];
  positiveSummary: string | null;
};

export type ExplainableDecisionSections = {
  keyReasons: ExplainableDecisionItem[];
  requirements: ExplainableDecisionItem[];
  evidence: ExplainableDecisionItem[];
  risks: ExplainableDecisionItem[];
  companyFit: ExplainableDecisionItem[];
  readiness: ExplainableDecisionItem[];
  historicalSignals: ExplainableDecisionItem[];
  unknowns: ExplainableDecisionItem[];
  actions: ExplainableDecisionItem[];
};

export type ExplainableDecision = {
  computed: true;
  decision: DecisionType;
  displayLabel: TenderDecisionLabel;
  confidence: ConfidenceLevel;
  hardFailure: boolean;
  deterministic: boolean;
  executiveSummary: ExplainableDecisionExecutiveSummary;
  items: ExplainableDecisionItem[];
  sections: ExplainableDecisionSections;
  contentHash: string;
  disclaimer: string;
  missingDataNotes: string[];
};

export const EXPLAINABLE_DECISION_DISCLAIMER =
  "This explanation is derived from canonical Bidvera analysis only. Unknown facts remain unknown. Decision Memory is historical context — not proof for the current tender.";

export const INSUFFICIENT_DATA = "INSUFFICIENT_DATA";
