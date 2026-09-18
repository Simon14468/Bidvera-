/**
 * Mixed-lifecycle clause detection.
 *
 * When a single clause binds BOTH a pre-award bidder duty and a
 * post-award performer duty, do not invent a single bidder interpretation.
 * Fail closed to MIXED_OR_AMBIGUOUS.
 *
 * Generic procurement patterns only — no buyer/tender-specific rules.
 */

import { PRE_AWARD_COMMITMENT_FRAME } from "./phase";

const BIDDER_PRE_AWARD_DUTY =
  /\b(?:the\s+)?(?:bidder|tenderer|offeror|soumissionnaire|economic\s+operator)s?\b[\s\S]{0,120}\b(?:shall|must|will)\b[\s\S]{0,160}\b(?:submit|provide|describe|demonstrate|include|propose|notify|complete|confirm|commit)/i;

const POST_AWARD_PERFORMER_DUTY =
  /\b(?:after\s+award|upon\s+award|after\s+(?:contract\s+)?(?:signature|signing|receipt)|during\s+(?:the\s+)?(?:contract|implementation)|post[- ]award)\b[\s\S]{0,80}\b(?:the\s+)?(?:contractor|supplier)s?\b[\s\S]{0,60}\b(?:shall|must|will)\b|\b(?:the\s+)?(?:contractor|supplier)s?\b[\s\S]{0,40}\b(?:shall|must|will)\b[\s\S]{0,100}\b(?:install|commission|deliver|perform|maintain|train|repair|replace|transport|report|off-?load)/i;

/**
 * True when the text clearly contains both a bidder pre-award frame and a
 * contractor/supplier post-award execution frame.
 */
export function hasMixedLifecycleFrames(text: string): boolean {
  const t = text.replace(/\s+/g, " ").trim();
  if (t.length < 40) return false;

  const pre =
    BIDDER_PRE_AWARD_DUTY.test(t) ||
    (PRE_AWARD_COMMITMENT_FRAME.test(t) &&
      /\b(?:bidder|tenderer|offeror)\b/i.test(t)) ||
    /\b(?:submit|lodge|include|attach)\b[\s\S]{0,60}\b(?:with|in)\s+(?:the\s+)?(?:bid|proposal|tender|offer)\b/i.test(
      t,
    );

  const post = POST_AWARD_PERFORMER_DUTY.test(t);

  // Conjunction / sequencing cue strengthens mixed detection.
  const sequenced =
    /\b(?:and\s+(?:after|then|subsequently)|;\s*(?:after|the\s+contractor|the\s+supplier)|,\s+and\s+after\s+award)\b/i.test(
      t,
    );

  // Same-actor clause that independently binds bid submission AND later execution.
  const sequencedBidderExecution =
    /\b(?:and|,)\s+(?:the\s+)?(?:bidder|successful\s+bidder|supplier|contractor)?\s*(?:shall|must|will)\s+(?:then\s+)?(?:deliver|install|commission|perform|maintain)\b[\s\S]{0,80}\b(?:after|upon|following)\s+(?:award|notification|receiving|contract|purchase\s+order|site\s+handover)/i.test(
      t,
    );

  const capabilityCommitment =
    /\b(?:demonstrate|commit(?:s|ted|ment)?\s+to|ability\s+to|capable\s+of)\b/i.test(t);

  if (capabilityCommitment && !post && !sequencedBidderExecution) {
    return false;
  }

  return Boolean(
    (pre && post && (sequenced || t.length > 120)) ||
      (pre && sequencedBidderExecution),
  );
}
