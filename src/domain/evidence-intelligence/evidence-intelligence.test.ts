/**
 * Evidence Intelligence — production regression tests (part 1).
 */

import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { computeTenderReadiness } from "@/domain/decision/tender-readiness";
import {
  buildEvidenceIntelligence,
  deriveEvidenceValidity,
  mapEvidenceIntelligenceState,
} from "@/domain/evidence-intelligence";
import {
  buildVerificationIntelligence,
  type CanonicalEvidenceRecord,
} from "@/domain/evidence-verification";
import { buildTenderIntelligence } from "@/domain/tender-intelligence";

const PLACEHOLDER = "No supporting excerpt available — marked UNKNOWN.";

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

describe("evidence intelligence states", () => {
  it("CNSS found but unverified → FOUND_UNVERIFIED, not VERIFIED", () => {
    const state = mapEvidenceIntelligenceState({
      requirementVerificationStatus: "NEEDS_VERIFICATION",
      evidence: ev({
        id: "e1",
        requirementId: "r1",
        evidenceText: "CNSS attestation reference in company file",
        verificationStatus: "INFERRED",
        documentName: "CNSS Certificate.pdf",
      }),
      readinessStatus: "VERIFY",
      validityState: "UNKNOWN",
    });
    assert.equal(state, "FOUND_UNVERIFIED");
  });

  it("no excerpt → MISSING", () => {
    const state = mapEvidenceIntelligenceState({
      requirementVerificationStatus: "MISSING_EVIDENCE",
      evidence: null,
      readinessStatus: "MISSING",
      validityState: "UNKNOWN",
    });
    assert.equal(state, "MISSING");
  });

  it("team verified → VERIFIED", () => {
    const state = mapEvidenceIntelligenceState({
      requirementVerificationStatus: "VERIFIED",
      evidence: ev({
        id: "e1",
        requirementId: "r1",
        verificationStatus: "VERIFIED",
        teamTaskId: "task-1",
      }),
      readinessStatus: "READY",
      validityState: "VALID",
    });
    assert.equal(state, "VERIFIED");
  });

  it("rejected evidence → INVALID", () => {
    const state = mapEvidenceIntelligenceState({
      requirementVerificationStatus: "NEEDS_VERIFICATION",
      evidence: ev({
        id: "e1",
        requirementId: "r1",
        verificationStatus: "REJECTED",
      }),
      readinessStatus: "VERIFY",
      validityState: "UNKNOWN",
    });
    assert.equal(state, "INVALID");
  });

  it("parsed past expiry → EXPIRED", () => {
    const validity = deriveEvidenceValidity({
      excerpt: "Insurance policy valid until January 2020",
      referenceDate: new Date("2026-01-01"),
    });
    assert.equal(validity.validityState, "EXPIRED");
    const state = mapEvidenceIntelligenceState({
      requirementVerificationStatus: "NEEDS_VERIFICATION",
      evidence: ev({
        id: "e1",
        requirementId: "r1",
        evidenceText: "Insurance policy valid until January 2020",
      }),
      readinessStatus: "VERIFY",
      validityState: validity.validityState,
    });
    assert.equal(state, "EXPIRED");
  });

  it("no expiry in text → validity UNKNOWN, does not assume forever valid", () => {
    const validity = deriveEvidenceValidity({
      excerpt: "Company references for public-sector AV projects",
    });
    assert.equal(validity.expiryDate, null);
    assert.equal(validity.validityState, "UNKNOWN");
  });
});

describe("evidence intelligence bundle", () => {
  it("builds explainable rows from canonical verification chains", () => {
    const requirements = [
      {
        id: "r1",
        category: "Certification",
        description: "Valid CNSS certificate required",
        mandatory: true,
        value: null as string | null,
        status: "UNCERTAIN" as const,
        sourcePage: 2,
        sourceSection: "3.1",
        evidence: "CNSS attestation required",
      },
    ];
    const readiness = computeTenderReadiness({
      requirements: requirements.map((r) => ({
        id: r.id,
        category: r.category,
        description: r.description,
        mandatory: r.mandatory,
        value: r.value,
        status: r.status,
        evidence: r.evidence,
      })),
      missingDocuments: [],
      profileHasAnyCapability: true,
    });
    const intelligence = buildTenderIntelligence({
      tenderId: "t1",
      documentName: "RFP.pdf",
      tenderDeadline: null,
      extractedText: "",
      requirements,
      evidence: [
        ev({
          id: "e1",
          requirementId: "r1",
          evidenceText: "CNSS registration excerpt from company knowledge",
          verificationStatus: "INFERRED",
          documentName: "Company Compliance Pack.pdf",
          sourcePage: 4,
        }),
      ],
      readiness,
      findings: [],
      existingRisks: [],
      decision: "REVIEW",
      fitScore: 55,
    });

    assert.ok(intelligence.evidenceIntelligence);
    const row = intelligence.evidenceIntelligence!.rows[0]!;
    assert.equal(row.evidenceState, "FOUND_UNVERIFIED");
    assert.notEqual(row.evidenceState, "VERIFIED");
    assert.ok(row.relevanceReason?.includes("not filename alone") || row.relevanceReason?.length);
    assert.ok(row.decisionImpactNote?.includes("not verified"));
    assert.equal(row.evidence?.confidence, "INFERRED");
  });

  it("does not treat filename alone as proof — placeholder excerpt is missing", () => {
    const verification = buildVerificationIntelligence({
      defaultDocumentName: "Tender.pdf",
      requirements: [
        {
          id: "r1",
          description: "ISO 27001 certification",
          mandatory: true,
          value: null,
          readinessStatus: "MISSING",
        },
      ],
      evidence: [
        ev({
          id: "e1",
          requirementId: "r1",
          evidenceText: PLACEHOLDER,
          documentName: "ISO27001.pdf",
        }),
      ],
    });
    const bundle = buildEvidenceIntelligence({
      verificationIntelligence: verification,
      complianceMatrix: [],
      evidence: [
        ev({
          id: "e1",
          requirementId: "r1",
          evidenceText: PLACEHOLDER,
          documentName: "ISO27001.pdf",
        }),
      ],
      requirements: [{ id: "r1", category: "Certification", status: "MISSING" }],
    });
    const row = bundle.rows[0]!;
    assert.equal(row.evidenceState, "MISSING");
    assert.equal(row.evidence, null);
  });

  it("summary counts match row cardinality", () => {
    const verification = buildVerificationIntelligence({
      defaultDocumentName: "Doc",
      requirements: [
        {
          id: "r1",
          description: "A",
          mandatory: true,
          value: null,
          readinessStatus: "MISSING",
        },
        {
          id: "r2",
          description: "B",
          mandatory: true,
          value: null,
          readinessStatus: "NOT_APPLICABLE",
        },
      ],
      evidence: [],
    });
    const bundle = buildEvidenceIntelligence({
      verificationIntelligence: verification,
      complianceMatrix: [],
      evidence: [],
      requirements: [
        { id: "r1", category: "TECH", status: "MISSING" },
        { id: "r2", category: "INFO", status: "UNCERTAIN" },
      ],
    });
    assert.equal(bundle.summary.total, 2);
    assert.equal(bundle.rows.length, 2);
    assert.ok(bundle.readinessSummary);
  });
});

describe("evidence intelligence isolation", () => {
  it("does not mutate canonical evidence input", () => {
    const rows = [
      ev({
        id: "e1",
        requirementId: "r1",
        evidenceText: "before",
        verificationStatus: "INFERRED",
      }),
    ];
    const verification = buildVerificationIntelligence({
      defaultDocumentName: "Doc",
      requirements: [
        {
          id: "r1",
          description: "Req",
          mandatory: true,
          value: null,
          readinessStatus: "VERIFY",
        },
      ],
      evidence: rows,
    });
    buildEvidenceIntelligence({
      verificationIntelligence: verification,
      complianceMatrix: [],
      evidence: rows,
      requirements: [{ id: "r1", category: "TECH", status: "UNCERTAIN" }],
    });
    assert.equal(rows[0]!.evidenceText, "before");
    assert.equal(rows[0]!.verificationStatus, "INFERRED");
  });
});
