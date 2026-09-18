import assert from "node:assert/strict";
import test from "node:test";
import {
  buildSeedTaskCandidates,
  buildTaskDedupeKey,
  canAssignTeamTasks,
  canRespondToTeamTask,
  effectiveTaskStatus,
  isOpenTaskStatus,
  suggestDepartmentForKind,
  summarizeUnresolvedCriticalTasks,
} from "@/domain/team-workflow";
import { refineDecisionWithEvidence } from "@/domain/decision/recommendation";
import { runDecisionEngine } from "@/domain/decision/engine";
import type { RuleCompanyProfile, RuleRequirement } from "@/domain/decision/types";

test("effectiveTaskStatus marks overdue without inventing completion", () => {
  assert.equal(
    effectiveTaskStatus({
      status: "PENDING",
      deadline: new Date("2020-01-01"),
      asOf: new Date("2026-08-31"),
    }),
    "OVERDUE",
  );
  assert.equal(
    effectiveTaskStatus({
      status: "COMPLETED",
      deadline: new Date("2020-01-01"),
      asOf: new Date("2026-08-31"),
    }),
    "COMPLETED",
  );
  assert.equal(
    effectiveTaskStatus({
      status: "IN_PROGRESS",
      deadline: new Date("2027-01-01"),
      asOf: new Date("2026-08-31"),
    }),
    "IN_PROGRESS",
  );
});

test("seed candidates only from real gaps — never invents", () => {
  const candidates = buildSeedTaskCandidates({
    companyId: "co1",
    tenderId: "t1",
    tenderDeadline: new Date("2026-12-01"),
    requirements: [
      {
        id: "r1",
        description: "ISO 27001 mandatory",
        category: "Certification",
        mandatory: true,
        status: "FAILED",
      },
      {
        id: "r2",
        description: "Nice-to-have training",
        category: "HR",
        mandatory: false,
        status: "MISSING",
      },
      {
        id: "r3",
        description: "Matched web delivery",
        category: "Technical",
        mandatory: true,
        status: "MATCHED",
      },
    ],
    risks: [
      {
        id: "risk1",
        description: "High liability exposure",
        category: "Legal",
        severity: "HIGH",
        status: "OPEN",
      },
      {
        id: "risk2",
        description: "Low note",
        category: "Ops",
        severity: "LOW",
        status: "OPEN",
      },
    ],
    missingDocs: [
      {
        id: "d1",
        documentName: "Bank guarantee",
        reason: "Required by tender",
        severity: "CRITICAL",
        status: "OPEN",
      },
      {
        id: "d2",
        documentName: "Old brochure",
        reason: "Resolved",
        severity: "MEDIUM",
        status: "RESOLVED",
      },
    ],
  });

  assert.ok(candidates.some((c) => c.requirementId === "r1"));
  assert.ok(!candidates.some((c) => c.requirementId === "r2"));
  assert.ok(!candidates.some((c) => c.requirementId === "r3"));
  assert.ok(candidates.some((c) => c.riskId === "risk1"));
  assert.ok(!candidates.some((c) => c.riskId === "risk2"));
  assert.ok(candidates.some((c) => c.missingDocId === "d1"));
  assert.ok(!candidates.some((c) => c.missingDocId === "d2"));
  assert.equal(
    candidates.find((c) => c.missingDocId === "d1")!.department,
    "FINANCE",
  );
  assert.equal(
    candidates.find((c) => c.riskId === "risk1")!.department,
    "LEGAL",
  );
});

test("dedupe keys are stable for the same source", () => {
  const a = buildTaskDedupeKey({
    companyId: "co",
    tenderId: "t",
    kind: "MISSING_DOCUMENT",
    sourceId: "doc1",
  });
  const b = buildTaskDedupeKey({
    companyId: "co",
    tenderId: "t",
    kind: "MISSING_DOCUMENT",
    sourceId: "doc1",
  });
  assert.equal(a, b);
  assert.notEqual(
    a,
    buildTaskDedupeKey({
      companyId: "co",
      tenderId: "t",
      kind: "RISK_MITIGATION",
      sourceId: "doc1",
    }),
  );
});

test("permissions: viewers cannot assign; assignees can respond", () => {
  assert.equal(canAssignTeamTasks("VIEWER"), false);
  assert.equal(canAssignTeamTasks("MEMBER"), true);
  assert.equal(
    canRespondToTeamTask({
      role: "MEMBER",
      userId: "u1",
      assigneeUserId: "u1",
    }),
    true,
  );
  assert.equal(
    canRespondToTeamTask({
      role: "MEMBER",
      userId: "u1",
      assigneeUserId: "u2",
    }),
    false,
  );
  assert.equal(
    canRespondToTeamTask({
      role: "ADMIN",
      userId: "u1",
      assigneeUserId: "u2",
    }),
    true,
  );
});

test("unresolved critical tasks summary never invents titles", () => {
  const summary = summarizeUnresolvedCriticalTasks([
    {
      status: "PENDING",
      deadline: null,
      priority: "CRITICAL",
      title: "Provide bank guarantee",
    },
    {
      status: "COMPLETED",
      deadline: null,
      priority: "CRITICAL",
      title: "Done risk",
    },
    {
      status: "IN_PROGRESS",
      deadline: null,
      priority: "LOW",
      title: "Minor note",
    },
  ]);
  assert.equal(summary.openCriticalCount, 1);
  assert.equal(summary.openCount, 2);
  assert.deepEqual(summary.titles, ["Provide bank guarantee"]);
  assert.ok(summary.note?.includes("critical"));
  assert.ok(summary.note?.includes("do not automatically change"));
});

test("team workflow never flips Decision Engine NO-BID", () => {
  const profile: RuleCompanyProfile = {
    companyName: "Acme",
    industry: "IT",
    country: "Morocco",
    companySize: "51-200",
    experienceLevel: "experienced",
    services: ["software"],
    certifications: ["ISO 9001"],
    experienceYears: 8,
    revenueRange: "1m-5m",
    employeeRange: "51-200",
    geographicCoverage: ["Morocco"],
    contractSizeMin: null,
    contractSizeMax: null,
    customQualificationRules: [],
  };
  const requirements: RuleRequirement[] = [
    {
      category: "Certification",
      description: "ISO 27001 mandatory",
      mandatory: true,
      value: null,
      status: "UNCERTAIN",
      evidence: "not_held: ISO 27001",
      sourceDocument: "Company_Profile.pdf",
    },
  ];
  const engine = runDecisionEngine({
    profile: { ...profile, certifications: ["NOT_HELD: ISO 27001", "ISO 9001"] },
    requirements,
    estimatedValue: 100_000,
    tenderContext: {
      title: "Secure RFP",
      client: "Gov",
      country: "Morocco",
      industry: "IT",
      tenderText: "ISO 27001 mandatory",
    },
  });
  assert.equal(engine.decision, "NO_BID");

  const refined = refineDecisionWithEvidence({
    engine,
    aiParticipated: false,
    teamWorkflow: {
      openCriticalCount: 0,
      openCount: 0,
      titles: [],
      note: null,
    },
  });
  assert.equal(refined.decision, "NO_BID");

  const withOpenTasks = refineDecisionWithEvidence({
    engine: { ...engine, decision: "BID", hardFailure: false },
    aiParticipated: false,
    teamWorkflow: {
      openCriticalCount: 3,
      openCount: 5,
      titles: ["Task A"],
      note: "3 unresolved critical team tasks",
    },
  });
  // Team workflow must NOT force a decision change by itself in refine —
  // only readiness/compliance/risk/deadline rules may downgrade.
  // Note is recorded in missingDataNotes.
  assert.ok(
    withOpenTasks.missingDataNotes.some((n) =>
      n.includes("unresolved critical team"),
    ),
  );
});

test("department suggestion is deterministic", () => {
  assert.equal(suggestDepartmentForKind("MISSING_DOCUMENT", "bank guarantee"), "FINANCE");
  assert.equal(suggestDepartmentForKind("RISK_MITIGATION", "legal liability"), "LEGAL");
  assert.equal(suggestDepartmentForKind("REQUIREMENT_GAP", "API security"), "TECHNICAL");
});

test("open status helper", () => {
  assert.equal(isOpenTaskStatus("PENDING"), true);
  assert.equal(isOpenTaskStatus("OVERDUE"), true);
  assert.equal(isOpenTaskStatus("COMPLETED"), false);
});
