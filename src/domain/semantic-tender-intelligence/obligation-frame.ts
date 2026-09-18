/**
 * Complete bidder-obligation frame — independent of keywords, tenders, and filenames.
 *
 * A canonical requirement needs cooperating evidence:
 *   actor + obligation/action + object + applicable context
 * Document identifiers, headings, introductions, disclaimers, and facts
 * never become that frame by concatenation or STI stamp alone.
 */

import { BIDDER_ACTOR_NOUN, hasUniversalObligationModal } from "./obligation-lexicon";

/** Solicitation / invitation identifier at the start of a clause. */
const DOCUMENT_IDENTIFIER_LEAD =
  /^(?:(?:invitation(?:\s+to\s+(?:bid|tender))?|request\s+for\s+(?:proposal|quotation|bids?)|solicitation|tender|bid|procurement)\s+)?(?:ref(?:erence)?(?:\s*(?:no\.?|number|n[°o]))?|no\.?|number)\s*[:\-–]\s*\S+/i;

/** Short instrument abbreviation + reference label (ITB/RFP/RFQ/ITT/EOI class). */
const INSTRUMENT_ABBREV_REFERENCE =
  /^[A-Z]{2,8}\s+[Rr]ef(?:erence)?(?:\s*(?:[Nn]o\.?|[Nn]umber|n[°o]))?\s*[:\-–]\s*\S+/;

/** Limitation / disclaimer that denies or hedges an obligation. */
const DISCLAIMER_OR_LIMITATION =
  /\b(?:this\s+does\s+not\s+(?:limit|constitute|prevent|exclude|restrict|preclude|waive|affect)|does\s+not\s+limit\s+the\s+inclusion|nothing\s+(?:in|herein)\s+(?:this\s+)?(?:document|section|invitation|clause|paragraph|instrument)|provided\s+(?:solely\s+)?for\s+(?:information|guidance|illustration|reference)\s+only|for\s+the\s+avoidance\s+of\s+doubt|for\s+information\s+only)\b/i;

/** Introductory / background framing — describes the document, not a duty. */
const INTRODUCTORY_PROSE =
  /^(?:this\s+(?:invitation|document|section|tender|solicitation|notice|chapter)\s+(?:sets\s+out|describes|is\s+intended|aims\s+to|provides|outlines|does\s+not|is\s+provided)|the\s+purpose\s+of\s+this\s+(?:invitation|document|section|tender|notice)\b)/i;

const BIDDER_OBLIGATION_FORCE =
  /\b(?:bidder|tenderer|offeror|soumissionnaire|economic\s+operator)s?\s+(?:shall|must|will|should|is\s+required|are\s+required)\b/i;

const IMPERSONAL_DUTY_FORCE =
  /\b(?:shall|must)\s+(?:submit|provide|supply|include|attach|demonstrate|comply|support|meet|furnish|quote|remain)\b/i;

export type ObligationFrameAnalysis = {
  hasDocumentIdentifierLead: boolean;
  hasDisclaimerOrLimitation: boolean;
  hasIntroductoryProse: boolean;
  hasBidderObligationForce: boolean;
  hasImpersonalDutyForce: boolean;
  hasObligationModal: boolean;
  /** True only when the clause can prove a bidder-stage obligation frame. */
  canAdmitAsBidderObligation: boolean;
  blockReason:
    | "DOCUMENT_IDENTIFIER"
    | "DISCLAIMER_OR_LIMITATION"
    | "INTRODUCTORY_PROSE"
    | null;
};

function hasNamedActorOrDuty(text: string): boolean {
  return (
    BIDDER_OBLIGATION_FORCE.test(text) ||
    IMPERSONAL_DUTY_FORCE.test(text) ||
    (BIDDER_ACTOR_NOUN.test(text) && hasUniversalObligationModal(text))
  );
}

/**
 * Analyze whether `text` contains a complete bidder-obligation frame.
 * Provenance is supplied by the caller; this function does not invent it.
 */
export function analyzeObligationFrame(text: string): ObligationFrameAnalysis {
  const t = text.replace(/\s+/g, " ").trim();
  const hasDocumentIdentifierLead =
    DOCUMENT_IDENTIFIER_LEAD.test(t) || INSTRUMENT_ABBREV_REFERENCE.test(t);
  const hasDisclaimerOrLimitation = DISCLAIMER_OR_LIMITATION.test(t);
  const hasIntroductoryProse = INTRODUCTORY_PROSE.test(t);
  const hasBidderObligationForce = BIDDER_OBLIGATION_FORCE.test(t);
  const hasImpersonalDutyForce = IMPERSONAL_DUTY_FORCE.test(t);
  const hasModal = hasUniversalObligationModal(t);
  const namedDuty = hasNamedActorOrDuty(t);

  let blockReason: ObligationFrameAnalysis["blockReason"] = null;
  if (hasDocumentIdentifierLead && !namedDuty) {
    blockReason = "DOCUMENT_IDENTIFIER";
  } else if (hasDisclaimerOrLimitation && !hasBidderObligationForce) {
    blockReason = "DISCLAIMER_OR_LIMITATION";
  } else if (hasIntroductoryProse && !namedDuty) {
    blockReason = "INTRODUCTORY_PROSE";
  }

  return {
    hasDocumentIdentifierLead,
    hasDisclaimerOrLimitation,
    hasIntroductoryProse,
    hasBidderObligationForce,
    hasImpersonalDutyForce,
    hasObligationModal: hasModal,
    canAdmitAsBidderObligation: blockReason === null,
    blockReason,
  };
}
