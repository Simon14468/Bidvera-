/**
 * Universal semantic situation — independent signals, conflict resolution,
 * uncertainty preservation. No tender-specific or country-specific rules.
 */

import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { interpretSemanticStatement } from "./interpret";
import { extractIndependentSignals } from "./semantic-signals";
import { fuseSemanticSituation } from "./semantic-situation";
import { resolveSemanticActor } from "./actor";
import { resolveRecipient } from "./recipient";
import { classifyProcurementPhase } from "./phase";
import { classifyClausePurpose } from "./clause-purpose";
import { detectTemplateStatus } from "./template";
import { detectMetadataFact } from "./metadata";
import { isObligationBoundaryComplete } from "./boundary";

const prov = {
  sourceDocument: "pack.pdf",
  sourcePage: 1,
  sourceSection: null,
  sourceCell: null,
  versionLabel: null,
};

function interp(
  text: string,
  ctx?: { documentRole?: string; sectionLabel?: string; fileName?: string },
) {
  return interpretSemanticStatement({
    text,
    provenance: { ...prov, sourceDocument: ctx?.fileName ?? "pack.pdf" },
    context: {
      packageDocumentRole: ctx?.documentRole ?? null,
      sectionLabel: ctx?.sectionLabel ?? null,
    },
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

describe("semantic situation — independent signals", () => {
  it("document role and section role are always weak", () => {
    const s = extractIndependentSignals({
      text: "The Bidder shall submit Form of Tender with the proposal.",
      actor: "BIDDER",
      recipient: "BIDDER",
      documentRole: "SAMPLE_CONTRACT",
      sectionRole: "CONTRACT_CONDITIONS",
      templateStatus: "NOT_TEMPLATE",
    });
    assert.equal(s.documentRole.strength, "WEAK");
    assert.equal(s.sectionRole.strength, "WEAK");
    assert.equal(s.actor.strength, "DECISIVE");
    assert.match(s.action.value, /SUBMIT_DISCLOSE|DEMONSTRATE_COMMIT/);
  });

  it("grammar actor is not interchangeable with temporal or action", () => {
    const s = extractIndependentSignals({
      text: "The Contractor shall install and commission the equipment after delivery.",
      actor: "CONTRACTOR",
      recipient: "CONTRACTOR",
      documentRole: "INSTRUCTIONS_TO_BIDDERS",
      sectionRole: "TECHNICAL_REQUIREMENTS",
      templateStatus: "NOT_TEMPLATE",
    });
    assert.equal(s.actor.value, "CONTRACTOR");
    assert.match(s.temporal.value, /POST_AWARD|CONTRACT|WARRANTY/);
    assert.equal(s.action.value, "EXECUTE_PERFORM");
  });
});

describe("semantic situation — weak labels never become truth", () => {
  it("filename / Q_AND_A package does not exclude a restated bidder obligation", () => {
    const s = interp("The Bidder shall submit ISO 9001 certification with the proposal.", {
      documentRole: "Q_AND_A",
      fileName: "09_questions.pdf",
    });
    assert.equal(s.admitToCanonical, true);
    assert.notEqual(s.clausePurpose, "Q_AND_A");
    assert.ok(s.situation);
  });

  it("amendment packaging does not erase a restated bidder duty", () => {
    const s = interp("The Bidder shall submit a signed Form of Tender with the proposal.", {
      documentRole: "AMENDMENT",
      fileName: "corrigendum-1.pdf",
    });
    assert.equal(s.admitToCanonical, true);
    assert.notEqual(s.clausePurpose, "AMENDMENT");
  });

  it("amendment metadata remains excluded", () => {
    const s = interp("Corrigendum 1 — This amendment supersedes Clause 12 of the ITB.");
    assert.equal(s.admitToCanonical, false);
  });

  it("technical section label does not convert a buyer duty into a bidder requirement", () => {
    const s = interp("The Purchaser shall evaluate the technical proposals.", {
      documentRole: "TECHNICAL_SPECIFICATION",
      sectionLabel: "Technical Requirements",
    });
    assert.equal(s.admitToCanonical, false);
    assert.equal(s.clausePurpose, "BUYER_OBLIGATION");
  });

  it("definitions section does not force DEFINITION when the clause is a bidder duty", () => {
    const s = interp("The Bidder shall provide three project references with the bid.", {
      sectionLabel: "Definitions",
    });
    assert.equal(s.admitToCanonical, true);
    assert.notEqual(s.clausePurpose, "DEFINITION");
  });
});

describe("semantic situation — conflict and uncertainty", () => {
  it("mixed pre-award and post-award frames preserve uncertainty", () => {
    const text =
      "The Bidder shall submit a methodology with its proposal, and after award the Contractor shall install and commission the equipment on site.";
    const s = interp(text);
    assert.equal(s.admitToCanonical, false);
    assert.equal(s.procurementPhase, "MIXED_OR_AMBIGUOUS");
    assert.equal(s.situation?.uncertaintyPreserved, true);
  });

  it("does not convert mixed uncertainty into a post-award factual purpose unless execution is the only frame", () => {
    const fused = fuse(
      "The Bidder shall submit a methodology with its proposal, and after award the Contractor shall install and commission the equipment on site.",
    );
    assert.equal(fused.phase, "MIXED_OR_AMBIGUOUS");
    assert.ok(fused.conflicts.some((c) => c.code === "MIXED_LIFECYCLE"));
    assert.equal(fused.snapshot.admissionBlockedByUncertainty, true);
  });

  it("pre-award commitment about future installation stays bidder-stage", () => {
    const s = interp(
      "The Bidder shall demonstrate that it can provide installation and commissioning in the Technical Proposal.",
    );
    assert.equal(s.admitToCanonical, true);
    assert.notEqual(s.clausePurpose, "POST_AWARD_OBLIGATION");
    assert.match(
      s.procurementPhase,
      /BID_SUBMISSION|PRE_AWARD|PRE_AWARD_COMMITMENT|PRE_BID|MULTI_PHASE/,
    );
  });

  it("unknown actor is not promoted when execution temporal is present", () => {
    const s = interp(
      "Insurance shall be maintained throughout the contract period after award.",
    );
    assert.notEqual(s.actor, "BIDDER");
    assert.equal(s.admitToCanonical, false);
  });
});

describe("semantic situation — documentary evidence class", () => {
  it("numbered documentary list items are not document-author headings", () => {
    for (const text of [
      "2.1 Copy of Certificate of Incorporation,",
      "2.1 Copie du certificat d'immatriculation,",
      "2.1 Salinan Sijil Kementerian Kewangan Malaysia (KKM),",
    ]) {
      const actor = resolveSemanticActor(text);
      assert.notEqual(actor.actor, "DOCUMENT_AUTHOR", text);
      assert.equal(actor.obligationActorKind, "UNATTRIBUTED", text);
    }
  });

  it("numbered introductions remain non-documentary headings", () => {
    const actor = resolveSemanticActor("2.1 Introduction to the project scope");
    assert.equal(actor.actor, "DOCUMENT_AUTHOR");
  });

    it("impersonal required documentary evidence admits across languages", () => {
    for (const text of [
      "A copy of the tax clearance certificate is required.",
      "ISO 27001 est exigé.",
      "Salinan Sijil Suruhanjaya Syarikat Malaysia (SSM) diperlukan.",
    ]) {
      const s = interp(text);
      assert.equal(s.admitToCanonical, true, text);
      assert.equal(s.clausePurpose, "REQUIRED_DOCUMENT", text);
      assert.equal(s.actor, "UNKNOWN", text);
      assert.equal(s.situation?.unattributedDocumentaryEvidence, true, text);
    }
  });
});

describe("semantic situation — provenance of admission", () => {
  it("admitted clauses carry a situation explanation with independent sources", () => {
    const s = interp("The Bidder shall submit a signed Form of Tender with the proposal.");
    assert.equal(s.admitToCanonical, true);
    assert.ok(s.situation);
    assert.ok(s.situation!.agreeingSignals >= 2);
    assert.ok(s.situation!.explanation.includes("actor:"));
    assert.ok(s.situation!.decisiveSources.includes("GRAMMAR"));
  });
});
