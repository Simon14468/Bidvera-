/**
 * Procurement-phase classification for semantic interpretation.
 *
 * Actor identity and phase are NEVER interchangeable.
 * SUPPLIER/CONTRACTOR alone do not prove post-award; temporal + purpose cues do.
 * Pre-award commitment frames (demonstrate / with the bid / in the proposal)
 * keep BID_SUBMISSION even when future performance is mentioned.
 */

import type {
  ProcurementPhase,
  SemanticActor,
  SemanticDocumentRole,
  SemanticSectionRole,
} from "./types";

/**
 * Contract-execution / delivery / warranty performance cues.
 * Prefer temporal + duty pairs; avoid bare "install" alone (pre-award plans use it).
 */
export const CONTRACT_EXECUTION_CUE =
  /\b(?:after\s+(?:delivery|installation|commissioning|acceptance|handover|taking[- ]over)|upon\s+(?:delivery|installation|commissioning|acceptance)|following\s+(?:delivery|installation|commissioning)|during\s+(?:the\s+)?(?:warranty|defects?\s+liability)\s+period|under\s+(?:the\s+)?warranty|testing\s+and\s+commissioning|provide\s+training|conduct\s+training|replac(?:e|ed|ement)\s+(?:defective|faulty|non[- ]compliant)|repair(?:ed)?\s+(?:defective|faulty|non[- ]compliant)|delivery\s+(?:and\s+installation\s+)?(?:notes?|reports?)|installation\s+(?:completion\s+)?reports?|warranty\s+certificates?|progress\s+reports?|transport(?:ation|ed|ing)?(?:\s+(?:of\s+)?(?:the\s+)?(?:goods|equipment|materials|items))?|off-?load(?:ing|ed)?|placement\s+at|install(?:ation|ed|ing)?\s+and\s+commission(?:ed|ing)?|commission(?:ed|ing)?\s+(?:the\s+)?(?:equipment|system|works|goods))\b/i;

/** Post-award instrument / event that starts performance — not bid submission. */
export const POST_AWARD_INSTRUMENT_CUE =
  /\bafter\s+(?:signing|executing|issuance|issue|receipt|receiving|notification)\s+(?:of\s+)?(?:the\s+)?(?:purchase\s+order|p\.?o\.?|call[- ]?off(?:\s+order)?|order|contract|agreement|letter\s+of\s+acceptance|notice\s+to\s+proceed|award)\b|\bafter\s+(?:the\s+)?(?:purchase\s+order|p\.?o\.?|contract\s+signature|site\s+handover)\b|\bupon\s+(?:award|receiving\s+(?:the\s+)?(?:purchase\s+order|p\.?o\.?)|contract\s+signature|site\s+handover)\b/i;

export const POST_AWARD_TEMPORAL_CUE =
  /\b(?:during\s+(?:the\s+)?(?:contract|implementation|performance|warranty)|after\s+(?:award|notification|contract\s+signature|contract\s+signing|receiving\s+(?:the\s+)?(?:purchase\s+order|p\.?o\.?|contract)|receipt\s+of\s+(?:the\s+)?(?:contract|purchase\s+order|letter\s+of\s+acceptance)|site\s+handover)|post[- ]award|commence\s+(?:performance|implementation|mobilization)|monthly\s+reports?|maintain\s+insurance|throughout\s+(?:the\s+)?(?:contract(?:\s+period)?|period\s+of\s+performance)|contract\s+implementation|payment\s+(?:for|of)\s+deliverables?|under\s+the\s+contract)\b/i;

/** Site / delivery / warranty performance without needing a named instrument. */
export const SITE_PERFORMANCE_CUE =
  /\b(?:transportation|off-?loading|placement\s+at\s+(?:the\s+)?(?:specified\s+)?(?:rooms?|site|premises|areas?)|deliver(?:ed|ing)?\s+(?:the\s+)?(?:goods|equipment|materials|works|items)\s+(?:to|at)\s+(?:the\s+)?(?:site|premises|destination|project)|(?:kpi|service\s+level|sla)s?|defective\s+items?\s+shall\s+be\s+(?:repaired|replaced|repair|replace))\b/i;

/** Documents that evidence performance, not bid submission, unless a bid frame is present. */
export const POST_AWARD_ARTEFACT_CUE =
  /\b(?:delivery\s+notes?|installation\s+(?:completion\s+)?reports?|warranty\s+certificates?|progress\s+reports?)\b/i;

/** Payment processing tied to performance artefacts — not bid-disclosed payment terms. */
export const PAYMENT_ADMINISTRATION_CUE =
  /\b(?:(?:supplier|contractor|seller)\s+shall\s+(?:submit|issue|provide)\s+(?:an?\s+)?invoices?\b[\s\S]{0,100}\b(?:after|upon|following)\s+(?:delivery|acceptance|completion)|payment\s+shall\s+be\s+(?:made|processed|released|effected)\b[\s\S]{0,120}\b(?:delivery\s+notes?|installation\s+(?:completion\s+)?reports?|acceptance\s+certificates?|completion\s+certificates?))\b/i;

/** Award-timed duties (security / signing) — not open-ended execution. */
export const AWARD_TIMED_DUTY_CUE =
  /\b(?:within\s+\d+\s+(?:calendar\s+|working\s+)?days?\s+(?:of|after|from)\s+(?:the\s+)?(?:award|notification\s+of\s+award|letter\s+of\s+acceptance)|upon\s+(?:award|notification\s+of\s+award)|performance\s+security\b.{0,80}\b(?:within|upon)\b.{0,40}\b(?:award|notification)|sign\s+(?:the\s+)?(?:contract|agreement)\b.{0,40}\b(?:within|after|upon)\b.{0,40}\baward)\b/i;

export const SUCCESSFUL_BIDDER_CUE =
  /\b(?:the\s+)?successful\s+(?:bidder|tenderer|offeror|candidate)s?\b/i;

export const BID_STAGE_SECURITY_CUE =
  /\b(?:bid\s+security|tender\s+security|provisional\s+bond|bid\s+bond|proposal\s+security)\b/i;

/**
 * Bid-disclosed commercial conditions of the offer — not payment administration
 * and not isolated words like contract / PO / deliver.
 */
export const BID_STAGE_COMMERCIAL_FRAME =
  /\b(?:prices?\s+shall\s+remain\s+firm|non[- ]revisable|firm\s+and\s+(?:fixed|non[- ]revisable)|(?:bid|offer|proposal|tender)\s+(?:shall\s+remain\s+)?valid(?:ity)?|(?:validity|valid)\s+of\s+(?:the\s+)?(?:bid|offer|proposal|tender)|priced?\s+in\s+(?:usd|eur|gbp|mad|[a-z]{3})\b|quoted?\s+in\s+(?:usd|eur|gbp|mad|[a-z]{3})\b|currency\s+of\s+(?:the\s+)?(?:bid|offer|proposal|tender)|payment\s+terms?\s+(?:shall|are|must)|incoterms?|delivered?\s+duty\s+paid|\btaxes?\s+(?:shall\s+be\s+)?(?:included|exclusive|excluded)\b|price\s+schedule|commercial\s+(?:form|schedule)|late\s+delivery\s+shall\s+incur|penalt(?:y|ies)\s+of\s+\d)\b/i;

/** Explicit bid-stage timing — never inferred from "bidder" or "shall" alone. */
export const BID_TIME_TEMPORAL =
  /\b(?:with\s+(?:its|the|their)\s+(?:bid|tender|proposal|offer)|as\s+part\s+of\s+(?:the\s+)?(?:bid|tender|proposal|offer)|at\s+submission|upon\s+submission|before\s+(?:the\s+)?(?:bid|tender)\s+opening|in\s+(?:the\s+)?(?:technical\s+)?proposal|bid\s+closing|proposal\s+deadline|(?:bid|offer|proposal|tender)\s+valid(?:ity)?)\b/i;

export const EVALUATION_TEMPORAL =
  /\bduring\s+(?:the\s+)?evaluation\b/i;

/**
 * Explicit pre-award commitment / demonstration / bid-inclusion frame.
 * Keeps future performance language in BID_SUBMISSION when present.
 */
export const PRE_AWARD_COMMITMENT_FRAME =
  /\b(?:demonstrate|propose|describe|outline|include\s+in\s+(?:the\s+)?(?:technical\s+)?proposal|(?:include|submit|provide|attach)\b[\s\S]{0,100}\bin\s+(?:the\s+)?(?:technical\s+)?proposal|with\s+(?:its|the|their)\s+(?:bid|tender|proposal|offer)|as\s+part\s+of\s+(?:the\s+)?(?:bid|tender|proposal|offer)|(?:submit|provide)\s+(?:a\s+)?(?:detailed\s+)?(?:plan|methodology|approach|schedule)|provide\s+(?:evidence|proof|confirmation)\s+that|commit(?:s|ted|ment)?\s+to\s+(?:providing|delivering|performing)|undertakes?\s+to\s+(?:provide|deliver|perform)|shall\s+confirm\s+in\s+(?:its|the)\s+(?:bid|proposal)|methodology\s+(?:covering|in\s+(?:the\s+)?(?:technical\s+)?proposal))\b/i;

export const EXECUTION_VERB =
  /\b(?:install(?:ed|ing)?|commission(?:ed|ing)?|mobiliz(?:e|ed|ation)|maintain(?:ed|ing)?|repair(?:ed|ing)?|replac(?:e|ed|ement)|train(?:ed)?|transport(?:ed|ing)?|off-?load(?:ing|ed)?|unload(?:ing|ed)?|deliver\s+within\b|deliver(?:ed|ing)?\s+(?:the\s+)?(?:goods|equipment|materials|works|items)|execute\s+(?:the\s+)?(?:works|contract|services|installation)|implement\s+(?:the\s+)?(?:works|contract|services)|perform(?:s|ed)?\s+(?:the\s+)?(?:services|works|contract)|submit\s+monthly|provide\s+training)\b/i;

/**
 * Physical / service performance vocabulary. Detects an execution-shaped
 * action only — never decides admission or post-award by itself.
 */
export const PERFORMANCE_DUTY_SHAPE =
  /\b(?:unload(?:ing|ed)?|off-?load(?:ing|ed)?|install(?:ation|ed|ing)?|commission(?:ing|ed)?|corrective\s+maintenance|preventive\s+maintenance|replac(?:e|ed|ement)|repair(?:s|ed|ing)?|post[- ]contract\s+(?:service|support)|after[- ]sales?\s+service|site\s+(?:assembly|erection|installation)|handover|taking[- ]over|deliver(?:y|ed|ing)?\s+(?:of\s+)?(?:the\s+)?(?:goods|equipment|materials|works|items))\b/i;

/** Reception / site-of-performance trigger — not the verb alone. */
export const SITE_OR_RECEPTION_TRIGGER =
  /\b(?:at\s+(?:the\s+)?(?:specified\s+)?(?:site|premises|rooms?|areas?|destination|project|hospital|facility|warehouse)|to\s+(?:the\s+)?(?:site|premises|destination|project|hospital|facility)|upon\s+(?:reception|acceptance|handover|taking[- ]over)|after\s+(?:delivery|installation|commissioning|acceptance|reception|handover|taking[- ]over)|placement\s+at)\b/i;

/** Contract-period / visit / SLA performance trigger. */
export const CONTRACT_PERIOD_OR_VISIT_TRIGGER =
  /\b(?:maintenance\s+visits?|service\s+visits?|during\s+(?:the\s+)?(?:contract|implementation|performance|warranty)|throughout\s+(?:the\s+)?(?:contract(?:\s+period)?|period\s+of\s+performance)|under\s+(?:the\s+)?(?:contract|warranty)|post[- ]contract\s+period|(?:kpi|sla|service\s+level)s?)\b/i;

export const PAST_CAPABILITY_OR_ELIGIBILITY =
  /\b(?:have\s+(?:completed|installed|supplied|performed|provided)|years?\s+of\s+experience|similar\s+(?:projects?|contracts?|installations?|assignments?)|track\s+record)\b/i;

/** Attributive participles ("installed equipment") are not performance duties. */
const ATTRIBUTIVE_PERFORMANCE =
  /\b(?:installed|commissioned|delivered|maintained|repaired|replaced)\s+(?:av\s+)?(?:equipment|goods|items|systems?|works|components?|parts?)\b/gi;

export function textForExecutionShape(text: string): string {
  return text.replace(ATTRIBUTIVE_PERFORMANCE, " equipment ");
}

export type LifecycleTriggerKind =
  | "PRE_AWARD_COMMITMENT"
  | "POST_AWARD_EVENT"
  | "SITE_OR_RECEPTION"
  | "CONTRACT_PERIOD_PERFORMANCE"
  | "PERFORMANCE_ARTEFACT"
  | "NONE";

export type LifecycleCommitmentFrame = {
  executionShaped: boolean;
  trigger: LifecycleTriggerKind;
  preAwardCommitment: boolean;
  explicitPostAwardTrigger: boolean;
  canExcludeAsPostAward: boolean;
  canAdmitAsPreAwardCommitment: boolean;
  /** Execution-shaped duty with neither bid-commitment nor post-award trigger. */
  insufficientFrame: boolean;
};

/**
 * Complete lifecycle frame: actor + trigger + temporal + phase purpose.
 * Execution vocabulary without a trigger is neither invented post-award
 * nor automatically admitted as a bidder-stage requirement.
 */
export function analyzeLifecycleCommitmentFrame(input: {
  text: string;
  actor: SemanticActor;
}): LifecycleCommitmentFrame {
  const t = input.text;
  const preAwardCommitment =
    PRE_AWARD_COMMITMENT_FRAME.test(t) ||
    (isBidderLikeActor(input.actor) &&
      /\b(?:demonstrate|propose|describe|outline|offer|commit(?:s|ted|ment)?|methodology|with\s+(?:its|the|their)\s+(?:bid|tender|proposal|offer)|as\s+part\s+of\s+(?:the\s+)?(?:bid|tender|proposal|offer))\b/i.test(
        t,
      ));
  const pastCapability = PAST_CAPABILITY_OR_ELIGIBILITY.test(t);
  const dutyText = textForExecutionShape(t);
  const executionShaped =
    !pastCapability &&
    (PERFORMANCE_DUTY_SHAPE.test(dutyText) ||
      EXECUTION_VERB.test(dutyText) ||
      CONTRACT_EXECUTION_CUE.test(dutyText) ||
      SITE_PERFORMANCE_CUE.test(dutyText) ||
      POST_AWARD_ARTEFACT_CUE.test(dutyText) ||
      PAYMENT_ADMINISTRATION_CUE.test(dutyText));

  const instrument =
    POST_AWARD_INSTRUMENT_CUE.test(t) ||
    /\b(?:after|upon)\s+(?:the\s+)?(?:award|notification\s+of\s+award)\b/i.test(t);
  const siteOrReception =
    SITE_PERFORMANCE_CUE.test(t) || SITE_OR_RECEPTION_TRIGGER.test(t);
  const contractPeriod =
    POST_AWARD_TEMPORAL_CUE.test(t) || CONTRACT_PERIOD_OR_VISIT_TRIGGER.test(t);
  const artefact = POST_AWARD_ARTEFACT_CUE.test(t) || PAYMENT_ADMINISTRATION_CUE.test(t);

  let trigger: LifecycleTriggerKind = "NONE";
  if (preAwardCommitment) trigger = "PRE_AWARD_COMMITMENT";
  else if (instrument) trigger = "POST_AWARD_EVENT";
  else if (siteOrReception) trigger = "SITE_OR_RECEPTION";
  else if (artefact) trigger = "PERFORMANCE_ARTEFACT";
  else if (contractPeriod) trigger = "CONTRACT_PERIOD_PERFORMANCE";

  const explicitPostAwardTrigger =
    trigger === "POST_AWARD_EVENT" ||
    trigger === "SITE_OR_RECEPTION" ||
    trigger === "CONTRACT_PERIOD_PERFORMANCE" ||
    trigger === "PERFORMANCE_ARTEFACT";

  const bidderScopeCommitment =
    isBidderLikeActor(input.actor) &&
    executionShaped &&
    !explicitPostAwardTrigger &&
    !/\b(?:the\s+)?(?:supplier|contractor)s?\s+shall\b/i.test(t);

  const canAdmitAsPreAwardCommitment =
    (preAwardCommitment || pastCapability || bidderScopeCommitment) &&
    !explicitPostAwardTrigger;
  const canExcludeAsPostAward =
    executionShaped && explicitPostAwardTrigger && !preAwardCommitment;
  const insufficientFrame =
    executionShaped &&
    !canAdmitAsPreAwardCommitment &&
    !canExcludeAsPostAward &&
    !isBidderLikeActor(input.actor);

  return {
    executionShaped,
    trigger,
    preAwardCommitment,
    explicitPostAwardTrigger,
    canExcludeAsPostAward,
    canAdmitAsPreAwardCommitment,
    insufficientFrame,
  };
}

export function classifyProcurementPhase(input: {
  text: string;
  actor: SemanticActor;
  documentRole: SemanticDocumentRole;
  sectionRole?: SemanticSectionRole | null;
}): ProcurementPhase {
  const t = input.text;
  const section = input.sectionRole ?? "UNKNOWN";

  const lifecycle = analyzeLifecycleCommitmentFrame({ text: t, actor: input.actor });

  // Bid-disclosed commercial conditions of the offer bind at submission.
  // Mention of a later contract period does not invent MULTI_PHASE or post-award.
  if (
    BID_STAGE_COMMERCIAL_FRAME.test(t) &&
    !PAYMENT_ADMINISTRATION_CUE.test(t) &&
    !lifecycle.canExcludeAsPostAward
  ) {
    if (BID_TIME_TEMPORAL.test(t) || BID_STAGE_SECURITY_CUE.test(t)) {
      return "BID_SUBMISSION";
    }
    return "PRE_AWARD_COMMITMENT";
  }
  if (
    /\bpayment\s+shall\s+be\s+made\b/i.test(t) &&
    !PAYMENT_ADMINISTRATION_CUE.test(t) &&
    !POST_AWARD_INSTRUMENT_CUE.test(t) &&
    !lifecycle.canExcludeAsPostAward
  ) {
    if (
      /\b(?:after|upon|following)\s+(?:delivery|acceptance|completion|invoice)\b/i.test(t) &&
      !BID_TIME_TEMPORAL.test(t) &&
      !BID_STAGE_COMMERCIAL_FRAME.test(t)
    ) {
      return "MIXED_OR_AMBIGUOUS";
    }
    return "BID_SUBMISSION";
  }

  // Explicit pre-award commitment frame wins over future-performance wording.
  if (lifecycle.canAdmitAsPreAwardCommitment && isBidderLikeActor(input.actor)) {
    if (
      /\b(?:submit|submission|with\s+(?:its|the|their)\s+(?:bid|tender|proposal|offer)|in\s+(?:the\s+)?(?:technical\s+)?proposal)\b/i.test(
        t,
      )
    ) {
      return "BID_SUBMISSION";
    }
    return lifecycle.preAwardCommitment ? "PRE_AWARD_COMMITMENT" : "PRE_AWARD";
  }
  if (PRE_AWARD_COMMITMENT_FRAME.test(t) && isBidderLikeActor(input.actor)) {
    if (
      /\b(?:submit|submission|with\s+(?:its|the|their)\s+(?:bid|tender|proposal|offer)|in\s+(?:the\s+)?(?:technical\s+)?proposal)\b/i.test(
        t,
      )
    ) {
      return "BID_SUBMISSION";
    }
    return "PRE_AWARD_COMMITMENT";
  }

  // Execution-shaped duty with no bid-commitment and no post-award trigger
  // stays UNKNOWN — do not invent BID_SUBMISSION or POST_AWARD.
  if (lifecycle.insufficientFrame) {
    return "UNKNOWN";
  }

  // Successful bidder + performance security after contract receipt → post-award.
  if (
    SUCCESSFUL_BIDDER_CUE.test(t) &&
    /\bperformance\s+security\b/i.test(t) &&
    /\b(?:after\s+(?:award|receipt)|upon\s+receipt|after\s+receipt)\b/i.test(t) &&
    !AWARD_TIMED_DUTY_CUE.test(t) &&
    !/\bwith\s+(?:its|the)\s+(?:bid|proposal|tender)\b/i.test(t)
  ) {
    return "POST_AWARD";
  }

  // Contract execution / delivery / warranty — post-award for performers.
  // Never treat bidder-side "commission/deliver by date" bid commitments as
  // post-award solely because execution vocabulary appears.
  if (
    (CONTRACT_EXECUTION_CUE.test(t) ||
      POST_AWARD_TEMPORAL_CUE.test(t) ||
      POST_AWARD_INSTRUMENT_CUE.test(t) ||
      SITE_PERFORMANCE_CUE.test(t) ||
      POST_AWARD_ARTEFACT_CUE.test(t) ||
      PAYMENT_ADMINISTRATION_CUE.test(t)) &&
    !BID_STAGE_SECURITY_CUE.test(t) &&
    !PRE_AWARD_COMMITMENT_FRAME.test(t)
  ) {
    const performerActor =
      input.actor === "CONTRACTOR" ||
      input.actor === "SUPPLIER" ||
      input.actor === "SUBCONTRACTOR" ||
      input.actor === "SUCCESSFUL_BIDDER" ||
      SUCCESSFUL_BIDDER_CUE.test(t) ||
      isPerformerImpersonal(t);

    const strongTemporal =
      POST_AWARD_TEMPORAL_CUE.test(t) ||
      POST_AWARD_INSTRUMENT_CUE.test(t) ||
      /\b(?:after\s+(?:delivery|installation|commissioning|acceptance|handover|award|receipt)|during\s+(?:the\s+)?(?:warranty|contract|implementation)|under\s+(?:the\s+)?warranty)\b/i.test(
        t,
      );

    const executionDuty =
      EXECUTION_VERB.test(t) ||
      CONTRACT_EXECUTION_CUE.test(t) ||
      SITE_PERFORMANCE_CUE.test(t) ||
      POST_AWARD_ARTEFACT_CUE.test(t) ||
      PAYMENT_ADMINISTRATION_CUE.test(t);

    if (
      (performerActor && (executionDuty || strongTemporal)) ||
      (strongTemporal && executionDuty) ||
      ((SITE_PERFORMANCE_CUE.test(t) ||
        POST_AWARD_ARTEFACT_CUE.test(t) ||
        PAYMENT_ADMINISTRATION_CUE.test(t) ||
        POST_AWARD_INSTRUMENT_CUE.test(t)) &&
        executionDuty)
    ) {
      // Award-timed security/signing remains AWARD (not open execution).
      if (
        AWARD_TIMED_DUTY_CUE.test(t) &&
        !CONTRACT_EXECUTION_CUE.test(t) &&
        !/\b(?:install|commission|train|repair|warranty|transport)\b/i.test(t)
      ) {
        return "AWARD";
      }
      if (
        POST_AWARD_INSTRUMENT_CUE.test(t) ||
        /\bafter\s+receipt\s+of\s+(?:the\s+)?(?:contract|purchase\s+order|letter\s+of\s+acceptance)\b/i.test(
          t,
        )
      ) {
        return "POST_AWARD";
      }
      if (
        input.documentRole === "SAMPLE_CONTRACT" ||
        input.documentRole === "CONTRACT_FORM" ||
        input.documentRole === "TERMS_AND_CONDITIONS" ||
        section === "CONTRACT_CONDITIONS" ||
        section === "PERFORMANCE" ||
        section === "DELIVERY"
      ) {
        return "CONTRACT_EXECUTION";
      }
      if (
        /\b(?:after\s+delivery|upon\s+delivery|install(?:ation|ing)?\s+and\s+commission|provide\s+training|warranty)\b/i.test(
          t,
        )
      ) {
        if (/\binstall(?:ation|ing)?|commission\b/i.test(t)) {
          return "INSTALLATION_IMPLEMENTATION";
        }
        return "DELIVERY";
      }
      if (CONTRACT_EXECUTION_CUE.test(t)) return "CONTRACT_EXECUTION";
      return "POST_AWARD";
    }
  }

  // Award-timed duties only (security/signing windows) — not bare "successful bidder".
  if (AWARD_TIMED_DUTY_CUE.test(t) && !CONTRACT_EXECUTION_CUE.test(t)) {
    return "AWARD";
  }

  if (EVALUATION_TEMPORAL.test(t) && isBidderLikeActor(input.actor)) {
    return "PRE_AWARD";
  }
  if (section === "EVALUATION") return "EVALUATION";

  if (
    input.actor === "CONTRACTOR" &&
    /\b(?:shall|must|will)\b/i.test(t) &&
    !/\b(?:bidder|tenderer|offeror)\b/i.test(t) &&
    !lifecycle.canAdmitAsPreAwardCommitment
  ) {
    if (lifecycle.canExcludeAsPostAward) {
      if (
        input.documentRole === "SAMPLE_CONTRACT" ||
        input.documentRole === "CONTRACT_FORM" ||
        input.documentRole === "TERMS_AND_CONDITIONS"
      ) {
        return "CONTRACT_EXECUTION";
      }
      return "POST_AWARD";
    }
    return "UNKNOWN";
  }

  // Supplier/contractor/successful-bidder execution without temporal cue still
  // post-award when the duty is pure performance and not a bid frame.
  if (
    (input.actor === "SUPPLIER" ||
      input.actor === "CONTRACTOR" ||
      input.actor === "SUCCESSFUL_BIDDER" ||
      isBidderLikeActor(input.actor)) &&
    (SITE_PERFORMANCE_CUE.test(t) ||
      POST_AWARD_ARTEFACT_CUE.test(t) ||
      PAYMENT_ADMINISTRATION_CUE.test(t) ||
      POST_AWARD_INSTRUMENT_CUE.test(t) ||
      POST_AWARD_TEMPORAL_CUE.test(t) ||
      (input.actor === "CONTRACTOR" && EXECUTION_VERB.test(t)) ||
      (input.actor === "SUCCESSFUL_BIDDER" && EXECUTION_VERB.test(t))) &&
    !PRE_AWARD_COMMITMENT_FRAME.test(t) &&
    !BID_STAGE_SECURITY_CUE.test(t) &&
    !/\bwith\s+(?:its|the|their)\s+(?:bid|tender|proposal)\b/i.test(t)
  ) {
    return "CONTRACT_EXECUTION";
  }

  if (
    /\b(?:evaluation|evaluat(?:e|ion)\s+(?:of\s+)?bids?|award\s+criteria|scoring|preliminary\s+examination)\b/i.test(
      t,
    ) &&
    /\b(?:authority|purchaser|employer|committee|procuring|[A-Z]{3,}\s+(?:shall|must|will|may))\b/i.test(
      t,
    )
  ) {
    return "EVALUATION";
  }

  if (/\b(?:pre[- ]?bid|clarification\s+meeting|site\s+visit)\b/i.test(t)) {
    return "PRE_BID";
  }

  if (
    /\b(?:submit(?:ted|ting)?|submission|bid\s+closing|tender\s+closing|proposal\s+deadline|with\s+the\s+(?:bid|tender|proposal)|proposal\s+validity)\b/i.test(
      t,
    )
  ) {
    return "BID_SUBMISSION";
  }

  if (
    input.documentRole === "SAMPLE_CONTRACT" ||
    input.documentRole === "CONTRACT_FORM"
  ) {
    return "UNKNOWN";
  }

  if (
    input.actor === "BIDDER" ||
    input.actor === "TENDERER" ||
    input.actor === "OFFEROR" ||
    input.actor === "ECONOMIC_OPERATOR" ||
    input.actor === "PROSPECTIVE_BIDDER"
  ) {
    return "BID_SUBMISSION";
  }

  if (input.actor === "SUCCESSFUL_BIDDER") {
    if (lifecycle.canExcludeAsPostAward || (EXECUTION_VERB.test(t) && lifecycle.explicitPostAwardTrigger)) {
      return "POST_AWARD";
    }
    if (AWARD_TIMED_DUTY_CUE.test(t)) return "AWARD";
    if (lifecycle.insufficientFrame || EXECUTION_VERB.test(t)) return "UNKNOWN";
    return "MIXED_OR_AMBIGUOUS";
  }

  // Supplier documentary / commercial statements stay bid-time.
  // Execution-shaped supplier duties without a trigger already returned UNKNOWN.
  if (input.actor === "SUPPLIER") {
    return lifecycle.executionShaped ? "UNKNOWN" : "BID_SUBMISSION";
  }

  return "UNKNOWN";
}

function isBidderLikeActor(actor: SemanticActor): boolean {
  return (
    actor === "BIDDER" ||
    actor === "TENDERER" ||
    actor === "OFFEROR" ||
    actor === "ECONOMIC_OPERATOR" ||
    actor === "CONSULTANT" ||
    actor === "PROSPECTIVE_BIDDER"
  );
}

function isPerformerImpersonal(text: string): boolean {
  return (
    /\b(?:the\s+)?(?:goods|equipment|works|services)\s+shall\s+be\s+(?:installed|commissioned|delivered|maintained|repaired)\b/i.test(
      text,
    ) || /\bwarranty\s+shall\s+(?:remain|be)\b/i.test(text)
  );
}

/** Phases that must not enter bidder-stage canonical requirements. */
export function isPostAwardOnlyPhase(phase: ProcurementPhase): boolean {
  return (
    phase === "POST_AWARD" ||
    phase === "CONTRACT_PERFORMANCE" ||
    phase === "CONTRACT_EXECUTION" ||
    phase === "DELIVERY" ||
    phase === "DELIVERY_IMPLEMENTATION" ||
    phase === "INSTALLATION_IMPLEMENTATION"
  );
}

/** Phases that can carry a genuine bid-stage obligation. */
export function isBidTimePhase(phase: ProcurementPhase): boolean {
  return (
    phase === "BID_SUBMISSION" ||
    phase === "PRE_AWARD" ||
    phase === "PRE_AWARD_COMMITMENT" ||
    phase === "PRE_BID" ||
    phase === "MULTI_PHASE"
  );
}

/**
 * Identity family so pre-award commitment and post-award execution never merge.
 * MULTI_PHASE is kept only as a legacy alias of bid-time commercial.
 */
export function lifecycleIdentityFamily(phase: string): string {
  if (phase === "EVALUATION") return "eval";
  if (phase === "AWARD") return "award";
  if (phase === "MIXED_OR_AMBIGUOUS") return "mixed";
  if (phase === "UNKNOWN") return "unknown";
  if (isPostAwardOnlyPhase(phase as ProcurementPhase)) return "post";
  return "pre";
}
