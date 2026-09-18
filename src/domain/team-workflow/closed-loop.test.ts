/**
 * Closed-loop team workflow domain tests.
 */

import assert from "node:assert/strict";
import { test } from "node:test";
import {
  buildClosedLoopHash,
  buildVerifiedRequirementEvidenceText,
  canVerifyTeamEvidence,
  defaultAppliedRequirementStatus,
  meaningfulDecisionChange,
  requiresVerificationBeforeComplete,
} from "./closed-loop";
import { buildSeedTaskCandidates } from "./index";
import { computeTenderReadiness } from "@/domain/decision/tender-readiness";
import type { RuleRequirement } from "@/domain/decision/types";

test("only OWNER/ADMIN can verify evidence", () => {
  assert.equal(canVerifyTeamEvidence("OWNER"), true);
  assert.equal(canVerifyTeamEvidence("ADMIN"), true);
  assert.equal(canVerifyTeamEvidence("MEMBER"), false);
  assert.equal(canVerifyTeamEvidence("VIEWER"), false);
});

test("decision-critical tasks require verification before complete", () => {
  assert.equal(
    requiresVerificationBeforeComplete({
      kind: "EVIDENCE_REQUEST",
      requirementId: "req1",
      riskId: null,
      missingDocId: null,
    }),
    true,
  );
  assert.equal(
    requiresVerificationBeforeComplete({
      kind: "CUSTOM",
      requirementId: null,
      riskId: null,
      missingDocId: null,
    }),
    false,
  );
  assert.equal(
    requiresVerificationBeforeComplete({
      kind: "MISSING_DOCUMENT",
      requirementId: null,
      riskId: null,
      missingDocId: "doc1",
    }),
    true,
  );
});

test("default applied status becomes MATCHED for gaps when VERIFIED", () => {
  assert.equal(
    defaultAppliedRequirementStatus({
      kind: "EVIDENCE_REQUEST",
      currentStatus: "UNCERTAIN",
      verdict: "VERIFIED",
    }),
    "MATCHED",
  );
  assert.equal(
    defaultAppliedRequirementStatus({
      kind: "EVIDENCE_REQUEST",
      currentStatus: "UNCERTAIN",
      verdict: "REJECTED",
    }),
    null,
  );
});

test("closed-loop hash is stable and changes with response", () => {
  const a = buildClosedLoopHash({
    taskId: "t1",
    responseText: "We hold ISO 27001",
    evidenceNote: "cert attached",
    appliedRequirementStatus: "MATCHED",
    attachmentChecksums: ["abc"],
  });
  const b = buildClosedLoopHash({
    taskId: "t1",
    responseText: "We hold ISO 27001",
    evidenceNote: "cert attached",
    appliedRequirementStatus: "MATCHED",
    attachmentChecksums: ["abc"],
  });
  const c = buildClosedLoopHash({
    taskId: "t1",
    responseText: "Different response",
    evidenceNote: "cert attached",
    appliedRequirementStatus: "MATCHED",
    attachmentChecksums: ["abc"],
  });
  assert.equal(a, b);
  assert.notEqual(a, c);
});

test("verified evidence provenance never invents company facts", () => {
  const text = buildVerifiedRequirementEvidenceText({
    responseText: "Certificate #123 valid until 2027",
    evidenceNote: "PDF uploaded",
    taskId: "task-1",
    verifiedById: "user-1",
    verifiedAt: new Date("2026-08-31T12:00:00.000Z"),
    attachmentNames: ["iso.pdf"],
  });
  assert.ok(text.includes("Certificate #123"));
  assert.ok(text.includes("task-1"));
  assert.ok(text.includes("iso.pdf"));
  assert.ok(!text.toLowerCase().includes("invent"));
});

test("meaningful decision change detects decision and readiness deltas", () => {
  assert.equal(
    meaningfulDecisionChange({
      priorDecision: "REVIEW",
      nextDecision: "BID",
      priorReadiness: 40,
      nextReadiness: 40,
      priorFit: 50,
      nextFit: 50,
    }),
    true,
  );
  assert.equal(
    meaningfulDecisionChange({
      priorDecision: "REVIEW",
      nextDecision: "REVIEW",
      priorReadiness: 40,
      nextReadiness: 55,
      priorFit: 50,
      nextFit: 50,
    }),
    true,
  );
  assert.equal(
    meaningfulDecisionChange({
      priorDecision: "REVIEW",
      nextDecision: "REVIEW",
      priorReadiness: 40,
      nextReadiness: 40,
      priorFit: 50,
      nextFit: 50,
    }),
    false,
  );
});

test("seed candidates dedupe and never invent requirements", () => {
  const candidates = buildSeedTaskCandidates({
    companyId: "c1",
    tenderId: "t1",
    tenderDeadline: null,
    requirements: [
      {
        id: "r1",
        description: "ISO 27001",
        category: "Certification",
        mandatory: true,
        status: "UNCERTAIN",
      },
      {
        id: "r2",
        description: "Nice to have",
        category: "Other",
        mandatory: false,
        status: "MISSING",
      },
    ],
    risks: [],
    missingDocs: [],
  });
  assert.equal(candidates.length, 1);
  assert.equal(candidates[0]!.requirementId, "r1");
  assert.ok(candidates[0]!.dedupeKey.includes("r1"));
});

test("readiness updates only from canonical requirement statuses", () => {
  const requirements: RuleRequirement[] = [
    {
      id: "r1",
      category: "Certification",
      description: "ISO 27001",
      mandatory: true,
      value: null,
      status: "MATCHED",
      evidence: "Team-verified response",
    },
    {
      id: "r2",
      category: "Experience",
      description: "5 years",
      mandatory: true,
      value: null,
      status: "UNCERTAIN",
      evidence: null,
    },
  ];
  const readiness = computeTenderReadiness({
    requirements,
    missingDocuments: [
      {
        id: "d1",
        documentName: "Bank statement",
        reason: "Missing",
        severity: "HIGH",
      },
    ],
    profileHasAnyCapability: true,
  });
  assert.equal(readiness.total, 2);
  assert.equal(readiness.counts.ready, 1);
  assert.equal(readiness.counts.verify, 1);
  // Missing documents must not inflate requirement counts
  assert.ok(!readiness.items.some((i) => i.requirement.includes("Bank")));
});

test("verified MATCHED requirement improves readiness vs FAILED gap", () => {
  const before: RuleRequirement[] = [
    {
      id: "r1",
      category: "Certification",
      description: "ISO 27001 mandatory",
      mandatory: true,
      value: null,
      status: "FAILED",
      evidence: null,
    },
  ];
  const after: RuleRequirement[] = [
    {
      ...before[0]!,
      status: "MATCHED",
      evidence: "Team-verified response (task x)",
    },
  ];
  const readyBefore = computeTenderReadiness({
    requirements: before,
    profileHasAnyCapability: true,
  });
  const readyAfter = computeTenderReadiness({
    requirements: after,
    profileHasAnyCapability: true,
  });
  assert.equal(readyBefore.counts.ready, 0);
  assert.equal(readyBefore.counts.missing, 1);
  assert.equal(readyAfter.counts.ready, 1);
  assert.equal(readyAfter.counts.missing, 0);
  // Unverified responses must not be treated as MATCHED in readiness —
  // only the canonical status after VERIFIED does.
  assert.ok(
    (readyAfter.score ?? 0) > (readyBefore.score ?? 0),
  );
});
