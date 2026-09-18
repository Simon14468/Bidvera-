/**
 * Canonical package quality — heading filter, continuation, obligation vs procedure,
 * and multi-document metadata aggregation.
 */

import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  buildCanonicalRequirements,
  isNonRequirementText,
  isRealBidderObligation,
  isStructuralHeading,
} from "@/domain/tender-requirements";
import { isProcuringEntityProcedure } from "@/domain/tender-requirements/obligation";
import { extractExplicitTimezone } from "@/domain/tender-requirements/tender-deadline";
import {
  extractTenderPackageFromParts,
  extractTenderPackageHeuristic,
  isIncompleteRequirementTail,
  joinSoftWrappedPdfLines,
} from "@/services/tender-extraction/requirements-heuristic";
import { aggregatePackageMetadata } from "@/domain/tender-package/package-metadata";

function canonicalFromText(text: string, fileName = "tender.pdf") {
  const pack = extractTenderPackageHeuristic({ text, fileName });
  return buildCanonicalRequirements({
    heuristicDrafts: pack.requirements,
    sourceDocument: fileName,
  });
}

describe("Task 2 — heading filtering", () => {
  it("A. heading false positive: technical noun titles are not requirements", () => {
    const samples = [
      "SUPPLY OF MDPE PIPE FITTINGS, VALVES AND TRANSITION FITTINGS",
      "A. PRELIMINARY EVALUATION MANDATORY DOCUMENTS",
      "TECHNICAL SPECIFICATIONS",
      "LOT 1",
      "VALUATION CRITERIA",
    ];
    for (const s of samples) {
      assert.equal(isStructuralHeading(s), true, s);
      assert.equal(isRealBidderObligation(s), false, s);
      assert.equal(isNonRequirementText(s), true, s);
    }
    const pack = extractTenderPackageHeuristic({
      text: samples.join("\n"),
      fileName: "headings.pdf",
    });
    const canonical = buildCanonicalRequirements({
      heuristicDrafts: pack.requirements,
      sourceDocument: "headings.pdf",
    });
    for (const s of samples) {
      assert.ok(
        !canonical.some((r) => r.requirement.replace(/\s+/g, " ").trim() === s),
        `heading leaked: ${s}`,
      );
    }
  });

  it("B. section title false positive", () => {
    assert.equal(isStructuralHeading("3. Technical Specifications"), true);
    assert.equal(isRealBidderObligation("6. Evaluation Criteria"), false);
  });

  it("C. genuine bidder obligation survives heading-shaped verbs", () => {
    const text =
      "Any exception must be highlighted by the Bidder at bid stage. The bidder shall supply MDPE fittings that comply with the approved drawings.";
    const canonical = canonicalFromText(text);
    assert.ok(canonical.some((r) => /exception must be highlighted by the Bidder/i.test(r.requirement)));
    assert.ok(canonical.some((r) => /shall supply MDPE/i.test(r.requirement)));
  });
});

describe("Task 2 — bidder vs procedural text", () => {
  it("D. procedural entity instruction excluded", () => {
    const procedural = "The Procuring Entity shall publish responses to all clarification requests on the portal.";
    assert.equal(isProcuringEntityProcedure(procedural), true);
    assert.equal(isRealBidderObligation(procedural), false);
    const canonical = canonicalFromText(procedural);
    assert.ok(!canonical.some((r) => /shall publish responses/i.test(r.requirement)));
  });

  it("C. bidder must/shall remains an obligation", () => {
    const keep = "Any exception must be highlighted by the Bidder at bid stage.";
    assert.equal(isProcuringEntityProcedure(keep), false);
    assert.equal(isRealBidderObligation(keep), true);
  });
});

describe("Task 2 — requirement continuation", () => {
  it("E. technical sentence split across page", () => {
    const text = `
The vendor shall supply API 5L GR.B line pipe that SHALL BE
--- Page 9 (pdf-parse) ---
used for high-pressure gas distribution only.
`;
    const joined = joinSoftWrappedPdfLines(text);
    assert.match(joined, /SHALL BE used for high-pressure/i);
    const canonical = canonicalFromText(text);
    assert.ok(canonical.some((r) => /API 5L/i.test(r.requirement) && /high-pressure/i.test(r.requirement)));
    assert.ok(!canonical.some((r) => /SHALL BE\s*$/i.test(r.requirement.trim())));
  });

  it("F. table-wrapped requirement reconstruction", () => {
    const text = `
Technical Schedule
Item | Specification
1 | STAINLESS STEEL SHALL
be grade 316L and the vendor shall be completely
responsible for mill certificates.
`;
    const joined = joinSoftWrappedPdfLines(text);
    assert.match(joined, /STAINLESS STEEL SHALL be grade 316L/i);
    assert.match(joined, /vendor shall be completely responsible/i);
    const canonical = canonicalFromText(text, "table-wrap.pdf");
    assert.ok(
      canonical.some(
        (r) =>
          /316L/i.test(r.requirement) ||
          /mill certificates/i.test(r.requirement) ||
          /stainless steel shall be grade/i.test(r.requirement),
      ),
    );
    assert.ok(!canonical.some((r) => /STAINLESS STEEL SHALL\s*$/i.test(r.requirement.trim())));
    assert.ok(!canonical.some((r) => /VENDOR SHALL BE COMPLETELY\s*$/i.test(r.requirement.trim())));
  });

  it("numbered continuation, OCR line, hyphenation, long multi-line", () => {
    assert.equal(isIncompleteRequirementTail("VENDOR SHALL BE COMPLETELY"), true);
    const numbered = joinSoftWrappedPdfLines(
      "4. The contractor shall maintain\nspares for 24 months after commissioning.",
    );
    assert.match(numbered, /maintain spares for 24 months/i);

    const ocr = joinSoftWrappedPdfLines("The bidder shall cert-\nify ISO 9001 compliance.");
    assert.match(ocr, /certify ISO 9001/i);

    const long = canonicalFromText(`
The Bidder shall submit with the Technical Proposal a mobilisation and as-built documentation
plan covering hardware installation, software configuration, training of operator staff,
and submission of as-built documentation within sixty (60) calendar days of acceptance.
`);
    assert.ok(long.some((r) => /as-built documentation/i.test(r.requirement) && /sixty/i.test(r.requirement)));
  });
});

describe("Task 2 — package metadata aggregation", () => {
  it("G/I/M. metadata found in later documents including deadline", () => {
    const pack = extractTenderPackageFromParts(
      [
        { fileName: "Doc1-cover.pdf", text: "Cover sheet. No buyer named.\nLOT 1" },
        { fileName: "Doc2-admin.pdf", text: "Administrative conditions only." },
        {
          fileName: "Doc4-notice.pdf",
          text: `
Procuring entity: Indraprastha Gas Ltd
Objet: NCB for IP phones and switches
Submission deadline: 20 October 2026 at 15:00 IST
Currency INR
Publication date: 01 September 2026
Place of performance: Delhi, India
Corrigendum 1 applies to this notice.
`,
        },
        { fileName: "Doc5-spec.pdf", text: "The bidder shall submit a manufacturer authorization form." },
      ],
      "igl-like-package",
    );
    assert.match(pack.client ?? "", /Indraprastha Gas/i);
    assert.equal(pack.packageMetadata?.buyer.status, "OK");
    assert.match(pack.packageMetadata?.buyer.candidates[0]?.sourceFile ?? "", /Doc4/);
    assert.ok(pack.deadlineIso);
    assert.match(pack.deadlineIso!, /2026-10-20/);
    assert.match(pack.deadlineIso!, /15:00/);
    assert.equal(pack.deadlineTimezone, "Asia/Kolkata");
    assert.equal(pack.packageMetadata?.timezone.status, "OK");
    const canonical = buildCanonicalRequirements({
      heuristicDrafts: pack.requirements,
      sourceDocument: "igl-like-package",
    });
    assert.ok(canonical.some((r) => /manufacturer authorization/i.test(r.requirement)));
    assert.ok(canonical.some((r) => /Doc5-spec\.pdf/i.test(r.sourceDocument ?? "")));
  });

  it("H. notice buyer outranks a labelled contract-form restatement", () => {
    const pack = extractTenderPackageFromParts(
      [
        { fileName: "notice.pdf", text: "Tender notice\nProcuring entity: Alpha Municipal Council\nSubmission deadline: 1 May 2026 at 10:00" },
        { fileName: "cps.pdf", text: "Special conditions of contract\nContracting authority: Beta Water Board\nThe bidder must submit ISO 9001." },
      ],
      "conflict-pack",
    );
    assert.equal(pack.packageMetadata?.buyer.status, "OK");
    assert.match(pack.client ?? "", /Alpha Municipal Council/i);
  });

  it("H2. two notices with different labelled buyers stay CONFLICT", () => {
    const pack = extractTenderPackageFromParts(
      [
        { fileName: "notice-a.pdf", text: "Tender notice\nProcuring entity: Alpha Municipal Council\nSubmission deadline: 1 May 2026 at 10:00" },
        { fileName: "notice-b.pdf", text: "Tender notice\nProcuring entity: Beta Water Board\nSubmission deadline: 1 May 2026 at 10:00" },
      ],
      "two-notice-conflict",
    );
    assert.equal(pack.packageMetadata?.buyer.status, "CONFLICT");
    assert.equal(pack.client, null);
    assert.ok((pack.packageIdentity?.buyer.candidates.length ?? 0) >= 2);
  });

  it("J. timezone preservation — UNKNOWN when absent, explicit when present", () => {
    assert.equal(extractExplicitTimezone("Opening 21 September 2026 at 15:00"), null);
    const unknown = extractTenderPackageHeuristic({
      text: "Procuring entity: Test authority, Morocco\nOpening 21 September 2026 at 15:00",
      fileName: "opening-only.pdf",
    });
    assert.equal(unknown.deadlineTimezone, null);
    assert.equal(unknown.deadlineIso, null, "opening date is not a submission deadline");
    assert.ok(unknown.deadlineUnknownReason);

    const explicit = extractTenderPackageHeuristic({
      text: "Submission deadline: 21 September 2026 at 15:00 IST",
      fileName: "ist.pdf",
    });
    assert.equal(explicit.deadlineTimezone, "Asia/Kolkata");
    assert.match(explicit.deadlineIso ?? "", /\+05:30$/);
  });

  it("K. duplicate requirement across documents is merged with provenance", () => {
    const pack = extractTenderPackageFromParts(
      [
        {
          fileName: "rfp.pdf",
          text: "The bidder shall submit a bid bond of 2% of the tender value with the offer.",
        },
        {
          fileName: "annex.pdf",
          text: "The bidder shall submit a bid bond of 2% of the tender value with the offer.",
        },
      ],
      "dup-pack",
    );
    const canonical = buildCanonicalRequirements({
      heuristicDrafts: pack.requirements,
    });
    const bonds = canonical.filter((r) => /bid bond/i.test(r.requirement));
    assert.equal(bonds.length, 1);
    assert.match(bonds[0]!.sourceDocument ?? "", /rfp\.pdf/);
    assert.match(bonds[0]!.sourceDocument ?? "", /annex\.pdf/);
  });

  it("L. corrigendum provenance", () => {
    const pack = extractTenderPackageFromParts(
      [
        { fileName: "Main.pdf", text: "Procuring entity: Gamma Port Authority\nThe bidder must provide a warranty of 24 months." },
        {
          fileName: "Corrigendum_1.pdf",
          text: "Corrigendum 1: The bidder must provide a warranty of 36 months from commissioning.",
        },
      ],
      "corrigendum-pack",
    );
    assert.equal(pack.packageMetadata?.corrigenda.status, "OK");
    assert.match(pack.packageMetadata?.corrigenda.value ?? "", /Corrigendum/i);
    assert.ok(
      pack.packageMetadata?.corrigenda.candidates.some((c) => /Corrigendum_1/i.test(c.sourceFile)),
    );
  });

  it("aggregatePackageMetadata does not invent missing buyer", () => {
    const meta = aggregatePackageMetadata([
      {
        fileName: "a.pdf",
        text: "Scope of work only.",
        extraction: {
          title: null,
          client: null,
          region: null,
          deadlineIso: null,
          deadlineTimezone: null,
          deadlineEvidence: null,
          deadlineLocalHour: null,
          deadlineLocalMinute: null,
          estimatedValue: null,
          reference: null,
        },
      },
    ]);
    assert.equal(meta.buyer.status, "UNKNOWN");
    assert.equal(meta.buyer.value, null);
  });
});
