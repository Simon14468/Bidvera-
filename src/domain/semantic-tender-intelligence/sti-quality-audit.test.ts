/**
 * Architectural failure classes found in the final quality audit.
 * Proves general capabilities — not tender-specific patches.
 */

import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { evaluateCanonicalEntryGate } from "./entry-gate";
import { interpretSemanticStatement } from "./interpret";
import { fuseSemanticSituation } from "./semantic-situation";
import { resolveSemanticActor } from "./actor";
import { resolveRecipient } from "./recipient";
import { classifyProcurementPhase } from "./phase";
import { classifyClausePurpose } from "./clause-purpose";
import { detectTemplateStatus } from "./template";
import { detectMetadataFact } from "./metadata";
import { isObligationBoundaryComplete } from "./boundary";
import { normalizeRequirements } from "@/domain/tender-requirements/normalize";
import { matchRequirementToKnowledge } from "@/domain/company-knowledge/match";
import type { CompanyKnowledge } from "@/domain/company-knowledge/types";
import { resolveIntelligenceForCanonicalRead } from "@/application/canonical-tender-analysis";
import type { TenderIntelligenceBreakdown } from "@/domain/tender-intelligence";
import {
  freezeCanonicalAnalysisSnapshot,
  isStalePreFirewallSnapshot,
} from "@/domain/tender-intelligence/canonical-snapshot";

function interp(text: string) {
  return interpretSemanticStatement({
    text,
    provenance: { sourceDocument: "pack.pdf", sourcePage: 1 },
  });
}

function fuse(text: string) {
  const actor = resolveSemanticActor(text).actor;
  const recipient = resolveRecipient({ text, actor });
  const documentRole = "UNKNOWN" as const;
  const sectionRole = "UNKNOWN" as const;
  const template = detectTemplateStatus(text);
  const phase = classifyProcurementPhase({ text, actor, documentRole, sectionRole });
  const purpose = classifyClausePurpose({
    text,
    documentRole,
    sectionRole,
    actor,
    recipient,
    phase,
    templateStatus: template.status,
    isMetadata: detectMetadataFact(text).isMetadata,
    boundaryComplete: isObligationBoundaryComplete(text),
  });
  return fuseSemanticSituation({
    text,
    actor,
    recipient,
    candidatePhase: phase,
    candidatePurpose: purpose,
    documentRole,
    sectionRole,
    templateStatus: template.status,
    isMetadata: detectMetadataFact(text).isMetadata,
    boundaryComplete: isObligationBoundaryComplete(text),
    isBidderRequirementHint: resolveSemanticActor(text).isBidderRequirementHint,
  });
}

describe("quality audit — uncertainty never becomes admission", () => {
  it("admissionBlockedByUncertainty equals uncertaintyPreserved (no bid-time waiver)", () => {
    for (const text of [
      "The Bidder shall submit a methodology with its proposal, and after award the Contractor shall install and commission the equipment on site.",
      "The successful bidder shall perform the services.",
      "The Bidder shall submit a signed Form of Tender with the proposal.",
    ]) {
      const fused = fuse(text);
      assert.equal(
        fused.snapshot.admissionBlockedByUncertainty,
        fused.snapshot.uncertaintyPreserved,
        text,
      );
    }
  });

  it("UNKNOWN procurement phase is never admitted", () => {
    const gate = evaluateCanonicalEntryGate({
      clauseRole: "BIDDER_REQUIREMENT",
      actor: "BIDDER",
      procurementPhase: "UNKNOWN",
      applicability: "UNCONDITIONAL",
      templateStatus: "NOT_TEMPLATE",
      boundaryComplete: true,
      bidderRelevant: true,
      hasProvenance: true,
      conditionalUnresolved: false,
    });
    assert.equal(gate.admit, false);
    assert.equal(gate.exclusionCode, "AMBIGUOUS_PHASE");
  });
});

describe("quality audit — actor identity is not invented", () => {
  it("impersonal methodology obligation is not promoted to BIDDER", () => {
    const s = interp("A detailed methodology is required.");
    assert.notEqual(s.actor, "BIDDER");
    assert.equal(s.admitToCanonical, false);
  });

  it("unattributed documentary evidence keeps actor UNKNOWN and still admits", () => {
    const s = interp("A copy of the tax clearance certificate is required.");
    assert.equal(s.actor, "UNKNOWN");
    assert.equal(s.clausePurpose, "REQUIRED_DOCUMENT");
    assert.equal(s.admitToCanonical, true);
    assert.equal(s.situation?.unattributedDocumentaryEvidence, true);
  });

  it("unattributed commercial conditions keep actor UNKNOWN and still admit", () => {
    const s = interp("Prices shall remain firm and non-revisable during bid validity.");
    assert.equal(s.actor, "UNKNOWN");
    assert.equal(s.clausePurpose, "COMMERCIAL");
    assert.equal(s.admitToCanonical, true);
    assert.equal(s.situation?.unattributedCommercialEvidence, true);
  });

  it("unattributed eligibility evidence keeps actor UNKNOWN and still admits", () => {
    const s = interp(
      "Minimum five (5) years of experience in public-sector installation projects is required.",
    );
    assert.equal(s.actor, "UNKNOWN");
    assert.equal(s.clausePurpose, "ELIGIBILITY");
    assert.equal(s.admitToCanonical, true);
    assert.equal(s.situation?.unattributedEligibilityEvidence, true);
  });
});

describe("quality audit — sealed STI category is not rewritten", () => {
  it("trustStiSemantics does not infer a new domain from keywords", () => {
    const [row] = normalizeRequirements(
      [
        {
          category: "CONTRACTUAL",
          description:
            "The Bidder shall submit ISO 27001 certification with the proposal including technical specifications.",
          mandatory: true,
          sti: {
            actor: "BIDDER",
            recipient: "BIDDER",
            clauseRole: "REQUIRED_SUBMISSION_DOCUMENT",
            clausePurpose: "REQUIRED_DOCUMENT",
            documentRole: "INSTRUCTIONS_TO_BIDDERS",
            sectionRole: "REQUIRED_DOCUMENTS",
            procurementPhase: "BID_SUBMISSION",
            semanticKind: "REQUIRED_DOCUMENT",
            obligationStrength: "MANDATORY",
            conditionText: null,
            applicability: "UNCONDITIONAL",
            templateStatus: "NOT_TEMPLATE",
            confidence: 0.9,
            lotApplicability: null,
            provenance: [],
            bidderRelevant: true,
          },
        },
      ],
      { trustStiSemantics: true },
    );
    assert.ok(row);
    assert.equal(row.category, "CONTRACTUAL");
    assert.equal(row.semanticKind, "REQUIRED_DOCUMENT");
  });
});

describe("quality audit — stale pre-firewall snapshot is not resurrected", () => {
  it("isStalePreFirewallSnapshot is true without an STI admission stamp", () => {
    const snap = freezeCanonicalAnalysisSnapshot({
      tenderId: "t1",
      packageLabel: "pack",
      discoveredFileCount: 1,
      files: [{ fileName: "a.pdf", processingStatus: "COMPLETED", role: "CPS", error: null }],
      metadata: {
        title: "T",
        client: null,
        deadlineIso: null,
        deadlineTimezone: null,
        factsNote: null,
        metadataStatus: null,
      },
      requirementIds: ["r1"],
      summary: {
        totalRequirements: 1,
        ready: 0,
        missing: 0,
        verify: 1,
        notApplicable: 0,
        unknown: 0,
        sources: 1,
        risks: 0,
        requiredActions: 1,
        clarifications: 0,
      },
    });
    assert.equal(isStalePreFirewallSnapshot(snap), true);
    assert.equal(isStalePreFirewallSnapshot(null), true);
  });

  it("canonical read hydrates stored intelligence instead of rebuilding from raw text", () => {
    const stored: TenderIntelligenceBreakdown = {
      complianceStatus: "COMPLETE",
      analysisMode: "TENDER",
      complianceMatrix: [
        {
          id: "CM-r1",
          requirementId: "r1",
          requirement: "The Bidder shall submit Form of Tender with the proposal.",
          requirementType: "Documentation",
          mandatory: true,
          priority: "HIGH",
          status: "VERIFY",
          companyFit: null,
          sourceDocument: "pack.pdf",
          pageNumber: 1,
          section: null,
          evidence: "Form of Tender",
          tenderSource: null,
          companyEvidence: null,
          companyEvidenceMessage: null,
          notes: null,
          sourceBasis: "DIRECT_SOURCE",
          sourceLocated: true,
          evidenceId: null,
          risk: null,
          requiredAction: null,
        },
      ],
      complianceSummary: {
        totalRequirements: 1,
        ready: 0,
        missing: 0,
        verify: 1,
        notApplicable: 0,
        unknown: 0,
        sources: 1,
        risks: 0,
        requiredActions: 1,
        clarifications: 0,
      },
      risks: [],
      contradictions: [],
      clarificationQuestions: [],
      keyBlockers: [],
      decisionContext: "stored",
      learningSignal: null,
      decisionGuardian: null,
      canonicalSnapshot: freezeCanonicalAnalysisSnapshot({
        tenderId: "t1",
        packageLabel: "pack",
        discoveredFileCount: 1,
        files: [{ fileName: "a.pdf", processingStatus: "COMPLETED", role: "CPS", error: null }],
        metadata: {
          title: "T",
          client: null,
          deadlineIso: null,
          deadlineTimezone: null,
          factsNote: null,
          metadataStatus: null,
        },
        requirementIds: ["r1"],
        summary: {
          totalRequirements: 1,
          ready: 0,
          missing: 0,
          verify: 1,
          notApplicable: 0,
          unknown: 0,
          sources: 1,
          risks: 0,
          requiredActions: 1,
          clarifications: 0,
        },
      }),
    };

    const resolved = resolveIntelligenceForCanonicalRead({
      scoringBlocked: false,
      companyKnowledgeOnly: false,
      storedAnalysisStale: true,
      stored,
      buildFallback: () => {
        throw new Error("must not rebuild stale pre-firewall analysis from raw text");
      },
      hydrate: (s) => s,
    });
    assert.equal(resolved.complianceStatus, "COMPLETE");
    assert.equal(resolved.complianceMatrix.length, 1);
  });
});

describe("quality audit — company fit is not a token-overlap green", () => {
  it("shared long tokens in an unrelated project do not create a MATCHED fit", () => {
    const provenance = {
      sourceDocument: "profile.pdf",
      page: 1 as const,
      section: null,
      originalValue: "x",
      normalizedValue: "x",
      confidence: "INFERRED" as const,
      excerpt: null,
    };
    const knowledge: CompanyKnowledge = {
      documentKind: "COMPANY_PROFILE",
      classificationConfidence: 1,
      classificationSignals: [],
      identity: {
        companyName: "Acme",
        legalStructure: null,
        industry: null,
        sector: null,
        location: null,
        country: null,
        companySize: null,
        employees: null,
        foundedYear: null,
        experienceYears: null,
      },
      services: [],
      capabilities: [],
      technologies: [],
      projects: [
        {
          name: "Internal scheduling platform",
          clientSector: "private",
          description: "Required detailed platform scheduling for staff",
          approximateValue: null,
          duration: null,
          status: null,
          technologies: [],
          provenance,
        },
      ],
      certifications: [],
      policies: [],
      insurance: [],
      geographicCoverage: [],
      contractCapacity: {
        preferredMin: null,
        preferredMax: null,
        preferredMaxNumeric: null,
        notes: null,
        provenance: null,
      },
      operationalCapacity: {
        totalEmployees: null,
        developers: null,
        projectManagers: null,
        qa: null,
        typicalConcurrentProjects: null,
        typicalDuration: null,
        typicalDurationMonthsMin: null,
        typicalDurationMonthsMax: null,
        notes: [],
        provenance: null,
      },
      strengths: [],
      limitations: [],
      tenderPreferences: [],
      historicalOutcomes: [],
      extraFacts: [],
      sourceDocuments: ["profile.pdf"],
      extractedAt: new Date().toISOString(),
    };

    const match = matchRequirementToKnowledge({
      requirement: "A detailed methodology is required for the proposed platform.",
      category: "MANDATORY_TECHNICAL",
      mandatory: true,
      knowledge,
    });
    assert.notEqual(match.status, "MATCHED");
  });
});
