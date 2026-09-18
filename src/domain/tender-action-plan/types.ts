/**
 * Tender Action Plan — traceable actions derived from canonical tender state.
 * Not a generic task list, chatbot, or second decision engine.
 */

import type { CompanyTenderFitBreakdown } from "@/domain/decision/company-fit";
import type { TenderReadinessBreakdown } from "@/domain/decision/tender-readiness";
import type { TenderDecisionRecommendation } from "@/domain/decision/recommendation";
import type { EvidenceIntelligenceBundle } from "@/domain/evidence-intelligence";
import type {
  ComplianceRow,
  StructuredRisk,
  TenderIntelligenceBreakdown,
} from "@/domain/tender-intelligence/types";
import type { TeamWorkflowTaskStatus } from "@prisma/client";

export type TenderActionSourceType =
  | "MISSING_MANDATORY_REQUIREMENT"
  | "MISSING_EVIDENCE"
  | "UNVERIFIED_EVIDENCE"
  | "EXPIRED_EVIDENCE"
  | "FAILED_VERIFICATION"
  | "UNRESOLVED_RISK"
  | "COMPANY_FIT_GAP"
  | "READINESS_BLOCKER"
  | "TEAM_VERIFICATION_TASK"
  | "APPROACHING_DEADLINE"
  | "DECISION_SIMULATOR"
  | "DECISION_BLOCKER";

export type TenderActionCategory =
  | "REQUIREMENT"
  | "EVIDENCE"
  | "VERIFICATION"
  | "RISK"
  | "READINESS"
  | "COMPANY_FIT"
  | "TEAM"
  | "DEADLINE"
  | "DECISION"
  | "SIMULATION";

export type TenderActionPriority = "CRITICAL" | "HIGH" | "MEDIUM" | "LOW";

export type TenderActionStatus =
  | "OPEN"
  | "IN_PROGRESS"
  | "EVIDENCE_SUBMITTED"
  | "AWAITING_VERIFICATION"
  | "COMPLETED"
  | "BLOCKED"
  | "CANCELLED";

export type TenderActionItem = {
  id: string;
  title: string;
  description: string;
  category: TenderActionCategory;
  priority: TenderActionPriority;
  sourceType: TenderActionSourceType;
  sourceId: string;
  linkedRequirementId: string | null;
  /** Complete canonical requirement text when linked — never truncated. */
  requirementText: string | null;
  linkedEvidenceId: string | null;
  linkedRiskId: string | null;
  linkedTeamTaskId: string | null;
  ownerLabel: string | null;
  dueDate: string | null;
  status: TenderActionStatus;
  blocking: boolean;
  expectedOutcome: string;
  verificationRequired: boolean;
  /** WHY is this needed? */
  whyNeeded: string;
  /** Human-readable source trace (requirement / risk / evidence). */
  sourceTrace: string;
  /** What happens after completion — never direct decision change. */
  afterCompletion: string;
  /** True for Decision Simulator projections only. */
  simulationOnly: boolean;
  createdAt: string;
  updatedAt: string;
};

export type TenderActionPlanSummary = {
  total: number;
  open: number;
  critical: number;
  blocking: number;
  simulationOnly: number;
  byCategory: Partial<Record<TenderActionCategory, number>>;
};

export type TenderActionDeadlineUrgency = {
  tenderDeadline: string | null;
  daysRemaining: number | null;
  urgencyNote: string | null;
};

export type TenderActionPlanBundle = {
  computed: true;
  items: TenderActionItem[];
  summary: TenderActionPlanSummary;
  deadlineUrgency: TenderActionDeadlineUrgency;
  disclaimer: string;
  contentHash: string;
};

export type TenderActionTeamTaskRef = {
  id: string;
  title: string;
  status: TeamWorkflowTaskStatus;
  priority: string;
  requirementId: string | null;
  riskId: string | null;
  missingDocId: string | null;
  department: string | null;
  deadline: Date | null;
};

export type TenderActionSimulationHint = {
  id: string;
  label: string;
  currentDecisionLabel: string;
  projectedDecisionLabel: string;
  requirementId?: string | null;
  evidenceId?: string | null;
};

export type BuildTenderActionPlanInput = {
  tenderId: string;
  companyId: string;
  tenderDeadline: Date | null;
  complianceMatrix: ComplianceRow[];
  evidenceIntelligence: EvidenceIntelligenceBundle | null | undefined;
  risks: StructuredRisk[];
  keyBlockers: string[];
  readiness: Pick<TenderReadinessBreakdown, "attention" | "items">;
  fitBreakdown: CompanyTenderFitBreakdown | null | undefined;
  recommendation: TenderDecisionRecommendation | null | undefined;
  teamTasks: TenderActionTeamTaskRef[];
  simulationHints?: TenderActionSimulationHint[];
  /** Prior plan for idempotent re-analysis and stale resolution. */
  previousPlan?: TenderActionPlanBundle | null;
  asOf?: Date;
};

export const TENDER_ACTION_PLAN_DISCLAIMER =
  "Action Plan items are derived from unresolved tender requirements, evidence, risks, and readiness gaps. Completing an action does not change the decision directly — evidence must be verified and the Decision Engine re-run through the canonical flow.";

export const AFTER_COMPLETION_STANDARD =
  "Submit or verify evidence → update requirement state → recalculate readiness → re-run Decision Engine through the existing canonical flow.";

export type TenderIntelligenceWithActionPlan = TenderIntelligenceBreakdown & {
  actionPlan?: TenderActionPlanBundle | null;
};
