/**
 * Phase 3 — Universal Evidence & Consistency Integrity tests.
 */

import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  AnalysisIntegrityError,
  assertUniversalAnalysisIntegrity,
  freezeAndAssertAnalysisIntegrity,
  isAnalysisIntegrityAttestation,
} from "@/domain/analysis-integrity";
import { freezeCanonicalAnalysisSnapshot } from "@/domain/tender-intelligence/canonical-snapshot";
import type { ComplianceRow } from "@/domain/tender-intelligence/types";

function row(
  over: Partial<ComplianceRow> & { requirementId: string; requirement: string },
): ComplianceRow {
  const { requirementId, requirement, status, evidence, ...rest } = over;
  return {
    id: `CM-${requirementId}`,
    requirementId,
    requirement,
    requirementType: "CONTRACTUAL",
    mandatory: true,
    priority: "HIGH",
    status: status ?? "READY",
    companyFit: null,
    sourceDocument: "itt.pdf",
    pageNumber: 1,
    section: null,
    evidence: evidence ?? requirement,
    tenderSource: null,
    companyEvidence: null,
    companyEvidenceMessage: null,
    notes: null,
    sourceBasis: "DIRECT_SOURCE",
    sourceLocated: true,
    evidenceId: null,
    risk: null,
    requiredAction: null,
    evidenceState: "NEEDS_VERIFICATION",
    verificationStatus: "NEEDS_VERIFICATION",
    ...rest,
  };
}

function baseSnapshot(ids: string[], summary: {
  ready: number;
  missing: number;
  verify: number;
  unknown: number;
  notApplicable: number;
}) {
  const total = ids.length;
  return freezeCanonicalAnalysisSnapshot({
    tenderId: "t1",
    packageLabel: "pack.zip",
    discoveredFileCount: 2,
    files: [
      { fileName: "a.pdf", processingStatus: "COMPLETED", role: "RFP", error: null },
      { fileName: "b.pdf", processingStatus: "FAILED", role: "OTHER", error: "UNREADABLE" },
    ],
    metadata: {
      title: "Tender",
      client: "Buyer",
      deadlineIso: null,
      deadlineTimezone: null,
      factsNote: "buyer from notice.pdf",
      metadataStatus: "OK",
    },
    requirementIds: ids,
    summary: {
      totalRequirements: total,
      ready: summary.ready,
      missing: summary.missing,
      verify: summary.verify,
      unknown: summary.unknown,
      notApplicable: summary.notApplicable,
      sources: 0,
      risks: 0,
      requiredActions: 0,
      clarifications: 0,
    },
  });
}

describe("Phase 3 analysis integrity", () => {
  it("passes partition + linkage for a consistent package", () => {
    const ids = ["r1", "r2", "r3", "r4"];
    const snapshot = baseSnapshot(ids, {
      ready: 1,
      missing: 1,
      verify: 1,
      unknown: 0,
      notApplicable: 1,
    });
    const matrix = [
      row({ requirementId: "r1", requirement: "Bidder shall submit Form of Tender.", status: "READY" }),
      row({ requirementId: "r2", requirement: "Bidder shall hold ISO 27001.", status: "MISSING" }),
      row({ requirementId: "r3", requirement: "Bidder shall provide references.", status: "VERIFY" }),
      row({
        requirementId: "r4",
        requirement: "Optional bilingual documentation.",
        status: "NOT_APPLICABLE",
        mandatory: false,
      }),
    ];
    const { integrity } = freezeAndAssertAnalysisIntegrity({
      snapshot,
      canonicalRequirementCount: 4,
      requirementTexts: matrix.map((m) => m.requirement),
      uniqueRequirementIds: ids,
      matrix,
      summary: {
        totalRequirements: 4,
        ready: 1,
        missing: 1,
        verify: 1,
        unknown: 0,
        notApplicable: 1,
        sources: 0,
        risks: 0,
        requiredActions: 0,
        clarifications: 0,
      },
      readiness: {
        score: 50,
        total: 4,
        totalRequirements: 4,
        counts: { ready: 1, missing: 1, verify: 1, notApplicable: 1, unknown: 0 },
        items: ids.map((id) => ({
          requirementId: id,
          status: "VERIFY" as const,
          priority: "MEDIUM" as const,
          label: id,
        })),
        blocking: [],
        review: [],
      } as never,
      actionPlan: {
        items: [
          {
            id: "a1",
            title: "Resolve ISO",
            linkedRequirementId: "r2",
            requirementText: "Bidder shall hold ISO 27001.",
          },
        ],
      } as never,
      fitRows: [
        {
          requirementId: "r1",
          fitStatus: "CONFIRMED_FIT",
          companyEvidence: "Company profile lists Form of Tender process.",
        },
        {
          requirementId: "r2",
          fitStatus: "CONFIRMED_GAP",
          companyEvidence: "Company profile states ISO 27001 is not held.",
        },
        { requirementId: "r3", fitStatus: "NEEDS_VERIFICATION", companyEvidence: null },
        { requirementId: "r4", fitStatus: "NOT_APPLICABLE", companyEvidence: null },
      ],
      risks: [
        {
          id: "risk-1",
          requirementId: "r2",
          linkedRequirementIds: ["r2"],
          title: "ISO 27001 gap",
          underlyingKey: "cert:iso 27001",
          fitStatus: "CONFIRMED_GAP",
        },
      ],
      actions: [
        {
          linkedRequirementId: "r2",
          requirementText: "Bidder shall hold ISO 27001.",
          title: "Obtain ISO",
        },
      ],
      metadataStatus: "OK",
      metadataFactsNote: "buyer from notice.pdf",
    });
    assert.ok(isAnalysisIntegrityAttestation(integrity));
    assert.equal(integrity.partitionValid, true);
    assert.equal(integrity.counts.totalRequirements, 4);
    assert.equal(
      integrity.counts.verified +
        integrity.counts.needsVerification +
        integrity.counts.confirmedGaps +
        integrity.counts.notApplicable,
      4,
    );
    assert.equal(integrity.package.failedOrUnreadableCount, 1);
    assert.ok(integrity.checksPassed.includes("count_partition"));
  });

  it("rejects CONFIRMED_GAP without company evidence (missing ≠ gap)", () => {
    const ids = ["r1"];
    const snapshot = baseSnapshot(ids, {
      ready: 0,
      missing: 1,
      verify: 0,
      unknown: 0,
      notApplicable: 0,
    });
    assert.throws(
      () =>
        assertUniversalAnalysisIntegrity({
          snapshot,
          canonicalRequirementCount: 1,
          requirementIds: ids,
          requirementTexts: ["Bidder shall hold ISO 27001."],
          fitRows: [
            { requirementId: "r1", fitStatus: "CONFIRMED_GAP", companyEvidence: null },
          ],
          risks: [],
          actions: [],
          matrixRequirementIds: ids,
          summary: {
            totalRequirements: 1,
            ready: 0,
            missing: 1,
            verify: 0,
            unknown: 0,
            notApplicable: 0,
          },
          readinessTotal: 1,
        }),
      (err: unknown) => err instanceof AnalysisIntegrityError && err.code === "EVIDENCE_GAP",
    );
  });

  it("rejects orphan risk and duplicate underlyingKey", () => {
    const ids = ["r1"];
    const snapshot = baseSnapshot(ids, {
      ready: 0,
      missing: 0,
      verify: 1,
      unknown: 0,
      notApplicable: 0,
    });
    assert.throws(
      () =>
        assertUniversalAnalysisIntegrity({
          snapshot,
          canonicalRequirementCount: 1,
          requirementIds: ids,
          requirementTexts: ["Bidder shall provide references."],
          fitRows: [
            { requirementId: "r1", fitStatus: "NEEDS_VERIFICATION", companyEvidence: null },
          ],
          risks: [
            {
              requirementId: "missing-id",
              linkedRequirementIds: ["missing-id"],
              underlyingKey: "k1",
              title: "orphan",
            },
          ],
          actions: [],
          matrixRequirementIds: ids,
          summary: {
            totalRequirements: 1,
            ready: 0,
            missing: 0,
            verify: 1,
            unknown: 0,
            notApplicable: 0,
          },
          readinessTotal: 1,
        }),
      AnalysisIntegrityError,
    );

    assert.throws(
      () =>
        assertUniversalAnalysisIntegrity({
          snapshot,
          canonicalRequirementCount: 1,
          requirementIds: ids,
          requirementTexts: ["Bidder shall provide references."],
          fitRows: [
            { requirementId: "r1", fitStatus: "NEEDS_VERIFICATION", companyEvidence: null },
          ],
          risks: [
            { requirementId: "r1", underlyingKey: "same", title: "a" },
            { requirementId: "r1", underlyingKey: "same", title: "b" },
          ],
          actions: [],
          matrixRequirementIds: ids,
          summary: {
            totalRequirements: 1,
            ready: 0,
            missing: 0,
            verify: 1,
            unknown: 0,
            notApplicable: 0,
          },
          readinessTotal: 1,
        }),
      (err: unknown) => err instanceof AnalysisIntegrityError && err.code === "DUP_RISK",
    );
  });

  it("rejects orphan actions and broken partition", () => {
    const ids = ["r1", "r2"];
    // Inconsistent summary (ready=1 but total=2 with no other buckets) must fail partition.
    assert.throws(
      () =>
        assertUniversalAnalysisIntegrity({
          snapshot: freezeCanonicalAnalysisSnapshot({
            tenderId: "t1",
            packageLabel: "p",
            discoveredFileCount: 1,
            files: [
              { fileName: "a.pdf", processingStatus: "COMPLETED", role: null, error: null },
            ],
            metadata: {
              title: null,
              client: null,
              deadlineIso: null,
              deadlineTimezone: null,
              factsNote: null,
              metadataStatus: "UNKNOWN",
            },
            requirementIds: ids,
            summary: {
              totalRequirements: 2,
              ready: 2,
              missing: 0,
              verify: 0,
              unknown: 0,
              notApplicable: 0,
              sources: 0,
              risks: 0,
              requiredActions: 0,
              clarifications: 0,
            },
          }),
          canonicalRequirementCount: 2,
          requirementIds: ids,
          requirementTexts: ["A", "B"],
          fitRows: [
            { requirementId: "r1", fitStatus: "NEEDS_VERIFICATION", companyEvidence: null },
            { requirementId: "r2", fitStatus: "NEEDS_VERIFICATION", companyEvidence: null },
          ],
          risks: [],
          actions: [{ linkedRequirementId: "ghost", title: "bad" }],
          matrixRequirementIds: ids,
          summary: {
            totalRequirements: 2,
            ready: 1,
            missing: 0,
            verify: 0,
            unknown: 0,
            notApplicable: 0,
          },
          readinessTotal: 2,
        }),
      AnalysisIntegrityError,
    );
  });

  it("rejects CONDITIONAL requirement that lost trigger context", () => {
    const ids = ["r1"];
    const snapshot = baseSnapshot(ids, {
      ready: 0,
      missing: 0,
      verify: 1,
      unknown: 0,
      notApplicable: 0,
    });
    assert.throws(
      () =>
        assertUniversalAnalysisIntegrity({
          snapshot,
          canonicalRequirementCount: 1,
          requirementIds: ids,
          requirementTexts: ["If awarded Lot 2, bidder shall provide bond."],
          fitRows: [
            {
              requirementId: "r1",
              fitStatus: "NEEDS_VERIFICATION",
              companyEvidence: null,
              obligationStrength: "CONDITIONAL",
              conditionText: null,
            },
          ],
          risks: [],
          actions: [],
          matrixRequirementIds: ids,
          summary: {
            totalRequirements: 1,
            ready: 0,
            missing: 0,
            verify: 1,
            unknown: 0,
            notApplicable: 0,
          },
          readinessTotal: 1,
        }),
      (err: unknown) =>
        err instanceof AnalysisIntegrityError && err.code === "CONDITIONALITY_LOST",
    );
  });

  it("NEEDS_VERIFICATION without company evidence is allowed", () => {
    const ids = ["r1"];
    const snapshot = baseSnapshot(ids, {
      ready: 0,
      missing: 0,
      verify: 1,
      unknown: 0,
      notApplicable: 0,
    });
    const att = assertUniversalAnalysisIntegrity({
      snapshot,
      canonicalRequirementCount: 1,
      requirementIds: ids,
      requirementTexts: ["Bidder shall provide insurance certificate."],
      fitRows: [
        { requirementId: "r1", fitStatus: "NEEDS_VERIFICATION", companyEvidence: null },
      ],
      risks: [],
      actions: [],
      matrixRequirementIds: ids,
      summary: {
        totalRequirements: 1,
        ready: 0,
        missing: 0,
        verify: 1,
        unknown: 0,
        notApplicable: 0,
      },
      readinessTotal: 1,
    });
    assert.equal(att.counts.needsVerification, 1);
    assert.equal(att.counts.confirmedGaps, 0);
  });
});
