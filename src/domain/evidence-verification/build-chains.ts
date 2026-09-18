/**
 * Build Requirement → Evidence → Document → Location → Verification chains.
 */

import type { ReadinessStatus } from "@/domain/decision/tender-readiness";
import {
  deriveRequirementVerificationStatus,
  formatLocationLabel,
} from "@/domain/evidence-verification/status";
import { selectBestEvidenceByRequirement } from "@/domain/evidence-verification/select-evidence";
import type {
  CanonicalEvidenceRecord,
  RequirementVerificationChain,
  VerificationIntelligenceBundle,
  VerificationIntelligenceSummary,
} from "@/domain/evidence-verification/types";

export type BuildVerificationChainsInput = {
  defaultDocumentName: string | null;
  requirements: Array<{
    id: string;
    description: string;
    mandatory: boolean;
    value: string | null;
    readinessStatus: ReadinessStatus;
  }>;
  evidence: CanonicalEvidenceRecord[];
  verifierLabels?: Map<string, string>;
};

export function buildVerificationChains(
  input: BuildVerificationChainsInput,
): RequirementVerificationChain[] {
  const best = selectBestEvidenceByRequirement(input.evidence);

  return input.requirements.map((req) => {
    const ev = best.get(req.id) ?? null;
    const { status, reason } = deriveRequirementVerificationStatus({
      readinessStatus: req.readinessStatus,
      evidence: ev,
      requirementDescription: req.description,
      requirementValue: req.value,
      storedReason: ev?.verificationReason ?? null,
    });

    const verifiedAt =
      ev?.verifiedAt == null
        ? null
        : typeof ev.verifiedAt === "string"
          ? ev.verifiedAt
          : ev.verifiedAt.toISOString();

    const verifierLabel =
      ev?.verifiedById && input.verifierLabels?.get(ev.verifiedById)
        ? input.verifierLabels.get(ev.verifiedById)!
        : ev?.teamTaskId
          ? "Team workflow reviewer"
          : null;

    return {
      requirementId: req.id,
      requirement: req.description,
      mandatory: req.mandatory,
      readinessStatus: req.readinessStatus,
      verificationStatus: status,
      verificationReason: reason,
      evidenceId: ev?.id ?? null,
      evidenceExcerpt: ev?.evidenceText?.trim() || null,
      sourceDocument: ev?.documentName ?? input.defaultDocumentName,
      pageNumber: ev?.sourcePage ?? null,
      section: ev?.sourceSection ?? null,
      locationLabel: formatLocationLabel({
        sourceDocument: ev?.documentName ?? input.defaultDocumentName,
        pageNumber: ev?.sourcePage ?? null,
        section: ev?.sourceSection ?? null,
      }),
      verifierLabel,
      verifiedAt,
      teamTaskId: ev?.teamTaskId ?? null,
    };
  });
}

function summarizeChains(chains: RequirementVerificationChain[]): VerificationIntelligenceSummary {
  const count = (s: RequirementVerificationChain["verificationStatus"]) =>
    chains.filter((c) => c.verificationStatus === s).length;
  return {
    total: chains.length,
    verified: count("VERIFIED"),
    needsVerification: count("NEEDS_VERIFICATION"),
    missingEvidence: count("MISSING_EVIDENCE"),
    notApplicable: count("NOT_APPLICABLE"),
  };
}

export function buildVerificationIntelligence(
  input: BuildVerificationChainsInput,
): VerificationIntelligenceBundle {
  const chains = buildVerificationChains(input);
  return {
    computed: true,
    chains,
    summary: summarizeChains(chains),
    disclaimer:
      "Verification reflects recorded evidence and human review only. AI interpretations are never treated as verified.",
  };
}
