/**
 * Package completeness must evaluate substantive canonical content —
 * never treat documentRole (e.g. AVIS) as a proxy for NOTICE_ONLY.
 */

import { isNonRequirementText } from "@/domain/tender-requirements/filter-non-requirements";
import {
  isScoringSemanticKind,
  type ObligationStrength,
  type RequirementSemanticKind,
} from "@/domain/tender-requirements/semantic-kind";

/** Bidder-obligation kinds that support Fit / Compliance / Decision. */
export const SUBSTANTIVE_SEMANTIC_KINDS = new Set<RequirementSemanticKind>([
  "ADMINISTRATIVE_REQUIREMENT",
  "TECHNICAL_REQUIREMENT",
  "ELIGIBILITY_REQUIREMENT",
  "REQUIRED_DOCUMENT",
  "PERFORMANCE_OBLIGATION",
  "CONTRACTUAL_OBLIGATION",
  "FINANCIAL_COMMERCIAL_CONDITION",
  "GUARANTEE_SECURITY_REQUIREMENT",
]);

/** Works / commercial obligations — stronger signal than notice eligibility alone. */
const WORKS_OR_COMMERCIAL_KINDS = new Set<RequirementSemanticKind>([
  "TECHNICAL_REQUIREMENT",
  "PERFORMANCE_OBLIGATION",
  "CONTRACTUAL_OBLIGATION",
  "FINANCIAL_COMMERCIAL_CONDITION",
]);

export type CanonicalRequirementForCompleteness = {
  semanticKind: RequirementSemanticKind;
  obligationStrength: ObligationStrength;
  mandatory: boolean;
  requirement: string;
  category?: string | null;
};

export type SubstantiveContentAssessment = {
  substantiveCount: number;
  worksOrCommercialCount: number;
  kindDiversity: number;
  kinds: RequirementSemanticKind[];
  /** True when the package has enough real bidder obligations for analysis. */
  sufficient: boolean;
  reason: string;
};

function isInformationalOnly(strength: ObligationStrength): boolean {
  return strength === "INFORMATIONAL";
}

/**
 * Count reliable substantive canonical obligations.
 * Title/facts/deadlines/evaluation weights/procedural text must not pass.
 */
export function evaluateSubstantiveCanonicalContent(
  requirements: CanonicalRequirementForCompleteness[],
): SubstantiveContentAssessment {
  const substantive = requirements.filter((r) => {
    const text = r.requirement.replace(/\s+/g, " ").trim();
    // Real-world PDFs often extract short—but still semantically substantive—ETR-coded rows
    // from AVIS-only documents. We must not drop those purely by string length;
    // non-mandatory short snippets are still treated as unreliable.
    if (text.length < 24 && !r.mandatory) return false;
    if (isNonRequirementText(text)) return false;
    if (!isScoringSemanticKind(r.semanticKind)) return false;
    if (!SUBSTANTIVE_SEMANTIC_KINDS.has(r.semanticKind)) return false;
    if (isInformationalOnly(r.obligationStrength)) return false;
    return true;
  });

  const kinds = [...new Set(substantive.map((r) => r.semanticKind))];
  const worksOrCommercialCount = substantive.filter((r) =>
    WORKS_OR_COMMERCIAL_KINDS.has(r.semanticKind),
  ).length;
  const substantiveCount = substantive.length;
  const kindDiversity = kinds.length;

  // Rich single-document tender (e.g. A/E/T/C blocks) even if role=AVIS.
  if (worksOrCommercialCount >= 3 && substantiveCount >= 5) {
    return {
      substantiveCount,
      worksOrCommercialCount,
      kindDiversity,
      kinds,
      sufficient: true,
      reason: "works_and_commercial_obligations",
    };
  }

  // Broad administrative / eligibility / guarantee package with multiple kinds.
  if (substantiveCount >= 8 && kindDiversity >= 3) {
    return {
      substantiveCount,
      worksOrCommercialCount,
      kindDiversity,
      kinds,
      sufficient: true,
      reason: "diverse_substantive_obligations",
    };
  }

  // Mixed package: some works + supporting admin/eligibility.
  if (worksOrCommercialCount >= 2 && substantiveCount >= 6 && kindDiversity >= 2) {
    return {
      substantiveCount,
      worksOrCommercialCount,
      kindDiversity,
      kinds,
      sufficient: true,
      reason: "mixed_substantive_package",
    };
  }

  return {
    substantiveCount,
    worksOrCommercialCount,
    kindDiversity,
    kinds,
    sufficient: false,
    reason:
      substantiveCount === 0
        ? "no_substantive_obligations"
        : "insufficient_substantive_depth",
  };
}
