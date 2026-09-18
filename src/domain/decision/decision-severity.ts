/**
 * Canonical decision severity — separates hard blockers from review items and drivers.
 * Single source for Web/PDF/explainability blocker language.
 */

import type { DecisionBlocker } from "./decision-integrity";
import type { DeterministicFinding } from "./types";
import {
  CONFIRMED_NON_COMPLIANCE_FINDING_CODES,
  VERIFICATION_ONLY_FINDING_CODES,
} from "@/domain/risk/evidence-signals";
import type {
  ComplianceRow,
  ContradictionFinding,
  StructuredRisk,
} from "@/domain/tender-intelligence";

export type DecisionSeverityKind =
  | "HARD_BLOCKER"
  | "REVIEW_ITEM"
  | "DECISION_DRIVER"
  | "ACTION_ITEM";

export type DecisionSeverityItem = {
  kind: DecisionSeverityKind;
  code: string;
  description: string;
  requirementId?: string | null;
};

export type DecisionSeverityView = {
  hardBlockers: string[];
  reviewItems: string[];
  decisionDrivers: string[];
  actionItems: string[];
  items: DecisionSeverityItem[];
};

function isConfirmedHighRisk(risk: StructuredRisk): boolean {
  const sev = risk.severityCanonical ?? risk.severity;
  if (sev !== "HIGH" && sev !== "CRITICAL") return false;
  if (risk.fitStatus === "NEEDS_VERIFICATION" || risk.fitStatus === "NOT_APPLICABLE") {
    return false;
  }
  if (risk.evidenceState && risk.evidenceState !== "CONFIRMED_NON_COMPLIANT") {
    return false;
  }
  return true;
}

/**
 * Build canonical severity buckets from Fit, compliance, findings, and risks.
 * VERIFY / NEEDS_VERIFICATION → review items, never hard blockers.
 */
export function buildDecisionSeverityView(input: {
  hardBlockers?: DecisionBlocker[];
  complianceMatrix: ComplianceRow[];
  findings?: DeterministicFinding[];
  contradictions?: ContradictionFinding[];
  risks?: StructuredRisk[];
  teamWorkflow?: { titles: string[]; note: string | null } | null;
}): DecisionSeverityView {
  const items: DecisionSeverityItem[] = [];

  for (const b of input.hardBlockers ?? []) {
    items.push({
      kind: "HARD_BLOCKER",
      code: b.code,
      description: b.description,
      requirementId: b.requirementId ?? null,
    });
  }

  const missingConfirmed = input.complianceMatrix.filter(
    (r) => r.mandatory && r.status === "MISSING",
  );
  const verifyMandatory = input.complianceMatrix.filter(
    (r) => r.mandatory && r.status === "VERIFY",
  );

  // Confirmed missing gaps not already in engine hardBlockers
  if (missingConfirmed.length === 1) {
    items.push({
      kind: "HARD_BLOCKER",
      code: "COMPLIANCE_MISSING",
      description: "1 mandatory requirement appears missing.",
    });
  } else if (missingConfirmed.length > 1) {
    items.push({
      kind: "HARD_BLOCKER",
      code: "COMPLIANCE_MISSING",
      description: `${missingConfirmed.length} mandatory requirements appear missing.`,
    });
  }

  if (verifyMandatory.length === 1) {
    items.push({
      kind: "REVIEW_ITEM",
      code: "VERIFY_MANDATORY",
      description: "1 mandatory requirement requires verification.",
    });
  } else if (verifyMandatory.length > 1) {
    items.push({
      kind: "REVIEW_ITEM",
      code: "VERIFY_MANDATORY",
      description: `${verifyMandatory.length} mandatory requirements require verification.`,
    });
  }

  for (const f of input.findings ?? []) {
    if (VERIFICATION_ONLY_FINDING_CODES.has(f.code)) {
      items.push({
        kind: "REVIEW_ITEM",
        code: f.code,
        description: f.description,
        requirementId: null,
      });
      continue;
    }
    if (f.forcesDecision === "NO_BID" && CONFIRMED_NON_COMPLIANCE_FINDING_CODES.has(f.code)) {
      if (!items.some((i) => i.kind === "HARD_BLOCKER" && i.description === f.description)) {
        items.push({
          kind: "HARD_BLOCKER",
          code: f.code,
          description: f.description,
        });
      }
      continue;
    }
    if (f.forcesDecision === "REVIEW" || f.code === "CONTRACT_SIZE_HIGH") {
      items.push({
        kind: "DECISION_DRIVER",
        code: f.code,
        description: f.description,
      });
    }
  }

  if ((input.contradictions?.length ?? 0) > 0) {
    const count = input.contradictions!.length;
    items.push({
      kind: "DECISION_DRIVER",
      code: "CONTRADICTION",
      description:
        count === 1
          ? "1 potential contradiction detected in tender documents."
          : `${count} potential contradictions detected.`,
    });
  }

  const highRisks = (input.risks ?? []).filter(isConfirmedHighRisk);
  if (highRisks.length > 0) {
    items.push({
      kind: "DECISION_DRIVER",
      code: "CONFIRMED_HIGH_RISK",
      description: `${highRisks.length} high-severity confirmed risk${highRisks.length === 1 ? "" : "s"} flagged.`,
    });
  }

  for (const title of input.teamWorkflow?.titles ?? []) {
    items.push({
      kind: "ACTION_ITEM",
      code: "TEAM_TASK",
      description: title,
    });
  }

  const dedupe = (list: DecisionSeverityItem[], kind: DecisionSeverityKind): string[] => {
    const seen = new Set<string>();
    const out: string[] = [];
    for (const item of list) {
      if (item.kind !== kind) continue;
      const key = item.description.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      out.push(item.description);
    }
    return out.slice(0, 8);
  };

  return {
    hardBlockers: dedupe(items, "HARD_BLOCKER"),
    reviewItems: dedupe(items, "REVIEW_ITEM"),
    decisionDrivers: dedupe(items, "DECISION_DRIVER"),
    actionItems: dedupe(items, "ACTION_ITEM"),
    items,
  };
}

/** Runtime guard — report/in explainability must not inflate blocker counts. */
export function assertDecisionSeverityConsistency(view: DecisionSeverityView): void {
  for (const review of view.reviewItems) {
    if (view.hardBlockers.includes(review)) {
      throw new Error(`Review item misclassified as hard blocker: ${review}`);
    }
  }
  for (const driver of view.decisionDrivers) {
    if (view.hardBlockers.includes(driver)) {
      throw new Error(`Decision driver misclassified as hard blocker: ${driver}`);
    }
  }
  for (const action of view.actionItems) {
    if (view.hardBlockers.includes(action)) {
      throw new Error(`Action item misclassified as hard blocker: ${action}`);
    }
  }
}
