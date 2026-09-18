/**
 * Build Evidence Intelligence bundle from canonical analysis artifacts.
 */

import type { RequirementMatchStatus } from "@prisma/client";
import type {
  CanonicalEvidenceRecord,
  RequirementVerificationChain,
  VerificationIntelligenceBundle,
} from "@/domain/evidence-verification";
import { selectBestEvidenceByRequirement } from "@/domain/evidence-verification";
import { isRealEvidenceText } from "@/domain/evidence-verification";
import type { ComplianceRow } from "@/domain/tender-intelligence";
import { deriveEvidenceValidity } from "./expiry";
import {
  decisionImpactNote,
  mapEvidenceIntelligenceState,
  mapEvidenceSourceKind,
  mapProvenanceConfidence,
  readinessImpactLabel,
} from "./map-states";
import type {
  EvidenceIntelligenceBundle,
  EvidenceIntelligenceRecord,
  EvidenceIntelligenceSummary,
  RequirementEvidenceIntelligenceRow,
} from "./types";
import { EVIDENCE_INTELLIGENCE_DISCLAIMER } from "./types";
import { buildEvidenceReadinessSummary } from "./summary";

export type BuildEvidenceIntelligenceInput = {
  verificationIntelligence: VerificationIntelligenceBundle;
  complianceMatrix: ComplianceRow[];
  evidence: CanonicalEvidenceRecord[];
  requirements: Array<{
    id: string;
    category: string;
    status: RequirementMatchStatus;
  }>;
  referenceDate?: Date;
};

function buildRelevanceReason(input: {
  chain: RequirementVerificationChain;
  compliance: ComplianceRow | null;
  evidence: CanonicalEvidenceRecord | null;
}): string | null {
  if (input.chain.verificationReason?.trim()) {
    return input.chain.verificationReason.trim();
  }
  if (input.compliance?.verificationReason?.trim()) {
    return input.compliance.verificationReason.trim();
  }
  if (input.compliance?.companyFit?.trim()) {
    return input.compliance.companyFit.trim();
  }
  if (input.evidence?.verificationReason?.trim()) {
    return input.evidence.verificationReason.trim();
  }

  const hasExcerpt = Boolean(input.chain.evidenceExcerpt?.trim());
  if (!hasExcerpt) {
    return "No relevant company evidence linked — requirement may be blocked.";
  }

  if (input.evidence?.verificationStatus === "INFERRED") {
    return "Matched using structured requirement context and company knowledge content — not filename alone. Human verification required.";
  }

  if (input.evidence?.verificationStatus === "VERIFIED" && input.evidence.teamTaskId) {
    return "Human-verified through team workflow with traceable source.";
  }

  return "Relevance requires review — source or mapping could not be fully established.";
}

function buildEvidenceRecord(input: {
  chain: RequirementVerificationChain;
  evidence: CanonicalEvidenceRecord | null;
  compliance: ComplianceRow | null;
  requirementType: string;
  referenceDate?: Date;
}): EvidenceIntelligenceRecord | null {
  const rawExcerpt =
    input.chain.evidenceExcerpt?.trim() ||
    input.compliance?.companyEvidence?.excerpt?.trim() ||
    null;
  const excerpt = isRealEvidenceText(rawExcerpt) ? rawExcerpt : null;

  if (!excerpt) {
    return null;
  }

  const validity = deriveEvidenceValidity({
    excerpt,
    referenceDate: input.referenceDate,
  });

  const sourceKind = mapEvidenceSourceKind(input.evidence);
  const confidence = mapProvenanceConfidence(input.evidence);

  return {
    evidenceId: input.chain.evidenceId,
    title: input.compliance?.companyEvidence?.documentName ?? input.chain.sourceDocument,
    evidenceType: input.requirementType,
    sourceKind,
    sourceDocument: input.chain.sourceDocument,
    sourceLocation: input.chain.locationLabel,
    documentReference: input.evidence?.documentId ?? null,
    pageNumber: input.chain.pageNumber,
    section: input.chain.section,
    issueDate: validity.issueDate,
    expiryDate: validity.expiryDate,
    validityState: validity.validityState,
    confidence,
    verificationNotes: input.evidence?.verificationReason ?? input.chain.verificationReason,
    excerpt,
    ownerLabel: "Company",
  };
}

function summarizeRows(rows: RequirementEvidenceIntelligenceRow[]): EvidenceIntelligenceSummary {
  const count = (s: RequirementEvidenceIntelligenceRow["evidenceState"]) =>
    rows.filter((r) => r.evidenceState === s).length;
  const notApplicable = rows.filter(
    (r) => r.requirementVerificationStatus === "NOT_APPLICABLE",
  ).length;

  return {
    total: rows.length,
    verified: count("VERIFIED"),
    foundUnverified: count("FOUND_UNVERIFIED"),
    missing: count("MISSING"),
    invalid: count("INVALID"),
    expired: count("EXPIRED"),
    unknown: count("UNKNOWN"),
    notApplicable,
  };
}

export function buildEvidenceIntelligence(
  input: BuildEvidenceIntelligenceInput,
): EvidenceIntelligenceBundle {
  const complianceByReq = new Map(
    input.complianceMatrix.map((r) => [r.requirementId, r]),
  );
  const requirementMeta = new Map(input.requirements.map((r) => [r.id, r]));
  const bestEvidence = selectBestEvidenceByRequirement(input.evidence);

  const rows: RequirementEvidenceIntelligenceRow[] =
    input.verificationIntelligence.chains.map((chain) => {
      const compliance = complianceByReq.get(chain.requirementId) ?? null;
      const meta = requirementMeta.get(chain.requirementId);
      const evidence = bestEvidence.get(chain.requirementId) ?? null;
      const requirementType =
        compliance?.requirementType ?? meta?.category ?? "Other";

      const record = buildEvidenceRecord({
        chain,
        evidence,
        compliance,
        requirementType,
        referenceDate: input.referenceDate,
      });

      const validityState = record?.validityState ?? "UNKNOWN";
      const evidenceState = mapEvidenceIntelligenceState({
        requirementVerificationStatus: chain.verificationStatus,
        evidence,
        readinessStatus: chain.readinessStatus,
        validityState,
      });

      return {
        requirementId: chain.requirementId,
        requirement: chain.requirement,
        mandatory: chain.mandatory,
        requirementType,
        requirementMatchStatus: meta?.status ?? null,
        evidenceState,
        requirementVerificationStatus: chain.verificationStatus,
        relevanceReason: buildRelevanceReason({ chain, compliance, evidence }),
        readinessImpact: chain.readinessStatus,
        readinessImpactLabel: readinessImpactLabel(chain.readinessStatus),
        decisionImpactNote: decisionImpactNote({
          evidenceState,
          readinessStatus: chain.readinessStatus,
          mandatory: chain.mandatory,
        }),
        evidence: record,
        sourceBasis: compliance?.sourceBasis ?? "UNKNOWN",
        locationLabel: chain.locationLabel,
        teamTaskId: chain.teamTaskId,
      };
    });

  return {
    computed: true,
    rows,
    summary: summarizeRows(rows),
    readinessSummary: buildEvidenceReadinessSummary(rows),
    disclaimer: EVIDENCE_INTELLIGENCE_DISCLAIMER,
  };
}
