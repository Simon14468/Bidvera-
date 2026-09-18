/**
 * Canonical obligation identity — one fingerprint, one persisted row.
 * Proves last-mile collapse uses the same identity as the completion invariant.
 */

import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { assertAnalysisReadyForCompletion } from "./final-consistency";
import {
  canonicalObligationFingerprint,
  mergeNormalizedRequirements,
  obligationFingerprint,
} from "./semantic-dedupe";
import type { NormalizedRequirement } from "./types";

function req(
  requirement: string,
  extra: Partial<NormalizedRequirement> = {},
): NormalizedRequirement {
  return {
    category: "MANDATORY_ADMINISTRATIVE",
    semanticKind: "REQUIRED_DOCUMENT",
    obligationStrength: "MANDATORY",
    title: "Req",
    requirement,
    mandatory: true,
    confidence: "MEDIUM",
    ...extra,
  };
}

function fingerprints(rows: NormalizedRequirement[]): string[] {
  return rows.map((r) => canonicalObligationFingerprint(r));
}

function uniqueCount(rows: NormalizedRequirement[]): number {
  return new Set(fingerprints(rows)).size;
}

describe("canonical obligation identity — collapse and distinctions", () => {
  it("exact duplicate → 1 canonical row", () => {
    const text = "The bidder shall submit a tax clearance certificate with the dossier.";
    const merged = mergeNormalizedRequirements([
      req(text, { page: 2, sourceDocument: "a.pdf" }),
      req(text, { page: 2, sourceDocument: "a.pdf" }),
    ]);
    assert.equal(merged.length, 1);
    assert.equal(uniqueCount(merged), 1);
  });

  it("decorative-prefix duplicate → 1 canonical row", () => {
    const merged = mergeNormalizedRequirements([
      req("– Important : Vendors shall provide relevant technical brochure to facilitate evaluation", {
        stiActor: "SUPPLIER",
        stiProcurementPhase: "EVALUATION",
      }),
      req("Vendors shall provide relevant technical brochure to facilitate evaluation", {
        stiActor: "BIDDER",
        stiProcurementPhase: "BID_SUBMISSION",
      }),
    ]);
    assert.equal(merged.length, 1);
    assert.equal(uniqueCount(merged), 1);
    assert.ok(merged[0]!.sourceDocuments ?? merged[0]!.sourceDocument);
  });

  it("same text + same semantic facets → 1", () => {
    const text = "The Bidder shall supply 5 units of the equipment with the bid.";
    const merged = mergeNormalizedRequirements([
      req(text, { stiActor: "BIDDER", stiProcurementPhase: "BID_SUBMISSION" }),
      req(text, { stiActor: "SUPPLIER", stiProcurementPhase: "EVALUATION" }),
    ]);
    assert.equal(merged.length, 1);
  });

  it("same text + different quantity → 2", () => {
    const merged = mergeNormalizedRequirements([
      req("The Bidder shall supply 5 units of the equipment with the bid."),
      req("The Bidder shall supply 10 units of the equipment with the bid."),
    ]);
    assert.equal(merged.length, 2);
  });

  it("same text + different duration → 2", () => {
    const merged = mergeNormalizedRequirements([
      req("The offer shall remain valid for 30 days from the bid closing date."),
      req("The offer shall remain valid for 90 days from the bid closing date."),
    ]);
    assert.equal(merged.length, 2);
    assert.notEqual(
      obligationFingerprint(
        "The offer shall remain valid for 30 days from the bid closing date.",
        "CONTRACTUAL",
      ),
      obligationFingerprint(
        "The offer shall remain valid for 90 days from the bid closing date.",
        "CONTRACTUAL",
      ),
    );
  });

  it("same text + different currency → 2", () => {
    const merged = mergeNormalizedRequirements([
      req("The bidder shall provide bid security of USD 10,000 with the offer.", {
        category: "MANDATORY_ADMINISTRATIVE",
        semanticKind: "GUARANTEE_SECURITY_REQUIREMENT",
      }),
      req("The bidder shall provide bid security of EUR 10,000 with the offer.", {
        category: "MANDATORY_ADMINISTRATIVE",
        semanticKind: "GUARANTEE_SECURITY_REQUIREMENT",
      }),
    ]);
    assert.equal(merged.length, 2);
  });

  it("same obligation + different lot applicability preserves both lots", () => {
    const text = "The bidder must submit a tax clearance certificate with the dossier.";
    const merged = mergeNormalizedRequirements([
      req(text, { lotApplicability: "LOT_1", sourceSection: "Lot 1" }),
      req(text, { lotApplicability: "LOT_2", sourceSection: "Lot 2" }),
    ]);
    assert.equal(merged.length, 1);
    assert.ok(/LOT_1/i.test(merged[0]!.lotApplicability ?? ""));
    assert.ok(/LOT_2/i.test(merged[0]!.lotApplicability ?? ""));
    assert.notEqual(merged[0]!.lotApplicability, "ALL_LOTS");
  });

  it("same fingerprint with complementary provenance → 1 row with merged provenance", () => {
    const text = "The bidder shall submit a signed Form C with the bid.";
    const merged = mergeNormalizedRequirements([
      req(text, {
        page: 3,
        sourceDocument: "section-iii.docx",
        stiProvenance: [
          {
            sourceDocument: "section-iii.docx",
            sourcePage: 3,
            sourceSection: "Form C",
            sourceCell: null,
            versionLabel: null,
          },
        ],
      }),
      req(text, {
        page: 11,
        sourceDocument: "schedule.pdf",
        stiProvenance: [
          {
            sourceDocument: "schedule.pdf",
            sourcePage: 11,
            sourceSection: "Returnables",
            sourceCell: null,
            versionLabel: null,
          },
        ],
      }),
    ]);
    assert.equal(merged.length, 1);
    assert.ok((merged[0]!.sourcePages ?? []).includes(3));
    assert.ok((merged[0]!.sourcePages ?? []).includes(11));
    assert.equal(merged[0]!.stiProvenance?.length, 2);
    assert.match(merged[0]!.sourceDocument ?? "", /section-iii/i);
    assert.match(merged[0]!.sourceDocument ?? "", /schedule/i);
  });

  it("conflicting substantive records → REVIEW, never silent merge", () => {
    const a = req("The bidder shall submit a tax clearance certificate with 15% withholding stated.");
    const b = req("The bidder shall submit a tax clearance certificate with 25% withholding stated.");
    const merged = mergeNormalizedRequirements([a, b]);
    assert.equal(merged.length, 2);
    assert.equal(uniqueCount(merged), 2);
    assert.ok(merged.every((r) => r.confidence === "UNCERTAIN"));
    assert.ok(merged.every((r) => /REVIEW/i.test(r.verificationReason ?? "")));
    assert.ok(merged.every((r) => r.stiSituation?.uncertaintyPreserved === true));
  });

  it("pre-award vs post-award lifecycle stays distinct", () => {
    const text = "The Bidder shall deliver within 30 days.";
    const merged = mergeNormalizedRequirements([
      req(text, {
        category: "CONTRACTUAL",
        semanticKind: "CONTRACTUAL_OBLIGATION",
        stiProcurementPhase: "BID_SUBMISSION",
      }),
      req(text, {
        category: "CONTRACTUAL",
        semanticKind: "CONTRACTUAL_OBLIGATION",
        stiProcurementPhase: "DELIVERY",
      }),
    ]);
    assert.equal(merged.length, 2);
  });

  it("EVALUATION and BID_SUBMISSION of the same bidder duty collapse", () => {
    const text = "The bidder shall complete the comparative data tables with the offer.";
    const a = obligationFingerprint(text, "MANDATORY_ADMINISTRATIVE", {
      procurementPhase: "EVALUATION",
      actor: "SUPPLIER",
    });
    const b = obligationFingerprint(text, "MANDATORY_ADMINISTRATIVE", {
      procurementPhase: "BID_SUBMISSION",
      actor: "BIDDER",
    });
    const c = obligationFingerprint(text, "MANDATORY_ADMINISTRATIVE");
    assert.equal(a, b);
    assert.equal(a, c);
  });

  it("repeated execution → identical canonical output", () => {
    const input = [
      req("Important: The bidder shall submit ISO 9001 certification.", {
        stiActor: "BIDDER",
        page: 1,
        sourceDocument: "a.pdf",
      }),
      req("The bidder shall submit ISO 9001 certification.", {
        stiActor: "SUPPLIER",
        page: 4,
        sourceDocument: "b.pdf",
      }),
      req("The offer shall remain valid for 90 days from the bid closing date.", {
        category: "CONTRACTUAL",
        semanticKind: "CONTRACTUAL_OBLIGATION",
      }),
    ];
    const first = mergeNormalizedRequirements(input);
    const second = mergeNormalizedRequirements([...input].reverse());
    const third = mergeNormalizedRequirements(first);
    assert.deepEqual(fingerprints(first).sort(), fingerprints(second).sort());
    assert.deepEqual(fingerprints(first).sort(), fingerprints(third).sort());
    assert.equal(first.length, second.length);
    assert.equal(uniqueCount(first), first.length);
  });

  it("concurrent/repeated canonical build does not persist duplicate identities", async () => {
    const input = [
      req("The bidder shall submit a company registration certificate."),
      req("The bidder shall submit a company registration certificate.", {
        stiProcurementPhase: "EVALUATION",
        page: 8,
      }),
    ];
    const [a, b] = await Promise.all([
      Promise.resolve(mergeNormalizedRequirements(input)),
      Promise.resolve(mergeNormalizedRequirements([...input].reverse())),
    ]);
    assert.equal(a.length, 1);
    assert.equal(b.length, 1);
    assert.equal(canonicalObligationFingerprint(a[0]!), canonicalObligationFingerprint(b[0]!));
  });

  it("completion invariant uses the same fingerprint and stays armed", () => {
    const collapsed = mergeNormalizedRequirements([
      req("Note: The bidder shall provide a signed Form D with the bid.", {
        stiActor: "SUPPLIER",
        stiProcurementPhase: "EVALUATION",
      }),
      req("The bidder shall provide a signed Form D with the bid.", {
        stiActor: "BIDDER",
        stiProcurementPhase: "BID_SUBMISSION",
      }),
    ]);
    assert.equal(collapsed.length, 1);
    const intelligence = {
      complianceMatrix: collapsed.map((r, i) => ({
        id: `req-${i + 1}`,
        requirement: r.requirement,
        requirementType: r.category,
        mandatory: r.mandatory,
        priority: "HIGH",
        status: "VERIFY",
        companyFit: null,
        sourceDocument: null,
        pageNumber: null,
        section: null,
        evidence: null,
        tenderSource: null,
        companyEvidence: null,
        companyEvidenceMessage: null,
        notes: null,
        sourceBasis: "DIRECT_SOURCE",
        sourceLocated: true,
        evidenceId: null,
        risk: null,
        requiredAction: null,
      })),
      complianceSummary: {
        totalRequirements: 1,
        matched: 0,
        missing: 0,
        uncertain: 1,
        failed: 0,
      },
      risks: [],
    };
    assert.doesNotThrow(() =>
      assertAnalysisReadyForCompletion({
        requirements: collapsed,
        intelligence: intelligence as never,
      }),
    );

    const forked = [
      ...collapsed,
      req("The bidder shall provide a signed Form D with the bid.", {
        stiActor: "SUPPLIER",
        stiProcurementPhase: "EVALUATION",
      }),
    ];
    assert.throws(
      () =>
        assertAnalysisReadyForCompletion({
          requirements: forked,
          intelligence: {
            ...intelligence,
            complianceMatrix: forked.map((r, i) => ({
              ...intelligence.complianceMatrix[0]!,
              id: `req-${i + 1}`,
              requirement: r.requirement,
            })),
            complianceSummary: { ...intelligence.complianceSummary, totalRequirements: 2 },
          } as never,
        }),
      /Duplicate obligation fingerprints/,
    );
  });
});
