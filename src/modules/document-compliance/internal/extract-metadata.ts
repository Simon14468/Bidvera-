/**
 * Fact-only metadata extraction from document text.
 * Never invents expiry dates. Distinguishes expiry vs issue/signature/contract dates.
 * Extraction never executes actions — callers decide what to persist.
 */

import { parseLooseDateOnly } from "./date-only";

export type ExtractionProvenanceEntry = {
  field: string;
  evidence: string;
  confidence: number;
  label?: string;
};

export type ExtractedComplianceMetadata = {
  name: string | null;
  issuingAuthority: string | null;
  documentNumber: string | null;
  issueDate: string | null;
  expiryDate: string | null;
  /** Explicit no-expiry language detected. */
  noExpiry: boolean;
  /** Extraction is too weak to trust for status. */
  uncertain: boolean;
  confidence: number;
  provenance: ExtractionProvenanceEntry[];
};

const EXPIRY_LABEL =
  /\b(valid\s+until|valid\s+thru|valid\s+through|expires?(?:\s+on)?|expiry\s+date|expiration\s+date|date\s+d['']?expiration|valable\s+jusqu['']?\s*au|date\s+d['']?echeance|gültig\s+bis|vencimiento)\b/i;

const ISSUE_LABEL =
  /\b(issue\s+date|issued\s+on|date\s+of\s+issue|date\s+d['']?emission|date\s+d['']?émission|ausstellungsdatum|fecha\s+de\s+emisi[oó]n)\b/i;

const SIGNATURE_LABEL =
  /\b(signature\s+date|signed\s+on|date\s+of\s+signature|date\s+de\s+signature)\b/i;

const CONTRACT_LABEL =
  /\b(contract\s+date|agreement\s+date|effective\s+date|commencement\s+date)\b/i;

const NO_EXPIRY_LABEL =
  /\b(no\s+expiry|does\s+not\s+expire|without\s+expiry|indefinite|permanent\s+certificate|sans\s+date\s+d['']?expiration|sans\s+expiration)\b/i;

const DOC_NUMBER =
  /\b(?:n[oº°]?\.?\s*|number\s*[#:.]?\s*|ref(?:erence)?\s*[#:.]?\s*|n[°º]\s*)([A-Z0-9][A-Z0-9\-/.]{2,})\b/i;

const AUTHORITY =
  /\b(?:issued\s+by|issuing\s+authority|authority|delivered\s+by|délivré\s+par)\s*[:\-]?\s*([^\n]{3,80})/i;

function lineWindow(text: string, index: number, radius = 80): string {
  const start = Math.max(0, index - radius);
  const end = Math.min(text.length, index + radius);
  return text.slice(start, end).replace(/\s+/g, " ").trim();
}

function findLabeledDate(
  text: string,
  labelRe: RegExp,
): { date: string; evidence: string; confidence: number } | null {
  const match = labelRe.exec(text);
  if (!match || match.index == null) return null;
  const afterLabel = text.slice(match.index + match[0].length, match.index + match[0].length + 80);
  const date =
    parseLooseDateOnly(afterLabel) ??
    // Only scan forward from the label — never pick dates that appear before it.
    parseLooseDateOnly(lineWindow(text, match.index + match[0].length, 40));
  if (!date) return null;
  const evidence = lineWindow(text, match.index, 120).slice(0, 160);
  return {
    date,
    evidence,
    confidence: 0.92,
  };
}

/**
 * Pure extraction from already-OCR'd / extracted text.
 * Does not call AI services — only interprets supported text facts.
 */
export function extractComplianceMetadataFromText(
  text: string,
  fileName?: string,
): ExtractedComplianceMetadata {
  const provenance: ExtractionProvenanceEntry[] = [];
  const normalized = text.replace(/\r\n/g, "\n");

  const noExpiry = NO_EXPIRY_LABEL.test(normalized);
  if (noExpiry) {
    provenance.push({
      field: "noExpiry",
      evidence: (normalized.match(NO_EXPIRY_LABEL)?.[0] ?? "no expiry").slice(0, 80),
      confidence: 0.9,
      label: "no_expiry",
    });
  }

  const expiryHit = findLabeledDate(normalized, EXPIRY_LABEL);
  const issueHit = findLabeledDate(normalized, ISSUE_LABEL);
  const signatureHit = findLabeledDate(normalized, SIGNATURE_LABEL);
  const contractHit = findLabeledDate(normalized, CONTRACT_LABEL);

  // Never treat signature/contract dates as expiry.
  let expiryDate: string | null = null;
  if (expiryHit) {
    const confusedWithIssue =
      issueHit && issueHit.date === expiryHit.date && expiryHit.confidence < 0.85;
    if (!confusedWithIssue) {
      expiryDate = expiryHit.date;
      provenance.push({
        field: "expiryDate",
        evidence: expiryHit.evidence,
        confidence: expiryHit.confidence,
        label: "expiry",
      });
    }
  }

  let issueDate: string | null = null;
  if (issueHit) {
    issueDate = issueHit.date;
    provenance.push({
      field: "issueDate",
      evidence: issueHit.evidence,
      confidence: issueHit.confidence,
      label: "issue",
    });
  }

  // If only unlabeled signature/contract dates exist, do not invent expiry.
  if (!expiryDate && (signatureHit || contractHit)) {
    provenance.push({
      field: "expiryDate",
      evidence: (signatureHit ?? contractHit)!.evidence,
      confidence: 0.2,
      label: "non_expiry_date_ignored",
    });
  }

  let documentNumber: string | null = null;
  const num = DOC_NUMBER.exec(normalized);
  if (num?.[1]) {
    documentNumber = num[1].trim();
    provenance.push({
      field: "documentNumber",
      evidence: num[0].slice(0, 80),
      confidence: 0.75,
    });
  }

  let issuingAuthority: string | null = null;
  const auth = AUTHORITY.exec(normalized);
  if (auth?.[1]) {
    issuingAuthority = auth[1].trim().replace(/\s+/g, " ").slice(0, 120);
    provenance.push({
      field: "issuingAuthority",
      evidence: auth[0].slice(0, 120),
      confidence: 0.7,
    });
  }

  const nameFromFile = fileName
    ? fileName.replace(/\.[^.]+$/, "").replace(/[_-]+/g, " ").trim().slice(0, 120)
    : null;
  const name = nameFromFile || null;
  if (name) {
    provenance.push({
      field: "name",
      evidence: fileName ?? name,
      confidence: 0.4,
      label: "filename",
    });
  }

  const hasStrongExpiry = Boolean(expiryHit && expiryDate);
  const uncertain =
    !noExpiry &&
    !hasStrongExpiry &&
    (Boolean(signatureHit || contractHit) ||
      (normalized.length > 40 && !expiryHit && !issueHit));

  // If we found nothing useful and text is empty/short → uncertain
  const empty = normalized.trim().length < 20;
  const finalUncertain = empty || (uncertain && !noExpiry && !expiryDate);

  let confidence = 0.3;
  if (noExpiry) confidence = 0.85;
  if (hasStrongExpiry) confidence = Math.max(confidence, expiryHit!.confidence);
  if (issueDate) confidence = Math.max(confidence, 0.6);
  if (finalUncertain) confidence = Math.min(confidence, 0.45);

  return {
    name,
    issuingAuthority,
    documentNumber,
    issueDate,
    expiryDate: noExpiry ? null : expiryDate,
    noExpiry,
    uncertain: finalUncertain,
    confidence,
    provenance,
  };
}
