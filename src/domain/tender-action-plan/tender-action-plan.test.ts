/**
 * Tender Action Plan — unit tests.
 */

import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { buildEvidenceIntelligence } from "@/domain/evidence-intelligence";
import {
  buildVerificationIntelligence,
  type CanonicalEvidenceRecord,
} from "@/domain/evidence-verification";
import {
  actionDedupeKey,
  buildActionStableId,
  buildTenderActionPlan,
  deriveActionStatus,
  mergeActionPlanItems,
  priorityFromSignals,
  rejectClientProvidedActionPriority,
  rejectClientProvidedActionSource,
  rejectClientProvidedActionTransition,
  TENDER_ACTION_PLAN_INVARIANTS,
} from "@/domain/tender-action-plan";
import type { ComplianceRow } from "@/domain/tender-intelligence/types";

function ev(
  over: Partial<CanonicalEvidenceRecord> & { id: string; requirementId: string },
): CanonicalEvidenceRecord {
  return {
    evidenceText: "sample excerpt",
    verificationStatus: "UNKNOWN",
    sourcePage: null,
    sourceSection: null,
    ...over,
  };
}

function complianceRow(over: Partial<ComplianceRow> & Pick<ComplianceRow, "requirementId">): ComplianceRow {
  return {
    id: over.requirementId,
    requirement: "Test requirement",
    requirementType: "Technical",
    mandatory: true,
    priority: "HIGH",
    status: "MISSING",
    companyFit: null,
    sourceDocument: "RFP.pdf",
    pageNumber: 8,
    section: "2.1",
    evidence: null,
    tenderSource: null,
    companyEvidence: null,
    companyEvidenceMessage: null,
    notes: null,
    sourceBasis: "DIRECT_SOURCE",
    sourceLocated: true,
    evidenceId: null,
    risk: null,
    requiredAction: "Verify minimum 5 years public-sector AV experience.",
    ...over,
  };
}

function baseInput(
  over: Partial<Parameters<typeof buildTenderActionPlan>[0]> = {},
): Parameters<typeof buildTenderActionPlan>[0] {
  return {
    tenderId: "t-action-1",
    companyId: "c1",
    tenderDeadline: new Date("2026-09-15T12:00:00.000Z"),
    complianceMatrix: [],
    evidenceIntelligence: null,
    risks: [],
    keyBlockers: [],
    readiness: { attention: [], items: [] },
    fitBreakdown: { overall: null, dimensions: [], matches: [], gaps: [], unknowns: [], attention: [], recommendation: "" },
    recommendation: null,
    teamTasks: [],
    asOf: new Date("2026-09-01T12:00:00.000Z"),
    ...over,
  };
}

describe("tender action plan invariants", () => {
  it("domain is read-only and does not mutate decision", () => {
    assert.equal(TENDER_ACTION_PLAN_INVARIANTS.readOnly, true);
    assert.equal(TENDER_ACTION_PLAN_INVARIANTS.mutatesDecision, false);
    assert.equal(TENDER_ACTION_PLAN_INVARIANTS.clientCompletionTrusted, false);
  });

  it("rejects client-provided status, priority, and source", () => {
    assert.throws(() =>
      rejectClientProvidedActionTransition({
        clientStatus: "COMPLETED",
        serverStatus: "OPEN",
      }),
    );
    assert.throws(() =>
      rejectClientProvidedActionPriority({
        clientPriority: "CRITICAL",
        serverPriority: "LOW",
      }),
    );
    assert.throws(() =>
      rejectClientProvidedActionSource({
        clientSourceId: "fake",
        serverSourceId: "req:r1",
      }),
    );
  });
});

describe("action generation", () => {
  it("generates action from missing evidence", () => {
    const verification = buildVerificationIntelligence({
      defaultDocumentName: "RFP.pdf",
      requirements: [
        {
          id: "r1",
          description: "ISO 27001 certification",
          mandatory: true,
          value: null,
          readinessStatus: "MISSING",
        },
      ],
      evidence: [],
    });
    const bundle = buildEvidenceIntelligence({
      verificationIntelligence: verification,
      complianceMatrix: [
        complianceRow({
          requirementId: "r1",
          requirement: "ISO 27001 certification",
          status: "MISSING",
          requiredAction: "Upload ISO 27001 certificate.",
        }),
      ],
      evidence: [],
      requirements: [{ id: "r1", category: "Certification", status: "MISSING" }],
    });

    const plan = buildTenderActionPlan(
      baseInput({
        evidenceIntelligence: bundle,
        complianceMatrix: [
          complianceRow({
            requirementId: "r1",
            requirement: "ISO 27001 certification",
            status: "MISSING",
            requiredAction: "Upload ISO 27001 certificate.",
          }),
        ],
      }),
    );

    const missing = plan.items.filter((i) => i.sourceType === "MISSING_EVIDENCE");
    assert.ok(missing.length >= 1);
    assert.equal(missing[0]!.linkedRequirementId, "r1");
    assert.equal(missing[0]!.verificationRequired, false);
    assert.ok(missing[0]!.whyNeeded.includes("MISSING") || missing[0]!.whyNeeded.includes("missing"));
    assert.match(missing[0]!.title, /certification|ISO 27001/i);
    assert.doesNotMatch(missing[0]!.title, /linked requirement/i);
  });

  it("generates action from unverified evidence", () => {
    const verification = buildVerificationIntelligence({
      defaultDocumentName: "RFP.pdf",
      requirements: [
        {
          id: "r1",
          description: "CNSS certificate",
          mandatory: true,
          value: null,
          readinessStatus: "VERIFY",
        },
      ],
      evidence: [
        ev({
          id: "e1",
          requirementId: "r1",
          evidenceText: "CNSS registration reference",
          verificationStatus: "INFERRED",
          documentName: "CNSS.pdf",
        }),
      ],
    });
    const bundle = buildEvidenceIntelligence({
      verificationIntelligence: verification,
      complianceMatrix: [
        complianceRow({
          requirementId: "r1",
          requirement: "CNSS certificate",
          status: "VERIFY",
          requiredAction: "Verify CNSS certificate.",
        }),
      ],
      evidence: [
        ev({
          id: "e1",
          requirementId: "r1",
          evidenceText: "CNSS registration reference",
          verificationStatus: "INFERRED",
          documentName: "CNSS.pdf",
        }),
      ],
      requirements: [{ id: "r1", category: "Certification", status: "UNCERTAIN" }],
    });

    const plan = buildTenderActionPlan(
      baseInput({
        evidenceIntelligence: bundle,
        complianceMatrix: [
          complianceRow({
            requirementId: "r1",
            status: "VERIFY",
            requiredAction: "Verify CNSS certificate.",
          }),
        ],
      }),
    );

    const verify = plan.items.find((i) => i.sourceType === "UNVERIFIED_EVIDENCE");
    assert.ok(verify);
    assert.equal(verify!.linkedEvidenceId, "e1");
    assert.equal(verify!.status, "OPEN");
    assert.match(verify!.title, /registration|certification|CNSS/i);
    assert.doesNotMatch(verify!.title, /linked requirement/i);
  });

  it("generates requirement blocker actions", () => {
    const plan = buildTenderActionPlan(
      baseInput({
        complianceMatrix: [
          complianceRow({
            requirementId: "r6",
            requirement: "Minimum 5 years public-sector AV experience",
            status: "VERIFY",
            requiredAction: "Verify minimum 5 years public-sector AV experience.",
            pageNumber: 8,
          }),
        ],
      }),
    );

    const action = plan.items.find((i) => i.linkedRequirementId === "r6");
    assert.ok(action);
    assert.ok(action!.sourceTrace.includes("Page 8") || action!.sourceTrace.includes("Requirement"));
    assert.equal(action!.blocking, false, "VERIFY status must not produce blocking actions");
  });

  it("generates risk blocker actions", () => {
    const plan = buildTenderActionPlan(
      baseInput({
        risks: [
          {
            id: "risk-1",
            title: "Financial capacity unclear",
            category: "Financial",
            severity: "HIGH",
            severityCanonical: "HIGH",
            explanation: "Turnover evidence missing.",
            impact: "May fail eligibility.",
            recommendedAction: "Provide audited financial statements.",
            source: {
              document: "RFP.pdf",
              page: 12,
              section: "4.2",
              excerpt: null,
              basis: "DIRECT_SOURCE",
              located: true,
            },
          },
        ],
      }),
    );

    const risk = plan.items.find((i) => i.sourceType === "UNRESOLVED_RISK");
    assert.ok(risk);
    assert.equal(risk!.linkedRiskId, "risk-1");
    assert.equal(risk!.priority, "HIGH");
  });

  it("generates readiness blocker from keyBlockers", () => {
    const plan = buildTenderActionPlan(
      baseInput({
        keyBlockers: ["Mandatory certification not verified"],
        readiness: {
          attention: ["Verify eligibility documents before bid"],
          items: [],
        },
      }),
    );

    assert.ok(plan.items.some((i) => i.sourceType === "READINESS_BLOCKER"));
  });

  it("generates company-fit gap actions", () => {
    const plan = buildTenderActionPlan(
      baseInput({
        fitBreakdown: {
          overall: 45,
          dimensions: [],
          matches: [],
          gaps: ["No public-sector AV references in profile"],
          unknowns: [],
          attention: [],
          recommendation: "Address gaps",
        },
      }),
    );

    const gap = plan.items.find((i) => i.sourceType === "COMPANY_FIT_GAP");
    assert.ok(gap);
    assert.ok(gap!.description.includes("public-sector AV"));
    assert.match(gap!.title, /public-sector AV/i);
  });

  it("adds deadline urgency when blocking items exist", () => {
    const plan = buildTenderActionPlan(
      baseInput({
        tenderDeadline: new Date("2026-09-05T12:00:00.000Z"),
        asOf: new Date("2026-09-01T12:00:00.000Z"),
        keyBlockers: ["Critical gap"],
      }),
    );

    const deadline = plan.items.find((i) => i.sourceType === "APPROACHING_DEADLINE");
    assert.ok(deadline);
    assert.equal(deadline!.priority, "CRITICAL");
    assert.equal(plan.deadlineUrgency.daysRemaining, 4);
  });

  it("does not invent deadline when unknown", () => {
    const plan = buildTenderActionPlan(
      baseInput({
        tenderDeadline: null,
        keyBlockers: ["Gap"],
      }),
    );

    assert.equal(plan.deadlineUrgency.tenderDeadline, null);
    assert.equal(plan.deadlineUrgency.daysRemaining, null);
    assert.ok(!plan.items.some((i) => i.sourceType === "APPROACHING_DEADLINE"));
  });

  it("links team workflow tasks", () => {
    const plan = buildTenderActionPlan(
      baseInput({
        teamTasks: [
          {
            id: "task-fin-1",
            title: "Verify financial capacity",
            status: "PENDING",
            priority: "HIGH",
            requirementId: "r-fin",
            riskId: null,
            missingDocId: null,
            department: "FINANCE",
            deadline: new Date("2026-09-10T12:00:00.000Z"),
          },
        ],
      }),
    );

    const team = plan.items.find((i) => i.linkedTeamTaskId === "task-fin-1");
    assert.ok(team);
    assert.equal(team!.ownerLabel, "FINANCE");
    assert.equal(team!.sourceType, "TEAM_VERIFICATION_TASK");
  });

  it("isolates Decision Simulator actions as SIMULATION ONLY", () => {
    const plan = buildTenderActionPlan(
      baseInput({
        simulationHints: [
          {
            id: "sim-1",
            label: "If technical certification is verified",
            currentDecisionLabel: "CONDITIONAL GO",
            projectedDecisionLabel: "GO",
            requirementId: "r-cert",
          },
        ],
      }),
    );

    const sim = plan.items.find((i) => i.sourceType === "DECISION_SIMULATOR");
    assert.ok(sim);
    assert.equal(sim!.simulationOnly, true);
    assert.ok(sim!.title.includes("SIMULATION ONLY"));
    assert.ok(sim!.description.includes("not the actual decision"));
    assert.equal(plan.summary.simulationOnly, 1);
  });

  it("does not create filler actions when nothing unresolved", () => {
    const plan = buildTenderActionPlan(baseInput());
    assert.equal(plan.items.length, 0);
    assert.equal(plan.summary.total, 0);
  });
});

describe("action state transitions", () => {
  it("verified evidence resolves verification action to COMPLETED", () => {
    const status = deriveActionStatus({
      sourceType: "UNVERIFIED_EVIDENCE",
      readinessStatus: "READY",
      evidenceState: "VERIFIED",
    });
    assert.equal(status, "COMPLETED");
  });

  it("team task completed with unverified evidence → AWAITING_VERIFICATION", () => {
    const status = deriveActionStatus({
      sourceType: "TEAM_VERIFICATION_TASK",
      evidenceState: "FOUND_UNVERIFIED",
      teamTask: {
        id: "t1",
        title: "Verify",
        status: "COMPLETED",
        priority: "HIGH",
        requirementId: "r1",
        riskId: null,
        missingDocId: null,
        department: "TECHNICAL",
        deadline: null,
      },
    });
    assert.equal(status, "AWAITING_VERIFICATION");
  });
});

describe("deduplication and re-analysis", () => {
  it("stable id from source type and source id", () => {
    const a = buildActionStableId({
      tenderId: "t1",
      sourceType: "MISSING_EVIDENCE",
      sourceId: "r1:MISSING_EVIDENCE",
    });
    const b = buildActionStableId({
      tenderId: "t1",
      sourceType: "MISSING_EVIDENCE",
      sourceId: "r1:MISSING_EVIDENCE",
    });
    assert.equal(a, b);
  });

  it("re-analysis does not duplicate same source", () => {
    const input = baseInput({
      keyBlockers: ["Blocker A"],
    });
    const first = buildTenderActionPlan(input);
    const second = buildTenderActionPlan({
      ...input,
      previousPlan: first,
    });

    const keys = second.items.map((i) => actionDedupeKey(i));
    assert.equal(new Set(keys).size, keys.length);
    assert.equal(second.items[0]!.id, first.items[0]!.id);
    assert.equal(second.items[0]!.createdAt, first.items[0]!.createdAt);
  });

  it("stale actions cancelled when source resolved", () => {
    const asOf = new Date("2026-09-01T12:00:00.000Z");
    const previous = buildTenderActionPlan(
      baseInput({ keyBlockers: ["Old blocker"], asOf }),
    );
    const merged = mergeActionPlanItems({
      tenderId: "t-action-1",
      generated: [],
      previous: previous.items,
      asOf: new Date("2026-09-02T12:00:00.000Z"),
    });

    assert.ok(merged.some((i) => i.status === "CANCELLED"));
  });
});

describe("priority rules", () => {
  it("mandatory missing → CRITICAL", () => {
    assert.equal(
      priorityFromSignals({ mandatory: true, readinessStatus: "MISSING" }),
      "CRITICAL",
    );
  });

  it("does not invent urgency without signals", () => {
    assert.equal(priorityFromSignals({}), "LOW");
  });
});

describe("after completion contract", () => {
  it("actions describe canonical re-run, not direct GO", () => {
    const plan = buildTenderActionPlan(
      baseInput({ keyBlockers: ["Gap"] }),
    );
    const item = plan.items[0]!;
    assert.ok(item.afterCompletion.includes("Decision Engine"));
    assert.ok(!item.afterCompletion.toLowerCase().includes("task completed → go"));
  });
});
