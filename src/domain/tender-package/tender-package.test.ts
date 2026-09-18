import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import {
  assembleTenderPackage,
  classifyTenderDocumentRole,
  evaluatePackageScoringGate,
} from "./index";
import { extractTenderPackageHeuristic } from "@/services/tender-extraction/requirements-heuristic";
import { classifyDocument } from "@/domain/company-knowledge";
import { runDecisionEngine } from "@/domain/decision/engine";
import { computeTenderReadiness } from "@/domain/decision/tender-readiness";
import { buildTenderIntelligence } from "@/domain/tender-intelligence";
import { buildBidScoreFromAnalysis } from "@/domain/bid-score";
import type { RuleCompanyProfile, RuleRequirement } from "@/domain/decision/types";

async function loadPdfText(relativePath: string): Promise<string | null> {
  try {
    const buf = readFileSync(relativePath);
    const { PDFParse } = await import("pdf-parse");
    const parser = new PDFParse({ data: buf });
    const result = await parser.getText();
    return typeof result === "string"
      ? result
      : ((result as { text?: string }).text ?? "");
  } catch {
    return null;
  }
}

const AVIS_FIXTURE = `
AVIS D'APPEL D'OFFRES OUVERT INTERNATIONAL SUR OFFRES DE PRIX
N°15/DRSI/2026
Le 14 Septembre 2026 à 10h30, il sera procédé dans la salle de réunion du Département
du Développement Durable relevant du Ministère de la Transition Energétique et du
Développement Durable, à l'ouverture des plis relatifs à l'appel d'offres.
L'estimation des coûts des prestations établie par le maître d'ouvrage est fixée à la somme
de : Quatre Millions Deux Cent Mille Dirhams Toutes Taxes comprises (4.200.000,00 DH TTC).
Le cautionnement provisoire est fixé à la somme de : Quatre-Vingt Mille Dirhams (80.000,00 DHS).
Les concurrents doivent déposer leurs dossiers par voie électronique dans le portail des
marchés publics accessible à l'adresse : www.marchespublics.gov.ma.
Au plus tard le 11/09/2026 à 16h00.
`;

const CPS_FIXTURE = `
CAHIER DES PRESCRIPTIONS SPECIALES
Objet : Acquisition et installation de matériel et logiciels informatiques
Le soumissionnaire devra élire domicile au Maroc.
Le prestataire doit fournir et installer une solution hyperconvergée.
ISO 27001 est exigé.
Support Editeur Type : 24/7.
Caution provisoire obligatoire.
Le titulaire doit assurer la livraison à Rabat.
Attestation CNSS obligatoire.
`;

const MY_NOTICE_FIXTURE = `
KENYATAAN TENDER
MAJLIS DAERAH SABAK BERNAM
Terbuka kepada Syarikat Pembekal yang berdaftar dengan Kementerian Kewangan Malaysia
dengan pendaftaran masih sah laku.
Cadangan Membekal, Menghantar, Memasang, Mengkonfigurasi, Mengintegrasi dan Mentauliah
Sistem bagi Pemantauan menggunakan Teknologi Internet of Things (IoT).
SYARAT-SYARAT
2.1 Salinan Sijil Kementerian Kewangan Malaysia (KKM),
2.2 Salinan Sijil Suruhanjaya Syarikat Malaysia (SSM),
2.3 Salinan Pendaftaran Unit Perancang Ekonomi Negeri (UPEN);
Petender DIKEHENDAKI menghantar Dokumen Tender bersama-sama salinan Sijil PKK, CIDB, SSM.
Dokumen Tender hendaklah dimasukkan ke dalam Peti Tender sebelum jam 12.00 tengah hari
pada 11 Februari 2026 (Rabu).
`;

describe("tender document role classification", () => {
  it("classifies French avis as AVIS, not CPS", () => {
    const role = classifyTenderDocumentRole({
      text: AVIS_FIXTURE,
      fileName: "Avis_en_Francais.pdf",
    });
    assert.equal(role.role, "AVIS");
  });

  it("classifies CPS as CPS", () => {
    const role = classifyTenderDocumentRole({
      text: CPS_FIXTURE,
      fileName: "CPS_v5.pdf",
    });
    assert.equal(role.role, "CPS");
  });

  it("classifies Malay kenyataan/iklan notice as AVIS", () => {
    const role = classifyTenderDocumentRole({
      text: MY_NOTICE_FIXTURE,
      fileName: "IKLAN_JAN_03_2026.pdf",
    });
    assert.equal(role.role, "AVIS");
  });
});

describe("A — real avis / notice only", () => {
  it("extracts verified notice facts without inventing fake technical CPS requirements", () => {
    const pack = extractTenderPackageHeuristic({
      text: AVIS_FIXTURE,
      fileName: "Avis_en_Francais.pdf",
    });
    assert.ok(pack.deadlineIso);
    assert.ok(pack.estimatedValue === 4_200_000);
    assert.ok(pack.client || pack.title);
    // No fabricated multi-page technical stack beyond what the notice states
    assert.ok(
      !pack.requirements.some((r) =>
        /nutanix|vsphere|hci\s+cluster|invented/i.test(r.description),
      ),
    );

    const assembly = assembleTenderPackage([
      { fileName: "Avis_en_Francais.pdf", documentKind: "TENDER", text: AVIS_FIXTURE },
    ]);
    assert.equal(assembly.avisOnly, true);
    const gate = evaluatePackageScoringGate({
      assembly,
      reliableRequirementCount: pack.requirements.length,
    });
    assert.equal(gate.allowScoring, false);
    assert.equal(gate.reason, "ONLY_AVIS");
  });

  it("extracts Malay notice deadline and eligibility without scoring", () => {
    const pack = extractTenderPackageHeuristic({
      text: MY_NOTICE_FIXTURE,
      fileName: "IKLAN_JAN_03_2026.pdf",
    });
    assert.ok(pack.deadlineIso?.startsWith("2026-02-11"));
    assert.equal(pack.country, "Malaysia");
    assert.ok(
      !pack.requirements.some((r) =>
        /Ministry of Finance|invented|nutanix|vsphere/i.test(r.description),
      ),
    );
    assert.ok(pack.requirements.every((r) => !r.evidenceText || r.evidenceText.length > 0));

    const kind = classifyDocument({
      text: MY_NOTICE_FIXTURE,
      fileName: "IKLAN_JAN_03_2026.pdf",
    });
    assert.equal(kind.kind, "TENDER");

    const assembly = assembleTenderPackage([
      {
        fileName: "IKLAN_JAN_03_2026.pdf",
        documentKind: "TENDER",
        text: MY_NOTICE_FIXTURE,
      },
    ]);
    assert.equal(assembly.completeness, "ONLY_AVIS");
    assert.equal(
      evaluatePackageScoringGate({
        assembly,
        reliableRequirementCount: pack.requirements.length,
      }).allowScoring,
      false,
    );
  });
});

describe("B — real CPS requirements", () => {
  it("extracts mandatory technical requirements with evidence", () => {
    const pack = extractTenderPackageHeuristic({
      text: CPS_FIXTURE,
      fileName: "CPS_v5.pdf",
    });
    assert.ok(pack.requirements.length >= 3);
    assert.ok(
      pack.requirements.some((r) =>
        /MANDATORY_TECHNICAL|MANDATORY_ELIGIBILITY|MANDATORY_ADMINISTRATIVE/.test(
          r.category,
        ),
      ),
    );
    assert.ok(pack.requirements.every((r) => r.evidenceText));
    assert.ok(
      pack.requirements.some((r) => /domicile|Maroc|Morocco/i.test(r.description)),
    );
  });

  it("loads real CPS PDF when available", async (t) => {
    const text = await loadPdfText(
      ".data/uploads/cmtfvf1vm0000rkgkqq291zux/cmtg5ol4900gbrkokt770vb7q/1788115302145-CPS_v5_-_VF29-07.pdf",
    );
    if (!text) {
      t.skip("CPS PDF not available locally");
      return;
    }
    const role = classifyTenderDocumentRole({
      text,
      fileName: "CPS_v5_-_VF29-07.pdf",
    });
    assert.equal(role.role, "CPS");
    const pack = extractTenderPackageHeuristic({
      text,
      fileName: "CPS_v5_-_VF29-07.pdf",
    });
    assert.ok(pack.requirements.length >= 5);
    assert.ok(pack.requirements.some((r) => r.evidenceText));
  });
});

describe("C — Avis + CPS package assembly", () => {
  it("combines documents, preserves roles, and allows scoring when requirements exist", () => {
    const assembly = assembleTenderPackage([
      { fileName: "Avis.pdf", documentKind: "TENDER", text: AVIS_FIXTURE },
      { fileName: "CPS.pdf", documentKind: "TENDER", text: CPS_FIXTURE },
    ]);
    assert.ok(assembly.rolesPresent.includes("AVIS"));
    assert.ok(assembly.rolesPresent.includes("CPS"));
    assert.equal(assembly.hasSpecificationSource, true);
    assert.equal(assembly.avisOnly, false);
    assert.match(assembly.packageText, /DOCUMENT: Avis\.pdf/);
    assert.match(assembly.packageText, /DOCUMENT: CPS\.pdf/);

    const pack = extractTenderPackageHeuristic({
      text: assembly.packageText,
      fileName: assembly.packageLabel,
    });
    // Deduped requirements from both docs — not empty
    assert.ok(pack.requirements.length >= 3);
    const descriptions = pack.requirements.map((r) => r.description.toLowerCase());
    assert.equal(
      descriptions.length,
      new Set(descriptions).size,
      "duplicate requirement descriptions should be removed",
    );

    const gate = evaluatePackageScoringGate({
      assembly,
      reliableRequirementCount: pack.requirements.length,
    });
    assert.equal(gate.allowScoring, true);
  });
});

describe("D — company + complete tender decision path", () => {
  it("matches company knowledge and produces fit / bid score after valid extraction", () => {
    const profile: RuleCompanyProfile = {
      companyName: "Test Co",
      industry: "Information Technology",
      country: "Morocco",
      companySize: "11-50",
      experienceLevel: "experienced",
      services: ["Web Application Development", "Cloud Solutions"],
      certifications: ["ISO 9001", "ISO 27001"],
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
        description: "Bidder must establish domicile in Morocco",
        mandatory: true,
        value: "Morocco",
        status: "MATCHED",
        evidence: "domicile au Maroc",
      },
      {
        category: "MANDATORY_TECHNICAL",
        description: "Provide hyperconverged virtualization infrastructure",
        mandatory: true,
        value: null,
        status: "MATCHED",
        evidence: "solution hyperconvergée",
      },
    ];

    const assembly = assembleTenderPackage([
      { fileName: "Avis.pdf", documentKind: "TENDER", text: AVIS_FIXTURE },
      { fileName: "CPS.pdf", documentKind: "TENDER", text: CPS_FIXTURE },
    ]);
    assert.equal(
      evaluatePackageScoringGate({
        assembly,
        reliableRequirementCount: requirements.length,
      }).allowScoring,
      true,
    );

    const decision = runDecisionEngine({
      profile,
      requirements,
      estimatedValue: 4_200_000,
      tenderContext: {
        title: "IT acquisition",
        client: "Ministry",
        country: "Morocco",
        industry: "IT",
        tenderText: CPS_FIXTURE,
      },
    });
    assert.ok(decision.fitScore > 0);
    assert.ok(decision.fitBreakdown.overall != null);

    const readiness = computeTenderReadiness({
      requirements,
      profileHasAnyCapability: true,
      fit: decision.fitBreakdown,
    });
    const intelligence = buildTenderIntelligence({
      tenderId: "t-pack",
      documentName: "Avis.pdf + CPS.pdf",
      tenderDeadline: null,
      extractedText: CPS_FIXTURE,
      requirements: requirements.map((r, i) => ({
        id: `r${i}`,
        category: r.category,
        description: r.description,
        mandatory: r.mandatory,
        value: r.value,
        status: r.status,
        sourcePage: 1,
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
    assert.ok(intelligence.complianceMatrix.length > 0);

    const bidScore = buildBidScoreFromAnalysis({
      fitScore: decision.fitScore,
      fitBreakdown: decision.fitBreakdown,
      readiness,
      intelligence,
      estimatedValue: 4_200_000,
      deadline: null,
      decision: decision.decision,
    });
    assert.notEqual(bidScore.scoringAvailable, false);
    assert.ok(decision.decision === "BID" || decision.decision === "REVIEW" || decision.decision === "NO_BID");
  });
});

describe("E — broken / unreadable tender fail-safe", () => {
  it("blocks scoring and invents no requirements for unreadable package", () => {
    const assembly = assembleTenderPackage([
      { fileName: "broken.pdf", documentKind: "TENDER", text: "   x  " },
    ]);
    assert.equal(assembly.completeness, "DOCUMENT_UNREADABLE");
    const gate = evaluatePackageScoringGate({
      assembly,
      reliableRequirementCount: 0,
      extractionUnreliable: true,
    });
    assert.equal(gate.allowScoring, false);
    const pack = extractTenderPackageHeuristic({
      text: "x",
      fileName: "broken.pdf",
    });
    assert.equal(pack.requirements.length, 0);
    assert.equal(pack.deadlineIso, null);
    assert.equal(pack.estimatedValue, null);
  });
});
