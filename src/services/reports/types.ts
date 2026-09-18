import type { BidScoreBreakdown } from "@/domain/bid-score";
import type { CompanyTenderFitBreakdown } from "@/domain/decision/company-fit";
import type { TenderReadinessBreakdown } from "@/domain/decision/tender-readiness";
import type {
  CanonicalHistoricalSignal,
  ComplianceSummary,
  TenderIntelligenceBreakdown,
} from "@/domain/tender-intelligence";
import type { DecisionOutcomeView } from "@/domain/decision-outcome-learning";
import type { DecisionType } from "@prisma/client";

export type TenderReport = {
  tenderId: string;
  companyId: string;
  title: string;
  client: string | null;
  deadline: string | null;
  deadlineTimezone: string | null;
  analyzedAt: string | null;
  decision: DecisionType | null;
  fitScore: number | null;
  confidence: string | null;
  reasoning: string | null;
  companyKnowledgeOnly?: boolean;
  /** Dimension scores only — no raw company profile fields. */
  fitBreakdown: CompanyTenderFitBreakdown | null;
  readiness: TenderReadinessBreakdown | null;
  /** Same intelligence snapshot as the tender workspace */
  intelligence: TenderIntelligenceBreakdown | null;
  complianceSummary: ComplianceSummary | null;
  /** Prioritization — not win probability; separate from Bid/No-Bid */
  bidScore: BidScoreBreakdown | null;
  historicalSignals: CanonicalHistoricalSignal[];
  matched: Array<{
    id: string;
    description: string;
    category: string;
    sourcePage: number | null;
    sourceSection: string | null;
  }>;
  failed: Array<{
    id: string;
    description: string;
    category: string;
    sourcePage: number | null;
    sourceSection: string | null;
  }>;
  uncertain: Array<{
    id: string;
    description: string;
    category: string;
    sourcePage: number | null;
    sourceSection: string | null;
  }>;
  criticalRisks: Array<{
    id: string;
    category: string;
    description: string;
    severity: string;
    sourcePage: number | null;
    mitigation: string | null;
  }>;
  missingDocuments: Array<{
    id: string;
    documentName: string;
    reason: string;
    severity: string;
  }>;
  evidence: Array<{
    id: string;
    text: string;
    sourcePage: number | null;
    sourceSection: string | null;
    verificationStatus: string;
  }>;
  nextActions: Array<{
    id: string;
    title: string;
    description: string | null;
    priority: number;
  }>;
  /** Real-world outcome linked to TenderDecision — null when not recorded */
  decisionOutcome: DecisionOutcomeView | null;
};
