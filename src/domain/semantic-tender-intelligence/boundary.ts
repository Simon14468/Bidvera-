/**
 * Obligation boundary completeness — never admit incomplete fragments.
 * Surrounding context must be available before promoting a fragment.
 */

const INCOMPLETE_TAIL =
  /(?:shall|shall\s+be|must|must\s+be|responsible\s+to|there\s+shall|will\s+be|doit|doivent|devra|sera|seront|est\s+tenu|sont\s+tenus)\s*\.?$/i;

const INCOMPLETE_ONLY =
  /^(?:shall|shall\s+be|must|must\s+be|responsible\s+to|there\s+shall|will\s+be|doit|doivent|devra|sera|seront|est\s+tenu|are\s+required|is\s+required)\s*\.?$/i;

const HYPHEN_BREAK = /[a-z]\-\s*$/i;

const TRAILING_PREPOSITION =
  /\b(?:on|of|to|for|with|by|from|at|in|and|or|the|a|an)\s*$/i;

/**
 * True when the statement is a complete obligation/fact boundary
 * (not an OCR/page-break fragment).
 */
export function isObligationBoundaryComplete(text: string): boolean {
  const t = text.replace(/\s+/g, " ").trim();
  if (t.length < 12) return false;
  if (INCOMPLETE_ONLY.test(t)) return false;
  if (INCOMPLETE_TAIL.test(t) && t.split(/\s+/).length <= 4) return false;
  if (HYPHEN_BREAK.test(t)) return false;
  // Ends mid-modal with no object
  if (/\b(shall|must|doit|devra)\s*$/i.test(t)) return false;
  // Ends on a dangling preposition / conjunction (common page-break fragment)
  if (TRAILING_PREPOSITION.test(t) && !/[.!?]"?'?$/.test(t)) {
    // Allow short labeled rows like "E-01 Technical methodology"
    if (
      !/^(?:[•\-\u2022]\s*)?[A-Z]{1,5}-\d{1,3}\b/.test(t) &&
      t.split(/\s+/).length >= 6
    ) {
      return false;
    }
  }
  return true;
}
