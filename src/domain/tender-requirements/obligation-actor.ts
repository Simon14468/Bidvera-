/**
 * Semantic obligation-actor attribution.
 * A "must/shall/doit" sentence is only a bidder requirement when the obligation
 * is actually imposed on the tenderer / service provider — not the contracting
 * authority, financing institution, evaluator, or a tender-package drafting rule.
 */

import {
  BIDDER_ACTOR_NOUN,
  UNIVERSAL_OBLIGATION_MODAL,
  hasUniversalObligationModal,
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

export type ObligationActorKind =
  | "BIDDER_SIDE"
  | "AUTHORITY_SIDE"
  | "DOCUMENT_PROCEDURE"
  | "CLARIFICATION_CONTEXT"
  | "UNATTRIBUTED";

/** Bid-stage party nouns. Vendor/supplier/consultant mentions are not actors
 *  unless they are the obligated subject (see BIDDER_AS_OBLIGATED_SUBJECT). */
const BIDDER_SIDE_ACTOR =
  /\b(?:bidder|tenderer|offeror|soumissionnaire|economic\s+operator|operateur\s+economique|petender|titulaire|joint\s+venture|\bjv\b)s?\b/i;

/** Post-award performer — never interchangeable with bidder for attribution. */
const CONTRACTOR_ACTOR = /\b(contractors?|titulaire\s+du\s+march[eé])\b/i;

/**
 * Contracting / financing / evaluation authorities — their duties are not bidder requirements.
 */
const AUTHORITY_SIDE_ACTOR =
  /\b((?:l[''])?autorit[eé]\s+contractante|(?:l[''])?entit[eé]\s+contractante|pouvoir\s+adjudicateur|contracting\s+authority|procuring\s+entity|ma[iî]tre\s+d['']ouvrage|buyer|employer|purchaser|evaluation\s+committee|tender\s+committee|comit[eé]\s+d[''](?:evaluation|ouverture)|evaluat(?:or|eur)|reviewer|european\s+investment\s+bank|\beib\b|\bbei\b|banque\s+europ[eé]enne\s+d['']investissement|financing\s+institution|institution\s+financi[eè]re|banque\s+mondiale|world\s+bank|european\s+commission|commission\s+europ[eé]enne|(?:the\s+)?commission(?=\s+(?:shall|must|will|may))|united\s+nations|un\s+agency|development\s+bank|focal\s+person|project\s+manager|programme\s+manager|program\s+manager|end\s+user|contracting\s+officer|authorized\s+officer)\b/i;

/** Institutional acronym as grammatical subject of ANY modal duty (optional negation). */
const INSTITUTIONAL_ACRONYM_AS_AUTHORITY_SUBJECT =
  /\b[A-Z]{3,}(?:\/[A-Z]{2,})?\s+(?:shall|must|will|may)\s+(?:not\s+)?\w+/;

/** Named buyer role as modal subject. */
const AUTHORITY_ROLE_AS_MODAL_SUBJECT =
  /\b(?:the\s+)?(?:authority|purchaser|employer|procuring\s+entity|contracting\s+authority|evaluation\s+committee|tender\s+committee|client|focal\s+person|project\s+manager|programme\s+manager|program\s+manager|end\s+user|contracting\s+officer|authorized\s+officer|(?:unops|who|undp|unhcr|unicef|buyer|purchaser|employer|authority)[- ]appointed\s+\w+)\s+(?:shall|must|will|may)\b/i;

const OBLIGATION_MODAL = new RegExp(
  `${UNIVERSAL_OBLIGATION_MODAL.source}|\\b(?:n['']est\\s+pas\\s+tenu|ne\\s+sont\\s+pas\\s+tenus|will\\s+be|may\\s+be|is\\s+responsible|remain(?:s)?\\s+responsible)\\b`,
  "i",
);

/** Bidder is the grammatical subject of a duty verb (contractor excluded). */
const BIDDER_AS_OBLIGATED_SUBJECT = new RegExp(
  `${BIDDER_ACTOR_NOUN.source}.{0,50}${UNIVERSAL_OBLIGATION_MODAL.source}|\\b(?:supplier|suppliers|titulaire)s?\\b.{0,50}\\b(?:doit|doivent|devra|must|shall|dikehendaki|hendaklah|est\\s+tenu|sont\\s+tenus|is\\s+required|are\\s+required|ne\\s+doit\\s+pas|ne\\s+doivent\\s+pas|must\\s+not|shall\\s+not)\\b`,
  "i",
);

/** Contractor as obligated subject (active or passive). */
const CONTRACTOR_AS_OBLIGATED_SUBJECT =
  /\b(?:the\s+)?contractors?\b.{0,40}\b(?:shall|must|will|is\s+required|are\s+required)\b|\b(?:shall|must|will)\b[\s\S]{0,80}\bby\s+the\s+contractors?\b/i;

/** "Il incombe au soumissionnaire…" / "It is the bidder's responsibility…" */
const BIDDER_RESPONSIBILITY_FORCE =
  /\b(il\s+incombe\s+(?:au|a|à)\s+(?:soumissionnaire|consultant|titulaire|candidat)|incombe\s+(?:au|a|à)\s+(?:soumissionnaire|consultant)|(?:it\s+is|it'?s)\s+(?:the\s+)?(?:bidder|tenderer|supplier|consultant)(?:'s)?\s+responsibility|remain(?:s)?\s+(?:the\s+)?(?:bidder|tenderer)(?:'s)?\s+responsibility)\b/i;

/**
 * Tender package / dossier as the obligated subject (drafting quality for the PE),
 * even when bidders are mentioned as beneficiaries of clarity.
 */
const TENDER_PACKAGE_AS_SUBJECT =
  /\b((?:le|la|les|the)\s+)?(dossier\s+d['']appel\s+d['']offres|dossier\s+de\s+(?:consultation|candidature)|tender\s+(?:dossier|package|documents?)|bidding\s+documents?|call\s+for\s+tenders?|cahier\s+des\s+charges)\b.{0,100}\b(doit|doivent|must|shall|devra)\b/i;

const DOCUMENT_QUALITY_OBLIGATION =
  /\b(dossier|document|cahier|avis|notice|texte|file|instructions?)\b.{0,60}\b(doit|doivent|must|shall)\b.{0,80}\b(clair|claire|clear|complet|complete|suffisamment|sufficient|lisible|readable|coh[eé]rent|consistent|precise|pr[eé]cis|eviter|éviter|avoid)\b/i;

const DOCUMENT_PROCEDURE_SUBJECT =
  /\b((?:le|la|les|the)\s+)?(dossier|document|cahier\s+des\s+charges|avis|notice|procedure|proc[eé]dure|fichier|file|texte|text|instructions?(?:\s+aux\s+soumissionnaires)?)\b/i;

const AUTHORITY_FUTURE_ACTION =
  /\b((?:l[''])?autorit[eé]\s+contractante|(?:l[''])?entit[eé]\s+contractante|pouvoir\s+adjudicateur|contracting\s+authority|procuring\s+entity)\s+(informera|notifiera|publiera|ouvrira|attribuera|will\s+(?:inform|notify|publish|open|award)|shall\s+(?:inform|notify|publish|open|award)|doit\s+(?:informer|notifier|publier|ouvrir|attribuer))\b/i;

const CLARIFICATION_QA =
  /\b(pouvez[- ]vous\s+confirmer|can\s+you\s+confirm|please\s+confirm|kindly\s+confirm|could\s+you\s+confirm|demande\s+de\s+clarification|question\s+de\s+clarification|clarification\s+question)\b/i;

const CLARIFICATION_ANSWER =
  /\b((?:l[''])?autorit[eé]\s+contractante\s+confirme|contracting\s+authority\s+confirms|procuring\s+entity\s+confirms|in\s+response\s+to\s+(?:the\s+)?(?:clarification|question)|r[eé]ponse\s+[aà]\s+(?:la\s+)?(?:question|demande\s+de\s+clarification))\b/i;

/**
 * Privileges/immunities, jurisdiction waivers, and legal-reservation clauses —
 * authority/document legal status, not bidder performance obligations.
 */
const LEGAL_RESERVATION_OR_PRIVILEGE =
  /\b(privileges?\s+and\s+immunit|waiver\s+of\s+(?:any\s+(?:of\s+)?)?(?:the\s+)?privileges|nothing\s+in\s+this\s+(?:undertaking|agreement|contract|document|deed|instrument)\s+shall\s+(?:constitute|be\s+deemed)|shall\s+not\s+constitute\s+(?:or\s+be\s+deemed\s+to\s+constitute\s+)?a\s+waiver|submission\s+to\s+the\s+jurisdiction\s+of\s+any\s+(?:national\s+)?(?:court|tribunal)|enjoyed\s+by\s+.{0,40}\s+under\s+any\s+source\s+of\s+law|without\s+prejudice\s+to\s+(?:the\s+)?(?:privileges|immunit))\b/i;

const REVISION_ADDENDUM_PROCEDURAL =
  /\b(addendum|corrigendum|rectificatif|modification\s+notice|avis\s+de\s+modification|this\s+(?:clarification|addendum|corrigendum)\s+(?:supersedes|amends|modifies)|la\s+pr[eé]sente\s+(?:clarification|modification)\s+(?:annule|remplace|modifie))\b/i;

/** Award / evaluation prose describing how the authority judges offers — not a bidder duty. */
const AWARD_EVALUATION_PROSE =
  /\b(l['']attribution|award(?:ing)?\s+(?:decision|criteria)|bonne\s+gestion\s+financi[eè]re|principes?\s+d[''][eé]conomie|d['']efficience|d['']efficacit[eé]|evaluation\s+committee\s+shall|comit[eé]\s+d['']evaluation)\b/i;

/** Passive / impersonal offer-structure cues that still bind the bidder. */
const BIDDER_IMPERSONAL_FORCE =
  /\b((?:l[''])?offre(?:\s+technique|\s+financi[eè]re)?\s+doit|(?:la\s+)?proposition\s+(?:technique|financi[eè]re)\s+doit|(?:the\s+)?(?:bid|tender|offer|technical\s+proposal|financial\s+proposal)\s+(?:must|shall)|must\s+be\s+(?:submitted|provided|furnished|attached|enclosed|protected)|shall\s+be\s+(?:submitted|provided|furnished|attached|enclosed|protected)|sera\s+(?:soumis|fourni|joint|pr[eé]sent[eé])|doivent\s+[eê]tre\s+(?:soumis|fournis|joints|pr[eé]sent[eé]s)|ne\s+doit\s+pas\s+d[eé]passer)\b/i;

/**
 * Eligibility / exclusion / conflict rules that bind the economic operator even without
 * an explicit "must" next to the actor noun.
 */
const BIDDER_ELIGIBILITY_FORCE =
  /\b((?:les\s+)?soumissionnaires?\s+(?:sont|seront)\s+exclus|(?:the\s+)?(?:bidders?|tenderers?|candidates?)\s+(?:are|shall\s+be|will\s+be)\s+(?:excluded|disqualified|ineligible)|(?:ne\s+doit\s+pas|must\s+not|shall\s+not)\s+[eê]tre\s+engag[eé].{0,40}conflit\s+d['']int[eé]r[eê]ts|must\s+not\s+be\s+(?:engaged\s+in|in)\s+a\s+conflict\s+of\s+interest|ineligible\s+(?:to\s+participate|for\s+(?:this\s+)?(?:tender|procurement)))\b/i;

const LABELED_REQUIREMENT = /^(?:[•\-\u2022]\s*)?[ETR]-\d{2}\b/i;

const IMPERATIVE_BIDDER_OPEN =
  /^(?:[•\-\u2022]\s*)?(?:provide|supply|install|deliver|complete|submit|configure|commission|fournir|installer|livrer|soumettre|veuillez\s+(?:fournir|soumettre|joindre|presenter|présenter)|please\s+(?:provide|submit|attach|enclose))\b/i;

/** Second-person / addressed-to-bidder force (FR/EN). */
const BIDDER_ADDRESSED_FORCE =
  /\b(votre\s+(?:entit[eé]|offre|proposition|candidature)|your\s+(?:entity|firm|company|bid|offer|proposal)|veuillez\s+(?:fournir|soumettre|joindre|presenter|présenter|expliquer)|please\s+(?:provide|submit|attach|enclose|explain)|you\s+(?:must|shall|are\s+required))\b/i;

/** Short numbered section titles without an actionable duty clause. */
const SECTION_HEADING_ONLY =
  /^\d+(?:\.\d+)*\s+.{8,110}$/;

export type ObligationActorAttribution = {
  actor: ObligationActorKind;
  /** True when the text binds the bidder / tendered service provider. */
  isBidderRequirement: boolean;
  reason: string;
};

/**
 * Attribute who is obligated. Prefer grammatical subject over incidental mentions.
 */
export function attributeObligationActor(description: string): ObligationActorAttribution {
  const raw = description?.trim() ?? "";
  if (!raw) {
    return { actor: "UNATTRIBUTED", isBidderRequirement: false, reason: "empty" };
  }
  const text = fold(raw);
  const bidderIsSubject = BIDDER_AS_OBLIGATED_SUBJECT.test(text);
  const contractorIsSubject = CONTRACTOR_AS_OBLIGATED_SUBJECT.test(raw);
  const authorityAsModalSubject =
    INSTITUTIONAL_ACRONYM_AS_AUTHORITY_SUBJECT.test(raw) ||
    AUTHORITY_ROLE_AS_MODAL_SUBJECT.test(raw);

  // Buyer / institutional modal subject — never overridden by incidental bidder mention.
  if (authorityAsModalSubject && !/^(?:the\s+)?(?:bidder|tenderer|offeror)s?\s+(?:shall|must)\b/i.test(raw.trim())) {
    return {
      actor: "AUTHORITY_SIDE",
      isBidderRequirement: false,
      reason: "authority_modal_subject",
    };
  }

  // Contractor-only obligation — not a bid-stage bidder requirement.
  if (contractorIsSubject && !bidderIsSubject && !/\b(?:bidder|tenderer|offeror)\b/i.test(text)) {
    return {
      actor: "UNATTRIBUTED",
      isBidderRequirement: false,
      reason: "contractor_not_bidder",
    };
  }

  if (CLARIFICATION_QA.test(text) || CLARIFICATION_ANSWER.test(text) || REVISION_ADDENDUM_PROCEDURAL.test(text)) {
    return {
      actor: "CLARIFICATION_CONTEXT",
      isBidderRequirement: false,
      reason: "clarification_or_revision_context",
    };
  }

  if (LEGAL_RESERVATION_OR_PRIVILEGE.test(text)) {
    return {
      actor: "AUTHORITY_SIDE",
      isBidderRequirement: false,
      reason: "legal_reservation_or_privilege_disclaimer",
    };
  }

  if (AUTHORITY_FUTURE_ACTION.test(text) && !bidderIsSubject) {
    return {
      actor: "AUTHORITY_SIDE",
      isBidderRequirement: false,
      reason: "authority_future_action",
    };
  }

  // Institutional acronym subject (UNOPS / WHO / AfDB …) + buyer procurement verb.
  // Match on raw text — fold() lowercases and would erase acronym cues.
  if (INSTITUTIONAL_ACRONYM_AS_AUTHORITY_SUBJECT.test(raw) && !bidderIsSubject) {
    return {
      actor: "AUTHORITY_SIDE",
      isBidderRequirement: false,
      reason: "institutional_acronym_authority_subject",
    };
  }

  // Tender-package / document-quality drafting rules — subject is the dossier/document,
  // even when bidders appear as beneficiaries ("pour éviter que les soumissionnaires…").
  if (
    (TENDER_PACKAGE_AS_SUBJECT.test(text) || DOCUMENT_QUALITY_OBLIGATION.test(text)) &&
    !bidderIsSubject
  ) {
    return {
      actor: "DOCUMENT_PROCEDURE",
      isBidderRequirement: false,
      reason: "document_or_tender_package_quality",
    };
  }

  const hasBidder = BIDDER_SIDE_ACTOR.test(text);
  const hasContractor = CONTRACTOR_ACTOR.test(text);
  const hasAuthority =
    AUTHORITY_SIDE_ACTOR.test(text) ||
    INSTITUTIONAL_ACRONYM_AS_AUTHORITY_SUBJECT.test(raw) ||
    AUTHORITY_ROLE_AS_MODAL_SUBJECT.test(raw);
  const hasModal = OBLIGATION_MODAL.test(text);

  // Authority is the grammatical subject of the obligation / disclaimer
  // (modal must follow the actor immediately — do not steal a later bidder "shall").
  const authoritySubjectModal = text.match(
    /\b((?:l[''])?autorit[eé]\s+contractante|(?:l[''])?entit[eé]\s+contractante|pouvoir\s+adjudicateur|contracting\s+authority|procuring\s+entity|european\s+investment\s+bank|\beib\b|\bbei\b|evaluation\s+committee|tender\s+committee)\b\s+(doit|doivent|devra|must|shall|will|may|requires?|n['']est\s+pas\s+tenu|ne\s+sont\s+pas\s+tenus|is\s+not\s+(?:required|obliged|bound)|are\s+not\s+(?:required|obliged|bound)|under\s+no\s+obligation|informera|notifiera)\b/i,
  );
  if (authoritySubjectModal) {
    const authorityVerb = (authoritySubjectModal[2] ?? "").toLowerCase();
    if (/^(requires?)$/i.test(authorityVerb) && bidderIsSubject) {
      return {
        actor: "BIDDER_SIDE",
        isBidderRequirement: true,
        reason: "authority_requires_bidder_obligation",
      };
    }
    return {
      actor: "AUTHORITY_SIDE",
      isBidderRequirement: false,
      reason: "authority_subject_of_modal",
    };
  }

  if (hasAuthority && hasModal && !hasBidder) {
    return {
      actor: "AUTHORITY_SIDE",
      isBidderRequirement: false,
      reason: "authority_modal_without_bidder",
    };
  }

  if (
    hasAuthority &&
    /\b(n['']est\s+pas\s+tenu|ne\s+sont\s+pas\s+tenus|is\s+not\s+(?:required|obliged|bound)|are\s+not\s+(?:required|obliged|bound)|under\s+no\s+obligation)\b/i.test(
      text,
    )
  ) {
    return {
      actor: "AUTHORITY_SIDE",
      isBidderRequirement: false,
      reason: "authority_disclaimer",
    };
  }

  // Award / evaluation narrative without a bidder as obligated subject.
  if (AWARD_EVALUATION_PROSE.test(text) && !bidderIsSubject && !BIDDER_IMPERSONAL_FORCE.test(text)) {
    return {
      actor: "AUTHORITY_SIDE",
      isBidderRequirement: false,
      reason: "award_evaluation_prose",
    };
  }

  if (hasBidder && hasAuthority) {
    if (bidderIsSubject || BIDDER_ELIGIBILITY_FORCE.test(text) || BIDDER_RESPONSIBILITY_FORCE.test(text)) {
      return {
        actor: "BIDDER_SIDE",
        isBidderRequirement: true,
        reason: bidderIsSubject
          ? "bidder_bound_despite_authority_mention"
          : "bidder_eligibility_despite_authority_mention",
      };
    }
    return {
      actor: "AUTHORITY_SIDE",
      isBidderRequirement: false,
      reason: "authority_primary_with_incidental_bidder_mention",
    };
  }

  if (
    bidderIsSubject ||
    BIDDER_RESPONSIBILITY_FORCE.test(text) ||
    BIDDER_ELIGIBILITY_FORCE.test(text) ||
    // Modal + bidder mention alone is NOT enough when contractor is the performer.
    (hasBidder && hasModal && !hasContractor)
  ) {
    return {
      actor: "BIDDER_SIDE",
      isBidderRequirement: true,
      reason: bidderIsSubject
        ? "bidder_as_obligated_subject"
        : BIDDER_RESPONSIBILITY_FORCE.test(text)
          ? "bidder_responsibility_force"
          : BIDDER_ELIGIBILITY_FORCE.test(text)
            ? "bidder_eligibility_force"
            : "explicit_bidder_side_actor",
    };
  }

  if (
    LABELED_REQUIREMENT.test(raw) ||
    IMPERATIVE_BIDDER_OPEN.test(raw) ||
    BIDDER_IMPERSONAL_FORCE.test(text) ||
    BIDDER_ADDRESSED_FORCE.test(text)
  ) {
    return {
      actor: "BIDDER_SIDE",
      isBidderRequirement: true,
      reason: BIDDER_ADDRESSED_FORCE.test(text)
        ? "bidder_addressed_force"
        : "labeled_imperative_or_impersonal_bidder_force",
    };
  }

  if (hasAuthority) {
    return {
      actor: "AUTHORITY_SIDE",
      isBidderRequirement: false,
      reason: "authority_actor_present",
    };
  }

  // Numbered documentary-evidence list items are submissions, not headings.
  if (isNumberedDocumentaryEvidenceItem(raw)) {
    return {
      actor: "UNATTRIBUTED",
      isBidderRequirement: true,
      reason: "numbered_documentary_evidence_item",
    };
  }

  // Numbered section heading without actionable duty.
  if (
    SECTION_HEADING_ONLY.test(raw) &&
    !hasUniversalObligationModal(text) &&
    !/\b(fournir|soumettre|submit|provide|attach|enclose)\b/i.test(text)
  ) {
    return {
      actor: "DOCUMENT_PROCEDURE",
      isBidderRequirement: false,
      reason: "section_heading_only",
    };
  }

  if (
    DOCUMENT_PROCEDURE_SUBJECT.test(text) &&
    hasModal &&
    !BIDDER_IMPERSONAL_FORCE.test(text) &&
    !/\b(soumettre|submit|fournir|provide|attach|enclose|prot[eé]g|password|mot\s+de\s+passe)\b/i.test(
      text,
    )
  ) {
    return {
      actor: "DOCUMENT_PROCEDURE",
      isBidderRequirement: false,
      reason: "generic_document_procedure_modal",
    };
  }

  return {
    actor: "UNATTRIBUTED",
    isBidderRequirement: hasModal,
    reason: hasModal ? "modal_without_explicit_actor" : "no_clear_obligation_actor",
  };
}

export function isBidderSideObligation(description: string): boolean {
  return attributeObligationActor(description).isBidderRequirement;
}
