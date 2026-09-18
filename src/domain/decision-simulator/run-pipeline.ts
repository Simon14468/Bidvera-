/**
 * Re-run canonical decision dependencies in memory for simulation.
 * Uses the production Decision Engine — no parallel scoring.
 */

import { computeTenderReadiness } from "@/domain/decision/tender-readiness";
import {
  finalizeTenderDecision,
  runCoreDecisionEngine,
} from "@/domain/decision/tender-decision-engine";
import type { RuleRequirement } from "@/domain/decision/types";
import { buildTenderIntelligence } from "@/domain/tender-intelligence";
import { assertCanonicalRequirementInvariants } from "@/domain/tender-requirements";
import type { SimulationSnapshot, SimulationStateView } from "./types";
import { snapshotProfileHasCapability } from "./snapshot";

function toRuleRequirements(snapshot: SimulationSnapshot): RuleRequirement[] {
  return snapshot.requirements.map((r) => ({
    id: r.id,
    category: r.category,
    description: r.description,
    mandatory: r.mandatory,
    value: r.value,
    status: r.status,
    evidence: r.evidence,
    // Preserve Fit/provenance semantics — same as baseline Decision Engine
    sourceDocument: (r as { sourceDocument?: string | null }).sourceDocument ?? null,
    semanticKind: (r as { semanticKind?: string | null }).semanticKind ?? null,
    fitStatus: (r as { fitStatus?: RuleRequirement["fitStatus"] }).fitStatus,
    evidenceConflict: (r as { evidenceConflict?: boolean }).evidenceConflict,
  }));
}

function tenderTextFromRequirements(requirements: RuleRequirement[]): string {
  return requirements.map((r) => `${r.category} ${r.description}`).join("\n");
}

/**
 * Run the production decision pipeline on a simulation snapshot.
 * Deterministic — AI blend disabled (ai: null).
 */
export function runSimulationPipeline(
  snapshot: SimulationSnapshot,
  asOf: Date = new Date(),
): SimulationStateView {
  const requirements = toRuleRequirements(snapshot);
  const tenderText =
    snapshot.context.extractedText.trim() ||
    tenderTextFromRequirements(requirements);

  const engine = runCoreDecisionEngine({
    profile: snapshot.profile,
    requirements,
    estimatedValue: snapshot.context.estimatedValue,
    tenderContext: {
      title: snapshot.context.title,
      client: snapshot.context.client,
      country: snapshot.context.country,
      industry: snapshot.context.industry,
      tenderText,
    },
    ai: null,
  });

  const readiness = computeTenderReadiness({
    requirements: engine.requirements,
    missingDocuments: snapshot.missingDocuments.map((d) => ({
      id: d.id,
      documentName: d.documentName,
      reason: d.reason,
      severity: d.severity,
    })),
    fit: engine.fitBreakdown,
    profileHasAnyCapability: snapshotProfileHasCapability(snapshot),
  });

  const engineById = new Map(
    engine.requirements.map((r) => [r.id, r] as const),
  );
  const intelligence = buildTenderIntelligence({
    tenderId: snapshot.context.tenderId,
    documentName: snapshot.context.documentName ?? snapshot.context.title,
    tenderDeadline: snapshot.context.deadline,
    extractedText: snapshot.context.extractedText,
    requirements: snapshot.requirements.map((r) => {
      const engineReq = engineById.get(r.id);
      return {
        id: r.id,
        category: r.category,
        description: r.description,
        mandatory: r.mandatory,
        value: r.value,
        status: engineReq?.status ?? r.status,
        sourcePage: r.sourcePage,
        sourceSection: r.sourceSection,
        evidence: engineReq?.evidence ?? r.evidence,
        fitStatus: engineReq?.fitStatus ?? null,
        evidenceConflict: engineReq?.evidenceConflict ?? false,
        semanticKind: engineReq?.semanticKind ?? null,
        sourceDocument: engineReq?.sourceDocument ?? null,
        fitProvenanceExcerpt: engineReq?.fitProvenance?.excerpt ?? null,
      };
    }),
    evidence: snapshot.evidence.map((e) => ({
      id: e.id,
      requirementId: e.requirementId,
      sourcePage: e.sourcePage,
      sourceSection: e.sourceSection,
      evidenceText: e.evidenceText,
      verificationStatus: e.verificationStatus,
    })),
    readiness,
    findings: engine.findings,
    existingRisks: snapshot.baselineIntelligence.risks.map((r) => ({
      id: r.id,
      category: r.category,
      description: r.explanation || r.title,
      severity: r.severityCanonical ?? r.severity,
      sourcePage: r.source.page,
      mitigation: r.recommendedAction,
    })),
    decision: engine.decision,
    fitScore: engine.fitScore,
  });

  assertCanonicalRequirementInvariants({
    canonicalRequirementCount: snapshot.requirements.length,
    readiness,
    intelligence,
  });

  const finalized = finalizeTenderDecision({
    engine,
    aiParticipated: false,
    readiness: {
      score: readiness.score,
      counts: readiness.counts,
      attention: readiness.attention,
      recommendation: readiness.recommendation,
    },
    compliance: intelligence.complianceSummary,
    complianceMatrix: intelligence.complianceMatrix,
    keyBlockers: intelligence.keyBlockers,
    structuredRiskTitles: intelligence.risks.map((r) => ({
      title: r.title,
      severity: r.severityCanonical ?? r.severity,
      evidenceState: r.evidenceState ?? null,
      fitStatus: r.fitStatus ?? null,
    })),
    deadline: snapshot.context.deadline,
    asOf,
    memoryInsights: snapshot.memoryInsights,
    teamWorkflow: snapshot.teamWorkflow,
  });

  return {
    decision: finalized.decision,
    displayLabel: finalized.displayLabel,
    confidence: finalized.confidence,
    fitScore: finalized.fitScore,
    fitBreakdown: finalized.fitBreakdown,
    readiness,
    intelligence,
    recommendation: finalized.recommendation,
    isSimulated: true,
  };
}
