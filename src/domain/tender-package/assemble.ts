import {
  classifyPackageDocumentIdentity,
  identityRoleToAssemblyHint,
  isSpecificationIdentityRole,
} from "@/domain/package-identity";
import {
  classifyTenderDocumentRole,
  isNoticeRole,
  isSpecificationSourceRole,
} from "./classify-role";
import {
  evaluateSubstantiveCanonicalContent,
  type CanonicalRequirementForCompleteness,
} from "./substantive-content";
import type {
  ClassifiedTenderPart,
  PackageCompletenessReason,
  PackageScoringDecision,
  TenderDocumentRole,
  TenderPackageAssembly,
} from "./types";

const SPEC_ROLES: TenderDocumentRole[] = [
  "CPS",
  "RFP",
  "TECHNICAL_SPECIFICATION",
];

function completenessFor(parts: ClassifiedTenderPart[]): {
  reason: PackageCompletenessReason;
  message: string;
  missing: TenderDocumentRole[];
  avisOnly: boolean;
  hasSpecificationSource: boolean;
} {
  const roles = [...new Set(parts.map((p) => p.role))];
  const hasSpec = parts.some((p) => isSpecificationSourceRole(p.role));
  const hasNotice = parts.some((p) => isNoticeRole(p.role));
  const totalChars = parts.reduce((n, p) => n + p.textLength, 0);
  // Per-file empty vs package-level unreadability (short notices can be <400 chars).
  const hasReadableText =
    parts.some((p) => p.textLength >= 80) || totalChars >= 400;
  const missing: TenderDocumentRole[] = [];

  if (!hasReadableText) {
    return {
      reason: "DOCUMENT_UNREADABLE",
      message:
        "Tender document text could not be read reliably (empty or too short after extraction). Decision scores were not calculated.",
      missing: ["CPS", "TECHNICAL_SPECIFICATION"],
      avisOnly: false,
      hasSpecificationSource: false,
    };
  }

  if (hasSpec) {
    return {
      reason: "PACKAGE_COMPLETE",
      message: "Tender package includes a specification source (CPS / RFP / technical specifications).",
      missing: [],
      avisOnly: false,
      hasSpecificationSource: true,
    };
  }

  if (hasNotice && !hasSpec) {
    if (!roles.some((r) => r === "CPS")) missing.push("CPS");
    if (!roles.some((r) => r === "TECHNICAL_SPECIFICATION")) {
      missing.push("TECHNICAL_SPECIFICATION");
    }
    return {
      reason: "ONLY_AVIS",
      message:
        "Only a tender notice (Avis / Iklan / Notice) was available. Verified notice facts (deadline, buyer, value, eligibility) may be stored, but the CPS / technical specifications are missing — Fit, Compliance Matrix, Bid Score and Bid/No-Bid decision were not calculated.",
      missing,
      avisOnly: true,
      hasSpecificationSource: false,
    };
  }

  // Tender-like OTHER without CPS/RFP/tech
  missing.push("CPS");
  missing.push("TECHNICAL_SPECIFICATION");
  return {
    reason: "PACKAGE_INCOMPLETE",
    message:
      "Tender package is incomplete for decision analysis: no CPS, RFP, or technical specifications were identified. Upload the full tender pack to run Bidvera decision scoring.",
    missing,
    avisOnly: false,
    hasSpecificationSource: false,
  };
}

/**
 * Assemble multi-document tender parts into one package with role diagnosis.
 * Preserves per-document identity via DOCUMENT markers; does not invent text.
 * Note: role-based completeness is a preliminary signal — scoring gate must
 * re-evaluate against substantive canonical requirements.
 */
export function assembleTenderPackage(
  inputs: Array<{
    documentId?: string;
    fileName: string;
    documentKind: string;
    text: string;
  }>,
): TenderPackageAssembly {
  const identityDocs = classifyPackageDocumentIdentity(
    inputs.map((p) => ({ fileName: p.fileName, text: p.text })),
  );
  const identityByFile = new Map(identityDocs.map((d) => [d.fileName, d]));
  const parts: ClassifiedTenderPart[] = inputs.map((p) => {
    const roleResult = classifyTenderDocumentRole({
      text: p.text,
      fileName: p.fileName,
    });
    const identity = identityByFile.get(p.fileName);
    const identityHint =
      identity && identity.role !== "UNKNOWN"
        ? identityRoleToAssemblyHint(identity.role)
        : null;
    return {
      documentId: p.documentId,
      fileName: p.fileName,
      documentKind: p.documentKind,
      role: identityHint ?? roleResult.role,
      roleConfidence: identity
        ? Math.max(roleResult.confidence, identity.confidence)
        : roleResult.confidence,
      roleSignals: identity
        ? [...new Set([...roleResult.signals, ...identity.signals])]
        : roleResult.signals,
      text: p.text,
      textLength: p.text.trim().length,
    };
  });

  const packageLabel = parts.map((p) => p.fileName).join(" + ") || "tender-package";
  const packageText = parts
    .map(
      (p) =>
        `\n\n===== DOCUMENT: ${p.fileName} (id=${p.documentId ?? "n/a"}, kind=${p.documentKind}, role=${p.role}) =====\n\n${p.text}`,
    )
    .join("\n");

  const diagnosis = completenessFor(parts);
  const identityHasSpec = identityDocs.some((d) => isSpecificationIdentityRole(d.role));
  const identityHasNotice = identityDocs.some((d) => d.role === "NOTICE");
  if (identityHasSpec && !diagnosis.hasSpecificationSource) {
    diagnosis.hasSpecificationSource = true;
    diagnosis.avisOnly = false;
    diagnosis.reason = "PACKAGE_COMPLETE";
    diagnosis.message =
      "Tender package includes an authoritative specification volume (instructions, schedule, technical, or contract conditions).";
    diagnosis.missing = [];
  } else if (
    identityHasNotice &&
    !identityHasSpec &&
    !diagnosis.hasSpecificationSource &&
    diagnosis.reason !== "DOCUMENT_UNREADABLE"
  ) {
    diagnosis.avisOnly = true;
    diagnosis.reason = "ONLY_AVIS";
  }
  const rolesPresent = [...new Set(parts.map((p) => p.role))];

  return {
    parts,
    rolesPresent,
    packageLabel,
    packageText,
    hasSpecificationSource: diagnosis.hasSpecificationSource,
    avisOnly: diagnosis.avisOnly,
    completeness: diagnosis.reason,
    completenessMessage: diagnosis.message,
    missingDocumentTypes: diagnosis.missing,
  };
}

/**
 * Decide whether Fit / Bid Score / Compliance scoring may proceed.
 *
 * documentRole ≠ packageCompleteness:
 * AVIS + substantive canonical obligations → allow scoring
 * AVIS + notice metadata only → NOTICE_ONLY / incomplete
 */
export function evaluatePackageScoringGate(input: {
  assembly: TenderPackageAssembly;
  reliableRequirementCount: number;
  /** Canonical requirements after normalize/dedupe — required for content completeness. */
  canonicalRequirements?: CanonicalRequirementForCompleteness[];
  extractionUnreliable?: boolean;
  /**
   * True only when source/parser/OCR lost document text (TRUNCATED_BY_SOURCE).
   * An AI context window must never set this.
   */
  packageTextTruncated?: boolean;
}): PackageScoringDecision {
  if (input.packageTextTruncated) {
    return {
      allowScoring: false,
      reason: "PACKAGE_TEXT_TRUNCATED",
      message:
        "Package or document text was truncated by the source, parser, or OCR. Scores were not calculated because the remaining text is not a trustworthy complete package.",
      missingDocumentTypes: [],
    };
  }

  if (input.extractionUnreliable) {
    return {
      allowScoring: false,
      reason: "EXTRACTION_FAILED",
      message:
        "Tender document extraction failed or could not be read reliably. Decision scores were not calculated.",
      missingDocumentTypes: ["CPS", "TECHNICAL_SPECIFICATION"],
    };
  }

  if (input.assembly.completeness === "DOCUMENT_UNREADABLE") {
    return {
      allowScoring: false,
      reason: "DOCUMENT_UNREADABLE",
      message: input.assembly.completenessMessage,
      missingDocumentTypes: input.assembly.missingDocumentTypes,
    };
  }

  const substantive = evaluateSubstantiveCanonicalContent(
    input.canonicalRequirements ?? [],
  );

  // Spec-role package (CPS/RFP/tech) — require reliable requirements as before.
  if (input.assembly.hasSpecificationSource) {
    if (input.reliableRequirementCount <= 0 && !substantive.sufficient) {
      return {
        allowScoring: false,
        reason: "NO_RELIABLE_REQUIREMENTS",
        message:
          "A specification source was present, but no reliable tender requirements could be extracted. Decision scores were not calculated.",
        missingDocumentTypes: [],
      };
    }
    return {
      allowScoring: true,
      reason: "PACKAGE_COMPLETE",
      message: input.assembly.completenessMessage,
      missingDocumentTypes: [],
    };
  }

  // No separate CPS/RFP/tech role — decide from substantive canonical content.
  if (substantive.sufficient) {
    return {
      allowScoring: true,
      reason: "SINGLE_DOCUMENT_SUBSTANTIVE",
      message:
        "Document role classification may be notice-like, but the package contains sufficient substantive tender obligations (administrative, eligibility, technical, contractual, or commercial) for Fit, Compliance, Bid Score and Bid/No-Bid analysis. Separate CPS / technical specification files are not required.",
      missingDocumentTypes: [],
    };
  }

  // Genuine notice-only / incomplete — missing docs are analysis blockers.
  if (input.assembly.avisOnly || input.assembly.completeness === "ONLY_AVIS") {
    return {
      allowScoring: false,
      reason: "ONLY_AVIS",
      message: input.assembly.completenessMessage,
      missingDocumentTypes: input.assembly.missingDocumentTypes,
    };
  }

  const missing = input.assembly.missingDocumentTypes;
  const reason: PackageCompletenessReason = missing.includes("CPS")
    ? "CPS_MISSING"
    : missing.includes("TECHNICAL_SPECIFICATION")
      ? "TECHNICAL_SPECIFICATION_MISSING"
      : "PACKAGE_INCOMPLETE";
  return {
    allowScoring: false,
    reason,
    message: input.assembly.completenessMessage,
    missingDocumentTypes: missing,
  };
}

export function specificationRolesPresent(
  roles: TenderDocumentRole[],
): boolean {
  return roles.some((r) => SPEC_ROLES.includes(r));
}
