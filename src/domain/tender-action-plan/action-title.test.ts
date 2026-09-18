/**
 * Requirement-specific action titles — no generic "linked requirement" fallback.
 */

import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { buildEvidenceIntelligence } from "@/domain/evidence-intelligence";
import {
  buildVerificationIntelligence,
  type CanonicalEvidenceRecord,
} from "@/domain/evidence-verification";
import {
  actionTitleMatchesRequirement,
  buildTenderActionPlan,
  classifyRequirementActionObject,
  deriveRequirementActionTitle,
  isGenericVerificationText,
} from "@/domain/tender-action-plan";
import type { ComplianceRow } from "@/domain/tender-intelligence/types";

function ev(
  over: Partial<CanonicalEvidenceRecord> & { id: string; requirementId: string },
): CanonicalEvidenceRecord {
  return {
    evidenceText: "sample excerpt",
    verificationStatus: "UNKNOWN",
    sourcePage: null,
    sourceSection: null,
    ...over,
  };
}

function complianceRow(over: Partial<ComplianceRow> & Pick<ComplianceRow, "requirementId">): ComplianceRow {
  return {
    id: over.requirementId,
    requirement: "Test requirement",
    requirementType: "Technical",
    mandatory: true,
    priority: "HIGH",
    status: "VERIFY",
    companyFit: null,
    sourceDocument: "RFP.pdf",
    pageNumber: 2,
    section: "3.1",
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
    ...over,
  };
}

describe("deriveRequirementActionTitle", () => {
  it("classifies universal obligation objects without inventing facts", () => {
    assert.equal(
      classifyRequirementActionObject("The bidder shall submit ISO 9001 certification.").kind,
      "CERTIFICATION",
    );
    assert.equal(
      classifyRequirementActionObject(
        "Submit company registration certificate and tax clearance.",
      ).kind,
      "COMPANY_REGISTRATION",
    );
    assert.equal(
      classifyRequirementActionObject("Provide customer references from similar contracts.").kind,
      "CUSTOMER_REFERENCES",
    );
    assert.equal(
      classifyRequirementActionObject("Minimum annual turnover of EUR 2 400 000.").kind,
      "FINANCIAL_ELIGIBILITY",
    );
    assert.equal(
      classifyRequirementActionObject("The bidder shall complete the Form of Tender.").kind,
      "REQUIRED_FORM",
    );
    assert.equal(
      classifyRequirementActionObject("Vendors shall provide relevant technical brochure.").kind,
      "TECHNICAL_CAPACITY",
    );
  });

  it("never returns a linked-requirement generic when a specific title can be derived", () => {
    const cases: Array<{ text: string; type: string; source: "MISSING_EVIDENCE" | "UNVERIFIED_EVIDENCE" }> = [
      { text: "ISO 27001 certification", type: "Certification", source: "MISSING_EVIDENCE" },
      { text: "CNSS certificate and tax clearance", type: "Eligibility", source: "UNVERIFIED_EVIDENCE" },
      { text: "Minimum 5 years public-sector experience with customer references", type: "Experience", source: "UNVERIFIED_EVIDENCE" },
      { text: "The bidder shall complete this Form of Tender", type: "Documentation", source: "MISSING_EVIDENCE" },
      { text: "Audited financial statements for the last three years", type: "Commercial", source: "UNVERIFIED_EVIDENCE" },
    ];
    for (const c of cases) {
      const derived = deriveRequirementActionTitle({
        requirementText: c.text,
        requirementType: c.type,
        sourceType: c.source,
      });
      assert.doesNotMatch(derived.title, /linked requirement/i, c.text);
      assert.ok(derived.title.length > 8, c.text);
    }
  });

  it("prefers a specific requiredAction and rejects generic requiredAction", () => {
    const specific = deriveRequirementActionTitle({
      requirementText: "ISO 27001 certification",
      requirementType: "Certification",
      requiredAction: "Upload ISO 27001 certificate.",
      sourceType: "MISSING_EVIDENCE",
    });
    assert.equal(specific.title, "Upload ISO 27001 certificate.");

    const generic = deriveRequirementActionTitle({
      requirementText: "ISO 27001 certification",
      requirementType: "Certification",
      requiredAction: "Verify evidence for linked requirement",
      sourceType: "UNVERIFIED_EVIDENCE",
    });
    assert.match(generic.title, /certification/i);
    assert.ok(isGenericVerificationText("Verify evidence for linked requirement"));
  });

  it("builds one specific linked action per unverified mandatory requirement", () => {
    const rows = [
      complianceRow({
        requirementId: "r-reg",
        requirement: "Submit company registration certificate with the tender dossier",
        requirementType: "Eligibility",
        status: "VERIFY",
      }),
      complianceRow({
        requirementId: "r-tech",
        requirement: "Vendors shall provide relevant technical brochure",
        requirementType: "Technical",
        status: "VERIFY",
      }),
      complianceRow({
        requirementId: "r-form",
        requirement: "The bidder shall complete the Form of Tender",
        requirementType: "Documentation",
        status: "MISSING",
        requiredAction: "Complete the Form of Tender.",
      }),
    ];
    const verification = buildVerificationIntelligence({
      defaultDocumentName: "RFP.pdf",
      requirements: rows.map((r) => ({
        id: r.requirementId,
        description: r.requirement,
        mandatory: true,
        value: null,
        readinessStatus: r.status,
      })),
      evidence: [
        ev({
          id: "e-reg",
          requirementId: "r-reg",
          evidenceText: "registration excerpt",
          verificationStatus: "INFERRED",
        }),
        ev({
          id: "e-tech",
          requirementId: "r-tech",
          evidenceText: "brochure excerpt",
          verificationStatus: "INFERRED",
        }),
      ],
    });
    const evidence = buildEvidenceIntelligence({
      verificationIntelligence: verification,
      complianceMatrix: rows,
      evidence: [
        ev({
          id: "e-reg",
          requirementId: "r-reg",
          evidenceText: "registration excerpt",
          verificationStatus: "INFERRED",
        }),
        ev({
          id: "e-tech",
          requirementId: "r-tech",
          evidenceText: "brochure excerpt",
          verificationStatus: "INFERRED",
        }),
      ],
      requirements: rows.map((r) => ({
        id: r.requirementId,
        category: r.requirementType,
        status: r.status === "MISSING" ? "MISSING" : "UNCERTAIN",
      })),
    });
    const plan = buildTenderActionPlan({
      tenderId: "t-actions",
      companyId: "c1",
      tenderDeadline: null,
      complianceMatrix: rows,
      evidenceIntelligence: evidence,
      risks: [],
      keyBlockers: [],
      readiness: { attention: ["3 mandatory requirements could not be verified."], items: [] },
      fitBreakdown: null,
      recommendation: null,
      teamTasks: [],
      asOf: new Date("2026-09-01T12:00:00.000Z"),
    });
    const linked = plan.items.filter((i) => i.linkedRequirementId && !i.simulationOnly);
    assert.equal(linked.length, 3);
    assert.equal(new Set(linked.map((i) => i.title)).size, 3);
    for (const item of linked) {
      assert.doesNotMatch(item.title, /linked requirement/i);
      assert.ok(item.linkedRequirementId);
      assert.ok(item.requirementText);
      assert.equal(
        actionTitleMatchesRequirement(item.title, item.requirementText ?? item.description),
        true,
        item.title,
      );
    }
  });

  it("does not infer company registration from qualification, nationality, or conflict of interest", () => {
    const mismatches = [
      {
        text: "The bidder shall complete the qualification form attached to this ITB.",
        type: "Eligibility",
        kind: "REQUIRED_FORM" as const,
        forbid: /company registration/i,
      },
      {
        text: "The Offeror shall be a national of a member state or otherwise eligible by nationality.",
        type: "Eligibility",
        kind: "GENERIC_OBJECT" as const,
        forbid: /company registration/i,
      },
      {
        text: "An Offeror is associated, or has been associated in the past, directly or indirectly, with a firm that prepared the specifications. Disclose any conflict of interest.",
        type: "Eligibility",
        kind: "GENERIC_OBJECT" as const,
        forbid: /company registration/i,
      },
    ];
    for (const c of mismatches) {
      const classified = classifyRequirementActionObject(c.text, c.type);
      assert.equal(classified.kind, c.kind, c.text);
      const derived = deriveRequirementActionTitle({
        requirementText: c.text,
        requirementType: c.type,
        sourceType: "UNVERIFIED_EVIDENCE",
      });
      assert.doesNotMatch(derived.title, c.forbid, c.text);
      assert.doesNotMatch(derived.title, /linked requirement/i, c.text);
      assert.equal(actionTitleMatchesRequirement(derived.title, c.text), true, derived.title);
    }
  });

  it("maps only when the obligation explicitly supports the class", () => {
    const cases: Array<{
      text: string;
      type: string;
      kind: ReturnType<typeof classifyRequirementActionObject>["kind"];
      title: RegExp;
    }> = [
      {
        text: "Vendors shall provide relevant technical brochure to facilitate evaluation.",
        type: "Technical",
        kind: "TECHNICAL_CAPACITY",
        title: /technical capacity/i,
      },
      {
        text: "The bidder shall provide professional indemnity insurance covering the assignment.",
        type: "Contractual",
        kind: "INSURANCE",
        title: /insurance/i,
      },
      {
        text: "Minimum annual turnover of EUR 2 400 000.",
        type: "Eligibility",
        kind: "FINANCIAL_ELIGIBILITY",
        title: /financial eligibility/i,
      },
      {
        text: "The bidder shall complete the Form of Tender.",
        type: "Eligibility",
        kind: "REQUIRED_FORM",
        title: /required form/i,
      },
      {
        text: "Provide customer references from similar contracts.",
        type: "Technical",
        kind: "CUSTOMER_REFERENCES",
        title: /references/i,
      },
      {
        text: "Minimum 5 years public-sector experience.",
        type: "Experience",
        kind: "CUSTOMER_REFERENCES",
        title: /references/i,
      },
    ];
    for (const c of cases) {
      assert.equal(classifyRequirementActionObject(c.text, c.type).kind, c.kind, c.text);
      const derived = deriveRequirementActionTitle({
        requirementText: c.text,
        requirementType: c.type,
        sourceType: "UNVERIFIED_EVIDENCE",
      });
      assert.match(derived.title, c.title, c.text);
      assert.doesNotMatch(derived.title, /linked requirement/i, c.text);
      assert.equal(actionTitleMatchesRequirement(derived.title, c.text), true, derived.title);
    }
  });

  it("never emits generic linked-requirement titles", () => {
    assert.ok(isGenericVerificationText("Verify evidence for linked requirement"));
    const derived = deriveRequirementActionTitle({
      requirementText: "Disclose any conflict of interest with the specification author.",
      requirementType: "Eligibility",
      requiredAction: "Verify evidence for linked requirement",
      sourceType: "UNVERIFIED_EVIDENCE",
    });
    assert.doesNotMatch(derived.title, /linked requirement/i);
    assert.match(derived.title, /^Verify:/);
    assert.equal(
      actionTitleMatchesRequirement(derived.title, "Disclose any conflict of interest with the specification author."),
      true,
    );
  });
});
