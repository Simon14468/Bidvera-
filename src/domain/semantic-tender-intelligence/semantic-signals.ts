/**
 * Independent semantic signals — extracted without deciding admission.
 *
 * No single signal (keyword, filename, section, column, template) is truth.
 * Downstream fusion must require cooperation of actor, temporal, action,
 * purpose, obligation, conditionality, and document role.
 */

import type {
  SemanticActor,
  SemanticDocumentRole,
  SemanticRecipient,
  SemanticSectionRole,
  TemplateStatus,
} from "./types";
import {
  AWARD_TIMED_DUTY_CUE,
  BID_STAGE_COMMERCIAL_FRAME,
  BID_STAGE_SECURITY_CUE,
  BID_TIME_TEMPORAL,
  EVALUATION_TEMPORAL,
  CONTRACT_EXECUTION_CUE,
  EXECUTION_VERB,
  PAST_CAPABILITY_OR_ELIGIBILITY,
  PAYMENT_ADMINISTRATION_CUE,
  PERFORMANCE_DUTY_SHAPE,
  POST_AWARD_ARTEFACT_CUE,
  POST_AWARD_INSTRUMENT_CUE,
  POST_AWARD_TEMPORAL_CUE,
  PRE_AWARD_COMMITMENT_FRAME,
  SITE_PERFORMANCE_CUE,
  SUCCESSFUL_BIDDER_CUE,
  textForExecutionShape,
} from "./phase";
import { hasMixedLifecycleFrames } from "./mixed-clause";
import {
  hasDocumentaryEvidenceNoun,
  hasEligibilityEvidenceNoun,
  hasUniversalObligationModal,
} from "./obligation-lexicon";

export const SIGNAL_SOURCES = [
  "GRAMMAR",
  "TEMPORAL",
  "ACTION",
  "OBLIGATION_MODAL",
  "CONDITIONALITY",
  "DOCUMENT_ROLE",
  "SECTION_ROLE",
  "LEXICAL",
  "TABLE",
  "NEIGHBOR_CONTEXT",
  "PACKAGE",
] as const;

export type SignalSource = (typeof SIGNAL_SOURCES)[number];

export const SIGNAL_STRENGTHS = [
  "DECISIVE",
  "SUPPORTING",
  "WEAK",
  "ABSENT",
] as const;

export type SignalStrength = (typeof SIGNAL_STRENGTHS)[number];

export const TEMPORAL_FRAMES = [
  "BID_TIME",
  "AWARD_TIME",
  "POST_AWARD_TIME",
  "CONTRACT_PERIOD",
  "WARRANTY_PERIOD",
  "UNSPECIFIED",
] as const;

export type TemporalFrame = (typeof TEMPORAL_FRAMES)[number];

export const ACTION_CLASSES = [
  "SUBMIT_DISCLOSE",
  "DEMONSTRATE_COMMIT",
  "EXECUTE_PERFORM",
  "COMMERCIAL_DISCLOSE",
  "EVALUATE_SCORE",
  "INFORM",
  "TEMPLATE_FILL",
  "PROCEDURAL_NAVIGATE",
  "UNSPECIFIED",
] as const;

export type ActionClass = (typeof ACTION_CLASSES)[number];

export const EVIDENCE_CLASSES = [
  "structural",
  "grammatical",
  "temporal",
  "relational",
  "lexical_weak",
] as const;

export type EvidenceClass = (typeof EVIDENCE_CLASSES)[number];

export type SemanticSignal<T> = {
  value: T;
  strength: SignalStrength;
  source: SignalSource;
  evidenceClass: EvidenceClass;
  evidence: string | null;
};

const SUBMIT_DISCLOSE =
  /\b(?:submit(?:ted|ting)?|soumettre|provide|attach|include|lodge|file|furnish|complete\s+and\s+return)\b/i;

const DEMONSTRATE_COMMIT =
  /\b(?:demonstrate|propose|describe|outline|commit(?:s|ted|ment)?|undertakes?|confirm\s+in\s+(?:its|the)\s+(?:bid|proposal)|methodology)\b/i;

const COMMERCIAL_DISCLOSE =
  /\b(?:prices?\s+shall\s+remain\s+firm|non[- ]revisable|firm\s+and\s+(?:fixed|non)|payment\s+terms?\s+shall|payment\s+shall\s+be\s+made|late\s+delivery\s+shall\s+incur|penalt(?:y|ies)\s+of|(?:bid|offer|proposal|tender)\s+(?:shall\s+remain\s+)?valid(?:ity)?|(?:validity|valid)\s+of\s+(?:the\s+)?(?:bid|offer|proposal|tender)|currency\s+of\s+(?:the\s+)?(?:bid|offer|proposal|tender)|priced?\s+in\s+(?:usd|eur|gbp|mad|[a-z]{3})\b|quoted?\s+in\s+(?:usd|eur|gbp|mad|[a-z]{3})\b|incoterms?|delivered?\s+duty\s+paid)\b/i;

const EVALUATE_SCORE =
  /\b(?:will\s+be\s+scored|scored\s+out\s+of|evaluation\s+criteria|technical\s+score|weighting|points?\s+based\s+on|preliminary\s+examination)\b/i;

const PROCEDURAL_NAVIGATE =
  /\b(?:click\s+(?:on|here)|log\s*in\s+to\s+the\s+portal|upload\s+(?:your\s+)?files?\s+via|navigate\s+to\s+the\s+e[- ]?sourcing|electronic\s+tendering\s+system)\b/i;

function evidenceClassFor(source: SignalSource): EvidenceClass {
  switch (source) {
    case "GRAMMAR":
    case "OBLIGATION_MODAL":
      return "grammatical";
    case "TEMPORAL":
      return "temporal";
    case "DOCUMENT_ROLE":
    case "SECTION_ROLE":
    case "TABLE":
    case "NEIGHBOR_CONTEXT":
    case "PACKAGE":
      return "structural";
    case "ACTION":
    case "CONDITIONALITY":
      return "relational";
    case "LEXICAL":
    default:
      return "lexical_weak";
  }
}

function signal<T>(
  value: T,
  strength: SignalStrength,
  source: SignalSource,
  evidence: string | null,
  evidenceClass?: EvidenceClass,
): SemanticSignal<T> {
  return {
    value,
    strength,
    source,
    evidenceClass: evidenceClass ?? evidenceClassFor(source),
    evidence,
  };
}

const Q_AND_A_SHAPE =
  /\b(?:question\s*\d*|q\s*:\s*|answer\s*:|r[eé]ponse\s*:|in\s+response\s+to\s+(?:the\s+)?(?:clarification|question))\b/i;

const AMENDMENT_META_SHAPE =
  /^(?:addendum|corrigendum|rectificatif|amendment|modification\s+notice)\b|\bthis\s+(?:addendum|corrigendum|amendment)\s+(?:supersedes|replaces|amends|modifies)\b/i;

const DEFINITION_SHAPE =
  /^(?:["“]?[A-Z][^"”]{2,60}["”]?\s+means\b|for\s+the\s+purposes?\s+of\s+this\s+(?:section|document|contract)\b)/i;

const INSTITUTIONAL_ACRONYM_SUBJECT =
  /\b[A-Z]{3,}(?:\/[A-Z]{2,})?\s+(?:shall|must|will|may)\b/;

const BUYER_ROLE_SUBJECT =
  /\b(?:the\s+)?(?:purchaser|employer|authority|procuring\s+entity|contracting\s+authority|evaluation\s+committee)\s+(?:shall|must|will|may)\b/i;

const BID_TIME_CUE =
  /\b(?:with\s+(?:its|the|their)\s+(?:bid|tender|proposal|offer)|as\s+part\s+of\s+(?:the\s+)?(?:bid|tender|proposal|offer)|at\s+submission|upon\s+submission|before\s+(?:the\s+)?(?:bid|tender)\s+opening|in\s+(?:the\s+)?(?:technical\s+)?proposal|bid\s+closing|proposal\s+deadline|(?:bid|offer|proposal|tender)\s+valid(?:ity)?)\b/i;

const WARRANTY_CUE =
  /\b(?:(?:during|under|throughout)\s+(?:the\s+)?warranty(?:\s+period)?|defects?\s+liability\s+period)\b/i;

const AFTER_RECEIPT_CUE =
  /\bafter\s+(?:receipt|receiving)\s+(?:of\s+)?(?:the\s+)?(?:contract|purchase\s+order|p\.?o\.?|letter\s+of\s+acceptance|call[- ]?off(?:\s+order)?|order)\b/i;

export type IndependentSemanticSignals = {
  actor: SemanticSignal<SemanticActor>;
  recipient: SemanticSignal<SemanticRecipient>;
  temporal: SemanticSignal<TemporalFrame>;
  action: SemanticSignal<ActionClass>;
  obligationModal: SemanticSignal<boolean>;
  documentRole: SemanticSignal<SemanticDocumentRole>;
  sectionRole: SemanticSignal<SemanticSectionRole>;
  preAwardCommitment: boolean;
  mixedFrames: boolean;
  bidStageCommercial: boolean;
  bidStageSecurity: boolean;
  awardTimedDuty: boolean;
  successfulBidderMention: boolean;
  institutionalBuyerSubject: boolean;
  qAndAShape: boolean;
  amendmentMetaShape: boolean;
  definitionShape: boolean;
  evaluationShape: boolean;
  executeAfterReceipt: boolean;
  /** Submitted documentary artefact class — independent of actor identity. */
  documentaryEvidence: boolean;
  /** Eligibility / qualification evidence class — independent of actor identity. */
  eligibilityEvidence: boolean;
};

export function extractIndependentSignals(input: {
  text: string;
  actor: SemanticActor;
  recipient: SemanticRecipient;
  documentRole: SemanticDocumentRole;
  sectionRole: SemanticSectionRole;
  templateStatus: TemplateStatus;
}): IndependentSemanticSignals {
  const t = input.text;

  return {
    actor: signal(
      input.actor,
      input.actor === "UNKNOWN" ? "ABSENT" : "DECISIVE",
      "GRAMMAR",
      input.actor === "UNKNOWN" ? null : input.actor,
    ),
    recipient: signal(
      input.recipient,
      input.recipient === "UNKNOWN" ? "ABSENT" : "SUPPORTING",
      "GRAMMAR",
      input.recipient === "UNKNOWN" ? null : input.recipient,
    ),
    temporal: classifyTemporal(t),
    action: classifyAction(t, input.templateStatus),
    obligationModal: signal(
      hasUniversalObligationModal(t),
      hasUniversalObligationModal(t) ? "SUPPORTING" : "ABSENT",
      "OBLIGATION_MODAL",
      hasUniversalObligationModal(t) ? "modal" : null,
    ),
    documentRole: signal(
      input.documentRole,
      input.documentRole === "UNKNOWN" ? "ABSENT" : "WEAK",
      "DOCUMENT_ROLE",
      input.documentRole === "UNKNOWN" ? null : input.documentRole,
      "lexical_weak",
    ),
    sectionRole: signal(
      input.sectionRole,
      input.sectionRole === "UNKNOWN" ? "ABSENT" : "WEAK",
      "SECTION_ROLE",
      input.sectionRole === "UNKNOWN" ? null : input.sectionRole,
      "lexical_weak",
    ),
    preAwardCommitment: PRE_AWARD_COMMITMENT_FRAME.test(t),
    mixedFrames: hasMixedLifecycleFrames(t),
    bidStageCommercial: BID_STAGE_COMMERCIAL_FRAME.test(t),
    bidStageSecurity: BID_STAGE_SECURITY_CUE.test(t),
    awardTimedDuty: AWARD_TIMED_DUTY_CUE.test(t),
    successfulBidderMention: SUCCESSFUL_BIDDER_CUE.test(t),
    institutionalBuyerSubject:
      INSTITUTIONAL_ACRONYM_SUBJECT.test(t) || BUYER_ROLE_SUBJECT.test(t),
    qAndAShape: Q_AND_A_SHAPE.test(t),
    amendmentMetaShape: AMENDMENT_META_SHAPE.test(t),
    definitionShape: DEFINITION_SHAPE.test(t.trim()),
    evaluationShape: EVALUATE_SCORE.test(t),
    executeAfterReceipt: AFTER_RECEIPT_CUE.test(t) || POST_AWARD_INSTRUMENT_CUE.test(t),
    documentaryEvidence: hasDocumentaryEvidenceNoun(t),
    eligibilityEvidence: hasEligibilityEvidenceNoun(t),
  };
}

function classifyTemporal(text: string): SemanticSignal<TemporalFrame> {
  const bidTime =
    BID_TIME_CUE.test(text) ||
    BID_TIME_TEMPORAL.test(text) ||
    PRE_AWARD_COMMITMENT_FRAME.test(text);
  if (bidTime) {
    return signal("BID_TIME", "DECISIVE", "TEMPORAL", "bid-time");
  }
  if (EVALUATION_TEMPORAL.test(text)) {
    return signal("BID_TIME", "SUPPORTING", "TEMPORAL", "evaluation-window");
  }
  if (AWARD_TIMED_DUTY_CUE.test(text) && !CONTRACT_EXECUTION_CUE.test(text)) {
    return signal("AWARD_TIME", "DECISIVE", "TEMPORAL", "award-window");
  }
  if (
    POST_AWARD_TEMPORAL_CUE.test(text) ||
    AFTER_RECEIPT_CUE.test(text) ||
    POST_AWARD_INSTRUMENT_CUE.test(text) ||
    /\bafter\s+(?:delivery|installation|commissioning|acceptance|handover|taking[- ]over)\b/i.test(
      text,
    )
  ) {
    return signal("POST_AWARD_TIME", "DECISIVE", "TEMPORAL", "post-award-time");
  }
  if (WARRANTY_CUE.test(text)) {
    return signal("WARRANTY_PERIOD", "DECISIVE", "TEMPORAL", "warranty");
  }
  if (
    /\b(?:during|throughout|under)\s+(?:the\s+)?contract(?:\s+period)?\b/i.test(text)
  ) {
    return signal("CONTRACT_PERIOD", "SUPPORTING", "TEMPORAL", "contract-period");
  }
  return signal("UNSPECIFIED", "ABSENT", "TEMPORAL", null);
}

function classifyAction(
  text: string,
  templateStatus: TemplateStatus,
): SemanticSignal<ActionClass> {
  if (templateStatus !== "NOT_TEMPLATE") {
    return signal("TEMPLATE_FILL", "DECISIVE", "ACTION", templateStatus);
  }
  if (PROCEDURAL_NAVIGATE.test(text)) {
    return signal("PROCEDURAL_NAVIGATE", "DECISIVE", "ACTION", "portal");
  }
  if (EVALUATE_SCORE.test(text)) {
    return signal("EVALUATE_SCORE", "SUPPORTING", "ACTION", "evaluate");
  }
  if (PAYMENT_ADMINISTRATION_CUE.test(text)) {
    return signal("EXECUTE_PERFORM", "SUPPORTING", "ACTION", "payment-admin");
  }
  if (
    (COMMERCIAL_DISCLOSE.test(text) || BID_STAGE_COMMERCIAL_FRAME.test(text)) &&
    !PAYMENT_ADMINISTRATION_CUE.test(text)
  ) {
    return signal("COMMERCIAL_DISCLOSE", "SUPPORTING", "ACTION", "commercial");
  }
  if (PAST_CAPABILITY_OR_ELIGIBILITY.test(text)) {
    return signal("DEMONSTRATE_COMMIT", "SUPPORTING", "ACTION", "capability");
  }
  if (PRE_AWARD_COMMITMENT_FRAME.test(text) || DEMONSTRATE_COMMIT.test(text)) {
    if (
      EXECUTION_VERB.test(text) &&
      !PRE_AWARD_COMMITMENT_FRAME.test(text) &&
      !DEMONSTRATE_COMMIT.test(text)
    ) {
      return signal("EXECUTE_PERFORM", "SUPPORTING", "ACTION", "execute");
    }
    return signal("DEMONSTRATE_COMMIT", "SUPPORTING", "ACTION", "commit");
  }
  if (
    POST_AWARD_ARTEFACT_CUE.test(text) &&
    !PRE_AWARD_COMMITMENT_FRAME.test(text) &&
    !BID_TIME_CUE.test(text)
  ) {
    return signal("EXECUTE_PERFORM", "SUPPORTING", "ACTION", "performance-artefact");
  }
  if (
    (CONTRACT_EXECUTION_CUE.test(textForExecutionShape(text)) ||
      EXECUTION_VERB.test(textForExecutionShape(text)) ||
      SITE_PERFORMANCE_CUE.test(textForExecutionShape(text)) ||
      PERFORMANCE_DUTY_SHAPE.test(textForExecutionShape(text))) &&
    !BID_STAGE_SECURITY_CUE.test(text)
  ) {
    return signal("EXECUTE_PERFORM", "SUPPORTING", "ACTION", "execute");
  }
  if (SUBMIT_DISCLOSE.test(text)) {
    return signal("SUBMIT_DISCLOSE", "SUPPORTING", "ACTION", "submit");
  }
  return signal("UNSPECIFIED", "ABSENT", "ACTION", null);
}

export function isBidderLikeActor(actor: SemanticActor): boolean {
  return (
    actor === "BIDDER" ||
    actor === "TENDERER" ||
    actor === "OFFEROR" ||
    actor === "ECONOMIC_OPERATOR" ||
    actor === "CONSULTANT" ||
    actor === "PROSPECTIVE_BIDDER"
  );
}

export function isPerformerActor(actor: SemanticActor): boolean {
  return (
    actor === "CONTRACTOR" ||
    actor === "SUBCONTRACTOR" ||
    actor === "SUCCESSFUL_BIDDER"
  );
}

export function isBuyerActor(actor: SemanticActor): boolean {
  return (
    actor === "BUYER" ||
    actor === "AUTHORITY" ||
    actor === "PROCURING_ENTITY" ||
    actor === "EVALUATOR"
  );
}
