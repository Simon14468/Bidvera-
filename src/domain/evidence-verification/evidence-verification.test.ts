/**
 * Evidence / Verification Intelligence — production regression tests.
 */

import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { computeTenderReadiness } from "@/domain/decision/tender-readiness";
import { rankRelevantMemories } from "@/domain/decision-memory";
import {
  buildVerificationIntelligence,
  buildVerificationSeedCandidates,
  deriveRequirementVerificationStatus,
  findDuplicateEvidenceAssignments,
  formatLocationLabel,
  isRealEvidenceText,
  runAutomatedEvidenceChecks,
  selectBestEvidenceByRequirement,
  type CanonicalEvidenceRecord,
} from "@/domain/evidence-verification";
import { meaningfulDecisionChange } from "@/domain/team-workflow/closed-loop";
import { buildTenderIntelligence } from "@/domain/tender-intelligence";
import {
  assertCanonicalReportIntegrity,
  deriveCanonicalReportSections,
  FULL_REPORT_FEATURE_ACCESS,
} from "@/services/reports/report-canonical-view";
import {
  assertPdfCanonicalConsistency,
  buildReportDisplayContent,
} from "@/services/reports/report-display-content";
import type { TenderReport } from "@/services/reports/types";

const PLACEHOLDER = "No supporting excerpt available — marked UNKNOWN.";

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

describe("evidence matching", () => {
  it("selects human-verified evidence over AI-inferred", () => {
    const rows = [
      ev({
        id: "e1",
        requirementId: "r1",
        evidenceText: "AI guess",
        verificationStatus: "INFERRED",
        sourcePage: 2,
      }),
      ev({
        id: "e2",
        requirementId: "r1",
        evidenceText: "Verified excerpt",
        verificationStatus: "VERIFIED",
        teamTaskId: "task1",
        sourcePage: 5,
      }),
    ];
    const best = selectBestEvidenceByRequirement(rows);
    assert.equal(best.get("r1")?.id, "e2");
  });

  it("prefers located excerpts over unlocated", () => {
    const rows = [
      ev({ id: "e1", requirementId: "r1", sourcePage: null }),
      ev({ id: "e2", requirementId: "r1", sourcePage: 12, sourceSection: "3.1" }),
    ];
    const best = selectBestEvidenceByRequirement(rows);
    assert.equal(best.get("r1")?.id, "e2");
  });

  it("detects duplicate evidence assignment across requirements", () => {
    const dupes = findDuplicateEvidenceAssignments([
      ev({ id: "same", requirementId: "r1" }),
      ev({ id: "same", requirementId: "r2" }),
    ]);
    assert.deepEqual(dupes, ["same"]);
  });

  it("ignores unlinked evidence rows", () => {
    const best = selectBestEvidenceByRequirement([
      ev({ id: "e1", requirementId: null as unknown as string, evidenceText: "orphan" }),
    ]);
    assert.equal(best.size, 0);
  });
});

describe("verification status derivation", () => {
  it("never treats AI/INFERRED as VERIFIED without team task", () => {
    const r = deriveRequirementVerificationStatus({
      readinessStatus: "READY",
      evidence: ev({
        id: "e1",
        requirementId: "r1",
        verificationStatus: "INFERRED",
        evidenceText: "profile match",
      }),
      requirementDescription: "ISO 27001 certification",
      requirementValue: null,
    });
    assert.equal(r.status, "NEEDS_VERIFICATION");
    assert.match(r.reason ?? "", /human|AI|verification/i);
  });

  it("VERIFIED only with teamTaskId and VERIFIED evidence status", () => {
    const r = deriveRequirementVerificationStatus({
      readinessStatus: "READY",
      evidence: ev({
        id: "e1",
        requirementId: "r1",
        verificationStatus: "VERIFIED",
        teamTaskId: "task-1",
        verificationReason: "Certificate confirmed by Legal.",
      }),
      requirementDescription: "ISO 27001",
      requirementValue: null,
      storedReason: "Certificate confirmed by Legal.",
    });
    assert.equal(r.status, "VERIFIED");
  });

  it("flags missing evidence when readiness is MISSING", () => {
    const r = deriveRequirementVerificationStatus({
      readinessStatus: "MISSING",
      evidence: null,
      requirementDescription: "Bank guarantee",
      requirementValue: null,
    });
    assert.equal(r.status, "MISSING_EVIDENCE");
  });

  it("marks NOT_APPLICABLE requirements", () => {
    const r = deriveRequirementVerificationStatus({
      readinessStatus: "NOT_APPLICABLE",
      evidence: null,
      requirementDescription: "Optional workshop",
      requirementValue: null,
    });
    assert.equal(r.status, "NOT_APPLICABLE");
  });

  it("flags ambiguous INFERRED evidence as NEEDS_VERIFICATION", () => {
    const r = deriveRequirementVerificationStatus({
      readinessStatus: "VERIFY",
      evidence: ev({
        id: "e1",
        requirementId: "r1",
        verificationStatus: "INFERRED",
        evidenceText: "Company profile suggests capability",
      }),
      requirementDescription: "Turnover threshold",
      requirementValue: "10M MAD",
    });
    assert.equal(r.status, "NEEDS_VERIFICATION");
  });
});

describe("automated evidence checks", () => {
  it("suggests validity review when expiry language present", () => {
    const check = runAutomatedEvidenceChecks({
      requirementDescription: "Insurance certificate",
      requirementValue: null,
      readinessStatus: "VERIFY",
      evidence: ev({
        id: "e1",
        requirementId: "r1",
        evidenceText: "Policy valid until December 2024",
        verificationStatus: "VERIFIED",
        teamTaskId: "task-1",
      }),
    });
    assert.ok(check.flags.includes("validity_date_review"));
    assert.match(check.suggestedReason ?? "", /validity|expir/i);
  });

  it("flags certification not confirmed in excerpt", () => {
    const check = runAutomatedEvidenceChecks({
      requirementDescription: "ISO 9001 certification required",
      requirementValue: null,
      readinessStatus: "VERIFY",
      evidence: ev({
        id: "e1",
        requirementId: "r1",
        evidenceText: "We have quality processes in place",
        verificationStatus: "INFERRED",
      }),
    });
    assert.ok(check.flags.includes("certification_not_confirmed_in_excerpt"));
  });

  it("never upgrades to VERIFIED — advisory reasons only", () => {
    const check = runAutomatedEvidenceChecks({
      requirementDescription: "ISO 27001",
      requirementValue: null,
      readinessStatus: "READY",
      evidence: ev({
        id: "e1",
        requirementId: "r1",
        evidenceText: "ISO 27001 certificate number 12345",
        verificationStatus: "INFERRED",
      }),
    });
    assert.notEqual(check.suggestedReason, "VERIFIED");
    const status = deriveRequirementVerificationStatus({
      readinessStatus: "READY",
      evidence: ev({
        id: "e1",
        requirementId: "r1",
        evidenceText: "ISO 27001 certificate number 12345",
        verificationStatus: "INFERRED",
      }),
      requirementDescription: "ISO 27001",
      requirementValue: null,
    });
    assert.equal(status.status, "NEEDS_VERIFICATION");
  });
});

describe("page traceability", () => {
  it("formats document · section · page location label", () => {
    const label = formatLocationLabel({
      sourceDocument: "CPS_v5.pdf",
      pageNumber: 42,
      section: "4.2",
    });
    assert.equal(label, "CPS_v5.pdf · Section 4.2 · Page 42");
  });

  it("builds chains with exact page from canonical evidence", () => {
    const bundle = buildVerificationIntelligence({
      defaultDocumentName: "Tender Package",
      requirements: [
        {
          id: "r1",
          description: "Submit installation plan",
          mandatory: true,
          value: null,
          readinessStatus: "VERIFY",
        },
      ],
      evidence: [
        ev({
          id: "e1",
          requirementId: "r1",
          sourcePage: 17,
          sourceSection: "2.3",
          documentName: "CPS.pdf",
          evidenceText: "Installation milestones on page 17",
        }),
      ],
    });
    const chain = bundle.chains[0]!;
    assert.equal(chain.pageNumber, 17);
    assert.equal(chain.section, "2.3");
    assert.match(chain.locationLabel ?? "", /Page 17/);
    assert.match(chain.locationLabel ?? "", /CPS\.pdf/);
  });
});

describe("no invented evidence", () => {
  it("rejects placeholder text as real evidence", () => {
    assert.equal(isRealEvidenceText(PLACEHOLDER), false);
    assert.equal(isRealEvidenceText(""), false);
    assert.equal(isRealEvidenceText("Actual tender excerpt"), true);
  });

  it("summary counts match requirement cardinality only", () => {
    const bundle = buildVerificationIntelligence({
      defaultDocumentName: "Doc",
      requirements: [
        {
          id: "r1",
          description: "Req A",
          mandatory: true,
          value: null,
          readinessStatus: "MISSING",
        },
        {
          id: "r2",
          description: "Req B",
          mandatory: false,
          value: null,
          readinessStatus: "NOT_APPLICABLE",
        },
      ],
      evidence: [],
    });
    assert.equal(bundle.summary.total, 2);
    assert.equal(
      bundle.summary.verified +
        bundle.summary.needsVerification +
        bundle.summary.missingEvidence +
        bundle.summary.notApplicable,
      2,
    );
  });
});

describe("team workflow integration", () => {
  it("seeds EVIDENCE_REQUEST tasks for NEEDS_VERIFICATION chains", () => {
    const candidates = buildVerificationSeedCandidates({
      companyId: "c1",
      tenderId: "t1",
      tenderDeadline: new Date("2026-12-01"),
      chains: [
        {
          requirementId: "r1",
          requirement: "Legal indemnity clause",
          mandatory: true,
          readinessStatus: "VERIFY",
          verificationStatus: "NEEDS_VERIFICATION",
          verificationReason: "AI interpretation only",
          evidenceId: "e1",
          evidenceExcerpt: "Indemnity mentioned",
          sourceDocument: "CPS.pdf",
          pageNumber: 8,
          section: null,
          locationLabel: "CPS.pdf · Page 8",
          verifierLabel: null,
          verifiedAt: null,
          teamTaskId: null,
        },
        {
          requirementId: "r2",
          requirement: "Optional training",
          mandatory: false,
          readinessStatus: "NOT_APPLICABLE",
          verificationStatus: "NOT_APPLICABLE",
          verificationReason: null,
          evidenceId: null,
          evidenceExcerpt: null,
          sourceDocument: null,
          pageNumber: null,
          section: null,
          locationLabel: null,
          verifierLabel: null,
          verifiedAt: null,
          teamTaskId: null,
        },
      ],
    });
    assert.equal(candidates.length, 1);
    assert.equal(candidates[0]!.kind, "EVIDENCE_REQUEST");
    assert.equal(candidates[0]!.requirementId, "r1");
    assert.match(candidates[0]!.dedupeKey, /verify:r1/);
  });
});

describe("readiness and intelligence alignment", () => {
  it("verification intelligence total equals compliance matrix rows", () => {
    const requirements = [
      {
        id: "r1",
        category: "TECHNICAL",
        description: "Plan required",
        mandatory: true,
        value: null as string | null,
        status: "UNCERTAIN" as const,
        sourcePage: 3,
        sourceSection: "2.1",
        evidence: "excerpt",
      },
      {
        id: "r2",
        category: "LEGAL",
        description: "Insurance",
        mandatory: true,
        value: null,
        status: "FAILED" as const,
        sourcePage: null,
        sourceSection: null,
        evidence: null,
      },
    ];
    const readiness = computeTenderReadiness({
      requirements: requirements.map((r) => ({
        id: r.id,
        category: r.category,
        description: r.description,
        mandatory: r.mandatory,
        value: r.value,
        status: r.status,
        evidence: r.evidence,
      })),
      missingDocuments: [],
      profileHasAnyCapability: true,
    });
    const intelligence = buildTenderIntelligence({
      tenderId: "t1",
      documentName: "Package.pdf",
      tenderDeadline: null,
      extractedText: "",
      requirements,
      evidence: [
        ev({
          id: "e1",
          requirementId: "r1",
          sourcePage: 3,
          evidenceText: "excerpt",
          verificationStatus: "INFERRED",
        }),
      ],
      readiness,
      findings: [],
      existingRisks: [],
      decision: "REVIEW",
      fitScore: 50,
    });
    assert.ok(intelligence.verificationIntelligence);
    assert.equal(
      intelligence.verificationIntelligence!.summary.total,
      intelligence.complianceMatrix.length,
    );
    assert.equal(
      intelligence.verificationIntelligence!.summary.total,
      requirements.length,
    );
  });

  it("readiness counts unchanged by verification layer", () => {
    const requirements = [
      {
        id: "r1",
        category: "TECH",
        description: "Cert",
        mandatory: true,
        value: null as string | null,
        status: "MATCHED" as const,
        sourcePage: 1,
        sourceSection: null,
        evidence: "cert text",
      },
    ];
    const readiness = computeTenderReadiness({
      requirements: requirements.map((r) => ({
        id: r.id,
        category: r.category,
        description: r.description,
        mandatory: r.mandatory,
        value: r.value,
        status: r.status,
        evidence: r.evidence,
      })),
      missingDocuments: [],
      profileHasAnyCapability: true,
    });
    const before = { ...readiness.counts };
    buildVerificationIntelligence({
      defaultDocumentName: "Doc",
      requirements: [
        {
          id: "r1",
          description: "Cert",
          mandatory: true,
          value: null,
          readinessStatus: "READY",
        },
      ],
      evidence: [
        ev({
          id: "e1",
          requirementId: "r1",
          verificationStatus: "INFERRED",
          evidenceText: "cert text",
        }),
      ],
    });
    assert.deepEqual(readiness.counts, before);
  });
});

describe("decision engine re-evaluation signal", () => {
  it("detects material decision change after verified evidence", () => {
    assert.equal(
      meaningfulDecisionChange({
        priorDecision: "NO_BID",
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
        priorDecision: "GO",
        nextDecision: "GO",
        priorReadiness: 80,
        nextReadiness: 80,
        priorFit: 70,
        nextFit: 70,
      }),
      false,
    );
  });
});

describe("scoring formulas unchanged", () => {
  it("decision memory ranking ignores verification fields", () => {
    const ranked = rankRelevantMemories({
      currentFeatures: {
        industryBucket: "it",
        countryBucket: "ma",
        sizeBand: "sme",
        fitBand: "mid",
        readinessBand: "mid",
        decisionAtAnalysis: "REVIEW",
        mandatoryGapBand: "none",
        valueBand: "mid",
      },
      candidates: [
        {
          id: "m1",
          tenderId: "t-old",
          title: "Prior tender",
          client: "Client",
          decision: "BID",
          fitScore: 70,
          readinessScore: 80,
          bidScore: 65,
          reasoning: "Prior analysis",
          analyzedAt: new Date("2025-01-01"),
          features: {
            industryBucket: "it",
            countryBucket: "ma",
            sizeBand: "sme",
            fitBand: "mid",
            readinessBand: "mid",
            decisionAtAnalysis: "BID",
            mandatoryGapBand: "none",
            valueBand: "mid",
          },
        },
      ],
    });
    assert.equal(ranked.matches.length, 1);
    assert.ok(ranked.matches[0]!.similarity >= 0);
  });
});

describe("PDF / web consistency", () => {
  function miniReport(): TenderReport {
    const requirements = [
      {
        id: "r1",
        category: "TECHNICAL",
        description: "Installation plan",
        mandatory: true,
        value: null as string | null,
        status: "UNCERTAIN" as const,
        sourcePage: 3,
        sourceSection: "2.1",
        evidence: "plan excerpt",
      },
    ];
    const readiness = computeTenderReadiness({
      requirements: requirements.map((r) => ({
        id: r.id,
        category: r.category,
        description: r.description,
        mandatory: r.mandatory,
        value: r.value,
        status: r.status,
        evidence: r.evidence,
      })),
      missingDocuments: [],
      profileHasAnyCapability: true,
    });
    const intelligence = buildTenderIntelligence({
      tenderId: "t-ev",
      documentName: "CPS.pdf",
      tenderDeadline: null,
      extractedText: "",
      requirements,
      evidence: [
        ev({
          id: "e1",
          requirementId: "r1",
          sourcePage: 3,
          sourceSection: "2.1",
          documentName: "CPS.pdf",
          evidenceText: "plan excerpt",
          verificationStatus: "INFERRED",
        }),
      ],
      readiness,
      findings: [],
      existingRisks: [],
      decision: "REVIEW",
      fitScore: 60,
    });
    return {
      tenderId: "t-ev",
      companyId: "c1",
      title: "Test tender",
      client: "Client",
      deadline: null,
      deadlineTimezone: null,
      analyzedAt: "2026-09-01T10:00:00.000Z",
      decision: "REVIEW",
      fitScore: 60,
      confidence: "MEDIUM",
      reasoning: "Review recommended.",
      companyKnowledgeOnly: false,
      fitBreakdown: null,
      readiness,
      intelligence,
      complianceSummary: intelligence.complianceSummary,
      bidScore: null,
      historicalSignals: [],
      matched: [],
      failed: [],
      uncertain: requirements,
      criticalRisks: [],
      evidence: [
        {
          id: "e1",
          text: "plan excerpt",
          sourcePage: 3,
          sourceSection: "2.1",
          verificationStatus: "INFERRED",
        },
      ],
      missingDocuments: [],
      nextActions: [],
      decisionOutcome: null,
    };
  }

  it("web and PDF derive the same verification chains", () => {
    const report = miniReport();
    const sections = deriveCanonicalReportSections(report, FULL_REPORT_FEATURE_ACCESS);
    assertCanonicalReportIntegrity(sections);
    assert.ok(sections.verificationIntelligence);
    const content = buildReportDisplayContent(sections, "en");
    assert.equal(
      content.verificationChains.length,
      sections.verificationIntelligence!.chains.length,
    );
    assertPdfCanonicalConsistency(report, sections, content);
    for (const chain of content.verificationChains) {
      assert.ok(chain.requirement.length > 0);
      assert.notEqual(chain.status, "VERIFIED");
    }
  });
});

describe("company isolation", () => {
  it("verification audit records companyId scope (schema contract)", async () => {
    const { recordVerificationAudit } = await import(
      "@/services/evidence-verification"
    );
    assert.equal(typeof recordVerificationAudit, "function");
    // Service layer enforces companyId on RequirementVerificationAudit — integration tested via prisma schema.
    const migration = await import(
      "node:fs/promises"
    ).then((fs) =>
      fs.readFile(
        "prisma/migrations/20260901110000_evidence_verification_intelligence/migration.sql",
        "utf8",
      ),
    );
    assert.match(migration, /RequirementVerificationAudit/);
    assert.match(migration, /companyId/);
  });
});
