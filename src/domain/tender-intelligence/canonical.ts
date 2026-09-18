/**
 * Canonical tender analysis — one source of truth per tender.
 *
 * INVARIANT:
 * - Analysis is company-scoped and tender-scoped only.
 * - User role (OWNER / ADMIN / MEMBER / VIEWER) must NEVER change
 *   requirements, compliance, evidence, sources, risks, clarifications,
 *   fit, readiness, bid recommendation, or historical intelligence signals.
 * - Roles may gate access (view / upload / re-analyze) only.
 * - Do not create persona-specific reports (CEO, Founder, Bid Manager, etc.).
 */

import type { BidScoreBreakdown } from "@/domain/bid-score";
import type { CompanyTenderFitBreakdown } from "@/domain/decision/company-fit";
import type { TenderReadinessBreakdown } from "@/domain/decision/tender-readiness";
import type { TenderIntelligenceBreakdown } from "@/domain/tender-intelligence";
import type {
  ConfidenceLevel,
  DecisionType,
  RequirementMatchStatus,
  RiskSeverity,
} from "@prisma/client";

export type CanonicalRequirement = {
  id: string;
  category: string;
  description: string;
  mandatory: boolean;
  value: string | null;
  status: RequirementMatchStatus;
  sourcePage: number | null;
  sourceSection: string | null;
  evidence: string | null;
  sortOrder: number;
};

export type CanonicalEvidence = {
  id: string;
  requirementId: string | null;
  sourcePage: number | null;
  sourceSection: string | null;
  evidenceText: string;
  verificationStatus: string;
};

export type CanonicalRisk = {
  id: string;
  category: string;
  description: string;
  severity: RiskSeverity;
  sourcePage: number | null;
  mitigation: string | null;
  sortOrder: number;
};

export type CanonicalMissingDocument = {
  id: string;
  documentName: string;
  reason: string;
  severity: RiskSeverity;
  sortOrder: number;
};

export type CanonicalNextAction = {
  id: string;
  title: string;
  description: string | null;
  priority: number;
  completed: boolean;
  sortOrder: number;
};

export type CanonicalHistoricalSignal = {
  id: string;
  kind:
    | "blocker"
    | "contradiction"
    | "clarification"
    | "high_risk"
    | "decision_context"
    | "similar_company_pattern"
    | "decision_memory";
  label: string;
  detail: string | null;
};

/**
 * Single analytical truth for a tender.
 * Identical for every authorized company user who can view it.
 */
export type CanonicalTenderAnalysis = {
  tenderId: string;
  companyId: string;
  title: string;
  client: string | null;
  deadline: string | null;
  deadlineTimezone: string | null;
  analyzedAt: string | null;
  analysisStatus: string;
  documentName: string | null;
  /** Company-private outcome — never shared cross-tenant */
  outcome:
    | "WON"
    | "LOST"
    | "BID_SUBMITTED"
    | "NO_BID_CONFIRMED"
    | "WITHDRAWN"
    | "CANCELLED"
    | "NOT_SUBMITTED"
    | "PENDING"
    | null;

  /** Bid / No-Bid / Review — one recommendation; null for company-knowledge-only. */
  decision: DecisionType | null;
  fitScore: number | null;
  confidence: ConfidenceLevel;
  reasoning: string;
  isAiSuggested: boolean;
  /** True when this row is company knowledge ingest only (no tender scoring). */
  companyKnowledgeOnly?: boolean;

  fitBreakdown: CompanyTenderFitBreakdown | null;
  readiness: TenderReadinessBreakdown | null;
  intelligence: TenderIntelligenceBreakdown;
  /** Prioritization layer — not win probability; separate from Bid/No-Bid */
  bidScore: BidScoreBreakdown;

  requirements: CanonicalRequirement[];
  evidence: CanonicalEvidence[];
  risks: CanonicalRisk[];
  missingDocuments: CanonicalMissingDocument[];
  nextActions: CanonicalNextAction[];

  /** Package inventory from the frozen snapshot (every discovered file). */
  packageFiles?: Array<{
    fileName: string;
    processingStatus: string;
    role: string | null;
    error: string | null;
  }>;
  canonicalRequirementCount?: number;

  /**
   * Stable signals derived from the same intelligence snapshot.
   * Not personalized by viewer role.
   */
  historicalSignals: CanonicalHistoricalSignal[];
};

/** Build historical signals from the stored intelligence bundle only. */
export function buildHistoricalSignals(
  intelligence: TenderIntelligenceBreakdown,
): CanonicalHistoricalSignal[] {
  const signals: CanonicalHistoricalSignal[] = [];

  for (const [i, blocker] of intelligence.keyBlockers.entries()) {
    signals.push({
      id: `hist-blocker-${i}`,
      kind: "blocker",
      label: blocker,
      detail: null,
    });
  }

  for (const c of intelligence.contradictions) {
    signals.push({
      id: `hist-con-${c.id}`,
      kind: "contradiction",
      label: c.title,
      detail: c.description,
    });
  }

  for (const q of intelligence.clarificationQuestions) {
    signals.push({
      id: `hist-q-${q.id}`,
      kind: "clarification",
      label: q.question,
      detail: q.reason,
    });
  }

  for (const r of intelligence.risks.filter((x) => x.severity === "HIGH")) {
    signals.push({
      id: `hist-risk-${r.id}`,
      kind: "high_risk",
      label: r.title,
      detail: r.explanation,
    });
  }

  if (intelligence.decisionContext.trim()) {
    signals.push({
      id: "hist-decision-context",
      kind: "decision_context",
      label: "Canonical decision context",
      detail: intelligence.decisionContext,
    });
  }

  const learning = intelligence.learningSignal;
  if (learning?.detected) {
    signals.push({
      id: "hist-similar-company",
      kind: "similar_company_pattern",
      label: learning.headline,
      detail: learning.influenceAllowed
        ? "Additional signal only — not a guarantee of success or failure."
        : learning.suppressedReason ??
          "Current tender evidence takes priority over this historical signal.",
    });
  }

  const memory = intelligence.decisionMemoryInsights;
  if (memory?.matches?.length) {
    for (const m of memory.matches) {
      signals.push({
        id: `hist-decision-memory-${m.memoryId}`,
        kind: "decision_memory",
        label: `Historical Decision (${m.decisionLabel}): ${m.title}`,
        detail: `${m.relevanceReasons.join("; ")}. ${m.disclaimer}`,
      });
    }
  }

  return signals;
}
