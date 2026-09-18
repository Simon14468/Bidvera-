/**
 * Deterministic gate: is this document a tender/procurement package Bidvera can analyze?
 * Runs before expensive AI extraction — no tokens spent on clearly unsuitable files.
 */

import { classifyDocument } from "@/domain/company-knowledge/classify";
import type { TenderDocumentRole } from "@/domain/tender-package";

export type TenderValidityReason =
  | "VALID"
  | "NOT_A_TENDER_DOCUMENT"
  | "UNREADABLE"
  | "COMPANY_PROFILE_ONLY";

export type TenderValidityResult = {
  valid: boolean;
  reason: TenderValidityReason;
  /** English fallback — UI should prefer i18n via reason code when available. */
  message: string;
  confidence: number;
  signals: string[];
};

const ANTI_TENDER_STRONG =
  /\b(invoice|tax\s+invoice|receipt|payslip|pay\s+slip|salary\s+slip|curriculum\s+vitae|\bcv\b|resume|r[eé]sum[eé]|bank\s+statement|utility\s+bill|marketing\s+brochure|product\s+catalogue|user\s+manual|installation\s+guide|meeting\s+minutes|internal\s+memo|newsletter|press\s+release|social\s+media\s+post|personal\s+letter|cover\s+letter|unrelated\s+to\s+procurement)\b/i;

const ANTI_TENDER_MODERATE =
  /\b(terms\s+and\s+conditions\s+of\s+sale|privacy\s+policy|cookie\s+policy|annual\s+report|financial\s+statements\s+only|balance\s+sheet\s+only)\b/i;

const TENDER_PROCUREMENT =
  /\b(invitation\s+to\s+tender|request\s+for\s+(?:proposal|quotation|tender)|\bitt\b|\brfp\b|\brfq\b|\brft\b|appel\s+d['']offres|cahier\s+des\s+(?:prescriptions|charges)|avis\s+d['']appel|kenyataan\s+tender|e-?perolehan|soumissionnaires?|bid\s+der(?:er|ors?)|tender\s+document|procurement|public\s+tender|contract\s+notice|specification\s+of\s+requirements)\b/i;

const BIDDER_OBLIGATION_DENSITY =
  /\b(must|shall|obligatoire|mandatory|required|devra|doit|fournir|submit|soumettre|installer|livrer)\b/gi;

function countMatches(text: string, pattern: RegExp): number {
  const m = text.match(pattern);
  return m?.length ?? 0;
}

/**
 * Evaluate whether extracted text represents analyzable tender/procurement content.
 */
export function evaluateTenderDocumentValidity(input: {
  text: string;
  fileName: string;
  documentKinds?: string[];
  packageRoles?: TenderDocumentRole[];
}): TenderValidityResult {
  const text = input.text;
  const trimmed = text.replace(/\s+/g, " ").trim();

  if (trimmed.length < 80) {
    return {
      valid: false,
      reason: "UNREADABLE",
      message:
        "The uploaded file does not contain enough readable text to analyze as a tender document.",
      confidence: 90,
      signals: ["text_too_short"],
    };
  }

  const classification = classifyDocument({
    text,
    fileName: input.fileName,
  });

  const roles = input.packageRoles ?? [];
  const hasProcurementRole = roles.some((r) =>
    ["AVIS", "CPS", "RFP", "TECHNICAL_SPEC", "FINANCIAL", "CONTRACT"].includes(r),
  );

  const tenderMarkers = countMatches(trimmed, TENDER_PROCUREMENT);
  const obligationHits = countMatches(trimmed, BIDDER_OBLIGATION_DENSITY);
  const antiStrong = ANTI_TENDER_STRONG.test(trimmed);
  const antiModerate = ANTI_TENDER_MODERATE.test(trimmed) && tenderMarkers === 0;

  const kinds = input.documentKinds ?? [];
  const allCompanyProfile =
    kinds.length > 0 && kinds.every((k) => k === "COMPANY_PROFILE" || k === "SUPPORTING_EVIDENCE");

  if (allCompanyProfile || (classification.kind === "COMPANY_PROFILE" && classification.confidence >= 55 && tenderMarkers === 0)) {
    return {
      valid: false,
      reason: "COMPANY_PROFILE_ONLY",
      message:
        "This file appears to be company profile or supporting evidence, not a tender document. Upload an ITT, RFP, RFQ, or full tender pack to run decision analysis.",
      confidence: classification.confidence,
      signals: [...classification.signals, "company_profile_only"],
    };
  }

  // Clear non-tender document with no procurement signals
  if ((antiStrong || antiModerate) && tenderMarkers === 0 && obligationHits < 2 && !hasProcurementRole) {
    return {
      valid: false,
      reason: "NOT_A_TENDER_DOCUMENT",
      message:
        "This file does not appear to be a valid tender or procurement document (RFP, ITT, RFQ, CPS, or tender pack). Bidvera did not analyze it as a bid opportunity.",
      confidence: 85,
      signals: [...classification.signals, antiStrong ? "anti_tender_strong" : "anti_tender_moderate"],
    };
  }

  // Low-confidence UNKNOWN with no procurement language and no obligations
  if (
    classification.kind === "UNKNOWN" &&
    classification.confidence < 40 &&
    tenderMarkers === 0 &&
    obligationHits < 1 &&
    !hasProcurementRole
  ) {
    return {
      valid: false,
      reason: "NOT_A_TENDER_DOCUMENT",
      message:
        "Bidvera could not identify tender or procurement content in this document. Please upload an ITT, RFP, RFQ, or complete tender package.",
      confidence: classification.confidence,
      signals: [...classification.signals, "unknown_no_procurement"],
    };
  }

  return {
    valid: true,
    reason: "VALID",
    message: "",
    confidence: Math.max(classification.confidence, tenderMarkers > 0 ? 60 : 40),
    signals: classification.signals,
  };
}
