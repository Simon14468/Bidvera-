/**
 * Canonical read must not drop Guardian stamps or invent COMPLETE for incomplete packages.
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { resolveIntelligenceForCanonicalRead } from "@/application/canonical-tender-analysis";
import {
  assertReportPublicationAllowed,
  type DecisionGuardianSnapshot,
} from "@/domain/decision-validation";
import type { TenderIntelligenceBreakdown } from "@/domain/tender-intelligence";

const guardianStamp: DecisionGuardianSnapshot = {
  ok: true,
  validatedAt: new Date().toISOString(),
  durationMs: 12,
  checksRun: ["document-integrity"],
  contentHash: "abc123",
  blockingFailureCount: 0,
  advisoryFailureCount: 0,
  version: "decision-guardian/v1",
};

function incompleteStored(): TenderIntelligenceBreakdown {
  return {
    complianceStatus: "INCOMPLETE",
    analysisMode: "TENDER",
    extractionGate: {
      status: "blocked",
      reason: "CPS_MISSING",
      message: "CPS missing",
    },
    complianceMatrix: [],
    complianceSummary: {
      totalRequirements: 0,
      ready: 0,
      missing: 0,
      verify: 0,
      notApplicable: 0,
      unknown: 0,
      sources: 0,
      risks: 0,
      requiredActions: 0,
      clarifications: 0,
    },
    risks: [],
    contradictions: [],
    clarificationQuestions: [],
    keyBlockers: ["Analysis incomplete"],
    decisionContext: "incomplete",
    learningSignal: null,
    decisionGuardian: null,
  };
}

function completeFallback(): TenderIntelligenceBreakdown {
  return {
    ...incompleteStored(),
    complianceStatus: "COMPLETE",
    extractionGate: undefined,
    complianceMatrix: [],
    complianceSummary: {
      totalRequirements: 0,
      ready: 0,
      missing: 0,
      verify: 0,
      notApplicable: 0,
      unknown: 0,
      sources: 0,
      risks: 0,
      requiredActions: 0,
      clarifications: 0,
    },
    keyBlockers: [],
  };
}

describe("resolveIntelligenceForCanonicalRead", () => {
  it("keeps incomplete packages INCOMPLETE even when counts look stale", () => {
    const resolved = resolveIntelligenceForCanonicalRead({
      scoringBlocked: true,
      companyKnowledgeOnly: false,
      storedAnalysisStale: true,
      stored: incompleteStored(),
      buildFallback: completeFallback,
      hydrate: (s) => s,
    });
    assert.equal(resolved.complianceStatus, "INCOMPLETE");
    assert.equal(resolved.decisionGuardian ?? null, null);
    assert.doesNotThrow(() =>
      assertReportPublicationAllowed({
        companyKnowledgeOnly: false,
        analysisMode: "TENDER",
        complianceStatus: resolved.complianceStatus ?? null,
        decisionGuardian: resolved.decisionGuardian ?? null,
      }),
    );
  });

  it("never drops a persisted Guardian stamp on stale complete reads", () => {
    const stamped: TenderIntelligenceBreakdown = {
      ...completeFallback(),
      decisionGuardian: guardianStamp,
    };
    const resolved = resolveIntelligenceForCanonicalRead({
      scoringBlocked: false,
      companyKnowledgeOnly: false,
      storedAnalysisStale: true,
      stored: stamped,
      buildFallback: () => {
        throw new Error("must not rebuild stamped release");
      },
      hydrate: (s) => ({ ...s, learningSignal: null }),
    });
    assert.equal(resolved.complianceStatus, "COMPLETE");
    assert.deepEqual(resolved.decisionGuardian, guardianStamp);
  });

  it("blocks COMPLETE publication when Guardian stamp is missing", () => {
    assert.throws(() =>
      assertReportPublicationAllowed({
        companyKnowledgeOnly: false,
        analysisMode: "TENDER",
        complianceStatus: "COMPLETE",
        decisionGuardian: null,
      }),
    );
  });
});
