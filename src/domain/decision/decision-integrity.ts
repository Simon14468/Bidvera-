/**
 * Canonical Decision Integrity — single authoritative BID / REVIEW / NO_BID logic.
 *
 * Consumes Fit + findings (+ optional confirmed risks at finalize).
 * Never decides from raw tender text. AI never overrides hard blockers.
 * NEEDS_VERIFICATION never alone forces NO_BID.
 */

import type { RequirementFitStatus } from "@/domain/decision/requirement-fit-status";
import type {
  DeterministicFinding,
  RuleRequirement,
} from "@/domain/decision/types";
import {
  CONFIRMED_NON_COMPLIANCE_FINDING_CODES,
  VERIFICATION_ONLY_FINDING_CODES,
} from "@/domain/risk/evidence-signals";
import type { DecisionType } from "@prisma/client";

export type DecisionBlockerKind =
  | "CONFIRMED_GAP"
  | "CONFIRMED_FINDING"
  | "CONFIRMED_RISK"
  | "FINANCIAL_COMMERCIAL"
  | "DEADLINE_PROCEDURAL";

export type DecisionBlocker = {
  kind: DecisionBlockerKind;
  code: string;
  description: string;
  requirementId?: string | null;
  fitStatus?: RequirementFitStatus | null;
  underlyingKey: string;
  material: boolean;
};

export type DecisionExplainabilityInputs = {
  confirmedBlockers: DecisionBlocker[];
  verificationItems: Array<{
    requirementId?: string | null;
    description: string;
    fitStatus: RequirementFitStatus;
    underlyingKey: string;
  }>;
  supportingFits: Array<{
    requirementId?: string | null;
    description: string;
    evidence?: string | null;
  }>;
  importantUnverified: Array<{
    requirementId?: string | null;
    description: string;
  }>;
};

export type DecisionIntegrityResult = {
  hardFailure: boolean;
  forcedDecision: DecisionType | null;
  decision: DecisionType;
  blockers: DecisionBlocker[];
  verificationItems: DecisionExplainabilityInputs["verificationItems"];
  explainability: DecisionExplainabilityInputs;
};

function normalizeKey(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 80);
}

/** Informational / non-scoring / procedural — never hard blockers. */
export function isNonBlockingRequirement(req: RuleRequirement): boolean {
  if (!req.mandatory) return true;
  if (/^INFORMATIONAL$/i.test(req.category)) return true;
  const kind = req.semanticKind ?? "";
  if (
    kind === "INFORMATIONAL_FACT" ||
    kind === "EVALUATION_CRITERION" ||
    kind === "CLARIFICATION_PROCEDURAL" ||
    kind === "DEADLINE"
  ) {
    return true;
  }
  if (req.fitStatus === "NOT_APPLICABLE") return true;
  return false;
}

export function underlyingDecisionIssueKey(input: {
  description: string;
  findingCode?: string | null;
  fitStatus?: RequirementFitStatus | null;
  category?: string | null;
}): string {
  const cert = input.description.match(
    /\b(ISO\s?\d+|Cyber Essentials(?:\sPlus)?|CHAS|SafeContractor)\b/i,
  );
  if (cert) return `cert:${normalizeKey(cert[1]!)}`;
  const years = input.description.match(/(\d+)\s*\+?\s*years?/i);
  if (years && /\bexperience\b/i.test(input.description)) {
    return `experience:${years[1]}`;
  }
  if (input.findingCode && CONFIRMED_NON_COMPLIANCE_FINDING_CODES.has(input.findingCode)) {
    return `finding:${input.findingCode}`;
  }
  if (input.findingCode) {
    return `finding:${input.findingCode}:${normalizeKey(input.description).slice(0, 40)}`;
  }
  return `${input.fitStatus ?? "issue"}:${normalizeKey(input.description)}`;
}

function dedupeBlockers(blockers: DecisionBlocker[]): DecisionBlocker[] {
  const seen = new Map<string, DecisionBlocker>();
  for (const b of blockers) {
    if (!seen.has(b.underlyingKey)) {
      seen.set(b.underlyingKey, b);
    }
  }
  return [...seen.values()];
}

/**
 * Collect material hard blockers from Fit + confirmed findings only.
 * Verification-only findings never become hard blockers.
 */
export function collectMaterialHardBlockers(input: {
  requirements: RuleRequirement[];
  findings: DeterministicFinding[];
}): DecisionBlocker[] {
  const blockers: DecisionBlocker[] = [];

  for (const req of input.requirements) {
    if (isNonBlockingRequirement(req)) continue;
    if (req.fitStatus !== "CONFIRMED_GAP") continue;
    // CONFIRMED_FIT must never appear as a failure — guarded by status check above
    blockers.push({
      kind: "CONFIRMED_GAP",
      code: "MANDATORY_CONFIRMED_GAP",
      description: req.description,
      requirementId: req.id ?? null,
      fitStatus: "CONFIRMED_GAP",
      underlyingKey: underlyingDecisionIssueKey({
        description: req.description,
        fitStatus: "CONFIRMED_GAP",
        category: req.category,
      }),
      material: true,
    });
  }

  for (const f of input.findings) {
    if (VERIFICATION_ONLY_FINDING_CODES.has(f.code)) continue;
    if (f.forcesDecision !== "NO_BID") continue;
    if (!CONFIRMED_NON_COMPLIANCE_FINDING_CODES.has(f.code) && f.severity !== "CRITICAL") {
      // Soft/custom — only honor if linked requirement is a confirmed gap / failed
      if (f.requirementIndex != null) {
        const req = input.requirements[f.requirementIndex];
        if (!req || req.fitStatus === "NEEDS_VERIFICATION" || req.fitStatus === "NOT_APPLICABLE") {
          continue;
        }
        if (req.fitStatus === "CONFIRMED_FIT") continue;
        if (isNonBlockingRequirement(req)) continue;
      }
    }
    const linked =
      f.requirementIndex != null ? input.requirements[f.requirementIndex] : null;
    if (linked?.fitStatus === "CONFIRMED_FIT") continue;
    if (linked && isNonBlockingRequirement(linked)) continue;

    const kind: DecisionBlockerKind =
      f.code === "REVENUE_BELOW" || f.category === "financial"
        ? "FINANCIAL_COMMERCIAL"
        : f.category === "geography"
          ? "CONFIRMED_FINDING"
          : "CONFIRMED_FINDING";

    blockers.push({
      kind,
      code: f.code,
      description: f.description,
      requirementId: linked?.id ?? null,
      fitStatus: linked?.fitStatus ?? null,
      underlyingKey: underlyingDecisionIssueKey({
        description: linked?.description ?? f.description,
        findingCode: f.code,
        fitStatus: linked?.fitStatus,
        category: f.category,
      }),
      material: true,
    });
  }

  return dedupeBlockers(blockers);
}

export function collectVerificationItems(
  requirements: RuleRequirement[],
): DecisionExplainabilityInputs["verificationItems"] {
  const items: DecisionExplainabilityInputs["verificationItems"] = [];
  const seen = new Set<string>();
  for (const req of requirements) {
    if (isNonBlockingRequirement(req) && req.fitStatus !== "NEEDS_VERIFICATION") {
      continue;
    }
    if (req.fitStatus !== "NEEDS_VERIFICATION") continue;
    if (!req.mandatory && req.fitStatus === "NEEDS_VERIFICATION") {
      // Still surface mandatory-ish verification; optional go to importantUnverified separately
      if (!req.mandatory) continue;
    }
    const key = underlyingDecisionIssueKey({
      description: req.description,
      fitStatus: "NEEDS_VERIFICATION",
      category: req.category,
    });
    if (seen.has(key)) continue;
    seen.add(key);
    items.push({
      requirementId: req.id ?? null,
      description: req.description,
      fitStatus: "NEEDS_VERIFICATION",
      underlyingKey: key,
    });
  }
  return items;
}

/**
 * Resolve core decision from Fit + findings before readiness/deadline refinement.
 *
 * Priority:
 * 1. Document validity — upstream extraction gate
 * 2–4. Applicable mandatory confirmed gaps / confirmed findings → NO_BID
 * 5–6. Financial findings in hard blockers; deadline refined later
 * 7. Verification uncertainty → REVIEW (never NO_BID alone)
 * 8. Overall fit suggestion
 */
export function resolveCanonicalDecision(input: {
  requirements: RuleRequirement[];
  findings: DeterministicFinding[];
  /** Deterministic suggestion from company–tender fit when no hard blocker. */
  fitSuggestedDecision: DecisionType;
  /** AI suggestion — advisory only; never creates NO_BID or clears hard blockers. */
  aiSuggestedDecision?: DecisionType | null;
}): DecisionIntegrityResult {
  const blockers = collectMaterialHardBlockers({
    requirements: input.requirements,
    findings: input.findings,
  });
  const verificationItems = collectVerificationItems(input.requirements);
  const supportingFits = input.requirements
    .filter((r) => r.fitStatus === "CONFIRMED_FIT")
    .slice(0, 12)
    .map((r) => ({
      requirementId: r.id ?? null,
      description: r.description,
      evidence: r.evidence ?? r.fitProvenance?.excerpt ?? null,
    }));
  const importantUnverified = input.requirements
    .filter((r) => r.fitStatus === "NEEDS_VERIFICATION" && !r.mandatory)
    .slice(0, 8)
    .map((r) => ({
      requirementId: r.id ?? null,
      description: r.description,
    }));

  const hardFailure = blockers.length > 0;
  const forcedReviewFromFindings = input.findings.some(
    (f) => f.forcesDecision === "REVIEW",
  );

  let decision: DecisionType;
  let forcedDecision: DecisionType | null = null;

  if (hardFailure) {
    decision = "NO_BID";
    forcedDecision = "NO_BID";
  } else {
    // Start from fit suggestion; never accept bare fit NO_BID without hard blockers
    decision =
      input.fitSuggestedDecision === "NO_BID" ? "REVIEW" : input.fitSuggestedDecision;

    if (forcedReviewFromFindings || verificationItems.length > 0) {
      decision = "REVIEW";
      forcedDecision = "REVIEW";
    }

    // AI is advisory only
    const ai = input.aiSuggestedDecision ?? null;
    if (ai === "NO_BID") {
      // Soft AI NO_BID without confirmed blocker → REVIEW
      decision = "REVIEW";
    } else if (ai === "REVIEW" && decision === "BID") {
      decision = "REVIEW";
    } else if (ai === "BID" && decision === "REVIEW") {
      // AI cannot upgrade past verification / review
      decision = "REVIEW";
    }
  }

  // Safety nets
  if (decision === "NO_BID" && !hardFailure) decision = "REVIEW";
  if (decision === "BID" && verificationItems.length > 0) decision = "REVIEW";

  return {
    hardFailure,
    forcedDecision,
    decision,
    blockers,
    verificationItems,
    explainability: {
      confirmedBlockers: blockers,
      verificationItems,
      supportingFits,
      importantUnverified,
    },
  };
}

/** Runtime invariants for final decision integrity. */
export function assertDecisionIntegrity(input: {
  decision: DecisionType;
  hardFailure: boolean;
  blockers: DecisionBlocker[];
  requirements: RuleRequirement[];
  findings: DeterministicFinding[];
  aiSuggestedDecision?: DecisionType | null;
}): void {
  const { decision, hardFailure, blockers, requirements, findings } = input;

  if (hardFailure && decision !== "NO_BID") {
    throw new Error("Hard failure must yield NO_BID");
  }
  if (decision === "NO_BID" && blockers.length === 0 && !hardFailure) {
    throw new Error("NO_BID without material hard blockers");
  }

  // NO_BID must not be caused only by NEEDS_VERIFICATION / missing evidence
  if (decision === "NO_BID") {
    const onlyVerification =
      blockers.length === 0 &&
      requirements.some((r) => r.fitStatus === "NEEDS_VERIFICATION") &&
      !requirements.some((r) => r.mandatory && r.fitStatus === "CONFIRMED_GAP");
    if (onlyVerification) {
      throw new Error("NO_BID caused only by NEEDS_VERIFICATION / missing evidence");
    }
    const verificationForced = findings.every(
      (f) => !f.forcesDecision || f.forcesDecision !== "NO_BID" || VERIFICATION_ONLY_FINDING_CODES.has(f.code),
    );
    if (
      blockers.length === 0 &&
      verificationForced &&
      !requirements.some((r) => r.mandatory && r.fitStatus === "CONFIRMED_GAP")
    ) {
      throw new Error("NO_BID without confirmed non-compliance");
    }
  }

  // BID while confirmed mandatory material blocker exists
  if (decision === "BID") {
    const materialGap = requirements.some(
      (r) => r.mandatory && r.fitStatus === "CONFIRMED_GAP" && !isNonBlockingRequirement(r),
    );
    if (materialGap || hardFailure) {
      throw new Error("BID while a confirmed mandatory material blocker exists");
    }
  }

  // CONFIRMED_FIT must never be counted as a failure blocker
  for (const b of blockers) {
    if (b.fitStatus === "CONFIRMED_FIT") {
      throw new Error("CONFIRMED_FIT counted as a failure blocker");
    }
  }

  // Optional / informational must not create hard blockers
  for (const b of blockers) {
    if (!b.requirementId) continue;
    const req = requirements.find((r) => r.id === b.requirementId);
    if (req && isNonBlockingRequirement(req) && req.fitStatus !== "CONFIRMED_GAP") {
      throw new Error("Optional/informational requirement created a hard blocker");
    }
    if (req && isNonBlockingRequirement(req) && !req.mandatory) {
      throw new Error("Optional requirement created a hard blocker");
    }
  }

  // Duplicate underlying blockers
  const keys = blockers.map((b) => b.underlyingKey);
  if (new Set(keys).size !== keys.length) {
    throw new Error("Duplicate hard blockers for the same underlying issue");
  }

  // Decision must not contradict Fit: NO_BID requires at least one CONFIRMED_GAP or confirmed finding
  if (decision === "NO_BID") {
    const hasGap = requirements.some((r) => r.fitStatus === "CONFIRMED_GAP");
    const hasConfirmedFinding = findings.some(
      (f) =>
        f.forcesDecision === "NO_BID" &&
        !VERIFICATION_ONLY_FINDING_CODES.has(f.code),
    );
    if (!hasGap && !hasConfirmedFinding && blockers.length === 0) {
      throw new Error("Decision contradicts canonical Fit Status");
    }
  }

  // AI must not be the sole source of NO_BID
  if (
    decision === "NO_BID" &&
    input.aiSuggestedDecision === "NO_BID" &&
    blockers.length === 0
  ) {
    throw new Error("AI recommendation overrode deterministic canonical decision logic");
  }
}
