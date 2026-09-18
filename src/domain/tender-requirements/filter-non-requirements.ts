/**
 * Detect tender facts, procedural text, and noise that must NOT become TenderRequirement rows.
 * Deadlines, contract value, evaluation weights as facts — not compliance requirements.
 */

import { isExampleOrScenarioLine } from "@/domain/tender-validity/document-understanding";
import { analyzeObligationFrame } from "@/domain/semantic-tender-intelligence/obligation-frame";

function fold(s: string): string {
  return s
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[\u2018\u2019\u201A\u2032\u02BC]/g, "'")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

const DEADLINE_AS_REQUIREMENT =
  /\b(submission\s*\/?\s*closing\s*deadline|closing\s+date\s+referenced|date\s+limite\s+(?:de\s+)?(?:depot|soumission|remise)|heure\s+limite|deadline\s+referenced|date\s+et\s+heure\s+limites?\s+de\s+(?:depot|remise))\b/i;

const GUARANTEE_OR_BOND =
  /\b(caution(?:nement)?|caution\s+provisoire|caution\s+definitive|provisional\s+bond|performance\s+bond|performance\s+guarantee|bid\s+bond|bank\s+guarantee|garantie\s+(?:de\s+)?(?:bonne\s+ex[eé]cution|provisoire|definitive))\b/i;

const TENDER_FACT_ONLY =
  /\b(contract\s+value|estimated\s+value|valeur\s+(?:estimee|du\s+marche)|montant\s+(?:estime|du\s+marche|total)|duration\s+of\s+contract|duree\s+du\s+marche|evaluation\s+weight\s*:|pond[eé]ration\s+globale|contract\s+duration)\b/i;

const SYNTHETIC_OR_META =
  /\b(synthetic\s+tender|test\s+document|for\s+testing\s+only|demo\s+purposes|this\s+document\s+is\s+(?:synthetic|a\s+test)|sample\s+tender\s+only|not\s+for\s+official\s+use)\b/i;

const DISCLAIMER_OR_NARRATIVE =
  /\b(without\s+warranty|informational\s+purposes\s+only|the\s+following\s+is\s+provided\s+for\s+illustration|general\s+information\s+only|disclaimer|avertissement)\b/i;

/** Privileges, immunities, jurisdiction waivers — not bidder performance requirements. */
const LEGAL_RESERVATION_OR_PRIVILEGE =
  /\b(privileges?\s+and\s+immunit|waiver\s+of\s+(?:any\s+(?:of\s+)?)?(?:the\s+)?privileges|nothing\s+in\s+this\s+(?:undertaking|agreement|contract|document|deed|instrument)\s+shall\s+(?:constitute|be\s+deemed)|shall\s+not\s+constitute\s+(?:or\s+be\s+deemed\s+to\s+constitute\s+)?a\s+waiver|submission\s+to\s+the\s+jurisdiction\s+of\s+any\s+(?:national\s+)?(?:court|tribunal)|enjoyed\s+by\s+.{0,40}\s+under\s+any\s+source\s+of\s+law)\b/i;

/** True when text is a legal reservation / privilege / immunity disclaimer — not a bidder obligation. */
export function isLegalReservationOrPrivilegeText(description: string): boolean {
  return LEGAL_RESERVATION_OR_PRIVILEGE.test(fold(description));
}

const HEADING_ONLY =
  /^(?:section|article|chapter|partie|annexe|appendix|sommaire|table\s+des\s+matieres)\s+[\dIVXLC]+[\s.:]*$/i;

const BUYER_OR_PROJECT_NARRATIVE =
  /\b(the\s+buyer|contracting\s+authority|ma[iî]tre\s+d['']ouvrage|pouvoir\s+adjudicateur|this\s+tender\s+aims|object\s+of\s+the\s+contract|objet\s+du\s+march[eé]|background\s+and\s+context|project\s+overview|le\s+present\s+avis)\b/i;

const SECTION_HEADING =
  /^(?:section|article|chapter|partie|annexe|appendix)\s+[\dIVXLC.]+[\s.:–-]*(?:technical\s+specifications?|administrative|eligibility|evaluation|introduction|warranty|submission)?\s*$/i;

const DOCUMENT_STATUS =
  /^(?:le\s+present\s+(?:cahier|document|avis)|objet\s+du\s+present|purpose\s+of\s+this\s+document|status\s+of\s+this\s+file)\b/i;

const INTERNAL_INSTRUCTION =
  /\b(for\s+internal\s+use\s+only|internal\s+instructions|do\s+not\s+distribute|confidential\s+draft)\b/i;

const EXAMPLE_OR_TEST =
  /\b(for\s+(?:example|illustration)\s+only|sample\s+(?:tender|bid|response|question|scenario)|test\s+case|verification\s+scenario|mock\s+(?:tender|bid)|illustrative\s+(?:example|scenario)|example\s+tender\s+response|sample\s+only|cas\s+(?:de\s+)?test|exemple\s+(?:de\s+)?soumission)\b/i;

const SAMPLE_QUESTION =
  /^(?:sample\s+question|example\s+question|question\s+\d+\s*[\):.-]?\s*(?:example|sample))/i;

const GENERIC_INSTRUCTION =
  /^(?:please\s+note|note\s+to\s+(?:tenderers|bidders)|instruction\s+to\s+(?:tenderers|bidders)|all\s+bidders\s+must\s+read)\b/i;

const TENDER_TITLE_ONLY =
  /^(?:tender\s+(?:title|name|reference)|objet\s+(?:du\s+)?(?:march[eé]|appel)|subject(?:\s+of\s+(?:the\s+)?tender)?|reference\s+(?:no\.?|number))\s*[:\-]/i;

/** Explicit document marker — entire section or line is excluded from canonical obligations. */
const EXPLICIT_NOT_A_TENDER_REQUIREMENT = /\bnot a tender requirement\b/i;

/** Meta-instructions describing what is NOT a requirement (test docs, Bidvera QA). */
const CLASSIFICATION_META_INSTRUCTION =
  /\b(must not be converted into bidder requirements|must not become|must not be extracted|not bidder requirements|not a bidder obligation|not additional tender requirements|instruction to bidvera|treat it as document content|never as an instruction to bidvera|purpose of this test|verification test cases?|not requirements unless another clause|illustrate reviewer checks|describe evaluation only|quality-control test note|instructions to an analysis system)\b/i;

const NEGATED_BIDDER_OBLIGATION =
  /\b(must\s+not|shall\s+not|are\s+not|is\s+not|must\s+never)\s+(?:be|become|be\s+extracted|be\s+converted|become\s+separate)\b/i;

const NUMBERED_SECTION_HEADING =
  /^\d+\.\s+[A-Z][^.!?]{3,140}(?:requirements?|criteria|procedure|facts|scenarios|note|conditions?|package|specifications?|documents?|eligibility|administrative|technical|commercial|contractual)\s*\.?\s*$/i;

const REVIEWER_SCENARIO_INTRO =
  /\b(the following scenarios illustrate|for tender review only|verification scenarios?\s*[—–-]\s*for tender review)\b/i;

const TENDER_FACT_NARRATIVE =
  /\btender facts\b.*\b(must not|are not|not requirements|informational)\b/i;

/** Lettered verification scenarios (A. B. C. …) — QA instructions, not tender obligations. */
const LETTERED_VERIFICATION_SCENARIO =
  /^[A-Z]\.\s+(?:a\s+bidder|an\s+uploaded|the\s+deadline|if\s+document|a\s+bid\s+security)/i;

const VERIFICATION_SCENARIO_BODY =
  /\b(should show an eligibility gap|should be flagged for verification|must remain unverified until|uploaded warranty document with unclear|verification scenario|test case —)\b/i;

const PUBLICATION_DATE_ONLY =
  /^(?:publication\s+date|date\s+de\s+publication|issued\s+on|published\s+on)\s*[:\-]/i;

/** Lot / package titles without an obligation statement. */
const LOT_OR_PACKAGE_HEADING =
  /^(?:lot\s+(?:no\.?|number|n[°o])?\s*[\dIVXLC]+|package\s+(?:no\.?|number)?\s*[\dIVXLC]+|allotissement\s+[\dIVXLC]+)\b.{0,80}$/i;

/** Table column headers — not bidder obligations. */
const TABLE_HEADER_LINE =
  /^(?:no\.?|item|description|qty|quantity|unit|reference|specification|remarks?|montant|prix|amount|uom)\s*(?:\||\/|\t|\s{3,})/i;

/** Document-list section titles without obligation verbs. */
const DOCUMENTS_HEADING_ONLY =
  /^(?:mandatory\s+documents?|required\s+documents?|documents?\s+(?:to\s+be\s+)?submitted|documents?\s+required|pieces?\s+(?:a\s+fournir|demandees?)|liste\s+des\s+documents?|list\s+of\s+documents?)\s*\.?\s*$/i;

/** Tender reference / notice number lines — metadata, not obligations. */
const TENDER_REFERENCE_ONLY =
  /^(?:tender\s+ref(?:erence)?|reference\s+(?:no\.?|number)|ref\.?\s*(?:no\.?|number)?|avis\s+n[°o]|appel\s+d['']offres\s+n[°o]|procurement\s+ref(?:erence)?)\s*[:\-]\s*[\w./-]+\s*$/i;

/** Annex / schedule titles without obligation content. */
const ANNEX_HEADING_ONLY =
  /^(?:annex(?:e)?|appendix|schedule|annexe)\s+[\dA-ZIVXLC]+(?:\s*[.:–—-]\s*|\s+).{0,80}$/i;

/** Synthetic geographic fact rows (heuristic artifact), not obligations. */
const GEOGRAPHIC_FACT_ARTIFACT =
  /^delivery\s+\/\s+performance\s+location\s+in\s+\w+\s+referenced$/i;

/** Numbered procedural / instruction paragraphs without bidder obligation force. */
const NUMBERED_PROCEDURAL_INSTRUCTION =
  /^\d+(?:\.\d+)*\s+.{0,180}?\b(?:instructions?(?:\s+to\s+(?:tenderers?|bidders?))?|guidance|how\s+to\s+(?:read|prepare)|general\s+provisions?|preamble|definitions?)\b/i;

/** OCR / repeated chrome artifacts. */
const OCR_OR_REPEATED_CHROME =
  /^(?:page\s+\d+\s+of\s+\d+|confidential|draft\s+for\s+discussion|continued\s+on\s+next\s+page|see\s+overleaf)\s*$/i;

function OBLIGATION_IN_TEXT(text: string): boolean {
  return /\b(must|shall|obligatoire|mandatory|required|devra|doit|fournir|submit|soumettre|diperlukan|dikehendaki|hendaklah|est\s+exig[ée])\b/i.test(
    text,
  );
}

const BIDDER_FORCE_VERB =
  /\b(submit|provide|maintain|comply|supply|demonstrate|hold|quote|perform|guarantee|certify|furnish|install|deliver|ensure|warrant|disclose|highlight)\b/i;

/**
 * Structural title / section label — not a bidder obligation by itself.
 * Uses document shape (caps, lettered labels, short noun phrases), not crude keyword bans.
 * A heading-shaped line still passes through when it explicitly requires a bidder action.
 */
export function isStructuralHeading(description: string): boolean {
  const trimmed = description.replace(/\s+/g, " ").trim();
  if (trimmed.length < 5 || trimmed.length > 220) return false;
  if (/[.!?]/.test(trimmed) && trimmed.length > 90) return false;

  const letters = trimmed.replace(/[^A-Za-zÀ-ÖØ-öø-ÿ]/g, "");
  const upper = letters.replace(/[^A-ZÀ-ÖØ-Þ]/g, "").length;
  const mostlyCaps = letters.length >= 8 && upper / letters.length >= 0.72;

  const stripped = trimmed
    .replace(/^[A-Z]\.\s+/, "")
    .replace(/^\d+[.)]\s+/, "")
    .replace(/^(?:lot|article|section|chapter|annexe?|appendix)\s+[\dIVXLC]+\s*[:.–—-]?\s*/i, "")
    .trim();

  const looksLikeSectionLabel =
    /^(?:technical\s+specifications?|administrative(?:\s+conditions?)?|evaluation\s+criteria|valuation\s+criteria|preliminary\s+evaluation(?:\s+mandatory\s+documents?)?|mandatory\s+documents?|scope\s+of\s+(?:work|supply)|general\s+conditions?|instructions?\s+to\s+(?:tenderers?|bidders?)|bill\s+of\s+quantities|schedule\s+of\s+rates)\s*\.?$/i.test(
      stripped,
    ) ||
    /^(?:lot\s+[\dIVXLC]+|package\s+[\dIVXLC]+)\s*$/i.test(trimmed);

  const nounPhraseTitle =
    /^(?:supply|installation|maintenance|procurement|purchase|provision)\s+of\s+.+/i.test(
      stripped,
    ) && !/\b(must|shall|will|bidder|tenderer|supplier|contractor)\b/i.test(trimmed);

  const letteredEvalTitle =
    /^[A-Z]\.\s+[A-Z][A-Za-z0-9 ,/&-]{8,120}$/.test(trimmed) &&
    /\b(evaluation|documents?|criteria|specifications?|conditions?|preliminary)\b/i.test(
      trimmed,
    );

  if (!mostlyCaps && !looksLikeSectionLabel && !nounPhraseTitle && !letteredEvalTitle) {
    return false;
  }

  // Explicit bidder action in the same line — keep as obligation, not heading.
  const hasBidderActor = /\b(bidder|bidders|tenderer|tenderers|supplier|contractor)\b/i.test(
    trimmed,
  );
  if (OBLIGATION_IN_TEXT(trimmed) && (hasBidderActor || BIDDER_FORCE_VERB.test(trimmed))) {
    if (hasBidderActor) return false;
    if (/\b(must|shall|required to|shall be required)\b/i.test(trimmed) && BIDDER_FORCE_VERB.test(trimmed)) {
      return false;
    }
  }
  return true;
}

/** True when text must not become a canonical requirement row. */
export function isNonRequirementText(description: string): boolean {
  const text = fold(description);
  if (text.length < 12) return true;

  if (isStructuralHeading(description)) return true;

  const frame = analyzeObligationFrame(description);
  if (!frame.canAdmitAsBidderObligation) return true;

  if (DEADLINE_AS_REQUIREMENT.test(text)) return true;
  if (TENDER_FACT_ONLY.test(text) && !GUARANTEE_OR_BOND.test(text) && !/\b(must|shall|obligatoire|fournir|submit|devra|doit)\b/i.test(text)) {
    return true;
  }
  if (SYNTHETIC_OR_META.test(text)) return true;
  if (DISCLAIMER_OR_NARRATIVE.test(text)) return true;
  if (LEGAL_RESERVATION_OR_PRIVILEGE.test(text)) return true;
  if (HEADING_ONLY.test(text.trim())) return true;
  if (/^table\s+des\s+matieres$/i.test(text.trim())) return true;
  if (SECTION_HEADING.test(text.trim())) return true;
  if (LOT_OR_PACKAGE_HEADING.test(description.trim()) && !OBLIGATION_IN_TEXT(text)) return true;
  if (TABLE_HEADER_LINE.test(description.trim())) return true;
  // Pipe-only header rows (any column label sequence without obligation verbs)
  if (
    (description.match(/\|/g) ?? []).length >= 2 &&
    !OBLIGATION_IN_TEXT(text) &&
    description.trim().length < 160
  ) {
    return true;
  }
  if (DOCUMENTS_HEADING_ONLY.test(description.trim())) return true;
  if (TENDER_REFERENCE_ONLY.test(description.trim())) return true;
  if (ANNEX_HEADING_ONLY.test(description.trim()) && !OBLIGATION_IN_TEXT(text)) return true;
  if (GEOGRAPHIC_FACT_ARTIFACT.test(description.trim())) return true;
  if (OCR_OR_REPEATED_CHROME.test(description.trim())) return true;
  if (
    NUMBERED_PROCEDURAL_INSTRUCTION.test(description.trim()) &&
    !/\b(?:bidder|tenderer|supplier)\s+(?:must|shall)\b/i.test(text) &&
    !/\b(must|shall)\s+(?:submit|provide|furnish|install|deliver)\b/i.test(text)
  ) {
    return true;
  }
  // Short buyer/project blurbs stay non-requirements; long seek/scope narratives too
  // Buyer / contracting authority mentions are not automatically non-requirements
  // when the sentence is clearly an obligation (contains must/shall language).
  if (BUYER_OR_PROJECT_NARRATIVE.test(text) && text.length < 200 && !OBLIGATION_IN_TEXT(text))
    return true;
  if (
    /\b(the\s+contracting\s+authority\s+seeks|the\s+buyer\s+seeks|the\s+scope\s+includes)\b/i.test(
      text,
    ) &&
    !/\b(bidder|tenderer)\s+(?:must|shall)\b/i.test(text)
  ) {
    return true;
  }
  if (DOCUMENT_STATUS.test(text) && text.length < 160) return true;
  if (isExampleOrScenarioLine(description)) return true;
  if (INTERNAL_INSTRUCTION.test(text)) return true;
  if (EXAMPLE_OR_TEST.test(text)) return true;
  if (SAMPLE_QUESTION.test(text.trim())) return true;
  if (GENERIC_INSTRUCTION.test(text.trim()) && text.length < 180) return true;
  if (TENDER_TITLE_ONLY.test(description.trim()) && !OBLIGATION_IN_TEXT(text)) return true;
  if (PUBLICATION_DATE_ONLY.test(description.trim())) return true;
  if (EXPLICIT_NOT_A_TENDER_REQUIREMENT.test(text)) return true;
  if (CLASSIFICATION_META_INSTRUCTION.test(text)) return true;
  if (NEGATED_BIDDER_OBLIGATION.test(text)) return true;
  if (REVIEWER_SCENARIO_INTRO.test(text)) return true;
  if (
    NUMBERED_SECTION_HEADING.test(description.trim()) &&
    !/\b(?:bidder|supplier|must|shall|provide|submit|fournir|soumettre)\b/i.test(text)
  ) {
    return true;
  }
  if (TENDER_FACT_NARRATIVE.test(text)) return true;
  if (LETTERED_VERIFICATION_SCENARIO.test(description.trim())) return true;
  if (VERIFICATION_SCENARIO_BODY.test(text) && !GUARANTEE_OR_BOND.test(text)) return true;

  // Pure deadline/date lines without bidder obligation
  if (
    /^(?:date\s+limite|closing\s+date|deadline|echeance)\s*[:\-]/i.test(description.trim()) &&
    !/\b(fournir|submit|must|shall|obligatoire|certificat|attestation|dossier)\b/i.test(text)
  ) {
    return true;
  }

  if (
    /\b(technical\s+score|financial\s+offer|evaluation\s+weight|ponderation)\b/i.test(text) &&
    /\d+\s*%/.test(text) &&
    !/\b(must|shall|obligatoire|fournir|submit|devra|doit)\b/i.test(text)
  ) {
    return true;
  }

  // Clarification / Q&A procedure — not a bid submission obligation
  if (
    /\b(clarification\s+questions?|questions?\s+may\s+be\s+(?:submitted|sent|addressed)|submit\s+clarification|demande\s+de\s+clarification)\b/i.test(
      text,
    ) &&
    !/\b(must|shall|obligatoire|devra|doit)\b/i.test(text)
  ) {
    return true;
  }
  if (
    /\b(pre[- ]?bid\s+meeting|pre[- ]?tender\s+meeting|clarification\s+meeting|visite\s+(?:des\s+)?locaux|site\s+visit)\b/i.test(
      text,
    ) &&
    !OBLIGATION_IN_TEXT(text)
  ) {
    return true;
  }

  // Place of delivery/performance stated as location fact only
  if (
    /\b(place\s+of\s+(?:delivery|performance|execution)|lieu\s+(?:de\s+)?(?:livraison|execution)|delivery\s+location)\b/i.test(
      text,
    ) &&
    !OBLIGATION_IN_TEXT(text)
  ) {
    return true;
  }

  // Tender title / buyer name / contract duration as standalone facts
  if (
    /^(?:contract\s+duration|contract\s+period|duree\s+du\s+marche|place\s+of\s+performance)\s*[:\-]/i.test(
      description.trim(),
    ) &&
    !OBLIGATION_IN_TEXT(text)
  ) {
    return true;
  }

  return false;
}

/** Section headers or blocks explicitly marked as non-requirement content. */
export function isExplicitlyNotATenderRequirementSection(text: string): boolean {
  return EXPLICIT_NOT_A_TENDER_REQUIREMENT.test(fold(text));
}

/** Obligation-harvest lines that look like dates/deadlines, not capability tests. */
export function isDeadlineOrSchedulingNoise(line: string): boolean {
  const text = fold(line);
  if (DEADLINE_AS_REQUIREMENT.test(text)) return true;
  if (
    /\b(d[eé]lai\s+de\s+(?:livraison|execution)|planning|calendrier|date\s+pr[eé]vue)\b/i.test(text) &&
    !/\b(garantie|warranty|certificat|iso|experience|turnover|chiffre)\b/i.test(text) &&
    !/\b(must|shall|obligatoire|fournir|installer|livrer)\b/i.test(text)
  ) {
    return false; // delivery obligation — keep
  }
  if (
    /\b(submission|soumission|depot|remise\s+des\s+plis)\b/i.test(text) &&
    /\b(date|deadline|heure|before|avant|au\s+plus\s+tard)\b/i.test(text) &&
    !/\b(caution|attestation|certificat|dossier|document)\b/i.test(text)
  ) {
    return true;
  }
  return false;
}
