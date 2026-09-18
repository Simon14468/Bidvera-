/**
 * Phase 4 — Universal Tender Certification Engine tests.
 */

import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  AnalysisCertificationError,
  certifyAnalysis,
  isCertificationPassing,
  isTenderCertificationResult,
  type CertifyAnalysisInput,
} from "@/domain/tender-certification";

function baseInput(over: Partial<CertifyAnalysisInput> = {}): CertifyAnalysisInput {
  const ids = ["r1", "r2", "r3"];
  const base: CertifyAnalysisInput = {
    tenderId: "t1",
    packageLabel: "pack.zip",
    snapshot: {
      version: "canonical-analysis-snapshot/v1",
      frozenAt: new Date().toISOString(),
      tenderId: "t1",
      package: {
        discoveredFileCount: 2,
        label: "pack.zip",
        files: [
          { fileName: "a.pdf", processingStatus: "COMPLETED", role: "RFP", error: null },
          { fileName: "b.pdf", processingStatus: "COMPLETED", role: "CPS", error: null },
        ],
      },
      metadata: {
        title: "Tender",
        client: "Buyer",
        deadlineIso: "2026-12-01T12:00:00Z",
        deadlineTimezone: "Europe/London",
        factsNote: "from notice",
        metadataStatus: "OK",
      },
      requirementIds: ids,
      counts: {
        totalRequirements: 3,
        verifiedRequirements: 1,
        needsVerification: 1,
        confirmedGaps: 1,
        notApplicable: 0,
      },
    },
    integrity: {
      version: "analysis-integrity/v1",
      partitionValid: true,
      counts: {
        totalRequirements: 3,
        verified: 1,
        needsVerification: 1,
        confirmedGaps: 1,
        notApplicable: 0,
      },
      checksPassed: ["count_partition"],
    },
    guardianOk: true,
    canonicalRequirements: [
      {
        id: "r1",
        requirement: "The bidder shall submit a Form of Tender with the bid.",
        semanticKind: "ADMINISTRATIVE_REQUIREMENT",
        obligationStrength: "MANDATORY",
        sourceDocument: "a.pdf",
        evidenceText: "Form of Tender",
      },
      {
        id: "r2",
        requirement: "The bidder shall hold ISO 27001 certification.",
        semanticKind: "ELIGIBILITY_REQUIREMENT",
        obligationStrength: "MANDATORY",
        sourceDocument: "a.pdf",
        evidenceText: "ISO 27001",
      },
      {
        id: "r3",
        requirement: "The bidder shall provide two client references.",
        semanticKind: "TECHNICAL_REQUIREMENT",
        obligationStrength: "MANDATORY",
        sourceDocument: "b.pdf",
        evidenceText: "references",
      },
    ],
    fitRows: [
      {
        requirementId: "r1",
        fitStatus: "CONFIRMED_FIT",
        companyEvidence: "Company process includes Form of Tender.",
      },
      {
        requirementId: "r2",
        fitStatus: "CONFIRMED_GAP",
        companyEvidence: "Profile states ISO 27001 is not held.",
      },
      {
        requirementId: "r3",
        fitStatus: "NEEDS_VERIFICATION",
        companyEvidence: null,
      },
    ],
    risks: [
      {
        requirementId: "r2",
        linkedRequirementIds: ["r2"],
        title: "ISO gap",
        underlyingKey: "cert:iso27001",
        fitStatus: "CONFIRMED_GAP",
        severity: "HIGH",
      },
    ],
    actions: [
      {
        linkedRequirementId: "r2",
        requirementText: "The bidder shall hold ISO 27001 certification.",
        title: "Obtain ISO",
      },
    ],
    matrixRequirementIds: ids,
    decisionRequirementIds: ids,
    decisionLabel: "NO_BID",
    utiSummary: { inventoryCount: 2, extractedOkCount: 2, failedCount: 0 },
  };
  return { ...base, ...over, snapshot: { ...base.snapshot, ...(over.snapshot ?? {}) } };
}

describe("Phase 4 tender certification", () => {
  it("CERTIFIED for consistent frozen analysis", () => {
    const result = certifyAnalysis(baseInput());
    assert.ok(isTenderCertificationResult(result));
    assert.equal(result.status, "CERTIFIED");
    assert.equal(result.packageReadability, "READABLE");
    assert.ok(isCertificationPassing(result.status));
    assert.ok(result.checksPassed.includes("fit_evidence"));
    assert.ok(result.durationMs >= 0);
  });

  it("REVIEW_REQUIRED when package metadata CONFLICT is preserved", () => {
    const result = certifyAnalysis(
      baseInput({
        snapshot: {
          ...baseInput().snapshot,
          metadata: {
            ...baseInput().snapshot.metadata,
            metadataStatus: "CONFLICT",
          },
        },
      }),
    );
    assert.equal(result.status, "REVIEW_REQUIRED");
    assert.ok(result.warnings.some((w) => w.code === "METADATA_CONFLICT"));
  });

  it("fails when CONFIRMED_GAP lacks company evidence", () => {
    assert.throws(
      () =>
        certifyAnalysis(
          baseInput({
            fitRows: [
              {
                requirementId: "r1",
                fitStatus: "CONFIRMED_FIT",
                companyEvidence: "ok",
              },
              {
                requirementId: "r2",
                fitStatus: "CONFIRMED_GAP",
                companyEvidence: null,
              },
              {
                requirementId: "r3",
                fitStatus: "NEEDS_VERIFICATION",
                companyEvidence: null,
              },
            ],
          }),
        ),
      (err: unknown) =>
        err instanceof AnalysisCertificationError &&
        err.result.failures.some((f) => f.code === "EVIDENCE_INVALID"),
    );
  });

  it("fails on incomplete requirement fragment", () => {
    assert.throws(
      () =>
        certifyAnalysis(
          baseInput({
            canonicalRequirements: [
              {
                id: "r1",
                requirement: "The bidder shall",
                semanticKind: "TECHNICAL_REQUIREMENT",
                obligationStrength: "MANDATORY",
                sourceDocument: "a.pdf",
              },
              {
                id: "r2",
                requirement: "The bidder shall hold ISO 27001 certification.",
                semanticKind: "ELIGIBILITY_REQUIREMENT",
                obligationStrength: "MANDATORY",
                sourceDocument: "a.pdf",
              },
              {
                id: "r3",
                requirement: "The bidder shall provide two client references.",
                semanticKind: "TECHNICAL_REQUIREMENT",
                obligationStrength: "MANDATORY",
                sourceDocument: "b.pdf",
              },
            ],
          }),
        ),
      AnalysisCertificationError,
    );
  });

  it("fails on orphan risk and count mismatch", () => {
    assert.throws(
      () =>
        certifyAnalysis(
          baseInput({
            risks: [
              {
                requirementId: "ghost",
                linkedRequirementIds: ["ghost"],
                underlyingKey: "x",
                title: "orphan",
              },
            ],
          }),
        ),
      (err: unknown) =>
        err instanceof AnalysisCertificationError &&
        err.result.failures.some((f) => f.code === "RISK_ORPHAN"),
    );

    assert.throws(
      () =>
        certifyAnalysis(
          baseInput({
            snapshot: {
              ...baseInput().snapshot,
              counts: {
                totalRequirements: 3,
                verifiedRequirements: 3,
                needsVerification: 0,
                confirmedGaps: 0,
                notApplicable: 0,
              },
            },
            // integrity still says different partition totals vs fit — force count diverge
            integrity: {
              version: "analysis-integrity/v1",
              partitionValid: true,
              counts: {
                totalRequirements: 99,
                verified: 1,
                needsVerification: 1,
                confirmedGaps: 1,
                notApplicable: 0,
              },
              checksPassed: [],
            },
          }),
        ),
      AnalysisCertificationError,
    );
  });

  it("PARTIALLY_READABLE package does not auto-fail when peers are valid", () => {
    const result = certifyAnalysis(
      baseInput({
        snapshot: {
          ...baseInput().snapshot,
          package: {
            discoveredFileCount: 2,
            label: "pack.zip",
            files: [
              {
                fileName: "a.pdf",
                processingStatus: "COMPLETED",
                role: "RFP",
                error: null,
              },
              {
                fileName: "scan.pdf",
                processingStatus: "FAILED",
                role: "OTHER",
                error: "UNREADABLE",
              },
            ],
          },
        },
      }),
    );
    assert.equal(result.packageReadability, "PARTIALLY_READABLE");
    assert.ok(isCertificationPassing(result.status));
  });

  it("is deterministic for the same frozen input", () => {
    const input = baseInput();
    const a = certifyAnalysis(input);
    const b = certifyAnalysis(input);
    assert.equal(a.status, b.status);
    assert.deepEqual(
      a.failures.map((f) => f.code),
      b.failures.map((f) => f.code),
    );
    assert.deepEqual(a.checksExecuted, b.checksExecuted);
  });
});
