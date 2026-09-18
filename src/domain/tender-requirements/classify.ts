import type { RequirementCategory } from "./types";
import { isNonRequirementText } from "./filter-non-requirements";
import {
  classifyRequirementSemanticKind,
  deriveObligationStrength,
  isScoringSemanticKind,
} from "./semantic-kind";
import { resolveCompatibleCategory } from "./semantic-compatibility";

/** Fold typographic apostrophes / accents for cue matching (does not change stored text). */
function foldForClassify(s: string): string {
  return s
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[\u2018\u2019\u201A\u2032\u02BC]/g, "'")
    .toLowerCase();
}

const INFORMATIONAL_CUES =
  /\b(table\s+des\s+matieres|sommaire|introduction|preambule|objet\s+du\s+present\s+document|le\s+present\s+cahier|dispositions\s+generales|en\s+application\s+des\s+dispositions|article\s+\d+|decret\s+n[°o]|approbation\s+du\s+marche|delai\s+d['']attente|autorite\s+competente|page\s+\d+|voir\s+(ci[- ]?dessus|annexe)|n\.?\s*b\.?\s*:|note\s*:|rappel\s*:)\b/i;

const ELIGIBILITY_CUES =
  /\b(elligib|eligibility|qualif(?:ication|ie)|conditions?\s+de\s+participation|capacites?\s+(?:techniques?|financieres?)|chiffre\s+d['']affaires|turnover|agrement|attestation\s+cnss|situation\s+fiscale|casier\s+judiciaire|domicile\s+au\s+maroc|domicile\s+in\s+morocco|elire\s+domicile|references?\s+(?:similaires?|minimum)|minimum\s+(?:experience|turnover|years)|years?\s+of\s+experience|annees?\s+d['']experience|kementerian\s+kewangan|berdaftar\s+dengan|sijil\s+kkm|pendaftaran\s+masih\s+sah)\b/i;

const TECHNICAL_CUES =
  /\b(solution\s+de\s+virtualisation|infrastructure\s+hyperconverg|hyperconverg|virtualisation|virtualization|vmware|nutanix|hci|installation\s+(?:du\s+)?materiel|logiciels?\s+informatiques|parametrer|migrer|plateforme|support\s+editeur|24\s*\/\s*7|technical\s+spec|specifications?\s+techniques?|execution\s+des\s+prestations|fourniture\s+et\s+l['']installation|internet\s+of\s+things|\biot\b|mengintegrasi|mentauliah|audiovisual|audio\s+visual|\bav\b\s+equipment|projector|projection|sound\s+system|microphone|amplifier|display\s+screen|videoconferenc|control\s+room|broadcast)\b/i;

const ADMINISTRATIVE_CUES =
  /\b(dossier\s+(?:administratif|technique|financier)|pieces?\s+(?:demand|a\s+fournir|obligatoires?)|acte\s+d['']engagement|caution(?:nement)?|caution\s+provisoire|bordereau|soumission|depot\s+des\s+(?:plis|offres)|portail\s+des\s+marches|attestation|certificat(?:e)?(?:\s+de\s+residence|\s+of)?|tax\s+clearance|clearance\s+certificate|fiscal\s+clearance|regularit[eé]\s+fiscale|registre\s+de\s+commerce|cnss|rc\s+pro|documents?\s+(?:exiges?|requis)|submission\s+documents?|sijil\s+ssm|sijil\s+cidb|sijil\s+pkk|upen)\b/i;

const CONTRACTUAL_CUES =
  /\b(garantie|delai\s+de\s+garantie|penalite|resiliation|sous[- ]?traitance|livraison|bulletin\s+de\s+livraison|preavis|remplacer\s+le\s+materiel|conditions?\s+generales|marche\s+public|titulaire\s+(?:est\s+tenu|doit)|insurance|indemnit|liabilit|warranty|bond)\b/i;

const PREFERRED_CUES =
  /\b(souhaitable|preferable|recommande|nice[- ]to[- ]have|preferred|avantageux|bonus|plus[- ]value|appreciated|facultatif|optional|non\s+obligatoire)\b/i;

const EVALUATION_CUES =
  /\b(criteres?\s+d['']attribution|evaluation\s+criteria|evaluated\s+against|scoring\s+criteria|ponderation|weighting|points?\s+attribu|marking\s+scheme|note\s+technique|technical\s+score|evaluation\s+weight|bareme\s+d['']evaluation)\b/i;

const MANDATORY_CUES =
  /\b(obligatoire|mandatory|must|shall|exige|requis|devra|doit|est\s+tenu|imperatif|sous\s+peine)\b/i;

/**
 * Classify a tender statement into one scoring category.
 * Procedural / structural text → INFORMATIONAL (not scored).
 * Delegates semantic kind first for consistent downstream mapping.
 */
export function classifyRequirementCategory(input: {
  description: string;
  existingCategory?: string | null;
  mandatoryHint?: boolean;
}): RequirementCategory {
  const raw = `${input.existingCategory ?? ""} ${input.description}`.trim();
  const text = foldForClassify(raw);

  if (
    PREFERRED_CUES.test(text) &&
    (!MANDATORY_CUES.test(text) ||
      /\b(non\s+obligatoire|not\s+mandatory|optional|facultatif)\b/i.test(text))
  ) {
    return "PREFERRED";
  }

  const semanticKind = classifyRequirementSemanticKind(input);
  const strength = deriveObligationStrength(input.description, semanticKind);

  // Known scoring kinds: resolve domain via SoT compatibility (kind ≠ category).
  // UNKNOWN / non-scoring: fall through to cue-based domain classification below
  // so evaluation/deadline/fact lines keep their categories.
  if (semanticKind !== "UNKNOWN" && isScoringSemanticKind(semanticKind)) {
    const fromSemantic = resolveCompatibleCategory({
      semanticKind,
      preferredCategory: input.existingCategory,
      obligationStrength: strength,
      description: input.description,
    });
    if (fromSemantic === "MANDATORY_TECHNICAL" && input.mandatoryHint === false) {
      const soft = foldForClassify(`${input.existingCategory ?? ""} ${input.description}`);
      if (
        PREFERRED_CUES.test(soft) &&
        (!MANDATORY_CUES.test(soft) ||
          /\b(non\s+obligatoire|not\s+mandatory|optional|facultatif)\b/i.test(soft))
      ) {
        return "PREFERRED";
      }
    }
    return fromSemantic;
  }

  if (semanticKind === "EVALUATION_CRITERION") return "EVALUATION";
  if (
    semanticKind === "DEADLINE" ||
    semanticKind === "INFORMATIONAL_FACT" ||
    semanticKind === "CLARIFICATION_PROCEDURAL" ||
    semanticKind === "REVIEWER_INSTRUCTION" ||
    semanticKind === "TEST_SCENARIO" ||
    semanticKind === "QA_META"
  ) {
    return "INFORMATIONAL";
  }

  if (!raw || raw.length < 12) return "INFORMATIONAL";

  if (isNonRequirementText(input.description)) return "INFORMATIONAL";

  if (INFORMATIONAL_CUES.test(text) && !TECHNICAL_CUES.test(text) && !ELIGIBILITY_CUES.test(text)) {
    return "INFORMATIONAL";
  }

  // Short procedural fragments about approval / decree articles
  if (
    /approbation\s+du\s+marche|dispositions\s+de\s+l['']article|decret\s+n/i.test(text) &&
    !ELIGIBILITY_CUES.test(text) &&
    !TECHNICAL_CUES.test(text) &&
    !ADMINISTRATIVE_CUES.test(text)
  ) {
    return "INFORMATIONAL";
  }

  if (
    PREFERRED_CUES.test(text) &&
    (!MANDATORY_CUES.test(text) ||
      /\b(non\s+obligatoire|not\s+mandatory|optional|facultatif)\b/i.test(text))
  ) {
    return "PREFERRED";
  }

  if (EVALUATION_CUES.test(text) && !MANDATORY_CUES.test(text)) {
    return "EVALUATION";
  }

  if (ELIGIBILITY_CUES.test(text)) {
    return "MANDATORY_ELIGIBILITY";
  }

  if (TECHNICAL_CUES.test(text)) {
    return input.mandatoryHint === false && !MANDATORY_CUES.test(text)
      ? "PREFERRED"
      : "MANDATORY_TECHNICAL";
  }

  if (ADMINISTRATIVE_CUES.test(text)) {
    return "MANDATORY_ADMINISTRATIVE";
  }

  if (CONTRACTUAL_CUES.test(text)) {
    if (
      /approbation|delai\s+d['']attente|autorite\s+competente/i.test(text) &&
      !MANDATORY_CUES.test(text)
    ) {
      return "INFORMATIONAL";
    }
    return "CONTRACTUAL";
  }

  // Legacy fine categories from heuristic
  const legacy = (input.existingCategory ?? "").toLowerCase();
  if (/cert|compliance|security/.test(legacy)) return "MANDATORY_TECHNICAL";
  if (/eligib|financial|experience|geography|qualif/.test(legacy)) return "MANDATORY_ELIGIBILITY";
  if (/document|submission|guarantee|caution/.test(legacy)) return "MANDATORY_ADMINISTRATIVE";
  if (/contract|delivery|warranty|insurance/.test(legacy)) return "CONTRACTUAL";
  if (/preferred|evaluation|scoring/.test(legacy)) return "PREFERRED";
  if (/scope|lot/.test(legacy)) return "INFORMATIONAL";
  if (/technical|support|install/.test(legacy)) return "MANDATORY_TECHNICAL";

  if (MANDATORY_CUES.test(text) && text.length >= 40) {
    if (
      ADMINISTRATIVE_CUES.test(text) ||
      /submit|soumettre|fournir|dossier|certificate|certificat|attestation/i.test(text)
    ) {
      return "MANDATORY_ADMINISTRATIVE";
    }
    return "CONTRACTUAL";
  }

  return "INFORMATIONAL";
}

export function titleFromRequirement(description: string, category: RequirementCategory): string {
  const cleaned = description.replace(/\s+/g, " ").trim();
  const short = cleaned.length > 72 ? `${cleaned.slice(0, 69)}…` : cleaned;
  const prefix: Record<RequirementCategory, string> = {
    MANDATORY_ELIGIBILITY: "Eligibility",
    MANDATORY_TECHNICAL: "Technical",
    MANDATORY_ADMINISTRATIVE: "Administrative",
    CONTRACTUAL: "Contractual",
    EVALUATION: "Evaluation",
    PREFERRED: "Preferred",
    INFORMATIONAL: "Informational",
  };
  if (/domicile\s+au\s+Maroc|[eé]lire\s+domicile|domicile\s+in\s+Morocco/i.test(cleaned)) {
    return "Registered domicile in Morocco";
  }
  if (/hyperconverg|virtualisation|vmware/i.test(cleaned)) {
    return "Hyperconverged / virtualization solution";
  }
  if (/24\s*\/\s*7/i.test(cleaned)) return "24/7 editor support";
  if (/caution/i.test(cleaned)) return "Provisional bond / caution";
  if (/CNSS/i.test(cleaned)) return "CNSS attestation";
  if (/ISO\s?\d+/i.test(cleaned)) {
    const m = cleaned.match(/ISO\s?\d+(?::\d+)?/i);
    return m ? `${m[0]} certification` : "Certification requirement";
  }
  if (/livraison|installation/i.test(cleaned) && /mat[eé]riel|logiciel/i.test(cleaned)) {
    return "Delivery and installation of IT equipment/software";
  }
  return `${prefix[category]}: ${short}`;
}

export function isMandatoryCategory(category: RequirementCategory): boolean {
  return (
    category === "MANDATORY_ELIGIBILITY" ||
    category === "MANDATORY_TECHNICAL" ||
    category === "MANDATORY_ADMINISTRATIVE"
  );
}
