/**
 * UNKNOWN semantic kind / high-confidence invariant — authoritative normalize layer.
 * Regression for clarification Q&A + obligation-like wording falsely becoming
 * mandatory HIGH-confidence UNKNOWN rows.
 */

import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { normalizeRequirements } from "./normalize";
import {
  classifyRequirementSemanticKind,
  deriveObligationStrength,
  isScoringSemanticKind,
} from "./semantic-kind";

describe("UNKNOWN semantic kind confidence invariant", () => {
  it("UNKNOWN + obligation-like wording never becomes mandatory or HIGH confidence", () => {
    const text =
      "The bidder shall comply with all site access and safety induction rules published by the contracting authority.";
    const kind = classifyRequirementSemanticKind({ description: text });
    assert.equal(kind, "UNKNOWN");
    assert.equal(deriveObligationStrength(text, "UNKNOWN"), "INFORMATIONAL");

    const out = normalizeRequirements([
      {
        category: "other",
        description: text,
        mandatory: true,
        evidenceText: text,
        sourcePage: 12,
      },
    ]);
    assert.equal(out.length, 1);
    assert.equal(out[0]!.semanticKind, "UNKNOWN");
    assert.equal(out[0]!.mandatory, false);
    assert.equal(out[0]!.confidence, "UNCERTAIN");
    assert.notEqual(out[0]!.obligationStrength, "MANDATORY");
  });

  it("UNKNOWN obligation-like French TVA fragment stays UNCERTAIN / non-mandatory when not clarification", () => {
    const text =
      "Étant donné que le contrat pourrait impliquer l'existence d'un établissement permanent au Maroc, le consultant doit appliquer la TVA conformément à la réglementation locale.";
    const kind = classifyRequirementSemanticKind({ description: text, existingCategory: "other" });
    // Without the confirmation question this remains UNKNOWN (do not invent a kind).
    assert.equal(kind, "UNKNOWN");
    const out = normalizeRequirements([
      {
        category: "other",
        description: text,
        mandatory: true,
        evidenceText: text,
        sourcePage: 4,
      },
    ]);
    assert.equal(out.length, 1);
    assert.equal(out[0]!.semanticKind, "UNKNOWN");
    assert.equal(out[0]!.confidence, "UNCERTAIN");
    assert.equal(out[0]!.mandatory, false);
  });

  it("clarification Q&A with doit/must is CLARIFICATION_PROCEDURAL — excluded from scoring set", () => {
    const text =
      "Étant donné que le contrat pourrait impliquer l'existence d'un établissement permanent au Maroc, le consultant doit appliquer la TVA conformément à la réglementation locale. Pouvez-vous confirmer si l'entité contractante bénéficie d'une exonération de TVA au Royaume du Maroc, et si cette exonération serait également applicable au consultant ?";
    const kind = classifyRequirementSemanticKind({ description: text });
    assert.equal(kind, "CLARIFICATION_PROCEDURAL");
    assert.equal(isScoringSemanticKind(kind), false);
    const out = normalizeRequirements([
      {
        category: "contractual",
        description: text,
        mandatory: true,
        evidenceText: text,
        sourcePage: 4,
      },
    ]);
    assert.equal(out.length, 0);
  });

  it("clarification answer / PE confirmation is CLARIFICATION_PROCEDURAL", () => {
    const text =
      "L'Autorité contractante confirme que les soumissionnaires ne sont pas tenus d'assurer une présence régionale permanente dans chacune des quatre régions.";
    assert.equal(
      classifyRequirementSemanticKind({ description: text }),
      "CLARIFICATION_PROCEDURAL",
    );
    assert.equal(
      normalizeRequirements([
        { category: "administrative", description: text, mandatory: true, evidenceText: text, sourcePage: 2 },
      ]).length,
      0,
    );
  });

  it("revision / modification notice is CLARIFICATION_PROCEDURAL", () => {
    const text =
      "This addendum amends clause 4.2: the bidder must submit the revised price schedule with the technical offer.";
    assert.equal(
      classifyRequirementSemanticKind({ description: text }),
      "CLARIFICATION_PROCEDURAL",
    );
    assert.equal(
      normalizeRequirements([
        { category: "administrative", description: text, mandatory: true, evidenceText: text, sourcePage: 1 },
      ]).length,
      0,
    );
  });

  it("genuine mandatory requirement stays mandatory with domain kind", () => {
    const text =
      "The bidder must submit a valid tax-clearance certificate with the tender dossier.";
    const kind = classifyRequirementSemanticKind({ description: text });
    assert.equal(kind, "REQUIRED_DOCUMENT");
    const out = normalizeRequirements([
      {
        category: "administrative",
        description: text,
        mandatory: true,
        evidenceText: text,
        sourcePage: 5,
      },
    ]);
    assert.equal(out.length, 1);
    assert.equal(out[0]!.obligationStrength, "MANDATORY");
    assert.equal(out[0]!.mandatory, true);
    assert.ok(out[0]!.confidence === "HIGH" || out[0]!.confidence === "MEDIUM");
  });

  it("genuine conditional requirement retains trigger and is not mandatory", () => {
    const text =
      "If applicable, the bidder must provide a local content certificate issued by the relevant authority.";
    const out = normalizeRequirements([
      {
        category: "administrative",
        description: text,
        mandatory: true,
        evidenceText: text,
        sourcePage: 6,
      },
    ]);
    assert.equal(out.length, 1);
    assert.equal(out[0]!.obligationStrength, "CONDITIONAL");
    assert.equal(out[0]!.mandatory, false);
    assert.match(out[0]!.requirement, /if applicable/i);
  });

  it("informational fact does not enter scoring canonical set", () => {
    const text = "Estimated contract value: MAD 500,000. Publication date: 1 January 2026.";
    const kind = classifyRequirementSemanticKind({ description: text });
    assert.equal(kind, "INFORMATIONAL_FACT");
    assert.equal(
      normalizeRequirements([
        { category: "informational", description: text, mandatory: false, evidenceText: text, sourcePage: 1 },
      ]).length,
      0,
    );
  });

  it("heading / procedural text does not enter scoring canonical set", () => {
    const heading = "2. Mandatory Administrative Requirements.";
    const procedural =
      "A pre-bid meeting will be held on 10 February 2026 for clarification of tender procedures.";
    assert.ok(!isScoringSemanticKind(classifyRequirementSemanticKind({ description: heading })));
    assert.ok(!isScoringSemanticKind(classifyRequirementSemanticKind({ description: procedural })));
    assert.equal(
      normalizeRequirements([
        { category: "administrative", description: heading, mandatory: false },
        { category: "administrative", description: procedural, mandatory: false },
      ]).length,
      0,
    );
  });

  it("merge must not upgrade UNKNOWN confidence to HIGH", () => {
    const text =
      "The bidder shall comply with all site access and safety induction rules published by the contracting authority.";
    const out = normalizeRequirements([
      {
        category: "other",
        description: text,
        mandatory: true,
        evidenceText: text,
        sourcePage: 1,
      },
      {
        category: "other",
        description: text,
        mandatory: true,
        evidenceText: `${text} Additional evidence.`,
        sourcePage: 2,
      },
    ]);
    assert.equal(out.length, 1);
    assert.equal(out[0]!.semanticKind, "UNKNOWN");
    assert.equal(out[0]!.confidence, "UNCERTAIN");
    assert.equal(out[0]!.mandatory, false);
  });
});
