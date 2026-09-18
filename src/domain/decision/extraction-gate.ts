import type { BidScoreBreakdown } from "@/domain/bid-score";
import type { TenderIntelligenceBreakdown, ExtractionGateState } from "@/domain/tender-intelligence";
import type { CompanyTenderFitBreakdown } from "./company-fit";
import type { TenderReadinessBreakdown } from "./tender-readiness";

import type { PackageCompletenessReason } from "@/domain/tender-package";

export type ExtractionGateReason =
  | "EXTRACTION_FAILED"
  | "EXTRACTION_UNRELIABLE"
  | "NO_RELIABLE_REQUIREMENTS"
  | "NOT_A_TENDER_DOCUMENT"
  | "ONLY_AVIS"
  | "CPS_MISSING"
  | "TECHNICAL_SPECIFICATION_MISSING"
  | "PACKAGE_INCOMPLETE"
  | "PACKAGE_TEXT_TRUNCATED"
  | "DOCUMENT_UNREADABLE"
  | "INTAKE_BLOCKED"
  | "INTAKE_NO_READABLE_DOCS";

export type { ExtractionGateState };

export const EXTRACTION_BLOCKED_HEADLINE =
  "This is not a completed tender analysis — the tender package is incomplete or requirement extraction did not produce reliable tender requirements.";

export function messageForExtractionGateReason(reason: ExtractionGateReason): string {
  switch (reason) {
    case "EXTRACTION_FAILED":
      return "Tender document extraction failed or could not be read reliably. Decision scores were not calculated.";
    case "EXTRACTION_UNRELIABLE":
      return "Tender package text was too limited or unreliable for requirement extraction. Decision scores were not calculated.";
    case "NO_RELIABLE_REQUIREMENTS":
      return "No reliable tender requirements could be extracted from this package. Decision scores were not calculated.";
    case "NOT_A_TENDER_DOCUMENT":
      return "This file does not appear to be a valid tender or procurement document (RFP, ITT, RFQ, CPS, or tender pack). Bidvera did not analyze it as a bid opportunity.";
    case "ONLY_AVIS":
      return "Only a tender notice (Avis / Iklan / Notice) was available. CPS / technical specifications are missing — Fit, Compliance, Bid Score and Bid/No-Bid were not calculated.";
    case "CPS_MISSING":
      return "CPS (Cahier des prescriptions spéciales) is missing from the tender package. Decision scores were not calculated.";
    case "TECHNICAL_SPECIFICATION_MISSING":
      return "Technical specifications are missing from the tender package. Decision scores were not calculated.";
    case "PACKAGE_INCOMPLETE":
      return "Tender package is incomplete for decision analysis. Upload the full tender pack (notice + CPS / RFP / technical specifications).";
    case "PACKAGE_TEXT_TRUNCATED":
      return "Package or document text was truncated by the source, parser, or OCR. Decision scores were not calculated.";
    case "DOCUMENT_UNREADABLE":
      return "Tender document text could not be read reliably. Decision scores were not calculated.";
    case "INTAKE_BLOCKED":
      return "Universal Intake blocked this package. Resolve file/package issues before a Bid / No-Bid decision can be produced.";
    case "INTAKE_NO_READABLE_DOCS":
      return "No readable tender documents survived Universal Intake. Decision scores were not calculated.";
  }
}

export function mapPackageReasonToGateReason(
  reason: PackageCompletenessReason,
): ExtractionGateReason {
  switch (reason) {
    case "ONLY_AVIS":
      return "ONLY_AVIS";
    case "CPS_MISSING":
      return "CPS_MISSING";
    case "TECHNICAL_SPECIFICATION_MISSING":
      return "TECHNICAL_SPECIFICATION_MISSING";
    case "PACKAGE_INCOMPLETE":
      return "PACKAGE_INCOMPLETE";
    case "PACKAGE_TEXT_TRUNCATED":
      return "PACKAGE_TEXT_TRUNCATED";
    case "EXTRACTION_FAILED":
      return "EXTRACTION_FAILED";
    case "DOCUMENT_UNREADABLE":
      return "DOCUMENT_UNREADABLE";
    case "NO_RELIABLE_REQUIREMENTS":
      return "NO_RELIABLE_REQUIREMENTS";
    case "PACKAGE_COMPLETE":
    case "SINGLE_DOCUMENT_SUBSTANTIVE":
      return "NO_RELIABLE_REQUIREMENTS";
  }
}

export function evaluateRequirementExtractionGate(input: {
  reliableRequirementCount: number;
  packageTextLength: number;
  extractionUnreliable?: boolean;
  /** When set, package completeness overrides bare requirement-count messaging. */
  packageBlockedReason?: ExtractionGateReason | null;
  packageBlockedMessage?: string | null;
}): ExtractionGateState & { reason: ExtractionGateReason | null } {
  if (input.extractionUnreliable) {
    return {
      status: "blocked",
      reason: "EXTRACTION_UNRELIABLE",
      message: messageForExtractionGateReason("EXTRACTION_UNRELIABLE"),
    };
  }
  if (input.packageTextLength > 0 && input.packageTextLength < 400) {
    return {
      status: "blocked",
      reason: "DOCUMENT_UNREADABLE",
      message: messageForExtractionGateReason("DOCUMENT_UNREADABLE"),
    };
  }
  if (input.packageBlockedReason) {
    return {
      status: "blocked",
      reason: input.packageBlockedReason,
      message:
        input.packageBlockedMessage ??
        messageForExtractionGateReason(input.packageBlockedReason),
    };
  }
  if (input.reliableRequirementCount <= 0) {
    return {
      status: "blocked",
      reason: "NO_RELIABLE_REQUIREMENTS",
      message: messageForExtractionGateReason("NO_RELIABLE_REQUIREMENTS"),
    };
  }
  return { status: "valid", reason: null, message: null };
}

export function isScoringBlocked(
  fitBreakdown: CompanyTenderFitBreakdown | null | undefined,
): boolean {
  return fitBreakdown?.scoringAvailable === false;
}

export function displayFitScore(input: {
  fitScore: number | null | undefined;
  fitBreakdown: CompanyTenderFitBreakdown | null | undefined;
}): number | null {
  if (isScoringBlocked(input.fitBreakdown)) return null;
  return input.fitScore ?? null;
}

export function buildExtractionBlockedAnalysis(input: {
  reason: ExtractionGateReason;
  message?: string;
  packageLabel?: string;
}): {
  decision: "REVIEW";
  confidence: "LOW";
  reasoning: string;
  fitScoreDb: number;
  fitBreakdown: CompanyTenderFitBreakdown;
  readiness: TenderReadinessBreakdown;
  intelligence: TenderIntelligenceBreakdown;
  bidScore: BidScoreBreakdown;
} {
  const detail = input.message ?? messageForExtractionGateReason(input.reason);
  const reasoning = `${EXTRACTION_BLOCKED_HEADLINE}\n\n${detail}`;

  const fitBreakdown: CompanyTenderFitBreakdown = {
    scoringAvailable: false,
    overall: null,
    dimensions: [],
    matches: [],
    gaps: [],
    unknowns: [detail],
    attention: [EXTRACTION_BLOCKED_HEADLINE],
    recommendation:
      input.reason === "ONLY_AVIS" || input.reason === "CPS_MISSING"
        ? "Upload the CPS / technical specifications (with the notice if available) to run Bidvera decision analysis."
        : input.reason === "INTAKE_BLOCKED" || input.reason === "INTAKE_NO_READABLE_DOCS"
          ? "Resolve Universal Intake file/package issues (password, recovery, unsupported, or corrupted members). Analysis remains REVIEW_REQUIRED / ANALYSIS_INCOMPLETE until readable documents are available."
          : "Upload a clearer tender package (notice + CPS / RFP / technical specifications) or re-run analysis after extraction succeeds.",
  };

  const readiness: TenderReadinessBreakdown = {
    scoringAvailable: false,
    score: null,
    total: 0,
    counts: {
      ready: 0,
      missing: 0,
      verify: 0,
      unknown: 0,
      notApplicable: 0,
    },
    items: [],
    attention: [detail],
    recommendation:
      "Tender readiness is unavailable until reliable requirements are extracted.",
    disclaimer:
      "Tender Readiness: UNAVAILABLE — not scored because requirement extraction did not complete.",
  };

  const intelligence: TenderIntelligenceBreakdown = {
    complianceStatus: "INCOMPLETE",
    extractionGate: {
      status: "blocked",
      reason: input.reason,
      message: detail,
    },
    complianceMatrix: [],
    complianceSummary: {
      totalRequirements: 0,
      ready: 0,
      missing: 0,
      verify: 0,
      notApplicable: 0,
      unknown: 0,
      sources: 0,
      risks: 0,
      requiredActions: 0,
      clarifications: 0,
    },
    risks: [],
    contradictions: [],
    clarificationQuestions: [],
    keyBlockers: [EXTRACTION_BLOCKED_HEADLINE, detail],
    decisionContext: reasoning,
    learningSignal: null,
  };

  const bidScore: BidScoreBreakdown = {
    scoringAvailable: false,
    score: 0,
    priority: "VERY_LOW",
    priorityLabel: "UNAVAILABLE",
    interpretation: detail,
    expectedValue: "UNKNOWN",
    expectedValueNote:
      "Expected Value: UNKNOWN — tender requirement extraction did not complete; no financial forecast was invented.",
    contractValue: null,
    contractValueLabel: "Contract value: Unknown — not scored (extraction incomplete).",
    contractValueProvenance: "UNKNOWN",
    pursuitCost: null,
    pursuitCostLabel: "Pursuit cost: Unknown — not scored (extraction incomplete).",
    pursuitCostProvenance: "UNKNOWN",
    winProbabilityLabel: "Win probability: Not available — not a scored analysis.",
    winProbabilityProvenance: "UNKNOWN",
    effort: "UNKNOWN",
    effortNote: "Effort: Unknown — requirement extraction did not complete.",
    riskLevel: "UNKNOWN",
    drivers: [],
    reducedCertainty: true,
    certaintyNote: "Bid Score: UNAVAILABLE — scoring was blocked because tender requirements could not be extracted.",
    disclaimer:
      "This prioritization score was not calculated. Do not use this report as a completed bid decision.",
  };

  return {
    // DB placeholder only — canonical read path exposes decision=null when scoring blocked.
    decision: "REVIEW",
    confidence: "LOW",
    reasoning,
    fitScoreDb: 0,
    fitBreakdown,
    readiness,
    intelligence,
    bidScore,
  };
}
