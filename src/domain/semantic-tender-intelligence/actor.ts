/**
 * Grammatical / semantic actor attribution.
 * BIDDER ≠ CONTRACTOR ≠ BUYER ≠ MANUFACTURER — never interchangeable with phase.
 *
 * Grammatical / semantic subject controls. Incidental later mention of
 * bidder/offeror as beneficiary/recipient must NOT override a buyer subject.
 */

import { attributeObligationActor } from "@/domain/tender-requirements/obligation-actor";
import type { SemanticActor } from "./types";

/** Bidder/offeror as obligated subject of a duty modal. */
const BIDDER_SUBJECT =
  /\b(?:the\s+)?(?:bidder|tenderer|offeror|soumissionnaire|economic\s+operator|petender)s?\b.{0,50}\b(?:shall|must|will|may|is\s+required|are\s+required|doit|doivent|devra|dikehendaki|hendaklah)\b/i;

/** Contractor as obligated subject (active voice). */
const CONTRACTOR_SUBJECT =
  /\b(?:the\s+)?contractors?\b.{0,40}\b(?:shall|must|will|is\s+required|are\s+required)\b/i;

/** Passive / instrumental contractor duty — "… shall be maintained by the Contractor". */
const CONTRACTOR_PASSIVE =
  /\b(?:shall|must|will|is\s+to\s+be|are\s+to\s+be)\b[\s\S]{0,80}\bby\s+the\s+contractors?\b/i;

const BUYER_ROLE_AS_MODAL_SUBJECT =
  /\b(?:the\s+)?(?:authority|purchaser|employer|procuring\s+entity|contracting\s+authority|ministry|agency|client|evaluation\s+committee|tender\s+committee|focal\s+person|project\s+manager|programme\s+manager|program\s+manager|end\s+user|contracting\s+officer|authorized\s+officer)\s+(?:shall|must|will|may)\b/i;

/** Buyer-appointed agent as grammatical subject — not the mentioned supplier. */
const BUYER_AGENT_AS_SUBJECT =
  /\b(?:(?:unops|who|undp|unhcr|unicef|buyer|purchaser|employer|authority|procuring\s+entity)[- ]appointed\s+)?(?:focal\s+person|project\s+manager|programme\s+manager|end\s+user|contracting\s+officer)\s+(?:shall|must|will|may)\b/i;

const SUPPLIER_AS_SUBJECT =
  /\b(?:the\s+)?(?:supplier|vendor)s?\s+(?:shall|must|will|is\s+required|are\s+required)\b/i;

/** Institutional acronym as grammatical subject — 3+ letters (avoid JV/IT/CV false hits). */
const INSTITUTIONAL_AS_MODAL_SUBJECT =
  /\b[A-Z]{3,}(?:\/[A-Z]{2,})?\s+(?:shall|must|will|may)\b/;

const MANUFACTURER_SUBJECT =
  /\b(?:the\s+)?manufacturers?\b.{0,40}\b(?:shall|must|will|is\s+required)\b/i;

const SUCCESSFUL_BIDDER =
  /\b(?:the\s+)?successful\s+(?:bidder|tenderer|offeror|candidate)s?\b/i;

const BIDDER_LEADING =
  /^(?:the\s+)?(?:bidder|tenderer|offeror|soumissionnaire|economic\s+operator|petender)s?\s+(?:shall|must|will|may|doit|devra|dikehendaki|hendaklah)\b/i;

/**
 * Resolve grammatical actor. Explicit buyer/institutional subjects win over
 * incidental later bidder/offeror mentions (recipient / beneficiary).
 */
export function resolveSemanticActor(text: string): {
  actor: SemanticActor;
  obligationActorKind: ReturnType<typeof attributeObligationActor>["actor"];
  isBidderRequirementHint: boolean;
} {
  const attribution = attributeObligationActor(text);
  const t = text.toLowerCase();
  const trimmed = text.trim();

  // 0. Buyer / institutional acronym as modal subject — ALWAYS wins over later
  // bidder/offeror beneficiary mentions ("UNOPS shall … Offeror …").
  if (
    INSTITUTIONAL_AS_MODAL_SUBJECT.test(text) ||
    BUYER_ROLE_AS_MODAL_SUBJECT.test(text) ||
    BUYER_AGENT_AS_SUBJECT.test(text) ||
    /^(?:the\s+)?(?:purchaser|employer|authority|procuring\s+entity|contracting\s+authority)\s+(?:shall|must|will|may)\b/i.test(
      trimmed,
    )
  ) {
    // Exception: sentence truly opens with bidder as obligated subject.
    if (BIDDER_LEADING.test(trimmed)) {
      return bidderActorFromText(text, attribution);
    }
    return buyerActorFromText(t, attribution);
  }

  // 0b. Impersonal bid/proposal artefact — never invent a bidder identity.
  if (
    /^(?:the\s+)?(?:bids?|tenders?|proposals?|offers?)\s+(?:shall|must)\b/i.test(trimmed) &&
    !/\b(?:bidder|tenderer|offeror|soumissionnaire|economic\s+operator)s?\b/i.test(text)
  ) {
    return { actor: "IMPERSONAL", ...wrap(attribution) };
  }

  // 1. Successful bidder is a distinct actor — not interchangeable with BIDDER.
  if (SUCCESSFUL_BIDDER.test(text) && !BIDDER_LEADING.test(trimmed)) {
    return {
      actor: "SUCCESSFUL_BIDDER",
      ...wrap(attribution),
    };
  }

  // 2. Explicit bidder / tenderer as obligated subject.
  if (BIDDER_SUBJECT.test(text)) {
    return bidderActorFromText(text, attribution);
  }

  // 3. Contractor — active or passive — NOT a bidder.
  if (
    (CONTRACTOR_SUBJECT.test(text) || CONTRACTOR_PASSIVE.test(text)) &&
    !BIDDER_LEADING.test(trimmed) &&
    !/\b(?:bidder|tenderer|offeror)s?\s+(?:shall|must)\b/i.test(text)
  ) {
    return { actor: "CONTRACTOR", ...wrap(attribution) };
  }

  // 4. Attribution authority side (evaluation committee, purchaser, etc.).
  if (attribution.actor === "AUTHORITY_SIDE") {
    if (/\bevaluat|comit[eé]\s+d['']evaluation|reviewer\b/i.test(t)) {
      return { actor: "EVALUATOR", ...wrap(attribution) };
    }
    return buyerActorFromText(t, attribution);
  }

  if (attribution.actor === "DOCUMENT_PROCEDURE") {
    return { actor: "DOCUMENT_AUTHOR", ...wrap(attribution) };
  }
  if (attribution.actor === "CLARIFICATION_CONTEXT") {
    return { actor: "PROCURING_ENTITY", ...wrap(attribution) };
  }

  // 5. Manufacturer only when grammatical subject — not incidental mention.
  if (MANUFACTURER_SUBJECT.test(text) && !/\b(?:bidder|tenderer|offeror)\b/i.test(text)) {
    return { actor: "MANUFACTURER", ...wrap(attribution) };
  }

  if (attribution.actor === "BIDDER_SIDE") {
    // Contractor leaked through legacy attribution — never promote to bidder.
    if (
      /\bcontractors?\b/i.test(t) &&
      !/\b(?:bidder|tenderer|offeror|soumissionnaire)\b/i.test(t)
    ) {
      return { actor: "CONTRACTOR", ...wrap(attribution) };
    }
    if (/\bconsultant\b/i.test(t) && !/\bbidder|tenderer\b/i.test(t)) {
      return { actor: "CONSULTANT", ...wrap(attribution) };
    }
    if (SUPPLIER_AS_SUBJECT.test(text) && !/\b(?:bidder|tenderer|offeror)\b/i.test(t)) {
      return { actor: "SUPPLIER", ...wrap(attribution) };
    }
    return bidderActorFromText(text, attribution);
  }

  if (/\bboth\s+parties\b/i.test(t)) {
    return { actor: "BOTH_PARTIES", ...wrap(attribution) };
  }

  if (attribution.actor === "UNATTRIBUTED") {
    // Impersonal bid artefact ("Bids shall be submitted…") — never invent BIDDER.
    if (
      /\b(?:bids?|tenders?|proposals?|offers?)\s+(?:shall|must)\s+(?:be\s+)?(?:submitted|include|contain|comprise|consist|remain)\b/i.test(
        text,
      ) ||
      /\b(?:the\s+)?(?:goods|equipment|works|services)\s+(?:offered|proposed)\s+shall\b/i.test(text)
    ) {
      return { actor: "IMPERSONAL", ...wrap(attribution) };
    }
    return { actor: "UNKNOWN", ...wrap(attribution) };
  }

  return { actor: "UNKNOWN", ...wrap(attribution) };
}

function buyerActorFromText(
  t: string,
  attribution: ReturnType<typeof attributeObligationActor>,
): {
  actor: SemanticActor;
  obligationActorKind: ReturnType<typeof attributeObligationActor>["actor"];
  isBidderRequirementHint: boolean;
} {
  if (/\bevaluat|comit[eé]\s+d['']evaluation|reviewer\b/i.test(t)) {
    return { actor: "EVALUATOR", ...wrap(attribution) };
  }
  if (/\bpurchaser|employer|buyer\b/i.test(t)) {
    return { actor: "BUYER", ...wrap(attribution) };
  }
  if (/\bprocuring\s+entity\b/i.test(t)) {
    return { actor: "PROCURING_ENTITY", ...wrap(attribution) };
  }
  return { actor: "AUTHORITY", ...wrap(attribution) };
}

function bidderActorFromText(
  text: string,
  attribution: ReturnType<typeof attributeObligationActor>,
): {
  actor: SemanticActor;
  obligationActorKind: ReturnType<typeof attributeObligationActor>["actor"];
  isBidderRequirementHint: boolean;
} {
  if (/\bofferor\b/i.test(text)) return { actor: "OFFEROR", ...wrap(attribution) };
  if (/\btenderer|soumissionnaire|petender\b/i.test(text)) {
    return { actor: "TENDERER", ...wrap(attribution) };
  }
  if (/\beconomic\s+operator\b/i.test(text)) {
    return { actor: "ECONOMIC_OPERATOR", ...wrap(attribution) };
  }
  return { actor: "BIDDER", ...wrap(attribution) };
}

function wrap(attribution: ReturnType<typeof attributeObligationActor>) {
  return {
    obligationActorKind: attribution.actor,
    isBidderRequirementHint: attribution.isBidderRequirement,
  };
}
