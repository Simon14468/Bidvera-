/**
 * Hardening regressions: actor attribution, canonical counts, action text integrity.
 */

import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  assertCanonicalRequirementInvariants,
  attributeObligationActor,
  buildCanonicalRequirements,
  classifyRequirementSemanticKind,
  isRealBidderObligation,
  normalizeRequirements,
} from "@/domain/tender-requirements";
import { buildComplianceSummary } from "@/domain/tender-intelligence/build";
import {
  freezeCanonicalAnalysisSnapshot,
  metricsFromComplianceSummary,
} from "@/domain/tender-intelligence/canonical-snapshot";
import type { ComplianceRow } from "@/domain/tender-intelligence/types";
import { buildExplainableDecision } from "@/domain/explainable-decision/build";
import type { TenderDecisionRecommendation } from "@/domain/decision/recommendation";
import { buildTenderActionPlan, isGenericVerificationText } from "@/domain/tender-action-plan";
import { formatActionPlanReportLine } from "@/domain/tender-action-plan/presentation";
import {
  deriveCanonicalReportSections,
  formatDeadlineDisplay,
  FULL_REPORT_FEATURE_ACCESS,
} from "@/services/reports/report-canonical-view";
import { buildReportDisplayContent } from "@/services/reports/report-display-content";
import type { TenderReport } from "@/services/reports/types";

function row(
  id: string,
  requirement: string,
  status: ComplianceRow["status"] = "VERIFY",
): ComplianceRow {
  return {
    id: `CM-${id}`,
    requirementId: id,
    requirement,
    requirementType: "CONTRACTUAL",
    mandatory: true,
    priority: "HIGH",
    status,
    companyFit: null,
    sourceDocument: "spec.pdf",
    pageNumber: 1,
    section: null,
    evidence: requirement,
    tenderSource: null,
    companyEvidence: null,
    companyEvidenceMessage: null,
    notes: null,
    sourceBasis: "DIRECT_SOURCE",
    sourceLocated: true,
    evidenceId: null,
    risk: null,
    requiredAction: "Verify evidence",
  };
}

function baseRecommendation(
  over: Partial<TenderDecisionRecommendation> = {},
): TenderDecisionRecommendation {
  return {
    decision: "REVIEW",
    displayLabel: "CONDITIONAL GO",
    confidence: "MEDIUM",
    hardFailure: false,
    deterministic: true,
    contentHash: "test-hash",
    reasons: [],
    factors: [],
    criticalBlockers: [],
    reviewItems: ["driver-a", "driver-b"],
    decisionDrivers: ["driver-a", "driver-b"],
    actionItems: [],
    supportingEvidence: [],
    decisionTrace: [],
    summary: "test",
    memoryNote: null,
    missingDataNotes: [],
    ...over,
  };
}

describe("hardening — actor attribution A–I", () => {
  it("A/B. Authority / procuring-entity obligations excluded", () => {
    for (const text of [
      "L'Autorité contractante doit notifier les soumissionnaires non retenus.",
      "The Procuring Entity shall publish the evaluation results within 15 days.",
      "Le pouvoir adjudicateur n'est pas tenu de justifier le rejet d'une offre.",
      "L'Autorité contractante informera en même temps les autres soumissionnaires non retenus.",
    ]) {
      assert.notEqual(attributeObligationActor(text).actor, "BIDDER_SIDE", text);
      assert.equal(isRealBidderObligation(text), false, text);
      assert.equal(
        normalizeRequirements([
          { category: "admin", description: text, mandatory: true, evidenceText: text, sourcePage: 1 },
        ]).length,
        0,
        text,
      );
    }
  });

  it("C. Document-quality tender dossier sentence excluded", () => {
    const text =
      "Le dossier d'appel d'offres doit être suffisamment clair pour éviter que les soumissionnaires n'aient à demander des informations complémentaires au cours de la procédure.";
    assert.equal(attributeObligationActor(text).actor, "DOCUMENT_PROCEDURE");
    assert.equal(isRealBidderObligation(text), false);
  });

  it("D. Clarification / Q&A authority statement excluded", () => {
    const text =
      "L'Autorité contractante confirme que les soumissionnaires ne sont pas tenus d'assurer une présence régionale permanente.";
    assert.equal(attributeObligationActor(text).actor, "CLARIFICATION_CONTEXT");
    assert.equal(isRealBidderObligation(text), false);
  });

  it("E/G/H/I. Genuine bidder must/shall/doit + technical/financial/submission kept", () => {
    for (const text of [
      "Le soumissionnaire doit fournir une caution provisoire.",
      "The bidder shall submit a tax clearance certificate.",
      "Le consultant doit appliquer la TVA conformément à la réglementation locale.",
      "T-02 The contractor shall install and configure a hyperconverged platform.",
      "a) le chiffre d'affaires annuel du soumissionnaire doit s'élever à au moins 2 400 000 EUR.",
      "L'offre doit comprendre un volet technique et un volet financier.",
      "Remarque : il incombe au soumissionnaire de s'assurer que les fichiers PDF sont dûment protégés et que le mot de passe est valide.",
      "[Pour les contrats de mandat relevant de l'ACFA : les soumissionnaires sont exclus de la présente procédure d'appel d'offres s'ils ont été enregistrés dans le système de détection.]",
    ]) {
      assert.equal(isRealBidderObligation(text), true, text);
      assert.equal(
        normalizeRequirements([
          { category: "admin", description: text, mandatory: true, evidenceText: text, sourcePage: 2 },
        ]).length,
        1,
        text,
      );
    }
  });

  it("Second-person / veuillez fournir is a bidder obligation", () => {
    const text =
      "Si la nature de votre entité est telle qu'elle ne peut pas relever d'une situation d'exclusion, veuillez fournir une déclaration expliquant cette situation.";
    assert.equal(attributeObligationActor(text).actor, "BIDDER_SIDE");
    assert.equal(isRealBidderObligation(text), true);
  });

  it("F. Genuine bidder conditional requirement remains CONDITIONAL", () => {
    const text =
      "If applicable, the bidder must provide a local content certificate issued by the relevant authority.";
    const out = normalizeRequirements([
      { category: "admin", description: text, mandatory: true, evidenceText: text, sourcePage: 3 },
    ]);
    assert.equal(out.length, 1);
    assert.equal(out[0]!.obligationStrength, "CONDITIONAL");
  });
});

describe("hardening — counts J–K", () => {
  it("J. Canonical count partition", () => {
    const matrix = [
      row("1", "The bidder shall submit ISO 9001.", "READY"),
      row("2", "The bidder shall submit a bid bond.", "VERIFY"),
      row("3", "The bidder shall hold ISO 14001.", "MISSING"),
      row("4", "If applicable, the bidder must provide JV docs.", "NOT_APPLICABLE"),
      row("5", "The bidder shall provide methodology.", "UNKNOWN"),
    ];
    matrix[3]!.mandatory = false;
    const summary = buildComplianceSummary(matrix, 0);
    const metrics = metricsFromComplianceSummary(summary, matrix.length);
    assert.equal(
      metrics.verifiedRequirements +
        metrics.needsVerification +
        metrics.confirmedGaps +
        metrics.notApplicable,
      metrics.totalRequirements,
    );
  });

  it("K. Decision explanation uses canonical verification count, not driver subset alone", () => {
    const matrix = Array.from({ length: 23 }, (_, i) =>
      row(`r${i + 1}`, `Le soumissionnaire doit fournir le document ${i + 1}.`, "VERIFY"),
    );
    const explanation = buildExplainableDecision({
      recommendation: baseRecommendation({
        reviewItems: Array.from({ length: 12 }, (_, i) => `driver-${i}`),
      }),
      complianceMatrix: matrix,
      readiness: {
        score: 40,
        total: 23,
        totalRequirements: 23,
        counts: { ready: 0, missing: 0, verify: 23, unknown: 0, notApplicable: 0 },
        items: matrix.map((m) => ({
          id: m.requirementId,
          requirement: m.requirement,
          category: "requirement",
          status: m.status,
          priority: "HIGH",
          reason: "test",
          source: "test",
          mandatory: true,
        })),
        attention: [],
        recommendation: "Verify.",
        disclaimer: "test",
      },
    });
    assert.equal(explanation.executiveSummary.canonicalTotalRequirements, 23);
    assert.equal(explanation.executiveSummary.canonicalNeedsVerification, 23);
    assert.equal(explanation.executiveSummary.reviewItemCount, 12);
    assert.match(
      explanation.executiveSummary.whyHeadline,
      /23 canonical requirements? require verification/i,
    );
    assert.doesNotMatch(
      explanation.executiveSummary.whyHeadline,
      /^12 items? require verification/i,
    );
  });
});

describe("hardening — action / report text L–Q", () => {
  const longFr =
    "Le soumissionnaire doit fournir une attestation fiscale valide datée de moins de trois mois, accompagnée du certificat d'immatriculation au registre du commerce et de l'attestation CNSS, sans aucune omission ni raccourci dans le texte canonique.";

  it("L/M/N/O/P. Action references canonical ID and keeps complete FR requirement text", () => {
    const matrix = [row("long-1", longFr, "MISSING")];
    matrix[0]!.requiredAction = "Upload the complete fiscal attestation package listed in the requirement.";
    const plan = buildTenderActionPlan({
      tenderId: "t-long",
      companyId: "c-long",
      tenderDeadline: null,
      complianceMatrix: matrix,
      evidenceIntelligence: null,
      risks: [],
      keyBlockers: [],
      readiness: {
        attention: [],
        items: [
          {
            id: "long-1",
            requirement: longFr,
            category: "requirement",
            status: "MISSING",
            priority: "HIGH",
            reason: "missing",
            source: "test",
            mandatory: true,
          },
        ],
      },
      fitBreakdown: null,
      recommendation: null,
      teamTasks: [],
      asOf: new Date("2026-09-01T12:00:00.000Z"),
    });

    const linked = plan.items.filter((i) => i.linkedRequirementId === "long-1");
    assert.ok(linked.length >= 1, `expected linked actions, got ${plan.items.length}`);
    for (const item of linked) {
      assert.equal(item.linkedRequirementId, "long-1");
      const full = item.requirementText ?? item.description;
      assert.match(full, /registre du commerce/);
      assert.match(full, /attestation CNSS/);
      assert.ok(!full.endsWith("…"));
      const line = formatActionPlanReportLine(item, 0);
      assert.match(line, /registre du commerce/);
    }
  });

  it("Q/R. Multiline and page-break requirements stay complete", () => {
    const text = `Le soumissionnaire doit fournir:
— l'attestation fiscale;
— le certificat d'immatriculation.`;
    const continued =
      "R-07 The participating Tenderer shall disclose any conflicts of interest to avoid disqualification of the tender package.";
    for (const sample of [text, continued]) {
      const out = normalizeRequirements([
        {
          category: "admin",
          description: sample.replace(/\s+/g, " ").trim(),
          mandatory: true,
          evidenceText: sample,
          sourcePage: 1,
        },
      ]);
      assert.equal(out.length, 1);
      assert.ok(out[0]!.requirement.length >= sample.replace(/\s+/g, " ").trim().length - 5);
    }
  });
});

describe("hardening — multi-document S–T", () => {
  it("S/T. Corrigendum / clarification does not create authority rows; distinct obligations stay", () => {
    const original =
      "Le soumissionnaire doit fournir une attestation fiscale valide avec le dossier de candidature.";
    const clarification =
      "L'Autorité contractante confirme que l'attestation fiscale doit être datée de moins de trois mois.";
    const corrigendum =
      "This corrigendum amends clause 4.2: procedural update only for the contracting authority.";
    const other =
      "Le soumissionnaire doit également soumettre une caution provisoire de 2% du montant estimé.";

    const canonical = buildCanonicalRequirements({
      heuristicDrafts: [
        {
          category: "admin",
          description: original,
          mandatory: true,
          evidenceText: original,
          sourcePage: 1,
          sourceDocument: "instructions.pdf",
        },
        {
          category: "admin",
          description: clarification,
          mandatory: true,
          evidenceText: clarification,
          sourcePage: 1,
          sourceDocument: "clarifications.pdf",
        },
        {
          category: "admin",
          description: corrigendum,
          mandatory: true,
          evidenceText: corrigendum,
          sourcePage: 1,
          sourceDocument: "corrigendum.pdf",
        },
        {
          category: "admin",
          description: other,
          mandatory: true,
          evidenceText: other,
          sourcePage: 2,
          sourceDocument: "instructions.pdf",
        },
      ],
    });

    assert.equal(canonical.length, 2);
    assert.ok(canonical.every((r) => attributeObligationActor(r.requirement).isBidderRequirement));
    assert.ok(!canonical.some((r) => /confirme que|corrigendum amends/i.test(r.requirement)));
  });

  it("Web/PDF/API totals match snapshot for the same canonical set", () => {
    const matrix = [
      row("a1", "The bidder must submit a tax clearance certificate."),
      row("a2", "The bidder must provide three project references."),
      row("a3", "The contractor shall deliver within 90 days.", "READY"),
    ];
    const summary = buildComplianceSummary(matrix, 0);
    const snap = freezeCanonicalAnalysisSnapshot({
      tenderId: "hard-1",
      packageLabel: "pack",
      discoveredFileCount: 1,
      files: [
        { fileName: "a.pdf", processingStatus: "COMPLETED", role: "CPS", error: null },
      ],
      metadata: {
        title: "T",
        client: "C",
        deadlineIso: null,
        deadlineTimezone: null,
        factsNote: null,
        metadataStatus: "OK",
      },
      requirementIds: matrix.map((m) => m.requirementId),
      summary,
    });
    assert.equal(snap.counts.totalRequirements, 3);

    const report = {
      intelligence: {
        complianceMatrix: matrix,
        complianceSummary: summary,
        risks: [],
        contradictions: [],
        clarificationQuestions: [],
        keyBlockers: [],
        decisionContext: "",
        learningSignal: null,
        canonicalSnapshot: snap,
      },
      complianceSummary: summary,
      readiness: {
        score: 50,
        total: 3,
        totalRequirements: 3,
        counts: {
          ready: summary.ready,
          missing: summary.missing,
          verify: summary.verify,
          unknown: summary.unknown,
          notApplicable: summary.notApplicable,
        },
        items: matrix.map((m) => ({
          id: m.requirementId,
          requirement: m.requirement,
          category: "requirement",
          status: m.status,
          priority: "MEDIUM" as const,
          reason: "test",
          source: "test",
          mandatory: m.mandatory,
        })),
        attention: [],
        recommendation: "Verify.",
        disclaimer: "test",
      },
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
    } as unknown as TenderReport;

    const sections = deriveCanonicalReportSections(report, FULL_REPORT_FEATURE_ACCESS);
    assert.equal(sections.canonicalTotalRequirements, 3);
    assert.equal(sections.complianceSummary?.totalRequirements, 3);
    assert.equal(sections.verifyRequirements.length, summary.verify);
    assert.equal(sections.missingRequirements.length, summary.missing);

    assert.doesNotThrow(() =>
      assertCanonicalRequirementInvariants({
        canonicalRequirementCount: 3,
        readiness: report.readiness!,
        intelligence: report.intelligence as never,
      }),
    );
  });
});

describe("hardening — snapshot deadline and action-plan consistency", () => {
  it("report deadline and action titles come from the same snapshot counts", () => {
    const matrix = Array.from({ length: 4 }, (_, i) =>
      row(`v${i + 1}`, `The bidder shall submit document ${i + 1} with the offer.`, "VERIFY"),
    );
    matrix[0]!.requirement = "The bidder shall submit ISO 9001 certification with the offer.";
    matrix[0]!.requirementType = "Certification";
    matrix[1]!.requirement = "Submit company registration certificate with the tender dossier.";
    matrix[1]!.requirementType = "Eligibility";
    matrix[2]!.requirement = "Provide customer references from similar contracts.";
    matrix[2]!.requirementType = "Experience";
    matrix[3]!.requirement = "The bidder shall complete the Form of Tender.";
    matrix[3]!.requirementType = "Documentation";
    const summary = buildComplianceSummary(matrix, 0);
    const plan = buildTenderActionPlan({
      tenderId: "snap-actions",
      companyId: "c1",
      tenderDeadline: null,
      complianceMatrix: matrix,
      evidenceIntelligence: null,
      risks: [],
      keyBlockers: [],
      readiness: {
        attention: [`${summary.verify} mandatory requirements could not be verified.`],
        items: [],
      },
      fitBreakdown: null,
      recommendation: null,
      teamTasks: [],
      asOf: new Date("2026-09-01T12:00:00.000Z"),
    });
    const linked = plan.items.filter((i) => i.linkedRequirementId && !i.simulationOnly);
    assert.equal(
      linked.length,
      summary.verify,
      linked.map((i) => `${i.linkedRequirementId}:${i.title}`).join(" | "),
    );
    assert.equal(new Set(linked.map((i) => i.title)).size, linked.length);
    assert.ok(linked.every((i) => !isGenericVerificationText(i.title)));

    const snap = freezeCanonicalAnalysisSnapshot({
      tenderId: "snap-actions",
      packageLabel: "pack",
      discoveredFileCount: 1,
      files: [{ fileName: "a.pdf", processingStatus: "COMPLETED", role: "CPS", error: null }],
      metadata: {
        title: "T",
        client: "C",
        deadlineIso: null,
        deadlineTimezone: null,
        factsNote: null,
        metadataStatus: "INCOMPLETE",
        deadlineStatus: "INCOMPLETE",
        packageIdentity: {
          version: "package-identity/v1",
          documents: [],
          buyer: { value: null, status: "UNKNOWN", candidates: [] },
          title: { value: null, status: "UNKNOWN", candidates: [] },
          estimatedValue: { value: null, status: "UNKNOWN", candidates: [] },
          reference: { value: null, status: "UNKNOWN", candidates: [] },
          location: { value: null, status: "UNKNOWN", candidates: [] },
          country: { value: null, status: "UNKNOWN", candidates: [] },
          procurementType: { value: null, status: "UNKNOWN", candidates: [] },
          deadline: {
            deadlineIso: null,
            deadlineTimezone: null,
            localHour: null,
            localMinute: null,
            evidence: "DEADLINE FOR PROPOSAL SUBMISSION as set out in Section I",
            status: "INCOMPLETE",
            dateClass: "BID_SUBMISSION",
            reason:
              "A bid-submission deadline is referenced but the calendar date is not present in the available package text.",
            sources: [],
          },
        },
      },
      requirementIds: matrix.map((m) => m.requirementId),
      summary,
    });

    const report = {
      intelligence: {
        complianceMatrix: matrix,
        complianceSummary: summary,
        risks: [],
        contradictions: [],
        clarificationQuestions: [],
        keyBlockers: [],
        decisionContext: "",
        learningSignal: null,
        canonicalSnapshot: snap,
        actionPlan: plan,
      },
      complianceSummary: summary,
      readiness: {
        score: 45,
        total: 4,
        totalRequirements: 4,
        counts: {
          ready: 0,
          missing: 0,
          verify: 4,
          unknown: 0,
          notApplicable: 0,
        },
        items: matrix.map((m) => ({
          id: m.requirementId,
          requirement: m.requirement,
          category: "requirement",
          status: m.status,
          priority: "HIGH" as const,
          reason: "test",
          source: "test",
          mandatory: true,
        })),
        attention: [`${summary.verify} mandatory requirements could not be verified.`],
        recommendation: "Verify.",
        disclaimer: "test",
      },
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
      deadline: null,
      deadlineTimezone: null,
    } as unknown as TenderReport;

    const sections = deriveCanonicalReportSections(report, FULL_REPORT_FEATURE_ACCESS);
    assert.equal(sections.deadlineStatus, "INCOMPLETE");
    assert.equal(sections.deadlineIso, null);
    assert.match(sections.deadlineReason ?? "", /referenced|calendar date/i);
    assert.match(
      formatDeadlineDisplay(sections.deadlineIso, null, sections.deadlineStatus, ""),
      /Unavailable/,
    );
    const content = buildReportDisplayContent(sections);
    assert.equal(sections.verifyRequirements.length, 4);
    assert.equal(content.actionPlanDeadlineLine?.startsWith("Deadline: Unavailable"), true);
    assert.ok(content.actionPlanLines.every((line) => !/linked requirement/i.test(line)));
    assert.equal(sections.actionPlan?.items.filter((i) => i.linkedRequirementId).length, 4);
  });
});

describe("hardening — explicit authority never-enter list", () => {
  it("never enters canonical bidder requirements", () => {
    for (const text of [
      "Le dossier d'appel d'offres doit être suffisamment clair pour éviter que les soumissionnaires n'aient à demander des informations complémentaires au cours de la procédure.",
      "Le pouvoir adjudicateur n'est pas tenu de justifier le rejet d'une offre irrégulière.",
      "L'Autorité contractante informera en même temps les autres soumissionnaires non retenus et ces notifications auront pour conséquence que la validité des offres est maintenue.",
    ]) {
      assert.equal(
        classifyRequirementSemanticKind({ description: text }) === "CLARIFICATION_PROCEDURAL" ||
          !isRealBidderObligation(text),
        true,
        text,
      );
      assert.equal(
        normalizeRequirements([
          { category: "admin", description: text, mandatory: true, evidenceText: text, sourcePage: 1 },
        ]).length,
        0,
        text,
      );
    }
  });
});
