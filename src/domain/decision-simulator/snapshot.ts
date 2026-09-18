/**
 * Build immutable simulation snapshots from canonical tender analysis.
 */

import { isProfileSparse } from "@/domain/decision/company-fit";
import { isScoringBlocked } from "@/domain/decision/extraction-gate";
import { toTenderDecisionLabel } from "@/domain/decision/labels";
import type { RuleCompanyProfile } from "@/domain/decision/types";
import type { CanonicalTenderAnalysis } from "@/domain/tender-intelligence/canonical";
import type {
  SimulationSnapshot,
  SimulationTenderContext,
  SimulatableWorkflowTask,
} from "./types";

export type BuildSimulationSnapshotInput = {
  canonical: CanonicalTenderAnalysis;
  profile: RuleCompanyProfile;
  country: string | null;
  industry: string | null;
  estimatedValue: number | null;
  extractedText: string;
  memoryInsights?: SimulationSnapshot["memoryInsights"];
  teamWorkflow?: SimulationSnapshot["teamWorkflow"];
  workflowTasks?: SimulatableWorkflowTask[];
};

export function buildSimulationSnapshot(
  input: BuildSimulationSnapshotInput,
): SimulationSnapshot {
  const { canonical, profile } = input;
  const fitBreakdown = canonical.fitBreakdown;
  const scoringBlocked =
    isScoringBlocked(fitBreakdown) || canonical.companyKnowledgeOnly === true;

  const context: SimulationTenderContext = {
    tenderId: canonical.tenderId,
    companyId: canonical.companyId,
    title: canonical.title,
    client: canonical.client,
    country: input.country,
    industry: input.industry,
    estimatedValue: input.estimatedValue,
    deadline: canonical.deadline ? new Date(canonical.deadline) : null,
    extractedText: input.extractedText,
    documentName: canonical.documentName,
  };

  return {
    context,
    profile: structuredClone(profile),
    requirements: structuredClone(canonical.requirements),
    evidence: structuredClone(canonical.evidence),
    missingDocuments: structuredClone(canonical.missingDocuments),
    memoryInsights: input.memoryInsights ?? null,
    teamWorkflow: input.teamWorkflow ?? null,
    baselineDecision: canonical.decision,
    baselineDisplayLabel: canonical.decision
      ? toTenderDecisionLabel(canonical.decision)
      : "Unknown",
    baselineFitScore: canonical.fitScore,
    baselineConfidence: canonical.confidence,
    baselineReadiness: canonical.readiness
      ? structuredClone(canonical.readiness)
      : null,
    baselineIntelligence: structuredClone(canonical.intelligence),
    companyKnowledgeOnly: canonical.companyKnowledgeOnly === true,
    scoringBlocked,
    workflowTasks: input.workflowTasks ?? [],
  };
}

export function snapshotProfileHasCapability(snapshot: SimulationSnapshot): boolean {
  return !isProfileSparse(snapshot.profile);
}
