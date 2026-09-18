/**
 * Adapt pipeline structured objects into DecisionGuardianInput.
 * Pure mapping — no re-analysis.
 */

import {
  classifyRequirementSemanticKind,
  deriveObligationStrength,
  type RequirementSemanticKind,
} from "@/domain/tender-requirements/semantic-kind";
import type {
  GuardianAiClaimInput,
  GuardianDerivedDeadlineInput,
  GuardianExternalClaim,
  GuardianRiskInput,
  GuardianSourceContradiction,
} from "./source-hierarchy";
import type {
  DecisionGuardianInput,
  GuardianRequirementInput,
  GuardianStaleResultInput,
} from "./types";

export type BuildGuardianInputArgs = {
  textLength: number;
  readable: boolean;
  validityPassed: boolean;
  validityReason?: string | null;
  fileName?: string | null;
  requirements: Array<{
    id?: string | null;
    requirement?: string;
    description?: string;
    category: string;
    semanticKind?: string | null;
    obligationStrength?: string | null;
    mandatory: boolean;
    sourceSection?: string | null;
    page?: number | null;
    evidenceText?: string | null;
    evidence?: string | null;
    value?: string | null;
    fitStatus?: string | null;
    status?: string | null;
    companyEvidenceText?: string | null;
    hasCompanyEvidence?: boolean;
    lotApplicability?: string | null;
    stiConditionText?: string | null;
    stiProcurementPhase?: string | null;
    stiActor?: string | null;
    versionLabel?: string | null;
  }>;
  matrix?: Array<{ requirementId: string }> | null;
  readinessItems?: Array<{ id: string }> | null;
  actions?: Array<{
    linkedRequirementId: string | null;
    blocking: boolean;
    sourceType: string;
    title: string;
    simulationOnly?: boolean;
  }> | null;
  decision?: {
    decision: string;
    hardFailure?: boolean;
    hardBlockerCount: number;
    aiSuggestedDecision?: string | null;
    aiOverrodeCanonical?: boolean;
  } | null;
  deadline?: {
    deadlineIso: string | null;
    deadlineTimezone: string | null;
    expectedLocalHour?: number | null;
    expectedLocalMinute?: number | null;
    expectedDateYmd?: string | null;
    sourceEvidence?: string | null;
  } | null;
  fitScore?: number | null;
  fitBreakdownOverall?: number | null;
  reasoning?: string | null;
  complianceSummaryTotal?: number | null;
  requireDocumentValidity?: boolean;
  tenderSourceText?: string | null;
  risks?: GuardianRiskInput[] | null;
  externalClaims?: GuardianExternalClaim[] | null;
  contradictions?: GuardianSourceContradiction[] | null;
  derivedDeadline?: GuardianDerivedDeadlineInput | null;
  aiClaims?: GuardianAiClaimInput[] | null;
  staleResult?: GuardianStaleResultInput | null;
  expectedCommercialCues?: string[] | null;
};

function toReq(
  r: BuildGuardianInputArgs["requirements"][number],
  index: number,
): GuardianRequirementInput {
  const text = (r.requirement ?? r.description ?? "").trim();
  const semanticKind = (r.semanticKind ??
    classifyRequirementSemanticKind({
      description: text,
      existingCategory: r.category,
      mandatoryHint: r.mandatory,
    })) as RequirementSemanticKind;
  return {
    id: r.id ?? `req-${index + 1}`,
    requirement: text,
    category: r.category,
    semanticKind,
    obligationStrength:
      r.obligationStrength ?? deriveObligationStrength(text, semanticKind),
    mandatory: r.mandatory,
    sourceSection: r.sourceSection ?? null,
    page: r.page ?? null,
    evidenceText: r.evidenceText ?? r.evidence ?? null,
    value: r.value ?? null,
    fitStatus: r.fitStatus ?? r.status ?? null,
    companyEvidenceText: r.companyEvidenceText ?? null,
    hasCompanyEvidence: r.hasCompanyEvidence,
    lotApplicability: r.lotApplicability ?? null,
    stiConditionText: r.stiConditionText ?? null,
    stiProcurementPhase: r.stiProcurementPhase ?? null,
    stiActor: r.stiActor ?? null,
    versionLabel: r.versionLabel ?? null,
  };
}

export function buildDecisionGuardianInput(
  args: BuildGuardianInputArgs,
): DecisionGuardianInput {
  const requirements = args.requirements.map(toReq);
  const resolvedRequirementIds = requirements.map((r) => r.id);

  const activeActions = (args.actions ?? []).filter(
    (a) =>
      !a.simulationOnly &&
      a.sourceType !== "APPROACHING_DEADLINE" &&
      a.sourceType !== "DECISION_SIMULATOR" &&
      a.linkedRequirementId,
  );
  const actionLinkedIdentityCount = new Set(
    activeActions.map((a) => a.linkedRequirementId),
  ).size;

  return {
    document: {
      textLength: args.textLength,
      readable: args.readable,
      validityPassed: args.validityPassed,
      validityReason: args.validityReason ?? null,
      fileName: args.fileName ?? null,
    },
    requirements,
    resolvedRequirementIds,
    matrixRequirementIds: args.matrix?.map((m) => m.requirementId),
    readinessRequirementIds: args.readinessItems?.map((r) => r.id),
    actions: args.actions ?? null,
    decision: args.decision ?? null,
    deadline: args.deadline ?? null,
    fit:
      args.fitScore != null || args.fitBreakdownOverall != null
        ? {
            fitScore: args.fitScore ?? null,
            fitBreakdownOverall: args.fitBreakdownOverall ?? null,
            reasoning: args.reasoning ?? null,
          }
        : null,
    counts: {
      canonicalRequirementCount: requirements.length,
      matrixCount: args.matrix?.length ?? requirements.length,
      readinessCount: args.readinessItems?.length ?? requirements.length,
      complianceSummaryTotal: args.complianceSummaryTotal ?? requirements.length,
      actionLinkedIdentityCount: args.actions ? actionLinkedIdentityCount : null,
    },
    requireDocumentValidity: args.requireDocumentValidity,
    tenderSourceText: args.tenderSourceText ?? null,
    risks: args.risks ?? null,
    externalClaims: args.externalClaims ?? null,
    contradictions: args.contradictions ?? null,
    derivedDeadline: args.derivedDeadline ?? null,
    aiClaims: args.aiClaims ?? null,
    staleResult: args.staleResult ?? null,
    expectedCommercialCues: args.expectedCommercialCues ?? null,
  };
}

/** Stable content hash for stale-result detection (deterministic, no crypto dependency required). */
export function hashCanonicalRequirementSet(
  requirements: Array<{ id: string; requirement: string; semanticKind: string }>,
): string {
  const payload = requirements
    .map((r) => `${r.id}|${r.semanticKind}|${r.requirement}`)
    .sort()
    .join("\n");
  let h = 2166136261;
  for (let i = 0; i < payload.length; i++) {
    h ^= payload.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return `c${(h >>> 0).toString(16)}`;
}

/**
 * Release-gate content hash — id + obligation text only.
 * Must be identical between Guardian persist and Web/PDF publication.
 * Does not use display labels (requirementType) or semanticKind enums,
 * which can diverge across modules without reflecting content change.
 */
export function hashCanonicalReleasePayload(
  items: Array<{ id: string; text: string }>,
): string {
  return hashCanonicalRequirementSet(
    items.map((item) => ({
      id: item.id,
      requirement: item.text,
      semanticKind: "RELEASE",
    })),
  );
}
