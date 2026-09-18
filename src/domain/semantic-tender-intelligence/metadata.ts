/**
 * Metadata detection — tender facts never become requirements.
 * Extraction is separate from STI obligation interpretation.
 */

import type { SemanticClauseRole } from "./types";

export type DetectedMetadataField =
  | "title"
  | "buyer"
  | "reference"
  | "deadline"
  | "clarification_deadline"
  | "currency"
  | "value"
  | "location"
  | "lots"
  | "procurement_method"
  | "other";

export type MetadataDetection = {
  isMetadata: boolean;
  field: DetectedMetadataField | null;
  clauseRole: SemanticClauseRole | null;
};

const METADATA_LINE =
  /^(?:tender\s+(?:title|reference|number)|invitation\s+to\s+bid|reference\s*(?:no\.?|number)?|submission\s+deadline|closing\s+date|clarification\s+deadline|estimated\s+(?:contract\s+)?value|procurement\s+method|currency|country|location|publication\s+date|bid\s+opening(?:\s+date)?|opening\s+date|contract\s+(?:start|commencement|signature)\s+date|delivery\s+date|validity\s+period)\s*[:\-–]/i;

const METADATA_INLINE =
  /\b(?:submission\s+deadline|closing\s+date|clarification\s+deadline|estimated\s+(?:contract\s+)?value|procurement\s+method|tender\s+reference|invitation\s+to\s+bid)\b/i;

const DEADLINE_FACT =
  /\b(?:deadline|closing\s+date|submission\s+(?:date|deadline)|bids?\s+must\s+be\s+received\s+by)\b.{0,40}\d{1,2}/i;

const VALUE_FACT =
  /\b(?:estimated\s+(?:contract\s+)?value|budget|montant\s+estim)\b.{0,40}\d/i;

const BUYER_FACT =
  /^(?:procuring\s+entity|contracting\s+authority|employer|purchaser|buyer|client)\s*[:\-–]/i;

const REFERENCE_FACT =
  /^(?:(?:invitation(?:\s+to\s+(?:bid|tender))?|request\s+for\s+(?:proposal|quotation|bids?)|solicitation|tender|bid)\s+)?(?:reference|ref\.?|no\.?|number|itt\s+no\.?|rfp\s+no\.?|tender\s+no\.?)\s*[:\-–]/i;

/** Instrument abbreviation + reference label — not a named solicitation. */
const INSTRUMENT_ABBREV_REFERENCE =
  /^[A-Z]{2,8}\s+[Rr]ef(?:erence)?(?:\s*(?:[Nn]o\.?|[Nn]umber|n[°o]))?\s*[:\-–]\s*\S+/;

/**
 * True when the statement is a package metadata fact, not a bidder obligation.
 */
export function detectMetadataFact(text: string): MetadataDetection {
  const t = text.replace(/\s+/g, " ").trim();
  if (t.length < 8) {
    return { isMetadata: false, field: null, clauseRole: null };
  }

  // Modal duties are not metadata, even when they mention a deadline word.
  // Offer/bid validity is a commercial condition of the offer, not a deadline fact.
  if (
    /\b(?:bidder|tenderer|offeror)s?\s+(?:shall|must)\b/i.test(t) ||
    /\b(?:shall|must)\s+(?:submit|provide|supply|deliver|circulate|notify|evaluate|open)\b/i.test(
      t,
    ) ||
    /\b(?:bid|offer|proposal|tender)\s+(?:shall|must)\s+remain\s+valid\b/i.test(t) ||
    /\b(?:validity|valid)\s+of\s+(?:the\s+)?(?:bid|offer|proposal|tender)\b/i.test(t) ||
    /\b(?:prices?|payment\s+terms?)\s+shall\b/i.test(t) ||
    /\b[A-Z]{3,}(?:\/[A-Z]{2,})?\s+(?:shall|must|will|may)\b/.test(t) ||
    /\b(?:the\s+)?(?:purchaser|employer|authority|procuring\s+entity|contracting\s+authority|evaluation\s+committee)\s+(?:shall|must|will|may)\b/i.test(
      t,
    )
  ) {
    return { isMetadata: false, field: null, clauseRole: null };
  }

  if (BUYER_FACT.test(t) || /^(?:procuring\s+entity|client)\s*[:\-–]/i.test(t)) {
    return { isMetadata: true, field: "buyer", clauseRole: "METADATA_FACT" };
  }
  if (REFERENCE_FACT.test(t) || INSTRUMENT_ABBREV_REFERENCE.test(t)) {
    return { isMetadata: true, field: "reference", clauseRole: "METADATA_FACT" };
  }
  if (METADATA_LINE.test(t) || (METADATA_INLINE.test(t) && t.length < 220)) {
    let field: DetectedMetadataField = "other";
    if (
      /(?:submission\s+deadline|closing\s+date)\b/i.test(t) &&
      !/\b(?:opening|validity|delivery|contract\s+(?:start|signature))\b/i.test(t)
    ) {
      field = "deadline";
    }
    else if (/clarification/i.test(t)) field = "clarification_deadline";
    else if (/currency/i.test(t)) field = "currency";
    else if (/value|budget|montant/i.test(t)) field = "value";
    else if (/title|subject/i.test(t)) field = "title";
    else if (/method|procedure/i.test(t)) field = "procurement_method";
    else if (/\blots?\b/i.test(t)) field = "lots";
    else if (/country|location|place/i.test(t)) field = "location";
    return { isMetadata: true, field, clauseRole: "METADATA_FACT" };
  }
  if (DEADLINE_FACT.test(t) && t.length < 180) {
    return { isMetadata: true, field: "deadline", clauseRole: "METADATA_FACT" };
  }
  if (VALUE_FACT.test(t) && t.length < 180) {
    return { isMetadata: true, field: "value", clauseRole: "METADATA_FACT" };
  }

  return { isMetadata: false, field: null, clauseRole: null };
}
