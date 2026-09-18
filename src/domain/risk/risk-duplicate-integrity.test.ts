/**
 * Risk Engine duplicate integrity — certification and cross-source identity.
 */

import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  assertRiskConsistency,
  canonicalRiskIdentity,
  dedupeRiskAssessments,
  underlyingRiskKey,
} from "@/domain/risk/assess";
import { buildCanonicalStructuredRisks } from "@/domain/risk/build";
import type { ComplianceRow } from "@/domain/tender-intelligence/types";

function matrixRow(
  over: Partial<ComplianceRow> & { requirementId: string; requirement: string },
): ComplianceRow {
  return {
    id: `CM-${over.requirementId}`,
    requirementId: over.requirementId,
    requirement: over.requirement,
    requirementType: over.requirementType ?? "CONTRACTUAL",
    mandatory: over.mandatory ?? true,
    priority: over.priority ?? "HIGH",
    status: over.status ?? "MISSING",
    companyFit: null,
    sourceDocument: over.sourceDocument ?? "spec.pdf",
    pageNumber: over.pageNumber ?? 1,
    section: null,
    evidence: over.evidence ?? over.requirement,
    tenderSource: null,
    companyEvidence: null,
    companyEvidenceMessage: null,
    notes: null,
    sourceBasis: "DIRECT_SOURCE",
    sourceLocated: true,
    evidenceId: null,
    risk: null,
    requiredAction: "Resolve gap",
    evidenceState: over.evidenceState ?? "CONFIRMED_NON_COMPLIANT",
    verificationStatus: over.verificationStatus ?? "NEEDS_VERIFICATION",
  };
}

describe("risk duplicate integrity A–G", () => {
  it("A. exact duplicate certification risk collapses to one", () => {
    const desc =
      'Required certification "Cyber Essentials Plus" is not listed on the company profile — verification needed';
    const risks = buildCanonicalStructuredRisks({
      matrix: [],
      requirements: [
        {
          id: "r-ce",
          category: "Certification",
          description: "Cyber Essentials Plus certification required",
          mandatory: true,
          status: "FAILED",
          evidence: "not listed",
          fitStatus: "CONFIRMED_GAP",
          sourceDocument: "Company_Profile.pdf",
        },
      ],
      findings: [],
      existingRisks: [
        {
          id: "ex-1",
          category: "certification",
          description: desc,
          severity: "HIGH",
          sourcePage: null,
          mitigation: null,
        },
        {
          id: "ex-2",
          category: "certification",
          description: desc,
          severity: "HIGH",
          sourcePage: null,
          mitigation: null,
        },
      ],
      documentName: "pack.pdf",
    });
    const certRisks = risks.filter((r) => /cyber essentials/i.test(r.title + r.explanation));
    assert.equal(certRisks.length, 1);
    assert.doesNotThrow(() =>
      assertRiskConsistency(
        risks.map((r) => ({
          title: r.title,
          severity: r.severityCanonical ?? r.severity,
          evidenceState: r.evidenceState,
          fitStatus: r.fitStatus,
          requirementId: r.requirementId,
          linkedRequirementIds: r.linkedRequirementIds,
          whyRisky: r.whyRisky,
          explanation: r.explanation,
          sourceDocument: r.source.document,
          underlyingKey: r.underlyingKey,
        })),
      ),
    );
  });

  it("B. same certification issue from two documents collapses", () => {
    const risks = buildCanonicalStructuredRisks({
      matrix: [
        matrixRow({
          requirementId: "r1",
          requirement: "Cyber Essentials Plus certification required",
          sourceDocument: "ITT.docx",
        }),
        matrixRow({
          requirementId: "r2",
          requirement: "The supplier must hold Cyber Essentials Plus",
          sourceDocument: "Appendix-C.docx",
        }),
      ],
      requirements: [
        {
          id: "r1",
          category: "Certification",
          description: "Cyber Essentials Plus certification required",
          mandatory: true,
          status: "FAILED",
          evidence: "not held",
          fitStatus: "CONFIRMED_GAP",
          sourceDocument: "Company_Profile.pdf",
          semanticKind: "ELIGIBILITY_REQUIREMENT",
        },
        {
          id: "r2",
          category: "Certification",
          description: "The supplier must hold Cyber Essentials Plus",
          mandatory: true,
          status: "FAILED",
          evidence: "not held",
          fitStatus: "CONFIRMED_GAP",
          sourceDocument: "Company_Profile.pdf",
          semanticKind: "ELIGIBILITY_REQUIREMENT",
        },
      ],
      findings: [],
      existingRisks: [],
      documentName: "Scottish.zip",
    });
    assert.equal(risks.length, 1);
    assert.ok((risks[0]!.linkedRequirementIds?.length ?? 0) >= 2);
    assert.match(risks[0]!.underlyingKey ?? "", /cert:cyber essentials/i);
  });

  it("C. same issue linked to multiple evidence records still one risk", () => {
    const items = [
      {
        underlyingKey: "cert:iso 27001",
        severity: "CRITICAL" as const,
        requirementId: "r1",
        title: "ISO 27001 not held",
      },
      {
        underlyingKey: "cert:iso 27001",
        severity: "HIGH" as const,
        requirementId: "r1",
        title: "ISO 27001 evidence missing",
      },
      {
        underlyingKey: "cert:iso 27001",
        severity: "CRITICAL" as const,
        requirementId: "r1",
        title: "ISO 27001 certification gap",
      },
    ];
    const out = dedupeRiskAssessments(items);
    assert.equal(out.length, 1);
    assert.equal(out[0]!.severity, "CRITICAL");
    assert.deepEqual(out[0]!.linkedRequirementIds, ["r1"]);
  });

  it("D. two genuinely different certification requirements stay separate", () => {
    const risks = buildCanonicalStructuredRisks({
      matrix: [
        matrixRow({
          requirementId: "r-iso",
          requirement: "ISO 27001 certification is mandatory",
        }),
        matrixRow({
          requirementId: "r-ce",
          requirement: "Cyber Essentials Plus certification required",
        }),
      ],
      requirements: [
        {
          id: "r-iso",
          category: "Certification",
          description: "ISO 27001 certification is mandatory",
          mandatory: true,
          status: "FAILED",
          evidence: "not_held: ISO 27001",
          fitStatus: "CONFIRMED_GAP",
          sourceDocument: "Company_Profile.pdf",
          semanticKind: "ELIGIBILITY_REQUIREMENT",
        },
        {
          id: "r-ce",
          category: "Certification",
          description: "Cyber Essentials Plus certification required",
          mandatory: true,
          status: "FAILED",
          evidence: "not listed",
          fitStatus: "CONFIRMED_GAP",
          sourceDocument: "Company_Profile.pdf",
          semanticKind: "ELIGIBILITY_REQUIREMENT",
        },
      ],
      findings: [],
      existingRisks: [],
      documentName: "pack.pdf",
    });
    assert.equal(risks.length, 2);
    const keys = new Set(risks.map((r) => r.underlyingKey));
    assert.equal(keys.size, 2);
    assert.ok([...keys].some((k) => /iso\s*27001/i.test(k ?? "")));
    assert.ok([...keys].some((k) => /cyber essentials/i.test(k ?? "")));
  });

  it("E. different certification categories/severities remain distinct when issues differ", () => {
    const k1 = underlyingRiskKey({
      category: "COMPLIANCE",
      description: "ISO 9001 certification required",
    });
    const k2 = underlyingRiskKey({
      category: "COMPLIANCE",
      description: "ISO 27001 certification required",
    });
    assert.notEqual(k1, k2);
    assert.notEqual(
      canonicalRiskIdentity({ underlyingKey: k1, title: "certification" }),
      canonicalRiskIdentity({ underlyingKey: k2, title: "certification" }),
    );
  });

  it("F. duplicate risk after persistence/rehydration collapses with matrix risk", () => {
    const risks = buildCanonicalStructuredRisks({
      matrix: [
        matrixRow({
          requirementId: "r-iso",
          requirement: "ISO 27001 certification is mandatory",
        }),
      ],
      requirements: [
        {
          id: "r-iso",
          category: "Certification",
          description: "ISO 27001 certification is mandatory",
          mandatory: true,
          status: "FAILED",
          evidence: "Company profile explicitly states certification ISO 27001 is not held.",
          fitStatus: "CONFIRMED_GAP",
          sourceDocument: "Company_Profile.pdf",
          semanticKind: "ELIGIBILITY_REQUIREMENT",
        },
      ],
      findings: [
        {
          code: "CERT_EXPLICITLY_NOT_HELD",
          severity: "CRITICAL",
          category: "certification",
          description: "ISO 27001 not held",
          forcesDecision: "NO_BID",
          requirementIndex: 0,
        },
      ],
      existingRisks: [
        {
          id: "persisted-1",
          category: "certification",
          description: 'Company profile explicitly states certification "ISO 27001" is not held.',
          severity: "CRITICAL",
          sourcePage: null,
          mitigation: null,
        },
        {
          id: "persisted-2",
          category: "certification",
          description: 'Company profile explicitly states certification "ISO 27001" is not held.',
          severity: "CRITICAL",
          sourcePage: null,
          mitigation: null,
        },
      ],
      documentName: "pack.pdf",
    });
    const iso = risks.filter((r) => /iso\s*27001/i.test(`${r.title} ${r.explanation} ${r.underlyingKey}`));
    assert.equal(iso.length, 1);
    assert.ok(iso[0]!.requirementId === "r-iso" || (iso[0]!.linkedRequirementIds ?? []).includes("r-iso"));
  });

  it("G. legitimate distinct risks must remain separate (cert + geography)", () => {
    const risks = buildCanonicalStructuredRisks({
      matrix: [],
      requirements: [
        {
          id: "r-gap",
          category: "Eligibility",
          description: "Must operate in Scotland",
          mandatory: true,
          status: "FAILED",
          evidence: "coverage gap",
          fitStatus: "CONFIRMED_GAP",
          sourceDocument: "Company_Profile.pdf",
        },
      ],
      findings: [],
      existingRisks: [
        {
          id: "c1",
          category: "certification",
          description: 'Required certification "Cyber Essentials Plus" is not listed on the company profile',
          severity: "HIGH",
          sourcePage: null,
          mitigation: null,
        },
        {
          id: "c2",
          category: "certification",
          description: 'Company profile explicitly states certification "ISO 27001" is not held.',
          severity: "CRITICAL",
          sourcePage: null,
          mitigation: null,
        },
        {
          id: "g1",
          category: "geography",
          description: "Geographic coverage requirement does not match company profile.",
          severity: "HIGH",
          sourcePage: null,
          mitigation: null,
        },
        {
          id: "g2",
          category: "geography",
          description: "Geographic coverage requirement does not match company profile.",
          severity: "HIGH",
          sourcePage: null,
          mitigation: null,
        },
      ],
      documentName: "pack.pdf",
    });
    // Exact geography dups collapse; two distinct certs remain; no bare "certification" title collision
    assert.ok(risks.length >= 3);
    assert.ok(risks.length <= 4);
    const titles = risks.map((r) => r.title.toLowerCase());
    assert.ok(!titles.every((t) => t === "certification"));
    assert.ok(titles.some((t) => /cyber essentials/i.test(t)));
    assert.ok(titles.some((t) => /iso\s*27001/i.test(t)));
    assert.doesNotThrow(() =>
      assertRiskConsistency(
        risks.map((r) => ({
          title: r.title,
          severity: r.severityCanonical ?? r.severity,
          evidenceState: r.evidenceState,
          fitStatus: r.fitStatus,
          requirementId: r.requirementId,
          linkedRequirementIds: r.linkedRequirementIds,
          whyRisky: r.whyRisky,
          explanation: r.explanation,
          sourceDocument: r.source.document,
          underlyingKey: r.underlyingKey,
        })),
      ),
    );
  });
});
