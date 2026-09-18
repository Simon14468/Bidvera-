/**
 * Cross-layer analysis integrity — compose existing invariants + Phase-3 rules.
 */

import { assertCanonicalSnapshotInvariants } from "@/domain/tender-intelligence/canonical-snapshot";
import type { CanonicalAnalysisSnapshot } from "@/domain/tender-intelligence/canonical-snapshot";
import type { ComplianceRow, ComplianceSummary } from "@/domain/tender-intelligence/types";
import type { TenderReadinessBreakdown } from "@/domain/decision/tender-readiness";
import type { TenderActionPlanBundle } from "@/domain/tender-action-plan";
import {
  ANALYSIS_INTEGRITY_VERSION,
  type AnalysisIntegrityAttestation,
  type UniversalAnalysisIntegrityInput,
} from "./types";

export class AnalysisIntegrityError extends Error {
  readonly code: string;
  constructor(code: string, message: string) {
    super(`[analysis-integrity:${code}] ${message}`);
    this.code = code;
    this.name = "AnalysisIntegrityError";
  }
}

function partitionFromSummary(
  summary: UniversalAnalysisIntegrityInput["summary"],
  total: number,
): {
  totalRequirements: number;
  verifiedRequirements: number;
  verified: number;
  needsVerification: number;
  confirmedGaps: number;
  notApplicable: number;
} {
  const verified = summary.ready;
  const needsVerification = summary.verify + summary.unknown;
  const confirmedGaps = summary.missing;
  const notApplicable = summary.notApplicable;
  return {
    totalRequirements: total,
    verifiedRequirements: verified,
    verified,
    needsVerification,
    confirmedGaps,
    notApplicable,
  };
}

/**
 * Assert the mandatory count partition and cross-layer linkage.
 * Throws AnalysisIntegrityError on failure.
 */
export function assertUniversalAnalysisIntegrity(
  input: UniversalAnalysisIntegrityInput,
): AnalysisIntegrityAttestation {
  const checksPassed: string[] = [];
  const idSet = new Set(input.requirementIds);

  if (new Set(input.requirementIds).size !== input.requirementIds.length) {
    throw new AnalysisIntegrityError("DUP_REQ_ID", "Canonical requirement IDs are not unique");
  }
  checksPassed.push("unique_requirement_ids");

  if (input.requirementIds.length !== input.canonicalRequirementCount) {
    throw new AnalysisIntegrityError(
      "REQ_COUNT",
      `requirementIds ${input.requirementIds.length} ≠ canonical ${input.canonicalRequirementCount}`,
    );
  }
  checksPassed.push("requirement_id_count");

  const counts = partitionFromSummary(input.summary, input.canonicalRequirementCount);
  const partitionSum =
    counts.verified +
    counts.needsVerification +
    counts.confirmedGaps +
    counts.notApplicable;
  if (partitionSum !== counts.totalRequirements) {
    throw new AnalysisIntegrityError(
      "PARTITION",
      `Count partition broken: ${counts.verified}+${counts.needsVerification}+${counts.confirmedGaps}+${counts.notApplicable}=${partitionSum} ≠ ${counts.totalRequirements}`,
    );
  }
  checksPassed.push("count_partition");

  if (input.summary.totalRequirements !== counts.totalRequirements) {
    throw new AnalysisIntegrityError(
      "SUMMARY_TOTAL",
      `summary.totalRequirements ${input.summary.totalRequirements} ≠ partition total`,
    );
  }
  checksPassed.push("summary_total");

  if (
    input.readinessTotal != null &&
    input.readinessTotal !== counts.totalRequirements
  ) {
    throw new AnalysisIntegrityError(
      "READINESS_TOTAL",
      `readiness total ${input.readinessTotal} ≠ ${counts.totalRequirements}`,
    );
  }
  checksPassed.push("readiness_total");

  // Matrix IDs ⊆ canonical IDs
  for (const mid of input.matrixRequirementIds) {
    if (!idSet.has(mid)) {
      throw new AnalysisIntegrityError(
        "ORPHAN_MATRIX",
        `Matrix row references unknown requirement ${mid}`,
      );
    }
  }
  if (input.matrixRequirementIds.length !== input.canonicalRequirementCount) {
    throw new AnalysisIntegrityError(
      "MATRIX_LEN",
      `matrix ids ${input.matrixRequirementIds.length} ≠ canonical ${input.canonicalRequirementCount}`,
    );
  }
  checksPassed.push("matrix_linkage");

  // Fit integrity
  let confirmedGapWithoutCompanyEvidence = 0;
  let confirmedFitWithoutCompanyEvidence = 0;
  for (const row of input.fitRows) {
    if (row.requirementId && !idSet.has(row.requirementId)) {
      throw new AnalysisIntegrityError(
        "ORPHAN_FIT",
        `Fit row references unknown requirement ${row.requirementId}`,
      );
    }
    if (row.fitStatus === "CONFIRMED_GAP" && !row.companyEvidence?.trim()) {
      confirmedGapWithoutCompanyEvidence += 1;
    }
    if (row.fitStatus === "CONFIRMED_FIT" && !row.companyEvidence?.trim()) {
      confirmedFitWithoutCompanyEvidence += 1;
    }
  }
  if (confirmedGapWithoutCompanyEvidence > 0) {
    throw new AnalysisIntegrityError(
      "EVIDENCE_GAP",
      `${confirmedGapWithoutCompanyEvidence} CONFIRMED_GAP row(s) lack company evidence (missing ≠ gap)`,
    );
  }
  if (confirmedFitWithoutCompanyEvidence > 0) {
    throw new AnalysisIntegrityError(
      "EVIDENCE_FIT",
      `${confirmedFitWithoutCompanyEvidence} CONFIRMED_FIT row(s) lack positive company evidence`,
    );
  }
  checksPassed.push("fit_evidence_integrity");

  // Conditionality / lot survival — when present on fit rows, must not be stripped to empty for CONDITIONAL
  for (const row of input.fitRows) {
    if (row.obligationStrength === "CONDITIONAL" && !row.conditionText?.trim()) {
      throw new AnalysisIntegrityError(
        "CONDITIONALITY_LOST",
        `Conditional requirement ${row.requirementId ?? "?"} lost trigger/condition context`,
      );
    }
  }
  checksPassed.push("conditionality_survival");

  // Risk integrity — must reference canonical requirement; no orphan
  let orphanRisks = 0;
  const riskRequirementIds: string[] = [];
  const seenUnderlying = new Set<string>();
  for (const risk of input.risks) {
    const linked = [
      ...(risk.requirementId ? [risk.requirementId] : []),
      ...((risk.linkedRequirementIds ?? []).filter(Boolean) as string[]),
    ];
    if (linked.length === 0) {
      // Allow package-level risks only when no requirementId (document failures) —
      // still count as non-orphan for inventory risks
      continue;
    }
    for (const rid of linked) {
      riskRequirementIds.push(rid);
      if (!idSet.has(rid)) orphanRisks += 1;
    }
    if (risk.underlyingKey) {
      if (seenUnderlying.has(risk.underlyingKey)) {
        throw new AnalysisIntegrityError(
          "DUP_RISK",
          `Duplicate risk underlyingKey: ${risk.underlyingKey}`,
        );
      }
      seenUnderlying.add(risk.underlyingKey);
    }
    if (risk.fitStatus === "NOT_APPLICABLE") {
      throw new AnalysisIntegrityError(
        "RISK_NA",
        `Risk "${(risk.title ?? "").slice(0, 60)}" attached to NOT_APPLICABLE requirement`,
      );
    }
  }
  if (orphanRisks > 0) {
    throw new AnalysisIntegrityError(
      "ORPHAN_RISK",
      `${orphanRisks} risk link(s) reference unknown requirements`,
    );
  }
  checksPassed.push("risk_linkage");

  // Action integrity
  let orphanActions = 0;
  const actionRequirementIds: string[] = [];
  for (const action of input.actions) {
    if (!action.linkedRequirementId) continue;
    actionRequirementIds.push(action.linkedRequirementId);
    if (!idSet.has(action.linkedRequirementId)) orphanActions += 1;
  }
  if (orphanActions > 0) {
    throw new AnalysisIntegrityError(
      "ORPHAN_ACTION",
      `${orphanActions} action(s) reference unknown requirements`,
    );
  }
  checksPassed.push("action_linkage");

  // Snapshot package consistency
  if (
    input.snapshot.package.discoveredFileCount !== input.snapshot.package.files.length
  ) {
    throw new AnalysisIntegrityError(
      "PACKAGE_INVENTORY",
      "Snapshot discoveredFileCount ≠ files.length",
    );
  }
  checksPassed.push("package_inventory");

  const explicitFailures = input.snapshot.package.files.filter(
    (f) =>
      f.processingStatus === "FAILED" ||
      Boolean(f.error) ||
      /UNREADABLE|FAILED/i.test(f.error ?? ""),
  );

  const attestation: AnalysisIntegrityAttestation = {
    version: ANALYSIS_INTEGRITY_VERSION,
    frozenAt: new Date().toISOString(),
    tenderId: input.snapshot.tenderId,
    snapshotFrozenAt: input.snapshot.frozenAt,
    counts,
    partitionValid: true,
    checksPassed,
    package: {
      discoveredFileCount: input.snapshot.package.discoveredFileCount,
      failedOrUnreadableCount: explicitFailures.length,
      explicitFailures: explicitFailures.map((f) => ({
        fileName: f.fileName,
        error: f.error,
      })),
    },
    linkage: {
      requirementIds: [...input.requirementIds],
      riskRequirementIds,
      actionRequirementIds,
      orphanRisks: 0,
      orphanActions: 0,
    },
    evidenceRules: {
      confirmedGapWithoutCompanyEvidence: 0,
      confirmedFitWithoutCompanyEvidence: 0,
    },
    metadata: {
      status: input.metadataStatus ?? input.snapshot.metadata.metadataStatus,
      hasProvenanceNote: Boolean(
        input.metadataFactsNote ?? input.snapshot.metadata.factsNote,
      ),
    },
  };

  return attestation;
}

/**
 * Run existing snapshot invariants + Phase-3 universal integrity.
 */
export function freezeAndAssertAnalysisIntegrity(input: {
  snapshot: CanonicalAnalysisSnapshot;
  canonicalRequirementCount: number;
  requirementTexts: string[];
  uniqueRequirementIds: string[];
  matrix: ComplianceRow[];
  summary: ComplianceSummary;
  readiness: TenderReadinessBreakdown | null;
  actionPlan?: TenderActionPlanBundle | null;
  fitStatuses?: Array<{ fitStatus?: string | null; companyEvidence?: string | null }>;
  fitRows: UniversalAnalysisIntegrityInput["fitRows"];
  risks: UniversalAnalysisIntegrityInput["risks"];
  actions: UniversalAnalysisIntegrityInput["actions"];
  metadataStatus?: "OK" | "UNKNOWN" | "CONFLICT" | "INCOMPLETE" | null;
  metadataFactsNote?: string | null;
}): { snapshot: CanonicalAnalysisSnapshot; integrity: AnalysisIntegrityAttestation } {
  assertCanonicalSnapshotInvariants({
    snapshot: input.snapshot,
    canonicalRequirementCount: input.canonicalRequirementCount,
    requirementTexts: input.requirementTexts,
    uniqueRequirementIds: input.uniqueRequirementIds,
    matrix: input.matrix,
    summary: input.summary,
    readiness: input.readiness,
    actionPlan: input.actionPlan,
    fitStatuses: input.fitStatuses,
  });

  // Snapshot-level partition (Phase 3 strengthening)
  const c = input.snapshot.counts;
  const part =
    c.verifiedRequirements + c.needsVerification + c.confirmedGaps + c.notApplicable;
  if (part !== c.totalRequirements) {
    throw new AnalysisIntegrityError(
      "SNAPSHOT_PARTITION",
      `Snapshot counts partition ${part} ≠ total ${c.totalRequirements}`,
    );
  }

  const integrity = assertUniversalAnalysisIntegrity({
    snapshot: input.snapshot,
    canonicalRequirementCount: input.canonicalRequirementCount,
    requirementIds: input.uniqueRequirementIds,
    requirementTexts: input.requirementTexts,
    fitRows: input.fitRows,
    risks: input.risks,
    actions: input.actions,
    matrixRequirementIds: input.matrix.map((r) => r.requirementId),
    summary: {
      totalRequirements: input.summary.totalRequirements,
      ready: input.summary.ready,
      missing: input.summary.missing,
      verify: input.summary.verify,
      unknown: input.summary.unknown,
      notApplicable: input.summary.notApplicable,
    },
    readinessTotal: input.readiness
      ? (input.readiness.totalRequirements ?? input.readiness.total)
      : null,
    metadataStatus: input.metadataStatus,
    metadataFactsNote: input.metadataFactsNote,
  });

  return { snapshot: input.snapshot, integrity };
}

export function isAnalysisIntegrityAttestation(
  value: unknown,
): value is AnalysisIntegrityAttestation {
  if (!value || typeof value !== "object") return false;
  const v = value as AnalysisIntegrityAttestation;
  return (
    v.version === ANALYSIS_INTEGRITY_VERSION &&
    v.partitionValid === true &&
    Array.isArray(v.checksPassed) &&
    typeof v.counts?.totalRequirements === "number"
  );
}
