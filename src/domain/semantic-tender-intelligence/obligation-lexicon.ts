/**
 * Shared obligation / documentary-evidence classes.
 *
 * These are morphological synonyms for the same semantic families
 * (deontic force, economic-operator actor, submitted evidence).
 * They are not country, tender, or filename rules.
 */

/** Deontic force: shall / must / required and equivalents. */
export const UNIVERSAL_OBLIGATION_MODAL =
  /\b(?:shall|must|will|should|is\s+required|are\s+required|required\s+to|is\s+mandatory|are\s+mandatory|mandatory|required|obligatoire|doit|doivent|devra|devront|est\s+tenu|sont\s+tenus|est\s+exig[ée]|sont\s+exig[ée]s|exig[ée]|requis|soll|muss|debe|deber[aá]|dovr[aà]|wajib|diperlukan|dikehendaki|hendaklah)\b/i;

/** Pre-award economic-operator noun class. */
export const BIDDER_ACTOR_NOUN =
  /\b(?:bidder|tenderer|offeror|soumissionnaire|economic\s+operator|operateur\s+economique|petender|consultant|vendor|candidate)s?\b/i;

/**
 * Submitted documentary evidence: copies, certificates, attestations,
 * clearances, registrations. The class is the artefact, not the issuer.
 */
export const DOCUMENTARY_EVIDENCE_NOUN =
  /\b(?:copy\s+of|copie(?:s)?\s+(?:du|de\s+l['’]|d[eu])|salinan|certificate|certificat|attestation|sijil|clearance|registration|pendaftaran|registre|incorporation|tax\s+clearance)\b/i;

/**
 * Strip combining marks so deontic endings like "exigé" remain word characters.
 * JavaScript `\b` treats accented letters as non-word, which silently drops
 * otherwise valid obligation force.
 */
export function foldObligationText(text: string): string {
  return text
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

export function hasUniversalObligationModal(text: string): boolean {
  return UNIVERSAL_OBLIGATION_MODAL.test(foldObligationText(text));
}

export function hasDocumentaryEvidenceNoun(text: string): boolean {
  const folded = foldObligationText(text);
  return DOCUMENTARY_EVIDENCE_NOUN.test(folded) || /\biso\s?\d+\b/i.test(folded);
}

/**
 * Bid-stage security artefacts (bonds, guarantees, cautions).
 * The class is the instrument, not a country or issuer.
 */
export const BID_SECURITY_ARTEFACT =
  /\b(?:bid\s+security|tender\s+security|proposal\s+security|provisional\s+bond|bid\s+bond|performance\s+(?:bond|guarantee|security)|bank\s+guarantee|caution(?:nement)?|guarantee|garantie)\b/i;

export function hasBidSecurityArtefact(text: string): boolean {
  return BID_SECURITY_ARTEFACT.test(foldObligationText(text));
}

/**
 * Eligibility / qualification evidence class — experience, turnover, capacity.
 * Distinct from documentary artefacts; still does not name the actor.
 */
export const ELIGIBILITY_EVIDENCE_NOUN =
  /\b(?:years?\s+of(?:\s+\w+){0,3}\s+experience|experience\s+in|minimum\s+(?:experience|turnover)|turnover|qualification|registered\s+capital|financial\s+capacity|capacit[eé]\s+(?:financi[eè]re|technique))\b/i;

export function hasEligibilityEvidenceNoun(text: string): boolean {
  return ELIGIBILITY_EVIDENCE_NOUN.test(foldObligationText(text));
}

/**
 * Numbered list item that names required documentary evidence.
 * Common worldwide ("2.1 Copy of tax clearance", "2.1 Copie du certificat").
 * Distinct from numbered headings ("2.1 Introduction").
 */
export function isNumberedDocumentaryEvidenceItem(text: string): boolean {
  const t = text.replace(/\s+/g, " ").trim();
  if (!/^\d+(?:\.\d+)*[.)]?\s+\S/.test(t)) return false;
  if (t.length < 12 || t.length > 220) return false;
  if (/\b(?:introduction|preamble|definitions?|background|overview|scope\s+of\s+work)\b/i.test(t)) {
    return false;
  }
  return hasDocumentaryEvidenceNoun(t);
}
