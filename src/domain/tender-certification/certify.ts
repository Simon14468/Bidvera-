/**
 * Universal Tender Certification — final gate before COMPLETED.
 */

import { REQUIREMENT_SEMANTIC_KINDS } from "@/domain/tender-requirements/semantic-kind";
import { detectCertificationAnomalies, looksLikeIncompleteFragment } from "./quality";
import {
  TENDER_CERTIFICATION_VERSION,
  type CertifyAnalysisInput,
  type CertificationCheckRecord,
  type CertificationFinding,
  type CertificationStatus,
  type PackageReadability,
  type TenderCertificationResult,
} from "./types";

const VALID_FIT = new Set([
  "CONFIRMED_FIT",
  "CONFIRMED_GAP",
  "NEEDS_VERIFICATION",
  "NOT_APPLICABLE",
]);

const VALID_STRENGTH = new Set([
  "MANDATORY",
  "CONDITIONAL",
  "OPTIONAL",
  "INFORMATIONAL",
]);

const VALID_KINDS = new Set<string>(REQUIREMENT_SEMANTIC_KINDS);

const TERMINAL = new Set(["COMPLETED", "FAILED", "STORED", "EXTRACTED"]);

export class AnalysisCertificationError extends Error {
  readonly code: string;
  readonly result: TenderCertificationResult;

  constructor(result: TenderCertificationResult) {
    const primary = result.failures[0];
    super(
      `[tender-certification:${primary?.code ?? "CERTIFICATION_FAILED"}] ${
        primary?.message ?? "Certification failed"
      }`,
    );
    this.name = "AnalysisCertificationError";
    this.code = primary?.code ?? "CERTIFICATION_FAILED";
    this.result = result;
  }
}

function pushFinding(
  findings: CertificationFinding[],
  finding: CertificationFinding,
): void {
  findings.push(finding);
}

function classifyPackageReadability(
  files: CertifyAnalysisInput["snapshot"]["package"]["files"],
  discoveredFileCount: number,
): PackageReadability {
  if (discoveredFileCount !== files.length) return "INCOMPLETE";
  if (files.length === 0) return "INCOMPLETE";

  let ok = 0;
  let failed = 0;
  let nonTerminal = 0;
  for (const f of files) {
    if (!TERMINAL.has(f.processingStatus)) nonTerminal += 1;
    if (f.processingStatus === "FAILED" || f.error) failed += 1;
    else ok += 1;
  }
  if (nonTerminal > 0) return "INCOMPLETE";
  if (ok === 0 && failed > 0) return "UNREADABLE";
  if (failed > 0 && ok > 0) return "PARTIALLY_READABLE";
  return "READABLE";
}

function resolveStatus(
  failures: CertificationFinding[],
  warnings: CertificationFinding[],
  reviewFindings: CertificationFinding[],
): CertificationStatus {
  if (failures.some((f) => f.severity === "CRITICAL" || f.severity === "HIGH")) {
    return "CERTIFICATION_FAILED";
  }
  if (reviewFindings.length > 0) return "REVIEW_REQUIRED";
  if (warnings.length > 0) return "CERTIFIED_WITH_WARNINGS";
  return "CERTIFIED";
}

/**
 * Certify the frozen analysis. Throws AnalysisCertificationError on CERTIFICATION_FAILED.
 * REVIEW_REQUIRED / CERTIFIED* allow COMPLETED with the attestation stored.
 */
export function certifyAnalysis(input: CertifyAnalysisInput): TenderCertificationResult {
  const startedAt = new Date().toISOString();
  const t0 = Date.now();
  const findings: CertificationFinding[] = [];
  const checks: CertificationCheckRecord[] = [];
  const checksPassed: string[] = [];

  function runCheck(name: string, fn: () => void): void {
    const s = Date.now();
    let passed = true;
    try {
      fn();
    } catch (e) {
      passed = false;
      pushFinding(findings, {
        code: "CERTIFICATION_ANOMALY",
        severity: "CRITICAL",
        category: "QUALITY",
        message: e instanceof Error ? e.message : String(e),
      });
    }
    checks.push({ name, passed, durationMs: Date.now() - s });
    if (passed) checksPassed.push(name);
  }

  const idSet = new Set(
    input.canonicalRequirements
      .map((r) => r.id)
      .filter((id): id is string => Boolean(id)),
  );
  const packageReadability = classifyPackageReadability(
    input.snapshot.package.files,
    input.snapshot.package.discoveredFileCount,
  );

  // —— 1. Integrity / Guardian prerequisites ——
  runCheck("integrity_attestation", () => {
    if (!input.integrity || !input.integrity.partitionValid) {
      pushFinding(findings, {
        code: "INTEGRITY_FAILED",
        severity: "CRITICAL",
        category: "SNAPSHOT",
        message: "Phase-3 analysis integrity attestation missing or invalid",
      });
      return;
    }
    if (input.integrity.version !== "analysis-integrity/v1") {
      pushFinding(findings, {
        code: "VERSION_CONFLICT",
        severity: "CRITICAL",
        category: "SNAPSHOT",
        message: `Unknown integrity version ${input.integrity.version}`,
      });
    }
  });

  runCheck("guardian_stamp", () => {
    if (!input.guardianOk) {
      pushFinding(findings, {
        code: "GUARDIAN_MISSING",
        severity: "CRITICAL",
        category: "DECISION",
        message: "Decision Guardian stamp required before certification",
      });
    }
  });

  // —— 2. Package certification ——
  runCheck("package_inventory", () => {
    const { package: pkg } = input.snapshot;
    if (pkg.discoveredFileCount !== pkg.files.length) {
      pushFinding(findings, {
        code: "PACKAGE_INCOMPLETE",
        severity: "CRITICAL",
        category: "PACKAGE",
        message: `discoveredFileCount ${pkg.discoveredFileCount} ≠ files ${pkg.files.length}`,
      });
    }
    const names = new Set<string>();
    for (const f of pkg.files) {
      if (names.has(f.fileName)) {
        pushFinding(findings, {
          code: "PACKAGE_INCOMPLETE",
          severity: "HIGH",
          category: "PACKAGE",
          message: `Duplicate file identity: ${f.fileName}`,
        });
      }
      names.add(f.fileName);
      if (!TERMINAL.has(f.processingStatus)) {
        pushFinding(findings, {
          code: "PACKAGE_INCOMPLETE",
          severity: "CRITICAL",
          category: "PACKAGE",
          message: `Non-terminal document state: ${f.fileName} (${f.processingStatus})`,
        });
      }
    }
    if (packageReadability === "UNREADABLE") {
      pushFinding(findings, {
        code: "DOCUMENT_UNREADABLE",
        severity: "CRITICAL",
        category: "PACKAGE",
        message: "Package has no readable documents",
      });
    } else if (packageReadability === "PARTIALLY_READABLE") {
      pushFinding(findings, {
        code: "DOCUMENT_UNREADABLE",
        severity: "WARNING",
        category: "PACKAGE",
        message: "Package is partially readable; failures recorded explicitly",
      });
    } else if (packageReadability === "INCOMPLETE") {
      pushFinding(findings, {
        code: "PACKAGE_INCOMPLETE",
        severity: "CRITICAL",
        category: "PACKAGE",
        message: "Package inventory incomplete or non-terminal",
      });
    }

    if (
      input.utiSummary?.inventoryCount != null &&
      input.utiSummary.inventoryCount !== pkg.discoveredFileCount
    ) {
      pushFinding(findings, {
        code: "SNAPSHOT_MISMATCH",
        severity: "HIGH",
        category: "CROSS_DOCUMENT",
        message: `UTI inventory ${input.utiSummary.inventoryCount} ≠ snapshot ${pkg.discoveredFileCount}`,
      });
    }
    if (
      input.intakeStoredCount != null &&
      input.intakeStoredCount > 0 &&
      input.utiSummary?.inventoryCount != null &&
      input.utiSummary.inventoryCount !== input.intakeStoredCount
    ) {
      pushFinding(findings, {
        code: "SNAPSHOT_MISMATCH",
        severity: "HIGH",
        category: "CROSS_DOCUMENT",
        message: `UTI inventory ${input.utiSummary.inventoryCount} ≠ intake stored ${input.intakeStoredCount}`,
      });
    }
    if (
      input.intakeStoredCount != null &&
      input.intakeStoredCount > 0 &&
      input.intakeStoredCount !== pkg.discoveredFileCount
    ) {
      pushFinding(findings, {
        code: "SNAPSHOT_MISMATCH",
        severity: "HIGH",
        category: "CROSS_DOCUMENT",
        message: `Intake stored ${input.intakeStoredCount} ≠ snapshot ${pkg.discoveredFileCount}`,
      });
    }
  });

  // —— 3. Snapshot / count certification ——
  runCheck("snapshot_counts", () => {
    const c = input.snapshot.counts;
    const part =
      c.verifiedRequirements + c.needsVerification + c.confirmedGaps + c.notApplicable;
    if (part !== c.totalRequirements) {
      pushFinding(findings, {
        code: "COUNT_MISMATCH",
        severity: "CRITICAL",
        category: "READINESS",
        message: `Snapshot partition ${part} ≠ total ${c.totalRequirements}`,
      });
    }
    if (c.totalRequirements !== input.canonicalRequirements.length) {
      pushFinding(findings, {
        code: "SNAPSHOT_MISMATCH",
        severity: "CRITICAL",
        category: "SNAPSHOT",
        message: `Snapshot total ${c.totalRequirements} ≠ canonical ${input.canonicalRequirements.length}`,
      });
    }
    if (input.integrity && input.integrity.counts.totalRequirements !== c.totalRequirements) {
      pushFinding(findings, {
        code: "COUNT_MISMATCH",
        severity: "CRITICAL",
        category: "READINESS",
        message: "Integrity counts diverge from snapshot",
      });
    }
    if (input.snapshot.requirementIds.length !== c.totalRequirements) {
      pushFinding(findings, {
        code: "SNAPSHOT_MISMATCH",
        severity: "CRITICAL",
        category: "SNAPSHOT",
        message: "snapshot.requirementIds length mismatch",
      });
    }
  });

  // —— 4. Requirement / semantic certification ——
  runCheck("canonical_requirements", () => {
    const seen = new Set<string>();
    for (const r of input.canonicalRequirements) {
      const text = (r.requirement ?? "").trim();
      if (!r.id) {
        pushFinding(findings, {
          code: "REQUIREMENT_DUPLICATE",
          severity: "CRITICAL",
          category: "REQUIREMENT",
          message: "Canonical requirement missing stable ID",
        });
        continue;
      }
      if (seen.has(r.id)) {
        pushFinding(findings, {
          code: "REQUIREMENT_DUPLICATE",
          severity: "CRITICAL",
          category: "REQUIREMENT",
          message: `Duplicate requirement ID ${r.id}`,
          requirementId: r.id,
        });
      }
      seen.add(r.id);

      if (!text || text.length < 8) {
        pushFinding(findings, {
          code: "REQUIREMENT_FRAGMENT",
          severity: "HIGH",
          category: "REQUIREMENT",
          message: "Empty or suspiciously short requirement text",
          requirementId: r.id,
        });
      }
      if (looksLikeIncompleteFragment(text)) {
        pushFinding(findings, {
          code: "REQUIREMENT_FRAGMENT",
          severity: "CRITICAL",
          category: "EXTRACTION",
          message: "Requirement ends with incomplete obligation tail",
          requirementId: r.id,
        });
      }
      if (r.semanticKind && !VALID_KINDS.has(r.semanticKind)) {
        pushFinding(findings, {
          code: "REQUIREMENT_SEMANTIC_INVALID",
          severity: "CRITICAL",
          category: "SEMANTIC",
          message: `Invalid semanticKind: ${r.semanticKind}`,
          requirementId: r.id,
        });
      }
      if (r.obligationStrength && !VALID_STRENGTH.has(r.obligationStrength)) {
        pushFinding(findings, {
          code: "REQUIREMENT_SEMANTIC_INVALID",
          severity: "CRITICAL",
          category: "SEMANTIC",
          message: `Invalid obligationStrength: ${r.obligationStrength}`,
          requirementId: r.id,
        });
      }
      if (r.obligationStrength === "CONDITIONAL" && !r.sourceSection?.trim()) {
        pushFinding(findings, {
          code: "REQUIREMENT_SEMANTIC_INVALID",
          severity: "WARNING",
          category: "SEMANTIC",
          message: "CONDITIONAL requirement missing sourceSection trigger context",
          requirementId: r.id,
        });
      }
      if (!r.sourceDocument?.trim() && !r.evidenceText?.trim()) {
        pushFinding(findings, {
          code: "PROVENANCE_MISSING",
          severity: "WARNING",
          category: "REQUIREMENT",
          message: "Requirement lacks sourceDocument/evidence provenance",
          requirementId: r.id,
        });
      }
    }
  });

  // —— 5. Fit / evidence ——
  runCheck("fit_evidence", () => {
    if (input.fitRows.length !== input.canonicalRequirements.length) {
      pushFinding(findings, {
        code: "FIT_INCONSISTENT",
        severity: "CRITICAL",
        category: "FIT",
        message: `Fit rows ${input.fitRows.length} ≠ canonical ${input.canonicalRequirements.length}`,
      });
    }
    const fitByReq = new Map<string, number>();
    for (const row of input.fitRows) {
      if (row.requirementId) {
        fitByReq.set(row.requirementId, (fitByReq.get(row.requirementId) ?? 0) + 1);
        if (!idSet.has(row.requirementId)) {
          pushFinding(findings, {
            code: "FIT_INCONSISTENT",
            severity: "CRITICAL",
            category: "FIT",
            message: `Orphan fit for ${row.requirementId}`,
            requirementId: row.requirementId,
          });
        }
      }
      if (!row.fitStatus || !VALID_FIT.has(row.fitStatus)) {
        pushFinding(findings, {
          code: "FIT_MISSING",
          severity: "CRITICAL",
          category: "FIT",
          message: `Invalid or missing fitStatus: ${row.fitStatus ?? "null"}`,
          requirementId: row.requirementId,
        });
      }
      if (
        (row.fitStatus === "CONFIRMED_FIT" || row.fitStatus === "CONFIRMED_GAP") &&
        !row.companyEvidence?.trim()
      ) {
        pushFinding(findings, {
          code: "EVIDENCE_INVALID",
          severity: "CRITICAL",
          category: "EVIDENCE",
          message: `${row.fitStatus} without company evidence (missing ≠ gap)`,
          requirementId: row.requirementId,
        });
      }
      if (
        row.obligationStrength === "CONDITIONAL" &&
        !row.conditionText?.trim()
      ) {
        pushFinding(findings, {
          code: "FIT_INCONSISTENT",
          severity: "HIGH",
          category: "FIT",
          message: "Conditional fit row lost trigger context",
          requirementId: row.requirementId,
        });
      }
    }
    for (const [rid, count] of fitByReq) {
      if (count !== 1) {
        pushFinding(findings, {
          code: "FIT_INCONSISTENT",
          severity: "CRITICAL",
          category: "FIT",
          message: `Requirement ${rid} has ${count} fit rows`,
          requirementId: rid,
        });
      }
    }
    for (const id of idSet) {
      if (!fitByReq.has(id)) {
        pushFinding(findings, {
          code: "FIT_MISSING",
          severity: "CRITICAL",
          category: "FIT",
          message: `Canonical requirement ${id} has no fit state`,
          requirementId: id,
        });
      }
    }
  });

  // —— 6. Risk ——
  runCheck("risk_linkage", () => {
    const seenUnderlying = new Set<string>();
    for (const risk of input.risks) {
      const linked = [
        ...(risk.requirementId ? [risk.requirementId] : []),
        ...((risk.linkedRequirementIds ?? []).filter(Boolean) as string[]),
      ];
      if (linked.length === 0) continue;
      for (const rid of linked) {
        if (!idSet.has(rid)) {
          pushFinding(findings, {
            code: "RISK_ORPHAN",
            severity: "CRITICAL",
            category: "RISK",
            message: `Risk references unknown requirement ${rid}`,
            requirementId: rid,
          });
        }
      }
      if (risk.fitStatus === "NOT_APPLICABLE") {
        pushFinding(findings, {
          code: "RISK_NA",
          severity: "CRITICAL",
          category: "RISK",
          message: `Risk attached to NOT_APPLICABLE: ${(risk.title ?? "").slice(0, 60)}`,
        });
      }
      if (risk.underlyingKey) {
        if (seenUnderlying.has(risk.underlyingKey)) {
          pushFinding(findings, {
            code: "RISK_DUPLICATE",
            severity: "CRITICAL",
            category: "RISK",
            message: `Duplicate risk underlyingKey: ${risk.underlyingKey}`,
          });
        }
        seenUnderlying.add(risk.underlyingKey);
      }
      if (
        risk.evidenceState === "MISSING" ||
        risk.evidenceState === "NEEDS_VERIFICATION"
      ) {
        // Missing-only risks are advisory — elevate when severity is CRITICAL without confirmation
        if (risk.severity === "CRITICAL" && !risk.requirementId) {
          pushFinding(findings, {
            code: "RISK_ORPHAN",
            severity: "HIGH",
            category: "RISK",
            message: "Critical risk without requirement linkage",
          });
        }
      }
    }
  });

  // —— 7. Actions ——
  runCheck("action_linkage", () => {
    const canonText = new Map(
      input.canonicalRequirements
        .filter((r) => r.id)
        .map((r) => [r.id!, r.requirement.trim()] as const),
    );
    for (const action of input.actions) {
      if (!action.linkedRequirementId) continue;
      if (!idSet.has(action.linkedRequirementId)) {
        pushFinding(findings, {
          code: "ACTION_ORPHAN",
          severity: "CRITICAL",
          category: "ACTION",
          message: `Action references unknown requirement ${action.linkedRequirementId}`,
          requirementId: action.linkedRequirementId,
        });
        continue;
      }
      const expected = canonText.get(action.linkedRequirementId);
      if (
        action.requirementText?.trim() &&
        expected &&
        action.requirementText.trim() !== expected
      ) {
        // Allow summary only when text is a strict substring; else fail meaning change
        const a = action.requirementText.trim();
        if (!(expected.includes(a) || a.includes(expected.slice(0, Math.min(80, expected.length))))) {
          pushFinding(findings, {
            code: "ACTION_TEXT_MISMATCH",
            severity: "WARNING",
            category: "ACTION",
            message: "Action requirement text diverges from canonical source",
            requirementId: action.linkedRequirementId,
          });
        }
      }
    }
  });

  // —— 8. Decision inputs ——
  runCheck("decision_inputs", () => {
    if (!input.decisionLabel) {
      pushFinding(findings, {
        code: "DECISION_INPUT_MISMATCH",
        severity: "CRITICAL",
        category: "DECISION",
        message: "Decision label missing at certification",
      });
    }
    if (input.decisionRequirementIds.length !== input.canonicalRequirements.length) {
      pushFinding(findings, {
        code: "DECISION_INPUT_MISMATCH",
        severity: "CRITICAL",
        category: "DECISION",
        message: `Decision requirement count ${input.decisionRequirementIds.length} ≠ canonical ${input.canonicalRequirements.length}`,
      });
    }
    for (const id of input.decisionRequirementIds) {
      if (id && !idSet.has(id)) {
        pushFinding(findings, {
          code: "DECISION_INPUT_MISMATCH",
          severity: "CRITICAL",
          category: "DECISION",
          message: `Decision references unknown requirement ${id}`,
          requirementId: id,
        });
      }
    }
    if (input.matrixRequirementIds.length !== input.canonicalRequirements.length) {
      pushFinding(findings, {
        code: "DECISION_INPUT_MISMATCH",
        severity: "CRITICAL",
        category: "DECISION",
        message: "Compliance matrix length ≠ canonical requirements",
      });
    }
  });

  // —— 9. Metadata ——
  runCheck("metadata", () => {
    const meta = input.snapshot.metadata;
    if (meta.metadataStatus === "CONFLICT") {
      pushFinding(findings, {
        code: "METADATA_CONFLICT",
        severity: "WARNING",
        category: "METADATA",
        message: "Package metadata conflict preserved (not silently resolved)",
      });
    }
    if (
      meta.deadlineTimezone &&
      !meta.deadlineIso &&
      meta.metadataStatus === "OK"
    ) {
      pushFinding(findings, {
        code: "METADATA_CONFLICT",
        severity: "WARNING",
        category: "METADATA",
        message: "Timezone present without deadline ISO — review provenance",
      });
    }
    // Never invent: unknown is fine
    if (meta.metadataStatus === "UNKNOWN" || meta.metadataStatus === "INCOMPLETE") {
      pushFinding(findings, {
        code: "METADATA_CONFLICT",
        severity: "INFO",
        category: "METADATA",
        message: `Package metadata status ${meta.metadataStatus} (explicit)`,
      });
    }
  });

  // —— 10. Quality firewall ——
  runCheck("content_quality", () => {
    for (const f of detectCertificationAnomalies(input.canonicalRequirements)) {
      findings.push(f);
    }

    const total = input.snapshot.counts.totalRequirements || 1;
    const gapRatio = input.snapshot.counts.confirmedGaps / total;
    if (gapRatio >= 0.5 && input.snapshot.counts.confirmedGaps >= 5) {
      pushFinding(findings, {
        code: "CERTIFICATION_ANOMALY",
        severity: "HIGH",
        category: "QUALITY",
        message: `Abnormally high CONFIRMED_GAP ratio (${input.snapshot.counts.confirmedGaps}/${total})`,
      });
    }
  });

  const failures = findings.filter(
    (f) => f.severity === "CRITICAL" || f.severity === "HIGH",
  );
  const warnings = findings.filter((f) => f.severity === "WARNING");
  const reviewFindings = findings.filter(
    (f) =>
      f.code === "METADATA_CONFLICT" &&
      f.severity === "WARNING" &&
      input.snapshot.metadata.metadataStatus === "CONFLICT",
  );
  // Elevate unresolved metadata conflict + UTI conflicts to REVIEW_REQUIRED without failing
  if (
    (input.utiSummary?.metadataConflicts?.length ?? 0) > 0 &&
    !reviewFindings.length
  ) {
    reviewFindings.push({
      code: "METADATA_CONFLICT",
      severity: "WARNING",
      category: "CROSS_DOCUMENT",
      message: "UTI reported metadata conflicts requiring review",
    });
  }

  const status = resolveStatus(failures, warnings, reviewFindings);
  const endedAt = new Date().toISOString();
  const c = input.snapshot.counts;
  const result: TenderCertificationResult = {
    version: TENDER_CERTIFICATION_VERSION,
    status,
    certifiedAt: endedAt,
    startedAt,
    endedAt,
    durationMs: Date.now() - t0,
    tenderId: input.tenderId,
    packageLabel: input.packageLabel,
    packageReadability,
    checksExecuted: checks.map((x) => x.name),
    checksPassed,
    checks,
    findings,
    warnings,
    failures,
    integrityVersion: input.integrity?.version ?? null,
    snapshotFrozenAt: input.snapshot.frozenAt,
    counts: {
      totalRequirements: c.totalRequirements,
      verified: c.verifiedRequirements,
      needsVerification: c.needsVerification,
      confirmedGaps: c.confirmedGaps,
      notApplicable: c.notApplicable,
      partitionValid:
        c.verifiedRequirements +
          c.needsVerification +
          c.confirmedGaps +
          c.notApplicable ===
        c.totalRequirements,
    },
  };

  if (status === "CERTIFICATION_FAILED") {
    throw new AnalysisCertificationError(result);
  }

  return result;
}

export function isCertificationPassing(
  status: CertificationStatus,
): boolean {
  return (
    status === "CERTIFIED" ||
    status === "CERTIFIED_WITH_WARNINGS" ||
    status === "REVIEW_REQUIRED"
  );
}

export function isTenderCertificationResult(
  value: unknown,
): value is TenderCertificationResult {
  if (!value || typeof value !== "object") return false;
  const v = value as TenderCertificationResult;
  return (
    v.version === TENDER_CERTIFICATION_VERSION &&
    typeof v.status === "string" &&
    typeof v.durationMs === "number" &&
    Array.isArray(v.checksExecuted)
  );
}
