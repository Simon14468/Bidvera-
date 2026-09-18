/**
 * Semantic situation fusion — multiple independent signals cooperate.
 *
 * Conflict resolution:
 *   grammar + temporal + action outrank document/section/filename/lexical cues
 *   unresolved conflict → preserve uncertainty (never invent a factual result)
 *
 * Document role, section role, and keywords are WEAK and never decide alone.
 */

import type {
  ClausePurpose,
  ProcurementPhase,
  SemanticActor,
  SemanticDocumentRole,
  SemanticRecipient,
  SemanticSectionRole,
  SemanticSituationSnapshot,
  TemplateStatus,
} from "./types";
import {
  analyzeLifecycleCommitmentFrame,
  BID_TIME_TEMPORAL,
  isBidTimePhase,
  isPostAwardOnlyPhase,
} from "./phase";
import {
  extractIndependentSignals,
  isBidderLikeActor,
  isBuyerActor,
  isPerformerActor,
  type IndependentSemanticSignals,
  type SignalSource,
} from "./semantic-signals";

export type SemanticConflict = {
  code:
    | "TEMPORAL_VS_ACTION"
    | "ACTOR_VS_PHASE"
    | "WEAK_LABEL_VS_GRAMMAR"
    | "MIXED_LIFECYCLE"
    | "UNSUPPORTED_PROMOTION";
  resolution: "CONTEXT" | "UNRESOLVED";
  detail: string;
};

export type FusedSemanticSituation = {
  actor: SemanticActor;
  recipient: SemanticRecipient;
  phase: ProcurementPhase;
  purpose: ClausePurpose;
  signals: IndependentSemanticSignals;
  conflicts: SemanticConflict[];
  snapshot: SemanticSituationSnapshot;
};

const BIDDER_COMPATIBLE_PURPOSES = new Set<ClausePurpose>([
  "BIDDER_OBLIGATION",
  "BIDDER_PROCEDURAL",
  "ELIGIBILITY",
  "QUALIFICATION",
  "TECHNICAL",
  "COMMERCIAL",
  "FINANCIAL",
  "REQUIRED_DOCUMENT",
  "SUBMISSION",
  "AWARD_STAGE_OBLIGATION",
]);

const PACKAGING_PURPOSES = new Set<ClausePurpose>([
  "Q_AND_A",
  "CLARIFICATION",
  "AMENDMENT",
  "DEFINITION",
  "EVALUATION",
]);

export function fuseSemanticSituation(input: {
  text: string;
  actor: SemanticActor;
  recipient: SemanticRecipient;
  candidatePhase: ProcurementPhase;
  candidatePurpose: ClausePurpose;
  documentRole: SemanticDocumentRole;
  sectionRole: SemanticSectionRole;
  templateStatus: TemplateStatus;
  isMetadata: boolean;
  boundaryComplete: boolean;
  isBidderRequirementHint: boolean;
}): FusedSemanticSituation {
  const signals = extractIndependentSignals({
    text: input.text,
    actor: input.actor,
    recipient: input.recipient,
    documentRole: input.documentRole,
    sectionRole: input.sectionRole,
    templateStatus: input.templateStatus,
  });

  const conflicts: SemanticConflict[] = [];

  const actor = resolveActor(input, signals, conflicts);
  const recipient = resolveRecipientAfterActor(actor, input.recipient, signals);
  const phase = resolvePhase(input, signals, actor, conflicts, input.text);
  const purpose = resolvePurpose(input, signals, actor, phase, conflicts, input.text);

  const agreeing = countAgreeingSignals(signals, actor, phase, purpose);
  const unresolved = conflicts.filter((c) => c.resolution === "UNRESOLVED");
  const uncertaintyPreserved =
    phase === "MIXED_OR_AMBIGUOUS" ||
    unresolved.length > 0 ||
    (phase === "UNKNOWN" &&
      signals.action.value === "EXECUTE_PERFORM" &&
      !signals.preAwardCommitment);

  // Uncertainty never becomes admission — bid-time phase is not a waiver.
  const admissionBlockedByUncertainty = uncertaintyPreserved;

  const bidTimePhase = isBidTimePhase(phase);
  const unattributedDocumentaryEvidence =
    actor === "UNKNOWN" &&
    purpose === "REQUIRED_DOCUMENT" &&
    signals.documentaryEvidence &&
    signals.obligationModal.value &&
    !uncertaintyPreserved &&
    bidTimePhase;
  const unattributedEligibilityEvidence =
    actor === "UNKNOWN" &&
    (purpose === "ELIGIBILITY" || purpose === "QUALIFICATION") &&
    signals.eligibilityEvidence &&
    signals.obligationModal.value &&
    !uncertaintyPreserved &&
    bidTimePhase;
  const unattributedCommercialEvidence =
    (actor === "UNKNOWN" || actor === "IMPERSONAL") &&
    (purpose === "COMMERCIAL" || purpose === "FINANCIAL") &&
    (signals.action.value === "COMMERCIAL_DISCLOSE" || signals.bidStageCommercial) &&
    signals.obligationModal.value &&
    !uncertaintyPreserved &&
    bidTimePhase &&
    !signals.executeAfterReceipt &&
    signals.action.value !== "EXECUTE_PERFORM";
  const unattributedImpersonalObligation =
    actor === "IMPERSONAL" &&
    BIDDER_COMPATIBLE_PURPOSES.has(purpose) &&
    bidTimePhase &&
    !uncertaintyPreserved &&
    (signals.obligationModal.value || signals.action.value !== "UNSPECIFIED");

  const snapshot: SemanticSituationSnapshot = {
    version: "semantic-situation/v1",
    temporal: signals.temporal.value,
    action: signals.action.value,
    agreeingSignals: agreeing,
    conflictCodes: conflicts.map((c) => c.code),
    uncertaintyPreserved,
    admissionBlockedByUncertainty,
    decisiveSources: uniqueSources(signals, actor),
    explanation: explain(actor, phase, purpose, signals, conflicts),
    unattributedDocumentaryEvidence,
    unattributedEligibilityEvidence,
    unattributedCommercialEvidence,
    unattributedImpersonalObligation,
  };

  return { actor, recipient, phase, purpose, signals, conflicts, snapshot };
}

function resolveActor(
  input: {
    actor: SemanticActor;
    candidatePurpose: ClausePurpose;
    isBidderRequirementHint: boolean;
  },
  signals: IndependentSemanticSignals,
  conflicts: SemanticConflict[],
): SemanticActor {
  if (input.actor !== "UNKNOWN") return input.actor;

  if (signals.institutionalBuyerSubject) {
    conflicts.push({
      code: "UNSUPPORTED_PROMOTION",
      resolution: "CONTEXT",
      detail: "unknown_actor_not_promoted_institutional_subject",
    });
    return "UNKNOWN";
  }

  // Never invent bidder identity from modal + purpose + hint.
  // Unattributed documentary evidence stays UNKNOWN and is explained on the snapshot.
  void input.candidatePurpose;
  void input.isBidderRequirementHint;
  return "UNKNOWN";
}

function resolveRecipientAfterActor(
  actor: SemanticActor,
  recipient: SemanticRecipient,
  signals: IndependentSemanticSignals,
): SemanticRecipient {
  if (isBuyerActor(actor)) return recipient;
  if (actor === "CONTRACTOR") return "CONTRACTOR";
  if (isBidderLikeActor(actor) && (recipient === "UNKNOWN" || recipient === "PORTAL_USER")) {
    return actor === "OFFEROR" ? "OFFEROR" : actor === "TENDERER" ? "TENDERER" : "BIDDER";
  }
  if (actor === "SUPPLIER" && recipient === "UNKNOWN") return "SUPPLIER";
  if (signals.recipient.value !== "UNKNOWN") return signals.recipient.value;
  return recipient;
}

function resolvePhase(
  input: { candidatePhase: ProcurementPhase },
  signals: IndependentSemanticSignals,
  actor: SemanticActor,
  conflicts: SemanticConflict[],
  text: string,
): ProcurementPhase {
  if (signals.mixedFrames) {
    conflicts.push({
      code: "MIXED_LIFECYCLE",
      resolution: "UNRESOLVED",
      detail: "pre_and_post_award_frames_in_one_clause",
    });
    return "MIXED_OR_AMBIGUOUS";
  }

  if (signals.preAwardCommitment && (isBidderLikeActor(actor) || actor === "SUPPLIER")) {
    if (
      signals.temporal.strength === "DECISIVE" &&
      (signals.temporal.value === "POST_AWARD_TIME" ||
        signals.temporal.value === "WARRANTY_PERIOD") &&
      signals.action.value === "EXECUTE_PERFORM"
    ) {
      conflicts.push({
        code: "TEMPORAL_VS_ACTION",
        resolution: "CONTEXT",
        detail: "commitment_frame_keeps_bid_submission",
      });
    }
    if (
      /\b(?:submit|submission|with\s+(?:its|the|their)\s+(?:bid|tender|proposal|offer)|in\s+(?:the\s+)?(?:technical\s+)?proposal|attach|include\s+in)\b/i.test(
        text,
      )
    ) {
      return "BID_SUBMISSION";
    }
    return signals.preAwardCommitment ? "PRE_AWARD_COMMITMENT" : "PRE_AWARD";
  }

  if (
    signals.awardTimedDuty &&
    !signals.executeAfterReceipt &&
    signals.action.value !== "EXECUTE_PERFORM"
  ) {
    return "AWARD";
  }

  const postTemporal =
    signals.temporal.value === "POST_AWARD_TIME" ||
    signals.temporal.value === "WARRANTY_PERIOD" ||
    signals.temporal.value === "CONTRACT_PERIOD";

  if (postTemporal && signals.action.value === "EXECUTE_PERFORM") {
    if (isBidderLikeActor(actor) && !signals.preAwardCommitment) {
      conflicts.push({
        code: "ACTOR_VS_PHASE",
        resolution: "CONTEXT",
        detail: "bidder_actor_with_execution_temporal",
      });
    }
    return mapPostAwardPhase(signals, text);
  }

  const lifecycle = analyzeLifecycleCommitmentFrame({ text, actor });
  if (lifecycle.insufficientFrame) {
    conflicts.push({
      code: "ACTOR_VS_PHASE",
      resolution: "UNRESOLVED",
      detail: "execution_duty_without_lifecycle_trigger",
    });
    return "UNKNOWN";
  }

  if (
    isPerformerActor(actor) &&
    signals.action.value === "EXECUTE_PERFORM" &&
    !signals.preAwardCommitment &&
    !signals.bidStageSecurity
  ) {
    if (signals.awardTimedDuty && actor === "SUCCESSFUL_BIDDER") return "AWARD";
    if (
      signals.executeAfterReceipt ||
      signals.temporal.value === "POST_AWARD_TIME" ||
      signals.temporal.value === "WARRANTY_PERIOD" ||
      signals.temporal.value === "CONTRACT_PERIOD"
    ) {
      return "CONTRACT_EXECUTION";
    }
    conflicts.push({
      code: "ACTOR_VS_PHASE",
      resolution: "UNRESOLVED",
      detail: "performer_execution_without_post_award_trigger",
    });
    return "UNKNOWN";
  }

  if (
    (isBidderLikeActor(actor) || actor === "SUPPLIER") &&
    signals.action.value === "EXECUTE_PERFORM" &&
    !signals.preAwardCommitment &&
    !signals.bidStageSecurity &&
    (signals.executeAfterReceipt ||
      signals.temporal.value === "POST_AWARD_TIME" ||
      signals.temporal.value === "WARRANTY_PERIOD" ||
      signals.temporal.value === "CONTRACT_PERIOD")
  ) {
    return mapPostAwardPhase(signals, text);
  }

  if (actor === "SUCCESSFUL_BIDDER") {
    if (signals.awardTimedDuty && !signals.executeAfterReceipt) return "AWARD";
    if (signals.executeAfterReceipt || postTemporal) {
      return mapPostAwardPhase(signals, text);
    }
    if (signals.action.value === "EXECUTE_PERFORM") return "POST_AWARD";
    if (isPostAwardOnlyPhase(input.candidatePhase)) return input.candidatePhase;
    if (input.candidatePhase === "AWARD") return "AWARD";
    if (input.candidatePhase === "BID_SUBMISSION" && signals.bidStageSecurity) {
      return "BID_SUBMISSION";
    }
    conflicts.push({
      code: "ACTOR_VS_PHASE",
      resolution: "UNRESOLVED",
      detail: "successful_bidder_without_award_timing",
    });
    return "MIXED_OR_AMBIGUOUS";
  }

  // Bid-disclosed commercial conditions of the offer — not MULTI_PHASE dump.
  if (
    (actor === "UNKNOWN" || actor === "IMPERSONAL") &&
    (signals.action.value === "COMMERCIAL_DISCLOSE" || signals.bidStageCommercial) &&
    signals.obligationModal.value &&
    !signals.mixedFrames &&
    !signals.executeAfterReceipt &&
    signals.action.value !== "EXECUTE_PERFORM"
  ) {
    if (
      postTemporal &&
      signals.temporal.value !== "BID_TIME" &&
      !BID_TIME_TEMPORAL.test(text) &&
      !signals.bidStageSecurity &&
      !signals.bidStageCommercial
    ) {
      conflicts.push({
        code: "TEMPORAL_VS_ACTION",
        resolution: "UNRESOLVED",
        detail: "commercial_condition_equally_compatible_with_post_award",
      });
      return "MIXED_OR_AMBIGUOUS";
    }
    if (signals.temporal.value === "BID_TIME" || BID_TIME_TEMPORAL.test(text)) {
      return "BID_SUBMISSION";
    }
    if (
      input.candidatePhase === "PRE_AWARD_COMMITMENT" ||
      input.candidatePhase === "BID_SUBMISSION" ||
      input.candidatePhase === "PRE_AWARD"
    ) {
      return input.candidatePhase;
    }
    return "PRE_AWARD_COMMITMENT";
  }

  if (
    (actor === "UNKNOWN" || actor === "IMPERSONAL") &&
    signals.action.value === "SUBMIT_DISCLOSE" &&
    signals.obligationModal.value &&
    !postTemporal &&
    !signals.mixedFrames
  ) {
    return "BID_SUBMISSION";
  }

  if (
    actor === "UNKNOWN" &&
    (signals.documentaryEvidence || signals.eligibilityEvidence) &&
    signals.obligationModal.value &&
    signals.action.value !== "EXECUTE_PERFORM" &&
    signals.action.value !== "EVALUATE_SCORE" &&
    !postTemporal &&
    !signals.mixedFrames &&
    !signals.awardTimedDuty
  ) {
    return "BID_SUBMISSION";
  }

  if (input.candidatePhase === "MULTI_PHASE") return "MULTI_PHASE";

  if (
    isBidderLikeActor(actor) &&
    (signals.action.value === "SUBMIT_DISCLOSE" ||
      signals.action.value === "DEMONSTRATE_COMMIT" ||
      signals.action.value === "COMMERCIAL_DISCLOSE")
  ) {
    if (signals.action.value === "DEMONSTRATE_COMMIT") return "PRE_AWARD_COMMITMENT";
    return "BID_SUBMISSION";
  }

  // Weak labels never decide phase. Existing classifier may stand when no conflict.
  if (
    input.candidatePhase !== "UNKNOWN" &&
    !(
      isPostAwardOnlyPhase(input.candidatePhase) &&
      isBidderLikeActor(actor) &&
      (signals.action.value === "SUBMIT_DISCLOSE" ||
        signals.action.value === "DEMONSTRATE_COMMIT")
    )
  ) {
    if (
      isPostAwardOnlyPhase(input.candidatePhase) &&
      isBidderLikeActor(actor) &&
      signals.temporal.value === "UNSPECIFIED" &&
      signals.action.value === "UNSPECIFIED"
    ) {
      conflicts.push({
        code: "WEAK_LABEL_VS_GRAMMAR",
        resolution: "UNRESOLVED",
        detail: "post_award_phase_without_independent_evidence",
      });
      return "UNKNOWN";
    }
    return input.candidatePhase;
  }

  return input.candidatePhase;
}

function mapPostAwardPhase(
  signals: IndependentSemanticSignals,
  text = "",
): ProcurementPhase {
  if (signals.temporal.value === "WARRANTY_PERIOD") return "POST_AWARD";
  if (/\binstall(?:ation|ing)?|commission\b/i.test(text)) {
    return "INSTALLATION_IMPLEMENTATION";
  }
  if (/\bdeliver(?:y|ed|ing)?\b/i.test(text) && !/\bpayment\b/i.test(text)) {
    return "DELIVERY";
  }
  if (signals.executeAfterReceipt) return "POST_AWARD";
  if (signals.temporal.value === "CONTRACT_PERIOD") return "CONTRACT_EXECUTION";
  return "POST_AWARD";
}

function resolvePurpose(
  input: { candidatePurpose: ClausePurpose; isMetadata: boolean },
  signals: IndependentSemanticSignals,
  actor: SemanticActor,
  phase: ProcurementPhase,
  conflicts: SemanticConflict[],
  text: string,
): ClausePurpose {
  if (input.isMetadata) return "METADATA_FACT";
  if (signals.action.value === "TEMPLATE_FILL") return "TEMPLATE";

  const lifecycle = analyzeLifecycleCommitmentFrame({ text, actor });
  if (
    lifecycle.insufficientFrame &&
    signals.action.value !== "SUBMIT_DISCLOSE" &&
    signals.action.value !== "DEMONSTRATE_COMMIT" &&
    signals.action.value !== "COMMERCIAL_DISCLOSE"
  ) {
    conflicts.push({
      code: "UNSUPPORTED_PROMOTION",
      resolution: "UNRESOLVED",
      detail: "execution_purpose_without_lifecycle_trigger",
    });
    return "UNKNOWN";
  }
  if (lifecycle.canExcludeAsPostAward && !lifecycle.canAdmitAsPreAwardCommitment) {
    return "POST_AWARD_OBLIGATION";
  }

  const keepNonRequirement = new Set<ClausePurpose>([
    "LEGAL_RESERVATION",
    "HEADING",
    "EXAMPLE",
    "TEMPLATE",
    "FORM_INSTRUCTION",
    "INFORMATIONAL_FACT",
    "METADATA_FACT",
    "PROCEDURAL_RULE",
  ]);
  if (keepNonRequirement.has(input.candidatePurpose)) {
    return input.candidatePurpose;
  }

  // Packaging labels cannot override a content-shaped bidder obligation.
  // Content-shaped Q&A / amendment / definition / evaluation stays that purpose.
  if (PACKAGING_PURPOSES.has(input.candidatePurpose)) {
    const leakedFromWeakLabel =
      (input.candidatePurpose === "Q_AND_A" && !signals.qAndAShape) ||
      (input.candidatePurpose === "CLARIFICATION" && !signals.qAndAShape) ||
      (input.candidatePurpose === "AMENDMENT" && !signals.amendmentMetaShape) ||
      (input.candidatePurpose === "DEFINITION" && !signals.definitionShape) ||
      (input.candidatePurpose === "EVALUATION" &&
        !signals.evaluationShape &&
        !isBuyerActor(actor));

    if (leakedFromWeakLabel && signals.obligationModal.value) {
      // Scoring language is never a bidder obligation, even under a weak label.
      if (
        signals.action.value === "EVALUATE_SCORE" ||
        signals.evaluationShape
      ) {
        return "EVALUATION";
      }
      conflicts.push({
        code: "WEAK_LABEL_VS_GRAMMAR",
        resolution: "CONTEXT",
        detail: `packaging_purpose_overridden:${input.candidatePurpose}`,
      });
      if (isBuyerActor(actor)) return "BUYER_OBLIGATION";
      if (isPostAwardOnlyPhase(phase) && actor !== "SUCCESSFUL_BIDDER") {
        return "POST_AWARD_OBLIGATION";
      }
      if (phase === "AWARD") return "AWARD_STAGE_OBLIGATION";
      if (signals.action.value === "COMMERCIAL_DISCLOSE") return "COMMERCIAL";
      if (signals.action.value === "SUBMIT_DISCLOSE") return "REQUIRED_DOCUMENT";
      if (
        (isBidderLikeActor(actor) || actor === "SUPPLIER") &&
        signals.action.value !== "EXECUTE_PERFORM"
      ) {
        return "BIDDER_OBLIGATION";
      }
    } else {
      return input.candidatePurpose;
    }
  }

  if (isBuyerActor(actor)) return "BUYER_OBLIGATION";

  if (phase === "AWARD") return "AWARD_STAGE_OBLIGATION";

  if (isPostAwardOnlyPhase(phase) && !signals.preAwardCommitment) {
    return "POST_AWARD_OBLIGATION";
  }

  const postAwardPurposeLacksFrame =
    input.candidatePurpose === "POST_AWARD_OBLIGATION" &&
    !isPostAwardOnlyPhase(phase) &&
    !signals.executeAfterReceipt &&
    signals.temporal.value !== "POST_AWARD_TIME" &&
    signals.temporal.value !== "WARRANTY_PERIOD" &&
    signals.temporal.value !== "CONTRACT_PERIOD";

  if (postAwardPurposeLacksFrame) {
    conflicts.push({
      code: "WEAK_LABEL_VS_GRAMMAR",
      resolution: "CONTEXT",
      detail: "post_award_purpose_without_lifecycle_evidence",
    });
  } else if (input.candidatePurpose !== "UNKNOWN") {
    return input.candidatePurpose;
  }

  if (
    (input.candidatePurpose === "UNKNOWN" || postAwardPurposeLacksFrame) &&
    signals.obligationModal.value &&
    (isBidderLikeActor(actor) || actor === "SUPPLIER") &&
    (signals.action.value === "SUBMIT_DISCLOSE" ||
      signals.action.value === "DEMONSTRATE_COMMIT" ||
      signals.action.value === "COMMERCIAL_DISCLOSE")
  ) {
    if (signals.action.value === "COMMERCIAL_DISCLOSE") return "COMMERCIAL";
    if (signals.action.value === "SUBMIT_DISCLOSE") return "REQUIRED_DOCUMENT";
    return "BIDDER_OBLIGATION";
  }

  return postAwardPurposeLacksFrame ? "UNKNOWN" : input.candidatePurpose;
}

function countAgreeingSignals(
  signals: IndependentSemanticSignals,
  actor: SemanticActor,
  phase: ProcurementPhase,
  purpose: ClausePurpose,
): number {
  let n = 0;
  if (signals.actor.strength === "DECISIVE") n += 1;
  if (signals.temporal.strength !== "ABSENT") {
    const bidPhase =
      phase === "BID_SUBMISSION" || phase === "PRE_AWARD" || phase === "PRE_BID";
    const postPhase = isPostAwardOnlyPhase(phase);
    if (
      (signals.temporal.value === "BID_TIME" && bidPhase) ||
      (signals.temporal.value === "AWARD_TIME" && phase === "AWARD") ||
      ((signals.temporal.value === "POST_AWARD_TIME" ||
        signals.temporal.value === "WARRANTY_PERIOD" ||
        signals.temporal.value === "CONTRACT_PERIOD") &&
        postPhase)
    ) {
      n += 1;
    }
  }
  if (signals.action.strength !== "ABSENT") {
    if (
      (signals.action.value === "SUBMIT_DISCLOSE" &&
        (purpose === "REQUIRED_DOCUMENT" ||
          purpose === "SUBMISSION" ||
          purpose === "BIDDER_OBLIGATION" ||
          purpose === "BIDDER_PROCEDURAL")) ||
      (signals.action.value === "DEMONSTRATE_COMMIT" &&
        BIDDER_COMPATIBLE_PURPOSES.has(purpose)) ||
      (signals.action.value === "EXECUTE_PERFORM" &&
        purpose === "POST_AWARD_OBLIGATION") ||
      (signals.action.value === "COMMERCIAL_DISCLOSE" && purpose === "COMMERCIAL") ||
      (signals.action.value === "EVALUATE_SCORE" &&
        (purpose === "EVALUATION" || purpose === "BUYER_OBLIGATION"))
    ) {
      n += 1;
    }
  }
  if (signals.obligationModal.value) n += 1;
  if (isBidderLikeActor(actor) || isBuyerActor(actor) || isPerformerActor(actor)) {
    n += 1;
  }
  return n;
}

function uniqueSources(
  signals: IndependentSemanticSignals,
  actor: SemanticActor,
): SignalSource[] {
  const out: SignalSource[] = [];
  if (actor !== "UNKNOWN") out.push("GRAMMAR");
  if (signals.temporal.strength !== "ABSENT") out.push("TEMPORAL");
  if (signals.action.strength !== "ABSENT") out.push("ACTION");
  if (signals.obligationModal.value) out.push("OBLIGATION_MODAL");
  return out;
}

function explain(
  actor: SemanticActor,
  phase: ProcurementPhase,
  purpose: ClausePurpose,
  signals: IndependentSemanticSignals,
  conflicts: SemanticConflict[],
): string {
  const parts = [
    `actor:${actor}`,
    `phase:${phase}`,
    `purpose:${purpose}`,
    `temporal:${signals.temporal.value}`,
    `action:${signals.action.value}`,
  ];
  if (conflicts.length) {
    parts.push(`conflicts:${conflicts.map((c) => c.code).join(",")}`);
  }
  return parts.join("|");
}
