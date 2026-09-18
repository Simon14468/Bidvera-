/**
 * Evidence Intelligence foundation — mapping, safety, permissions, traceability.
 */

import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { describe, it } from "node:test";
import {
  buildEvidenceIntelligence,
  buildEvidenceReadinessSummary,
  deriveEvidenceValidity,
  EVIDENCE_INTELLIGENCE_INVARIANTS,
  mapEvidenceIntelligenceState,
  sourceDisplayLabel,
  verificationDisplayLabel,
} from "@/domain/evidence-intelligence";
import {
  deriveRequirementVerificationStatus,
  findDuplicateEvidenceAssignments,
  type CanonicalEvidenceRecord,
} from "@/domain/evidence-verification";
import { buildVerificationIntelligence } from "@/domain/evidence-verification";
import {
  assertCanViewTenderAnalysis,
  canViewTenderAnalysis,
} from "@/auth/tender-access";
import { AppError, ErrorCode } from "@/lib/errors";

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

function buildMixedBundle() {
  const verification = buildVerificationIntelligence({
    defaultDocumentName: "RFP.pdf",
    requirements: [
      {
        id: "r1",
        description: "CNSS certificate",
        mandatory: true,
        value: null,
        readinessStatus: "READY",
      },
      {
        id: "r2",
        description: "ISO 27001",
        mandatory: true,
        value: null,
        readinessStatus: "VERIFY",
      },
      {
        id: "r3",
        description: "Bank guarantee",
        mandatory: true,
        value: null,
        readinessStatus: "MISSING",
      },
      {
        id: "r4",
        description: "Optional workshop",
        mandatory: false,
        value: null,
        readinessStatus: "NOT_APPLICABLE",
      },
    ],
    evidence: [
      ev({
        id: "e1",
        requirementId: "r1",
        evidenceText: "CNSS attestation on file",
        verificationStatus: "VERIFIED",
        teamTaskId: "task-1",
        documentName: "CNSS.pdf",
        sourcePage: 2,
      }),
      ev({
        id: "e2",
        requirementId: "r2",
        evidenceText: "ISO certificate mentioned in profile",
        verificationStatus: "INFERRED",
        documentName: "Profile.pdf",
        sourcePage: 5,
        sourceSection: "2.1",
      }),
    ],
  });

  return buildEvidenceIntelligence({
    verificationIntelligence: verification,
    complianceMatrix: [],
    evidence: [
      ev({
        id: "e1",
        requirementId: "r1",
        evidenceText: "CNSS attestation on file",
        verificationStatus: "VERIFIED",
        teamTaskId: "task-1",
        documentName: "CNSS.pdf",
        sourcePage: 2,
      }),
      ev({
        id: "e2",
        requirementId: "r2",
        evidenceText: "ISO certificate mentioned in profile",
        verificationStatus: "INFERRED",
        documentName: "Profile.pdf",
        sourcePage: 5,
        sourceSection: "2.1",
      }),
    ],
    requirements: [
      { id: "r1", category: "Certification", status: "MATCHED" },
      { id: "r2", category: "Certification", status: "UNCERTAIN" },
      { id: "r3", category: "Financial", status: "FAILED" },
      { id: "r4", category: "INFORMATIONAL", status: "UNCERTAIN" },
    ],
  });
}

describe("requirement → evidence mapping", () => {
  it("maps each requirement to at most one primary evidence row", () => {
    const bundle = buildMixedBundle();
    assert.equal(bundle.rows.length, 4);
    const withEvidence = bundle.rows.filter((r) => r.evidence != null);
    assert.equal(withEvidence.length, 2);
  });

  it("executive readiness summary matches Supported / Need Verification / Missing", () => {
    const bundle = buildMixedBundle();
    const rs = bundle.readinessSummary;
    assert.equal(rs.totalRequirements, 3);
    assert.equal(rs.supported, 1);
    assert.equal(rs.needVerification, 1);
    assert.equal(rs.missingEvidence, 1);
    assert.equal(rs.supported + rs.needVerification + rs.missingEvidence, rs.totalRequirements);
  });
});

describe("evidence states — foundation", () => {
  it("verified evidence with team task", () => {
    const bundle = buildMixedBundle();
    const row = bundle.rows.find((r) => r.requirementId === "r1")!;
    assert.equal(row.evidenceState, "VERIFIED");
    assert.equal(verificationDisplayLabel(row), "Human verified");
  });

  it("found but unverified evidence", () => {
    const bundle = buildMixedBundle();
    const row = bundle.rows.find((r) => r.requirementId === "r2")!;
    assert.equal(row.evidenceState, "FOUND_UNVERIFIED");
    assert.equal(verificationDisplayLabel(row), "Needs verification");
  });

  it("missing evidence", () => {
    const bundle = buildMixedBundle();
    const row = bundle.rows.find((r) => r.requirementId === "r3")!;
    assert.equal(row.evidenceState, "MISSING");
    assert.equal(row.evidence, null);
  });

  it("expired evidence from parsed dates", () => {
    const validity = deriveEvidenceValidity({
      excerpt: "Policy valid until January 2020",
      referenceDate: new Date("2026-06-01"),
    });
    assert.equal(validity.validityState, "EXPIRED");
    assert.equal(
      mapEvidenceIntelligenceState({
        requirementVerificationStatus: "NEEDS_VERIFICATION",
        evidence: ev({
          id: "e1",
          requirementId: "r1",
          evidenceText: "Policy valid until January 2020",
        }),
        readinessStatus: "VERIFY",
        validityState: validity.validityState,
      }),
      "EXPIRED",
    );
  });

  it("unknown expiry when no date in text", () => {
    const validity = deriveEvidenceValidity({
      excerpt: "Public-sector AV project references documented",
    });
    assert.equal(validity.validityState, "UNKNOWN");
    assert.equal(validity.expiryDate, null);
  });

  it("unsupported / rejected evidence → INVALID", () => {
    assert.equal(
      mapEvidenceIntelligenceState({
        requirementVerificationStatus: "NEEDS_VERIFICATION",
        evidence: ev({
          id: "e1",
          requirementId: "r1",
          verificationStatus: "REJECTED",
        }),
        readinessStatus: "VERIFY",
        validityState: "UNKNOWN",
      }),
      "INVALID",
    );
    assert.equal(
      verificationDisplayLabel({
        evidenceState: "INVALID",
        requirementVerificationStatus: "NEEDS_VERIFICATION",
      }),
      "Rejected — unsupported",
    );
  });
});

describe("source traceability", () => {
  it("includes document, page, and section when available", () => {
    const bundle = buildMixedBundle();
    const row = bundle.rows.find((r) => r.requirementId === "r2")!;
    assert.ok(row.evidence?.sourceDocument);
    assert.equal(row.evidence?.pageNumber, 5);
    assert.equal(row.evidence?.section, "2.1");
    assert.match(sourceDisplayLabel(row), /Profile\.pdf|Page 5|2\.1/);
  });

  it("unknown source when no location data", () => {
    const bundle = buildEvidenceIntelligence({
      verificationIntelligence: buildVerificationIntelligence({
        defaultDocumentName: null,
        requirements: [
          {
            id: "r1",
            description: "Req",
            mandatory: true,
            value: null,
            readinessStatus: "MISSING",
          },
        ],
        evidence: [],
      }),
      complianceMatrix: [],
      evidence: [],
      requirements: [{ id: "r1", category: "TECH", status: "MISSING" }],
    });
    assert.equal(sourceDisplayLabel(bundle.rows[0]!), "Source unknown");
  });
});

describe("no hallucinated evidence", () => {
  it("rejects placeholder excerpts as evidence records", () => {
    const bundle = buildEvidenceIntelligence({
      verificationIntelligence: buildVerificationIntelligence({
        defaultDocumentName: "Tender.pdf",
        requirements: [
          {
            id: "r1",
            description: "Cert required",
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
            documentName: "Looks-Relevant.pdf",
          }),
        ],
      }),
      complianceMatrix: [],
      evidence: [
        ev({
          id: "e1",
          requirementId: "r1",
          evidenceText: PLACEHOLDER,
          documentName: "Looks-Relevant.pdf",
        }),
      ],
      requirements: [{ id: "r1", category: "Certification", status: "MISSING" }],
    });
    assert.equal(bundle.rows[0]!.evidence, null);
    assert.equal(bundle.rows[0]!.evidenceState, "MISSING");
  });
});

describe("no automatic verification", () => {
  it("INFERRED evidence never maps to VERIFIED without team task", () => {
    const derived = deriveRequirementVerificationStatus({
      readinessStatus: "READY",
      evidence: ev({
        id: "e1",
        requirementId: "r1",
        evidenceText: "ISO 27001 certified",
        verificationStatus: "INFERRED",
      }),
      requirementDescription: "ISO 27001",
      requirementValue: null,
    });
    assert.notEqual(derived.status, "VERIFIED");

    const state = mapEvidenceIntelligenceState({
      requirementVerificationStatus: derived.status,
      evidence: ev({
        id: "e1",
        requirementId: "r1",
        evidenceText: "ISO 27001 certified",
        verificationStatus: "INFERRED",
      }),
      readinessStatus: "READY",
      validityState: "UNKNOWN",
    });
    assert.equal(state, "FOUND_UNVERIFIED");
  });

  it("domain invariants forbid auto-verify and mutations", () => {
    assert.equal(EVIDENCE_INTELLIGENCE_INVARIANTS.autoVerify, false);
    assert.equal(EVIDENCE_INTELLIGENCE_INVARIANTS.mutatesDecision, false);
    assert.equal(EVIDENCE_INTELLIGENCE_INVARIANTS.mutatesBilling, false);
  });
});

describe("duplicate evidence handling", () => {
  it("detects same evidence id assigned to multiple requirements", () => {
    const dupes = findDuplicateEvidenceAssignments([
      ev({ id: "shared", requirementId: "r1" }),
      ev({ id: "shared", requirementId: "r2" }),
    ]);
    assert.deepEqual(dupes, ["shared"]);
  });

  it("selectBestEvidenceByRequirement keeps one primary row per requirement", () => {
    const bundle = buildMixedBundle();
    const ids = new Set(bundle.rows.map((r) => r.requirementId));
    assert.equal(ids.size, bundle.rows.length);
  });
});

describe("permission enforcement", () => {
  it("company members may view tender analysis", () => {
    assert.equal(canViewTenderAnalysis("OWNER"), true);
    assert.equal(canViewTenderAnalysis("ADMIN"), true);
    assert.equal(canViewTenderAnalysis("MEMBER"), true);
    assert.equal(canViewTenderAnalysis("VIEWER"), true);
    assert.doesNotThrow(() => assertCanViewTenderAnalysis("VIEWER"));
  });

  it("application layer uses session + view permission (static contract)", async () => {
    const src = await readFile(
      join(process.cwd(), "src/application/evidence-intelligence.ts"),
      "utf8",
    );
    assert.match(src, /requireCompanyId/);
    assert.match(src, /assertCanViewTenderAnalysis/);
    assert.match(src, /getCanonicalTenderAnalysis/);
    assert.doesNotMatch(src, /prisma\.(tender|tenderEvidence)\.(create|update|delete)/);
  });

  it("server action enforces view permission before load", async () => {
    const src = await readFile(
      join(process.cwd(), "src/app/actions/evidence-intelligence.ts"),
      "utf8",
    );
    assert.match(src, /assertCanViewTenderAnalysis/);
    assert.match(src, /getEvidenceIntelligenceForSession/);
  });
});

describe("data safety — read-only wiring", () => {
  const forbidden = [
    /consumeAnalysisCredit/,
    /createSmartAlert/,
    /prisma\.tenderEvidence\.(create|update|delete)/,
    /prisma\.tenderRequirement\.(create|update|delete)/,
    /finalizeTenderDecision/,
  ];

  it("domain build has no side effects on input evidence", () => {
    const rows = [
      ev({
        id: "e1",
        requirementId: "r1",
        evidenceText: "stable",
        verificationStatus: "INFERRED",
      }),
    ];
    const before = structuredClone(rows);
    buildEvidenceIntelligence({
      verificationIntelligence: buildVerificationIntelligence({
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
      }),
      complianceMatrix: [],
      evidence: rows,
      requirements: [{ id: "r1", category: "TECH", status: "UNCERTAIN" }],
    });
    assert.deepEqual(rows, before);
  });

  it("application module does not import billing or mutation paths", async () => {
    const src = await readFile(
      join(process.cwd(), "src/application/evidence-intelligence.ts"),
      "utf8",
    );
    for (const pattern of forbidden) {
      assert.ok(!pattern.test(src), `forbidden pattern ${pattern}`);
    }
  });
});

describe("executive summary helper", () => {
  it("buildEvidenceReadinessSummary excludes NOT_APPLICABLE from totals", () => {
    const rs = buildEvidenceReadinessSummary([
      {
        requirementId: "r1",
        requirement: "A",
        mandatory: true,
        requirementType: "Tech",
        requirementMatchStatus: "MATCHED",
        evidenceState: "VERIFIED",
        requirementVerificationStatus: "VERIFIED",
        relevanceReason: null,
        readinessImpact: "READY",
        readinessImpactLabel: "Ready",
        decisionImpactNote: null,
        evidence: null,
        sourceBasis: "UNKNOWN",
        locationLabel: null,
        teamTaskId: "t1",
      },
      {
        requirementId: "r2",
        requirement: "B",
        mandatory: false,
        requirementType: "Info",
        requirementMatchStatus: null,
        evidenceState: "UNKNOWN",
        requirementVerificationStatus: "NOT_APPLICABLE",
        relevanceReason: null,
        readinessImpact: "NOT_APPLICABLE",
        readinessImpactLabel: "N/A",
        decisionImpactNote: null,
        evidence: null,
        sourceBasis: "UNKNOWN",
        locationLabel: null,
        teamTaskId: null,
      },
    ]);
    assert.equal(rs.totalRequirements, 1);
    assert.equal(rs.supported, 1);
  });
});

describe("permission denial contract", () => {
  it("AppError FORBIDDEN exists for access denial", () => {
    const err = new AppError(ErrorCode.FORBIDDEN, "denied", 403);
    assert.equal(err.status, 403);
  });
});
