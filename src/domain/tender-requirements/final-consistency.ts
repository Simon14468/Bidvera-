/**
 * Pre-completion consistency checks for canonical analysis.
 * Ensures requirements, risks, and unknowns stay professionally separated.
 */

import { isNonRequirementText, isExplicitlyNotATenderRequirementSection } from "./filter-non-requirements";
import { isRealBidderObligation } from "./obligation";
import { canonicalObligationFingerprint } from "./semantic-dedupe";
import { extractRequirementRef } from "./requirement-ref";
import { formatDeadlineWallClock } from "./tender-deadline";
import {
  isScoringSemanticKind,
  isSemanticKindAlignedWithCategory,
} from "./semantic-kind";
import { isSemanticTripleCompatible } from "./semantic-compatibility";
import {
  hasConditionalTriggerContext,
  reconcileConditionalObligations,
} from "./conditional-context";
import type { NormalizedRequirement } from "./types";
import type { TenderIntelligenceBreakdown } from "@/domain/tender-intelligence";

const FORBIDDEN_REQUIREMENT_CUES =
  /\b(subject\s*:|tender facts|must not be converted|uploaded warranty document with unclear|verification test cases?|purpose of this test|instruction to bidvera|not a tender requirement|illustrate reviewer checks|describe evaluation only)\b/i;

function assertIntelligenceAlignedWithRequirements(
  requirements: NormalizedRequirement[],
  intelligence: TenderIntelligenceBreakdown,
): void {
  const matrix = intelligence.complianceMatrix ?? [];
  if (matrix.length !== requirements.length) {
    throw new Error(
      `Compliance matrix count ${matrix.length} ≠ canonical requirements ${requirements.length}`,
    );
  }

  const summary = intelligence.complianceSummary;
  if (summary && summary.totalRequirements !== requirements.length) {
    throw new Error(
      `Compliance summary total ${summary.totalRequirements} ≠ canonical requirements ${requirements.length}`,
    );
  }

  for (const row of matrix) {
    if (FORBIDDEN_REQUIREMENT_CUES.test(row.requirement)) {
      throw new Error(
        `Non-requirement text in compliance matrix: "${row.requirement.slice(0, 80)}…"`,
      );
    }
  }

  for (const risk of intelligence.risks ?? []) {
    const blob = `${risk.title ?? ""} ${risk.explanation ?? ""} ${risk.recommendedAction ?? ""}`;
    if (FORBIDDEN_REQUIREMENT_CUES.test(blob)) {
      throw new Error(
        `Non-requirement content generated risk: ${risk.id ?? risk.title}`,
      );
    }
  }
}

const UNKNOWN_RISK_LANGUAGE =
  /\b(unknown|unclear|unable\s+to\s+determine|could\s+not\s+determine|needs?\s+verification|unverified|not\s+confirmed)\b/i;

const NON_SCORING_SEMANTIC_KINDS = new Set([
  "EVALUATION_CRITERION",
  "DEADLINE",
  "CLARIFICATION_PROCEDURAL",
  "INFORMATIONAL_FACT",
  "REVIEWER_INSTRUCTION",
  "TEST_SCENARIO",
  "QA_META",
]);

export type AnalysisConsistencyInput = {
  requirements: NormalizedRequirement[];
  intelligence: TenderIntelligenceBreakdown;
  /** Authoritative requirement ids used by engine / compliance matrix / action plan. */
  resolvedRequirementIds?: string[];
  deadline?: CanonicalDeadlineIntegrityInput | null;
  actionPlan?: {
    items: Array<{
      linkedRequirementId: string | null;
      blocking: boolean;
      sourceType: string;
      title: string;
      simulationOnly?: boolean;
    }>;
  } | null;
  /** Map of requirement ref (T-09) → expected section header for provenance checks. */
  expectedProvenance?: Record<string, string>;
};

export type CanonicalDeadlineIntegrityInput = {
  deadlineIso: string | null;
  deadlineTimezone: string | null;
  expectedLocalHour?: number | null;
  expectedLocalMinute?: number | null;
  expectedDateYmd?: string | null;
  /** ISO from a prior parse — detects midnight-UTC / 01:00 display mutations. */
  sourceEvidence?: string | null;
};

function assertConditionalContextPreserved(requirements: NormalizedRequirement[]): void {
  for (const req of requirements) {
    if (req.obligationStrength !== "CONDITIONAL") continue;
    if (!hasConditionalTriggerContext(req.requirement)) {
      throw new Error(
        `Conditional obligation lost trigger context: "${req.requirement.slice(0, 80)}…"`,
      );
    }
    const ref = extractRequirementRef(req.requirement);
    if (ref && !req.requirement.includes(ref)) {
      throw new Error(`Requirement ref ${ref} missing from conditional text`);
    }
    if (ref && req.id && req.id !== ref) {
      throw new Error(`Requirement ref mismatch: id=${req.id} text=${ref}`);
    }
    const text = req.requirement.toLowerCase();
    if (
      !/\b(must|shall|provide|required|requis|obligatoire|devra|doit)\b/i.test(text)
    ) {
      throw new Error(
        `Conditional obligation lost mandatory action: "${req.requirement.slice(0, 80)}…"`,
      );
    }
  }
}

function assertProvenanceIntegrity(
  requirements: NormalizedRequirement[],
  expected?: Record<string, string>,
): void {
  if (!expected) return;
  for (const [ref, section] of Object.entries(expected)) {
    const row = requirements.find(
      (r) => r.id === ref || extractRequirementRef(r.requirement) === ref,
    );
    if (!row) {
      throw new Error(`Expected requirement ${ref} missing from canonical set`);
    }
    const prov = row.sourceSection ?? row.title ?? "";
    if (!prov.toLowerCase().includes(section.toLowerCase().slice(0, 20))) {
      throw new Error(
        `Wrong provenance for ${ref}: expected section containing "${section}", got "${prov}"`,
      );
    }
  }
}

function assertActionCanonicalAlignment(input: {
  requirements: NormalizedRequirement[];
  actionPlan: NonNullable<AnalysisConsistencyInput["actionPlan"]>;
  resolvedRequirementIds?: string[];
}): void {
  const active = input.actionPlan.items.filter(
    (i) => !i.simulationOnly && i.sourceType !== "APPROACHING_DEADLINE" && i.sourceType !== "DECISION_SIMULATOR",
  );
  const reqIds = new Set(
    input.resolvedRequirementIds ??
      input.requirements.map((r, i) => r.id ?? `req-${i + 1}`),
  );
  const byReq = new Map<string, number>();

  for (const item of active) {
    if (!item.linkedRequirementId) continue;
    if (!reqIds.has(item.linkedRequirementId)) {
      throw new Error(
        `Action references unknown requirement id ${item.linkedRequirementId}: "${item.title}"`,
      );
    }
    byReq.set(
      item.linkedRequirementId,
      (byReq.get(item.linkedRequirementId) ?? 0) + 1,
    );
    if (
      item.blocking &&
      (item.sourceType === "UNVERIFIED_EVIDENCE" ||
        item.sourceType === "READINESS_BLOCKER" ||
        /verification required|needs_verification/i.test(item.title))
    ) {
      throw new Error(
        `NEEDS_VERIFICATION / verification action must not be blocking: "${item.title}"`,
      );
    }
  }

  for (const [reqId, count] of byReq) {
    if (count > 1) {
      throw new Error(`Multiple actions for canonical requirement ${reqId} (${count})`);
    }
  }
}

/** Validates deadline ISO preserves stated wall-clock time in tender timezone. */
export function assertCanonicalDeadlineIntegrity(input: CanonicalDeadlineIntegrityInput): void {
  if (!input.deadlineIso || !input.deadlineTimezone) return;

  const wall = formatDeadlineWallClock(input.deadlineIso, input.deadlineTimezone);

  if (input.expectedDateYmd && wall.dateYmd !== input.expectedDateYmd) {
    throw new Error(
      `Deadline date mutated: expected ${input.expectedDateYmd}, got ${wall.dateYmd}`,
    );
  }

  if (
    input.expectedLocalHour != null &&
    input.expectedLocalMinute != null &&
    (wall.hour !== input.expectedLocalHour || wall.minute !== input.expectedLocalMinute)
  ) {
    throw new Error(
      `Deadline time mutated: expected ${input.expectedLocalHour}:${String(input.expectedLocalMinute).padStart(2, "0")}, got ${wall.hour}:${String(wall.minute).padStart(2, "0")} (${input.deadlineTimezone})`,
    );
  }

  if (
    input.sourceEvidence &&
    /\b(\d{1,2}):(\d{2})\b/.test(input.sourceEvidence) &&
    input.expectedLocalHour == null
  ) {
    const m = input.sourceEvidence.match(/\b(\d{1,2}):(\d{2})\b/);
    if (m) {
      const h = Number(m[1]);
      const min = Number(m[2]);
      if (wall.hour !== h || wall.minute !== min) {
        throw new Error(
          `Deadline time drift from source evidence: expected ${h}:${String(min).padStart(2, "0")}, got ${wall.hour}:${String(wall.minute).padStart(2, "0")}`,
        );
      }
    }
  }

  if (input.expectedLocalHour === 10 && input.expectedLocalMinute === 30 && wall.hour === 1 && wall.minute === 0) {
    throw new Error("Deadline midnight-UTC bug: 10:30 tender time became 01:00 display");
  }
}

function assertNoExplicitNonRequirementSections(requirements: NormalizedRequirement[]): void {
  for (const req of requirements) {
    const prov = `${req.sourceSection ?? ""} ${req.requirement}`;
    if (isExplicitlyNotATenderRequirementSection(prov)) {
      throw new Error(
        `Explicit non-requirement section leaked into canonical set: "${req.requirement.slice(0, 80)}…"`,
      );
    }
  }
}

function assertRequirementIntelligenceQuality(requirements: NormalizedRequirement[]): void {
  const fingerprints: string[] = [];

  for (const req of requirements) {
    if (isNonRequirementText(req.requirement)) {
      throw new Error(
        `Non-requirement text in canonical set: "${req.requirement.slice(0, 80)}…"`,
      );
    }

    if (!isScoringSemanticKind(req.semanticKind)) {
      throw new Error(
        `Non-scoring semantic kind in canonical requirements: ${req.semanticKind}`,
      );
    }

    if (NON_SCORING_SEMANTIC_KINDS.has(req.semanticKind)) {
      throw new Error(
        `Separated concept leaked into requirements: ${req.semanticKind}`,
      );
    }

    if (!isSemanticKindAlignedWithCategory(req.semanticKind, req.category)) {
      throw new Error(
        `Semantic kind / category mismatch: ${req.semanticKind} vs ${req.category}`,
      );
    }

    if (
      !isSemanticTripleCompatible({
        semanticKind: req.semanticKind,
        category: req.category,
        obligationStrength: req.obligationStrength,
      })
    ) {
      throw new Error(
        `Semantic triple incompatible: ${req.semanticKind} / ${req.category} / ${req.obligationStrength}`,
      );
    }

    if (req.mandatory && req.obligationStrength === "OPTIONAL") {
      throw new Error(
        `Mandatory flag contradicts optional obligation strength: "${req.requirement.slice(0, 60)}…"`,
      );
    }

    if (req.obligationStrength === "INFORMATIONAL" && req.mandatory) {
      throw new Error(
        `Informational obligation marked mandatory: "${req.requirement.slice(0, 60)}…"`,
      );
    }

    if (
      req.semanticKind === "UNKNOWN" &&
      req.confidence !== "UNCERTAIN" &&
      req.confidence !== "LOW"
    ) {
      throw new Error(
        `Unknown semantic kind must have uncertain/low confidence: "${req.requirement.slice(0, 60)}…"`,
      );
    }

    if (!isRealBidderObligation(req.requirement) && req.semanticKind !== "UNKNOWN") {
      throw new Error(
        `Canonical row lacks bidder obligation cues: "${req.requirement.slice(0, 60)}…"`,
      );
    }

    fingerprints.push(canonicalObligationFingerprint(req));
  }

  const unique = new Set(fingerprints);
  if (unique.size !== fingerprints.length) {
    throw new Error(
      `Duplicate obligation fingerprints in canonical requirements (${fingerprints.length} rows, ${unique.size} unique)`,
    );
  }
}

/**
 * Validates canonical extraction quality before marking analysis COMPLETED.
 * Throws on invariant violations — never silently passes bad data downstream.
 */
export function assertAnalysisReadyForCompletion(input: AnalysisConsistencyInput): void {
  // Repair orphan CONDITIONAL rows (recover evidence trigger or NEEDS_VERIFICATION)
  // before hard checks — never crash the analysis when context is genuinely gone.
  const repaired = reconcileConditionalObligations(input.requirements);
  for (let i = 0; i < input.requirements.length; i++) {
    input.requirements[i] = repaired[i]!;
  }

  const { requirements, intelligence } = input;

  assertRequirementIntelligenceQuality(requirements);
  assertIntelligenceAlignedWithRequirements(requirements, intelligence);
  assertConditionalContextPreserved(requirements);
  assertNoExplicitNonRequirementSections(requirements);
  assertProvenanceIntegrity(requirements, input.expectedProvenance);

  if (input.deadline) {
    assertCanonicalDeadlineIntegrity(input.deadline);
  }

  if (input.actionPlan) {
    assertActionCanonicalAlignment({
      requirements,
      actionPlan: input.actionPlan,
      resolvedRequirementIds: input.resolvedRequirementIds,
    });
  }

  for (const risk of intelligence.risks ?? []) {
    if (
      (risk.severityCanonical === "CRITICAL" || risk.severity === "HIGH") &&
      UNKNOWN_RISK_LANGUAGE.test(`${risk.title ?? ""} ${risk.explanation ?? ""}`)
    ) {
      throw new Error(
        `High-severity risk based on uncertainty language: ${risk.id ?? risk.title}`,
      );
    }
  }
}
