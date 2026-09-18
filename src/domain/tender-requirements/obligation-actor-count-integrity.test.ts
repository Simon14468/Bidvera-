/**
 * Canonical requirement actor attribution + count integrity regressions.
 */

import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  assertCanonicalRequirementInvariants,
  buildCanonicalRequirements,
  classifyRequirementSemanticKind,
  deriveObligationStrength,
  normalizeRequirements,
  isRealBidderObligation,
  attributeObligationActor,
} from "@/domain/tender-requirements";
import {
  freezeCanonicalAnalysisSnapshot,
  metricsFromComplianceSummary,
  assertCanonicalSnapshotInvariants,
} from "@/domain/tender-intelligence/canonical-snapshot";
import { buildComplianceSummary } from "@/domain/tender-intelligence/build";
import type { ComplianceRow } from "@/domain/tender-intelligence/types";
import {
  deriveCanonicalReportSections,
  FULL_REPORT_FEATURE_ACCESS,
} from "@/services/reports/report-canonical-view";
import type { TenderReport } from "@/services/reports/types";

function row(
  id: string,
  requirement: string,
  status: ComplianceRow["status"],
  mandatory = true,
): ComplianceRow {
  return {
    id: `CM-${id}`,
    requirementId: id,
    requirement,
    requirementType: "CONTRACTUAL",
    mandatory,
    priority: "MEDIUM",
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
    sourceBasis: "UNKNOWN",
    sourceLocated: true,
    evidenceId: null,
    risk: null,
    requiredAction: null,
  };
}

describe("obligation actor attribution", () => {
  it("1. bidder must/shall/doit → included", () => {
    for (const text of [
      "Le soumissionnaire doit fournir une caution provisoire.",
      "The bidder shall submit a tax clearance certificate.",
      "The tenderer must provide three comparable project references.",
      "Le consultant doit appliquer la TVA conformément à la réglementation locale.",
    ]) {
      assert.equal(attributeObligationActor(text).actor, "BIDDER_SIDE", text);
      assert.equal(isRealBidderObligation(text), true, text);
      assert.equal(
        normalizeRequirements([
          {
            category: "administrative",
            description: text,
            mandatory: true,
            evidenceText: text,
            sourcePage: 1,
          },
        ]).length,
        1,
        text,
      );
    }
  });

  it("2. Contracting Authority must/doit → excluded", () => {
    for (const text of [
      "L'Autorité contractante doit notifier les soumissionnaires non retenus.",
      "The Contracting Authority shall publish the evaluation results within 15 days.",
      "Le pouvoir adjudicateur doit ouvrir les plis en séance publique.",
    ]) {
      assert.equal(attributeObligationActor(text).actor, "AUTHORITY_SIDE", text);
      assert.equal(isRealBidderObligation(text), false, text);
      assert.equal(
        normalizeRequirements([
          {
            category: "administrative",
            description: text,
            mandatory: true,
            evidenceText: text,
            sourcePage: 1,
          },
        ]).length,
        0,
        text,
      );
    }
  });

  it("3. Procuring Entity disclaimer → excluded", () => {
    const text =
      "Le pouvoir adjudicateur n'est pas tenu de justifier le rejet d'une offre irrégulière.";
    assert.equal(attributeObligationActor(text).actor, "AUTHORITY_SIDE");
    assert.equal(isRealBidderObligation(text), false);
    assert.equal(
      normalizeRequirements([
        {
          category: "administrative",
          description: text,
          mandatory: true,
          evidenceText: text,
          sourcePage: 1,
        },
      ]).length,
      0,
    );
  });

  it("4. Tender document/procedure obligation → excluded", () => {
    const text =
      "Le dossier doit être suffisamment clair pour permettre une évaluation cohérente des offres.";
    assert.equal(attributeObligationActor(text).actor, "DOCUMENT_PROCEDURE");
    assert.equal(isRealBidderObligation(text), false);
    assert.equal(
      normalizeRequirements([
        {
          category: "administrative",
          description: text,
          mandatory: true,
          evidenceText: text,
          sourcePage: 1,
        },
      ]).length,
      0,
    );
  });

  it("5. Clarification question → excluded", () => {
    const text =
      "Étant donné que le contrat pourrait impliquer l'existence d'un établissement permanent au Maroc, le consultant doit appliquer la TVA. Pouvez-vous confirmer si l'entité contractante bénéficie d'une exonération de TVA ?";
    assert.equal(attributeObligationActor(text).actor, "CLARIFICATION_CONTEXT");
    assert.equal(
      classifyRequirementSemanticKind({ description: text }),
      "CLARIFICATION_PROCEDURAL",
    );
    assert.equal(isRealBidderObligation(text), false);
    assert.equal(
      normalizeRequirements([
        {
          category: "contractual",
          description: text,
          mandatory: true,
          evidenceText: text,
          sourcePage: 2,
        },
      ]).length,
      0,
    );
  });

  it("6. Clarification answer → excluded", () => {
    const text =
      "L'Autorité contractante confirme que les soumissionnaires ne sont pas tenus d'assurer une présence régionale permanente.";
    assert.equal(attributeObligationActor(text).actor, "CLARIFICATION_CONTEXT");
    assert.equal(isRealBidderObligation(text), false);
    assert.equal(
      normalizeRequirements([
        {
          category: "administrative",
          description: text,
          mandatory: true,
          evidenceText: text,
          sourcePage: 3,
        },
      ]).length,
      0,
    );
  });

  it("7. Revision/addendum procedural text → excluded", () => {
    const text =
      "This addendum amends clause 4.2: the bidder must submit the revised price schedule with the technical offer.";
    assert.equal(attributeObligationActor(text).actor, "CLARIFICATION_CONTEXT");
    assert.equal(isRealBidderObligation(text), false);
    assert.equal(
      normalizeRequirements([
        {
          category: "administrative",
          description: text,
          mandatory: true,
          evidenceText: text,
          sourcePage: 1,
        },
      ]).length,
      0,
    );
  });

  it("8. Genuine bidder conditional requirement → CONDITIONAL", () => {
    const text =
      "If applicable, the bidder must provide a local content certificate issued by the relevant authority.";
    const out = normalizeRequirements([
      {
        category: "administrative",
        description: text,
        mandatory: true,
        evidenceText: text,
        sourcePage: 4,
      },
    ]);
    assert.equal(out.length, 1);
    assert.equal(out[0]!.obligationStrength, "CONDITIONAL");
    assert.equal(out[0]!.mandatory, false);
  });

  it("9. UNKNOWN + obligation wording → UNCERTAIN, never mandatory", () => {
    const text =
      "The bidder shall comply with all site access and safety induction rules published by the contracting authority.";
    assert.equal(classifyRequirementSemanticKind({ description: text }), "UNKNOWN");
    assert.equal(deriveObligationStrength(text, "UNKNOWN"), "INFORMATIONAL");
    const out = normalizeRequirements([
      {
        category: "other",
        description: text,
        mandatory: true,
        evidenceText: text,
        sourcePage: 5,
      },
    ]);
    assert.equal(out.length, 1);
    assert.equal(out[0]!.semanticKind, "UNKNOWN");
    assert.equal(out[0]!.confidence, "UNCERTAIN");
    assert.equal(out[0]!.mandatory, false);
  });

  it("10. Multi-document: clarification does not create a new requirement; distinct obligations stay separate", () => {
    const original =
      "Le soumissionnaire doit fournir une attestation fiscale valide avec le dossier de candidature.";
    const clarification =
      "L'Autorité contractante confirme que l'attestation fiscale doit être datée de moins de trois mois.";
    const other =
      "Le soumissionnaire doit également soumettre une caution provisoire de 2% du montant estimé.";

    const canonical = buildCanonicalRequirements({
      heuristicDrafts: [
        {
          category: "administrative",
          description: original,
          mandatory: true,
          evidenceText: original,
          sourcePage: 1,
          sourceDocument: "instructions.pdf",
        },
        {
          category: "administrative",
          description: clarification,
          mandatory: true,
          evidenceText: clarification,
          sourcePage: 2,
          sourceDocument: "clarifications.pdf",
        },
        {
          category: "administrative",
          description: other,
          mandatory: true,
          evidenceText: other,
          sourcePage: 3,
          sourceDocument: "instructions.pdf",
        },
      ],
    });

    assert.equal(canonical.length, 2);
    assert.ok(canonical.every((r) => !/confirme que/i.test(r.requirement)));
    assert.ok(canonical.some((r) => /attestation fiscale/i.test(r.requirement)));
    assert.ok(canonical.some((r) => /caution provisoire/i.test(r.requirement)));
  });
});

describe("canonical count integrity", () => {
  it("11. Canonical count partition invariant", () => {
    const matrix = [
      row("r1", "The bidder shall submit ISO 9001.", "READY"),
      row("r2", "The bidder shall submit a bid bond.", "VERIFY"),
      row("r3", "The bidder shall hold ISO 14001.", "MISSING"),
      row("r4", "If applicable, the bidder must provide JV docs.", "NOT_APPLICABLE", false),
      row("r5", "The bidder shall provide methodology.", "UNKNOWN"),
    ];
    const summary = buildComplianceSummary(matrix, 0);
    assert.equal(summary.totalRequirements, 5);
    assert.equal(
      (summary.verifiedRequirements ?? 0) +
        (summary.needsVerification ?? 0) +
        (summary.confirmedGaps ?? 0) +
        summary.notApplicable,
      summary.totalRequirements,
    );

    const readiness = {
      score: 40,
      total: 5,
      totalRequirements: 5,
      counts: {
        ready: 1,
        missing: 1,
        verify: 1,
        unknown: 1,
        notApplicable: 1,
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
      recommendation: "Review.",
      disclaimer: "test",
    };

    assert.doesNotThrow(() =>
      assertCanonicalRequirementInvariants({
        canonicalRequirementCount: 5,
        readiness,
        intelligence: {
          complianceMatrix: matrix,
          complianceSummary: summary,
          risks: [],
          contradictions: [],
          clarificationQuestions: [],
          keyBlockers: [],
          decisionContext: "",
          learningSignal: null,
        },
      }),
    );
  });

  it("12–13. Readiness / report / snapshot / API totals share one canonical set", () => {
    const matrix = [
      row("a1", "The bidder must submit a tax clearance certificate.", "VERIFY"),
      row("a2", "The bidder must provide three project references.", "VERIFY"),
      row("a3", "The contractor shall deliver within 90 days.", "READY"),
    ];
    const summary = buildComplianceSummary(matrix, 0);
    const metrics = metricsFromComplianceSummary(summary, matrix.length);
    assert.equal(
      metrics.verifiedRequirements +
        metrics.needsVerification +
        metrics.confirmedGaps +
        metrics.notApplicable,
      metrics.totalRequirements,
    );

    const snap = freezeCanonicalAnalysisSnapshot({
      tenderId: "actor-count",
      packageLabel: "test-pack",
      discoveredFileCount: 2,
      files: [
        {
          fileName: "instructions.pdf",
          processingStatus: "COMPLETED",
          role: "CPS",
          error: null,
        },
        {
          fileName: "clarifications.pdf",
          processingStatus: "COMPLETED",
          role: "OTHER",
          error: null,
        },
      ],
      metadata: {
        title: "Test",
        client: "Authority",
        deadlineIso: null,
        deadlineTimezone: null,
        factsNote: null,
        metadataStatus: "OK",
      },
      requirementIds: matrix.map((m) => m.requirementId),
      summary,
    });

    assert.equal(snap.counts.totalRequirements, 3);
    assert.deepEqual(snap.requirementIds, ["a1", "a2", "a3"]);

    const readiness = {
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
      attention: ["2 mandatory requirements could not be verified."],
      recommendation: "Verify.",
      disclaimer: "test",
    };

    assertCanonicalSnapshotInvariants({
      snapshot: snap,
      canonicalRequirementCount: 3,
      requirementTexts: matrix.map((m) => m.requirement),
      uniqueRequirementIds: matrix.map((m) => m.requirementId),
      matrix,
      summary,
      readiness,
      reportTotal: 3,
      pdfTotal: 3,
      apiTotal: 3,
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
      },
      complianceSummary: summary,
      readiness,
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
    assert.match(readiness.attention[0]!, /mandatory requirement/);
    assert.notEqual(
      readiness.attention[0],
      `${snap.counts.totalRequirements} requirements could not be verified.`,
    );
  });
});
