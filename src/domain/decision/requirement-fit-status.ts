/**
 * Canonical Company Fit status — one authoritative result per requirement.
 * Downstream readiness, risk, and decision must consume this layer.
 */

import type { ReadinessStatus } from "./tender-readiness";
import type { DeterministicFinding } from "./types";
import type { ComplianceEvidenceState } from "@/domain/risk/types";
import type { RequirementVerificationStatus } from "@/domain/evidence-verification";
import type { RequirementMatchStatus } from "@prisma/client";
import {
  CONFIRMED_NON_COMPLIANCE_FINDING_CODES,
  hasExplicitNonComplianceEvidence,
} from "@/domain/risk/evidence-signals";

export type RequirementFitStatus =
  | "CONFIRMED_FIT"
  | "CONFIRMED_GAP"
  | "NEEDS_VERIFICATION"
  | "NOT_APPLICABLE";

export type CompanyEvidenceProvenance = {
  sourceDocument: string;
  page: number | "UNKNOWN" | null;
  section: string | null;
  excerpt: string;
};

export type RequirementFitRecord = {
  fitStatus: RequirementFitStatus;
  /** Legacy engine status derived from fit — never invert NEEDS_VERIFICATION into FAILED. */
  matchStatus: RequirementMatchStatus;
  provenance: CompanyEvidenceProvenance | null;
  evidenceConflict: boolean;
  fitRationale: string;
};

export function hasValidCompanyProvenance(input: {
  sourceDocument: string | null | undefined;
  evidence: string | null | undefined;
}): boolean {
  return Boolean(input.sourceDocument?.trim() && input.evidence?.trim());
}

/** Map canonical fit → readiness (single bridge for compliance matrix). */
export function mapFitStatusToReadiness(fitStatus: RequirementFitStatus): ReadinessStatus {
  switch (fitStatus) {
    case "CONFIRMED_FIT":
      return "READY";
    case "CONFIRMED_GAP":
      return "MISSING";
    case "NEEDS_VERIFICATION":
      return "VERIFY";
    case "NOT_APPLICABLE":
      return "NOT_APPLICABLE";
  }
}

/** Map canonical fit → compliance evidence state for risk engine. */
export function mapFitStatusToEvidenceState(
  fitStatus: RequirementFitStatus,
  input?: {
    humanVerified?: boolean;
    evidenceConflict?: boolean;
  },
): ComplianceEvidenceState {
  if (input?.evidenceConflict && fitStatus === "NEEDS_VERIFICATION") {
    return "UNKNOWN";
  }
  if (fitStatus === "NOT_APPLICABLE") return "NOT_APPLICABLE";
  if (fitStatus === "CONFIRMED_FIT" && input?.humanVerified) {
    return "CONFIRMED_COMPLIANT";
  }
  if (fitStatus === "CONFIRMED_FIT") return "NEEDS_VERIFICATION";
  if (fitStatus === "CONFIRMED_GAP") return "CONFIRMED_NON_COMPLIANT";
  if (fitStatus === "NEEDS_VERIFICATION") return "NEEDS_VERIFICATION";
  return "UNKNOWN";
}

/**
 * Derive canonical fit from match output, rules findings, and provenance.
 * Missing evidence → NEEDS_VERIFICATION, never CONFIRMED_GAP.
 */
export function deriveRequirementFitStatus(input: {
  category: string;
  semanticKind?: string | null;
  mandatory: boolean;
  matchStatus: RequirementMatchStatus;
  evidence: string | null;
  sourceDocument: string | null;
  page?: number | "UNKNOWN" | null;
  section?: string | null;
  rationale?: string | null;
  findings: DeterministicFinding[];
  requirementIndex: number;
  humanVerified?: boolean;
  humanRejected?: boolean;
  evidenceConflict?: boolean;
}): RequirementFitRecord {
  const informational =
    /^INFORMATIONAL$/i.test(input.category) ||
    input.semanticKind === "INFORMATIONAL_FACT" ||
    input.semanticKind === "DEADLINE" ||
    input.semanticKind === "EVALUATION_CRITERION" ||
    input.semanticKind === "CLARIFICATION_PROCEDURAL";

  if (informational) {
    return {
      fitStatus: "NOT_APPLICABLE",
      matchStatus: "UNCERTAIN",
      provenance: null,
      evidenceConflict: false,
      fitRationale: "Informational or non-scored tender content.",
    };
  }

  // Optional / preferred content cannot create compliance gaps.
  if (!input.mandatory && /^PREFERRED$/i.test(input.category)) {
    if (input.matchStatus === "MATCHED" && hasValidCompanyProvenance(input)) {
      return {
        fitStatus: "CONFIRMED_FIT",
        matchStatus: "MATCHED",
        provenance: {
          sourceDocument: input.sourceDocument!.trim(),
          page: input.page ?? null,
          section: input.section ?? null,
          excerpt: input.evidence!.trim(),
        },
        evidenceConflict: false,
        fitRationale: "Optional preference supported by company evidence.",
      };
    }
    return {
      fitStatus: "NOT_APPLICABLE",
      matchStatus: "UNCERTAIN",
      provenance: null,
      evidenceConflict: false,
      fitRationale: "Optional or preferred content — not a compliance gap.",
    };
  }

  const provenance = hasValidCompanyProvenance(input)
    ? {
        sourceDocument: input.sourceDocument!.trim(),
        page: input.page ?? null,
        section: input.section ?? null,
        excerpt: input.evidence!.trim(),
      }
    : null;

  if (input.evidenceConflict) {
    return {
      fitStatus: "NEEDS_VERIFICATION",
      matchStatus: "UNCERTAIN",
      provenance,
      evidenceConflict: true,
      fitRationale:
        "Conflicting company evidence sources — manual review required before confirming fit or gap.",
    };
  }

  const confirmedGapFinding = input.findings.some(
    (f) =>
      f.requirementIndex === input.requirementIndex &&
      CONFIRMED_NON_COMPLIANCE_FINDING_CODES.has(f.code),
  );

  const explicitNegative = hasExplicitNonComplianceEvidence({
    matchStatus: input.matchStatus,
    evidence: input.evidence,
    findings: input.findings,
    requirementIndex: input.requirementIndex,
  });

  if (
    input.humanRejected ||
    (confirmedGapFinding && provenance != null) ||
    (explicitNegative && provenance != null) ||
    (input.matchStatus === "FAILED" && explicitNegative && provenance != null)
  ) {
    return {
      fitStatus: "CONFIRMED_GAP",
      matchStatus: "FAILED",
      provenance,
      evidenceConflict: false,
      fitRationale:
        input.rationale ??
        "Definitive company evidence indicates the requirement is not satisfied.",
    };
  }

  if (input.humanVerified && provenance) {
    return {
      fitStatus: "CONFIRMED_FIT",
      matchStatus: "MATCHED",
      provenance,
      evidenceConflict: false,
      fitRationale: "Human-verified company evidence supports this requirement.",
    };
  }

  if (input.matchStatus === "MATCHED" && provenance) {
    return {
      fitStatus: "CONFIRMED_FIT",
      matchStatus: "MATCHED",
      provenance,
      evidenceConflict: false,
      fitRationale:
        input.rationale ??
        "Company evidence with traceable provenance supports this requirement.",
    };
  }

  return {
    fitStatus: "NEEDS_VERIFICATION",
    matchStatus: "UNCERTAIN",
    provenance,
    evidenceConflict: false,
    fitRationale:
      input.rationale ??
      (provenance
        ? "Evidence found but requires verification against tender wording."
        : "Insufficient company evidence to confirm fit or gap."),
  };
}

/** Apply fit layer to requirements after knowledge match + deterministic rules. */
export function finalizeRequirementFit(input: {
  requirements: Array<{
    id?: string;
    category: string;
    description: string;
    mandatory: boolean;
    value: string | null;
    status: RequirementMatchStatus;
    evidence?: string | null;
    semanticKind?: string | null;
    sourceDocument?: string | null;
    page?: number | "UNKNOWN" | null;
    section?: string | null;
    rationale?: string | null;
    evidenceConflict?: boolean;
  }>;
  findings: DeterministicFinding[];
}): Array<
  (typeof input.requirements)[number] & {
    fitStatus: RequirementFitStatus;
    fitProvenance: CompanyEvidenceProvenance | null;
    evidenceConflict: boolean;
    status: RequirementMatchStatus;
  }
> {
  return input.requirements.map((req, index) => {
    const fit = deriveRequirementFitStatus({
      category: req.category,
      semanticKind: req.semanticKind ?? null,
      mandatory: req.mandatory,
      matchStatus: req.status,
      evidence: req.evidence ?? null,
      sourceDocument: req.sourceDocument ?? null,
      page: req.page ?? null,
      section: req.section ?? null,
      rationale: req.rationale ?? null,
      findings: input.findings,
      requirementIndex: index,
      evidenceConflict: req.evidenceConflict ?? false,
    });
    return {
      ...req,
      fitStatus: fit.fitStatus,
      fitProvenance: fit.provenance,
      evidenceConflict: fit.evidenceConflict,
      status: fit.matchStatus,
    };
  });
}

/** Runtime invariant — rejects logically invalid fit states. */
export function assertRequirementFitConsistency(
  records: Array<{
    requirementId?: string;
    description: string;
    fitStatus: RequirementFitStatus;
    fitProvenance: CompanyEvidenceProvenance | null;
    evidenceConflict?: boolean;
  }>,
): void {
  const seen = new Set<string>();
  for (const r of records) {
    const key = r.requirementId ?? r.description;
    if (seen.has(key)) {
      throw new Error(`Duplicate fit record for requirement: ${key.slice(0, 60)}`);
    }
    seen.add(key);

    if (r.fitStatus === "CONFIRMED_FIT" && !r.fitProvenance) {
      throw new Error(
        `CONFIRMED_FIT without supporting provenance: "${r.description.slice(0, 60)}…"`,
      );
    }
    if (r.fitStatus === "CONFIRMED_GAP" && !r.fitProvenance) {
      throw new Error(
        `CONFIRMED_GAP without definitive provenance: "${r.description.slice(0, 60)}…"`,
      );
    }
  }
}

export function fitStatusForVerification(
  fitStatus: RequirementFitStatus,
): RequirementVerificationStatus {
  switch (fitStatus) {
    case "CONFIRMED_FIT":
      return "NEEDS_VERIFICATION";
    case "CONFIRMED_GAP":
      return "NEEDS_VERIFICATION";
    case "NOT_APPLICABLE":
      return "NOT_APPLICABLE";
    default:
      return "NEEDS_VERIFICATION";
  }
}
