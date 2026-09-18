import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import {
  buildCompanyKnowledgeOnlyAnalysis,
  isCompanyKnowledgeOnlyAnalysis,
  COMPANY_ONLY_MESSAGE,
  extractCompanyKnowledgeHeuristic,
} from "./index";
import { runDecisionEngine } from "@/domain/decision/engine";
import { buildTenderIntelligence } from "@/domain/tender-intelligence";
import { computeTenderReadiness } from "@/domain/decision/tender-readiness";
import { buildBidScoreFromAnalysis } from "@/domain/bid-score";
import type { RuleCompanyProfile, RuleRequirement } from "@/domain/decision/types";
import type { CompanyKnowledge, FactProvenance } from "./types";

const sampleProfileText = `
Atlas Digital Solutions SARL — Company Profile
Main Services
Web development, Mobile apps, Cloud solutions, API integration
Company Experience — Project References
Certifications & Compliance
ISO 9001 available. ISO 27001 not held.
Known Limitations
No 24/7 support center.
Team & Capacity
24 total employees; typical project duration 3–14 months
Company Overview
Morocco nationwide delivery from Agadir.
`;

async function loadAtlasText(): Promise<string | null> {
  try {
    const path =
      ".data/uploads/cmtfvf1vm0000rkgkqq291zux/cmtfy2tdc0032rkokbucq0ecq/1788102529143-Atlas_Digital_Solutions_Bidvera_Test_Profile.pdf";
    const buf = readFileSync(path);
    const { PDFParse } = await import("pdf-parse");
    const parser = new PDFParse({ data: buf });
    const result = await parser.getText();
    const text =
      typeof result === "string"
        ? result
        : ((result as { text?: string }).text ?? "");
    return text;
  } catch {
    return null;
  }
}

function stubProvenance(sourceDocument: string): FactProvenance {
  return {
    sourceDocument,
    page: "UNKNOWN",
    section: "Historical Tender Outcomes",
    originalValue: "Municipal Services Portal — WON",
    normalizedValue: null,
    confidence: "INFERRED",
    excerpt: null,
  };
}

function withHistoricalOutcome(knowledge: CompanyKnowledge): CompanyKnowledge {
  return {
    ...knowledge,
    historicalOutcomes: [
      {
        opportunity: "Municipal Services Portal",
        sector: "public administration",
        opportunityType: null,
        approximateValue: null,
        capabilities: ["Web Application Development"],
        requirements: "Web portal delivery",
        outcome: "WON",
        reason: "Strong public-sector references",
        provenance: stubProvenance(knowledge.sourceDocuments[0] ?? "profile.pdf"),
        lifecycle: "CANDIDATE",
      },
    ],
  };
}

describe("company knowledge only analysis", () => {
  it("builds zero tender scores and no decision recommendation", () => {
    const knowledge = extractCompanyKnowledgeHeuristic({
      text: sampleProfileText,
      fileName: "Atlas_Digital_Solutions_Bidvera_Test_Profile.pdf",
    });
    const payload = buildCompanyKnowledgeOnlyAnalysis({
      knowledge,
      fileName: "Atlas_Digital_Solutions_Bidvera_Test_Profile.pdf",
    });

    assert.equal(payload.decision, null);
    assert.equal(payload.companyKnowledgeOnly, true);
    assert.equal(payload.fitBreakdown.scoringAvailable, false);
    assert.equal(payload.fitBreakdown.overall, null);
    assert.equal(payload.fitBreakdown.dimensions.length, 0);
    assert.equal(payload.readiness.score, null);
    assert.equal(payload.readiness.scoringAvailable, false);
    assert.equal(payload.bidScore.scoringAvailable, false);
    assert.equal(payload.bidScore.priorityLabel, "UNAVAILABLE");
    assert.equal(payload.bidScore.expectedValue, "UNKNOWN");
    assert.equal(payload.intelligence.analysisMode, "COMPANY_KNOWLEDGE_ONLY");
    assert.equal(payload.intelligence.complianceStatus, "INCOMPLETE");
    assert.equal(payload.intelligence.complianceMatrix.length, 0);
    assert.match(payload.reasoning, /Company information successfully extracted/i);
    assert.match(payload.reasoning, /Upload a Tender\/RFP/i);
    assert.equal(isCompanyKnowledgeOnlyAnalysis(payload.fitBreakdown, payload.intelligence), true);
  });

  it("stores extracted company knowledge fields without tender requirements", async (t) => {
    const atlasText = await loadAtlasText();
    if (!atlasText) {
      t.skip("Atlas profile PDF not available locally");
      return;
    }
    const knowledge = extractCompanyKnowledgeHeuristic({
      text: atlasText,
      fileName: "Atlas_Digital_Solutions_Bidvera_Test_Profile.pdf",
    });
    assert.equal(knowledge.documentKind, "COMPANY_PROFILE");
    assert.ok(knowledge.services.length >= 1);
    assert.ok(knowledge.projects.length >= 1);
    assert.ok(knowledge.certifications.length >= 1);
    assert.ok(knowledge.historicalOutcomes.length >= 1);
    assert.ok(knowledge.limitations.length >= 1);

    const payload = buildCompanyKnowledgeOnlyAnalysis({
      knowledge,
      fileName: "Atlas_Digital_Solutions_Bidvera_Test_Profile.pdf",
    });
    assert.match(payload.intelligence.decisionContext, /services/i);
    assert.match(payload.intelligence.decisionContext, /historical outcomes/i);
  });

  it("does not treat historical outcomes as current tender requirements", () => {
    const base = extractCompanyKnowledgeHeuristic({
      text: sampleProfileText,
      fileName: "Atlas_Digital_Solutions_Bidvera_Test_Profile.pdf",
    });
    const knowledge = withHistoricalOutcome(base);
    const payload = buildCompanyKnowledgeOnlyAnalysis({
      knowledge,
      fileName: "Atlas_Digital_Solutions_Bidvera_Test_Profile.pdf",
    });
    assert.ok(knowledge.historicalOutcomes.length >= 1);
    assert.equal(payload.intelligence.complianceMatrix.length, 0);
    assert.ok(
      !payload.intelligence.complianceMatrix.some((r) =>
        /Municipal portal/i.test(r.requirement),
      ),
    );
  });

  it("exports required company-only user message", () => {
    assert.match(COMPANY_ONLY_MESSAGE, /Company information successfully extracted/i);
    assert.match(COMPANY_ONLY_MESSAGE, /Tender requirements are not available/i);
    assert.match(COMPANY_ONLY_MESSAGE, /Upload a Tender\/RFP/i);
  });
});

describe("company + tender path unchanged", () => {
  const profile: RuleCompanyProfile = {
    companyName: "Test Co",
    industry: "Information Technology",
    country: "Morocco",
    companySize: "11-50",
    experienceLevel: "experienced",
    services: ["Web Application Development"],
    certifications: ["ISO 9001"],
    experienceYears: 8,
    revenueRange: null,
    employeeRange: "11-50",
    geographicCoverage: ["Morocco"],
    contractSizeMin: null,
    contractSizeMax: null,
    customQualificationRules: [],
  };

  const requirements: RuleRequirement[] = [
    {
      category: "MANDATORY_ELIGIBILITY",
      description: "Morocco-based delivery capability is required.",
      mandatory: true,
      value: null,
      status: "MATCHED",
      evidence: "Morocco",
    },
  ];

  it("still runs decision engine when tender requirements exist", () => {
    const decision = runDecisionEngine({
      profile,
      requirements,
      estimatedValue: 500_000,
      tenderContext: {
        title: "Portal tender",
        client: "Ministry",
        country: "Morocco",
        industry: "IT",
        tenderText: "Morocco web portal",
      },
    });
    assert.ok(decision.fitScore > 0);
    assert.ok(decision.fitBreakdown.overall != null);
    assert.notEqual(decision.fitBreakdown.companyKnowledgeOnly, true);

    const readiness = computeTenderReadiness({
      requirements,
      profileHasAnyCapability: true,
      fit: decision.fitBreakdown,
    });
    assert.ok(readiness.score != null);

    const intelligence = buildTenderIntelligence({
      tenderId: "t1",
      documentName: "CPS.pdf",
      tenderDeadline: null,
      extractedText: "Morocco web portal",
      requirements: requirements.map((r, i) => ({
        id: `r${i}`,
        category: r.category,
        description: r.description,
        mandatory: r.mandatory,
        value: r.value,
        status: r.status,
        sourcePage: null,
        sourceSection: null,
        evidence: r.evidence ?? null,
      })),
      evidence: [],
      readiness,
      findings: [],
      existingRisks: [],
      decision: decision.decision,
      fitScore: decision.fitScore,
    });
    assert.equal(intelligence.analysisMode, "TENDER");
    assert.ok(intelligence.complianceMatrix.length > 0);

    const bidScore = buildBidScoreFromAnalysis({
      fitScore: decision.fitScore,
      fitBreakdown: decision.fitBreakdown,
      readiness,
      intelligence,
      estimatedValue: 500_000,
      deadline: null,
      decision: decision.decision,
    });
    assert.notEqual(bidScore.scoringAvailable, false);
    assert.notEqual(bidScore.priorityLabel, "UNAVAILABLE");
  });
});
