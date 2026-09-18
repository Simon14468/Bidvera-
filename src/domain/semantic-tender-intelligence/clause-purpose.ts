/**
 * Clause purpose — reasoned from document/section/actor/recipient/phase/boundary.
 * Runs BEFORE keyword semantic-kind mapping. Shall/must alone never prove purpose.
 */

import {
  isLegalReservationOrPrivilegeText,
  isNonRequirementText,
  isStructuralHeading,
} from "@/domain/tender-requirements/filter-non-requirements";
import type {
  ClausePurpose,
  ProcurementPhase,
  SemanticActor,
  SemanticClauseRole,
  SemanticDocumentRole,
  SemanticRecipient,
  SemanticSectionRole,
  TemplateStatus,
} from "./types";
import {
  analyzeLifecycleCommitmentFrame,
  isPostAwardOnlyPhase,
  BID_STAGE_COMMERCIAL_FRAME,
  PRE_AWARD_COMMITMENT_FRAME,
  POST_AWARD_ARTEFACT_CUE,
  POST_AWARD_INSTRUMENT_CUE,
  POST_AWARD_TEMPORAL_CUE,
  PAYMENT_ADMINISTRATION_CUE,
  SITE_PERFORMANCE_CUE,
} from "./phase";
import { isTemplateBlocked } from "./template";
import { recipientIsBidderSide } from "./recipient";
import {
  hasDocumentaryEvidenceNoun,
  hasUniversalObligationModal,
} from "./obligation-lexicon";
import { analyzeObligationFrame } from "./obligation-frame";
import {
  classifyDocumentPurpose,
  hasBidderStageObligationCue,
  isExplicitBidderPolicyObligation,
  isPortalOperationInstruction,
} from "./document-purpose";

/** Pure post-award performance duties (not bid warranty-period offers / inclusion). */
const EXECUTION_DUTY_SHAPE =
  /\b(?:install|commission|mobilize|maintain|repair|replace|train(?:ing)?|transport|deliver\s+(?:the\s+)?(?:goods|equipment)|provide\s+training|under\s+(?:the\s+)?warranty|during\s+(?:the\s+)?warranty|defects?\s+liability)\b/i;

const TABLE_HEADER_LINE =
  /^(?:item|description|qty|quantity|unit|price|amount|mandatory|optional|notes?|ref\.?|requirement)(?:\s*(?:\||\t|,|\s{2,})\s*(?:item|description|qty|quantity|unit|price|amount|mandatory|optional|notes?|ref\.?|requirement))+\s*$|^(?:item|description|qty|quantity|unit|price|amount|mandatory|optional|notes?|ref\.?|requirement)(?:\s+(?:item|description|qty|quantity|unit|price|amount|mandatory|optional|notes?|ref\.?|requirement)){2,}\s*$/i;

const DEFINITION_SHAPE =
  /^(?:["“]?[A-Z][^"”]{2,60}["”]?\s+means\b|for\s+the\s+purposes?\s+of\s+this\s+(?:section|document|contract)\b)/i;

const Q_AND_A_SHAPE =
  /\b(?:question\s*\d*|q\s*:\s*|answer\s*:|r[eé]ponse\s*:|in\s+response\s+to\s+(?:the\s+)?(?:clarification|question))\b/i;

const FORM_INSTRUCTION_SHAPE =
  /\b(?:complete\s+(?:this\s+)?form|fill\s+in\s+the\s+(?:blank|form)|tick\s+(?:the\s+)?(?:box|appropriate)|attach\s+additional\s+sheets?\s+if\s+necessary|use\s+block\s+capitals|sign\s+and\s+date\s+where\s+indicated)\b/i;

const ESOURCING_PROCEDURAL =
  /\b(?:click\s+(?:on|here)|log\s*in\s+to\s+the\s+portal|upload\s+(?:your\s+)?files?\s+via|navigate\s+to\s+the\s+e[- ]?sourcing|electronic\s+tendering\s+system)\b/i;

/** Buyer/authority process mechanics — never a bidder requirement. */
const BUYER_PROCEDURAL =
  /\b(?:arithmetic\s+correction|correct(?:s|ion)?\s+(?:of\s+)?(?:arithmetical\s+)?errors?|clarification\s+(?:handling|process)|meeting\s+administration|pre[- ]?bid\s+meeting\s+shall\s+be\s+(?:chaired|conducted)|the\s+(?:purchaser|authority|employer)\s+shall\s+(?:correct|amend|evaluate|open|notify)|submission\s+mechanics|preliminary\s+examination)\b/i;

/** Bidder-directed pre-award procedural duties — admissible as BIDDER_PROCEDURAL. */
const BIDDER_PROCEDURAL_SHAPE =
  /\b(?:notify\s+(?:the\s+)?(?:purchaser|authority|employer|procuring\s+entity|buyer).{0,60}ambiguit\w*|shall\s+not\s+benefit\s+from\s+(?:any\s+)?ambiguit\w*|site\s+visits?|proposal\s+validity|validity\s+(?:period\s+)?of\s+(?:the\s+)?(?:proposal|offer|bid)|request\s+clarification|seek\s+clarification|ask\s+(?:a\s+)?questions?)\b/i;

const EVALUATION_SHAPE =
  /\b(?:will\s+be\s+scored|scored\s+out\s+of|evaluation\s+criteria|technical\s+score|weighting|points?\s+based\s+on|\d+\s*%\s*[·.,]\s*\w+)\b/i;

function isBidderSideActor(actor: SemanticActor): boolean {
  return (
    actor === "BIDDER" ||
    actor === "TENDERER" ||
    actor === "OFFEROR" ||
    actor === "SUPPLIER" ||
    actor === "ECONOMIC_OPERATOR" ||
    actor === "CONSULTANT"
  );
}

export function classifyClausePurpose(input: {
  text: string;
  documentRole: SemanticDocumentRole;
  sectionRole: SemanticSectionRole;
  actor: SemanticActor;
  recipient: SemanticRecipient;
  phase: ProcurementPhase;
  templateStatus: TemplateStatus;
  isMetadata: boolean;
  boundaryComplete: boolean;
}): ClausePurpose {
  const t = input.text;
  const documentPurpose = classifyDocumentPurpose({
    text: t,
    documentRole: input.documentRole,
    sectionRole: input.sectionRole,
  });

  if (isTemplateBlocked(input.templateStatus)) return "TEMPLATE";
  if (input.isMetadata) return "METADATA_FACT";

  // Document purpose is first-class but never admits by itself.
  if (documentPurpose === "PORTAL_GUIDE" && isPortalOperationInstruction(t)) {
    return "PROCEDURAL_RULE";
  }
  if (documentPurpose === "VENDOR_GUIDE" && !hasBidderStageObligationCue(t)) {
    return "PROCEDURAL_RULE";
  }
  if (documentPurpose === "POLICY_OR_CODE" && !isExplicitBidderPolicyObligation(t)) {
    return "INFORMATIONAL_FACT";
  }

  const frame = analyzeObligationFrame(t);
  if (frame.blockReason === "DOCUMENT_IDENTIFIER") return "METADATA_FACT";
  if (frame.blockReason === "DISCLAIMER_OR_LIMITATION") return "INFORMATIONAL_FACT";
  if (frame.blockReason === "INTRODUCTORY_PROSE") return "INFORMATIONAL_FACT";

  if (Q_AND_A_SHAPE.test(t)) {
    if (/\bclarification\b/i.test(t)) {
      return "CLARIFICATION";
    }
    return "Q_AND_A";
  }
  if (
    /\bcorrigendum\b|\brectificatif\b|\baddendum\b|\bamendment\b/i.test(t) &&
    t.length < 220 &&
    !/\b(?:bidder|tenderer|offeror|supplier)s?\s+(?:shall|must)\b/i.test(t)
  ) {
    return "AMENDMENT";
  }

  if (
    isStructuralHeading(t) ||
    (/^section\s+\d+/i.test(t.trim()) && t.length < 120) ||
    /^\d+(?:\.\d+)+\s+\S[\w\s/-]{2,80}$/i.test(t.trim()) ||
    TABLE_HEADER_LINE.test(t.trim())
  ) {
    return "HEADING";
  }
  if (DEFINITION_SHAPE.test(t.trim())) {
    return "DEFINITION";
  }
  if (/\bfor\s+example\b|\be\.g\.\b|\bexemple\b|\bsample\s+(?:only|scenario)\b/i.test(t)) {
    return "EXAMPLE";
  }
  if (isLegalReservationOrPrivilegeText(t)) {
    return "LEGAL_RESERVATION";
  }
  if (FORM_INSTRUCTION_SHAPE.test(t)) {
    return "FORM_INSTRUCTION";
  }
  if (EVALUATION_SHAPE.test(t)) {
    if (
      input.actor !== "AUTHORITY" &&
      input.actor !== "BUYER" &&
      input.actor !== "PROCURING_ENTITY" &&
      input.actor !== "EVALUATOR"
    ) {
      return "EVALUATION";
    }
  }

  // Buyer / authority duty — actor proves buyer side BEFORE process-label heuristics.
  if (
    input.actor === "AUTHORITY" ||
    input.actor === "BUYER" ||
    input.actor === "PROCURING_ENTITY" ||
    input.actor === "EVALUATOR"
  ) {
    return "BUYER_OBLIGATION";
  }

  if (input.actor === "DOCUMENT_AUTHOR") return "PROCEDURAL_RULE";

  // Buyer/e-sourcing process without a resolved buyer actor — still excluded.
  if (ESOURCING_PROCEDURAL.test(t) || BUYER_PROCEDURAL.test(t)) {
    return "PROCEDURAL_RULE";
  }

  const lifecycle = analyzeLifecycleCommitmentFrame({
    text: t,
    actor: input.actor,
  });
  if (lifecycle.insufficientFrame) {
    return "UNKNOWN";
  }
  if (lifecycle.canExcludeAsPostAward && !lifecycle.canAdmitAsPreAwardCommitment) {
    return "POST_AWARD_OBLIGATION";
  }

  // Contractor / post-award performance / delivery execution
  if (input.actor === "CONTRACTOR" || isPostAwardOnlyPhase(input.phase)) {
    if (input.phase === "AWARD") return "AWARD_STAGE_OBLIGATION";
    return "POST_AWARD_OBLIGATION";
  }

  // Supplier / successful-bidder execution only when a post-award frame is present.
  // Bare install/warranty vocabulary is not enough (bid-time scope / warranty offers).
  if (
    (input.actor === "SUPPLIER" || input.actor === "SUCCESSFUL_BIDDER") &&
    EXECUTION_DUTY_SHAPE.test(t) &&
    (SITE_PERFORMANCE_CUE.test(t) ||
      POST_AWARD_ARTEFACT_CUE.test(t) ||
      POST_AWARD_INSTRUMENT_CUE.test(t) ||
      POST_AWARD_TEMPORAL_CUE.test(t) ||
      PAYMENT_ADMINISTRATION_CUE.test(t)) &&
    !PRE_AWARD_COMMITMENT_FRAME.test(t) &&
    !/\b(?:bid\s+security|with\s+(?:its|the|their)\s+(?:bid|tender|proposal))\b/i.test(t)
  ) {
    // Award-timed security is not contract execution.
    if (
      input.phase === "AWARD" &&
      /\bperformance\s+security\b/i.test(t) &&
      !/\b(?:install|commission|train|repair|transport|warranty|defects?\s+liability)\b/i.test(
        t,
      )
    ) {
      return "AWARD_STAGE_OBLIGATION";
    }
    return "POST_AWARD_OBLIGATION";
  }

  if (
    input.phase === "AWARD" &&
    (recipientIsBidderSide(input.recipient) ||
      isBidderSideActor(input.actor) ||
      input.actor === "SUCCESSFUL_BIDDER")
  ) {
    return "AWARD_STAGE_OBLIGATION";
  }

  // Ambiguous successful-bidder without award timing → fail closed.
  if (
    input.actor === "SUCCESSFUL_BIDDER" &&
    input.phase !== "AWARD" &&
    input.phase !== "BID_SUBMISSION" &&
    input.phase !== "PRE_AWARD" &&
    input.phase !== "PRE_BID"
  ) {
    return "POST_AWARD_OBLIGATION";
  }

  // Document role is supporting only — sample/contract packaging never
  // decides purpose without actor/phase/action evidence (handled above).

  // Bidder-directed procedural (pre-award) — admissible; distinct from buyer procedural.
  if (
    isBidderSideActor(input.actor) &&
    BIDDER_PROCEDURAL_SHAPE.test(t) &&
    !isPostAwardOnlyPhase(input.phase)
  ) {
    return "BIDDER_PROCEDURAL";
  }

  if (
    /\b(?:may|peut|peuvent)\b/i.test(t) &&
    /\b(?:request\s+clarification|ask\s+question|seek\s+clarification)\b/i.test(t) &&
    isBidderSideActor(input.actor)
  ) {
    return "BIDDER_PROCEDURAL";
  }
  if (
    /\b(?:may|peut|peuvent)\b/i.test(t) &&
    /\b(?:request\s+clarification|ask\s+question|seek\s+clarification)\b/i.test(t)
  ) {
    return "PROCEDURAL_RULE";
  }

  // Content-first before mixed section labels (e.g. "Administrative and Eligibility").
  // Section role hints; it must not erase clear bond / document / technical meaning.
  if (
    /\b(?:bond|caution|bid\s+security|provisional\s+bond|performance\s+(?:guarantee|security)|guarantee|garantie)\b/i.test(
      t,
    )
  ) {
    return "COMMERCIAL";
  }
  if (
    /\b(?:certificate|attestation|clearance|form\s+of\s+tender)\b/i.test(t) &&
    /\b(?:submit|provide|soumettre|mandatory|required|must|shall)\b/i.test(t)
  ) {
    return "REQUIRED_DOCUMENT";
  }

  // Section role may refine an already-established bidder-side obligation.
  // It never creates purpose from a heading/filename/column alone.
  const sectionRefinesBidder =
    input.boundaryComplete &&
    (recipientIsBidderSide(input.recipient) || isBidderSideActor(input.actor));

  // Bidder-side obligations with complete boundary
  if (
    input.boundaryComplete &&
    (recipientIsBidderSide(input.recipient) ||
      input.actor === "BIDDER" ||
      input.actor === "TENDERER" ||
      input.actor === "OFFEROR" ||
      input.actor === "SUPPLIER" ||
      input.actor === "ECONOMIC_OPERATOR" ||
      input.actor === "CONSULTANT")
  ) {
    if (
      /\b(?:bond|caution|bid\s+security|provisional\s+bond|performance\s+(?:guarantee|security)|guarantee|garantie)\b/i.test(
        t,
      )
    ) {
      return "COMMERCIAL";
    }
    if (/\b(?:certificate|attestation|clearance|submit|soumettre|form\s+of\s+tender)\b/i.test(t)) {
      return "REQUIRED_DOCUMENT";
    }
    if (/\b(?:years?\s+of\s+experience|eligib|turnover|registered)\b/i.test(t)) {
      return "ELIGIBILITY";
    }
    if (/\b(?:technical|specification|throughput|equipment|install|configure|supply)\b/i.test(t)) {
      return "TECHNICAL";
    }
    if (/\b(?:price|payment|penalt|warranty|firm\s+and)\b/i.test(t)) {
      return "COMMERCIAL";
    }
    if (sectionRefinesBidder) {
      if (input.sectionRole === "ELIGIBILITY") return "ELIGIBILITY";
      if (input.sectionRole === "QUALIFICATION") return "QUALIFICATION";
      if (
        input.sectionRole === "TECHNICAL_REQUIREMENTS" ||
        input.sectionRole === "SPECIFICATIONS"
      ) {
        return "TECHNICAL";
      }
      if (input.sectionRole === "REQUIRED_DOCUMENTS") return "REQUIRED_DOCUMENT";
      if (input.sectionRole === "PRICING" || input.sectionRole === "PAYMENT") {
        return "COMMERCIAL";
      }
      if (input.sectionRole === "SUBMISSION_INSTRUCTIONS") return "SUBMISSION";
    }
    return "BIDDER_OBLIGATION";
  }

  // Impersonal mandatory certificates / experience — purpose only when not buyer/contractor
  if (
    (input.actor === "UNKNOWN" || input.actor === "IMPERSONAL") &&
    input.boundaryComplete &&
    !isNonRequirementText(t) &&
    hasUniversalObligationModal(t) &&
    (hasDocumentaryEvidenceNoun(t) ||
      /\b(?:experience|bond|caution)\b/i.test(t) ||
      /\b(?:bids?|tenders?|proposals?|offers?)\s+(?:shall|must)\s+(?:be\s+)?(?:submitted|include|contain)\b/i.test(
        t,
      ))
  ) {
    if (hasDocumentaryEvidenceNoun(t) || /\b(?:bond|caution)\b/i.test(t)) {
      return "REQUIRED_DOCUMENT";
    }
    if (
      /\b(?:bids?|tenders?|proposals?|offers?)\s+(?:shall|must)\s+(?:be\s+)?(?:submitted|include|contain)\b/i.test(
        t,
      )
    ) {
      return "SUBMISSION";
    }
    return "ELIGIBILITY";
  }

  // Impersonal commercial conditions of the offer (not payment administration).
  if (
    input.boundaryComplete &&
    (input.actor === "UNKNOWN" ||
      input.actor === "IMPERSONAL" ||
      recipientIsBidderSide(input.recipient)) &&
    (BID_STAGE_COMMERCIAL_FRAME.test(t) ||
      /\b(?:payment\s+shall\s+be\s+made|late\s+delivery\s+shall\s+incur|penalt(?:y|ies)\s+of|prices?\s+shall\s+remain\s+firm|non[- ]revisable)\b/i.test(
        t,
      )) &&
    !PAYMENT_ADMINISTRATION_CUE.test(t)
  ) {
    return "COMMERCIAL";
  }

  if (isNonRequirementText(t)) return "INFORMATIONAL_FACT";

  // Impersonal specification / capability lines bind the offer without naming the bidder.
  if (
    (input.actor === "UNKNOWN" || input.actor === "IMPERSONAL") &&
    input.boundaryComplete &&
    /\b(?:must|shall)\s+(?:support|provide|include|meet|comply|have|enable|allow|be\s+submitted|contain)\b/i.test(
      t,
    )
  ) {
    return "TECHNICAL";
  }

  return "UNKNOWN";
}

export function purposeToClauseRole(
  purpose: ClausePurpose,
  templateStatus: TemplateStatus,
): SemanticClauseRole {
  if (purpose === "TEMPLATE") {
    return templateStatus === "TEMPLATE_INSTRUCTION"
      ? "TEMPLATE_INSTRUCTION"
      : "TEMPLATE_PLACEHOLDER";
  }
  switch (purpose) {
    case "BUYER_OBLIGATION":
      return "BUYER_OBLIGATION";
    case "POST_AWARD_OBLIGATION":
      return "POST_AWARD_CONTRACTUAL_OBLIGATION";
    case "AWARD_STAGE_OBLIGATION":
      return "AWARD_STAGE_OBLIGATION";
    case "PROCEDURAL_RULE":
      return "PROCEDURAL_RULE";
    case "FORM_INSTRUCTION":
      return "FORM_INSTRUCTION";
    case "INFORMATIONAL_FACT":
      return "INFORMATIONAL_FACT";
    case "METADATA_FACT":
      return "METADATA_FACT";
    case "EVALUATION":
      return "EVALUATION_CRITERION";
    case "Q_AND_A":
      return "Q_AND_A";
    case "CLARIFICATION":
      return "CLARIFICATION";
    case "AMENDMENT":
      return "AMENDMENT";
    case "LEGAL_RESERVATION":
      return "LEGAL_RESERVATION";
    case "DEFINITION":
      return "DEFINITION";
    case "HEADING":
      return "HEADING";
    case "EXAMPLE":
      return "EXAMPLE";
    case "ELIGIBILITY":
      return "ELIGIBILITY_CONDITION";
    case "QUALIFICATION":
      return "QUALIFICATION_REQUIREMENT";
    case "TECHNICAL":
      return "TECHNICAL_REQUIREMENT";
    case "COMMERCIAL":
      return "COMMERCIAL_REQUIREMENT";
    case "FINANCIAL":
      return "FINANCIAL_REQUIREMENT";
    case "REQUIRED_DOCUMENT":
      return "REQUIRED_SUBMISSION_DOCUMENT";
    case "SUBMISSION":
      return "SUBMISSION_INSTRUCTION";
    case "BIDDER_OBLIGATION":
      return "BIDDER_REQUIREMENT";
    case "BIDDER_PROCEDURAL":
      return "BIDDER_PROCEDURAL_REQUIREMENT";
    default:
      return "UNKNOWN";
  }
}
