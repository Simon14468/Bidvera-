/**
 * Decision Validation Guardian — last structured gate before analysis release.
 *
 * Validates existing structured data only.
 * Does NOT re-run OCR, extraction, LLM analysis, or full tender analysis.
 * Fail-closed: CRITICAL/HIGH failures block COMPLETED reports.
 */

import { BLOCKING_SEVERITIES } from "./codes";
import { checkCanonicalBoundary } from "./checks/canonical-boundary";
import { checkRequirementCompleteness } from "./checks/completeness";
import { checkConditionality } from "./checks/conditionality";
import {
  checkSourceConflicts,
  detectCanonicalSourceConflicts,
} from "./checks/conflicts";
import { checkCrossModuleConsistency } from "./checks/cross-module";
import { checkDeadlines } from "./checks/deadlines";
import { checkDecisionIntegrity } from "./checks/decision";
import { checkDerivedFields } from "./checks/derived-fields";
import { checkDocumentIntegrity } from "./checks/document";
import { checkEvidenceRules } from "./checks/evidence-rules";
import { checkExternalSources } from "./checks/external-sources";
import { checkHighRiskFacts } from "./checks/high-risk-facts";
import { checkProvenance } from "./checks/provenance";
import { checkReportIntegrity } from "./checks/report";
import { checkSemanticIdentity } from "./checks/semantic-identity";
import {
  checkStaleResult,
  checkUnsupportedAiClaims,
} from "./checks/stale-and-ai";
import { failure } from "./helpers";
import type {
  DecisionGuardianInput,
  DecisionGuardianResult,
  GuardianValidationFailure,
} from "./types";
import { DecisionGuardianError } from "./types";

const CHECKS: Array<{
  name: string;
  run: (input: DecisionGuardianInput) => GuardianValidationFailure[];
}> = [
  { name: "document-integrity", run: checkDocumentIntegrity },
  { name: "canonical-boundary", run: checkCanonicalBoundary },
  { name: "requirement-completeness", run: checkRequirementCompleteness },
  { name: "semantic-identity", run: checkSemanticIdentity },
  { name: "conditionality", run: checkConditionality },
  { name: "deadlines", run: checkDeadlines },
  { name: "provenance", run: checkProvenance },
  { name: "high-risk-facts", run: checkHighRiskFacts },
  { name: "evidence-rules", run: checkEvidenceRules },
  { name: "source-conflicts", run: checkSourceConflicts },
  { name: "external-sources", run: checkExternalSources },
  { name: "derived-fields", run: checkDerivedFields },
  { name: "stale-result", run: checkStaleResult },
  { name: "unsupported-ai-claims", run: checkUnsupportedAiClaims },
  { name: "cross-module", run: checkCrossModuleConsistency },
  { name: "decision-integrity", run: checkDecisionIntegrity },
  { name: "report-integrity", run: checkReportIntegrity },
];

export function runDecisionGuardian(
  input: DecisionGuardianInput,
): DecisionGuardianResult {
  const started = Date.now();
  const failures: GuardianValidationFailure[] = [];
  const checksRun: string[] = [];

  for (const check of CHECKS) {
    checksRun.push(check.name);
    try {
      failures.push(...check.run(input));
    } catch (err) {
      failures.push(
        failure({
          validationCode: "GUARDIAN_INTERNAL_ERROR",
          severity: "CRITICAL",
          check: check.name,
          explanation: err instanceof Error ? err.message : String(err),
        }),
      );
    }
  }

  const contradictions = detectCanonicalSourceConflicts(input);

  const blockingFailures = failures.filter((f) =>
    BLOCKING_SEVERITIES.has(f.severity),
  );
  const advisoryFailures = failures.filter(
    (f) => !BLOCKING_SEVERITIES.has(f.severity),
  );

  return {
    ok: blockingFailures.length === 0,
    failures,
    blockingFailures,
    advisoryFailures,
    contradictions,
    validatedAt: new Date().toISOString(),
    durationMs: Date.now() - started,
    checksRun,
  };
}

/**
 * Fail-closed release gate. Throws DecisionGuardianError on CRITICAL/HIGH failures.
 */
export function assertDecisionGuardianReady(
  input: DecisionGuardianInput,
): DecisionGuardianResult {
  const result = runDecisionGuardian(input);
  if (!result.ok) {
    throw new DecisionGuardianError(result);
  }
  return result;
}
