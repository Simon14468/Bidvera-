/**
 * Package identity — metadata, roles, and deadline authority.
 * General adversarial cases only. No tender/country/filename-only patches.
 */

import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { extractTenderDeadlineFromText } from "@/domain/tender-requirements/tender-deadline";
import { extractTenderPackageFromParts } from "@/services/tender-extraction/requirements-heuristic";
import { mapPackageDocumentRole } from "@/domain/semantic-tender-intelligence/document-context";
import {
  classifyPackageDocumentIdentity,
  resolvePackageIdentity,
  identityRoleToStiString,
} from "./index";

describe("package identity — metadata authority", () => {
  it("Q&A vendor names do not pollute or CONFLICT a labelled notice buyer", () => {
    const identity = resolvePackageIdentity([
      {
        fileName: "notice.pdf",
        text: "Tender notice\nProcuring entity: Alpha Municipal Council\nSubmission deadline: 15 May 2026 at 10:00",
        extraction: {
          title: null,
          client: "Alpha Municipal Council",
          deadlineIso: "2026-05-15T10:00:00",
          deadlineTimezone: null,
          deadlineEvidence: "Submission deadline: 15 May 2026 at 10:00",
          deadlineLocalHour: 10,
          deadlineLocalMinute: 0,
          deadlineUnknownReason: null,
          estimatedValue: null,
          reference: null,
        },
      },
      {
        fileName: "qa.pdf",
        text: "Question: Can Acme Construction Ltd attend?\nAnswer: Yes. Contact Meridian Supplies LLC for samples.",
        extraction: {
          title: null,
          client: "Acme Construction Ltd",
          deadlineIso: null,
          deadlineTimezone: null,
          deadlineEvidence: null,
          deadlineLocalHour: null,
          deadlineLocalMinute: null,
          deadlineUnknownReason: null,
          estimatedValue: null,
          reference: null,
        },
      },
    ]);
    assert.equal(identity.buyer.status, "OK");
    assert.match(identity.buyer.value ?? "", /Alpha Municipal Council/);
    assert.equal(identity.documents.find((d) => d.fileName === "qa.pdf")?.role, "Q_AND_A");
  });

  it("pre-bid minutes and sample-contract parties do not override notice buyer", () => {
    const pack = extractTenderPackageFromParts(
      [
        {
          fileName: "notice.pdf",
          text: "Tender notice\nProcuring entity: Harbour Port Authority\nObjet: Supply of office furniture\nSubmission deadline: 2 June 2026 at 12:00",
        },
        {
          fileName: "prebid.pdf",
          text: "Pre-bid meeting minutes\nAttendees: Northwind Traders Ltd, Contoso GmbH\nThe contracting authority answered questions.",
        },
        {
          fileName: "sample-contract.pdf",
          text: "Sample contract\nThis contract is made between Northwind Traders Ltd and the Supplier.",
        },
      ],
      "mixed-pack",
    );
    assert.equal(pack.packageIdentity?.buyer.status, "OK");
    assert.match(pack.client ?? "", /Harbour Port Authority/);
    assert.equal(
      pack.packageIdentity?.documents.find((d) => d.fileName === "prebid.pdf")?.role,
      "PREBID_MATERIAL",
    );
    assert.equal(
      pack.packageIdentity?.documents.find((d) => d.fileName === "sample-contract.pdf")?.role,
      "SAMPLE_CONTRACT",
    );
  });

  it("template placeholders are not accepted as buyer", () => {
    const identity = resolvePackageIdentity([
      {
        fileName: "form.pdf",
        text: "Instructions to Bidders\nProcuring entity: [Insert name of procuring entity]",
        extraction: {
          title: null,
          client: "[Insert name of procuring entity]",
          deadlineIso: null,
          deadlineTimezone: null,
          deadlineEvidence: null,
          deadlineLocalHour: null,
          deadlineLocalMinute: null,
          deadlineUnknownReason: null,
          estimatedValue: null,
          reference: null,
        },
      },
    ]);
    assert.notEqual(identity.buyer.status, "OK");
    assert.equal(identity.buyer.value, null);
  });

  it("truncated labelled fragments are INCOMPLETE, not authoritative OK", () => {
    const identity = resolvePackageIdentity([
      {
        fileName: "notice.pdf",
        text: "Tender notice\nProcuring entity: Al",
        truncated: true,
        extraction: {
          title: null,
          client: "Al",
          deadlineIso: null,
          deadlineTimezone: null,
          deadlineEvidence: null,
          deadlineLocalHour: null,
          deadlineLocalMinute: null,
          deadlineUnknownReason: null,
          estimatedValue: null,
          reference: null,
        },
      },
    ]);
    assert.equal(identity.buyer.status, "INCOMPLETE");
    assert.equal(identity.buyer.value, null);
  });

  it("two equal-authority labelled buyers stay CONFLICT with both sources", () => {
    const identity = resolvePackageIdentity([
      {
        fileName: "notice-a.pdf",
        text: "Tender notice\nProcuring entity: Alpha Council",
        extraction: {
          title: null,
          client: "Alpha Council",
          deadlineIso: null,
          deadlineTimezone: null,
          deadlineEvidence: null,
          deadlineLocalHour: null,
          deadlineLocalMinute: null,
          deadlineUnknownReason: null,
          estimatedValue: 1000,
          reference: null,
        },
      },
      {
        fileName: "notice-b.pdf",
        text: "Tender notice\nProcuring entity: Beta Board",
        extraction: {
          title: null,
          client: "Beta Board",
          deadlineIso: null,
          deadlineTimezone: null,
          deadlineEvidence: null,
          deadlineLocalHour: null,
          deadlineLocalMinute: null,
          deadlineUnknownReason: null,
          estimatedValue: 9000,
          reference: null,
        },
      },
    ]);
    assert.equal(identity.buyer.status, "CONFLICT");
    assert.equal(identity.estimatedValue.status, "CONFLICT");
    assert.ok(identity.buyer.candidates.some((c) => /Alpha/.test(c.value)));
    assert.ok(identity.buyer.candidates.some((c) => /Beta/.test(c.value)));
  });
});

describe("package identity — document roles", () => {
  it("classifies a multi-volume pack into distinct procurement roles from content", () => {
    const docs = classifyPackageDocumentIdentity([
      {
        fileName: "vol-a.pdf",
        text: "Section I — Instructions to Bidders\nThe bidder shall submit the proposal in two envelopes.",
      },
      {
        fileName: "vol-b.pdf",
        text: "Schedule of Requirements\nThe bidder shall supply the items listed in the schedule.",
      },
      {
        fileName: "vol-c.pdf",
        text: "Returnable Bidding Forms\nForm of Tender — the bidder shall complete this form.",
      },
      {
        fileName: "vol-d.pdf",
        text: "Contract Forms\nSpecial conditions of contract. Sample contract attached.",
      },
      {
        fileName: "vol-e.pdf",
        text: "Pre-bid meeting minutes\nQuestion 1 was discussed. The contracting authority clarified delivery.",
      },
    ]);
    const roles = Object.fromEntries(docs.map((d) => [d.fileName, d.role]));
    assert.equal(roles["vol-a.pdf"], "INSTRUCTIONS");
    assert.equal(roles["vol-b.pdf"], "SCHEDULE_OF_REQUIREMENTS");
    assert.equal(roles["vol-c.pdf"], "RETURNABLE_FORMS");
    assert.ok(roles["vol-d.pdf"] === "CONTRACT_FORMS" || roles["vol-d.pdf"] === "SAMPLE_CONTRACT");
    assert.equal(roles["vol-e.pdf"], "PREBID_MATERIAL");
    assert.equal(new Set(Object.values(roles)).size >= 4, true);
  });

  it("filename alone cannot assign a role when content has no evidence", () => {
    const docs = classifyPackageDocumentIdentity([
      {
        fileName: "Section_I_Instructions_to_Bidders.pdf",
        text: "This paper describes general office procedures and meeting etiquette.",
      },
    ]);
    assert.ok(docs[0]!.role === "UNKNOWN" || docs[0]!.role === "OTHER");
    assert.ok(!docs[0]!.signals.includes("filename_corroboration"));
  });

  it("a vendor/eSourcing guide is not a tender notice because it lists notices", () => {
    const docs = classifyPackageDocumentIdentity([
      {
        fileName: "esourcing-vendor-guide.pdf",
        text:
          "This guide explains how to register as a vendor and use the e-sourcing portal. " +
          "The list of tender notices will include both electronic and hard-copy submissions. " +
          "Click on the upload button after you log in to the portal.",
      },
    ]);
    assert.equal(docs[0]!.role, "VENDOR_GUIDE");
  });

  it("instructions to offerors remain instructions, not a schedule mention", () => {
    const docs = classifyPackageDocumentIdentity([
      {
        fileName: "section-i.pdf",
        text:
          "Section I — Instructions to Offerors\n" +
          "The offeror shall submit the proposal before the closing time. " +
          "See also the schedule of requirements in Section II.",
      },
      {
        fileName: "section-ii.pdf",
        text: "Schedule of Requirements\nThe offeror shall supply the items listed below.",
      },
    ]);
    const roles = Object.fromEntries(docs.map((d) => [d.fileName, d.role]));
    assert.equal(roles["section-i.pdf"], "INSTRUCTIONS");
    assert.equal(roles["section-ii.pdf"], "SCHEDULE_OF_REQUIREMENTS");
  });

  it("STI mapping preserves instructions, schedule, returnable, pre-bid and UTI tenderers", () => {
    assert.equal(mapPackageDocumentRole("INSTRUCTIONS_TO_TENDERERS"), "INSTRUCTIONS_TO_BIDDERS");
    assert.equal(mapPackageDocumentRole("INSTRUCTIONS"), "INSTRUCTIONS_TO_BIDDERS");
    assert.equal(mapPackageDocumentRole("SCHEDULE_OF_REQUIREMENTS"), "SCHEDULE_OF_REQUIREMENTS");
    assert.equal(mapPackageDocumentRole("RETURNABLE_BIDDING_FORMS"), "RETURNABLE_BIDDING_FORMS");
    assert.equal(mapPackageDocumentRole("PREBID_MATERIAL"), "PREBID_MATERIAL");
    assert.equal(mapPackageDocumentRole("TENDER_NOTICE"), "NOTICE");
    assert.equal(identityRoleToStiString("INSTRUCTIONS"), "INSTRUCTIONS_TO_BIDDERS");
    assert.notEqual(mapPackageDocumentRole("CPS"), "TECHNICAL_SPECIFICATION");
  });
});

describe("package identity — deadline integrity", () => {
  it("reads a bid deadline when the date is on the next line", () => {
    const parsed = extractTenderDeadlineFromText(
      "Deadline for submission of Bids\n27 March 2026 at 14:00 hrs",
      null,
    );
    assert.ok(parsed.deadlineIso);
    assert.match(parsed.deadlineIso!, /2026-03-27/);
    assert.equal(parsed.localHour, 14);
    assert.equal(parsed.localMinute, 0);
    assert.equal(parsed.deadlineTimezone, null);
  });

  it("does not treat opening, clarification or validity dates as the bid deadline", () => {
    assert.equal(
      extractTenderDeadlineFromText("Bid opening date: 20 March 2026 at 14:00", null).deadlineIso,
      null,
    );
    assert.equal(
      extractTenderDeadlineFromText(
        "Deadline for request for clarification: 1 March 2026 at 10:00",
        null,
      ).deadlineIso,
      null,
    );
    assert.equal(
      extractTenderDeadlineFromText("Bid validity shall expire on 15 June 2026", null).deadlineIso,
      null,
    );
  });

  it("package identity keeps a labelled submission deadline and exposes conflict", () => {
    const ok = resolvePackageIdentity([
      {
        fileName: "itt.pdf",
        text: "Instructions to Bidders\nDeadline for submission of Bids\n27 March 2026 at 14:00 hrs",
        extraction: {
          title: null,
          client: null,
          deadlineIso: "2026-03-27T14:00:00",
          deadlineTimezone: null,
          deadlineEvidence: "Deadline for submission of Bids 27 March 2026 at 14:00 hrs",
          deadlineLocalHour: 14,
          deadlineLocalMinute: 0,
          deadlineUnknownReason: null,
          estimatedValue: null,
          reference: null,
        },
      },
      {
        fileName: "prebid.pdf",
        text: "Pre-bid meeting minutes 10 February 2026. Delivery date: 1 September 2026.",
        extraction: {
          title: null,
          client: null,
          deadlineIso: null,
          deadlineTimezone: null,
          deadlineEvidence: null,
          deadlineLocalHour: null,
          deadlineLocalMinute: null,
          deadlineUnknownReason: null,
          estimatedValue: null,
          reference: null,
        },
      },
    ]);
    assert.equal(ok.deadline.status, "OK");
    assert.match(ok.deadline.deadlineIso ?? "", /2026-03-27/);

    const conflict = resolvePackageIdentity([
      {
        fileName: "notice.pdf",
        text: "Tender notice\nSubmission deadline: 1 May 2026 at 10:00",
        extraction: {
          title: null,
          client: null,
          deadlineIso: "2026-05-01T10:00:00",
          deadlineTimezone: null,
          deadlineEvidence: "Submission deadline: 1 May 2026 at 10:00",
          deadlineLocalHour: 10,
          deadlineLocalMinute: 0,
          deadlineUnknownReason: null,
          estimatedValue: null,
          reference: null,
        },
      },
      {
        fileName: "corrigendum.pdf",
        text: "Corrigendum\nSubmission deadline: 15 May 2026 at 10:00",
        extraction: {
          title: null,
          client: null,
          deadlineIso: "2026-05-15T10:00:00",
          deadlineTimezone: null,
          deadlineEvidence: "Submission deadline: 15 May 2026 at 10:00",
          deadlineLocalHour: 10,
          deadlineLocalMinute: 0,
          deadlineUnknownReason: null,
          estimatedValue: null,
          reference: null,
        },
      },
    ]);
    assert.equal(conflict.deadline.status, "CONFLICT");
    assert.equal(conflict.deadline.deadlineIso, null);
    assert.equal(conflict.deadline.sources.length, 2);
  });

  it("document opening identity is not overridden by later artefact mentions", () => {
    const later = "\nLater pages of this volume.\n".repeat(400);
    const docs = classifyPackageDocumentIdentity([
      {
        fileName: "volume-schedule.pdf",
        text: `Schedule of Requirements\nThe supplier shall deliver the goods listed below.\n${later}Special conditions of contract apply after award. General conditions of contract are attached.\n`,
      },
      {
        fileName: "volume-sample.pdf",
        text: `Sample contract\nThis sample contract is for reference only.\n${later}Schedule of Requirements may be annexed. Returnable bidding forms are issued separately.\n`,
      },
      {
        fileName: "volume-slides.pdf",
        text: `Pre-bid meeting slides\nAgenda and clarifications.\n${later}Returnable bidding forms must be completed. Form of Tender is attached to the pack.\n`,
      },
    ]);
    const roles = Object.fromEntries(docs.map((d) => [d.fileName, d.role]));
    assert.equal(roles["volume-schedule.pdf"], "SCHEDULE_OF_REQUIREMENTS");
    assert.equal(roles["volume-sample.pdf"], "SAMPLE_CONTRACT");
    assert.equal(roles["volume-slides.pdf"], "PREBID_MATERIAL");
  });

  it("section-numbered filename cannot assign a role without content evidence", () => {
    const docs = classifyPackageDocumentIdentity([
      {
        fileName: "Section_II_Schedule_of_Requirements_ITB-999.pdf",
        text: "This circular describes staff parking and cafeteria hours.",
      },
    ]);
    assert.ok(docs[0]!.role === "UNKNOWN" || docs[0]!.role === "OTHER");
    assert.ok(!docs[0]!.signals.includes("filename_corroboration"));
  });
});

describe("package identity — location and country authority", () => {
  it("Q&A location fragments do not override a labelled notice location", () => {
    const identity = resolvePackageIdentity([
      {
        fileName: "notice.pdf",
        text: "Tender notice\nProcuring entity: Harbour Port Authority\nPlace of performance: Port District North\nSubmission deadline: 2 June 2026 at 12:00",
        extraction: {
          title: null,
          client: "Harbour Port Authority",
          deadlineIso: "2026-06-02T12:00:00",
          deadlineTimezone: null,
          deadlineEvidence: "Submission deadline: 2 June 2026 at 12:00",
          deadlineLocalHour: 12,
          deadlineLocalMinute: 0,
          deadlineUnknownReason: null,
          estimatedValue: null,
          reference: null,
          country: "Testland",
        },
      },
      {
        fileName: "qa.pdf",
        text: "Question: Can the site visit start at Location: Warehouse 9?\nAnswer: Yes.",
        extraction: {
          title: null,
          client: null,
          deadlineIso: null,
          deadlineTimezone: null,
          deadlineEvidence: null,
          deadlineLocalHour: null,
          deadlineLocalMinute: null,
          deadlineUnknownReason: null,
          estimatedValue: null,
          reference: null,
          country: "Otherland",
        },
      },
    ]);
    assert.equal(identity.location.status, "OK");
    assert.match(identity.location.value ?? "", /Port District North/);
    assert.equal(identity.country.status, "OK");
    assert.equal(identity.country.value, "Testland");
  });
});

describe("package identity — deadline integrity", () => {
  it("pre-bid restatement cannot author OK when instructions exist without a parsed date", () => {
    const identity = resolvePackageIdentity([
      {
        fileName: "instructions.pdf",
        text: "Instructions to Bidders\nTender Particulars are set out in the table below.\nThe bidder shall submit two envelopes.",
        extraction: {
          title: null,
          client: null,
          deadlineIso: null,
          deadlineTimezone: null,
          deadlineEvidence: null,
          deadlineLocalHour: null,
          deadlineLocalMinute: null,
          deadlineUnknownReason: null,
          estimatedValue: null,
          reference: null,
        },
      },
      {
        fileName: "prebid.pdf",
        text: "Pre-bid meeting minutes\nThe deadline for submission of bids on 28 April 2026.",
        extraction: {
          title: null,
          client: null,
          deadlineIso: "2026-04-28",
          deadlineTimezone: null,
          deadlineEvidence: "deadline for submission of bids on 28 April 2026",
          deadlineLocalHour: null,
          deadlineLocalMinute: null,
          deadlineUnknownReason: null,
          estimatedValue: null,
          reference: null,
        },
      },
    ]);
    assert.equal(identity.deadline.status, "INCOMPLETE");
    assert.equal(identity.deadline.deadlineIso, null);
    assert.ok(identity.deadline.sources.length >= 1);
    assert.equal(identity.documents.find((d) => d.fileName === "instructions.pdf")?.role, "INSTRUCTIONS");
  });

  it("reads a particulars Date/Time split after Deadline for Proposal Submission", () => {
    const parsed = extractTenderDeadlineFromText(
      "RFP Particulars\nDeadline for Proposal Submission\nDate: 15 March 2026\nTime: 14:00 hours CET\n",
      null,
    );
    assert.match(parsed.deadlineIso ?? "", /2026-03-15T14:00:00/);
    assert.equal(parsed.localHour, 14);
    assert.equal(parsed.localMinute, 0);
    assert.equal(parsed.deadlineTimezone, "CET");
  });

  it("does not treat meeting, warranty or contract dates as the bid deadline", () => {
    assert.equal(
      extractTenderDeadlineFromText("Pre-bid meeting date: 10 March 2026 at 10:00", null)
        .deadlineIso,
      null,
    );
    assert.equal(
      extractTenderDeadlineFromText("Warranty expires on 15 June 2027", null).deadlineIso,
      null,
    );
    assert.equal(
      extractTenderDeadlineFromText("Contract commencement date: 1 September 2026", null)
        .deadlineIso,
      null,
    );
  });

  it("keeps a pointer-only deadline as INCOMPLETE with evidence, not a invented date", () => {
    const identity = resolvePackageIdentity([
      {
        fileName: "instructions.pdf",
        text:
          "Instructions to Offerors\n22. DEADLINE FOR PROPOSAL SUBMISSION All Proposals shall be received by the authority by no later than the time and date set out in Section I: RFP Particulars.",
        extraction: {
          title: null,
          client: null,
          deadlineIso: null,
          deadlineTimezone: null,
          deadlineEvidence: null,
          deadlineLocalHour: null,
          deadlineLocalMinute: null,
          deadlineUnknownReason:
            "A bid-submission deadline is referenced but the calendar date is not present in the available package text.",
          estimatedValue: null,
          reference: null,
        },
      },
    ]);
    assert.equal(identity.deadline.status, "INCOMPLETE");
    assert.equal(identity.deadline.deadlineIso, null);
    assert.ok(identity.deadline.evidence);
    assert.match(identity.deadline.reason ?? "", /referenced|phrase was found|calendar date/i);
  });

  it("uses an amendment replacement date over the original when replacement is stated", () => {
    const identity = resolvePackageIdentity([
      {
        fileName: "notice.pdf",
        text: "Tender notice\nSubmission deadline: 1 May 2026 at 10:00",
        extraction: {
          title: null,
          client: null,
          deadlineIso: "2026-05-01T10:00:00",
          deadlineTimezone: null,
          deadlineEvidence: "Submission deadline: 1 May 2026 at 10:00",
          deadlineLocalHour: 10,
          deadlineLocalMinute: 0,
          deadlineUnknownReason: null,
          estimatedValue: null,
          reference: null,
        },
      },
      {
        fileName: "amendment.pdf",
        text: "Amendment No. 1\nThe submission deadline is hereby extended to 15 May 2026 at 10:00",
        extraction: {
          title: null,
          client: null,
          deadlineIso: "2026-05-15T10:00:00",
          deadlineTimezone: null,
          deadlineEvidence: "The submission deadline is hereby extended to 15 May 2026 at 10:00",
          deadlineLocalHour: 10,
          deadlineLocalMinute: 0,
          deadlineUnknownReason: null,
          estimatedValue: null,
          reference: null,
        },
      },
    ]);
    assert.equal(identity.deadline.status, "OK");
    assert.match(identity.deadline.deadlineIso ?? "", /2026-05-15/);
  });

  it("marks a labelled deadline without a date as incomplete rather than silent UNKNOWN", () => {
    const identity = resolvePackageIdentity([
      {
        fileName: "notice.pdf",
        text: "Tender notice\nDeadline for submission of Bids\n",
        truncated: true,
        extraction: {
          title: null,
          client: null,
          deadlineIso: null,
          deadlineTimezone: null,
          deadlineEvidence: null,
          deadlineLocalHour: null,
          deadlineLocalMinute: null,
          deadlineUnknownReason:
            "A deadline/closing phrase was found but no reliable calendar date could be parsed.",
          estimatedValue: null,
          reference: null,
        },
      },
    ]);
    assert.equal(identity.deadline.status, "INCOMPLETE");
    assert.ok(identity.deadline.reason);
  });
});
