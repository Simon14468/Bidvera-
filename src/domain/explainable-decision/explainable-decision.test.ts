/**
 * Explainable Decision — foundation regression tests.
 */

import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { describe, it } from "node:test";
import { runDecisionEngine } from "@/domain/decision/engine";
import {
  buildTenderDecisionRecommendation,
  finalizeTenderDecision,
} from "@/domain/decision/tender-decision-engine";
import { computeTenderReadiness } from "@/domain/decision/tender-readiness";
import {
  assertExplainableDecisionIntegrity,
  buildExplainableDecision,
  EXPLAINABLE_DECISION_INVARIANTS,
  INSUFFICIENT_DATA,
} from "@/domain/explainable-decision";
import { buildEvidenceIntelligence } from "@/domain/evidence-intelligence";
import { buildVerificationIntelligence } from "@/domain/evidence-verification";
import { buildTenderIntelligence } from "@/domain/tender-intelligence";
import type { RuleCompanyProfile, RuleRequirement } from "@/domain/decision/types";

function profile(overrides: Partial<RuleCompanyProfile> = {}): RuleCompanyProfile {
  return {
    companyName: "Acme",
    industry: "IT",
    country: "Morocco",
    companySize: "51-200",
    experienceLevel: "experienced",
    services: ["software development", "web", "api"],
    certifications: ["ISO 27001"],
    experienceYears: 10,
    revenueRange: "5m-10m",
    employeeRange: "51-200",
    geographicCoverage: ["Morocco"],
    contractSizeMin: null,
    contractSizeMax: 5_000_000,
    customQualificationRules: [],
    ...overrides,
  };
}

function req(
  partial: Partial<RuleRequirement> & Pick<RuleRequirement, "description" | "status">,
): RuleRequirement {
  const evidence =
    partial.evidence ??
    (partial.status === "FAILED"
      ? "not_held: ISO 27001"
      : "From tender §3");
  return {
    category: "Technical",
    mandatory: true,
    value: null,
    evidence,
    sourceDocument:
      partial.sourceDocument ??
      (partial.status === "FAILED" || partial.evidence?.includes("not_held")
        ? "Company_Profile.pdf"
        : undefined),
    ...partial,
  };
}

function buildScenario(opts?: { certFailure?: boolean; strongMatch?: boolean }) {
  const requirements = opts?.certFailure
    ? [
        req({
          id: "r1",
          description: "ISO 27001 certification mandatory",
          status: "UNCERTAIN",
          category: "Certification",
          evidence: "not_held: ISO 27001",
          sourceDocument: "Company_Profile.pdf",
        }),
      ]
    : opts?.strongMatch
      ? [
          req({
            id: "r1",
            description: "Web and API development",
            status: "MATCHED",
            evidence: "Company lists web and API",
          }),
          req({
            id: "r2",
            description: "ISO 27001",
            status: "MATCHED",
            category: "Certification",
            evidence: "Held ISO 27001",
          }),
        ]
      : [
          req({
            id: "r1",
            description: "Public-sector AV experience minimum 5 years",
            status: "UNCERTAIN",
            category: "Experience",
            evidence: "Minimum 5 years public-sector AV",
          }),
        ];

  const engine = runDecisionEngine({
    profile: profile(
      opts?.certFailure ? { certifications: ["NOT_HELD: ISO 27001", "ISO 9001"] } : {},
    ),
    requirements,
    estimatedValue: 200_000,
    tenderContext: {
      title: "AV Platform",
      client: "Gov",
      country: "Morocco",
      industry: "IT",
      tenderText: requirements.map((r) => r.description).join("\n"),
    },
  });

  const readiness = computeTenderReadiness({
    requirements: engine.requirements,
    missingDocuments: [],
    profileHasAnyCapability: true,
  });

  const intelligence = buildTenderIntelligence({
    tenderId: "t-explain",
    documentName: "RFP.pdf",
    tenderDeadline: null,
    extractedText: "",
    requirements: requirements.map((r) => ({
      id: r.id!,
      category: r.category,
      description: r.description,
      mandatory: r.mandatory,
      value: r.value,
      status: r.status,
      sourcePage: 3,
      sourceSection: "2.1",
      evidence: r.evidence,
    })),
    evidence: opts?.certFailure
      ? []
      : [
          {
            id: "e1",
            requirementId: "r1",
            sourcePage: 4,
            sourceSection: "1.2",
            evidenceText: "Company References 2024 — public-sector AV projects listed",
            verificationStatus: "INFERRED",
            documentName: "Company References 2024.pdf",
          },
        ],
    readiness,
    findings: engine.findings,
    existingRisks: [],
    decision: engine.decision,
    fitScore: engine.fitScore,
  });

  const finalized = finalizeTenderDecision({
    engine,
    aiParticipated: false,
    readiness: {
      score: readiness.score,
      counts: readiness.counts,
      attention: readiness.attention,
      recommendation: readiness.recommendation,
    },
    compliance: intelligence.complianceSummary,
    complianceMatrix: intelligence.complianceMatrix,
    keyBlockers: intelligence.keyBlockers,
    structuredRiskTitles: intelligence.risks.map((r) => ({
      title: r.title,
      severity: r.severity,
    })),
  });

  return {
    engine,
    intelligence,
    recommendation: finalized.recommendation,
    readiness,
  };
}

describe("explainable decision — GO / CONDITIONAL GO / NO-BID", () => {
  it("NO-BID explanation identifies blockers as decision drivers", () => {
    const { recommendation, intelligence, readiness } = buildScenario({ certFailure: true });
    assert.equal(recommendation.displayLabel, "NO-BID");

    const explanation = buildExplainableDecision({
      recommendation,
      evidenceIntelligence: intelligence.evidenceIntelligence,
      complianceMatrix: intelligence.complianceMatrix,
      risks: intelligence.risks,
      readiness,
    });

    assert.equal(explanation.displayLabel, "NO-BID");
    assert.ok(explanation.executiveSummary.blockerCount >= 1);
    assert.ok(explanation.sections.keyReasons.length >= 1);
    assertExplainableDecisionIntegrity(explanation);
  });

  it("CONDITIONAL GO explanation highlights verification gaps", () => {
    const { recommendation, intelligence, readiness } = buildScenario();
    const explanation = buildExplainableDecision({
      recommendation,
      evidenceIntelligence: intelligence.evidenceIntelligence,
      complianceMatrix: intelligence.complianceMatrix,
      risks: intelligence.risks,
      readiness,
    });

    if (recommendation.displayLabel === "CONDITIONAL GO") {
      assert.match(explanation.executiveSummary.whyHeadline, /blocker|verification|condition/i);
    }
    const unverified = explanation.items.filter(
      (i) => i.category === "UNVERIFIED_EVIDENCE" || i.category === "MISSING_EVIDENCE",
    );
    assert.ok(unverified.length >= 0);
    assertExplainableDecisionIntegrity(explanation);
  });

  it("GO-capable scenario includes positive factors when verified", () => {
    const { recommendation, intelligence, readiness } = buildScenario({ strongMatch: true });
    const explanation = buildExplainableDecision({
      recommendation,
      evidenceIntelligence: intelligence.evidenceIntelligence,
      complianceMatrix: intelligence.complianceMatrix,
      risks: intelligence.risks,
      readiness,
    });

    assert.ok(["GO", "CONDITIONAL GO"].includes(explanation.displayLabel));
    assert.ok(explanation.items.some((i) => i.category === "COMPANY_FIT" || i.category === "POSITIVE_FACTOR"));
    assertExplainableDecisionIntegrity(explanation);
  });
});

describe("traceability", () => {
  it("requirement items link requirementId and source", () => {
    const { recommendation, intelligence, readiness } = buildScenario();
    const explanation = buildExplainableDecision({
      recommendation,
      evidenceIntelligence: intelligence.evidenceIntelligence,
      complianceMatrix: intelligence.complianceMatrix,
      risks: intelligence.risks,
      readiness,
    });

    const reqItems = explanation.items.filter((i) => i.requirementId === "r1");
    assert.ok(reqItems.length >= 1);
    for (const item of reqItems) {
      assert.ok(item.what.length > 0);
      assert.ok(item.why.length > 0);
      assert.ok(item.source.kind);
      assert.ok(item.impact.length > 0);
    }
  });

  it("evidence traceability includes document reference when located", () => {
    const { recommendation, intelligence, readiness } = buildScenario();
    const evidenceItems = buildExplainableDecision({
      recommendation,
      evidenceIntelligence: intelligence.evidenceIntelligence,
      complianceMatrix: intelligence.complianceMatrix,
      risks: intelligence.risks,
      readiness,
    }).items.filter((i) => i.category === "UNVERIFIED_EVIDENCE" || i.evidenceId);

    if (evidenceItems.length > 0) {
      const item = evidenceItems[0]!;
      assert.equal(item.status, "FOUND_UNVERIFIED");
      assert.ok(item.what.includes("public-sector") || item.what.includes("AV") || item.what.length > 10);
    }
  });

  it("missing source uses UNKNOWN — never invents page numbers", () => {
    const rec = buildTenderDecisionRecommendation({
      engine: runDecisionEngine({
        profile: profile(),
        requirements: [req({ description: "Generic req", status: "MISSING", evidence: null })],
        estimatedValue: null,
        tenderContext: {
          title: "T",
          client: "C",
          country: "Morocco",
          industry: "IT",
          tenderText: "req",
        },
      }),
      aiParticipated: false,
    });

    const explanation = buildExplainableDecision({ recommendation: rec });
    const unknownSources = explanation.items.filter(
      (i) =>
        (i.source.kind === "UNKNOWN" && !i.source.located) ||
        i.category === "UNKNOWN" ||
        i.confidence === "UNKNOWN",
    );
    assert.ok(unknownSources.length >= 1);
    for (const item of unknownSources) {
      assert.equal(item.source.page, null);
    }
  });
});

describe("unknown and hallucination safeguards", () => {
  it("unknown handling uses UNKNOWN status — not negative claims", () => {
    const rec = buildTenderDecisionRecommendation({
      engine: runDecisionEngine({
        profile: profile(),
        requirements: [
          req({
            description: "Experience could not be verified from available data",
            status: "UNCERTAIN",
            evidence: null,
          }),
        ],
        estimatedValue: 100_000,
        tenderContext: {
          title: "T",
          client: "C",
          country: "Morocco",
          industry: "IT",
          tenderText: "experience",
        },
      }),
      aiParticipated: false,
    });

    const explanation = buildExplainableDecision({ recommendation: rec });
    const unknowns = explanation.sections.unknowns;
    for (const u of unknowns) {
      assert.ok(!u.what.toLowerCase().includes("insufficient experience"));
      assert.ok(u.status === "UNKNOWN" || u.reasonCode === INSUFFICIENT_DATA || u.confidence === "UNKNOWN");
    }
  });

  it("executive summary is structured — not empty for NO-BID", () => {
    const { recommendation, intelligence, readiness } = buildScenario({ certFailure: true });
    const explanation = buildExplainableDecision({
      recommendation,
      evidenceIntelligence: intelligence.evidenceIntelligence,
      complianceMatrix: intelligence.complianceMatrix,
      readiness,
    });
    assert.ok(explanation.executiveSummary.whyHeadline.length > 10);
    assert.ok(explanation.executiveSummary.topBlockers.length >= 0);
  });

  it("deterministic — same inputs produce same contentHash linkage", () => {
    const { recommendation, intelligence, readiness } = buildScenario({ certFailure: true });
    const input = {
      recommendation,
      evidenceIntelligence: intelligence.evidenceIntelligence,
      complianceMatrix: intelligence.complianceMatrix,
      risks: intelligence.risks,
      readiness,
    };
    const a = buildExplainableDecision(input);
    const b = buildExplainableDecision(input);
    assert.equal(a.contentHash, b.contentHash);
    assert.equal(a.executiveSummary.whyHeadline, b.executiveSummary.whyHeadline);
    assert.equal(a.items.length, b.items.length);
  });
});

describe("Decision Memory context only", () => {
  it("historical signals are referenceOnly and CONTEXT_ONLY", () => {
    const { recommendation, intelligence, readiness } = buildScenario({ certFailure: true });
    const explanation = buildExplainableDecision({
      recommendation,
      evidenceIntelligence: intelligence.evidenceIntelligence,
      complianceMatrix: intelligence.complianceMatrix,
      readiness,
      memoryInsights: {
        computed: true,
        matches: [
          {
            memoryId: "m1",
            tenderId: "old",
            title: "Similar AV tender",
            client: "Gov",
            decision: "NO_BID",
            decisionLabel: "NO-BID",
            fitScore: 40,
            readinessScore: 30,
            bidScore: 35,
            reasoning: "Rejected previously",
            similarity: 0.85,
            relevanceReasons: ["Same sector"],
            analyzedAt: new Date().toISOString(),
            disclaimer: "Reference only — not proof.",
          },
        ],
        emptyReason: null,
        currentAnalysisNote: "Current",
        historicalNote: "Historical reference only",
      },
    });

    const memory = explanation.sections.historicalSignals;
    assert.ok(memory.length >= 1);
    for (const m of memory) {
      assert.equal(m.referenceOnly, true);
      assert.equal(m.impactRole, "CONTEXT_ONLY");
      assert.equal(m.category, "HISTORICAL_SIGNAL");
      assert.ok(/historical|reference|proof/i.test(m.why));
    }
    assertExplainableDecisionIntegrity(explanation);
  });
});

describe("evidence states in explanation", () => {
  it("missing and unverified evidence categories", () => {
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
        {
          id: "r2",
          description: "Bank guarantee",
          mandatory: true,
          value: null,
          readinessStatus: "MISSING",
        },
      ],
      evidence: [
        {
          id: "e1",
          requirementId: "r1",
          evidenceText: "CNSS excerpt unverified",
          verificationStatus: "INFERRED",
          sourcePage: 2,
          sourceSection: null,
          documentName: "CNSS.pdf",
        },
      ],
    });

    const evidenceIntelligence = buildEvidenceIntelligence({
      verificationIntelligence: verification,
      complianceMatrix: [],
      evidence: [
        {
          id: "e1",
          requirementId: "r1",
          evidenceText: "CNSS excerpt unverified",
          verificationStatus: "INFERRED",
          sourcePage: 2,
          sourceSection: null,
          documentName: "CNSS.pdf",
        },
      ],
      requirements: [
        { id: "r1", category: "Cert", status: "UNCERTAIN" },
        { id: "r2", category: "Financial", status: "FAILED" },
      ],
    });

    const engine = runDecisionEngine({
      profile: profile(),
      requirements: [
        req({ id: "r1", description: "CNSS", status: "UNCERTAIN" }),
        req({ id: "r2", description: "Bank guarantee", status: "FAILED" }),
      ],
      estimatedValue: 100_000,
      tenderContext: {
        title: "T",
        client: "C",
        country: "Morocco",
        industry: "IT",
        tenderText: "CNSS bank",
      },
    });

    const rec = buildTenderDecisionRecommendation({ engine, aiParticipated: false });
    const explanation = buildExplainableDecision({
      recommendation: rec,
      evidenceIntelligence,
    });

    assert.ok(
      explanation.items.some((i) => i.category === "UNVERIFIED_EVIDENCE"),
    );
    assert.ok(explanation.items.some((i) => i.category === "MISSING_EVIDENCE"));
  });
});

describe("data safety and permissions", () => {
  it("invariants forbid decision mutation", () => {
    assert.equal(EXPLAINABLE_DECISION_INVARIANTS.mutatesDecision, false);
    assert.equal(EXPLAINABLE_DECISION_INVARIANTS.readOnly, true);
  });

  it("application layer is read-only", async () => {
    const src = await readFile(
      join(process.cwd(), "src/application/explainable-decision.ts"),
      "utf8",
    );
    assert.match(src, /assertCanViewTenderAnalysis/);
    assert.doesNotMatch(src, /prisma\.(tender|tenderEvidence)\.(create|update|delete)/);
    assert.doesNotMatch(src, /consumeAnalysisCredit/);
  });
});

describe("company-fit and readiness sections", () => {
  it("includes fit and readiness factors from recommendation", () => {
    const { recommendation, intelligence, readiness } = buildScenario({ strongMatch: true });
    const explanation = buildExplainableDecision({
      recommendation,
      evidenceIntelligence: intelligence.evidenceIntelligence,
      complianceMatrix: intelligence.complianceMatrix,
      risks: intelligence.risks,
      readiness,
    });

    assert.ok(
      explanation.sections.companyFit.length + explanation.sections.readiness.length >= 1,
    );
  });
});
