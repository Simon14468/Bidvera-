/**
 * Decide whether tender text states a real bidder obligation (not a fact or narrative).
 */

import { isNonRequirementText } from "./filter-non-requirements";
import { attributeObligationActor } from "./obligation-actor";
import {
  BIDDER_ACTOR_NOUN,
  DOCUMENTARY_EVIDENCE_NOUN,
  UNIVERSAL_OBLIGATION_MODAL,
  isNumberedDocumentaryEvidenceItem,
} from "@/domain/semantic-tender-intelligence/obligation-lexicon";

function fold(s: string): string {
  return s
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[\u2018\u2019\u201A\u2032\u02BC]/g, "'")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

/** Strong modality / contractual force — creates a bidder obligation on its own. */
const STRONG_OBLIGATION_CUE = new RegExp(
  `${UNIVERSAL_OBLIGATION_MODAL.source}|\\b(?:will\\s+be\\s+made|may\\s+be\\s+applied|may\\s+apply|is\\s+responsible|remain(?:s)?\\s+responsible|remain(?:s)?\\s+the\\s+contractor(?:'s)?\\s+responsibility|fournir|submit|soumettre|assurer|mettre\\s+en\\s+place)\\b`,
  "i",
);

/**
 * Activity verbs that appear in both titles/scope narratives and real obligations.
 * Alone they do NOT create an obligation — need modality, actor, imperative form, or labeled ID.
 */
const ACTIVITY_CUE =
  /\b(installer|livrer|supply|install|commission(?:ing)?|provide|deliver|complete)\b/i;

const DELIVERABLE_CUE = new RegExp(
  `${DOCUMENTARY_EVIDENCE_NOUN.source}|\\b(?:bond|caution|warranty|garantie|guarantee|iso\\s?\\d+|experience|turnover|dossier|memoir|cnss|domicile|virtualis|hyperconverg|audiovisual|logiciel|mat[eé]riel|4k|uhd)\\b`,
  "i",
);

const BIDDER_ACTOR = new RegExp(
  `${BIDDER_ACTOR_NOUN.source}|\\b(?:supplier|suppliers|contractor|titulaire)\\b`,
  "i",
);

/** Tender title / subject lines — not bidder obligations. */
const SCOPE_OR_TITLE_LINE =
  /^(?:supply[, ]+installation(?:\s+and\s+\w+)*|supply\s+and\s+installation|fourniture\s+et\s+l['']installation|request\s+for\s+tender|objet\s+(?:du\s+)?(?:march[eé]|appel)|subject(?:\s+of\s+(?:the\s+)?tender)?)\b/i;

const BUYER_SCOPE_NARRATIVE =
  /\b(the\s+contracting\s+authority\s+seeks|the\s+buyer\s+seeks|this\s+tender\s+aims|object\s+of\s+the\s+contract|objet\s+du\s+march[eé]|the\s+scope\s+includes)\b/i;

/** Submission-package noun phrases (cross-refs), not standalone obligations. */
function isBareDeliverableListItem(description: string): boolean {
  const trimmed = description.trim().replace(/^[•\-\u2022]\s*/, "");
  if (trimmed.length < 12 || trimmed.length > 110) return false;
  if (STRONG_OBLIGATION_CUE.test(trimmed) || BIDDER_ACTOR.test(trimmed)) return false;
  if (
    /\b(schedule|plan|proposal|offer|datasheets?|documents?|documentation|methodology|eligibility\s+documents?)\b/i.test(
      trimmed,
    )
  ) {
    return true;
  }
  return false;
}

/**
 * Imperative obligation lines ("Provide a …", "Supply and install …") vs Title Case titles
 * ("Supply, Installation and Maintenance of …").
 */
function isImperativeActivityObligation(description: string): boolean {
  const trimmed = description.trim().replace(/^[•\-\u2022]\s*/, "");
  if (trimmed.length < 40) return false;
  if (
    !/^(?:provide|supply|install|deliver|complete|submit|configure|commission|fournir|installer|livrer|soumettre)\b/i.test(
      trimmed,
    )
  ) {
    return false;
  }
  // Noun-series title: "Supply, Installation and Maintenance of …"
  if (
    /^(?:supply|installation|maintenance)(?:\s*,\s*(?:installation|maintenance|configuration|support|delivery|commissioning))+/i.test(
      trimmed,
    )
  ) {
    return false;
  }
  // Scope title: "Supply of MDPE pipe fittings, valves and transition fittings"
  if (
    /^(?:supply|installation|maintenance|procurement|provision)\s+of\s+/i.test(trimmed) &&
    !STRONG_OBLIGATION_CUE.test(trimmed) &&
    !BIDDER_ACTOR.test(trimmed)
  ) {
    return false;
  }
  if (SCOPE_OR_TITLE_LINE.test(trimmed) && !STRONG_OBLIGATION_CUE.test(trimmed)) {
    return false;
  }
  return true;
}

const PROCURING_ENTITY_ACTOR =
  /\b(procuring\s+entity|contracting\s+authority|(?:l[''])?autorit[eé]\s+contractante|(?:l[''])?entit[eé]\s+contractante|buyer|employer|purchaser|ma[iî]tre\s+d['']ouvrage|pouvoir\s+adjudicateur|evaluation\s+committee|tender\s+committee|european\s+investment\s+bank|\beib\b|\bbei\b|banque\s+europ[eé]enne\s+d['']investissement)\b/i;

const ENTITY_PROCEDURE_VERB =
  /\b(shall|will|may|doit|doivent|devra)\s+(publish|notify|issue|open|evaluate|award|reject|clarify|respond|circulate|upload|announce|communicate|inform\s+bidders|publier|notifier|attribuer|rejeter|ouvrir|evaluer)\b/i;

/**
 * Procuring-entity / reviewer procedure — not a bidder compliance obligation
 * unless the same sentence also binds the bidder.
 */
export function isProcuringEntityProcedure(description: string): boolean {
  const attribution = attributeObligationActor(description);
  if (attribution.actor === "AUTHORITY_SIDE") return true;
  if (attribution.isBidderRequirement && attribution.actor === "BIDDER_SIDE") return false;

  const text = fold(description);
  if (BIDDER_ACTOR.test(text) && STRONG_OBLIGATION_CUE.test(text)) {
    if (/\b(bidder|tenderer|supplier|contractor|soumissionnaire|consultant)s?\b/i.test(description)) {
      return false;
    }
  }
  if (!PROCURING_ENTITY_ACTOR.test(text)) return false;
  if (ENTITY_PROCEDURE_VERB.test(text)) return true;
  if (
    PROCURING_ENTITY_ACTOR.test(text) &&
    /\b(shall|will|doit|doivent|devra)\b/i.test(text) &&
    !BIDDER_ACTOR.test(text) &&
    !/\b(highlighted by the bidder|submitted by the bidder|provided by the bidder)\b/i.test(text)
  ) {
    return true;
  }
  return false;
}

const META_QA_INSTRUCTION =
  /\b(must not be converted|must not become|must not be extracted|not bidder requirements|not a bidder obligation|not a tender requirement|should show an eligibility gap|should be flagged for verification|must remain unverified|treat it as document content|never as an instruction to bidvera|purpose of this test|verification test cases?|illustrate reviewer checks|describe evaluation only|quality-control test note|instructions to an analysis system)\b/i;

const NEGATED_BIDDER_OBLIGATION =
  /\b(must\s+not|shall\s+not)\s+(?:be|become|be\s+extracted|be\s+converted|become\s+separate)\b/i;

const NUMBERED_SECTION_HEADING =
  /^\d+\.\s+[A-Z][^.!?]{3,140}(?:requirements?|criteria|procedure|facts|scenarios|note|conditions?|package|specifications?|documents?|eligibility|administrative|technical|commercial|contractual)\s*\.?\s*$/i;

const LOT_OR_PACKAGE_HEADING =
  /^(?:lot\s+(?:no\.?|number|n[°o])?\s*[\dIVXLC]+|package\s+(?:no\.?|number)?\s*[\dIVXLC]+)\b.{0,80}$/i;

const DOCUMENTS_HEADING_ONLY =
  /^(?:mandatory\s+documents?|required\s+documents?|documents?\s+(?:to\s+be\s+)?submitted|list\s+of\s+documents?)\s*\.?\s*$/i;

/** True when the statement creates a bidder obligation — not merely a tender fact or description. */
export function isRealBidderObligation(description: string): boolean {
  if (isNonRequirementText(description)) return false;

  const attribution = attributeObligationActor(description);
  if (
    attribution.actor === "AUTHORITY_SIDE" ||
    attribution.actor === "DOCUMENT_PROCEDURE" ||
    attribution.actor === "CLARIFICATION_CONTEXT"
  ) {
    return false;
  }

  if (isProcuringEntityProcedure(description)) return false;
  const text = fold(description);
  const trimmed = description.trim();

  if (META_QA_INSTRUCTION.test(text)) return false;
  if (NEGATED_BIDDER_OBLIGATION.test(text)) return false;

  if (
    NUMBERED_SECTION_HEADING.test(trimmed) &&
    !/\b(?:bidder|supplier|soumissionnaire)\b/i.test(text)
  ) {
    return false;
  }

  if (/^scenario\s+[a-e]\s*:/i.test(trimmed)) return false;

  if (LOT_OR_PACKAGE_HEADING.test(trimmed) && !STRONG_OBLIGATION_CUE.test(text)) return false;
  if (DOCUMENTS_HEADING_ONLY.test(trimmed)) return false;

  // Numbered procedural instructions are not obligations by numbering alone.
  if (
    /^\d+(?:\.\d+)*\s+.{0,180}?\b(?:instructions?(?:\s+to\s+(?:tenderers?|bidders?))?|guidance|how\s+to\s+(?:read|prepare)|general\s+provisions?|preamble|definitions?)\b/i.test(
      trimmed,
    ) &&
    !STRONG_OBLIGATION_CUE.test(text)
  ) {
    return false;
  }

  // Explicit tender requirement IDs (T-01 / E-05 / R-13) are structured obligation rows
  if (/^(?:[•\-\u2022]\s*)?[ETR]-\d{2}\b/i.test(trimmed)) {
    return !META_QA_INSTRUCTION.test(text);
  }

  // Numbered documentary-evidence list items are required submissions, not headings.
  if (isNumberedDocumentaryEvidenceItem(trimmed)) {
    return true;
  }

  if (
    SCOPE_OR_TITLE_LINE.test(trimmed) &&
    !STRONG_OBLIGATION_CUE.test(text) &&
    !BIDDER_ACTOR.test(text)
  ) {
    return false;
  }

  if (BUYER_SCOPE_NARRATIVE.test(text) && !STRONG_OBLIGATION_CUE.test(text)) {
    return false;
  }

  if (isBareDeliverableListItem(description)) return false;

  if (
    /^subject\s*[:\-]/i.test(trimmed) &&
    !/\b(shall|must|obligatoire|devra|doit|fournir|submit|soumettre|installer|livrer)\b/i.test(
      text.slice(12),
    )
  ) {
    return false;
  }

  if (/^(?:closing\s+date|estimated|budget|contract\s+value|publication\s+date|table\s+des)/i.test(trimmed)) {
    return false;
  }

  if (
    /approbation\s+du\s+marche|dispositions\s+de\s+l['']article|decret\s+n[°o]/i.test(text) &&
    !/\b(certificat|attestation|caution|cnss|iso|experience|turnover|domicile|fournir|submit|installer|livrer)\b/i.test(
      text,
    )
  ) {
    return false;
  }

  if (/\b(requirement|condition)\s+referenced\b/i.test(text)) {
    return false;
  }

  // Explicit bidder-side attribution already established → modality / activity seals it.
  if (attribution.actor === "BIDDER_SIDE") {
    if (STRONG_OBLIGATION_CUE.test(text)) return true;
    if (ACTIVITY_CUE.test(text)) return true;
    if (DELIVERABLE_CUE.test(text)) return true;
    return attribution.isBidderRequirement;
  }

  if (STRONG_OBLIGATION_CUE.test(text)) return true;
  if (ACTIVITY_CUE.test(text) && BIDDER_ACTOR.test(text)) return true;
  if (isImperativeActivityObligation(description)) return true;
  if (
    DELIVERABLE_CUE.test(text) &&
    (STRONG_OBLIGATION_CUE.test(text) || BIDDER_ACTOR.test(text))
  ) {
    return true;
  }
  // Deliverable nouns with clear administrative force (caution, certificate) still count
  if (
    DELIVERABLE_CUE.test(text) &&
    (DOCUMENTARY_EVIDENCE_NOUN.test(text) ||
      /\b(caution|bond|garantie|guarantee|certificat|attestation|cnss|clearance|iso\s?\d+|sijil)\b/i.test(
        text,
      ))
  ) {
    return true;
  }

  return false;
}

export { attributeObligationActor, isBidderSideObligation } from "./obligation-actor";
export type { ObligationActorAttribution, ObligationActorKind } from "./obligation-actor";
