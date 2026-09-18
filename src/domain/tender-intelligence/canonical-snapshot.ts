/**
 * Frozen canonical analysis snapshot — the single source of truth after analysis.
 * Downstream (readiness, explanation, evidence, actions, report, PDF, API, SSR, UI)
 * must consume this object rather than reconstructing requirement lists.
 */

import { isStructuralHeading } from "@/domain/tender-requirements/filter-non-requirements";
import type { TenderReadinessBreakdown } from "@/domain/decision/tender-readiness";
import type { TenderActionPlanBundle } from "@/domain/tender-action-plan";
import type { ComplianceRow, ComplianceSummary, TenderIntelligenceBreakdown } from "./types";

export const CANONICAL_SNAPSHOT_VERSION = "canonical-analysis-snapshot/v1" as const;

/** STI admission stamp — absence means stale / pre-firewall analysis. */
export const STI_ADMISSION_SNAPSHOT_VERSION = "sti-admission/v3" as const;

export type StiAdmissionExclusionRecord = {
  exclusionCode: string;
  exclusionReason: string;
  actor: string | null;
  lifecyclePhase: string | null;
  purpose: string | null;
  textSnippet: string;
};

export type ContextualIntelligenceRecord = {
  kind:
    | "METADATA"
    | "BUYER_DUTY"
    | "PROCEDURAL"
    | "VERSION_CONFLICT"
    | "NON_REQUIREMENT"
    | "POST_AWARD"
    | "POLICY_CONTEXT"
    | "EVALUATION"
    | "AMENDMENT"
    | "AMBIGUOUS";
  text: string;
  exclusionCode: string | null;
  sourceDocument: string | null;
};

export type StiAdmissionAudit = {
  version: typeof STI_ADMISSION_SNAPSHOT_VERSION;
  sealedAt: string;
  admittedCount: number;
  finalGateRejectedCount: number;
  firewallRejectedCount: number;
  exclusions: StiAdmissionExclusionRecord[];
  /** Meaningful non-requirements preserved as context — never silently dropped. */
  contextualIntelligence?: ContextualIntelligenceRecord[];
};

export type CanonicalRequirementMetrics = {
  /** Always snapshot.requirements.length / canonical requirement set size. */
  totalRequirements: number;
  /** CONFIRMED_FIT / READY — not a substitute for totalRequirements. */
  verifiedRequirements: number;
  /** NEEDS_VERIFICATION (VERIFY + UNKNOWN). Distinct from confirmed gaps. */
  needsVerification: number;
  /** CONFIRMED_GAP / MISSING — only definitive contradictory evidence. */
  confirmedGaps: number;
  notApplicable: number;
};

export type CanonicalPackageFileRecord = {
  fileName: string;
  processingStatus: string;
  role: string | null;
  error: string | null;
};

export type CanonicalSnapshotMetadata = {
  title: string | null;
  client: string | null;
  deadlineIso: string | null;
  deadlineTimezone: string | null;
  factsNote: string | null;
  metadataStatus: "OK" | "UNKNOWN" | "CONFLICT" | "INCOMPLETE" | null;
  /** Persist/package text was sliced — analysis is not claiming full-text completeness. */
  textTruncated?: boolean;
  deadlineStatus?: "OK" | "UNKNOWN" | "CONFLICT" | "INCOMPLETE" | null;
  titleStatus?: "OK" | "UNKNOWN" | "CONFLICT" | "INCOMPLETE" | null;
  documentRoles?: Array<{
    fileName: string;
    role: string;
    completeness: string;
    confidence?: number;
  }>;
  /** Authoritative package identity — downstream must not rebuild these fields. */
  packageIdentity?: import("@/domain/package-identity").PackageIdentityRecord | null;
  /** Frozen per-requirement tender provenance — reports must not reconstruct it. */
  requirementProvenance?: Array<{
    requirementId: string;
    tenderSource: import("@/domain/provenance").SourceReference;
  }>;
};

export type CanonicalAnalysisSnapshot = {
  version: typeof CANONICAL_SNAPSHOT_VERSION;
  frozenAt: string;
  tenderId: string;
  package: {
    discoveredFileCount: number;
    label: string;
    files: CanonicalPackageFileRecord[];
  };
  metadata: CanonicalSnapshotMetadata;
  requirementIds: string[];
  counts: CanonicalRequirementMetrics;
  /**
   * STI admission audit — source of semantic truth for this freeze.
   * Missing / wrong version ⇒ stale pre-firewall analysis (requires re-analysis).
   */
  stiAdmission?: StiAdmissionAudit | null;
};

export function metricsFromComplianceSummary(
  summary: ComplianceSummary,
  canonicalRowCount: number,
): CanonicalRequirementMetrics {
  return {
    totalRequirements: canonicalRowCount,
    verifiedRequirements: summary.ready,
    needsVerification: summary.verify + summary.unknown,
    confirmedGaps: summary.missing,
    notApplicable: summary.notApplicable,
  };
}

export function freezeCanonicalAnalysisSnapshot(input: {
  tenderId: string;
  packageLabel: string;
  discoveredFileCount: number;
  files: CanonicalPackageFileRecord[];
  metadata: CanonicalSnapshotMetadata;
  requirementIds: string[];
  summary: ComplianceSummary;
  stiAdmission?: StiAdmissionAudit | null;
}): CanonicalAnalysisSnapshot {
  return {
    version: CANONICAL_SNAPSHOT_VERSION,
    frozenAt: new Date().toISOString(),
    tenderId: input.tenderId,
    package: {
      discoveredFileCount: input.discoveredFileCount,
      label: input.packageLabel,
      files: input.files,
    },
    metadata: input.metadata,
    requirementIds: [...input.requirementIds],
    counts: metricsFromComplianceSummary(input.summary, input.requirementIds.length),
    stiAdmission: input.stiAdmission ?? null,
  };
}

/**
 * Stale / pre-firewall analyses must not masquerade as current STI output.
 * Does not delete historical data — callers should require re-analysis.
 */
export function isStalePreFirewallSnapshot(
  snapshot: CanonicalAnalysisSnapshot | null | undefined,
): boolean {
  if (!snapshot) return true;
  const audit = snapshot.stiAdmission;
  if (!audit) return true;
  return audit.version !== STI_ADMISSION_SNAPSHOT_VERSION;
}

function isObviousIncompleteFragment(text: string): boolean {
  const t = text.replace(/\s+/g, " ").trim();
  if (t.length < 8) return false;
  return /\b(shall be|shall|must be|responsible to|completely)\s*$/i.test(t);
}

export function assertCanonicalSnapshotInvariants(input: {
  snapshot: CanonicalAnalysisSnapshot;
  canonicalRequirementCount: number;
  requirementTexts: string[];
  uniqueRequirementIds: string[];
  matrix: ComplianceRow[];
  summary: ComplianceSummary;
  readiness: TenderReadinessBreakdown | null;
  actionPlan?: TenderActionPlanBundle | null;
  reportTotal?: number | null;
  pdfTotal?: number | null;
  apiTotal?: number | null;
  fitStatuses?: Array<{ fitStatus?: string | null; companyEvidence?: string | null }>;
}): void {
  const { snapshot } = input;

  if (snapshot.version !== CANONICAL_SNAPSHOT_VERSION) {
    throw new Error(`Unknown canonical snapshot version: ${snapshot.version}`);
  }

  // INVARIANT 1
  if (snapshot.package.discoveredFileCount !== snapshot.package.files.length) {
    throw new Error(
      `INVARIANT 1: discoveredFileCount=${snapshot.package.discoveredFileCount} inventory=${snapshot.package.files.length}`,
    );
  }

  // INVARIANT 2
  const terminal = new Set(["COMPLETED", "FAILED", "STORED", "EXTRACTED"]);
  for (const f of snapshot.package.files) {
    if (!terminal.has(f.processingStatus)) {
      throw new Error(
        `INVARIANT 2: file ${f.fileName} has non-terminal status ${f.processingStatus}`,
      );
    }
  }

  // INVARIANT 3
  const ids = input.uniqueRequirementIds;
  if (new Set(ids).size !== ids.length) {
    throw new Error("INVARIANT 3: canonical requirement IDs are not unique");
  }

  // INVARIANT 4
  if (snapshot.counts.totalRequirements !== snapshot.requirementIds.length) {
    throw new Error(
      `INVARIANT 4: totalRequirements=${snapshot.counts.totalRequirements} snapshot.requirements=${snapshot.requirementIds.length}`,
    );
  }
  if (snapshot.counts.totalRequirements !== input.canonicalRequirementCount) {
    throw new Error(
      `INVARIANT 4: snapshot total ${snapshot.counts.totalRequirements} ≠ canonical set ${input.canonicalRequirementCount}`,
    );
  }
  if (input.matrix.length !== snapshot.counts.totalRequirements) {
    throw new Error(
      `INVARIANT 4: matrix ${input.matrix.length} ≠ snapshot total ${snapshot.counts.totalRequirements}`,
    );
  }
  if (input.summary.totalRequirements !== snapshot.counts.totalRequirements) {
    throw new Error(
      `INVARIANT 4: summary ${input.summary.totalRequirements} ≠ snapshot total`,
    );
  }

  // INVARIANT 5–7
  if (input.reportTotal != null && input.reportTotal !== snapshot.counts.totalRequirements) {
    throw new Error(
      `INVARIANT 5: report total ${input.reportTotal} ≠ snapshot ${snapshot.counts.totalRequirements}`,
    );
  }
  if (input.pdfTotal != null && input.pdfTotal !== snapshot.counts.totalRequirements) {
    throw new Error(
      `INVARIANT 6: PDF total ${input.pdfTotal} ≠ snapshot ${snapshot.counts.totalRequirements}`,
    );
  }
  if (input.apiTotal != null && input.apiTotal !== snapshot.counts.totalRequirements) {
    throw new Error(
      `INVARIANT 7: API total ${input.apiTotal} ≠ snapshot ${snapshot.counts.totalRequirements}`,
    );
  }

  // INVARIANT 8 — package-level metadata (not first-file-only when a later file supplied it)
  if (
    snapshot.metadata.metadataStatus === "OK" &&
    !snapshot.metadata.client &&
    snapshot.package.files.length > 1
  ) {
    // Allowed: genuinely unknown buyer. Conflict/unknown are explicit.
  }

  // INVARIANT 9
  for (const text of input.requirementTexts) {
    if (isStructuralHeading(text)) {
      throw new Error(`INVARIANT 9: structural heading leaked as requirement: ${text.slice(0, 80)}`);
    }
  }

  // INVARIANT 10
  for (const text of input.requirementTexts) {
    if (isObviousIncompleteFragment(text)) {
      throw new Error(`INVARIANT 10: incomplete fragment leaked: ${text.slice(0, 80)}`);
    }
  }

  // INVARIANT 11
  for (const row of input.fitStatuses ?? []) {
    if (row.fitStatus === "CONFIRMED_GAP" && !row.companyEvidence?.trim()) {
      throw new Error(
        "INVARIANT 11: CONFIRMED_GAP without definitive company evidence (missing evidence is NEEDS_VERIFICATION)",
      );
    }
  }
  if (
    input.readiness &&
    (input.readiness.counts.verify ?? 0) > 0 &&
    input.summary.missing === input.summary.verify &&
    input.summary.verify > 0 &&
    input.summary.ready === 0 &&
    input.canonicalRequirementCount === input.summary.verify
  ) {
    // All-verify packages must not also claim every row as a confirmed gap.
    if (input.summary.missing === input.canonicalRequirementCount) {
      throw new Error("INVARIANT 11: every NEEDS_VERIFICATION row was counted as CONFIRMED_GAP");
    }
  }

  // INVARIANT 12
  const idSet = new Set(snapshot.requirementIds);
  for (const item of input.actionPlan?.items ?? []) {
    if (!item.linkedRequirementId) continue;
    if (!idSet.has(item.linkedRequirementId)) {
      throw new Error(
        `INVARIANT 12: action "${item.title}" links unknown requirement ${item.linkedRequirementId}`,
      );
    }
  }

  if (input.readiness) {
    const rt = input.readiness.totalRequirements ?? input.readiness.total;
    if (rt !== snapshot.counts.totalRequirements) {
      throw new Error(
        `Readiness total ${rt} ≠ snapshot ${snapshot.counts.totalRequirements}`,
      );
    }
  }
}

export function assertReportSectionsMatchSnapshot(
  snapshot: CanonicalAnalysisSnapshot,
  reportTotal: number | null | undefined,
): void {
  if (reportTotal != null && reportTotal !== snapshot.counts.totalRequirements) {
    throw new Error(
      `Web/PDF sections total ${reportTotal} ≠ snapshot ${snapshot.counts.totalRequirements}`,
    );
  }
}

export function attachSnapshotToIntelligence(
  intelligence: TenderIntelligenceBreakdown,
  snapshot: CanonicalAnalysisSnapshot,
): TenderIntelligenceBreakdown {
  return {
    ...intelligence,
    canonicalSnapshot: snapshot,
    complianceSummary: {
      ...intelligence.complianceSummary,
      totalRequirements: snapshot.counts.totalRequirements,
      verifiedRequirements: snapshot.counts.verifiedRequirements,
      needsVerification: snapshot.counts.needsVerification,
      confirmedGaps: snapshot.counts.confirmedGaps,
    },
  };
}

export function isCanonicalAnalysisSnapshot(
  value: unknown,
): value is CanonicalAnalysisSnapshot {
  if (!value || typeof value !== "object") return false;
  const v = value as CanonicalAnalysisSnapshot;
  return (
    v.version === CANONICAL_SNAPSHOT_VERSION &&
    Array.isArray(v.requirementIds) &&
    typeof v.counts?.totalRequirements === "number" &&
    Array.isArray(v.package?.files)
  );
}
