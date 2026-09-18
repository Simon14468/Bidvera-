/**
 * Canonical semantic kinds for tender intelligence.
 * Separates obligations, documents, evaluation, deadlines, and facts.
 */

import type { RequirementCategory } from "./types";
import { isNonRequirementText } from "./filter-non-requirements";
import {
  defaultCategoryForSemanticKind,
  isCategoryCompatibleWithSemanticKind,
} from "./semantic-compatibility";

export const REQUIREMENT_SEMANTIC_KINDS = [
  "ADMINISTRATIVE_REQUIREMENT",
  "TECHNICAL_REQUIREMENT",
  "ELIGIBILITY_REQUIREMENT",
  "REQUIRED_DOCUMENT",
  "PERFORMANCE_OBLIGATION",
  "CONTRACTUAL_OBLIGATION",
  "FINANCIAL_COMMERCIAL_CONDITION",
  "GUARANTEE_SECURITY_REQUIREMENT",
  "EVALUATION_CRITERION",
  "DEADLINE",
  "CLARIFICATION_PROCEDURAL",
  "INFORMATIONAL_FACT",
  "REVIEWER_INSTRUCTION",
  "TEST_SCENARIO",
  "QA_META",
  "UNKNOWN",
] as const;

export type RequirementSemanticKind = (typeof REQUIREMENT_SEMANTIC_KINDS)[number];

export type ObligationStrength = "MANDATORY" | "CONDITIONAL" | "OPTIONAL" | "INFORMATIONAL";

function fold(s: string): string {
  return s
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[\u2018\u2019\u201A\u2032\u02BC]/g, "'")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

const MANDATORY_CUES =
  /\b(obligatoire|mandatory|must|shall|exige|requis|required|devra|doit|est\s+tenu|imperatif|sous\s+peine|are\s+required|is\s+required|will\s+be\s+made|may\s+be\s+applied|may\s+apply|is\s+responsible|remain(?:s)?\s+responsible|remain(?:s)?\s+the\s+contractor(?:'s)?\s+responsibility)\b/i;

const ACTIVITY_MANDATORY_CUES =
  /\b(provide|supply|install|complete|commission(?:ing)?|deliver)\b/i;

const OPTIONAL_CUES =
  /\b(souhaitable|preferable|recommande|nice[- ]to[- ]have|preferred|avantageux|bonus|plus[- ]value|appreciated|facultatif|optional|non\s+obligatoire|not\s+mandatory)\b/i;

/** Soft / non-binding language — not a hard mandatory obligation. */
const SOFT_OBLIGATION_CUES =
  /\b(may\s+be\s+(?:requested|required|asked|submitted)|might\s+be|could\s+be\s+requested)\b/i;

/**
 * Bidder-triggered conditionality — IF / WHERE / WHEN / ONLY IF / APPLICABLE TO /
 * LOT-SPECIFIC / JV-SPECIFIC. Not generic contractual "subject to approval".
 */
const CONDITIONAL_CUES =
  /\b(if\s+applicable|le\s+cas\s+[eé]ch[eé]ant|when\s+applicable|where\s+applicable|only\s+if|only\s+where|only\s+when|applicable\s+to|applicable\s+only|sous\s+reserve|provided\s+that|dans\s+le\s+cas\s+o[uù]|if\s+the\s+bidder|where\s+the\s+bidder|when\s+the\s+bidder|for\s+joint\s+ventures?|jv[- ]specific|lot[- ]specific|in\s+the\s+case\s+of\s+(?:a\s+)?(?:joint\s+venture|jv)|if\s+(?:a\s+)?(?:joint\s+venture|jv)\b)\b/i;

/**
 * True when requirement text still carries the trigger that makes an obligation conditional.
 * Shared by normalize, dedupe, final-consistency, and Guardian checks.
 */
export function hasConditionalTriggerContext(description: string): boolean {
  if (!description?.trim()) return false;
  const text = fold(description);
  return (
    CONDITIONAL_CUES.test(text) ||
    /\(conditional\)/i.test(description) ||
    /^(?:if|where|when|only\s+if)\b/i.test(text) ||
    /\bif\s+applicable\b/i.test(text) ||
    /\bwhere\s+applicable\b/i.test(text) ||
    /\bonly\s+if\b/i.test(text)
  );
}

const DEADLINE_CUES =
  /\b(submission\s*\/?\s*closing|closing\s+date|date\s+limite|heure\s+limite|deadline|echeance|date\s+et\s+heure\s+limites?|before\s+\d|au\s+plus\s+tard)\b/i;

const EVALUATION_CUES =
  /\b(criteres?\s+d['']attribution|evaluation\s+criteria|scoring\s+criteria|ponderation|weighting|technical\s+score|financial\s+offer|evaluation\s+weight|bareme|marking\s+scheme|note\s+technique|will\s+be\s+scored|scored\s+out\s+of|points?\s+based\s+on)\b/i;

const EVALUATION_WEIGHT_OR_POINTS = /\d+\s*%|\d+\s+points?\b/i;

const FACT_CUES =
  /\b(contract\s+value|estimated\s+value|valeur\s+(?:estimee|du\s+marche)|montant\s+(?:estime|du\s+marche|total)|duration\s+of\s+contract|duree\s+du\s+marche|publication\s+date|reference\s+number|contract\s+duration)\b/i;

const DOCUMENT_CUES =
  /\b(submit|soumettre|fournir|provide|attach|enclose|joint|dossier|pieces?\s+(?:a\s+fournir|demand|obligatoires?)|documents?\s+(?:exiges?|requis|required)|certificat|attestation|registre\s+de\s+commerce|certificate\s+of\s+incorporation|tax\s+clearance|cnss|acte\s+d['']engagement|bordereau)\b/i;

const ELIGIBILITY_CUES =
  /\b(eligib|qualif(?:ication|ie)|legally\s+registered|authorized\s+to\s+perform|comparable\s+projects|conditions?\s+de\s+participation|capacites?\s+(?:techniques?|financieres?)|chiffre\s+d['']affaires|turnover|experience|exp[eé]rience|references?\s+(?:similaires?|minimum)|minimum\s+(?:experience|turnover|years)|years?\s+of\s+experience|annees?\s+d['']experience|elire\s+domicile|agrement|casier\s+judiciaire|situation\s+fiscale|sont\s+exclus|seront\s+exclus|are\s+excluded|shall\s+be\s+(?:excluded|disqualified)|ineligible|conflit\s+d['']int[eé]r[eê]ts|conflict\s+of\s+interest)\b/i;

const TECHNICAL_CUES =
  /\b(specification|specifications?\s+techniques?|technical\s+spec|must\s+support|shall\s+support|equipment\s+must|installation|compatibility|throughput|bandwidth)\b/i;

const PERFORMANCE_CUES =
  /\b(deliver(?:y|)\s+within|livraison\s+(?:dans|sous)|delivery\s+must|must\s+(?:occur|complete|deliver)|delai\s+de\s+(?:livraison|execution)|within\s+\d+\s+(?:days|months|weeks)|commissioning|mise\s+en\s+service|perform\s+(?:the\s+)?(?:works|services)|execution\s+des\s+prestations)\b/i;

const GUARANTEE_CUES =
  /\b(caution(?:nement)?|caution\s+provisoire|caution\s+definitive|provisional\s+(?:bond|bid\s+security|guarantee)|provisional\s+bid\s+security|bid\s+security|performance\s+bond|performance\s+guarantee|bid\s+bond|bank\s+guarantee|garantie\s+(?:de\s+)?(?:bonne\s+ex[eé]cution|provisoire|definitive)|retention\s+(?:bond|money|guarantee)|retenue\s+de\s+garantie)\b/i;

const FINANCIAL_CUES =
  /\b(payment\s+terms|payment\s+will\s+be\s+made|monthly\s+certified|certified\s+progress|delai\s+de\s+paiement|price\s+schedule|bordereau\s+des\s+prix|financial\s+offer|turnover\s+threshold|minimum\s+turnover|chiffre\s+d['']affaires|annual\s+revenue|liquidit[eé]|solvabilit[eé]|prices?\s+shall\s+remain\s+firm|non[- ]revisable|firm\s+and\s+non[- ]revisable|delay\s+penalt)\b/i;

const CONTRACTUAL_CUES =
  /\b(penalit|resiliation|sous[- ]?traitance|insurance|indemnit|liabilit|warranty\s+period|delai\s+de\s+garantie|titulaire\s+(?:est\s+tenu|doit)|conditions?\s+generales|force\s+majeure|confidentialit)\b/i;

const ADMINISTRATIVE_CUES =
  /\b(portail\s+des\s+marches|depot\s+des\s+(?:plis|offres)|soumission|submission\s+process|language\s+of\s+bid|langue\s+de\s+la\s+offre|copies\s+required|nombre\s+d['']exemplaires|signature|signer|legal\s+representative)\b/i;

const PROCEDURAL_CUES =
  /\b(clarification|questions?\s+(?:may|must)\s+be|visite\s+(?:des\s+)?locaux|site\s+visit|pre[- ]bid|reunion\s+(?:de\s+)?clarification|addendum|rectificatif|proc[eé]dure|instruction\s+to\s+(?:tenderers|bidders))\b/i;

/**
 * Clarification Q&A / PE confirmation / modification notices — not original bidder
 * obligations. Detected even when the sentence contains "must/shall/doit".
 */
const CLARIFICATION_QA_CUES =
  /\b(pouvez[- ]vous\s+confirmer|can\s+you\s+confirm|please\s+confirm|kindly\s+confirm|could\s+you\s+confirm|we\s+(?:would\s+like\s+to\s+)?(?:request|seek)\s+(?:a\s+)?clarification|demande\s+de\s+clarification|question\s+de\s+clarification|clarification\s+question)\b/i;

const CLARIFICATION_ANSWER_CUES =
  /\b((?:l[''])?autorit[eé]\s+contractante\s+confirme|contracting\s+authority\s+confirms|procuring\s+entity\s+confirms|in\s+response\s+to\s+(?:the\s+)?(?:clarification|question)|r[eé]ponse\s+[aà]\s+(?:la\s+)?(?:question|demande\s+de\s+clarification))\b/i;

const REVISION_MODIFICATION_NOTICE_CUES =
  /\b(addendum|corrigendum|rectificatif|modification\s+notice|avis\s+de\s+modification|this\s+(?:clarification|addendum|corrigendum)\s+(?:supersedes|amends|modifies)|la\s+pr[eé]sente\s+(?:clarification|modification)\s+(?:annule|remplace|modifie))\b/i;

const SCOPE_TITLE_CUES =
  /^(?:supply[, ]+installation(?:\s+and\s+\w+)*|supply\s+and\s+installation|fourniture\s+et\s+l['']installation|objet\s+(?:du\s+)?(?:march[eé]|appel)|subject(?:\s+of\s+(?:the\s+)?tender)?|tender\s+title|request\s+for\s+tender)\b|^subject\s*[:\-]/i;

const NUMBERED_SECTION_HEADING =
  /^\d+\.\s+[A-Z][^.!?]{3,140}(?:requirements?|criteria|procedure|facts|scenarios|note|conditions?|package|criteria|specifications?|documents?|eligibility|administrative|technical|commercial|contractual)\s*\.?\s*$/i;

const REVIEWER_SCENARIO_CUES =
  /\b(illustrate\s+reviewer\s+checks|reviewer\s+checks\s+whether|for\s+tender\s+review\s+only|not\s+additional\s+tender\s+requirements|scenario\s+[a-e]\s*:|verification\s+scenarios?\s*[—–-]\s*for\s+tender\s+review)\b/i;

const QA_META_CUES =
  /\b(must\s+not\s+(?:be|become|be\s+extracted)|not\s+bidder\s+requirements|not\s+a\s+bidder\s+obligation|not\s+a\s+tender\s+requirement|quality[- ]control\s+test\s+note|instructions?\s+to\s+an\s+analysis\s+system|analysis\s+note\s*:|expected\s+distinctions|describe\s+evaluation\s+only|must\s+not\s+become\s+separate\s+compliance|tender\s+facts\s+only)\b/i;

const NON_SCORING_SEMANTIC_KINDS = new Set<RequirementSemanticKind>([
  "EVALUATION_CRITERION",
  "DEADLINE",
  "CLARIFICATION_PROCEDURAL",
  "INFORMATIONAL_FACT",
  "REVIEWER_INSTRUCTION",
  "TEST_SCENARIO",
  "QA_META",
]);

/** Semantic kinds that become scored TenderRequirement rows. */
export function isScoringSemanticKind(kind: RequirementSemanticKind): boolean {
  return !NON_SCORING_SEMANTIC_KINDS.has(kind);
}

/**
 * Default domain category for a semantic kind (fallback only).
 * Kind and category are orthogonal — use `isSemanticKindAlignedWithCategory`
 * / `semantic-compatibility` for validity, not equality with this default.
 */
export function semanticKindToCategory(kind: RequirementSemanticKind): RequirementCategory {
  return defaultCategoryForSemanticKind(kind);
}

export function semanticKindDisplayLabel(kind: RequirementSemanticKind): string {
  const labels: Record<RequirementSemanticKind, string> = {
    ADMINISTRATIVE_REQUIREMENT: "Administrative requirement",
    TECHNICAL_REQUIREMENT: "Technical requirement",
    ELIGIBILITY_REQUIREMENT: "Eligibility / qualification",
    REQUIRED_DOCUMENT: "Required submission document",
    PERFORMANCE_OBLIGATION: "Delivery / performance obligation",
    CONTRACTUAL_OBLIGATION: "Contractual obligation",
    FINANCIAL_COMMERCIAL_CONDITION: "Financial / commercial condition",
    GUARANTEE_SECURITY_REQUIREMENT: "Guarantee / security requirement",
    EVALUATION_CRITERION: "Evaluation criterion",
    DEADLINE: "Deadline / important date",
    CLARIFICATION_PROCEDURAL: "Clarification / procedural condition",
    INFORMATIONAL_FACT: "Informational fact",
    REVIEWER_INSTRUCTION: "Reviewer instruction (not a bidder obligation)",
    TEST_SCENARIO: "Verification / test scenario (not a bidder obligation)",
    QA_META: "Analysis / QA instruction (not a bidder obligation)",
    UNKNOWN: "Needs verification",
  };
  return labels[kind];
}

/**
 * Classify tender text into one of 12 canonical semantic kinds (+ UNKNOWN).
 */
export function classifyRequirementSemanticKind(input: {
  description: string;
  existingCategory?: string | null;
  mandatoryHint?: boolean;
}): RequirementSemanticKind {
  const raw = `${input.existingCategory ?? ""} ${input.description}`.trim();
  if (!raw || raw.length < 12) return "INFORMATIONAL_FACT";
  const text = fold(raw);
  const trimmed = input.description.trim();
  const explicitRequirementPrefix = /^(?:[•\-\u2022]\s*)?[ETR]-\d{2}\b/i.test(trimmed);

  if (QA_META_CUES.test(text)) return "QA_META";
  if (REVIEWER_SCENARIO_CUES.test(text)) {
    return /scenario\s+[a-e]/i.test(text) ? "TEST_SCENARIO" : "REVIEWER_INSTRUCTION";
  }
  // Clarification / revision context stays distinct from original obligations —
  // even when the same sentence uses obligation-like wording ("doit", "must").
  if (
    CLARIFICATION_QA_CUES.test(text) ||
    CLARIFICATION_ANSWER_CUES.test(text) ||
    REVISION_MODIFICATION_NOTICE_CUES.test(text)
  ) {
    return "CLARIFICATION_PROCEDURAL";
  }
  if (/^(?:lot\s+(?:no\.?|number|n[°o])?\s*[\dIVXLC]+|mandatory\s+documents?|required\s+documents?)\s*[:\-–]?\s*\.?\s*$/i.test(trimmed)) {
    return "INFORMATIONAL_FACT";
  }
  if (
    NUMBERED_SECTION_HEADING.test(trimmed) &&
    !/\b(?:bidder|supplier|must|shall|provide|submit|fournir|soumettre)\b/i.test(text)
  ) {
    return "INFORMATIONAL_FACT";
  }

  if (isNonRequirementText(input.description)) {
    if (GUARANTEE_CUES.test(text)) return "GUARANTEE_SECURITY_REQUIREMENT";
    if (DEADLINE_CUES.test(text)) return "DEADLINE";
    if (EVALUATION_CUES.test(text) && EVALUATION_WEIGHT_OR_POINTS.test(text)) {
      return "EVALUATION_CRITERION";
    }
    if (FACT_CUES.test(text)) return "INFORMATIONAL_FACT";
    return "INFORMATIONAL_FACT";
  }

  if (
    SCOPE_TITLE_CUES.test(input.description.trim()) &&
    !/\b(must|shall|obligatoire|devra|doit|bidder|supplier)\b/i.test(text)
  ) {
    return "INFORMATIONAL_FACT";
  }

  if (DEADLINE_CUES.test(text) && !DOCUMENT_CUES.test(text) && !GUARANTEE_CUES.test(text)) {
    return "DEADLINE";
  }

  if (
    EVALUATION_CUES.test(text) &&
    EVALUATION_WEIGHT_OR_POINTS.test(text) &&
    !MANDATORY_CUES.test(text)
  ) {
    return "EVALUATION_CRITERION";
  }

  if (FACT_CUES.test(text) && !MANDATORY_CUES.test(text) && !DOCUMENT_CUES.test(text) && !GUARANTEE_CUES.test(text)) {
    return "INFORMATIONAL_FACT";
  }

  if (GUARANTEE_CUES.test(text)) {
    return "GUARANTEE_SECURITY_REQUIREMENT";
  }

  if (/\bpenalt|late[- ]delivery\s+penalt|late\s+delivery\s+shall\s+incur\b/i.test(text)) {
    return "CONTRACTUAL_OBLIGATION";
  }

  if (
    FINANCIAL_CUES.test(text) ||
    /\bpayment\s+(?:shall|will\s+be\s+made)\b|\bdelai\s+de\s+paiement\b/i.test(text)
  ) {
    return "FINANCIAL_COMMERCIAL_CONDITION";
  }

  if (
    PROCEDURAL_CUES.test(text) &&
    !explicitRequirementPrefix &&
    !MANDATORY_CUES.test(text) &&
    !ACTIVITY_MANDATORY_CUES.test(text) &&
    !DOCUMENT_CUES.test(text) &&
    // Incidental "procédure" in an eligibility exclusion must not demote it.
    !ELIGIBILITY_CUES.test(text)
  ) {
    return "CLARIFICATION_PROCEDURAL";
  }

  if (
    DOCUMENT_CUES.test(text) &&
    /\b(certificat|attestation|document|registration|clearance|cnss|acte|bordereau|certificate|submit|soumettre|fournir|attach|enclose)\b/i.test(
      text,
    ) &&
    /\b(must|shall|obligatoire|required|requis|submit|soumettre|fournir|provide|attach|enclose)\b/i.test(
      text,
    ) &&
    !/\bclarification\s+questions?\b/i.test(text)
  ) {
    // Capability thresholds with incidental "document" words stay eligibility.
    if (
      ELIGIBILITY_CUES.test(text) &&
      /\b(years?\s+of\s+experience|minimum\s+(?:experience|turnover|years)|comparable\s+projects)\b/i.test(
        text,
      ) &&
      !/\b(submit|soumettre|attach|enclose|proving|as\s+evidence|supporting\s+documents?)\b/i.test(
        text,
      )
    ) {
      return "ELIGIBILITY_REQUIREMENT";
    }
    return "REQUIRED_DOCUMENT";
  }

  if (ELIGIBILITY_CUES.test(text)) {
    return "ELIGIBILITY_REQUIREMENT";
  }

  if (TECHNICAL_CUES.test(text)) {
    return "TECHNICAL_REQUIREMENT";
  }

  if (PERFORMANCE_CUES.test(text)) {
    return "PERFORMANCE_OBLIGATION";
  }

  if (CONTRACTUAL_CUES.test(text)) {
    return "CONTRACTUAL_OBLIGATION";
  }

  if (ADMINISTRATIVE_CUES.test(text)) {
    return "ADMINISTRATIVE_REQUIREMENT";
  }

  const legacy = (input.existingCategory ?? "").toLowerCase();
  if (/document|submission/.test(legacy)) return "REQUIRED_DOCUMENT";
  if (/eligib|qualif|experience|financial/.test(legacy)) return "ELIGIBILITY_REQUIREMENT";
  if (/technical|cert|spec/.test(legacy)) return "TECHNICAL_REQUIREMENT";
  if (/guarantee|caution|bond/.test(legacy)) return "GUARANTEE_SECURITY_REQUIREMENT";
  if (/delivery|performance/.test(legacy)) return "PERFORMANCE_OBLIGATION";
  if (/contract|warranty|insurance/.test(legacy)) return "CONTRACTUAL_OBLIGATION";
  if (/evaluation|scoring/.test(legacy)) return "EVALUATION_CRITERION";
  if (/deadline|date/.test(legacy)) return "DEADLINE";

  if (MANDATORY_CUES.test(text) && text.length >= 24) {
    if (DOCUMENT_CUES.test(text)) return "REQUIRED_DOCUMENT";
    if (TECHNICAL_CUES.test(text)) return "TECHNICAL_REQUIREMENT";
    return "UNKNOWN";
  }

  return "UNKNOWN";
}

/**
 * Preserve document-stated obligation strength.
 * CONDITIONAL only when trigger/condition cues are present — never invent CONDITIONAL
 * from semantic kind alone (that caused "lost trigger context" crashes).
 */
export function deriveObligationStrength(
  description: string,
  semanticKind: RequirementSemanticKind,
): ObligationStrength {
  if (
    semanticKind === "INFORMATIONAL_FACT" ||
    semanticKind === "DEADLINE" ||
    semanticKind === "EVALUATION_CRITERION" ||
    semanticKind === "CLARIFICATION_PROCEDURAL" ||
    semanticKind === "REVIEWER_INSTRUCTION" ||
    semanticKind === "TEST_SCENARIO" ||
    semanticKind === "QA_META"
  ) {
    return "INFORMATIONAL";
  }

  const text = fold(description);
  const textWithoutNegatedMandatory = text.replace(
    /\b(not\s+mandatory|not\s+required|non\s+obligatoire)\b/gi,
    " ",
  );

  if (OPTIONAL_CUES.test(text) && !MANDATORY_CUES.test(textWithoutNegatedMandatory)) {
    return "OPTIONAL";
  }

  if (hasConditionalTriggerContext(description)) {
    return "CONDITIONAL";
  }

  if (SOFT_OBLIGATION_CUES.test(text) && !MANDATORY_CUES.test(text)) {
    return "OPTIONAL";
  }

  // UNKNOWN: never upgrade to MANDATORY from obligation-like wording alone.
  // Keep uncertain/low confidence path in normalize; do not invent a semantic kind.
  if (semanticKind === "UNKNOWN") {
    return "INFORMATIONAL";
  }

  if (MANDATORY_CUES.test(text) || ACTIVITY_MANDATORY_CUES.test(text)) {
    return "MANDATORY";
  }

  // Scoring obligation kinds that passed filters without soft/conditional cues are
  // unconditional obligations — never invent CONDITIONAL without trigger context.
  return "MANDATORY";
}

export function obligationStrengthToMandatory(strength: ObligationStrength): boolean {
  return strength === "MANDATORY";
}

/**
 * True when category is a valid BUSINESS DOMAIN for the given semanticKind.
 * Does NOT require equality with `semanticKindToCategory` — e.g.
 * REQUIRED_DOCUMENT + MANDATORY_TECHNICAL is valid.
 */
export function isSemanticKindAlignedWithCategory(
  kind: RequirementSemanticKind,
  category: RequirementCategory,
): boolean {
  return isCategoryCompatibleWithSemanticKind(kind, category);
}
