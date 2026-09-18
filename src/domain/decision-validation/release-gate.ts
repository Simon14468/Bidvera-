/**
 * Report publication gate — Web/PDF must not release without Guardian snapshot.
 * Fail-closed for full tender analyses. Incomplete / company-only modes exempt.
 */

import { DecisionGuardianError } from "./types";
import { failure } from "./helpers";
import {
  isDecisionGuardianSnapshot,
  type DecisionGuardianSnapshot,
} from "./snapshot";
import { BLOCKING_SEVERITIES } from "./codes";
import type { DecisionGuardianResult } from "./types";

export type ReportPublicationInput = {
  companyKnowledgeOnly?: boolean;
  analysisMode?: "TENDER" | "COMPANY_KNOWLEDGE_ONLY" | null;
  /** Only explicit COMPLETE requires Guardian. Null/INCOMPLETE must not invent COMPLETE. */
  complianceStatus?: "COMPLETE" | "INCOMPLETE" | null;
  decisionGuardian?: DecisionGuardianSnapshot | null;
  /** Current projected content hash — must match snapshot when present. */
  projectedContentHash?: string | null;
  web?: {
    decision: string | null;
    fitScore: number | null;
    deadlineIso: string | null;
    requirementCount: number;
  };
  pdf?: {
    decision: string | null;
    fitScore: number | null;
    deadlineIso: string | null;
    requirementCount: number;
  };
};

function blockedResult(explanation: string): DecisionGuardianResult {
  const f = failure({
    validationCode: "STALE_RESULT_MISMATCH",
    severity: "CRITICAL",
    check: "report-publication-gate",
    explanation,
  });
  return {
    ok: false,
    failures: [f],
    blockingFailures: [f],
    advisoryFailures: [],
    contradictions: [],
    validatedAt: new Date().toISOString(),
    durationMs: 0,
    checksRun: ["report-publication-gate"],
  };
}

/**
 * Throws DecisionGuardianError when publication must be blocked.
 */
export function assertReportPublicationAllowed(
  input: ReportPublicationInput,
): void {
  if (input.companyKnowledgeOnly || input.analysisMode === "COMPANY_KNOWLEDGE_ONLY") {
    return;
  }
  // Only an explicit COMPLETE analysis requires a Guardian snapshot.
  // Never treat missing/null status as COMPLETE (that invented a false release gate).
  if (input.complianceStatus !== "COMPLETE") {
    return;
  }

  // Full tender analysis — Guardian snapshot mandatory
  if (!isDecisionGuardianSnapshot(input.decisionGuardian)) {
    throw new DecisionGuardianError(
      blockedResult(
        "Report publication blocked: Decision Guardian snapshot missing or invalid. Analysis must pass the final gate before Web/PDF release.",
      ),
    );
  }

  if (
    input.projectedContentHash &&
    input.decisionGuardian.contentHash !== input.projectedContentHash
  ) {
    throw new DecisionGuardianError(
      blockedResult(
        "Report publication blocked: projected dataset hash diverges from Guardian-validated canonical hash (stale result).",
      ),
    );
  }

  if (input.web && input.pdf) {
    const mismatches: string[] = [];
    if (input.web.decision !== input.pdf.decision) {
      mismatches.push(`decision web=${input.web.decision} pdf=${input.pdf.decision}`);
    }
    if (input.web.fitScore !== input.pdf.fitScore) {
      mismatches.push(`fit web=${input.web.fitScore} pdf=${input.pdf.fitScore}`);
    }
    if (input.web.deadlineIso !== input.pdf.deadlineIso) {
      mismatches.push(
        `deadline web=${input.web.deadlineIso} pdf=${input.pdf.deadlineIso}`,
      );
    }
    if (input.web.requirementCount !== input.pdf.requirementCount) {
      mismatches.push(
        `counts web=${input.web.requirementCount} pdf=${input.pdf.requirementCount}`,
      );
    }
    if (mismatches.length > 0) {
      const f = failure({
        validationCode: "REPORT_DATASET_MISMATCH",
        severity: "CRITICAL",
        check: "report-publication-gate",
        explanation: `Web/PDF mismatch before publication: ${mismatches.join("; ")}`,
      });
      throw new DecisionGuardianError({
        ok: false,
        failures: [f],
        blockingFailures: [f],
        advisoryFailures: [],
        contradictions: [],
        validatedAt: new Date().toISOString(),
        durationMs: 0,
        checksRun: ["report-publication-gate"],
      });
    }
  }

  void BLOCKING_SEVERITIES;
}
