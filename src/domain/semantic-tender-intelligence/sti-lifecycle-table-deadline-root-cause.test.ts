/**
 * General failure classes: post-award leakage, table/Excel identity explosion,
 * and non-authoritative deadline invention. No buyer/country/filename rules.
 */

import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { buildCanonicalSemanticCandidates } from "./candidates";
import { interpretSemanticStatement } from "./interpret";
import { buildSemanticIdentity, normalizeSemanticSurface } from "./identity";
import { buildTableSemanticContext } from "./table-context";
import { extractTenderDeadlineFromText } from "@/domain/tender-requirements/tender-deadline";
import { extractTenderPackageHeuristic } from "@/services/tender-extraction/requirements-heuristic";
import type { SemanticProvenance } from "./types";

const prov: SemanticProvenance = {
  sourceDocument: "pack.pdf",
  sourcePage: 1,
  sourceSection: null,
  sourceCell: null,
  versionLabel: null,
  locator: null,
};

function interp(text: string, extra?: Partial<Parameters<typeof interpretSemanticStatement>[0]>) {
  return interpretSemanticStatement({
    text,
    provenance: { ...prov, ...extra?.provenance },
    context: extra?.context ?? null,
  });
}

describe("root cause — post-award / contract-execution must not enter bidder stage", () => {
  it("bidder delivery after signing a purchase instrument is excluded", () => {
    const s = interp(
      "The Bidder shall deliver the goods within two months after signing the purchase order.",
    );
    assert.equal(s.admitToCanonical, false);
    assert.match(String(s.procurementPhase), /POST_AWARD|CONTRACT_EXECUTION|DELIVERY/);
    assert.equal(s.clausePurpose, "POST_AWARD_OBLIGATION");
    assert.ok(s.exclusionCode);
  });

  it("delivery after a call-off / PO instrument is excluded without inventing the buyer", () => {
    for (const text of [
      "The Bidder shall deliver the goods after signing the call-off order.",
      "The Supplier shall commence delivery after receipt of the PO.",
    ]) {
      const s = interp(text);
      assert.equal(s.admitToCanonical, false, text);
      assert.notEqual(s.clausePurpose, "BIDDER_OBLIGATION", text);
    }
  });

  it("site transportation / offloading / placement is contract execution", () => {
    const s = interp(
      "The supplier shall be responsible for transportation, offloading, and placement at the specified rooms or areas.",
    );
    assert.equal(s.admitToCanonical, false);
    assert.match(String(s.procurementPhase), /POST_AWARD|CONTRACT_EXECUTION|DELIVERY/);
    assert.equal(s.clausePurpose, "POST_AWARD_OBLIGATION");
  });

  it("passive repair/replacement of defective items is execution, not a bid duty", () => {
    const s = interp(
      "Any non-compliant or defective items shall be repaired or replaced at the supplier's expense.",
    );
    assert.equal(s.admitToCanonical, false);
    assert.equal(s.clausePurpose, "POST_AWARD_OBLIGATION");
  });

  it("performance artefacts (delivery notes / warranty certificates) are not bid documents", () => {
    const s = interp(
      "The supplier shall submit delivery notes, installation completion reports, and warranty certificates.",
    );
    assert.equal(s.admitToCanonical, false);
    assert.match(
      String(s.procurementPhase),
      /POST_AWARD|CONTRACT_EXECUTION|DELIVERY|DELIVERY_IMPLEMENTATION|INSTALLATION_IMPLEMENTATION/,
    );
  });

  it("supplier KPI during the contract period is excluded", () => {
    const s = interp(
      "The Supplier shall achieve a delivery KPI of 95 percent during the contract period.",
    );
    assert.equal(s.admitToCanonical, false);
    assert.equal(s.clausePurpose, "POST_AWARD_OBLIGATION");
  });

  it("payment administration after performance artefacts is excluded", () => {
    const s = interp(
      "The supplier shall submit invoices after delivery. Payment shall be processed after receipt of the delivery notes.",
    );
    assert.equal(s.admitToCanonical, false);
    assert.match(String(s.clausePurpose), /POST_AWARD|INFORMATIONAL|PROCEDURAL/);
  });

  it("bid-disclosed payment terms remain commercial, not execution", () => {
    const s = interp("Payment shall be made within 30 days of invoice acceptance.");
    assert.equal(s.admitToCanonical, true);
    assert.notEqual(s.clausePurpose, "POST_AWARD_OBLIGATION");
  });

  it("genuine pre-award commitments remain admissible", () => {
    const samples = [
      "The bidder shall include an installation and commissioning methodology in the Technical Proposal.",
      "The Bidder shall submit a delivery schedule with its bid.",
      "The tenderer shall provide bid security with its tender.",
    ];
    for (const text of samples) {
      const s = interp(text);
      assert.equal(s.admitToCanonical, true, text);
      assert.notEqual(s.clausePurpose, "POST_AWARD_OBLIGATION", text);
    }
  });

  it("UNKNOWN/ambiguous meaning is not promoted to BIDDER", () => {
    const s = interp("Items shall be handled as specified.");
    assert.notEqual(s.actor, "BIDDER");
    assert.equal(s.admitToCanonical, false);
  });
});

describe("root cause — table/Excel representations share one semantic identity", () => {
  it("response-column chrome never admits", () => {
    for (const text of ["☐ Yes ☐ No", "Insert details of goods offered, including specifications"]) {
      const s = interp(text, {
        context: {
          table: buildTableSemanticContext({
            text,
            columnHeader: "Response",
            rowLabel: "1",
          }),
        },
      });
      assert.equal(s.admitToCanonical, false, text);
    }
  });

  it("heading, row, and cell of the same duty collapse to one candidate", () => {
    const duty =
      "The Bidder shall submit ISO 9001 certification with the proposal.";
    const { candidates, rejected } = buildCanonicalSemanticCandidates([
      {
        description: "Requirement",
        sourceDocument: "schedule.xlsx",
        isTableHeader: true,
        columnHeader: "Requirement",
      },
      {
        description: `Requirement\t${duty}\t☐ Yes ☐ No\tInsert details`,
        sourceDocument: "schedule.xlsx",
        columnHeader: "Requirement",
        rowLabel: "ISO",
        sourceCell: "B4",
      },
      {
        description: duty,
        sourceDocument: "itb.pdf",
        section: "Returnables",
      },
      {
        description: "☐ Yes ☐ No",
        sourceDocument: "schedule.xlsx",
        columnHeader: "Compliance",
      },
    ]);
    const admitted = candidates.filter((c) => /ISO 9001/i.test(c.fullRequirementText));
    assert.equal(admitted.length, 1);
    assert.ok(rejected.some((r) => r.exclusionCode === "EXCLUDED_TABLE_HEADER" || r.tableContext?.isTableHeader));
    const a = buildSemanticIdentity({
      text: `${duty} [Row: ISO; Column: Requirement] ☐ Yes ☐ No Insert details`,
      actor: "BIDDER",
      contentKind: "REQUIRED_SUBMISSION_DOCUMENT",
    });
    const b = buildSemanticIdentity({
      text: duty,
      actor: "BIDDER",
      contentKind: "REQUIRED_SUBMISSION_DOCUMENT",
    });
    assert.equal(a, b);
    assert.ok(normalizeSemanticSurface("1 The duty ☐ Yes Insert details").includes("duty"));
  });

  it("decorative prefixes and numbering share one identity; quantity/duration stay distinct", () => {
    const duty = "Vendors shall provide relevant technical brochure with the offer.";
    const a = buildSemanticIdentity({
      text: duty,
      actor: "BIDDER",
      contentKind: "REQUIRED_SUBMISSION_DOCUMENT",
    });
    const b = buildSemanticIdentity({
      text: `– Important : ${duty}`,
      actor: "BIDDER",
      contentKind: "REQUIRED_SUBMISSION_DOCUMENT",
    });
    const c = buildSemanticIdentity({
      text: `Note: ${duty}`,
      actor: "BIDDER",
      contentKind: "REQUIRED_SUBMISSION_DOCUMENT",
    });
    assert.equal(a, b);
    assert.equal(a, c);
    const five = buildSemanticIdentity({
      text: "The bidder shall supply 5 units of the listed item.",
      actor: "BIDDER",
      contentKind: "REQUIRED_SUBMISSION_DOCUMENT",
    });
    const ten = buildSemanticIdentity({
      text: "The bidder shall supply 10 units of the listed item.",
      actor: "BIDDER",
      contentKind: "REQUIRED_SUBMISSION_DOCUMENT",
    });
    assert.notEqual(five, ten);
    const thirty = buildSemanticIdentity({
      text: "Bid validity shall be 30 days from the submission deadline.",
      actor: "BIDDER",
      contentKind: "COMMERCIAL_TERM",
    });
    const ninety = buildSemanticIdentity({
      text: "Bid validity shall be 90 days from the submission deadline.",
      actor: "BIDDER",
      contentKind: "COMMERCIAL_TERM",
    });
    assert.notEqual(thirty, ninety);
  });
});

describe("root cause — tender deadline requires authoritative evidence", () => {
  it("opening date alone stays UNKNOWN", () => {
    const parsed = extractTenderDeadlineFromText(
      "Procuring entity: Test authority\nOpening 21 September 2026 at 15:00\n",
      null,
    );
    assert.equal(parsed.deadlineIso, null);
    assert.equal(parsed.deadlineTimezone, null);
    assert.ok(parsed.reason);
  });

  it("delivery date is not a submission deadline", () => {
    const parsed = extractTenderDeadlineFromText(
      "Goods shall be delivered no later than 15 October 2026 at 10:00\n",
      null,
    );
    assert.equal(parsed.deadlineIso, null);
  });

  it("explicit submission deadline is preserved; timezone stays UNKNOWN unless stated", () => {
    const parsed = extractTenderDeadlineFromText(
      "Submission deadline: 15 October 2026 at 10:30\n",
      "Morocco",
    );
    assert.equal(parsed.deadlineIso, "2026-10-15T10:30:00");
    assert.equal(parsed.deadlineTimezone, null);
    const pack = extractTenderPackageHeuristic({
      text: "Submission deadline: 15 October 2026 at 10:30",
      fileName: "notice.pdf",
    });
    assert.equal(pack.deadlineTimezone, null);
  });

  it("bid submission due date with compact time and stated timezone is preserved", () => {
    const parsed = extractTenderDeadlineFromText(
      "Bid submission due date and time 27.03.2026 till 1430 hrs IST\n",
      null,
    );
    assert.equal(parsed.deadlineIso, "2026-03-27T14:30:00+05:30");
    assert.equal(parsed.deadlineTimezone, "Asia/Kolkata");
    assert.equal(parsed.localHour, 14);
    assert.equal(parsed.localMinute, 30);
  });
});
