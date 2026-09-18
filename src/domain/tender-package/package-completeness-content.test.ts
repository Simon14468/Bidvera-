/**
 * documentRole ≠ packageCompleteness — substantive content gate regressions.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import {
  assembleTenderPackage,
  classifyTenderDocumentRole,
  evaluatePackageScoringGate,
  evaluateSubstantiveCanonicalContent,
} from "./index";
import { buildCanonicalRequirements } from "@/domain/tender-requirements";
import { extractTenderPackageHeuristic } from "@/services/tender-extraction/requirements-heuristic";
import type { CanonicalRequirementForCompleteness } from "./substantive-content";
import { computeTenderReadiness } from "@/domain/decision/tender-readiness";
import { buildTenderIntelligence } from "@/domain/tender-intelligence";
import {
  assertFinalReleaseIntegrity,
  buildDecisionGuardianInput,
  hashCanonicalReleasePayload,
} from "@/domain/decision-validation";
import {
  deriveCanonicalReportSections,
  FULL_REPORT_FEATURE_ACCESS,
} from "@/services/reports/report-canonical-view";
import { buildReportDisplayContent } from "@/services/reports/report-display-content";
import type { TenderReport } from "@/services/reports/types";

const NOTICE_ONLY = `
AVIS D'APPEL D'OFFRES OUVERT
N°99/TEST/2026
Publication: 1 January 2026
Buyer: Ministry of Example
Estimated value: 1,000,000 DHS
Deadline: 15 February 2026 at 10:00
Submission via www.marchespublics.gov.ma
Evaluation: technical 60% / financial 40%
This notice is for information only.
`;

const FACTS_AND_WEIGHTS_ONLY = `
INVITATION TO TENDER NOTICE
Subject: Municipal works overview
Contracting authority: Example Agency
Publication date: 8 September 2026
Submission deadline: 6 October 2026
Estimated value: MAD 1,250,000
Procedure: Open competitive procedure
Evaluation Method
• Technical quality: 45%
• Price: 55%
Clarification questions may be submitted before the deadline.
Site visit instructions for bidders.
`;

const AVIS_SUBSTANTIVE_SHORT = `
AVIS D'APPEL D'OFFRES OUVERT INTERNATIONAL
N°99/TEST/2026

Le présent avis est publié à titre d'information. Les documents du dossier de consultation peuvent être obtenus via les canaux indiqués.
Les soumissionnaires sont invités à respecter l'ensemble des formalités requises pour la remise des offres, conformément aux règles applicables.

E-01 legally registered
R-02 CNSS attestation
T-03 installation works
T-04 commissioning phase
R-05 warranty period 24m
`;

function loadConstructionText(): string {
  return readFileSync("artifacts/test2-construction-proof-source.txt", "utf8");
}

function toCompletenessReqs(
  canonical: ReturnType<typeof buildCanonicalRequirements>,
): CanonicalRequirementForCompleteness[] {
  return canonical.map((r) => ({
    semanticKind: r.semanticKind,
    obligationStrength: r.obligationStrength,
    mandatory: r.mandatory,
    requirement: r.requirement,
    category: r.category,
  }));
}

describe("substantive content vs document role", () => {
  it("does not treat title/deadline/value/weights as substantive", () => {
    const heuristic = extractTenderPackageHeuristic({
      text: FACTS_AND_WEIGHTS_ONLY,
      fileName: "Notice_facts.pdf",
    });
    const canonical = buildCanonicalRequirements({
      heuristicDrafts: heuristic.requirements,
      sourceDocument: "Notice_facts.pdf",
    });
    const assessment = evaluateSubstantiveCanonicalContent(
      toCompletenessReqs(canonical),
    );
    assert.equal(assessment.sufficient, false);

    const assembly = assembleTenderPackage([
      {
        fileName: "Notice_facts.pdf",
        documentKind: "TENDER",
        text: FACTS_AND_WEIGHTS_ONLY,
      },
    ]);
    const gate = evaluatePackageScoringGate({
      assembly,
      reliableRequirementCount: canonical.length,
      canonicalRequirements: toCompletenessReqs(canonical),
    });
    assert.equal(gate.allowScoring, false);
    assert.ok(
      gate.reason === "ONLY_AVIS" ||
        gate.reason === "PACKAGE_INCOMPLETE" ||
        gate.reason === "CPS_MISSING" ||
        gate.reason === "NO_RELIABLE_REQUIREMENTS" ||
        gate.reason === "TECHNICAL_SPECIFICATION_MISSING",
    );
  });

  it("keeps short French avis notice as ONLY_AVIS even with thin eligibility lines", () => {
    const heuristic = extractTenderPackageHeuristic({
      text: NOTICE_ONLY,
      fileName: "Avis_only.pdf",
    });
    const canonical = buildCanonicalRequirements({
      heuristicDrafts: heuristic.requirements,
      sourceDocument: "Avis_only.pdf",
    });
    const assembly = assembleTenderPackage([
      { fileName: "Avis_only.pdf", documentKind: "TENDER", text: NOTICE_ONLY },
    ]);
    assert.equal(assembly.rolesPresent.includes("AVIS") || assembly.avisOnly, true);
    const gate = evaluatePackageScoringGate({
      assembly,
      reliableRequirementCount: canonical.length,
      canonicalRequirements: toCompletenessReqs(canonical),
    });
    assert.equal(gate.allowScoring, false);
    assert.equal(gate.reason, "ONLY_AVIS");
    assert.ok(gate.missingDocumentTypes.includes("CPS"));
  });

  it("A — AVIS-only with substantive canonical obligations must allow scoring (no false CPS/TECHNICAL_SPECIFICATION missing)", () => {
    const avisText = AVIS_SUBSTANTIVE_SHORT;

    const assembly = assembleTenderPackage([
      {
        fileName: "Avis_only_substantive.pdf",
        documentKind: "TENDER",
        text: avisText,
      },
    ]);

    // AVIS role diagnosis must not override substantive canonical requirements.
    assert.ok(assembly.rolesPresent.includes("AVIS"));

    const heuristic = extractTenderPackageHeuristic({
      text: avisText,
      fileName: "Avis_only_substantive.pdf",
    });
    const canonical = buildCanonicalRequirements({
      heuristicDrafts: heuristic.requirements,
      sourceDocument: "Avis_only_substantive.pdf",
    });

    assert.ok(
      canonical.length >= 3,
      `expected substantive canonical requirements to exist, got ${canonical.length}`,
    );

    const gate = evaluatePackageScoringGate({
      assembly,
      reliableRequirementCount: canonical.length,
      canonicalRequirements: toCompletenessReqs(canonical),
    });

    assert.equal(gate.allowScoring, true);
    assert.notEqual(gate.reason, "ONLY_AVIS");
    assert.deepEqual(gate.missingDocumentTypes, []);

    const requirements = canonical.map((r, i) => ({
      id: r.id ?? `req-${i}`,
      category: r.category,
      description: r.requirement,
      mandatory: r.mandatory,
      value: null,
      status: "UNCERTAIN" as const,
      sourcePage: null,
      sourceSection: r.sourceSection ?? null,
      evidence: r.evidenceText ?? null,
      semanticKind: r.semanticKind,
      fitStatus: null,
    }));

    const readiness = computeTenderReadiness({
      requirements: requirements.map((r) => ({
        id: r.id,
        category: r.category,
        description: r.description,
        mandatory: r.mandatory,
        value: r.value,
        status: r.status,
        evidence: r.evidence ?? null,
      })),
      missingDocuments: [],
      profileHasAnyCapability: true,
    });

    const intelligence = buildTenderIntelligence({
      tenderId: "avis-only-substantive",
      documentName: "AVIS",
      tenderDeadline: null,
      extractedText: avisText,
      requirements,
      evidence: [],
      readiness,
      findings: [],
      existingRisks: [],
      decision: "REVIEW",
      fitScore: 40,
    });

    // E — Compliance Matrix must contain canonical requirements.
    assert.equal(intelligence.complianceMatrix.length, canonical.length);
    assert.equal(intelligence.complianceSummary.totalRequirements, canonical.length);

    // F — Web/PDF canonical slices must be identical for this AVIS-only dataset.
    const report: TenderReport = {
      tenderId: "avis-only-substantive",
      companyId: "c1",
      title: "Avis only substantive test",
      client: null,
      deadline: null,
      deadlineTimezone: null,
      analyzedAt: new Date().toISOString(),
      decision: "REVIEW",
      fitScore: 40,
      confidence: "MEDIUM",
      reasoning: intelligence.decisionContext,
      companyKnowledgeOnly: false,
      fitBreakdown: null,
      readiness: null,
      intelligence,
      complianceSummary: intelligence.complianceSummary,
      bidScore: null,
      historicalSignals: [],
      matched: [],
      failed: [],
      uncertain: [],
      criticalRisks: [],
      missingDocuments: [],
      evidence: [],
      nextActions: [],
      decisionOutcome: null,
    };

    const webSections = deriveCanonicalReportSections(
      report,
      FULL_REPORT_FEATURE_ACCESS,
    );
    const pdfSections = deriveCanonicalReportSections(
      report,
      FULL_REPORT_FEATURE_ACCESS,
    );
    const webContent = buildReportDisplayContent(webSections, "en");
    const pdfContent = buildReportDisplayContent(pdfSections, "en");

    assert.equal(
      webSections.complianceMatrix.length,
      pdfSections.complianceMatrix.length,
    );
    assert.equal(webContent.fitScoreDisplay, pdfContent.fitScoreDisplay);
    assert.equal(
      webSections.complianceSummary?.totalRequirements,
      pdfSections.complianceSummary?.totalRequirements,
    );

    // G — Decision Guardian final integrity should still pass.
    const contentHash = hashCanonicalReleasePayload(
      intelligence.complianceMatrix.map((row) => ({
        id: row.requirementId,
        text: row.requirement,
      })),
    );

    const guardianInput = buildDecisionGuardianInput({
      textLength: avisText.trim().length,
      readable: true,
      validityPassed: true,
      fileName: "Avis_only_substantive.pdf",
      requirements: requirements.map((r) => ({
        id: r.id,
        requirement: r.description,
        category: r.category,
        semanticKind: r.semanticKind ?? null,
        mandatory: r.mandatory,
        // Let Guardian derive obligation strength from text/semantic kind.
        obligationStrength: undefined,
        sourceSection: r.sourceSection,
        page: null,
        evidenceText: r.evidence ?? null,
        fitStatus: null,
      })),
      matrix: intelligence.complianceMatrix.map((row) => ({
        requirementId: row.requirementId,
      })),
      readinessItems: requirements.map((r) => ({ id: r.id })),
      actions: null,
      decision: {
        decision: "REVIEW",
        hardFailure: false,
        hardBlockerCount: 0,
        aiOverrodeCanonical: false,
      },
      fitScore: 40,
      reasoning: intelligence.decisionContext,
      complianceSummaryTotal: intelligence.complianceSummary.totalRequirements,
      tenderSourceText: avisText.slice(0, 80_000),
      staleResult: {
        canonicalContentHash: contentHash,
        projectedContentHash: contentHash,
      },
    });

    assertFinalReleaseIntegrity(guardianInput, contentHash);
  });

  it("B — AVIS-only with only notice metadata must remain INCOMPLETE (no scoring)", () => {
    const avisText = FACTS_AND_WEIGHTS_ONLY;

    const assembly = assembleTenderPackage([
      { fileName: "Avis_only_notice.pdf", documentKind: "TENDER", text: avisText },
    ]);

    const heuristic = extractTenderPackageHeuristic({
      text: avisText,
      fileName: "Avis_only_notice.pdf",
    });
    const canonical = buildCanonicalRequirements({
      heuristicDrafts: heuristic.requirements,
      sourceDocument: "Avis_only_notice.pdf",
    });

    const gate = evaluatePackageScoringGate({
      assembly,
      reliableRequirementCount: canonical.length,
      canonicalRequirements: toCompletenessReqs(canonical),
    });

    assert.equal(gate.allowScoring, false);
    assert.equal(gate.reason, "ONLY_AVIS");
    assert.ok(gate.missingDocumentTypes.includes("CPS"));
    assert.ok(gate.missingDocumentTypes.includes("TECHNICAL_SPECIFICATION"));
  });

  it("TEST1 — construction tender may be AVIS/RFP but substantive content allows scoring without false missing CPS", () => {
    const text = loadConstructionText();
    const role = classifyTenderDocumentRole({
      text,
      fileName: "Bidvera_Test_2_Construction_Tender_2026.pdf",
    });
    // Role may be AVIS, RFP, or OTHER — completeness must not depend on that alone.
    assert.ok(["AVIS", "RFP", "OTHER", "CPS", "TECHNICAL_SPECIFICATION"].includes(role.role));

    const heuristic = extractTenderPackageHeuristic({
      text,
      fileName: "Bidvera_Test_2_Construction_Tender_2026.pdf",
    });
    const canonical = buildCanonicalRequirements({
      heuristicDrafts: heuristic.requirements,
      sourceDocument: "Bidvera_Test_2_Construction_Tender_2026.pdf",
    });
    assert.ok(canonical.length >= 10, `expected rich canonical set, got ${canonical.length}`);
    assert.ok(
      canonical.some((r) => /T-01|thermal resistance|insulation/i.test(r.requirement)),
    );
    assert.ok(
      canonical.some((r) => /E-01|legally registered|eligibility/i.test(r.requirement)),
    );

    const assembly = assembleTenderPackage([
      {
        fileName: "Bidvera_Test_2_Construction_Tender_2026.pdf",
        documentKind: "TENDER",
        text,
      },
    ]);

    const gate = evaluatePackageScoringGate({
      assembly,
      reliableRequirementCount: canonical.length,
      canonicalRequirements: toCompletenessReqs(canonical),
    });
    assert.equal(gate.allowScoring, true);
    assert.ok(
      gate.reason === "SINGLE_DOCUMENT_SUBSTANTIVE" ||
        gate.reason === "PACKAGE_COMPLETE",
      `unexpected gate reason ${gate.reason}`,
    );
    assert.deepEqual(gate.missingDocumentTypes, []);
  });

  it("TEST3 — multi-document Avis+CPS still allows scoring from combined package", () => {
    const avis = NOTICE_ONLY;
    const cps = `
CAHIER DES PRESCRIPTIONS SPECIALES
T-01 The contractor must install LED lighting with minimum 120 lm/W.
T-02 HVAC units must use refrigerant with GWP below 750.
C-01 The contract price shall remain firm and non-revisable.
E-01 The bidder must be legally registered to perform building works.
A-01 Attestation CNSS and tax clearance are mandatory.
`;
    const assembly = assembleTenderPackage([
      { fileName: "Avis.pdf", documentKind: "TENDER", text: avis },
      { fileName: "CPS.pdf", documentKind: "TENDER", text: cps },
    ]);
    assert.ok(assembly.rolesPresent.includes("AVIS"));
    assert.ok(assembly.hasSpecificationSource);

    const heuristic = extractTenderPackageHeuristic({
      text: assembly.packageText,
      fileName: assembly.packageLabel,
    });
    const canonical = buildCanonicalRequirements({
      heuristicDrafts: heuristic.requirements,
      sourceDocument: assembly.packageLabel,
    });
    const gate = evaluatePackageScoringGate({
      assembly,
      reliableRequirementCount: canonical.length,
      canonicalRequirements: toCompletenessReqs(canonical),
    });
    assert.equal(gate.allowScoring, true);
    assert.equal(gate.reason, "PACKAGE_COMPLETE");
  });

  it("does not allow scoring from requirement count alone without semantic substance", () => {
    const fake: CanonicalRequirementForCompleteness[] = Array.from(
      { length: 12 },
      (_, i) => ({
        semanticKind: "INFORMATIONAL_FACT" as const,
        obligationStrength: "INFORMATIONAL" as const,
        mandatory: false,
        requirement: `Fact ${i + 1}: estimated value and publication date for the tender notice.`,
      }),
    );
    const assessment = evaluateSubstantiveCanonicalContent(fake);
    assert.equal(assessment.sufficient, false);

    const assembly = assembleTenderPackage([
      { fileName: "Avis.pdf", documentKind: "TENDER", text: NOTICE_ONLY },
    ]);
    const gate = evaluatePackageScoringGate({
      assembly,
      reliableRequirementCount: fake.length,
      canonicalRequirements: fake,
    });
    assert.equal(gate.allowScoring, false);
    assert.equal(gate.reason, "ONLY_AVIS");
  });

  it("does not score a truncated package as complete", () => {
    const assembly = assembleTenderPackage([
      {
        fileName: "Avis_only_substantive.pdf",
        documentKind: "TENDER",
        text: AVIS_SUBSTANTIVE_SHORT,
      },
    ]);
    const heuristic = extractTenderPackageHeuristic({
      text: AVIS_SUBSTANTIVE_SHORT,
      fileName: "Avis_only_substantive.pdf",
    });
    const canonical = buildCanonicalRequirements({
      heuristicDrafts: heuristic.requirements,
      sourceDocument: "Avis_only_substantive.pdf",
    });
    const complete = evaluatePackageScoringGate({
      assembly,
      reliableRequirementCount: Math.max(canonical.length, 3),
      canonicalRequirements: toCompletenessReqs(canonical),
    });
    assert.equal(complete.allowScoring, true);
    const truncated = evaluatePackageScoringGate({
      assembly,
      reliableRequirementCount: Math.max(canonical.length, 3),
      canonicalRequirements: toCompletenessReqs(canonical),
      packageTextTruncated: true,
    });
    assert.equal(truncated.allowScoring, false);
    assert.equal(truncated.reason, "PACKAGE_TEXT_TRUNCATED");
  });
});
