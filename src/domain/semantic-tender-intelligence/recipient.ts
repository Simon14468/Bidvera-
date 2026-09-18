/**
 * Recipient / target of a clause — distinct from grammatical actor.
 * Example: "UNOPS shall notify the bidder" → actor BUYER, recipient BIDDER.
 */

import type { SemanticActor, SemanticRecipient } from "./types";

const ADDRESSED_TO_BIDDER =
  /\b(?:bidders?|tenderers?|offerors?|soumissionnaires?)\s+(?:shall|must|are\s+required|is\s+required|will|may)\b|\b(?:the\s+)?(?:bidder|tenderer|offeror)\s+shall\b|\byou\s+(?:must|shall|are\s+required)\b|\bveuillez\b|\bplease\s+(?:submit|provide|complete|attach)\b/i;

const ADDRESSED_TO_CONTRACTOR =
  /\b(?:the\s+)?contractors?\s+(?:shall|must|will|is\s+required)\b/i;

const ADDRESSED_TO_BUYER =
  /\b(?:the\s+)?(?:authority|purchaser|employer|procuring\s+entity|contracting\s+authority)\s+(?:shall|must|will|may)\b/i;

const PORTAL_ESOURCING =
  /\b(?:click|log\s*in|login|upload\s+via|e[- ]?sourcing|e[- ]?procurement|portal|online\s+system|electronic\s+submission\s+platform)\b/i;

const DRAFTER_NOTE =
  /\bnote\s+to\s+(?:be\s+)?deleted|note\s+to\s+(?:the\s+)?drafter|to\s+be\s+completed\s+by\s+the\s+purchaser\b/i;

export function resolveRecipient(input: {
  text: string;
  actor: SemanticActor;
}): SemanticRecipient {
  const { text, actor } = input;

  if (DRAFTER_NOTE.test(text)) return "DRAFTER";
  if (PORTAL_ESOURCING.test(text) && !ADDRESSED_TO_BIDDER.test(text)) {
    return "PORTAL_USER";
  }

  if (ADDRESSED_TO_BIDDER.test(text) || actor === "BIDDER" || actor === "TENDERER" || actor === "OFFEROR" || actor === "PROSPECTIVE_BIDDER" || actor === "SUCCESSFUL_BIDDER") {
    if (actor === "OFFEROR") return "OFFEROR";
    if (actor === "TENDERER") return "TENDERER";
    if (actor === "SUPPLIER") return "SUPPLIER";
    return "BIDDER";
  }

  if (ADDRESSED_TO_CONTRACTOR.test(text) || actor === "CONTRACTOR") {
    return "CONTRACTOR";
  }

  if (
    ADDRESSED_TO_BUYER.test(text) ||
    actor === "BUYER" ||
    actor === "AUTHORITY" ||
    actor === "PROCURING_ENTITY" ||
    actor === "EVALUATOR"
  ) {
    if (actor === "BUYER") return "BUYER";
    return "PROCURING_ENTITY";
  }

  if (actor === "BOTH_PARTIES") return "BOTH_PARTIES";
  if (actor === "SUPPLIER") return "SUPPLIER";
  if (actor === "DOCUMENT_AUTHOR") return "DRAFTER";

  return "UNKNOWN";
}

export function recipientIsBidderSide(recipient: SemanticRecipient): boolean {
  return (
    recipient === "BIDDER" ||
    recipient === "TENDERER" ||
    recipient === "OFFEROR" ||
    recipient === "SUPPLIER"
  );
}
