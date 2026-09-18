import type { RequirementMatchStatus } from "@prisma/client";
import type { CompanyTenderFitBreakdown } from "./company-fit";
import type { RuleRequirement } from "./types";
import { mapFitStatusToReadiness } from "./requirement-fit-status";

export type ReadinessStatus =
  | "READY"
  | "MISSING"
  | "VERIFY"
  | "NOT_APPLICABLE"
  | "UNKNOWN";

export type ReadinessPriority = "HIGH" | "MEDIUM" | "LOW";

export type ReadinessItem = {
  id: string;
  requirement: string;
  category: string;
  status: ReadinessStatus;
  priority: ReadinessPriority;
  reason: string;
  source: string;
  mandatory: boolean;
};

export type TenderReadinessBreakdown = {
  /** When false, readiness score must not be calculated or displayed as a percentage. */
  scoringAvailable?: boolean;
  /** True when only company knowledge was ingested — not a tender analysis. */
  companyKnowledgeOnly?: boolean;
  /** 0–100 when at least one identifiable requirement exists; null otherwise */
  score: number | null;
  /**
   * Canonical requirement count — equals `#requirements` / compliance matrix length.
   * Never includes MissingDocument gap rows (those live in Missing documents).
   */
  total: number;
  /** Alias of `total` for report-consistency contracts. */
  totalRequirements?: number;
  /**
   * Status tallies over canonical requirement items only (not missing documents).
   * Must match intelligence.complianceSummary ready/missing/verify/unknown/notApplicable.
   */
  counts: {
    ready: number;
    missing: number;
    verify: number;
    unknown: number;
    notApplicable: number;
  };
  /** One row per canonical tender requirement — never missing-document stubs. */
  items: ReadinessItem[];
  attention: string[];
  recommendation: string;
  /** Short disclaimer for UI */
  disclaimer: string;
};

export type MissingDocInput = {
  id: string;
  documentName: string;
  reason: string;
  severity: string;
};

function isSensitiveDoc(name: string, reason: string): boolean {
  return /\b(financial\s+statement|bank\s+statement|tax\s+return|passport|national\s+id|ssn|salary|payroll)\b/i.test(
    `${name} ${reason}`,
  );
}

/**
 * Priority only from explicit tender signals (mandatory / eligibility).
 * Do not invent priority.
 */
function priorityFor(mandatory: boolean, category: string): ReadinessPriority {
  if (mandatory) return "HIGH";
  if (/\b(MANDATORY_ELIGIBILITY|MANDATORY_TECHNICAL|eligibility|disqualif|mandatory|must)\b/i.test(category))
    return "HIGH";
  if (/\b(MANDATORY_ADMINISTRATIVE)\b/i.test(category)) return "HIGH";
  if (/\b(PREFERRED|evaluation|scoring|award|preferred)\b/i.test(category)) return "MEDIUM";
  if (/\b(CONTRACTUAL)\b/i.test(category)) return "MEDIUM";
  return "LOW";
}

function mapMatchStatus(
  status: RequirementMatchStatus,
  profileSparseSignals: boolean,
): ReadinessStatus {
  switch (status) {
    case "MATCHED":
      return "READY";
    case "FAILED":
      return "MISSING";
    case "UNCERTAIN":
      return "VERIFY";
    case "MISSING":
      // Engine "MISSING" = requirement noted but not evidenced — verify, not invent
      return profileSparseSignals ? "UNKNOWN" : "VERIFY";
    default:
      return "UNKNOWN";
  }
}

function reasonForRequirement(input: {
  status: ReadinessStatus;
  description: string;
  category: string;
  mandatory: boolean;
  value: string | null;
  evidence: string | null | undefined;
}): string {
  const label = input.description.trim() || input.category;
  switch (input.status) {
    case "READY":
      return `Based on the information provided, this requirement appears satisfied${
        input.evidence ? ` (${input.evidence.slice(0, 120)})` : ""
      }.`;
    case "MISSING":
      return `The tender requires "${label}", but no matching information is available in what was provided to Bidvera.`;
    case "VERIFY":
      return `The tender requires "${label}". Your company profile does not contain enough information for Bidvera to confirm this confidently — verification needed.`;
    case "UNKNOWN":
      return `There is not enough information to determine readiness for "${label}".`;
    case "NOT_APPLICABLE":
      return `Based on available information, this requirement does not appear to apply.`;
  }
}

function sourceFor(status: ReadinessStatus, hasProfileSignal: boolean): string {
  if (status === "READY" && hasProfileSignal) return "Tender + Company Profile";
  if (status === "READY") return "Tender requirement";
  if (status === "MISSING" || status === "VERIFY") {
    return hasProfileSignal ? "Tender + Company Profile" : "Tender requirement";
  }
  if (status === "UNKNOWN") return "Insufficient information";
  return "Tender requirement";
}

/**
 * Deterministic tender readiness / gap analysis.
 * Reuses engine requirement statuses — does not invent company facts.
 */
export function computeTenderReadiness(input: {
  requirements: RuleRequirement[];
  missingDocuments?: MissingDocInput[];
  fit?: CompanyTenderFitBreakdown | null;
  profileHasAnyCapability?: boolean;
}): TenderReadinessBreakdown {
  const profileSignal = input.profileHasAnyCapability ?? false;
  /** Canonical requirement rows only — shared with compliance matrix. */
  const items: ReadinessItem[] = [];
  /**
   * Missing-document gaps still influence the readiness *score* (unchanged weights),
   * but are never counted or listed as requirements (they have their own section).
   */
  const documentGapItems: ReadinessItem[] = [];

  for (const req of input.requirements) {
    const id = req.id ?? `req-${items.length}`;

    // Procedural / informational rows are not scored as readiness gaps
    if (/^INFORMATIONAL$/i.test(req.category)) {
      items.push({
        id,
        requirement: req.description,
        category: req.category,
        status: "NOT_APPLICABLE",
        priority: "LOW",
        reason: "Informational / procedural tender content — not treated as a scored compliance requirement.",
        source: "Tender requirement",
        mandatory: false,
      });
      continue;
    }

    let status: ReadinessStatus;

    if (req.fitStatus) {
      status = mapFitStatusToReadiness(req.fitStatus);
      // Sparse profile + optional requirement — insufficient signal to verify
      if (
        req.fitStatus === "NEEDS_VERIFICATION" &&
        !profileSignal &&
        !req.mandatory
      ) {
        status = "UNKNOWN";
      }
    } else {
      status = mapMatchStatus(req.status, !profileSignal);
    }

    // Optional / non-mandatory soft requirements with no profile data stay UNKNOWN, not MISSING
    if (
      !req.fitStatus &&
      !req.mandatory &&
      (req.status === "MISSING" || req.status === "UNCERTAIN") &&
      !profileSignal
    ) {
      status = "UNKNOWN";
    }

    items.push({
      id,
      requirement: req.description,
      category: req.category,
      status,
      priority: priorityFor(req.mandatory, `${req.category} ${req.description}`),
      reason: reasonForRequirement({
        status,
        description: req.description,
        category: req.category,
        mandatory: req.mandatory,
        value: req.value,
        evidence: req.evidence,
      }),
      source: sourceFor(status, profileSignal),
      mandatory: req.mandatory,
    });
  }

  for (const doc of input.missingDocuments ?? []) {
    const sensitive = isSensitiveDoc(doc.documentName, doc.reason);
    const high =
      doc.severity === "HIGH" || doc.severity === "CRITICAL";
    documentGapItems.push({
      id: doc.id,
      requirement: doc.documentName,
      category: "document",
      status: "VERIFY",
      priority: high ? "HIGH" : "MEDIUM",
      reason: sensitive
        ? `${doc.documentName} required — document verification needed. Bidvera does not ask you to enter sensitive financial or personal details here.`
        : `The tender references "${doc.documentName}". ${doc.reason || "Document verification needed before submission."}`,
      source: "Tender requirement",
      mandatory: high,
    });
  }

  const counts = {
    ready: items.filter((i) => i.status === "READY").length,
    missing: items.filter((i) => i.status === "MISSING").length,
    verify: items.filter((i) => i.status === "VERIFY").length,
    unknown: items.filter((i) => i.status === "UNKNOWN").length,
    notApplicable: items.filter((i) => i.status === "NOT_APPLICABLE").length,
  };

  // Score formula unchanged: identifiable requirement rows + document gaps
  // (exclude UNKNOWN / NOT_APPLICABLE). Document gaps are VERIFY with weight 0.45.
  const scorePool = [...items, ...documentGapItems];
  const identifiable = scorePool.filter(
    (i) => i.status === "READY" || i.status === "MISSING" || i.status === "VERIFY",
  );
  let score: number | null = null;
  if (identifiable.length > 0) {
    const weights = { READY: 1, VERIFY: 0.45, MISSING: 0 } as const;
    const sum = identifiable.reduce(
      (acc, i) => acc + weights[i.status as "READY" | "VERIFY" | "MISSING"],
      0,
    );
    score = Math.round((sum / identifiable.length) * 100);
  }

  const attention: string[] = [];
  const missingMandatory = items.filter((i) => i.status === "MISSING" && i.mandatory);
  const verifyMandatory = items.filter((i) => i.status === "VERIFY" && i.mandatory);
  const verifyAny = items.filter((i) => i.status === "VERIFY");

  if (missingMandatory.length === 1) {
    attention.push("1 mandatory requirement appears to be missing.");
  } else if (missingMandatory.length > 1) {
    attention.push(`${missingMandatory.length} mandatory requirements appear to be missing.`);
  }
  if (verifyMandatory.length > 0) {
    attention.push(
      `${verifyMandatory.length} mandatory requirement${verifyMandatory.length === 1 ? "" : "s"} could not be verified.`,
    );
  } else if (verifyAny.length > 0) {
    attention.push(
      `${verifyAny.length} requirement${verifyAny.length === 1 ? "" : "s"} require verification.`,
    );
  }
  if (documentGapItems.length === 1) {
    attention.push("1 referenced document needs verification (see Missing documents).");
  } else if (documentGapItems.length > 1) {
    attention.push(
      `${documentGapItems.length} referenced documents need verification (see Missing documents).`,
    );
  }
  if (counts.unknown > 0 && identifiable.length === 0) {
    attention.push("Not enough information to score readiness yet.");
  }
  if (input.fit?.attention?.length) {
    for (const a of input.fit.attention.slice(0, 2)) {
      if (!attention.includes(a)) attention.push(a);
    }
  }

  let recommendation =
    "Review readiness gaps with your team before committing bid effort.";
  if (missingMandatory.length > 0) {
    recommendation =
      "Resolve or confirm mandatory gaps before investing resources in a proposal.";
  } else if (verifyMandatory.length > 0) {
    recommendation =
      "Verify eligibility before investing resources in the proposal.";
  } else if (score != null && score >= 75 && counts.missing === 0) {
    recommendation = "Proceed with detailed verification before submission.";
  } else if (score != null && score < 50) {
    recommendation =
      "Address readiness gaps and unknowns before treating this as submission-ready.";
  }

  const total = items.length;
  return {
    score,
    total,
    totalRequirements: total,
    counts,
    items,
    attention: attention.slice(0, 5),
    recommendation,
    disclaimer:
      "AI-assisted readiness indicator based on identifiable requirements — not a legal or procurement eligibility decision.",
  };
}
