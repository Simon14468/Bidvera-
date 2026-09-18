/**
 * Regression: conditional obligation trigger context must survive the canonical pipeline.
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  assertAnalysisReadyForCompletion,
  buildCanonicalRequirements,
  deriveObligationStrength,
  hasConditionalTriggerContext,
  mergeNormalizedRequirements,
  normalizeRequirements,
  reconcileConditionalObligation,
  toHeuristicDraft,
} from "@/domain/tender-requirements";
import type { NormalizedRequirement } from "@/domain/tender-requirements";

function baseReq(
  partial: Partial<NormalizedRequirement> & Pick<NormalizedRequirement, "requirement">,
): NormalizedRequirement {
  return {
    category: "MANDATORY_ADMINISTRATIVE",
    semanticKind: "GUARANTEE_SECURITY_REQUIREMENT",
    obligationStrength: "MANDATORY",
    title: "Bond",
    mandatory: true,
    confidence: "MEDIUM",
    ...partial,
  };
}

describe("conditional obligation context preservation", () => {
  it("provisional bond without trigger is MANDATORY, not invented CONDITIONAL", () => {
    const text = "Provisional bond / caution provisoire required";
    assert.equal(
      deriveObligationStrength(text, "GUARANTEE_SECURITY_REQUIREMENT"),
      "MANDATORY",
    );
    assert.equal(hasConditionalTriggerContext(text), false);

    const out = normalizeRequirements([
      {
        category: "MANDATORY_ADMINISTRATIVE",
        description: text,
        mandatory: true,
        evidenceText: "caution provisoire MAD 50,000",
      },
    ]);
    assert.equal(out.length, 1);
    assert.equal(out[0]!.obligationStrength, "MANDATORY");
    assert.equal(out[0]!.mandatory, true);
  });

  it("conditional requirement with explicit trigger stays CONDITIONAL with trigger text", () => {
    const text =
      "• R-13 (conditional) If the bidder proposes equipment manufactured outside Morocco, the bidder must provide evidence of manufacturer authorization.";
    assert.equal(deriveObligationStrength(text, "REQUIRED_DOCUMENT"), "CONDITIONAL");
    assert.ok(hasConditionalTriggerContext(text));

    const out = normalizeRequirements([
      {
        category: "MANDATORY_ADMINISTRATIVE",
        description: text,
        mandatory: false,
        sourceSection: "5. Conditional Requirement",
      },
    ]);
    assert.equal(out.length, 1);
    assert.equal(out[0]!.obligationStrength, "CONDITIONAL");
    assert.equal(out[0]!.mandatory, false);
    assert.match(out[0]!.requirement, /if the bidder/i);
  });

  it("dedupe prefers trigger-bearing text over short unconditional paraphrase", () => {
    const short = "Provisional bond / caution provisoire of MAD 50,000 required";
    const conditional =
      "If applicable, a provisional bond (caution provisoire) of MAD 50,000 must be submitted with the dossier.";

    const merged = mergeNormalizedRequirements([
      baseReq({
        requirement: short,
        obligationStrength: "MANDATORY",
        mandatory: true,
        evidenceText: short,
      }),
      baseReq({
        requirement: conditional,
        obligationStrength: "CONDITIONAL",
        mandatory: false,
        evidenceText: conditional,
      }),
    ]);

    assert.equal(merged.length, 1);
    assert.equal(merged[0]!.obligationStrength, "CONDITIONAL");
    assert.equal(merged[0]!.mandatory, false);
    assert.ok(hasConditionalTriggerContext(merged[0]!.requirement));
    assert.match(merged[0]!.requirement, /if applicable/i);
  });

  it("persistence + rehydration preserves conditional trigger via requirement text", () => {
    const text =
      "If the bidder is selected, a provisional bond (caution provisoire) must be provided with the tender dossier.";
    const canonical = buildCanonicalRequirements({
      heuristicDrafts: [
        {
          category: "MANDATORY_ADMINISTRATIVE",
          description: text,
          mandatory: false,
          evidenceText: text,
          sourceSection: "Provisional bond / caution",
        },
      ],
    });
    assert.equal(canonical[0]!.obligationStrength, "CONDITIONAL");

    // Simulate DB round-trip (description + evidence only — strength is re-derived).
    const drafts = canonical.map(toHeuristicDraft);
    const rehydrated = normalizeRequirements(drafts);
    assert.equal(rehydrated.length, 1);
    assert.equal(rehydrated[0]!.obligationStrength, "CONDITIONAL");
    assert.ok(hasConditionalTriggerContext(rehydrated[0]!.requirement));
    assert.equal(rehydrated[0]!.mandatory, false);
  });

  it("missing trigger context must not crash the pipeline — fails safe as NEEDS_VERIFICATION", () => {
    const orphan = baseReq({
      id: "req-orphan",
      requirement: "Provisional bond / caution provisoire required...",
      obligationStrength: "CONDITIONAL",
      mandatory: true,
      evidenceText: "caution provisoire",
    });

    const repaired = reconcileConditionalObligation(orphan);
    assert.notEqual(repaired.obligationStrength, "CONDITIONAL");
    assert.equal(repaired.mandatory, false);
    assert.equal(repaired.confidence, "UNCERTAIN");
    assert.match(repaired.verificationReason ?? "", /needs verification/i);

    const requirements = [orphan];
    assert.doesNotThrow(() =>
      assertAnalysisReadyForCompletion({
        requirements,
        intelligence: {
          complianceMatrix: [
            {
              id: "m1",
              requirementId: "req-orphan",
              requirement: orphan.requirement,
              requirementType: orphan.category,
              mandatory: false,
              priority: "MEDIUM",
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
              sourceBasis: "TENDER",
              sourceLocated: false,
              evidenceId: null,
            },
          ],
          complianceSummary: {
            totalRequirements: 1,
            ready: 0,
            missing: 0,
            verify: 1,
            notApplicable: 0,
            unknown: 0,
            sources: 0,
            risks: 0,
            requiredActions: 0,
            clarifications: 0,
          },
          risks: [],
          contradictions: [],
          clarificationQuestions: [],
          keyBlockers: [],
          decisionContext: "",
          learningSignal: null,
        } as never,
      }),
    );
    assert.notEqual(requirements[0]!.obligationStrength, "CONDITIONAL");
  });

  it("unconditional mandatory requirements behave as before", () => {
    const text = "The supplier must provide 24/7 on-site support during the warranty period.";
    const out = normalizeRequirements([
      { category: "MANDATORY_TECHNICAL", description: text, mandatory: true },
    ]);
    assert.equal(out.length, 1);
    assert.equal(out[0]!.obligationStrength, "MANDATORY");
    assert.equal(out[0]!.mandatory, true);
  });
});
