import {
  computeCompanyTenderFit,
  formatFitReasoning,
  isProfileSparse,
  suggestDecisionFromFit,
} from "./company-fit";
import { assertCanonicalFitConsistency } from "./fit-consistency";
import { evaluateDeterministicRules } from "./rules";
import {
  assertRequirementFitConsistency,
  finalizeRequirementFit,
} from "./requirement-fit-status";
import {
  assertDecisionIntegrity,
  resolveCanonicalDecision,
  type DecisionExplainabilityInputs,
} from "./decision-integrity";
import {
  scoreToConfidence,
  type DecisionEngineInput,
  type DecisionEngineOutput,
} from "./types";
import type { ConfidenceLevel, DecisionType } from "@prisma/client";
import { weightedRequirementsScore } from "@/domain/tender-requirements";

function scoreFromRequirements(requirements: DecisionEngineInput["requirements"]): number {
  return weightedRequirementsScore(requirements);
}

/**
 * Core Bidvera decision engine — single authoritative BID / REVIEW / NO_BID source.
 *
 * Decision priority:
 * 1. Document validity (upstream extraction gate)
 * 2. Applicable mandatory requirements (Fit)
 * 3. Confirmed company gaps
 * 4. Confirmed material findings / risks
 * 5. Financial/commercial constraints (rules)
 * 6. Deadline/procedural (finalize refinement)
 * 7. Verification uncertainty
 * 8. Overall readiness / company–tender fit
 *
 * AI never overrides canonical Fit/Risk. Hard mandatory confirmed gaps → NO_BID.
 * NEEDS_VERIFICATION never alone forces NO_BID.
 */
export function runDecisionEngine(input: DecisionEngineInput): DecisionEngineOutput {
  const { findings, requirements: ruledRequirements } = evaluateDeterministicRules({
    profile: input.profile,
    requirements: input.requirements,
    estimatedValue: input.estimatedValue,
  });

  const requirements = finalizeRequirementFit({
    requirements: ruledRequirements.map((r) => ({
      ...r,
      semanticKind: r.semanticKind ?? null,
      sourceDocument: r.sourceDocument ?? null,
      page: r.page ?? null,
      section: r.section ?? null,
      rationale: r.rationale ?? null,
      evidenceConflict: r.evidenceConflict ?? false,
    })),
    findings,
  }).map((r) => ({
    id: r.id,
    category: r.category,
    description: r.description,
    mandatory: r.mandatory,
    value: r.value,
    status: r.status,
    evidence: r.evidence,
    fitStatus: r.fitStatus,
    fitProvenance: r.fitProvenance,
    evidenceConflict: r.evidenceConflict,
    semanticKind: r.semanticKind ?? null,
    sourceDocument: r.sourceDocument ?? null,
    page: r.page ?? null,
    section: r.section ?? null,
    rationale: r.rationale ?? null,
  }));

  assertRequirementFitConsistency(
    requirements.map((r) => ({
      requirementId: r.id,
      description: r.description,
      fitStatus: r.fitStatus!,
      fitProvenance: r.fitProvenance ?? null,
      evidenceConflict: r.evidenceConflict,
    })),
  );

  const baseScore = scoreFromRequirements(requirements);
  const ai = input.ai;

  const ctx = input.tenderContext ?? {
    title: "Tender",
    client: null,
    country: null,
    industry: null,
    tenderText: requirements.map((r) => `${r.category} ${r.description}`).join("\n"),
  };

  const fitBreakdown = computeCompanyTenderFit({
    profile: input.profile,
    requirements,
    context: {
      title: ctx.title,
      client: ctx.client,
      country: ctx.country,
      industry: ctx.industry,
      estimatedValue: input.estimatedValue,
      tenderText: ctx.tenderText,
    },
  });

  // Provisional hardNoBid for fit suggestion only — integrity layer is authoritative
  const fromFit = suggestDecisionFromFit({
    fit: fitBreakdown,
    hardNoBid: false,
    forcedReview: false,
  });

  const integrity = resolveCanonicalDecision({
    requirements,
    findings,
    fitSuggestedDecision: fromFit.decision,
    aiSuggestedDecision: ai?.suggestedDecision ?? null,
  });

  let decision: DecisionType = integrity.decision;
  const hardFailure = integrity.hardFailure;

  let fitScore = fitBreakdown.overall ?? baseScore;
  let confidence: ConfidenceLevel =
    ai?.confidence ?? fromFit.confidence ?? scoreToConfidence(fitScore);

  const sparse = isProfileSparse(input.profile);

  if (hardFailure) {
    decision = "NO_BID";
    fitScore = Math.min(fitScore, 40);
    confidence = "HIGH";
  } else if (decision === "REVIEW") {
    if (confidence === "HIGH") confidence = "MEDIUM";
    if (!ai) {
      confidence = fromFit.confidence === "HIGH" ? "MEDIUM" : fromFit.confidence;
    }
  } else if (!ai) {
    confidence = fromFit.confidence;
  }

  // High uncertainty ratio — never upgrade to BID; never invent NO_BID
  const uncertainRatio =
    requirements.filter(
      (r) => r.fitStatus === "NEEDS_VERIFICATION" || r.status === "UNCERTAIN" || r.status === "MISSING",
    ).length / Math.max(requirements.length, 1);
  if (uncertainRatio > 0.4) {
    if (confidence === "HIGH") confidence = "MEDIUM";
    if (decision === "BID") decision = "REVIEW";
    if (!hardFailure && decision === "NO_BID") decision = "REVIEW";
  }

  fitScore = Math.max(0, Math.min(100, fitScore));
  fitBreakdown.overall = fitScore;

  assertCanonicalFitConsistency({
    fitScore,
    fitBreakdown,
    label: "decision-engine",
  });

  let reasoning = formatFitReasoning({
    decision,
    fit: fitBreakdown,
    profileSparse: sparse,
  });
  if (hardFailure) {
    reasoning = formatFitReasoning({
      decision: "NO_BID",
      fit: {
        ...fitBreakdown,
        gaps: [
          ...integrity.blockers.map((b) => b.description),
          ...fitBreakdown.gaps,
        ],
      },
      profileSparse: sparse,
    });
  } else if (ai?.reasoning && !hardFailure) {
    reasoning = `${reasoning}\n\nAI assessment (not verified fact):\n${ai.reasoning}`;
  }

  assertDecisionIntegrity({
    decision,
    hardFailure,
    blockers: integrity.blockers,
    requirements,
    findings,
    aiSuggestedDecision: ai?.suggestedDecision ?? null,
  });

  const explainability: DecisionExplainabilityInputs = integrity.explainability;

  return {
    decision,
    fitScore,
    confidence,
    reasoning,
    findings,
    requirements,
    hardFailure,
    matchedRequirements: requirements.filter((r) => r.fitStatus === "CONFIRMED_FIT"),
    failedRequirements: requirements.filter((r) => r.fitStatus === "CONFIRMED_GAP"),
    uncertainRequirements: requirements.filter(
      (r) => r.fitStatus === "NEEDS_VERIFICATION" || r.fitStatus === "NOT_APPLICABLE",
    ),
    fitBreakdown,
    explainability,
    hardBlockers: integrity.blockers,
  };
}
