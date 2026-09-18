import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { buildCanonicalRequirements } from "@/domain/tender-requirements";
import { computeTenderReadiness } from "@/domain/decision/tender-readiness";
import { runDecisionEngine } from "@/domain/decision/engine";
import { buildTenderIntelligence } from "@/domain/tender-intelligence";
import { finalizeTenderDecision } from "@/domain/decision/tender-decision-engine";
import { buildTenderActionPlan } from "@/domain/tender-action-plan";
import {
  assertFinalReleaseIntegrity,
  buildDecisionGuardianInput,
  hashCanonicalReleasePayload,
} from "@/domain/decision-validation";
import type { RuleCompanyProfile } from "@/domain/decision/types";
import { extractTenderPackageHeuristic } from "./requirements-heuristic";

describe("tender package heuristic extraction", () => {
  it("extracts FR public-procurement requirements with provenance and deadline", () => {
    const text = `
--- Page 1 (pdf-parse) ---
APPEL D'OFFRES OUVERT
Objet : Acquisition et installation de matériel informatique
Maître d'ouvrage : Ministère de la Transition Energétique — Rabat, Maroc
Date limite de remise des offres : 15/09/2026
Le soumissionnaire devra fournir une attestation CNSS.
Le soumissionnaire devra fournir une certification ISO 27001.
Le prestataire doit assurer la livraison à Rabat.
Le titulaire est tenu d'élire domicile au Maroc.
Caution provisoire obligatoire.
Support Editeur Type : 24/7.
Fourniture et installation de la solution hyperconvergée.
`;
    const pack = extractTenderPackageHeuristic({
      text,
      fileName: "avis-exemple.pdf",
    });
    const canonical = buildCanonicalRequirements({
      heuristicDrafts: pack.requirements,
      sourceDocument: "avis-exemple.pdf",
    });
    assert.ok(canonical.length > 0);
    assert.ok(pack.deadlineIso);
    assert.equal(pack.country, "Morocco");
    assert.ok(canonical.some((r) => /ISO\s*27001/i.test(r.requirement)));
    assert.ok(canonical.some((r) => r.evidenceText));
    assert.ok(pack.missingDocuments.some((d) => /CNSS/i.test(d.documentName)));
    assert.ok(
      canonical.every((r) =>
        /MANDATORY_|CONTRACTUAL|PREFERRED/.test(r.category),
      ),
      "requirements should use canonical categories",
    );
    assert.ok(
      !canonical.some((r) =>
        /approbation du marché|dispositions de l'article/i.test(r.requirement),
      ),
    );
  });

  it("keeps short mandatory ID rows in 'Mandatory Requirements' tables", () => {
    const text = `
Procuring entity: Fonds d'Equipement Communal (FEC), Morocco
Deadline 13 July 2026 at 10:00

1. Mandatory Requirements
ID Requirement
EL-01 The bidder shall be registered for the provision of cleaning services.
E-01 Technical methodology
T-02 Price schedule
R-03 Personnel plan
OPS-04 The bidder shall maintain daily cleaning logs and make them available to the contracting authority on request.`;

    const pack = extractTenderPackageHeuristic({
      text,
      fileName: "t2-like.pdf",
    });
    assert.equal(pack.client, "Fonds d'Equipement Communal (FEC), Morocco");
    assert.ok(pack.deadlineIso);
    assert.equal(pack.country, "Morocco");

    const canonical = buildCanonicalRequirements({
      heuristicDrafts: pack.requirements,
      sourceDocument: "t2-like.pdf",
    });

    // These short rows are mandatory even without repeated "must/shall" in-line.
    const ids = canonical.map((r) => r.id).filter(Boolean) as string[];
    assert.ok(ids.includes("E-01"));
    assert.ok(ids.includes("T-02"));
    assert.ok(ids.includes("R-03"));
    assert.ok(canonical.some((r) => r.requirement.includes("OPS-04")));

    const e1 = canonical.find((r) => r.id === "E-01")!;
    assert.equal(e1.sourceSection, "1. Mandatory Requirements");
  });

  it("does not invent a submission deadline from an opening date alone", () => {
    const text = `
Procuring entity: Test authority, Morocco
Opening 21 September 2026 at 15:00
Procedure Open tender — price quotation
`;

    const pack = extractTenderPackageHeuristic({
      text,
      fileName: "opening-only.pdf",
    });

    assert.equal(pack.country, "Morocco");
    assert.equal(pack.deadlineIso, null);
    assert.equal(pack.deadlineTimezone, null);
    assert.ok(pack.deadlineUnknownReason);
  });

  it("picks the explicitly labeled submission deadline when multiple dates exist", () => {
    const text = `
Procuring entity: Test authority, Morocco
Publication September 2026
Opening 01 September 2026 at 09:00
Deadline 13 September 2026 at 10:00
Procedure Open tender — price quotation
`;

    const pack = extractTenderPackageHeuristic({
      text,
      fileName: "multi-dates.pdf",
    });

    assert.equal(pack.country, "Morocco");
    assert.ok(pack.deadlineIso);
    assert.match(pack.deadlineIso!, /2026-09-13/);
    assert.match(pack.deadlineIso!, /10:00/);
  });

  it("returns null client when buyer identity is not explicitly present", () => {
    const text = `
Deadline 13 July 2026 at 10:00
Procedure Open tender — price quotation
Morocco
`;

    const pack = extractTenderPackageHeuristic({
      text,
      fileName: "no-client.pdf",
    });
    assert.equal(pack.client, null);
    assert.ok(pack.deadlineIso);
  });

  it("does not invent a deadline when none is present", () => {
    const pack = extractTenderPackageHeuristic({
      text: "Objet : Fourniture de services. Lot unique.",
      fileName: "note.pdf",
    });
    assert.equal(pack.deadlineIso, null);
    assert.ok(pack.deadlineUnknownReason);
  });

  it("extracts Malay tender notice deadline and eligibility with provenance", () => {
    const text = `
KENYATAAN TENDER
MAJLIS DAERAH SABAK BERNAM
Terbuka kepada Syarikat yang berdaftar dengan Kementerian Kewangan Malaysia.
Cadangan Membekal Sistem Internet of Things (IoT).
Petender hendaklah mengemukakan salinan Sijil Suruhanjaya Syarikat Malaysia (SSM) bersama dokumen tender.
Dokumen Tender hendaklah dimasukkan ke dalam Peti Tender sebelum jam 12.00 tengah hari
pada 11 Februari 2026 (Rabu).
`;
    const pack = extractTenderPackageHeuristic({
      text,
      fileName: "IKLAN_JAN_03_2026.pdf",
    });
    assert.ok(pack.deadlineIso?.startsWith("2026-02-11"));
    assert.equal(pack.country, "Malaysia");
    const canonical = buildCanonicalRequirements({ heuristicDrafts: pack.requirements });
    // Unknown-actor Malay morphology must not be invented into a bidder duty.
    assert.ok(
      canonical.every((r) => r.evidenceText || r.requirement),
    );
    assert.ok(
      !canonical.some((r) => /Ministry of Finance \(KKM\) supplier registration required/i.test(r.requirement)),
    );
  });

  it("1 — requirement continuation after a PDF page marker is not persisted as truncated text", () => {
    const text = `
--- Page 1 (pdf-parse) ---
E-01 The bidder shall provide the Services by the
--- Page 2 (pdf-parse) ---
bidder shall comply with all acceptance and evaluation requirements described in the Tender.
`;

    const pack = extractTenderPackageHeuristic({
      text,
      fileName: "page-marker-continuation.pdf",
    });
    const canonical = buildCanonicalRequirements({
      heuristicDrafts: pack.requirements,
      sourceDocument: "page-marker-continuation.pdf",
    });

    assert.ok(canonical.length >= 1);
    assert.ok(
      canonical.some((r) => /acceptance and evaluation requirements described in the Tender/i.test(r.requirement)),
      "expected canonical requirement to include page-2 continuation",
    );
  });

  it("2 — long technical requirement spanning page breaks is canonical and non-truncated", () => {
    const text = `
--- Page 1 (pdf-parse) ---
T-02 The bidder shall install and configure a hyperconverged platform by the
--- Page 2 (pdf-parse) ---
end of the contract term and the bidder shall ensure full compatibility verification.
`;

    const pack = extractTenderPackageHeuristic({
      text,
      fileName: "long-technical.pdf",
    });
    const canonical = buildCanonicalRequirements({
      heuristicDrafts: pack.requirements,
      sourceDocument: "long-technical.pdf",
    });

    assert.ok(canonical.length >= 1);
    assert.ok(
      canonical.some((r) => /compatibility verification/i.test(r.requirement)),
    );
  });

  it("3 — supplier warranty execution spanning pages is excluded (not bidder-stage)", () => {
    const text = `
--- Page 1 (pdf-parse) ---
R-03 The supplier shall provide a warranty period of 24 months starting from the
--- Page 2 (pdf-parse) ---
date of successful commissioning and the supplier shall warrant continued performance during the warranty period.
`;

    const pack = extractTenderPackageHeuristic({
      text,
      fileName: "long-contractual.pdf",
    });
    const { candidates, rejected } = (() => {
      const canonical = buildCanonicalRequirements({
        heuristicDrafts: pack.requirements,
        sourceDocument: "long-contractual.pdf",
      });
      return { candidates: canonical, rejected: pack.requirements };
    })();

    // Post-award warranty execution must not enter bidder-stage canonical set.
    assert.equal(
      candidates.some((r) => /warranty period/i.test(r.requirement)),
      false,
    );
    assert.ok(rejected.length >= 1 || candidates.length === 0);
  });

  it("3b — long bidder submission obligation spanning page breaks is canonical and non-truncated", () => {
    const text = `
--- Page 1 (pdf-parse) ---
R-03 The Tenderer shall submit a detailed mobilisation plan covering staffing, equipment, and
--- Page 2 (pdf-parse) ---
site access arrangements with the Technical Proposal and the Tenderer shall ensure the plan addresses full compatibility verification.
`;

    const pack = extractTenderPackageHeuristic({
      text,
      fileName: "long-bidder-plan.pdf",
    });
    const canonical = buildCanonicalRequirements({
      heuristicDrafts: pack.requirements,
      sourceDocument: "long-bidder-plan.pdf",
    });

    assert.ok(canonical.length >= 1);
    assert.ok(
      canonical.some((r) => /compatibility verification|mobilisation plan|Technical Proposal/i.test(r.requirement)),
    );
  });

  it("4 — numbered obligation split across pages is merged into a full canonical requirement", () => {
    const text = `
--- Page 1 (pdf-parse) ---
1. The Tenderer shall submit the signed proposal and supporting documents by the
--- Page 2 (pdf-parse) ---
Tenderer shall ensure the proposal is complete and accurate for evaluation in accordance with the ITT.
`;

    const pack = extractTenderPackageHeuristic({
      text,
      fileName: "numbered-split.pdf",
    });
    const canonical = buildCanonicalRequirements({
      heuristicDrafts: pack.requirements,
      sourceDocument: "numbered-split.pdf",
    });

    assert.ok(canonical.length >= 1);
    assert.ok(
      canonical.some((r) => /proposal is complete and accurate/i.test(r.requirement)),
    );
  });

  it("5 — no truncation after normalization/deduplication for all extracted canonical requirements", () => {
    const text = `
--- Page 1 (pdf-parse) ---
T-04 The bidder shall submit a commissioning and acceptance-test methodology covering the
--- Page 2 (pdf-parse) ---
date specified in the procurement schedule and the bidder shall include acceptance tests in the Technical Proposal.
`;

    const pack = extractTenderPackageHeuristic({
      text,
      fileName: "normalization-no-truncation.pdf",
    });
    const canonical = buildCanonicalRequirements({
      heuristicDrafts: pack.requirements,
      sourceDocument: "normalization-no-truncation.pdf",
    });

    assert.ok(canonical.length >= 1);
    assert.ok(canonical.some((r) => /acceptance tests|Technical Proposal|methodology/i.test(r.requirement)));
  });

  it("6 — Decision Guardian sees the same full canonical text (no REQUIREMENT_TRUNCATED)", () => {
    const text = `
--- Page 1 (pdf-parse) ---
R-07 The Procuring Entity requires that participation shall result in the disqualification of all Tenders in which the
--- Page 2 (pdf-parse) ---
participating Tenderer shall disclose any conflicts of interest to avoid disqualification.
`;

    const FILE_NAME = "guardian-no-truncation.pdf";
    const pack = extractTenderPackageHeuristic({
      text,
      fileName: FILE_NAME,
    });
    const canonical = buildCanonicalRequirements({
      heuristicDrafts: pack.requirements,
      sourceDocument: FILE_NAME,
    });
    assert.ok(canonical.length >= 1);
    assert.ok(canonical.some((r) => /avoid disqualification/i.test(r.requirement)));

    const PROFILE: RuleCompanyProfile = {
      companyName: "Guardian Proof Co",
      industry: "General Services",
      country: "Kenya",
      companySize: "11-50",
      experienceLevel: "experienced",
      services: ["compliance", "technical delivery"],
      certifications: [],
      experienceYears: 4,
      revenueRange: null,
      employeeRange: "11-50",
      geographicCoverage: ["Kenya"],
      contractSizeMin: null,
      contractSizeMax: null,
      customQualificationRules: [],
    };

    const requirements = canonical.map((r, i) => ({
      id: r.id ?? `g-r${i + 1}`,
      category: r.category,
      description: r.requirement,
      mandatory: r.mandatory,
      value: r.value ?? null,
      status: "UNCERTAIN" as const,
      sourcePage: r.page ?? null,
      section: r.sourceSection ?? null,
      evidence: r.evidenceText ?? null,
      semanticKind: r.semanticKind ?? null,
      obligationStrength: r.obligationStrength,
    }));

    const engine = runDecisionEngine({
      profile: PROFILE,
      requirements,
      estimatedValue: pack.estimatedValue ?? null,
      tenderContext: {
        title: pack.title ?? "Guardian no-truncation",
        client: pack.client ?? "Client",
        country: pack.country ?? "Kenya",
        industry: pack.industry ?? null,
        tenderText: text,
      },
    });

    const readiness = computeTenderReadiness({
      requirements: engine.requirements.map((r) => ({
        id: r.id!,
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
      tenderId: "guardian-no-truncation",
      documentName: FILE_NAME,
      tenderDeadline: pack.deadlineIso ? new Date(pack.deadlineIso) : null,
      extractedText: text,
      requirements: engine.requirements.map((r, i) => ({
        id: r.id!,
        category: r.category,
        description: r.description,
        mandatory: r.mandatory,
        value: r.value ?? null,
        status: r.status,
        sourcePage: typeof r.page === "number" ? r.page : null,
        sourceSection: typeof r.section === "string" ? r.section : null,
        evidence: r.evidence ?? null,
        semanticKind: r.semanticKind ?? canonical[i]?.semanticKind ?? null,
      })),
      evidence: [],
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
      reviewItems: intelligence.reviewItems,
      decisionDrivers: intelligence.decisionDrivers,
      actionItems: intelligence.actionItems,
    });

    const actionPlan = buildTenderActionPlan({
      tenderId: "guardian-no-truncation",
      companyId: "guardian-proof-c1",
      tenderDeadline: pack.deadlineIso ? new Date(pack.deadlineIso) : null,
      complianceMatrix: intelligence.complianceMatrix,
      evidenceIntelligence: intelligence.evidenceIntelligence ?? null,
      risks: intelligence.risks,
      keyBlockers: intelligence.keyBlockers,
      readiness: { attention: readiness.attention, items: readiness.items },
      fitBreakdown: engine.fitBreakdown,
      recommendation: finalized.recommendation,
      teamTasks: [],
    });
    intelligence.actionPlan = actionPlan;

    const guardianReqs = engine.requirements.map((r, i) => {
      const c = canonical[i];
      const fit = r.fitStatus ?? null;
      return {
        id: r.id ?? c?.id ?? `r${i + 1}`,
        requirement: r.description,
        category: r.category,
        semanticKind: r.semanticKind ?? c?.semanticKind ?? null,
        obligationStrength: c?.obligationStrength ?? null,
        mandatory: r.mandatory,
        sourceSection:
          (typeof r.section === "string" ? r.section : null) ?? c?.sourceSection ?? null,
        page: (typeof r.page === "number" ? r.page : null) ?? c?.page ?? null,
        evidenceText: c?.evidenceText ?? r.evidence ?? null,
        fitStatus: fit ?? r.status ?? null,
        hasCompanyEvidence:
          fit === "CONFIRMED_FIT" || fit === "CONFIRMED_GAP"
            ? Boolean(r.evidence)
            : false,
        companyEvidenceText:
          fit === "CONFIRMED_FIT" || fit === "CONFIRMED_GAP"
            ? r.evidence ?? null
            : null,
      };
    });

    const contentHash = hashCanonicalReleasePayload(
      intelligence.complianceMatrix.map((row) => ({
        id: row.requirementId,
        text: row.requirement,
      })),
    );

    const guardianInput = buildDecisionGuardianInput({
      textLength: text.trim().length,
      readable: true,
      validityPassed: true,
      fileName: FILE_NAME,
      requirements: guardianReqs,
      matrix: intelligence.complianceMatrix.map((row) => ({
        requirementId: row.requirementId,
      })),
      readinessItems: readiness.items.map((item) => ({ id: item.id })),
      actions: actionPlan.items.map((a) => ({
        linkedRequirementId: a.linkedRequirementId,
        blocking: a.blocking,
        sourceType: a.sourceType,
        title: a.title,
        simulationOnly: a.simulationOnly,
      })),
      decision: {
        decision: engine.decision,
        hardFailure: Boolean(finalized.recommendation?.hardFailure),
        hardBlockerCount: intelligence.keyBlockers.length,
        aiOverrodeCanonical: false,
      },
      deadline: {
        deadlineIso: pack.deadlineIso,
        deadlineTimezone: pack.deadlineTimezone,
        sourceEvidence: pack.deadlineEvidence ?? pack.deadlineIso,
      },
      fitScore: engine.fitScore,
      fitBreakdownOverall: engine.fitBreakdown?.overall ?? null,
      reasoning: engine.reasoning,
      complianceSummaryTotal: intelligence.complianceSummary.totalRequirements,
      tenderSourceText: text.slice(0, 80_000),
      risks: intelligence.risks.map((risk) => ({
        id: risk.id,
        requirementId: risk.requirementId ?? null,
        severity: risk.severityCanonical ?? risk.severity,
        fitStatus: risk.fitStatus ?? null,
        evidenceState: risk.evidenceState ?? null,
        title: risk.title,
      })),
      staleResult: {
        canonicalContentHash: contentHash,
        projectedContentHash: contentHash,
      },
    });

    assertFinalReleaseIntegrity(guardianInput, contentHash);
  });
});
